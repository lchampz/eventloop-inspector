{
  "targets": [
    {
      "target_name": "eventloop-inspector",
      "sources": [ "monitor.cc" ],
      "include_dirs": [
        "<(node_root_dir)/deps/uv/include",
        "<(node_root_dir)/src",
        "<(node_root_dir)/deps/v8/include"
      ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "OTHER_CFLAGS": ["-std=c++20"],
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
          }
        }],
        ["OS=='linux'", {
          "cflags_cc": ["-std=c++20"]
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": ["/std:c++20"]
            }
          }
        }]
      ]
    }
  ]
}
