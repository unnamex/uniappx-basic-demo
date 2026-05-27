@echo off
chcp 65001 >nul
echo.
echo   CraftX 开发环境一键初始化
echo   ========================
echo.
echo   [1] pro  - 完整版 (qwen2.5:7b, 需要 8GB+ 内存)
echo   [2] standard - 标准版 (qwen2.5:3b, 需要 4GB+ 内存)
echo   [3] lite - 轻量版 (qwen2.5:1.5b, 需要 2GB+ 内存)
echo.
set /p choice="  请选择模型规格 [1/2/3] (默认1): "

if "%choice%"=="2" (
    set TIER=standard
) else if "%choice%"=="3" (
    set TIER=lite
) else (
    set TIER=pro
)

echo.
echo   已选择: %TIER%，开始初始化...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0setup-vendor.ps1" -Tier %TIER%

echo.
pause
