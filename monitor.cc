#include <node_api.h>
#include <v8.h>
#include <uv.h>
#include <atomic>
#include <string>
#include <stdio.h>

using namespace v8;

typedef struct {
    uv_loop_t* main_loop;
    std::atomic<uint32_t> microtasks_count;
    char top_function[256];
    size_t used_heap;
    size_t total_heap;
    std::atomic<int> stop_signal;
    napi_threadsafe_function tsfn;
} monitor_data_t;

monitor_data_t global_data;
uv_thread_t monitor_thread_id;

void CallJsEventHandler(napi_env env, napi_value js_callback, void* context, void* data) {
    napi_value undefined, obj, js_func, js_mem_used, js_mem_total, js_reqs;
    napi_get_undefined(env, &undefined);
    napi_create_object(env, &obj);

    napi_create_string_utf8(env, global_data.top_function, NAPI_AUTO_LENGTH, &js_func);
    napi_create_int64(env, global_data.used_heap, &js_mem_used);
    napi_create_int64(env, global_data.total_heap, &js_mem_total);

    // pega o n de requisições ativas na libuv
    napi_create_uint32(env, (uint32_t)global_data.main_loop->active_reqs.count, &js_reqs);

    napi_set_named_property(env, obj, "function", js_func);
    napi_set_named_property(env, obj, "usedHeap", js_mem_used);
    napi_set_named_property(env, obj, "totalHeap", js_mem_total);
    napi_set_named_property(env, obj, "activeRequests", js_reqs);

    napi_call_function(env, undefined, js_callback, 1, &obj, NULL);
}

void CaptureStackTrace(Isolate* isolate) {
    HandleScope handle_scope(isolate);
    Local<StackTrace> stack = StackTrace::CurrentStackTrace(isolate, 1);
    if (stack->GetFrameCount() > 0) {
        Local<StackFrame> frame = stack->GetFrame(isolate, 0);
        String::Utf8Value func(isolate, frame->GetFunctionName());
        String::Utf8Value script(isolate, frame->GetScriptName());
        snprintf(global_data.top_function, sizeof(global_data.top_function), "%s (%s)", *func ? *func : "anonymous", *script ? *script : "internal");
    }
}

void OnMicrotasksCompleted(Isolate* isolate, void* data) {
    global_data.microtasks_count++;
    HeapStatistics stats;
    isolate->GetHeapStatistics(&stats);
    global_data.used_heap = stats.used_heap_size();
    global_data.total_heap = stats.heap_size_limit();
    CaptureStackTrace(isolate);
}

void monitor_thread_func(void* arg) {
    monitor_data_t* d = (monitor_data_t*)arg;
    uint64_t last_check = uv_now(d->main_loop);

    while (!d->stop_signal) {
        uint64_t now = uv_now(d->main_loop);
        uint64_t delta = now - last_check;

        if (delta > 40) { //tick > 40ms
            napi_call_threadsafe_function(d->tsfn, NULL, napi_tsfn_blocking);
        }

        last_check = now;
        uv_sleep(16);
    }
}

void cleanup(void* arg) {
    global_data.stop_signal = 1;
    uv_thread_join(&monitor_thread_id);
}

napi_value StartMonitor(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1], resource_name;
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    napi_create_string_utf8(env, "EventLoopBlockMonitor", NAPI_AUTO_LENGTH, &resource_name);

    napi_create_threadsafe_function(
        env, args[0], NULL, resource_name, 0, 1, NULL, NULL, NULL,
        CallJsEventHandler, &global_data.tsfn
    );

    Isolate* isolate = Isolate::GetCurrent();
    isolate->AddMicrotasksCompletedCallback(OnMicrotasksCompleted);

    global_data.main_loop = uv_default_loop();
    global_data.stop_signal = 0;

    napi_add_env_cleanup_hook(env, cleanup, NULL);
    uv_thread_create(&monitor_thread_id, monitor_thread_func, &global_data);

    return NULL;
}

napi_value Init(napi_env env, napi_value exports) {
    napi_value fn;
    napi_create_function(env, NULL, 0, StartMonitor, NULL, &fn);
    napi_set_named_property(env, exports, "start", fn);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
