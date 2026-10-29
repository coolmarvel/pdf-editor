#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit|NotebookEdit) 훅: 비밀 값이 든 .env 파일 직접 수정을 막는다.
# 입력은 stdin JSON(.tool_input.file_path). 예전 시드 훅처럼 CLAUDE_TOOL_INPUT 환경변수를 읽으면 항상 통과한다(project-seed 2026-10-27 감사).
# 허용: .env.example(템플릿), .env.local(추적되는 로컬 개발 값). 차단: .env, .env.oauth 등 나머지 .env.*
# 회귀 검사: bash scripts/hooks/test-guards.sh
set -u
file=$(node "$(dirname "$0")/read-input.cjs" file_path notebook_path 2>/dev/null) || exit 0
[ -z "${file:-}" ] && exit 0
base=$(basename "$file")
case "$base" in
  .env.example | .env.local) exit 0 ;;
  .env | .env.*)
    echo "BLOCKED: $base 직접 수정 금지. .env.example 을 고치거나 사용자에게 수동 변경을 요청하세요." >&2
    exit 2
    ;;
esac
exit 0
