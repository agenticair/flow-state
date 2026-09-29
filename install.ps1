<#
.SYNOPSIS
  Flow State installer for Windows PowerShell 5.1+ / PowerShell 7. No runtime required.
.EXAMPLE
  irm https://raw.githubusercontent.com/agenticair/flow-state/main/install.ps1 | iex
  .\install.ps1 -Project -Only claude,codex -Yes
  .\install.ps1 -Uninstall
.DESCRIPTION
  Copies skills/ into the skills directories of the tools it finds and the generated agent definitions
  into each tool's agents directory. Copies, never symlinks. Prints every path.
#>
[CmdletBinding()]
param(
  [switch]$Project,
  [string[]]$Only = @(),
  [switch]$Uninstall,
  [string]$Source = "",
  [string]$DestRoot = "",
  [switch]$DryRun,
  [switch]$Yes
)
$ErrorActionPreference = "Stop"
$Repo = "agenticair/flow-state"

function Log($m) { Write-Host $m }
function Run([scriptblock]$b, [string]$what) { if ($DryRun) { Log "  dry-run: $what" } else { & $b } }

# 1. Locate the source.
$Tmp = $null
if (-not $Source) {
  $here = if ($PSScriptRoot) { $PSScriptRoot } else { "" }
  if ($here -and (Test-Path (Join-Path $here "plugin.json"))) {
    $Source = $here
  } else {
    $Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("flow-state-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $Tmp | Out-Null
    $zip = Join-Path $Tmp "main.zip"
    Log "Downloading $Repo (main)..."
    Invoke-WebRequest -Uri "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $Tmp
    $Source = (Get-ChildItem -Path $Tmp -Directory | Select-Object -First 1).FullName
  }
}
if (-not (Test-Path (Join-Path $Source "plugin.json"))) { throw "not a flow-state checkout: $Source" }
$Version = (Get-Content (Join-Path $Source "plugin.json") -Raw | ConvertFrom-Json).version

# 2. Roots.
$Home_ = [Environment]::GetFolderPath("UserProfile")
if ($DestRoot) { $Root = $DestRoot } elseif ($Project) { $Root = (Get-Location).Path } else { $Root = $Home_ }
$projectLike = $Project -or $DestRoot
$D = @{
  universal = Join-Path $Root ".agents\skills"
  claude_s  = Join-Path $Root ".claude\skills"
  claude_a  = Join-Path $Root ".claude\agents"
  codex_a   = Join-Path $Root ".codex\agents"
  cursor_a  = Join-Path $Root ".cursor\agents"
  copilot_a = if ($projectLike) { Join-Path $Root ".github\agents" } else { Join-Path $Root ".copilot\agents" }
  gemini_a  = Join-Path $Root ".gemini\agents"
}

# 3. Tools.
if ($Only.Count -gt 0) { $Tools = $Only | ForEach-Object { $_.Split(",") } | ForEach-Object { $_.Trim() } | Where-Object { $_ } }
else {
  $Tools = @()
  foreach ($t in "claude", "codex", "cursor", "copilot", "gemini") { if (Test-Path (Join-Path $Home_ ".$t")) { $Tools += $t } }
  $Tools += "universal"
}
$Scope = if ($Project) { "project" } else { "user" }
Log "Flow State $Version  scope=$Scope  root=$Root"
Log ("Tools: " + ($Tools -join " "))
if (-not $Yes -and -not $DryRun -and -not $Source.StartsWith([System.IO.Path]::GetTempPath())) {
  $ans = Read-Host "Continue? [y/N]"
  if ($ans -notin @("y", "Y")) { exit 0 }
}

function Copy-Skills($dest) {
  Run { New-Item -ItemType Directory -Force -Path $dest | Out-Null } "mkdir $dest"
  Get-ChildItem -Path (Join-Path $Source "skills") -Directory | ForEach-Object {
    $target = Join-Path $dest $_.Name
    Run { if (Test-Path $target) { Remove-Item -Recurse -Force $target }; Copy-Item -Recurse -Path $_.FullName -Destination $target } "copy $target"
    Log "  skill  $target"
  }
}
function Copy-Agents($src, $dest) {
  if (-not (Test-Path $src)) { return }
  Run { New-Item -ItemType Directory -Force -Path $dest | Out-Null } "mkdir $dest"
  Get-ChildItem -Path $src -File | ForEach-Object {
    Run { Copy-Item -Path $_.FullName -Destination $dest -Force } "copy $($_.Name)"
    Log "  agent  $(Join-Path $dest $_.Name)"
  }
}
function Remove-Skills($dest) {
  Get-ChildItem -Path (Join-Path $Source "skills") -Directory | ForEach-Object {
    $t = Join-Path $dest $_.Name
    if (Test-Path $t) { Run { Remove-Item -Recurse -Force $t } "rm $t"; Log "  removed $t" }
  }
}
function Remove-Agents($src, $dest) {
  if (-not (Test-Path $src)) { return }
  Get-ChildItem -Path $src -File | ForEach-Object {
    $t = Join-Path $dest $_.Name
    if (Test-Path $t) { Run { Remove-Item -Force $t } "rm $t"; Log "  removed $t" }
  }
}

foreach ($t in $Tools) {
  switch ($t) {
    "universal" { if ($Uninstall) { Remove-Skills $D.universal } else { Copy-Skills $D.universal } }
    "claude"    { if ($Uninstall) { Remove-Skills $D.claude_s; Remove-Agents (Join-Path $Source "agents") $D.claude_a } else { Copy-Skills $D.claude_s; Copy-Agents (Join-Path $Source "agents") $D.claude_a } }
    "codex"     { $s = Join-Path $Source "adapters\codex\agents";   if ($Uninstall) { Remove-Agents $s $D.codex_a }   else { Copy-Agents $s $D.codex_a } }
    "cursor"    { $s = Join-Path $Source "adapters\cursor\agents";  if ($Uninstall) { Remove-Agents $s $D.cursor_a }  else { Copy-Agents $s $D.cursor_a } }
    "copilot"   { $s = Join-Path $Source "adapters\copilot\agents"; if ($Uninstall) { Remove-Agents $s $D.copilot_a } else { Copy-Agents $s $D.copilot_a } }
    "gemini"    { $s = Join-Path $Source "adapters\gemini\agents";  if ($Uninstall) { Remove-Agents $s $D.gemini_a }  else { Copy-Agents $s $D.gemini_a } }
    default     { throw "unknown tool: $t" }
  }
}

if ($Tmp) { Remove-Item -Recurse -Force $Tmp }
if ($Uninstall) { Log "Uninstalled."; exit 0 }
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) { Log "Node $(& node --version) found: scoring, verdict checks and the step machine will run." }
else { Log "Node not found: skills work, but scores and verdict checks will be labelled UNVERIFIED. Install Node 20+ to enable them." }
Log "Done. Codex, Cursor, Copilot and Gemini read skills from .agents\skills; Claude Code from .claude\skills."
Log "Next: open a project and invoke 'flow'. To remove: re-run with -Uninstall."
