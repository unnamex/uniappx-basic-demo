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

let appFiles = [
  "dist/**/*",
  "main.js",
  "preload.js",
  "icons/**/*",
  "ai-service/**/*",
  "node_modules/**/*"
];

let appExtraResources = [
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
];

let appAsarUnpack = [
  "node_modules/@xenova/transformers/**/*"
];

let appCompression = "store";
let appWinTarget = [
  {
    "target": "zip",
    "arch": ["x64"]
  },
  {
    "target": "dir",
    "arch": ["x64"]
  }
];

if (target === 'noai') {
  appFiles = appFiles.filter(f => f !== "ai-service/**/*");
  // 排除庞大的 AI npm 依赖，避免打入 app.asar
  appFiles.push("!node_modules/@xenova/**/*");
  appFiles.push("!node_modules/onnxruntime-node/**/*");
  appFiles.push("!node_modules/onnxruntime-web/**/*");
  appFiles.push("!node_modules/onnxruntime-common/**/*");
  
  appExtraResources = [];
  appAsarUnpack = [];
  
  // 无AI模式由于排除了大模型，可以恢复生成安装包 exe，并开启极限压缩以减小体积
  appCompression = "maximum";
  appWinTarget = [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ];
}

module.exports = {
  "appId": "com.avpbc.pop",
  "productName": "CraftX",
  "copyright": "Copyright © 2026",
  "directories": {
    "output": "release"
  },
  "compression": appCompression,
  "files": appFiles,
  "extraResources": appExtraResources,
  "asar": true,
  "asarUnpack": appAsarUnpack,
  "win": {
    "target": appWinTarget,
    "icon": "icons/icon.ico",
    "artifactName": `\${productName}-\${version}-win-\${arch}-${target}.\${ext}`
  },
  "nsis": {
    "oneClick": false,
    "perMachine": true,
    "allowToChangeInstallationDirectory": true,
    "deleteAppDataOnUninstall": true,
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
