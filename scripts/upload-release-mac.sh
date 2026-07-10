#!/usr/bin/env bash
# GitHub Release 생성 + macOS DMG 업로드 (v1.4.7)
# 사용법: bash scripts/upload-release-mac.sh <classic token> [dmg 경로]
#   (또는 GH_TOKEN 환경변수. dmg 경로 기본값은 ~/Desktop/PDF편집기-1.4.7-arm64.dmg)
# 맥에서 실행해도 되고(curl·python3 기본 탑재), dmg를 WSL로 복사해 여기서 실행해도 된다.
set -euo pipefail

GH_TOKEN="${1:-${GH_TOKEN:-}}"

REPO="coolmarvel/pdf-editor"
TAG="v1.4.7"
DMG="${2:-$HOME/Desktop/PDF편집기-1.4.7-arm64.dmg}"
ASSET_NAME="PDF-Editor-1.4.7-arm64.dmg"

[ -z "${GH_TOKEN:-}" ] && { echo "GH_TOKEN 환경변수가 필요합니다"; exit 1; }
[ -f "$DMG" ] || { echo "DMG가 없습니다: $DMG"; exit 1; }

echo "1) 릴리스 생성 ($TAG)..."
UPLOAD_URL=$(curl -sf -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases" \
  -d "{
    \"tag_name\": \"$TAG\",
    \"name\": \"PDF 편집기 $TAG (macOS)\",
    \"body\": \"오프라인 데스크톱 PDF 편집기 macOS(Apple Silicon) DMG.\\n\\n- 페이지 관리 / 텍스트 추가·수정 / 그리기·형광펜 / 도형·스탬프 / 서명·주석·링크\\n- 문서가 로컬 밖으로 나가지 않는 오프라인 처리\\n- ad-hoc 서명 빌드 — 첫 실행 시 우클릭 → 열기 필요할 수 있음\\n- Windows 인스톨러는 v1.4.3 릴리스 참고\",
    \"draft\": false,
    \"prerelease\": false
  }" | python3 -c "import json,sys; print(json.load(sys.stdin)['upload_url'].split('{')[0])")

echo "2) DMG 업로드 (수 분 소요될 수 있음)..."
curl -sf -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$DMG" \
  "$UPLOAD_URL?name=$ASSET_NAME" | python3 -c "import json,sys; d=json.load(sys.stdin); print('업로드 완료:', d['browser_download_url'])"
