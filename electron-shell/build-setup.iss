#define GpuTarget GetEnv('GPU_TARGET')
#if GpuTarget == ""
  #define GpuTarget "all"
#endif

[Setup]
; 程序的唯一标识符
AppId={{5E3F57B3-9D17-4F62-81A5-3C48809F3628}
AppName=CraftX
AppVersion=1.7.0-AIBeta-40
AppPublisher=北京神舟航天软件技术股份有限公司
; 默认安装到 C:\Program Files\Kaiwu 或 D盘
DefaultDirName={autopf}\Kaiwu
DisableProgramGroupPage=yes
; 采用轻量级压缩以加快海量模型打包速度
Compression=lzma2/fast
SolidCompression=yes
; 输出目录为 release 文件夹
OutputDir=release
OutputBaseFilename=CraftX-离线安装版-1.7.0-AIBeta-40-win-x64-{#GpuTarget}
SetupIconFile=icons\icon.ico
UninstallDisplayIcon={app}\CraftX.exe
; 指定生成 64 位安装包
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
; 启用磁盘分卷（突破 Windows 单个 exe 不能超过 4GB 的限制）
DiskSpanning=yes
DiskClusterSize=2000

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务:"

[Files]
; 将 win-unpacked 目录下的所有文件打包进安装程序
Source: "release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\CraftX"; Filename: "{app}\CraftX.exe"
Name: "{autodesktop}\CraftX"; Filename: "{app}\CraftX.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\CraftX.exe"; Description: "运行 CraftX"; Flags: nowait postinstall skipifsilent
