#!/usr/bin/env bash
# PreToolUse(Bash) 훅: 일괄 staging(git add -A / --all / .)과 비밀 파일 staging 을 막는다. 파일을 지정해서 add 한다.
# 입력은 stdin JSON(.tool_input.command). 문자열 패턴 검사라 셸을 거친 모든 우회를 막지는 못한다(최소 안전선).
# 회귀 검사: bash scripts/hooks/test-guards.sh
set -u
cmd=$(node "$(dirname "$0")/read-input.cjs" command 2>/dev/null) || exit 0
[ -z "${cmd:-}" ] && exit 0
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+add([[:space:]]|$)' || exit 0
if printf '%s' "$cmd" | grep -qE 'git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+add[[:space:]]+([^;&|]*[[:space:]])?(-A|--all|\.)([[:space:]]|$|[;&|])'; then
  echo "BLOCKED: git add -A / --all / . 대신 파일을 지정해서 stage 하세요(.env·client_secret·빌드 산출물이 섞일 수 있음)." >&2
  exit 2
fi
if printf '%s' "$cmd" | grep -qE '(^|[[:space:]/])(\.env(\.[A-Za-z0-9_-]+)?|client_secret_[^[:space:]]*\.json)([[:space:]]|$|[;&|])' && ! printf '%s' "$cmd" | grep -qE '\.env\.(example|local)([[:space:]]|$|[;&|])'; then
  echo "BLOCKED: .env·client_secret 파일은 git 에 추가하지 않습니다." >&2
  exit 2
fi
exit 0
