#!/usr/bin/env bash
# SessionStart hook: fetch origin, fast-forward pull if behind, stop on divergence/conflict.
set -uo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo '{}'; exit 0; }
cd "$repo_root" || { echo '{}'; exit 0; }

if ! git fetch origin --quiet 2>/tmp/session-start-sync-fetch.log; then
  err=$(tr '\n' ' ' < /tmp/session-start-sync-fetch.log)
  printf '{"systemMessage": "git fetch origin failed: %s"}' "$(echo "$err" | sed 's/"/\\"/g')"
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD)
upstream="origin/$branch"

if ! git rev-parse "$upstream" >/dev/null 2>&1; then
  echo '{}'
  exit 0
fi

behind=$(git rev-list --count HEAD.."$upstream")
ahead=$(git rev-list --count "$upstream"..HEAD)

if [ "$behind" -eq 0 ]; then
  echo '{}'
  exit 0
fi

if [ "$ahead" -gt 0 ]; then
  printf '{"continue": false, "stopReason": "Branch %s da diverge tu %s (ahead %s, behind %s). Hay tu resolve (merge/rebase) truoc khi tiep tuc.", "systemMessage": "Diverged tu remote - can xu ly thu cong."}' "$branch" "$upstream" "$ahead" "$behind"
  exit 0
fi

if git pull --ff-only origin "$branch" >/tmp/session-start-sync-pull.log 2>&1; then
  printf '{"systemMessage": "Da pull %s commit(s) tu %s truoc khi bat dau."}' "$behind" "$upstream"
else
  out=$(tr '\n' ' ' < /tmp/session-start-sync-pull.log | sed 's/"/\\"/g')
  printf '{"continue": false, "stopReason": "git pull --ff-only tu %s thi bai (co the co conflict). Chi tiet: %s", "systemMessage": "Pull thi bai - can xu ly thu cong."}' "$upstream" "$out"
fi
