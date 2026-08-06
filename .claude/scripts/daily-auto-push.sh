#!/usr/bin/env bash
# Daily job (intended for cron at 17:20 Asia/Bangkok / 10:20 UTC):
# git status -> if changes: add, commit with a generated message, push.
# If no changes: log "No changes to push." If push fails: log diagnosis.
set -uo pipefail

REPO_DIR="/home/mt/Documents/Autotest app Parrot"
LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/daily-auto-push.log"
mkdir -p "$LOG_DIR"

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') ==="

  cd "$REPO_DIR" || { echo "Repo directory not found: $REPO_DIR"; exit 1; }

  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Not a git repository: $REPO_DIR"
    exit 1
  fi

  status=$(git status --porcelain)
  if [ -z "$status" ]; then
    echo "No changes to push."
    exit 0
  fi

  git add .

  branch=$(git rev-parse --abbrev-ref HEAD)
  file_count=$(git diff --cached --name-only | wc -l | tr -d ' ')
  file_list=$(git diff --cached --name-only | head -5 | paste -sd ', ' -)
  if [ "$file_count" -gt 5 ]; then
    file_list="$file_list, and $((file_count - 5)) more"
  fi
  commit_msg="Auto-update: $file_count file(s) changed ($file_list)"

  if ! git commit -m "$commit_msg"; then
    echo "git commit failed. Nothing pushed."
    exit 1
  fi
  echo "Committed: $commit_msg"

  if git push origin "$branch" 2>/tmp/daily-auto-push-err.log; then
    echo "Pushed to origin/$branch."
  else
    err=$(cat /tmp/daily-auto-push-err.log)
    echo "PUSH FAILED for branch $branch."
    echo "--- git push error output ---"
    echo "$err"
    echo "--- diagnosis ---"
    if echo "$err" | grep -qi "non-fast-forward\|fetch first\|rejected"; then
      echo "Remote has commits your local branch doesn't. Run: git pull --rebase origin $branch, resolve conflicts if any, then push again."
    elif echo "$err" | grep -qi "authentication\|permission denied\|could not read"; then
      echo "Authentication/credential issue. Check your git credentials (SSH key or token) for this remote."
    elif echo "$err" | grep -qi "protected branch\|hook declined"; then
      echo "Push blocked by branch protection or a server-side hook. Manual review/PR may be required."
    else
      echo "Unrecognized error. Inspect manually: cd \"$REPO_DIR\" && git push origin $branch"
    fi
  fi
} >> "$LOG_FILE" 2>&1
