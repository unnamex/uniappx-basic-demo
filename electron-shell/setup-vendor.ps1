<#
.SYNOPSIS
    CraftX Electron 开发环境一键初始化脚本
.DESCRIPTION
    自动完成以下步骤：
    1. 下载 Ollama 引擎到 vendor/ollama/
    2. 使用 Ollama 拉取 AI 大模型（qwen2.5 + nomic-embed-text）
    3. 下载 BGE 嵌入模型到 vendor/embed-models/
    4. 安装 electron-shell 的 npm 依赖
    5. 安装根项目的 npm 依赖
.PARAMETER Tier
    模型规格：lite(1.5b), standard(3b), pro(7b)。默认 pro。
.EXAMPLE
    .\setup-vendor.ps1
    .\setup-vendor.ps1 -Tier lite
#>

param(
    [ValidateSet("lite", "standard", "pro")]
    [string]$Tier = "pro"
)

$ErrorActionPreference = "Stop"

# ---- 配置 ----
$OLLAMA_VERSION = "0.5.7"
$OLLAMA_DOWNLOAD_URL = "https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-windows-amd64.zip"

# 模型规格映射
$MODEL_MAP = @{
    "lite"     = "qwen2.5:1.5b"
    "standard" = "qwen2.5:3b"
    "pro"      = "qwen2.5:7b"
}
$QWEN_MODEL = $MODEL_MAP[$Tier]
$EMBED_MODEL = "nomic-embed-text:latest"

# 路径
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$VENDOR_DIR = Join-Path $SCRIPT_DIR "vendor"
$OLLAMA_DIR = Join-Path $VENDOR_DIR "ollama"
$MODELS_DIR = Join-Path $VENDOR_DIR "models"
$EMBED_MODELS_DIR = Join-Path $VENDOR_DIR "embed-models"
$ROOT_DIR = Split-Path -Parent $SCRIPT_DIR

# ---- 工具函数 ----
function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
}

function Write-OK {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Skip {
    param([string]$Message)
    Write-Host "  [跳过] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  [失败] $Message" -ForegroundColor Red
}

# ---- 开始 ----
Write-Host ""
Write-Host "  CraftX 开发环境初始化" -ForegroundColor Magenta
Write-Host "  模型规格: $Tier ($QWEN_MODEL)" -ForegroundColor Magenta
Write-Host ""

# ========== 步骤 1: 下载 Ollama 引擎 ==========
Write-Step "步骤 1/5: 检查 Ollama 引擎"

$ollamaExe = Join-Path $OLLAMA_DIR "ollama.exe"

if (Test-Path $ollamaExe) {
    $currentVersion = & $ollamaExe --version 2>&1 | Select-String "(\d+\.\d+\.\d+)" | ForEach-Object { $_.Matches[0].Value }
    if ($currentVersion -eq $OLLAMA_VERSION) {
        Write-Skip "Ollama v${OLLAMA_VERSION} 已存在"
    } else {
        Write-Host "  当前版本: $currentVersion, 需要: $OLLAMA_VERSION, 将重新下载..." -ForegroundColor Yellow
        Remove-Item -Path $OLLAMA_DIR -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path $ollamaExe)) {
    Write-Host "  正在下载 Ollama v${OLLAMA_VERSION} ..." -ForegroundColor White

    $tempZip = Join-Path $env:TEMP "ollama-windows-amd64.zip"
    $tempExtract = Join-Path $env:TEMP "ollama-extract"

    try {
        # 下载
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $OLLAMA_DOWNLOAD_URL -OutFile $tempZip -UseBasicParsing
        Write-Host "  下载完成，正在解压..." -ForegroundColor White

        # 解压
        if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
        Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

        # 移动到 vendor/ollama
        New-Item -Path $OLLAMA_DIR -ItemType Directory -Force | Out-Null

        # Ollama zip 解压后可能在子目录中
        $extractedItems = Get-ChildItem $tempExtract
        if ($extractedItems.Count -eq 1 -and $extractedItems[0].PSIsContainer) {
            # 如果解压出来是单个文件夹，取其内容
            Copy-Item -Path (Join-Path $extractedItems[0].FullName "*") -Destination $OLLAMA_DIR -Recurse -Force
        } else {
            Copy-Item -Path (Join-Path $tempExtract "*") -Destination $OLLAMA_DIR -Recurse -Force
        }

        # 清理临时文件
        Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
        Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue

        if (Test-Path $ollamaExe) {
            Write-OK "Ollama v${OLLAMA_VERSION} 下载并安装成功"
        } else {
            Write-Fail "Ollama 解压后未找到 ollama.exe，请手动下载"
            Write-Host "  下载地址: https://ollama.com/download/windows" -ForegroundColor Gray
        }
    } catch {
        Write-Fail "下载 Ollama 失败: $($_.Exception.Message)"
        Write-Host "  请手动下载 Ollama 并将文件解压到: $OLLAMA_DIR" -ForegroundColor Gray
        Write-Host "  下载地址: $OLLAMA_DOWNLOAD_URL" -ForegroundColor Gray
    }
}

# ========== 步骤 2: 拉取 AI 大模型 ==========
Write-Step "步骤 2/5: 拉取 AI 大模型"

if (-not (Test-Path $ollamaExe)) {
    Write-Fail "Ollama 引擎不存在，跳过模型下载"
} else {
    # 启动临时 Ollama 服务（使用自定义端口和模型目录）
    $env:OLLAMA_HOST = "127.0.0.1:11435"
    $env:OLLAMA_MODELS = $MODELS_DIR

    Write-Host "  启动临时 Ollama 服务 (端口 11435)..." -ForegroundColor White
    New-Item -Path $MODELS_DIR -ItemType Directory -Force | Out-Null

    $ollamaProcess = Start-Process -FilePath $ollamaExe -ArgumentList "serve" `
        -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $env:TEMP "ollama-serve.log") `
        -RedirectStandardError (Join-Path $env:TEMP "ollama-serve-err.log")

    # 等待服务就绪
    $maxWait = 30
    $ready = $false
    for ($i = 0; $i -lt $maxWait; $i++) {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:11435/" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {}
    }

    if (-not $ready) {
        Write-Fail "Ollama 服务启动超时，请手动启动后再运行此脚本"
    } else {
        Write-OK "Ollama 服务已就绪"

        # 拉取 qwen2.5 模型
        Write-Host "  正在拉取 $QWEN_MODEL （可能需要较长时间）..." -ForegroundColor White
        try {
            & $ollamaExe pull $QWEN_MODEL
            Write-OK "$QWEN_MODEL 拉取完成"
        } catch {
            Write-Fail "拉取 $QWEN_MODEL 失败: $($_.Exception.Message)"
        }

        # 拉取 nomic-embed-text 模型
        Write-Host "  正在拉取 $EMBED_MODEL ..." -ForegroundColor White
        try {
            & $ollamaExe pull $EMBED_MODEL
            Write-OK "$EMBED_MODEL 拉取完成"
        } catch {
            Write-Fail "拉取 $EMBED_MODEL 失败: $($_.Exception.Message)"
        }
    }

    # 关闭临时 Ollama 服务
    Write-Host "  关闭临时 Ollama 服务..." -ForegroundColor White
    try {
        if ($ollamaProcess -and -not $ollamaProcess.HasExited) {
            Stop-Process -Id $ollamaProcess.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}
    Write-OK "Ollama 服务已关闭"
}

# ========== 步骤 3: 下载 BGE 嵌入模型 ==========
Write-Step "步骤 3/5: 下载 BGE 嵌入模型"

$bgeModelDir = Join-Path $EMBED_MODELS_DIR "Xenova"
if (Test-Path $bgeModelDir) {
    $modelFiles = Get-ChildItem -Path $bgeModelDir -Recurse -File
    if ($modelFiles.Count -gt 0) {
        Write-Skip "BGE 嵌入模型已存在 ($($modelFiles.Count) 个文件)"
    } else {
        Remove-Item $bgeModelDir -Recurse -Force
    }
}

if (-not (Test-Path $bgeModelDir) -or (Get-ChildItem -Path $bgeModelDir -Recurse -File).Count -eq 0) {
    Write-Host "  正在通过 Node.js 下载 bge-small-zh-v1.5 模型 (约45MB)..." -ForegroundColor White

    # 确保 electron-shell 的依赖已安装
    $electronNodeModules = Join-Path $SCRIPT_DIR "node_modules"
    if (-not (Test-Path $electronNodeModules)) {
        Write-Host "  先安装 electron-shell 依赖..." -ForegroundColor White
        Push-Location $SCRIPT_DIR
        npm install 2>&1 | Out-Null
        Pop-Location
    }

    try {
        Push-Location $SCRIPT_DIR
        node download-embed-model.js
        Pop-Location
        if (Test-Path $bgeModelDir) {
            Write-OK "BGE 嵌入模型下载完成"
        } else {
            Write-Fail "BGE 嵌入模型下载后未找到文件"
        }
    } catch {
        Pop-Location
        Write-Fail "BGE 嵌入模型下载失败: $($_.Exception.Message)"
    }
}

# ========== 步骤 4: 安装 electron-shell 依赖 ==========
Write-Step "步骤 4/5: 安装 electron-shell npm 依赖"

$electronNodeModules = Join-Path $SCRIPT_DIR "node_modules"
if (Test-Path $electronNodeModules) {
    $pkgCount = (Get-ChildItem $electronNodeModules -Directory).Count
    Write-Skip "node_modules 已存在 ($pkgCount 个包)"
} else {
    Write-Host "  正在执行 npm install ..." -ForegroundColor White
    Push-Location $SCRIPT_DIR
    npm install
    Pop-Location
    Write-OK "electron-shell 依赖安装完成"
}

# ========== 步骤 5: 安装根项目依赖 ==========
Write-Step "步骤 5/5: 安装根项目 npm 依赖"

$rootNodeModules = Join-Path $ROOT_DIR "node_modules"
if (Test-Path $rootNodeModules) {
    $pkgCount = (Get-ChildItem $rootNodeModules -Directory).Count
    Write-Skip "node_modules 已存在 ($pkgCount 个包)"
} else {
    Write-Host "  正在执行 npm install ..." -ForegroundColor White
    Push-Location $ROOT_DIR
    npm install
    Pop-Location
    Write-OK "根项目依赖安装完成"
}

# ========== 完成 ==========
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  初始化完成！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  模型规格:  $Tier ($QWEN_MODEL)" -ForegroundColor White
Write-Host ""
Write-Host "  下一步操作:" -ForegroundColor White
Write-Host "    1. 在 HBuilderX 中编译 H5 产物" -ForegroundColor Gray
Write-Host "    2. 运行 npm run copy:dist 拷贝编译产物" -ForegroundColor Gray
Write-Host "    3. 运行 npm start 启动 Electron 应用" -ForegroundColor Gray
Write-Host ""
