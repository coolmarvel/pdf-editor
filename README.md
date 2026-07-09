# PDF 편집기

pdfguru.com 을 벤치마킹한 **오프라인 데스크톱 PDF 편집기**. 문서가 밖으로 나가지 않는다.

- 페이지 관리(추가·삭제·복제·회전·순서·다른 PDF 가져오기)
- **텍스트 추가** — 내용만큼 자라는 입력 상자, 8점 핸들 + 360° 회전, 폰트 17종·색/배경 팔레트·불투명도,
  가로/세로 정렬(상자 안 정중앙 배치), 클릭 지점 캐럿·드래그 이동
- **텍스트 수정(세션 모드)** — 기존 텍스트 자동 인식 → 글자 크기만큼 박스로 수정/이동/삭제(확인 팝업).
  모드 중 변경은 버퍼에 담고, 종료 시 저장/저장 안 함 선택 (Guru 동작)
- 연필·형광펜·지우개(흰칠)·그리기 지우개
- 도형(사각형·원·X·체크), 이미지, 스탬프(프리셋+커스텀), 서명(그리기/이미지/타이핑)
- 스티키 노트·링크(웹/페이지) — 실제 PDF 주석으로 저장
- 실행취소/다시실행, 줌·손 도구, 인쇄, PDF 저장(원본 벡터 유지 + 오버레이만 굽기)

## 스택

| 층 | 기술 |
|---|---|
| 셸 | Electron 43 + electron-vite |
| UI | React 18 + TypeScript + MUI 6 + zustand |
| PDF 렌더 | pdf.js (pdfjs-dist) |
| PDF 저장 | pdf-lib (평탄화 + 오버레이 굽기 + 주석) |
| 배포 | electron-builder NSIS(Windows) + custom DMG script(macOS) |

## 개발

```bash
npm install
npm run dev        # HMR 개발 모드
npm run typecheck  # 타입 검사
npm test           # core 순수 로직 테스트
npm run dist:win   # 인스톨러 → release/PDF편집기-Setup-<version>.exe
npm run dist:mac   # DMG → release/PDF편집기-<version>-arm64.dmg

# 시각 자가검증 (Playwright + WSLg 디스플레이, npm run build 후):
node e2e/visual-check.cjs   # 앱 구동→PDF 열기→텍스트 배치/편집/세션 흐름 스크린샷 + 픽셀 계측
```

## 구조

```
src/core/      # 순수 로직: 객체 모델·페이지 연산·히스토리 (node 테스트 대상)
src/main/      # Electron 메인: 창, 파일 열기/저장, 인쇄 IPC
src/preload/   # contextBridge API
src/renderer/  # React 앱
  src/pdf/     # pdf.js 렌더·텍스트 추출 / pdf-lib 저장
  src/editor/  # 캔버스 객체 렌더러(화면=저장 공유), 스탬프/서명 생성
  src/store/   # zustand 전역 상태
  src/components/  # Editor 셸·툴바·페이지 캔버스·다이얼로그
docs/          # 세션로그(SSOT)·todo·ADR·계획·가이드 — CLAUDE.md 부팅 프로토콜 참조
e2e/           # Playwright 시각 검증 스크립트 (릴리스 전 자동 스크린샷·픽셀 계측)
```

## 피드백 루프

사용자가 `pdf-editor-screenshots/`(우리 앱)·`pdf-guru-screenshots/`(벤치마크) 에 스크린샷을 넣으면
그걸 요구사항으로 반영하고, 처리분은 `docs/feedback-archive/` 로 옮긴다. 버전 규칙 등 상세는 `CLAUDE.md`.

작업 규칙·세션 부팅 절차는 `CLAUDE.md`, 문서 규칙은 `docs/writing-guide.md`.
