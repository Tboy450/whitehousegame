$ErrorActionPreference = 'Stop'
$url = 'https://whitehouse-rocket-run-tboy450.tboy450.chatgpt.site/'
$iconSource = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\assets\desktop\rocket-run.ico')).Path
$shell = New-Object -ComObject WScript.Shell
$desktop = $shell.SpecialFolders.Item('Desktop')
$localData = [Environment]::GetFolderPath('LocalApplicationData')
if (-not $desktop -or -not (Test-Path -LiteralPath $desktop -PathType Container)) { throw 'The active Windows desktop directory is unavailable.' }
if (-not $localData -or -not (Test-Path -LiteralPath $localData -PathType Container)) { throw 'The local application data directory is unavailable.' }
$iconDirectory = Join-Path $localData 'RocketRun'
# A content-specific name prevents Explorer from reusing an obsolete cached icon.
$iconVersion = (Get-FileHash -LiteralPath $iconSource -Algorithm SHA256).Hash.Substring(0, 12).ToLowerInvariant()
$iconPath = Join-Path $iconDirectory ('rocket-run-' + $iconVersion + '.ico')
$shortcutPath = Join-Path $desktop 'Rocket Run - White House Arcade.url'
if (Test-Path -LiteralPath $shortcutPath) {
    $existingUrl = Get-Content -LiteralPath $shortcutPath -Raw
    if ($existingUrl -notmatch ('(?m)^URL=' + [regex]::Escape($url) + '\r?$')) {
        $shortcutPath = Join-Path $desktop ('Rocket Run - White House Arcade ' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.url')
    }
}
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
Copy-Item -LiteralPath $iconSource -Destination $iconPath -Force
# A native Internet Shortcut opens the default browser directly. A new desktop
# filename avoids the obsolete Explorer-launcher thumbnail cache entry.
$shortcutText = "[InternetShortcut]`r`nURL=$url`r`nIconFile=$iconPath`r`nIconIndex=0`r`n"
[System.IO.File]::WriteAllText($shortcutPath, $shortcutText, [System.Text.Encoding]::Unicode)
$saved = Get-Content -LiteralPath $shortcutPath -Raw
if ($saved -ne $shortcutText) { throw 'The saved website shortcut did not match the intended game link and icon.' }
# Keep the former game launcher recoverable; leave unrelated shortcuts alone.
$oldPath = Join-Path $desktop 'Rocket Run.lnk'
if (Test-Path -LiteralPath $oldPath) {
    $old = $shell.CreateShortcut($oldPath)
    if ($old.Arguments -eq $url -and [System.IO.Path]::GetFileName($old.TargetPath) -eq 'explorer.exe') {
        $backupPath = Join-Path $iconDirectory ('Rocket Run previous launcher ' + [Guid]::NewGuid().ToString('N') + '.lnk')
        Move-Item -LiteralPath $oldPath -Destination $backupPath
        Write-Output "Previous launcher backed up: $backupPath"
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
# Refresh just this shortcut and its desktop folder; keep other apps and caches intact.
[RocketRunShellRefresh]::SHChangeNotify(0x00000002, 0x00001005, $shortcutPath, [IntPtr]::Zero)
[RocketRunShellRefresh]::SHChangeNotify(0x00002000, 0x00001005, $shortcutPath, [IntPtr]::Zero)
[RocketRunShellRefresh]::SHChangeNotify(0x00001000, 0x00001005, $desktop, [IntPtr]::Zero)
# Ask the shell to invalidate cached icon associations as well: changing just
# the file entry can leave a blank desktop thumbnail even when extraction works.
[RocketRunShellRefresh]::SHChangeNotify(0x08000000, 0, $null, [IntPtr]::Zero)
$iconRefresh = Join-Path $env:SystemRoot 'System32\ie4uinit.exe'
if (Test-Path -LiteralPath $iconRefresh -PathType Leaf) { & $iconRefresh -show }
Write-Output "Desktop shortcut: $shortcutPath"
Write-Output "Icon: $iconPath"
Write-Output "Opens: $url"
