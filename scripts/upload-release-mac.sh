#!/usr/bin/env bash
# GitHub Release 에 macOS DMG 업로드 (버전 파라미터화)
# 사용법: bash scripts/upload-release-mac.sh <classic token> [버전] [dmg 경로]
#   (또는 GH_TOKEN 환경변수. 버전 기본값 = package.json, dmg 기본값 = ~/Desktop/PDF편집기-<버전>-arm64.dmg)
# 같은 태그의 릴리스가 이미 있으면(예: Windows 인스톨러가 먼저 올라간 경우) 그 릴리스에 자산만 추가한다.
# 맥에서 실행해도 되고(curl·python3 기본 탑재), dmg 를 WSL 로 복사해 여기서 실행해도 된다.
set -euo pipefail

GH_TOKEN="${1:-${GH_TOKEN:-}}"
VERSION="${2:-$(node -p "require('$(cd "$(dirname "$0")/.." && pwd)/package.json').version")}"
DMG="${3:-$HOME/Desktop/PDF편집기-$VERSION-arm64.dmg}"

REPO="coolmarvel/pdf-editor"
TAG="v$VERSION"
API="https://api.github.com/repos/$REPO"

[ -z "${GH_TOKEN:-}" ] && { echo "GH_TOKEN 환경변수가 필요합니다"; exit 1; }
[ -f "$DMG" ] || { echo "DMG가 없습니다: $DMG"; exit 1; }

case "$(basename "$DMG")" in
  *-arm64.dmg) ARCH="arm64" ;;
  *-x64.dmg|*-x86_64.dmg|*-amd64.dmg) ARCH="x64" ;;
  *) echo "DMG 파일명에서 아키텍처를 알 수 없습니다: $DMG"; exit 1 ;;
esac

ASSET_NAME="PDF-Editor-$VERSION-$ARCH.dmg"

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
      \"body\": \"오프라인 데스크톱 PDF 편집기.\\n\\n- 페이지 관리 / 텍스트 추가·수정 / 그리기·형광펜 / 도형·스탬프·워터마크 / 서명·주석·링크\\n- 문서가 로컬 밖으로 나가지 않는 오프라인 처리\\n- macOS DMG(arm64/x64)는 ad-hoc 서명 빌드 — 첫 실행 시 우클릭 → 열기 필요할 수 있음\",
      \"draft\": false,
      \"prerelease\": false
    }" | pick_upload_url)
fi

echo "2) DMG 업로드 ($ARCH, 수 분 소요될 수 있음)..."
curl -sf -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$DMG" \
  "$UPLOAD_URL?name=$ASSET_NAME" | python3 -c "import json,sys; d=json.load(sys.stdin); print('업로드 완료:', d['browser_download_url'])"
