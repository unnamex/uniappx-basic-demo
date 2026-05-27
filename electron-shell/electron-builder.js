const target = process.env.GPU_TARGET || 'all';

// 定义需要过滤的文件 glob
let ollamaFilter = ["**/*"];

if (target === 'cpu') {
  // 纯 CPU 模式：排除所有 CUDA(NVIDIA) 和 ROCm(AMD) 相关文件
  ollamaFilter = [
    "**/*",
    "!cublas*.dll", "!cudart*.dll", "!rocblas.dll", "!hipblas.dll",
    "!rocm/**/*", "!rocblas/**/*",
    "!ollama_runners/cuda_v11.3/**/*", "!ollama_runners/rocm_v5.7/**/*",
    "!lib/ollama/runners/cuda_v11_avx/**/*", "!lib/ollama/runners/cuda_v12_avx/**/*", "!lib/ollama/runners/rocm_avx/**/*",
    "!lib/ollama/rocblas/**/*"
  ];
} else if (target === 'nvidia') {
  // NVIDIA 模式：排除 AMD ROCm 相关文件
  ollamaFilter = [
    "**/*",
    "!rocblas.dll", "!hipblas.dll",
    "!rocm/**/*", "!rocblas/**/*",
    "!ollama_runners/rocm_v5.7/**/*",
    "!lib/ollama/runners/rocm_avx/**/*",
    "!lib/ollama/rocblas/**/*"
  ];
} else if (target === 'amd') {
  // AMD 模式：排除 NVIDIA CUDA 相关文件
  ollamaFilter = [
    "**/*",
    "!cublas*.dll", "!cudart*.dll",
    "!ollama_runners/cuda_v11.3/**/*",
    "!lib/ollama/runners/cuda_v11_avx/**/*", "!lib/ollama/runners/cuda_v12_avx/**/*"
  ];
}

module.exports = {
  "appId": "com.avpbc.pop",
  "productName": "CraftX",
  "copyright": "Copyright © 2026",
  "directories": {
    "output": "release"
  },
  "compression": "store",
  "files": [
    "dist/**/*",
    "main.js",
    "preload.js",
    "icons/**/*",
    "ai-service/**/*",
    "node_modules/**/*"
  ],
  "extraResources": [
    {
      "from": "vendor/ollama/",
      "to": "ollama/",
      "filter": ollamaFilter
    },
    {
      "from": "vendor/models-selected/",
      "to": "models/",
      "filter": ["**/*"]
    },
    {
      "from": "vendor/embed-models/",
      "to": "embed-models/",
      "filter": ["**/*"]
    }
  ],
  "asar": true,
  "asarUnpack": [
    "node_modules/@xenova/transformers/**/*"
  ],
  "win": {
    "target": [
      {
        "target": "zip",
        "arch": ["x64"]
      },
      {
        "target": "dir",
        "arch": ["x64"]
      }
    ],
    "icon": "icons/icon.ico",
    "artifactName": `\${productName}-\${version}-win-\${arch}-${target}.\${ext}`
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "installerIcon": "icons/icon.ico",
    "uninstallerIcon": "icons/icon.ico",
    "installerHeaderIcon": "icons/icon.ico",
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "CraftX"
  },
  "linux": {
    "target": [
      {
        "target": "deb",
        "arch": ["x64", "arm64"]
      },
      {
        "target": "AppImage",
        "arch": ["x64", "arm64"]
      }
    ],
    "icon": "icons/icon.png",
    "category": "Office",
    "artifactName": `\${productName}-\${version}-linux-\${arch}-${target}.\${ext}`
  },
  "deb": {
    "depends": [
      "libgtk-3-0",
      "libnotify4",
      "libnss3",
      "libxss1",
      "libxtst6",
      "xdg-utils",
      "libatspi2.0-0",
      "libsecret-1-0"
    ]
  }
};
