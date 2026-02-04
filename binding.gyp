{
  "targets": [
    {
      "target_name": "event_loop_inspector",
      "sources": [ "monitor.cc" ],
      "cflags_cc": [ "-std=c++20" ],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
        "MACOSX_DEPLOYMENT_TARGET": "12.0",
        "OTHER_CPLUSPLUSFLAGS": [ "-std=c++20", "-stdlib=libc++" ]
      }
    }
  ]
}
