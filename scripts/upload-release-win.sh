#!/usr/bin/env bash
# GitHub Release 에 Windows 인스톨러 업로드 (버전 파라미터화)
# 사용법: bash scripts/upload-release-win.sh <classic token> [버전]
#   (또는 GH_TOKEN 환경변수. 버전 기본값 = package.json)
# 같은 태그의 릴리스가 이미 있으면(예: macOS DMG 가 먼저 올라간 경우) 그 릴리스에 자산만 추가한다.
set -euo pipefail

GH_TOKEN="${1:-${GH_TOKEN:-}}"
VERSION="${2:-$(node -p "require('$(cd "$(dirname "$0")/.." && pwd)/package.json').version")}"

REPO="coolmarvel/pdf-editor"
TAG="v$VERSION"
EXE="$(cd "$(dirname "$0")/.." && pwd)/release/PDF편집기-Setup-$VERSION.exe"
ASSET_NAME="PDF-Editor-Setup-$VERSION.exe"
API="https://api.github.com/repos/$REPO"

[ -z "${GH_TOKEN:-}" ] && { echo "GH_TOKEN 환경변수가 필요합니다"; exit 1; }
[ -f "$EXE" ] || { echo "인스톨러가 없습니다: $EXE"; exit 1; }

pick_upload_url() { python3 -c "import json,sys; print(json.load(sys.stdin)['upload_url'].split('{')[0])"; }

echo "1) 릴리스 조회 ($TAG)..."
UPLOAD_URL=$(curl -sf -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  "$API/releases/tags/$TAG" | pick_upload_url 2>/dev/null || true)

if [ -z "$UPLOAD_URL" ]; then
  echo "   없음 → 새로 생성..."
  UPLOAD_URL=$(curl -sf -X POST \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "$API/releases" \
    -d "{
      \"tag_name\": \"$TAG\",
      \"name\": \"PDF 편집기 $TAG\",
      \"body\": \"오프라인 데스크톱 PDF 편집기.\\n\\n- 페이지 관리 / 텍스트 추가·수정 / 그리기·형광펜 / 도형·스탬프·워터마크 / 서명·주석·링크\\n- 문서가 로컬 밖으로 나가지 않는 오프라인 처리\\n- Electron 43 + React 18 + pdf.js + pdf-lib\",
      \"draft\": false,
      \"prerelease\": false
    }" | pick_upload_url)
fi

echo "2) 인스톨러 업로드 (약 100MB, 수 분 소요)..."
curl -sf -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$EXE" \
  "$UPLOAD_URL?name=$ASSET_NAME" | python3 -c "import json,sys; d=json.load(sys.stdin); print('업로드 완료:', d['browser_download_url'])"
