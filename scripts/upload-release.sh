#!/usr/bin/env bash
# GitHub Release 생성 + 인스톨러 업로드 (v1.4.3)
# 사용법: bash scripts/upload-release.sh <classic token>
#   (또는 GH_TOKEN 환경변수)
set -euo pipefail

GH_TOKEN="${1:-${GH_TOKEN:-}}"

REPO="coolmarvel/pdf-editor"
TAG="v1.4.3"
EXE="/home/jace/pdf-editor/release/PDF편집기-Setup-1.4.3.exe"
ASSET_NAME="PDF-Editor-Setup-1.4.3.exe"

[ -z "${GH_TOKEN:-}" ] && { echo "GH_TOKEN 환경변수가 필요합니다"; exit 1; }
[ -f "$EXE" ] || { echo "인스톨러가 없습니다: $EXE"; exit 1; }

echo "1) 릴리스 생성 ($TAG)..."
UPLOAD_URL=$(curl -sf -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases" \
  -d "{
    \"tag_name\": \"$TAG\",
    \"name\": \"PDF 편집기 $TAG\",
    \"body\": \"오프라인 데스크톱 PDF 편집기 Windows 인스톨러.\\n\\n- 페이지 관리 / 텍스트 추가·수정 / 그리기·형광펜 / 도형·스탬프 / 서명·주석·링크\\n- 문서가 로컬 밖으로 나가지 않는 오프라인 처리\\n- Electron 33 + React 18 + pdf.js + pdf-lib\",
    \"draft\": false,
    \"prerelease\": false
  }" | python3 -c "import json,sys; print(json.load(sys.stdin)['upload_url'].split('{')[0])")

echo "2) 인스톨러 업로드 (103MB, 수 분 소요)..."
curl -sf -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$EXE" \
  "$UPLOAD_URL?name=$ASSET_NAME" | python3 -c "import json,sys; d=json.load(sys.stdin); print('업로드 완료:', d['browser_download_url'])"
