$ErrorActionPreference = 'Stop'
$url = 'https://whitehouse-rocket-run-tboy450.tboy450.chatgpt.site/'
$product = 'Rocket Run White House Arcade Launcher'
$iconSource = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\assets\desktop\rocket-run.ico')).Path
$launcherSource = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'desktop-launcher.cs')).Path
$shell = New-Object -ComObject WScript.Shell
$desktop = $shell.SpecialFolders.Item('Desktop')
$localData = [Environment]::GetFolderPath('LocalApplicationData')
if (-not $desktop -or -not (Test-Path -LiteralPath $desktop -PathType Container)) { throw 'The active Windows desktop directory is unavailable.' }
if (-not $localData -or -not (Test-Path -LiteralPath $localData -PathType Container)) { throw 'The local application data directory is unavailable.' }

# The icon lives inside the application. No .lnk/.url icon handler, separate
# IconFile path, synced icon file, or downloaded runtime is needed to display it.
$compiler = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler -PathType Leaf)) {
    $compiler = Join-Path $env:SystemRoot 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $compiler -PathType Leaf)) { throw 'The Windows .NET Framework compiler is unavailable. Existing desktop entries were left in place.' }
$temporaryExe = Join-Path ([System.IO.Path]::GetTempPath()) ('RocketRun-' + [Guid]::NewGuid().ToString('N') + '.exe')
$launcherPath = Join-Path $desktop 'Rocket Run - White House Arcade.exe'
if (Test-Path -LiteralPath $launcherPath) {
    if ([Diagnostics.FileVersionInfo]::GetVersionInfo($launcherPath).ProductName -ne $product) {
        $launcherPath = Join-Path $desktop ('Rocket Run - White House Arcade ' + [Guid]::NewGuid().ToString('N').Substring(0,8) + '.exe')
    }
}
try {
    & $compiler /nologo /target:winexe /platform:anycpu /optimize+ "/out:$temporaryExe" "/win32icon:$iconSource" /reference:System.Windows.Forms.dll $launcherSource
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temporaryExe -PathType Leaf)) { throw 'Could not build the desktop launcher. Existing desktop entries were left in place.' }
    # Verify the icon resource before touching any existing desktop entry.
    Add-Type -AssemblyName System.Drawing
    $embeddedIcon = [Drawing.Icon]::ExtractAssociatedIcon($temporaryExe)
    if (-not $embeddedIcon) { throw 'The launcher has no readable embedded icon.' }
    $embeddedIcon.Dispose()
    Copy-Item -LiteralPath $temporaryExe -Destination $launcherPath -Force
    if ((Get-FileHash -LiteralPath $launcherPath).Hash -ne (Get-FileHash -LiteralPath $temporaryExe).Hash) { throw 'The installed launcher did not match the verified build.' }
} finally {
    if (Test-Path -LiteralPath $temporaryExe -PathType Leaf) { Remove-Item -LiteralPath $temporaryExe -Force }
}

# Preserve the old entries as recoverable backups, only if they target this game.
$backupDirectory = Join-Path $localData 'RocketRun'
foreach ($name in @('Rocket Run.lnk', 'Rocket Run - White House Arcade.url')) {
    $oldPath = Join-Path $desktop $name
    if (-not (Test-Path -LiteralPath $oldPath -PathType Leaf)) { continue }
    $matchesGame = $false
    if ($name.EndsWith('.lnk')) {
        $old = $shell.CreateShortcut($oldPath)
        $matchesGame = $old.Arguments -eq $url -and [System.IO.Path]::GetFileName($old.TargetPath) -eq 'explorer.exe'
    } else {
        $matchesGame = (Get-Content -LiteralPath $oldPath -Raw) -match ('(?m)^URL=' + [regex]::Escape($url) + '\r?$')
    }
    if ($matchesGame) {
        [System.IO.Directory]::CreateDirectory($backupDirectory) | Out-Null
        $backupPath = Join-Path $backupDirectory ([Guid]::NewGuid().ToString('N') + '-' + $name)
        Move-Item -LiteralPath $oldPath -Destination $backupPath
        Write-Output "Previous entry backed up: $backupPath"
    }
}
if (-not ('RocketRunShellRefresh' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RocketRunShellRefresh {
    [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
    public static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);
}
'@
}
[RocketRunShellRefresh]::SHChangeNotify(0x00000002, 0x00001005, $launcherPath, [IntPtr]::Zero)
[RocketRunShellRefresh]::SHChangeNotify(0x00002000, 0x00001005, $launcherPath, [IntPtr]::Zero)
[RocketRunShellRefresh]::SHChangeNotify(0x00001000, 0x00001005, $desktop, [IntPtr]::Zero)
Write-Output "Desktop launcher: $launcherPath"
Write-Output 'Icon: embedded White House rocket badge'
Write-Output "Opens: $url"
