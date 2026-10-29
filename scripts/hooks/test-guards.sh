#!/usr/bin/env bash
# env-guard / git-add-guard 회귀 검사: 공식 stdin JSON 입력으로 차단(2)·허용(0)을 확인한다. 실제 파일·git index 는 건드리지 않는다.
set -u
cd "$(dirname "$0")" || exit 1
unset CLAUDE_TOOL_INPUT
fail=0
check() { # 훅 기대코드 JSON
  local got
  printf '%s' "$3" | bash "$1" >/dev/null 2>&1
  got=$?
  if [ "$got" != "$2" ]; then echo "FAIL $1 기대 $2 실제 $got: $3"; fail=1; else echo "ok   $1 $2: $3"; fi
}
w() { printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$1"; }
b() { printf '{"tool_name":"Bash","tool_input":{"command":"%s"}}' "$1"; }
check env-guard.sh 2 "$(w /repo/.env)"
check env-guard.sh 2 "$(w /repo/.env.production)"
check env-guard.sh 0 "$(w /repo/.env.example)"
check env-guard.sh 0 "$(w /repo/.env.local)"
check env-guard.sh 0 "$(w /repo/docs/env.md)"
check env-guard.sh 0 '{}'
check git-add-guard.sh 2 "$(b 'git add -A')"
check git-add-guard.sh 2 "$(b 'git add --all')"
check git-add-guard.sh 2 "$(b 'git add .')"
check git-add-guard.sh 2 "$(b 'git add . && git commit -m x')"
check git-add-guard.sh 2 "$(b 'git -C /repo add -A')"
check git-add-guard.sh 2 "$(b 'git add .env')"
check git-add-guard.sh 2 "$(b 'git add client_secret_123.json')"
check git-add-guard.sh 0 "$(b 'git add docs/todo.md CLAUDE.md')"
check git-add-guard.sh 0 "$(b 'git add .env.example')"
check git-add-guard.sh 0 "$(b 'git add ./src/core/pages.ts')"
check git-add-guard.sh 0 "$(b 'git status && git diff')"
check git-add-guard.sh 0 "$(b 'npm run build')"
exit $fail
