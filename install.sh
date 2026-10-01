#!/usr/bin/env bash
# Flow State installer (macOS, Linux, WSL, Git Bash). No runtime required.
#
#   curl -fsSL https://raw.githubusercontent.com/agenticair/flow-state/main/install.sh | bash
#   ./install.sh [--user|--project] [--only claude,codex,cursor,copilot,gemini,universal] [--uninstall]
#                [--source <dir>] [--dest-root <dir>] [--dry-run] [--yes]
#
# What it does: copies skills/ into the skills directories of the tools it finds, and the generated
# agent definitions into each tool's agents directory. Copies, never symlinks. Prints every path.
set -euo pipefail

REPO="agenticair/flow-state"
SCOPE="user"
ONLY=""
UNINSTALL=0
SOURCE=""
DEST_ROOT=""
DRY=0
YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --user) SCOPE="user" ;;
    --project) SCOPE="project" ;;
    --only) ONLY="$2"; shift ;;
    --uninstall) UNINSTALL=1 ;;
    --source) SOURCE="$2"; shift ;;
    --dest-root) DEST_ROOT="$2"; shift ;;
    --dry-run) DRY=1 ;;
    --yes|-y) YES=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

log() { printf '%s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then log "  dry-run: $*"; else "$@"; fi; }

# 1. Locate the source (a checkout, or download main).
TMP=""
if [ -z "$SOURCE" ]; then
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
  if [ -n "$HERE" ] && [ -f "$HERE/plugin.json" ]; then
    SOURCE="$HERE"
  else
    command -v curl >/dev/null || { echo "curl is required to download flow-state" >&2; exit 1; }
    command -v tar >/dev/null || { echo "tar is required to unpack flow-state" >&2; exit 1; }
    TMP="$(mktemp -d)"
    log "Downloading $REPO (main)..."
    curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.tar.gz" | tar -xz -C "$TMP"
    SOURCE="$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -n1)"
  fi
fi
[ -f "$SOURCE/plugin.json" ] || { echo "not a flow-state checkout: $SOURCE" >&2; exit 1; }
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$SOURCE/plugin.json" | head -n1)"

# 2. Decide roots.
if [ -n "$DEST_ROOT" ]; then ROOT="$DEST_ROOT"; elif [ "$SCOPE" = "project" ]; then ROOT="$(pwd)"; else ROOT="$HOME"; fi
if [ "$SCOPE" = "project" ] || [ -n "$DEST_ROOT" ]; then
  d_universal="$ROOT/.agents/skills";  d_claude_s="$ROOT/.claude/skills"; d_claude_a="$ROOT/.claude/agents"
  d_codex_a="$ROOT/.codex/agents";     d_cursor_a="$ROOT/.cursor/agents"; d_copilot_a="$ROOT/.github/agents"; d_gemini_a="$ROOT/.gemini/agents"
  d_claude_h="$ROOT/.claude/hooks/flow-state"; d_codex_h="$ROOT/.codex/hooks/flow-state"; d_cursor_h="$ROOT/.cursor/hooks/flow-state"
  f_codex_hooks="$ROOT/.codex/hooks.json"; f_cursor_hooks="$ROOT/.cursor/hooks.json"
else
  d_universal="$ROOT/.agents/skills";  d_claude_s="$ROOT/.claude/skills"; d_claude_a="$ROOT/.claude/agents"
  d_codex_a="$ROOT/.codex/agents";     d_cursor_a="$ROOT/.cursor/agents"; d_copilot_a="$ROOT/.copilot/agents"; d_gemini_a="$ROOT/.gemini/agents"
  d_claude_h="$ROOT/.claude/hooks/flow-state"; d_codex_h="$ROOT/.codex/hooks/flow-state"; d_cursor_h="$ROOT/.cursor/hooks/flow-state"
  f_codex_hooks="$ROOT/.codex/hooks.json"; f_cursor_hooks="$ROOT/.cursor/hooks.json"
fi

# 3. Detect tools (user scope) or take --only.
tools=""
if [ -n "$ONLY" ]; then
  tools="$(echo "$ONLY" | tr ',' ' ')"
else
  [ -d "$HOME/.claude" ]  && tools="$tools claude"
  [ -d "$HOME/.codex" ]   && tools="$tools codex"
  [ -d "$HOME/.cursor" ]  && tools="$tools cursor"
  [ -d "$HOME/.copilot" ] && tools="$tools copilot"
  [ -d "$HOME/.gemini" ]  && tools="$tools gemini"
  tools="$tools universal"
fi

log "Flow State $VERSION  scope=$SCOPE  root=$ROOT"
log "Tools:$tools"
if [ "$YES" != 1 ] && [ "$DRY" != 1 ] && [ -t 0 ]; then
  printf 'Continue? [y/N] '; read -r ans; [ "$ans" = y ] || [ "$ans" = Y ] || exit 0
fi

copy_skills() { # $1 = dest dir
  run mkdir -p "$1"
  copy_skills_cleanup "$1"
  for s in "$SOURCE"/skills/*/; do
    n="$(basename "$s")"
    run rm -rf "$1/$n"; run cp -R "$s" "$1/$n"; log "  skill  $1/$n"
  done
}
copy_agents() { # $1 = src dir, $2 = dest dir
  [ -d "$1" ] || return 0
  run mkdir -p "$2"
  for f in "$1"/*; do [ -f "$f" ] || continue; run cp "$f" "$2/"; log "  agent  $2/$(basename "$f")"; done
}
copy_hooks() { # $1 = dest dir for scripts
  run mkdir -p "$1"
  for f in "$SOURCE"/hooks/*.mjs; do run cp "$f" "$1/"; done
  log "  hooks  $1"
}
write_hooks_json() { # $1 = adapter file, $2 = target hooks.json, $3 = scripts dir
  if [ -f "$2" ]; then
    log "  note   $2 exists; not touched. Merge the entries from $1 (replace \${FLOW_HOOKS_DIR} with $3)."
  else
    if [ "$DRY" = 1 ]; then log "  dry-run: write $2"; else sed "s|\${FLOW_HOOKS_DIR}|$3|g" "$1" > "$2"; fi
    log "  hooks  $2"
  fi
}
remove_hooks() { # $1 = scripts dir, $2 = hooks.json
  [ -d "$1" ] && { run rm -rf "$1"; log "  removed $1"; }
  [ -f "$2" ] && grep -q "flow-state" "$2" && log "  note   $2 still references flow-state; remove those entries by hand."
  return 0
}
remove_skills() { for s in "$SOURCE"/skills/*/ ; do n="$(basename "$s")"; [ -e "$1/$n" ] && { run rm -rf "$1/$n"; log "  removed $1/$n"; }; done; [ -e "$1/flow-adopt" ] && { run rm -rf "$1/flow-adopt"; log "  removed stale $1/flow-adopt"; }; return 0; }
copy_skills_cleanup() { [ -e "$1/flow-adopt" ] && { run rm -rf "$1/flow-adopt"; log "  removed stale $1/flow-adopt (renamed to flow-setup)"; }; return 0; }
remove_agents() { for f in "$1"/*; do [ -f "$f" ] || continue; t="$2/$(basename "$f")"; [ -e "$t" ] && { run rm -f "$t"; log "  removed $t"; }; done; return 0; }

for t in $tools; do
  case "$t" in
    universal) if [ "$UNINSTALL" = 1 ]; then remove_skills "$d_universal"; else copy_skills "$d_universal"; fi ;;
    claude)    if [ "$UNINSTALL" = 1 ]; then remove_skills "$d_claude_s"; remove_agents "$SOURCE/agents" "$d_claude_a"; remove_hooks "$d_claude_h" ""; else
                 copy_skills "$d_claude_s"; copy_agents "$SOURCE/agents" "$d_claude_a"; copy_hooks "$d_claude_h"
                 if [ "$DRY" != 1 ]; then sed "s|\${CLAUDE_PLUGIN_ROOT}/hooks|$d_claude_h|g" "$SOURCE/hooks/hooks.json" > "$d_claude_h/settings-snippet.json"; fi
                 log "  note   Claude Code: if installed as a plugin, hooks are already active. Otherwise merge $d_claude_h/settings-snippet.json into your settings.json." ; fi ;;
    codex)     if [ "$UNINSTALL" = 1 ]; then remove_agents "$SOURCE/adapters/codex/agents" "$d_codex_a"; remove_hooks "$d_codex_h" "$f_codex_hooks"; else
                 copy_agents "$SOURCE/adapters/codex/agents" "$d_codex_a"; copy_hooks "$d_codex_h"; write_hooks_json "$SOURCE/adapters/codex/hooks.json" "$f_codex_hooks" "$d_codex_h"; fi ;;
    cursor)    if [ "$UNINSTALL" = 1 ]; then remove_agents "$SOURCE/adapters/cursor/agents" "$d_cursor_a"; remove_hooks "$d_cursor_h" "$f_cursor_hooks"; else
                 copy_agents "$SOURCE/adapters/cursor/agents" "$d_cursor_a"; copy_hooks "$d_cursor_h"; write_hooks_json "$SOURCE/adapters/cursor/hooks.json" "$f_cursor_hooks" "$d_cursor_h"; fi ;;
    copilot)   if [ "$UNINSTALL" = 1 ]; then remove_agents "$SOURCE/adapters/copilot/agents" "$d_copilot_a"; else copy_agents "$SOURCE/adapters/copilot/agents" "$d_copilot_a"; fi ;;
    gemini)    if [ "$UNINSTALL" = 1 ]; then remove_agents "$SOURCE/adapters/gemini/agents" "$d_gemini_a"; else copy_agents "$SOURCE/adapters/gemini/agents" "$d_gemini_a"; fi ;;
    *) echo "unknown tool: $t" >&2; exit 2 ;;
  esac
done

[ -n "$TMP" ] && rm -rf "$TMP"

if [ "$UNINSTALL" = 1 ]; then rm -f "$HOME/.flow/install.json"; log "Uninstalled."; exit 0; fi
if [ "$DRY" != 1 ] && [ -z "$DEST_ROOT" ]; then mkdir -p "$HOME/.flow" && printf '{ "source": "%s", "version": "%s", "scope": "%s", "installedAt": "%s" }\n' "$SOURCE" "$VERSION" "$SCOPE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$HOME/.flow/install.json"; fi
if command -v node >/dev/null 2>&1; then
  log "Node $(node --version) found: scoring, verdict checks and the step machine will run."
else
  log "Node not found: skills work, but scores and verdict checks will be labelled UNVERIFIED. Install Node 20+ to enable them."
fi
log "Done. Codex, Cursor, Copilot and Gemini read skills from .agents/skills; Claude Code from .claude/skills."
log "Next: open a project and invoke 'flow'. To remove: re-run with --uninstall."
