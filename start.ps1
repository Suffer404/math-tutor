# start.ps1 — put the brief in front of a terminal agent, correctly, for your machine.
#
#   .\start.ps1                      # Claude Code, Phase 0, new folder %USERPROFILE%\Documents\maths-tutor
#   .\start.ps1 -Agent gemini -Phase 1
#   .\start.ps1 -Agent opencode
#   .\start.ps1 -DryRun              # show what it would do, change nothing
#
# Why a script: Claude Code reads CLAUDE.md, Gemini CLI reads GEMINI.md, opencode reads
# AGENTS.md. This copies the two source files and writes the small pointer files, so the
# brief is loaded automatically in every session without pasting 900 words each time.

[CmdletBinding()]
param(
    [ValidateSet('claude', 'gemini', 'opencode', 'qwen', 'none')]
    [string]$Agent = 'claude',

    [int]$Phase = 0,

    [string]$Dest = (Join-Path $HOME 'Documents\maths-tutor'),

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcBrief = Join-Path $here 'AGENTS.md'
$srcPhases = Join-Path $here 'PHASES.md'

if (-not (Test-Path $srcBrief)) { throw "AGENTS.md not found next to this script ($here)." }

$kickoff = @{
    0 = 'Phase 0 only: inspect env, git, tools, disk; write docs/plan.md + LICENCES.md; change nothing else.'
    1 = 'Phase 1 only: Vite+React+TS whiteboard MVP with Excalidraw, pen+mouse, saved board state, prev/next sample questions; tests; stop.'
    2 = 'Phase 2 only: SQLite+migrations, schema validation, import/export, filters, attempts; sample bank works; malformed file rejected.'
    3 = 'Phase 3 only: FastAPI+SymPy service with whitelist parser, diff/simplify/equivalence/solve, honest unverified cases; tests.'
    4 = 'Phase 4 only: Marker docs (separate venv, optional) + markdown-to-bank CLI with grounding and pending status; sample outputs.'
    5 = 'Phase 5 only: one configurable AI provider, grounded question generation, dedupe, cache, quota/timeout handling; no invented citations.'
    6 = 'Phase 6 only: handwriting check flow (capture -> structured JSON -> user fix -> SymPy cross-check -> 3-level hints); test correct/wrong/unclear.'
    7 = 'Phase 7 only: dashboard - weak topics, error log, bookmarks, revision queue, mixed practice, backup/restore.'
    8 = 'Phase 8 only: Tauri packaging, backend lifecycle, data paths, installer; verify packaged app end-to-end.'
}[$Phase]

Write-Host "Project folder : $Dest"
Write-Host "Agent          : $Agent"
Write-Host "Phase          : $Phase"
Write-Host "Kickoff        : $kickoff`n"

if ($DryRun) {
    Write-Host '[dry run] would: copy AGENTS.md + PHASES.md, write CLAUDE.md / GEMINI.md pointers, git init, launch agent.'
    return
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item $srcBrief  (Join-Path $Dest 'AGENTS.md')  -Force
if (Test-Path $srcPhases) { Copy-Item $srcPhases (Join-Path $Dest 'PHASES.md') -Force }

# Claude Code loads CLAUDE.md, not AGENTS.md. The @import keeps one source of truth.
$claudeMd = Join-Path $Dest 'CLAUDE.md'
if (-not (Test-Path $claudeMd)) {
    Set-Content -Path $claudeMd -Encoding utf8 -Value @'
@AGENTS.md

Work one phase at a time from PHASES.md. Respect the Token discipline section.
'@
}

# Gemini CLI loads GEMINI.md.
$geminiMd = Join-Path $Dest 'GEMINI.md'
if (-not (Test-Path $geminiMd)) {
    Set-Content -Path $geminiMd -Encoding utf8 -Value @'
Read AGENTS.md in this folder first and follow it as your standing brief.
Then work only the phase named in the user's first message (lines are in PHASES.md).
Respect the "Token discipline" section.
'@
}

Push-Location $Dest
try {
    if (-not (Test-Path (Join-Path $Dest '.git'))) {
        git init --quiet
        Write-Host 'git repository initialised.'
    }

    switch ($Agent) {
        'none' { Write-Host 'Ready. Launch your agent here and paste the kickoff line.' }
        'claude' { & claude $kickoff }          # interactive; CLAUDE.md is auto-loaded
        'gemini' { & gemini.cmd $kickoff }      # .cmd avoids PowerShell .ps1 shim policy
        'opencode' { & opencode.cmd $kickoff }  # reads AGENTS.md itself
        'qwen' { & qwen.cmd $kickoff }
    }
}
finally {
    Pop-Location
}
