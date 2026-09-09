$ErrorActionPreference = 'Stop'
$url = 'https://whitehouse-rocket-run-tboy450.tboy450.chatgpt.site/'
$iconSource = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\assets\desktop\rocket-run.ico')).Path
$shell = New-Object -ComObject WScript.Shell
$desktop = $shell.SpecialFolders.Item('Desktop')
$localData = [Environment]::GetFolderPath('LocalApplicationData')
if (-not $desktop -or -not (Test-Path -LiteralPath $desktop -PathType Container)) { throw 'The active Windows desktop directory is unavailable.' }
if (-not $localData -or -not (Test-Path -LiteralPath $localData -PathType Container)) { throw 'The local application data directory is unavailable.' }
$iconDirectory = Join-Path $localData 'RocketRun'
$iconPath = Join-Path $iconDirectory 'rocket-run.ico'
$shortcutPath = Join-Path $desktop 'Rocket Run.lnk'
if (Test-Path -LiteralPath $shortcutPath) {
    $existing = $shell.CreateShortcut($shortcutPath)
    if ($existing.Arguments -ne $url) {
        $shortcutPath = Join-Path $desktop ('Rocket Run - White House Arcade ' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.lnk')
    }
}
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
Copy-Item -LiteralPath $iconSource -Destination $iconPath -Force
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'explorer.exe'
$shortcut.Arguments = $url
$shortcut.IconLocation = $iconPath + ',0'
$shortcut.Description = 'Rocket Run - White House arcade. Play the public game.'
$shortcut.WorkingDirectory = $iconDirectory
$shortcut.Save()
$saved = $shell.CreateShortcut($shortcutPath)
if ($saved.Arguments -ne $url -or $saved.IconLocation -ne ($iconPath + ',0')) { throw 'The saved shortcut did not match the intended game link and icon.' }
if (-not (Test-Path -LiteralPath $saved.TargetPath -PathType Leaf)) { throw 'The browser launcher is unavailable.' }
Write-Output "Desktop shortcut: $shortcutPath"
Write-Output "Icon: $iconPath"
Write-Output "Opens: $($saved.Arguments)"
