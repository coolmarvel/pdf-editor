---
title: 세션 로그
created: 2026-07-08
updated: 2026-07-10
domain: development
---

# 세션 로그 (최신이 위)

이 파일이 **"언제 무슨 일이 있었나"의 SSOT**다. 세션마다 최상단에 블록 추가.
(2026-07-08부터 git 에 올리지만 커밋/푸시는 사용자가 직접·성긴 단위 — git history 를 이력 SSOT 로 삼지 않는다.)

## 2026-07-10 — v1.5.2: X/체크 사전 크기 조절·검정 기본 + 워터마크 커서 + ESC 도구 해제

**피드백** (구두, v1.5.1 확인 후): ① X/체크가 커서 미리보기보다 크게 찍힘 — 찍기 전에 컨텍스트 바에서
크기 조절 가능해야 ② 기본 색은 검정 ③ 워터마크 도구의 + 커서 불필요 ④ ESC 로 활성 도구 해제.

**수정**:
- `store/editor.ts`: `MarkStyle { color, size }` 신설 (기본 검정·16pt). shapeStyle(사각형/원)과 분리 —
  기본색을 나누기 위함 (도형은 파랑 유지).
- `SubToolbar.tsx`: cross/check 케이스를 rect/ellipse 에서 분리 — 색 팔레트(markStyle)+크기(12~56pt)+굵기.
  (기존에 보이던 DashSelect 는 제거 — 배치 객체에 dash 를 안 넣고 있어 무의미했음)
- `PageCanvas.tsx`: 배치 크기 = `markStyle.size` (0.035 고정 제거), stroke = markStyle.color.
  커서 SVG 를 **화면상 배치 크기와 1:1** 로 동적 생성 — markPx = size×페이지px×zoom,
  viewBox 점유율(MARK_VISUAL_RATIO 0.75) 보정, 16~64px 클램프, 핫스팟 중앙.
  워터마크 도구 커서 'default' (crosshair 폴백 제외).
- `Editor.tsx` 키 핸들러: ESC → tool!=='select' 면 select 로, 아니면 선택 해제.
  (입력 중(TEXTAREA/INPUT)엔 무시. editText 세션은 setTool 이 저장 확인 처리)

**검증**: typecheck ✅, test 21/21 ✅, build ✅. E2E(scratchpad/mark-check.cjs):
커서 svg=검정·36px(마크 27px) vs 16pt 배치 실측 32px(라운드 캡 오버플로 포함, 커서 시각 크기와 1px 이내) ✅ /
크기 셀렉트 32pt 로 크게 찍힘 ✅ / ESC→커서 default ✅ / 워터마크 커서 default ✅ / 연필 ESC ✅.

## 2026-07-10 — v1.5.1: 서명 다이얼로그 라이트 스킨(흰/빨강) + 축소

**피드백**: 사용자 캡처 1장(`pdf-editor-screenshots/`) — 서명 다이얼로그가 검은 배경(Guru 다크모드 색
그대로)이라 우리 흰색·빨강 UI와 안 맞고, 모달이 너무 큼.

**수정** (`SignDialog.tsx` — 로직 변경 없음, 스타일만):
- 다크 팔레트(DIALOG_DARK/PANEL_DARK) 제거 → `theme.ts` `ui` 팔레트로 전환:
  흰 배경, gray 스케일 테두리/텍스트, 포인트 = `ui.brand[500]`(#e0343f).
  탭 인디케이터/선택, 체크박스, Done·서명 추가 버튼, 서체 선택 테두리, 잉크 스와치 링 전부 레드.
- 크기 축소: 폭 min(1120→**720px**), add 화면 minHeight 720→480, library 640→400,
  탭 높이 72→46, 서체 그리드 104→60(테두리 카드형), 이미지 영역 360→240, 패딩 일괄 축소.
- 삭제 버튼(카드 우상단): 어두운 사각 → 흰 배경+회색 테두리, hover 시 브랜드 레드.

**검증**: typecheck ✅, test 21/21 ✅, build ✅. sign E2E 7항목 재통과 ✅ (동작 무변).
그리기/이미지/타이핑/라이브러리 4화면 스크린샷으로 라이트 스킨·축소 확인 ✅.

**피드백 정리**: 캡처 → `docs/feedback-archive/2026-07-10-v1.5.1-sign-light-skin/`.

## 2026-07-10 — v1.5.0: 워터마크 도구 신설 (MINOR — 서명 확정 후 착수)

**요청**: 워터마크 진행. plans 작성, 툴바 + 컨텍스트 바(우리 UI/UX 문법), 텍스트/이미지 양쪽 지원,
다양한 옵션. Guru 참고 스크린샷 없음 → 자체 설계 (`docs/plans/2026-07-10-watermark.md`).

**구현** (새 도구 추가 체크리스트 ①~⑤ 전체):
- `core/objects.ts`: `WatermarkObj` — rect(중앙 셀)+사전 렌더 비트맵 dataUrl+angle+layout(single/tile).
  텍스트도 비트맵으로 사전 렌더(스탬프/서명 방식) → draw/save 가 이미지 경로 재사용.
  `rotateObjectCW`(angle+90 누적)·`hitTest`(중앙 셀만 — 전체 페이지를 잡으면 다른 객체 클릭을 삼킴).
- `editor/watermark.ts`: `renderWatermarkText` (bold 64px×3, fontCss 재사용).
- `editor/draw.ts`: `drawWatermark` — single 은 rect 중심 회전 1개, tile 은 엇갈린 벽돌 패턴을
  회전 여백(pad)까지 포함해 페이지 전체 반복. 중앙 셀 위치를 격자 기준으로 삼아 히트테스트와 일치.
- `store/editor.ts`: Tool `'watermark'`, `watermarkStyle`(mode/text/font/color/image/opacity/angle/scale/layout/scope),
  `applyWatermark`(범위 페이지에 **한 커밋**으로 추가 → Ctrl+Z 한 번에 전체 취소), `removeAllWatermarks`.
- `PageCanvas.tsx`: preload·selRect·hasHandles·moveObject 에 watermark 추가 (rect 기반 경로 재사용 —
  이동/8핸들 리사이즈가 그대로 동작). `pdf/save.ts`: preload 필터에 watermark 추가 (굽기는 drawObjects 공유라 자동).
- `Toolbar.tsx`: 서명 옆 `워터마크` 토글 버튼. `SubToolbar.tsx`: 도구 바(소스 셀렉트·문구 입력·폰트·색·
  불투명도·기울기·크기%·배치·범위·[적용]·[모두 제거]) + 선택된 워터마크 바(불투명도·기울기·배치).
- i18n ko/en `wm*` 키 추가. 기본값: 회색 #9ca3af·35%·-30°·폭 50%·단일·전체 페이지.

**검증**: typecheck ✅, test 21/21 ✅, build ✅. Playwright E2E(scratchpad/wm-check.cjs):
컨텍스트 바 노출 ✅ / 적용 시 두 페이지 모두 잉크 픽셀 확인 ✅ / **언두 1번에 전체 제거** ✅ /
바둑판 잉크 15배(반복 패턴) ✅ / 중앙 셀 클릭 선택(스크롤 후) ✅ / Delete 는 그 페이지만 ✅ / 모두 제거 ✅.
스크린샷으로 컨텍스트 바가 기존 Group/36px 문법과 일치함 확인.

**참고**: 사이드바 썸네일은 원래 편집 객체를 렌더하지 않음(전 도구 공통) — 워터마크도 본문에만 보임.

## 2026-07-10 — 서명 기능 사용자 확정 + 문서 일제 정리 (코드 변경 없음, v1.4.9 유지)

**확정**: 사용자가 v1.4.9 서명 동작 확인("된 거 같아") — **서명 기능 종결 선언**.
다음 기능 = **워터마크**, 착수 시 **v1.5.0** (MINOR 승격 선언 접수, 지금은 버전 안 올림 — 사용자 지시).

**플랫폼 상태**: Windows exe 1.4.9 배포 완료. macOS(arm64)는 코드 동일하나 **1.4.9 DMG 는 미생성**
(WSL 에 `hdiutil` 없음) — 맥에서 `npm run dist:mac` 필요 (todo P1).

**문서 정리** (코드-문서 대조 후 어긋난 곳 일괄 현행화):
- `guides/editor.md`: sign 을 image/stamp 클릭 배치에서 분리, "서명(Sign) 흐름 (v1.4.9)" 절 신설,
  낡은 제약("savedSigns 재시작 시 소실") 삭제.
- `plans/2026-07-08-pdfguru-parity.md`: 상태표를 v1.4.9 기준으로 — Sign ✅ 사용자 확정,
  Page layout ✅(v1.4.0 에 Mode/Transition 구현됐는데 표가 "회전만"으로 낡아 있었음), 워터마크 = 다음 기능.
- `todo.md`: 완료 항목 제거(설치 테스트·서명 영속화), **stale 항목 청소** — "Page layout 모드/전환"(P2)과
  "다국어 UI"(P4)는 v1.4.0 에서 이미 구현·배선 확인(Toolbar `setPageMode`/`setPageTransition`,
  Landing `setLang`, i18n ko/en). 워터마크를 P1 최상단으로 승격.

## 2026-07-10 — v1.4.9: 서명 Done 즉시 배치 + 저장 서명 영속화

**피드백**: 사용자가 `pdf-guru-screenshots/` 에 Guru Sign 플로우 캡처 8장 업로드. ① Done(완료)을 누르면
클릭 대기 없이 **바로 화면에 서명이 나타나야** 하고 ② 서명이 하나라도 저장돼 있으면 Draw/Image/Type 이
아니라 **저장 서명 목록(삭제 가능)** 이 먼저 보여야 하는데 그렇지 않다고 함.

**원인**:
- Done 이 `pendingImage` + `sign` 도구 전환으로 "페이지 클릭 대기" 상태만 만들었음 (Guru 는 즉시 배치).
- `savedSigns` 가 zustand 메모리에만 있어 **앱을 재시작하면 소실** → 항상 추가 화면부터 나옴
  (v1.4.8 의 라이브러리 화면 자체는 있었으나 영속화가 없어 재실행 시 무용지물).

**수정**:
- `store/editor.ts`: `placeSignOnCurrentPage(dataUrl, aspect, at?)` 추가 — 현재 페이지에
  PageCanvas 클릭 배치와 같은 크기(wN 0.28)로 즉시 추가 + 선택 상태로 전환(히스토리 1단계).
  중심 좌표는 페이지 밖으로 안 나가게 클램프.
- `savedSigns` localStorage 영속화 (`loadSavedSigns`/`persistSavedSigns`, 키 `savedSigns`).
- `SignDialog.tsx`: Done/저장 카드 클릭 → `visiblePageCenter()` 로 **화면에 실제 보이는 페이지
  영역의 중앙**을 계산해 그 자리에 즉시 배치 (문서 좌표 0.5 고정이면 폭맞춤 화면에선 스크롤 밖에
  떨어지는 문제를 E2E 픽셀 검증에서 발견해 수정). `setPendingImage`/`setTool('sign')` 경로 제거.

**검증**: typecheck ✅, test 21/21 ✅, build ✅. 전용 Playwright E2E(scratchpad/sign-check.cjs)로
그리기→Done 즉시 배치(뷰포트 안) ✅ / 재오픈 시 라이브러리+삭제 버튼 ✅ / 카드 클릭 즉시 배치 ✅ /
**앱 재시작 후에도 라이브러리 유지(영속화)** ✅ / 삭제 시 localStorage 반영 ✅.

**피드백 정리**: 캡처 8장 → `docs/feedback-archive/2026-07-10-v1.4.9-sign-immediate/`.

## 2026-07-09 — v1.4.8: Sign 다이얼로그 Guru 화면 구조 반영

**피드백**: 사용자가 Codex 대화에 PDF Guru Sign 화면 7장을 직접 첨부. 모두 Guru 참고 이미지이며,
다크모드 캡처라 색은 구조 참고로 보고 우리 앱 톤에 맞춰 반영 요청.

**수정**:
- 첨부 캡처 7장을 `pdf-guru-screenshots/2026-07-09-sign-*.png` 로 분류.
- `SignDialog.tsx`를 Guru 흐름에 맞춰 재구성: 저장된 서명이 있으면 **Signatures 목록 화면**을 먼저 표시,
  `Add signature`로 Draw/Image/Type 편집 화면 진입.
- 저장 서명은 큰 2열 카드로 표시하고, 카드 우상단 삭제 버튼 추가(`removeSavedSign`).
- Draw: 어두운 모달 + 큰 밝은 서명 캔버스 + 색상 스와치 + Clear Signature.
- Image: 드래그/선택 업로드 영역, 선택 후 체크보드 배경 미리보기, Clear Signature.
- Type: 밝은 입력 프리뷰, 4개 서체 2×2 선택 그리드, 색상 스와치.

**피드백 정리**: `docs/feedback-archive/2026-07-09-v1.4.8-sign-guru/` 로 캡처 7장 이동 완료.

**검증**: typecheck ✅, test 21/21 ✅, build ✅. Electron 실화면 검증으로 Draw/Type 모달 스크린샷 확인 ✅.
`dist:mac` 는 앱 번들 생성·ad-hoc codesign·`Info.plist` 확인까지 정상이나, sandbox/권한 제한으로
`hdiutil: create failed - 장치가 구성되지 않았음` 에서 DMG 생성 실패. 현재 산출물은
`release/mac-arm64/PDF 편집기.app` (version 1.4.8, bundle id `seonghyunlee.pdfeditor`) 까지 생성됨.

## 2026-07-09 — v1.4.7: X/체크 도구 커서 모양 반영

**요청**: X표시/체크표시는 기능 수정 없이, 도구 활성 시 마우스 모양이 X/체크로 보이게.

**수정**: `PageCanvas.tsx`에 X/체크 전용 SVG 커서를 추가. 도구 색상(`shapeStyle.stroke`)을 따라가며
핫스팟은 중앙(16,16)으로 둬 클릭 위치와 배치 위치가 어긋나지 않게 했다.

**검증**: typecheck ✅, test 21/21 ✅, build ✅, `dist:mac` ✅.
앱 5초 이상 실행 유지 ✅ → `PDF편집기-1.4.7-arm64.dmg` 바탕화면 복사 ✅.

## 2026-07-09 — v1.4.6: 앱 식별자 seonghyunlee.pdfeditor 로 변경

**요청**: macOS 번들 내부 식별자가 `xyz.chungmu.pdfeditor` 로 남아 있던 것을 개인 식별자로 변경.

**수정**: `package.json`의 `build.appId` 를 `seonghyunlee.pdfeditor` 로 변경. 이 값은 macOS
`CFBundleIdentifier` 와 Electron Builder 앱 식별자에 반영된다.

**검증**: typecheck ✅, test 21/21 ✅, build ✅, `dist:mac` ✅.
`Info.plist` 확인: `CFBundleIdentifier=seonghyunlee.pdfeditor`, `CFBundleExecutable=PDFEditor`,
`CFBundleDisplayName=PDF 편집기`, version `1.4.6` ✅. 앱 5초 이상 실행 유지 ✅ → 바탕화면 DMG 복사 ✅.

## 2026-07-09 — v1.4.5: macOS DMG 실행 크래시 수정

**피드백**: macOS DMG 를 Applications 에 설치 후 실행하면 "PDF 편집기 응용 프로그램이 예기치 않게 종료" 크래시.
크래시 리포트는 `CrBrowserMain` / `EXC_BREAKPOINT(SIGTRAP)` / V8 스택으로, 앱 코드 로그 없이 종료.

**원인**: Electron macOS 번들의 내부 제품명/실행 파일명/helper 앱 이름에 한글(`PDF 편집기`)이 들어가면
Electron 이 helper/앱 리소스 로드 단계에서 깨짐. `app.asar` 자체는 개발용 Electron 으로 정상 로드됐고,
내부 제품명을 `PDFEditor` 로 통일한 테스트 번들은 정상 실행. 외부 `.app` 폴더명은 한글이어도 안전.

**수정**:
- Electron 런타임 `33.4.11` → `43.1.0` 업데이트(Node 24 LTS 계열과 맞춤).
- `scripts/dist-mac.cjs` 추가: `electron-builder --mac --dir` 를 내부 제품명 `PDFEditor` 로 실행 →
  외부 앱 폴더만 `PDF 편집기.app` 로 rename → Developer ID 전까지 ad-hoc codesign →
  `hdiutil` 로 `PDF편집기-<version>-arm64.dmg` 직접 생성.
- `dist:mac` 는 이제 위 스크립트를 사용. Windows productName/NSIS 설정은 기존 한글 유지.

**검증**: typecheck ✅, test 21/21 ✅, build ✅, `dist:mac` ✅. 생성된
`PDF편집기-1.4.5-arm64.dmg` 를 실제 마운트 → 내부 `PDF 편집기.app` codesign 검증 ✅ →
앱 5초 이상 실행 유지(시작 즉시 크래시 없음) ✅ → 바탕화면 복사 ✅.

## 2026-07-09 — v1.4.4: 스탬프 프리셋을 Guru 세트(25종)로 전면 교체

**피드백**: guru 스크린샷 4장 + 우리 다이얼로그 1장 — "우리 스탬프 너무 허접, guru 기본 스탬프를 가져와라"
(→ `feedback-archive/2026-07-09-v1.4.3-stamps/`).

**구현** (`editor/stamp.ts` + `StampDialog.tsx`):
- `StampSpec` 확장: `shape?: 'rect'|'tagLeft'`, `icon?: 'cross'|'check'`, `autoDateTime?: boolean`.
- `PRESET_STAMPS` 10 → **25종** (guru 순서/팔레트 근사): 초록(APPROVED/FINAL/COMPLETED)·
  빨강(NOT APPROVED/VOID/TOP SECRET)·남색(DRAFT/CONFIDENTIAL/FOR (NOT FOR) PUBLIC RELEASE/
  FOR COMMENT/PRELIMINARY RESULTS/INFORMATION ONLY/AS IS/DEPARTMENTAL/EXPERIMENTAL/EXPIRED/SOLD)·
  아이콘 ✗(빨강)/✓(초록)·왼쪽 화살표 태그(INITIAL HERE 보라/SIGN HERE 빨강/WITNESS 노랑)·
  **날짜 자동**(REVISED 남색/REJECTED 빨강 — 찍는 시점의 "MM/DD/YYYY, hh:mm AM/PM" 서브텍스트,
  `nowStampDateTime()`).
- `renderStamp`: tagLeft 펜타곤 패스·서브텍스트 줄·아이콘 렌더(굵은 round-cap 스트로크) 추가.
- 다이얼로그 프리셋 그리드: CSS 흉내 → **실제 renderStamp dataUrl `<img>`** (미리보기=실물 100% 동일,
  다이얼로그 열릴 때 useMemo 1회 생성). 커스텀 스탬프 팔레트도 guru 톤 6색으로 교체.

**검증**: Playwright 로 다이얼로그 상/하단 + REJECTED 배치 스크린샷 직접 확인 ✅, 전체 E2E(visual+pages) ✅,
test ✅ → `PDF편집기-Setup-1.4.4.exe` 바탕화면 ✅.

## 2026-07-09 — v1.4.3: 바이트코드 사고 수습 — 난독화 단일 체계로

**사고**: v1.4.2 가 사용자 Windows 에서 시작 즉시 크래시 — "Invalid or incompatible cached data
(cachedDataRejected)". **V8 바이트코드는 컴파일한 플랫폼에 종속** — WSL(Linux) Electron 이 만든 .jsc 를
Windows Electron 이 거부. (내 Linux E2E 는 같은 플랫폼이라 통과해서 못 잡음 — **크로스 플랫폼 산출물은
Linux 검증만으론 불충분**하다는 교훈.)

**수정**: bytecodePlugin 제거(config 에 금지 사유 주석), `scripts/obfuscate.cjs` 로 일원화 —
main/preload/renderer 전부 난독화(플랫폼 무관 JS). main 3→5KB, preload 1→2KB, renderer 2516→2677KB.
전체 E2E(visual+pages) ✅ → `PDF편집기-Setup-1.4.3.exe` 바탕화면 ✅.

## 2026-07-09 — v1.4.2: 배포 소스 보호 (바이트코드 + 난독화)

**배경**: 사용자 질문 — 설치본에서 소스 복원 가능? → 가능했음(app.asar 는 단순 아카이브, main 은 미압축,
renderer 는 minify 만). 라이선스 키는 보류(코드 보호와 별개 문제임을 설명).

**적용** (100% 방지는 불가, "비용 올리기"):
1. **main/preload → V8 바이트코드** (`electron.vite.config.ts` bytecodePlugin): 배포물은 2줄 로더 +
   `index.jsc` — 실행 동작 동일, 사람이 읽을 수 없음.
2. **renderer 난독화** (`scripts/obfuscate-renderer.cjs`, build 파이프라인에 연결 — `npm run build` =
   electron-vite build + 난독화): hex 식별자 + 문자열 배열(threshold 0.6). **보수 설정** —
   controlFlowFlattening/deadCodeInjection/selfDefending 등 성능·안정성 위험 옵션 전부 OFF,
   pdf.worker 제외(공개 라이브러리 + 성능 민감). 결과: 2516→2676KB(+6%), 빌드 +6.7s.
3. devDep `javascript-obfuscator` 추가. dist:win 등이 `npm run build` 경유하도록 스크립트 정리.

**검증**: 보호 빌드로 전체 E2E(visual+pages) ✅ test 21/21 ✅ — 기능 영향 없음 확인.
pages-check 의 "페이지 레이아웃" 라벨을 v1.3.6 축약("레이아웃")에 맞게 수정.
→ `PDF편집기-Setup-1.4.2.exe` 바탕화면 ✅.

## 2026-07-09 — v1.4.1: 연필 컨텍스트 바 Guru 파리티

**피드백** (스크린샷 3장 → `docs/feedback-archive/2026-07-09-v1.4.0-pencil/`): 연필 기능은 완성,
컨텍스트 바만 Guru 대비 부족 — 채우기·혼합 모드 없음, 기본 2pt vs 5pt.

**수정**: `penStyle` 을 HighlightStyle 타입(fill/blend 포함)으로 승격 — 기본 {5pt, fill null, blend normal}.
연필 바 = [색][채우기] | [◐] | [≡ 5pt] | [혼합 Normal] (Guru 와 동일, StrokeObj 는 이미 fill/blend 지원).
transientStroke 연필 경로에 fill/blend 반영. 스크린샷 검수 ✅ 회귀 E2E ✅ test 21/21 ✅
→ `PDF편집기-Setup-1.4.1.exe` 바탕화면 ✅.

## 2026-07-09 — v1.4.0: 1.3.x 배치 확정 (사용자 선언)

사용자가 1.3.x(i18n·페이지 기능·형광펜·UI 스킨·규격 통일) OK → **1.4.0 승격** (내용 = 1.3.6 동일).
다음 작업부터 1.4.x. git 커밋은 사용자가 직접 (메시지 전달함).

## 2026-07-09 — v1.3.6: 툴바 버튼 규격 통일 (76×48 고정)

**피드백** (스크린샷 2장 → `docs/feedback-archive/2026-07-09-v1.3.5-toolbar-uniform/`): 툴 버튼 활성 박스가
라벨 길이 따라 제각각("텍스트 수정" 넓고 "형광펜" 좁음), ⌄ 유무로도 리듬 다름 — 전부 동일 크기로.

**수정** (Toolbar ToolBtn): 본체 **76×48px 고정**(TOOLBTN_W/H 상수), p:0 + 내부 중앙 정렬,
라벨 11.5px + ellipsis(초과 방지), ⌄ 화살표 16×48 고정 부가물. "페이지 레이아웃" 라벨은 규격 초과라
i18n 값 자체를 "레이아웃"/"Layout" 으로 축약. E2E로 8개 버튼 실측 → 전부 76×48 ✅.

## 2026-07-09 — v1.3.5: 컨텍스트 바 Guru 문법으로 전면 재구성

**피드백** (스크린샷 2장 → `docs/feedback-archive/2026-07-09-v1.3.4-ctxbar/`): 우리 컨텍스트 바는 뭐가 뭔지
알 수 없음, 컨트롤 크기 제각각 — Guru 처럼 전 도구(텍스트 추가~링크) 통일.

**구현** (SubToolbar 전면 재작성 — 공용 빌딩블록):
- **Guru 문법**: 컨트롤마다 `[의미 아이콘(회색20px, 툴팁)] + [36px 통일 높이 박스형 컨트롤]` = `Group`,
  그룹 사이 `GDivider`(세로선). 아이콘: 색=펜, 채우기=페인트통, 불투명도=◐(Contrast), 굵기=≡(LineWeight),
  선 스타일=LineStyle, 혼합=Layers, 폰트=Tт, 글자색=A.
- 공용 컴포넌트: `PaletteControl`(박스형 스와치+⌄ 트리거), `OpacityControl`(박스형 %+슬라이더),
  `WidthSelect`(pt, 현재값 포함 보장), `DashSelect`, `BlendSelect`, `TIcon`(B/I/U·정렬 토글 32px).
- 적용: 텍스트(도구/선택)/editText/도형(도구/선택)/연필/형광펜/지우개/스트로크 선택 전부.
  컨트롤 순서도 Guru 와 맞춤: 색 → 채우기 → 불투명도 → 굵기 → 스타일/혼합.
- 지우개 기본 테두리 5pt(Guru 기본), 불필요한 힌트 텍스트 제거(아이콘이 설명), 바 높이 52px 고정 유지.

**검증**: 도구별 바 스크린샷 5종 검수(Guru 와 구조 일치) ✅ 회귀 E2E ✅ test 21/21 ✅
→ `PDF편집기-Setup-1.3.5.exe` 바탕화면 ✅.

## 2026-07-09 — v1.3.4: TailAdmin 디자인 스킨 이식

**피드백** (구두): UI 스타일이 구림 — `tailadmin-nextjs-pro-225/`(루트, **gitignore 처리**)의 UI/UX 를 학습해
껍데기만 이식. 색상은 기존 레드 유지, 기능 무변경. 마음에 안 들면 롤백 예정.

**방식**: TailAdmin 토큰을 **theme.ts 한 곳에 집약**(MUI styleOverrides = 재사용 스킨) + 하드코딩 색 정리.
- 토큰(`export const ui`): Untitled UI 그레이 스케일(50 #f9fafb/200 #e4e7ec 보더/300 #d0d5dd 인풋보더/
  500 #667085 보조텍스트/800 #1d2939/900 #101828), 브랜드 레드 스케일(50 #fdeeee ~ 700),
  섀도 xs/sm/md/lg(이중 레이어) + focus-ring(브랜드 12% 4px)
- 컴포넌트: Button(rounded-lg·shadow-xs·outline=흰배경+회색링), OutlinedInput/Select(포커스 브랜드 링),
  Menu/Popover(rounded-xl·보더·shadow-lg·아이템 라운드/브랜드 selected), Dialog(rounded-2xl),
  Tooltip(gray-800), ToggleButtonGroup(회색 트랙+흰 선택 세그먼트)
- 컴포넌트 정리: 사이드바 gray-25 배경·페이지 관리 버튼을 표준 outline 으로, 랜딩 드롭존 카드화(흰 배경+섀도),
  플로팅 페이저 gray-800, hover 색 #f2f4f7(gray-100) 통일
- 참조 소스: globals.css(토큰)/ui/button/dropdown/form/input — 코드 복사 없음, 디자인 값만 이식

**검증**: 랜딩/에디터/메뉴/다이얼로그 스크린샷 검수 ✅ 회귀 E2E(visual+pages) ✅ test 21/21 ✅
→ `PDF편집기-Setup-1.3.4.exe` 바탕화면 ✅. 롤백 시: 이 커밋 전 상태로 (테마+상기 컴포넌트 색만 되돌리면 됨).

## 2026-07-09 — v1.3.3: 혼합 모드가 실제로 섞이게 (백드롭 합성)

**피드백** (구두): 혼합 모드를 바꿔도 전부 똑같아 보임.
**원인**: 오버레이가 **투명한 별도 캔버스**라 블렌드가 "투명 배경"과 섞인 뒤 PDF 위에 source-over 로 얹힘
→ 모드 불문 알파만 보임. 블렌드는 페이지 픽셀을 백드롭으로 깔아야 의미가 있다.

**수정**:
- **에디터**(`PageCanvas.redrawOverlay`): 그릴 객체(+드래그 미리보기) 중 실효 블렌드≠normal 이 있으면
  흰 배경 + base 캔버스(PDF 렌더)를 오버레이에 먼저 복사한 뒤 객체를 블렌드로 그림.
  base 렌더 완료 시 bump() 로 오버레이 재그리기 (빈 백드롭으로 굳는 타이밍 버그 예방).
- **저장**(`save.ts burnOverlayPng`): 블렌드 객체가 있으면 페이지를 pdf.js 로 래스터(scale 동일) → 백드롭 위에
  블렌드로 그림 → **객체 커버리지 마스크로 destination-in** — 화면과 같은 혼합 결과 조각만 원본 벡터 위에 얹음.
  (커버 영역만 래스터화, 나머지는 벡터 유지. 반투명 객체는 마스크 알파 3배 증폭 — 굽힌 픽셀에 이미 혼합 포함)
- `effectiveBlend()` 헬퍼 (draw.ts): stroke 는 blend ?? (highlight→multiply), 그 외 normal.

**검증**: 5개 모드 시각 비교 — Normal(띠+물듦)/Multiply(글자 또렷)/Screen(글자만 밝아짐)/
Difference(보색 파란 띠) 전부 상이 ✅. 회귀 E2E ✅ test 21/21 ✅ → `PDF편집기-Setup-1.3.3.exe` 바탕화면 ✅.

## 2026-07-09 — v1.3.2: 형광펜 Guru 파리티 + 기본 배율 폭 맞춤

**피드백** (스크린샷 3장 → `docs/feedback-archive/2026-07-09-v1.3.1-highlight-zoom/`):
① 기본 로드 배율이 너무 작음(45%) — Guru 처럼 메인에 꽉 차게 ② 형광펜에 혼합 모드(Normal~Exclusion)·
채우기 색 없음 ③ 형광펜 커서를 지우개처럼 빈 원으로.

**구현**:

1. **기본 배율 = 폭 맞춤**: store `fitMode: 'width'|'page'` — zoom=0 재-fit 시 기본 width(두 쪽 모드는
   2페이지 폭 계산), 레이아웃 패널 "화면에 맞춤" 버튼만 page(전체 보임). setPageMode 도 width 재-fit.
2. **형광펜**: `StrokeObj`에 `fill?`(경로 내부 채움)·`blend?`(BlendMode 12종 — 캔버스 gCO 와 1:1) 추가.
   drawStroke 가 blend 적용(기본: highlight=multiply) + fill 먼저 칠하고 stroke.
   `HighlightStyle`(fill/blend 포함) 신설. 컨텍스트 바: 색/채우기(없음 기본)/불투명도/굵기/**혼합 모드 Select**.
   선택된 스트로크(연필 포함)도 동일 풀 컨트롤로 확장. 굵기 15pt(기본값)가 옵션에 없어 빈 칸으로 보이던 버그 수정.
3. **형광펜 커서 = 빈 원**(ERASE_CURSOR 재사용).

**주의**: 기본 배율 변경으로 visual-check 의 절대 좌표(0.55h 클릭·클립)가 뷰포트 밖으로 나가 실패 —
0.3h 로 조정. **배율/레이아웃을 바꾸면 E2E 좌표 가정도 같이 점검할 것.**
검증: typecheck ✅ test 21/21 ✅ visual-check·pages-check ✅ → `PDF편집기-Setup-1.3.2.exe` 바탕화면 ✅.

## 2026-07-09 — v1.3.1: 전역 폰트 확대

**피드백** (구두): 전체적으로 글씨가 작아 깨져 보임 → 키워달라.
**수정**: theme.typography `fontSize 14→15`, `caption 12→13`(컨텍스트 바 힌트류), 툴바 라벨 `11→12px`.
E2E 스크린샷으로 툴바/컨텍스트 바 확대·한 줄 유지 확인 ✅ → `PDF편집기-Setup-1.3.1.exe` 바탕화면 ✅.

## 2026-07-09 — v1.3.0: i18n(한/영) + 페이지 기능 대개편 (사이드바·페이지 관리·레이아웃)

**피드백** (Guru 스크린샷 9장 + 우리 랜딩 1장 → `docs/feedback-archive/2026-07-09-v1.2.6-pages-i18n/`).
**버전 규칙**: 이 기능군은 사용자 OK 전까지 1.3.x 로 계속 올림.

**1) i18n** (`src/renderer/src/i18n.ts` — 라이브러리 없이 사전+zustand):
- `lang: 'ko'|'en'` store 상태, localStorage('lang') 유지. `useT()` 훅으로 전 컴포넌트 문자열 교체
  (Landing/TopBar/Toolbar/SubToolbar/FloatingPager/Editor 다이얼로그/ManagePages/Stamp/Sign/PageCanvas 팝업).
- 랜딩 우측 상단 언어 토글(한국어/English). 주의: SubToolbar 의 `const t = selObj` 가 i18n `t` 를 가리는
  섀도잉이 있었음 — obj/et 로 개명.

**2) 사이드바** (`ThumbnailSidebar` 전면 재작성):
- **폭 조절 핸들**(우측 가장자리 드래그, 150~420px, localStorage 유지)
- 썸네일 호버 → **⋮ 메뉴**: 위/아래 이동·좌/우 회전·복제·**페이지 추출**(단일 페이지를 새 PDF 로 저장, buildPdf 재사용)·삭제
- **드래그 순서 변경**: 포인터 기반(6px 임계) + 보라 삽입선. ⚠ HTML5 dnd 는 Electron/Playwright 에서 불안정해
  포인터 방식으로 구현 (pointerdown preventDefault 로 텍스트 선택·자동 스크롤 차단 필수)
- 페이지 사이 **실선+⊕**(호버 시 표시) → 페이지 추가 / PDF 업로드(그 위치에 삽입 — `insertDocument(index)` 신설)

**3) 페이지 관리 다이얼로그**: 같은 포인터 드래그로 순서 변경(세로 보라선, 그리드 좌/우 절반 판정),
선택 묶음째 이동 지원. `movePagesToIndex()` 신설(+테스트 2개).

**4) 페이지 레이아웃 패널** (Guru 구조): Page Mode(한 쪽/두 쪽/화면 맞춤) · Page Transition(이어서/한 장씩) ·
Page Rotation(현재 페이지 좌/우). store `pageMode`/`pageTransition`/`requestFit`(zoom=0 → PagesView 재-fit).
PagesView 재작성: double = 2쪽 나란히(행 단위), paged = 현재 장(쌍)만 렌더, 페이저가 두쪽+한장씩일 땐 2씩 이동.

**E2E** (`e2e/pages-check.cjs` 신규): 영어 랜딩 ✓ / ⋮ 메뉴 ✓ / ⊕ 메뉴 ✓ / 드래그 재정렬(전후 순서 비교) ✓ /
레이아웃 패널·두 쪽·한 장씩 ✓. 함정: 드래그 목표 좌표가 뷰포트 밖이면 이벤트 미전달(테스트 실패 원인이었음).
visual-check 는 스플릿 버튼 대응(지우개 메뉴는 ⌄로 열기). typecheck ✅ test 21/21 ✅ 회귀 E2E ✅
→ `PDF편집기-Setup-1.3.0.exe` 바탕화면 ✅.

## 2026-07-09 — v1.2.6: 드롭다운 도구 스플릿 버튼화 (Guru)

**피드백** (Guru 스크린샷 1장 + 잔여 3장 → `docs/feedback-archive/2026-07-09-v1.2.5-split-buttons/`):
지우개/이미지/사각형처럼 ⌄ 있는 버튼은 **기능 버튼과 드롭다운 버튼을 분리** — 기능 버튼은 기본값(마지막
사용 변형)을 켜고 끄는 토글, ⌄만 눌렀을 때 메뉴.

**구현** (Toolbar):

- `ToolBtn`에 `onDropdown` 추가 → 스플릿 버튼 렌더 (본체 + 좁은 ⌄ 버튼, hover 분리).
- 마지막 사용 변형 기억: `lastEraser`(기본 whiteout)/`lastShape`(rect)/`lastImage`(image) — 로컬 state.
  기능 버튼 클릭 = 활성이면 select 로 끄기, 아니면 마지막 변형으로 켜기. 라벨/아이콘도 기본값을 표시
  (예: 스탬프를 마지막에 썼으면 버튼이 '스탬프'로). 메뉴 항목 선택 = 변형 활성 + 기억 (끄기는 기능 버튼 몫).
- 페이지 레이아웃은 순수 메뉴 버튼 — 본체·⌄ 모두 메뉴.
- 참고: 잔여 스크린샷에서 구루의 물결(scalloped) 테두리 스타일 확인 → todo 후보로.

**검증** (E2E): 기능 클릭=활성·메뉴 안 뜸 ✓ / 재클릭=비활성 ✓ / ⌄=메뉴만(도구 상태 불변) ✓ /
메뉴 선택 후 껐다 켜면 마지막 변형 유지 ✓ / 툴바 스크린샷 검수 ✓. test 19/19 ✅
→ `PDF편집기-Setup-1.2.6.exe` 바탕화면 ✅.

## 2026-07-09 — v1.2.5: 툴바 도구 토글 (재클릭 = 비활성)

**피드백** (구두): Guru 처럼 활성 도구 버튼을 한 번 더 클릭하면 비활성(선택 도구로).
용어 정리 — 사용자: 윗줄 = "툴바", 아랫줄 = "컨텍스트 바".

**구현** (Toolbar): `toggle(t) = setTool(tool===t ? 'select' : t)` — 텍스트 추가/형광펜/연필/X표시/체크/주석/링크
직접 버튼 + 지우개 드롭다운 2항목 + 도형 드롭다운(사각형/원, 단 지우개 모드에선 지우개 도형 변경 유지).
텍스트 수정은 기존 세션 토글 그대로. 서명/이미지(다이얼로그·메뉴)는 해당 없음.

**검증**: E2E로 형광펜 클릭→활성색(#f8d7d9)→재클릭→비활성 확인 ✅ (주의: 버튼 활성 판별은 hover 회색과
구분해야 함). test 19/19 ✅ → `PDF편집기-Setup-1.2.5.exe` 바탕화면 ✅.

## 2026-07-09 — v1.2.4: 지우개 미리보기 stale 클로저 + 형광펜 뭉텅이 지우기

**피드백** (구두): ① 그리기 지우개가 형광펜을 뭉텅이로 지움 ② 사각형 지우개가 "파란 선으로 영역 지정 →
놓으면 흰 사각형" — 처음부터 흰 사각형이 실시간으로 늘어나야.

**원인/수정** (둘 다 E2E 재현으로 확인):

1. **파란 미리보기의 정체 = stale 클로저**: `redrawOverlay` 가 useCallback 인데 deps 에 tool/스타일이 없어서
   드래그 미리보기(`transientShape`)를 **옛 도구 기준**(도형 도구의 파란 테두리)으로 그림. 이 이펙트는 매 렌더
   실행되므로 메모이즈 이득이 없음 → useCallback 제거(항상 신선한 클로저). 이제 드래그 즉시 흰 도형이
   실시간으로 덮으며 자람 (mid-drag 스크린샷 확인).
2. **뭉텅이 지우기 = 드문 점**: 스트로크 점이 pointermove 샘플링 간격이라(형광펜 특히 성김) 한 점만 지워도
   이웃 점까지의 긴 구간이 통째로 사라짐 → 지우기 전 점을 0.004 간격으로 **보간(densify)** 후 분할.
   형광펜 가로선 두 곳 클릭 → 3토막 매끄럽게 잘림 (스크린샷 확인).

**검증**: typecheck ✅ / test 19/19 ✅ / 전체 E2E ✅ → `PDF편집기-Setup-1.2.4.exe` 바탕화면 ✅.
**교훈**: PageCanvas 의 이벤트 핸들러·렌더 함수에서 useCallback 메모이즈는 stale 클로저 위험 —
매 렌더 재생성이 안전 (이미 그렇게 동작 중).

## 2026-07-09 — v1.2.3: 브랜딩 교체 — 사용자 사진 제거, 벡터 PDF 아이콘 생성

**피드백** (구두): 인스톨러·실행 아이콘 등에 쓰인 본인 사진 제거, PDF 어울리는 매끈한 아이콘으로 교체,
설치 중 "File Converter" 문구 수정. 이름·저작권 표기는 유지.

**작업**:

- **아이콘 생성기** `scripts/gen-icons.cjs` 신설: 순수 캔버스 벡터 드로잉(사진·비트맵 소스 없음 → 어느 크기든
  안 깨짐)을 Electron 으로 렌더 → `build/` 자산 일괄 생성. 디자인: 레드 그라디언트 스쿼클 + 접힌 귀퉁이 문서
  + 굵은 PDF 타이포 + 빨간 선을 긋는 연필. 재생성: `npm run build 후 node scripts/gen-icons.cjs`.
  - `icon.png`(1024) — 창/작업표시줄·mac/linux
  - `icon.ico`(256/128/64/48/32/24/16 PNG 엔트리) — exe·인스톨러·바로가기
  - `installerSidebar.bmp`/`uninstallerSidebar.bmp`(164×314) — 레드 그라디언트 + 로고 + "PDF 편집기/오프라인 PDF 편집/© 2026 이성현"
  - `installerHeader.bmp`(150×57) — 흰 배경 + 미니 로고 (BMP는 24bit BGR bottom-up 자체 인코더로 작성)
- **license.txt**: 헤더 "파일 변환기 (File Converter)" → "PDF 편집기 (PDF Editor)" (설치 화면에 보이던 부분).
  저작권/제작자 이성현 표기는 그대로.
- 주의: license.txt 수정 전에 인스톨러를 한 번 구웠다가 재빌드함 — **브랜딩 파일 수정 후 dist 재실행 필수**.

**검증**: 256/32px·사이드바·헤더 미리보기 Read 로 검수 ✅ → `PDF편집기-Setup-1.2.3.exe` 바탕화면 ✅.

## 2026-07-08 — v1.2.2: 그리기 지우개 부분 지우기 + 지우개↔도형 버튼 연동

**피드백** (구두): ① 그리기 지우개가 선 전체를 지움 → 닿은 부분만 지워져야 ② 지우개 도형 선택은
컨텍스트 툴바가 아니라 **메인 툴바 도형 버튼과 연동** — 지우개 켜면 도형 버튼이 사각형으로 리셋되며 둘 다 활성,
그리기 지우개 선택 시 도형 버튼 해제.

**구현**:

1. **부분 지우기** (`eraseStrokesAlong`): 브러시 경로에 닿은 점만 걷어내고 남은 연속 구간을 각각 새 선으로 분리.
   제스처당 히스토리 1단계(moved 플래그). 두 가지 함정을 E2E로 발견·해결:
   - stale 클로저: 연속 pointermove 가 한 렌더 프레임에 몰리면 렌더 시점 objects 로 이미 대체된 선을 재추가
     → `useEditor.getState()` 로 최신 상태 직접 조회.
   - pointermove 병합(coalescing): 샘플 간격이 브러시보다 넓어져 중간을 건너뜀 → 점 판정 대신
     **직전 위치→현재 위치 선분에 대한 거리 판정**(aspect 보정 점-선분 거리).
2. **컨텍스트 툴바 높이 고정** (`SubToolbar` bar: minHeight 42 → height 50): 도구마다 바 높이가 달라
   페이지가 세로로 튀고(v1.0.5 때 상시 표시로 잡은 것과 같은 계열) 좌표가 어긋나던 잔여 버그.
   디버그 중 지운 자리에 정확히 같은 49px 잉크가 남는 현상의 진짜 원인이 이거였음.
3. **지우개↔도형 버튼 연동** (Toolbar): 지우개(도형 덮기) 진입 시 eraserKind='rect' 리셋 + 도형 버튼 라벨/아이콘이
   지우개 도형을 표시하며 **함께 활성**. 도형 드롭다운이 지우개 켜진 동안엔 지우개 도형을 바꿈.
   그리기 지우개는 도형 버튼 비활성. 컨텍스트 툴바의 모양 Select 는 제거.

**E2E**: 가운데만 문지르면 선이 두 토막(스크린샷) + 원 커서 유지 ✓ / 전부 문지르면 잉크 0픽셀·기본 커서 ✓ /
기존 시나리오 전부 유지 ✅. typecheck ✅ test 19/19 ✅ → `PDF편집기-Setup-1.2.2.exe` 바탕화면 ✅.

## 2026-07-08 — v1.2.1: 지우개 2종 Guru 파리티

**피드백** (Guru 스크린샷 10장 → `docs/feedback-archive/2026-07-08-v1.2.0-eraser/`):
① Eraser = 도형 기반 덮기(테두리 색/두께/선 스타일·채우기·불투명도 스타일링 가능, 도형 선택 연동)
② Erase drawing = 낙서가 있을 때만 속 빈 원 커서, 문질러 지움 ③ 용어 질문: 둘째 줄 막대 = 컨텍스트 툴바(옵션 바).

**구현**:

- **지우개(whiteout) 재설계**: 자유곡선 흰 칠 → **도형 드래그 덮기**. `EraserStyle`(kind rect/ellipse, stroke,
  strokeWidth, fill, opacity, dash) 신설, whiteoutWidth 삭제. 드래그 후 도구 유지(연속 지우기) + 방금 도형 선택
  (옵션 바에서 즉시 스타일링). 옵션 바: 모양/테두리 색/두께/**선 스타일**/채우기/불투명도.
- **테두리 선 스타일**: `ShapeObj.dash?: 'solid'|'dotted'|'dashed'` — draw.ts setLineDash(굵기 비례).
  `DashSelect`(실제 선 모양 렌더) 를 지우개·도형 도구·선택된 도형 옵션 바에 추가. 도형 도구 기본 설정에 채우기도 추가.
- **그리기 지우개 커서**: 페이지에 스트로크가 있을 때만 속 빈 원(`ERASE_CURSOR`, 1x/2x image-set) — 없으면 기본.
- E2E 추가: 연필 낙서 → 원 커서 ✓ → 문질러 전부 지우면 기본 커서 복귀 ✓ → 지우개 드래그로 텍스트 커버 ✓.
  (참고: MUI 메뉴 닫힘 애니메이션 중 백드롭이 포인터를 삼켜 E2E 드래그가 끊기는 함정 — 메뉴 클릭 후 500ms 대기 필요)

**검증**: typecheck ✅ / test 19/19 ✅ / E2E ✅ → `PDF편집기-Setup-1.2.1.exe` 바탕화면 ✅.

## 2026-07-08 — v1.2.0: 텍스트 수정 확정(사용자 선언) + git 공개 준비

**버전**: 사용자가 "텍스트 수정도 여기까지" 선언 → **1.2.0 승격** (내용 = 1.1.2 와 동일, 승격 마커).
다음 기능 다듬기는 1.2.1~1.2.n.

**git 준비**: 사용자가 직접 커밋/푸시 예정 (커밋 메시지는 Claude 가 작성해 전달).
- `README.md` 갱신 — 텍스트 추가/수정(세션) 기능 상세, e2e 자가검증 명령, 피드백 루프 설명.
- `.gitignore` 신설 — node_modules/out/release/tsbuildinfo, e2e 스크린샷 산출물, 피드백 인박스 png.
- `docs/feedback-archive/`(처리된 스크린샷 이력)는 시각 SSOT 로서 **커밋 대상에 포함**.

**검증**: 코드 변경 없음(버전만) — dist:win ✅ → `PDF편집기-Setup-1.2.0.exe` 바탕화면 ✅.

## 2026-07-08 — v1.1.2: 텍스트 수정 = 세션 모드 (Guru 동작)

**피드백** (Guru 스크린샷 3장 → `docs/feedback-archive/2026-07-08-v1.1.1-edittext-session/`):
① Edit Text 는 한 번 클릭해도 하이라이트가 꺼지지 않고 유지 ② 삭제 시 확인 팝업 후 글자가 지워짐
③ 모드 중 undo 비활성 — 변경은 버퍼에 담김 ④ 모드 종료 시 변경 있으면 "저장/저장 안 함", 없으면 조용히 종료.

**구현 — editText 세션** (`store/editor.ts` 중심):

- `editTextSnapshot`(세션 시작 시 objectsByPage) 저장. **세션 중 히스토리 동결**: `commit()`이 세션이면
  히스토리 없이 적용, markHistory/undo/redo no-op, Toolbar 실행취소·다시실행 회색 처리.
- `setTool` 인터셉트: editText 진입 시 스냅샷, 이탈 시 변경 검사 → 있으면 `editTextExitPrompt`(Editor 가
  "수정한 내용을 저장할까요?" 다이얼로그: 계속 편집/저장 안 함/저장), 없으면 조용히 종료.
  저장 = 세션 전 상태를 히스토리 한 단계로 커밋(종료 후 Ctrl+Z 한 번에 전체 원복 — E2E 확인), 안 함 = 스냅샷 원복.
- **손대지 않은 객체 정리**: 스팬을 클릭만 하고 안 바꾼 editText(원문 그대로·제자리, `origText` 필드 신설)는
  종료 시 자동 제거 → 변경 없음으로 판정 (팝업 안 뜸).
- **삭제 확인**: 세션 중 editText 삭제(Del 키·휴지통) → `deletePrompt` 다이얼로그("이 텍스트 상자를 지울까요?")
  → 지우기 = 텍스트만 비우고 cover 유지(원본이 지워진 상태).
- Toolbar: 텍스트 수정 버튼 토글화(재클릭 = 종료 시도). PageCanvas: 도구를 유지한 채 기존 editText 객체
  이동/캐럿·스팬 신규 생성, 이동한 객체의 원래 자리 스팬은 클릭·하이라이트 모두 무시(중복 생성 방지).

**E2E**: dirty 종료 → 다이얼로그 ✓ / clean 종료 → 없음 ✓ / 저장 안 함 → 원복 ✓ / 삭제 확인 → 글자 지워짐 ✓ /
저장 후 Ctrl+Z → 복원 ✓. typecheck ✅ test 19/19 ✅ → `PDF편집기-Setup-1.1.2.exe` 바탕화면 ✅.

## 2026-07-08 — v1.1.1: 편집 중 원본 노출 버그

**피드백** (스크린샷 2장 → `docs/feedback-archive/2026-07-08-v1.1.0-edittext-cover/`):
텍스트 수정 객체를 아래로 드래그한 뒤 편집(캐럿)을 켜면 원래 자리 원본 글자가 드러남.

**원인/수정** (`PageCanvas.tsx` redrawOverlay): 편집 중엔 해당 객체를 오버레이에서 통째로 숨기는데
(textarea 가 대신 보이므로), editText 는 cover(원본 가림)까지 숨어버림 → 편집 중에는 **텍스트만 비운 채
cover 는 계속 그리도록** 변경. E2E에 "이동 후 편집 중 원본 가림" 스텝 추가해 확인.

**검증**: typecheck ✅ / build ✅ / E2E ✅ → `PDF편집기-Setup-1.1.1.exe` 바탕화면 ✅.

## 2026-07-08 — v1.1.0: 텍스트 추가 확정(사용자 선언) + 텍스트 수정 Guru 흐름 1차

**버전**: 사용자가 "텍스트 추가는 끝" 선언 → **1.1.0 승격**. 이 릴리스에 텍스트 수정 1차 개편 포함.
이후 텍스트 수정 다듬기는 1.1.1~1.1.n.

**텍스트 수정(Edit Text) Guru 흐름으로 개편** (사용자 구두 피드백):

- **모델**: `EditTextObj`에 `box`(텍스트 상자 — 이동·리사이즈 대상) 추가. `cover`는 원본 가림 전용으로 분리 —
  **드래그로 옮겨도 흰 커버는 원본 자리에 남는다** (이전엔 같이 움직여 원본이 다시 드러났음 — E2E로 발견).
  cover 흰칠 여백을 세로 18%+1.5px 로 확대 (pdf.js 스팬 rect 가 글리프 상단을 1~2px 못 덮는 잔상 — E2E로 발견).
- **흐름**: 도구로 스팬 클릭 → 즉시 객체 생성(히스토리 1단계)+선택+select 도구 복귀. 잡은 채 드래그=이동,
  **이동 없이 놓으면 클릭 지점에 캐럿(|) 인라인 편집** (`caretIndexFor` — 줄/글자폭 실측, 회전·정렬 보정).
  이미 선택된 text/editText 객체도 클릭→놓기로 동일하게 캐럿 편집 진입 (더블클릭 핸들러는 충돌하여 제거).
- **"입력 팝업" 느낌 제거**: 편집 textarea 를 실측 크기(글자 크기만큼)로 고정(기본 rows/cols 크기 버그),
  그림자 제거·1px 테두리·text 는 투명 배경(제자리 편집감). editText 는 원본을 덮어야 해서 흰 배경 유지.
- **editText 에도 8점 핸들** (box 리사이즈, 회전 점은 텍스트 전용 유지).
- **커서 통일** (Guru): select/editText 도구에서 객체·스팬 호버 = `pointer`(👆), 객체를 잡거나 드래그 중 = `move`(✥),
  addText = text. 인터랙션 레이어 호버 히트테스트로 구현.

**E2E 검증** (`e2e/visual-check.cjs` 확장): 호버 pointer ✓ / 드래그 중 move ✓ / 클릭 지점 캐럿(index 3, focused) ✓ /
이동 후 원본 완전 가림 ✓ / 기존 계측(중앙 정렬·세로 정렬) 유지 ✓. typecheck ✅ test 19/19 ✅
→ `PDF편집기-Setup-1.1.0.exe` 바탕화면 ✅.

## 2026-07-08 — v1.0.5: Add Text 서브툴바 Guru 파리티 + Playwright 자가 검증 도입

**피드백** (스크린샷 7장 → `docs/feedback-archive/2026-07-08-v1.0.4-subtoolbar-guru/`):
Add Text 서브툴바가 초라함 — Guru처럼 색 팔레트/배경 팔레트/불투명도(흐리게)/폰트 다수/**세로 정렬**을.
중앙 정렬 미세 오차는 Playwright로 직접 보면서 잡을 것. Ctrl+Z 도 체감상 안 됨.

**Playwright E2E 도입** (`e2e/visual-check.cjs`, devDep `playwright-core`, WSLg `DISPLAY=:0`):
`_electron.launch` → 드롭으로 PDF 열기 → 텍스트 배치/타이핑/선택/핸들 드래그/언두를 스크린샷 + **픽셀 계측**
(오버레이 캔버스 잉크 bbox vs 선택 외곽선 `data-testid="sel-outline"`). 이걸로 아래 버그 3개를 직접 발견함.

**발견·수정한 버그**:

1. **세로 쏠림의 진짜 원인**: 캔버스 렌더가 half-leading 없이 줄박스 맨 위에 글자를 그림 (CSS line-height 와 규칙 다름).
   `draw.ts`에 `(lh-px)/2` 오프셋 추가 → 계측 결과 상하 11.2/11.9px, 좌우 7.0/6.6px 로 균형.
2. **Ctrl+Z 체감 불능**: ① 객체 클릭(선택)만 해도 markHistory 로 무변경 스냅샷이 쌓임 → move/resize/rotate 모두
   **첫 실제 이동 시점**으로 지연(`moved` 플래그). ② 새 텍스트가 "빈 객체 추가"+"텍스트 확정" 2 히스토리 →
   placeholder 는 `addObjectTransient`(히스토리 없음)로 넣고 확정 시 한 번에 `addObject` → **Ctrl+Z 한 번이면 상자째 취소**.
   store 에 `addObjectTransient`/`removeObjectTransient` 추가. E2E로 undo→비움/redo→복원 확인.
3. **레이아웃 점프**: 선택 해제 시 SubToolbar(42px)가 통째로 사라져 문서가 위로 튐 → 기본 상태에서도
   텍스트 서식 바를 상시 표시 (Guru 동일). E2E에서 페이지 rect 고정 확인.

**Guru 파리티 기능** (`SubToolbar.tsx` 전면 재작성 + 모델 확장):

- `TextObj`에 `h`(상자 높이, 0=내용맞춤)·`valign`(top/middle/bottom) 추가. `textContentHeight()` 헬퍼.
- **세로 정렬**: draw/textarea/히트테스트 모두 반영. 상하(n/s) 핸들 = 상자 높이 조절(내용 높이가 하한)로 변경
  (기존 크기 스케일은 모서리 전담). 계측: 늘린 박스 세로 가운데 41.2/41.9px — 정중앙.
- **팔레트 팝오버**(`PaletteControl`): 프리셋 17색(진한 6/파스텔 6/무채색 5) + "없음"(배경) + 직접 선택(＋).
  글자색/배경/도형 선·채우기/연필/형광펜 전부 교체.
- **불투명도**(`OpacityControl`): % 버튼 + 슬라이더 팝오버. 텍스트/editText/도형/이미지/스트로크/링크.
- **폰트 17종**(`FONT_STACKS` 확장, Windows 기본 탑재 위주 + 맑은고딕/바탕/굴림) — 메뉴에서 각 폰트로 미리보기.

**검증**: typecheck ✅ / test 19/19 ✅ / build ✅ / **E2E 시각검증 ✅** → `PDF편집기-Setup-1.0.5.exe` 바탕화면 ✅.

## 2026-07-08 — v1.0.4: 텍스트 상자 중앙 정렬 + 회전 커서 화질

**피드백** (구두): 텍스트가 선택 박스 좌측 상단에 붙어 보임 / 회전 커서가 조잡·저화질.

1. **박스가 글자를 정확히 감싸게** (`core/objects.ts` textBoxRect): 최소 폭 0.1 강제 + 높이 하단 여유분(0.15size) 때문에
   짧은 텍스트일수록 좌상단 고정으로 보였음. w = 실측 폭(w=0일 때만 0.1 폴백), h = 1.25·lines·size 로 —
   시각 여백은 선택 UI 의 TEXT_SEL_PAD(7px)가 상하좌우 균등하게 담당 → 텍스트가 박스 정중앙.
   `draw.ts` boxW 의 0.1W 하한도 제거(1:1 유지). 좌우 핸들·모서리 스케일의 0.1 하한도 "w=0 폴백"으로 변경.
2. **회전 커서 교체** (`ROTATE_CURSOR`): Material refresh(원형 화살표) + 흰 외곽선(paint-order stroke),
   `-webkit-image-set` 1x/2x — SVG 커서가 1배율로만 래스터돼 흐릿하던 문제 해결 (Electron 33/Chromium OK).

**검증**: typecheck ✅ / test 18/18 ✅ / build ✅ → `PDF편집기-Setup-1.0.4.exe` 바탕화면 교체 ✅.

## 2026-07-08 — v1.0.3: 텍스트 추가 디테일 3건 (+버전 정책 정정)

**버전 정정**: 처음에 1.1.0 으로 승격했다가 사용자 규칙 재설명 받고 **1.0.3 으로 정정**.
MINOR는 사용자가 "이 기능 끝, 넘어가자"고 선언할 때만 — CLAUDE.md 버전 정책 갱신함. 1.1.0 산출물 삭제.

**피드백** (구두, 스크린샷 없음): v1.0.2에서 "많이 발전". 디테일 3건.

1. **핸들 점 6→8개** (+회전 1 = 9): 사용자가 처음에 6개로 잘못 말했다고 정정. 변 중간 상하(n/s) 추가 —
   텍스트에서 n/s 는 모서리와 같은 크기 스케일, 사각형류는 높이 조절(반대편 고정).
2. **텍스트 선택 박스 여백** (`TEXT_SEL_PAD=7px`): 외곽선이 글자에 바짝 붙지 않게 상하좌우 균등 여백.
   중심이 안 변하므로 회전 기준도 그대로. 좌우 폭 핸들은 delta 방식으로 바꿔 여백·최소폭에 의한 튐 제거
   (기존 절대좌표 방식은 잡는 순간 +7px 점프). 편집 textarea 패딩도 6/4px로.
3. **회전 손잡이 디테일**: 호버 시 원형 화살표 커서(`ROTATE_CURSOR` — SVG data URI) + "회전" 툴팁 (Guru 동작).

**검증**: typecheck ✅ / test 18/18 ✅ / build ✅ → `PDF편집기-Setup-1.0.3.exe` 바탕화면 교체 ✅.
**다음**: 사용자가 텍스트 추가 확정 선언 → 그때 1.1.0. 이후 다음 기능 다듬기는 1.1.1~1.1.n.

## 2026-07-08 — v1.0.2: 텍스트 도구 UX 재작업 (Guru 파리티 2차)

**피드백** (스크린샷 7장 → `docs/feedback-archive/2026-07-08-v1.0.1-textbox-ux/`):
입력 박스가 조잡함 / 도구가 계속 활성으로 남아 박스가 연달아 생김 / 회전·리사이즈가 안 됨 /
Guru처럼 "점 6개 + 회전 점 1개" 선택 UI를 원함.

**핵심 버그 — 회전·리사이즈가 안 됐던 진짜 이유** (`PageCanvas.tsx`):
선택 오버레이(핸들 포함)가 인터랙션 레이어보다 **DOM 앞의 z-index 없는 형제**라, 핸들이 포인터 이벤트를
전혀 못 받았다 (v1.0.0의 이미지 리사이즈 점도 마찬가지로 죽어 있었음). → 오버레이에 `zIndex: 6`.

**바꾼 것**:

1. **원샷 배치**: 텍스트 추가로 한 번 찍으면 즉시 `select` 도구로 복귀 (Guru 동작).
   주의: store의 `setTool`이 selected를 지우므로 `setSelected`를 반드시 뒤에 호출.
2. **입력 박스 재디자인**: 커서 폭만한 작은 박스로 시작 → `measureTextWidthPx`로 **내용만큼 자람**(wrap off).
   연파랑 테두리(#7aabf0)+글로우, 둥근 모서리, resize 그립 제거. 테두리·패딩만큼 margin을 음수로 당겨
   **확정 후 캔버스에 그려질 글자 위치와 정확히 겹침**(커밋 시 글자 안 튐).
3. **선택 핸들 통일** (`HANDLES` 상수, 파랑 #3b82f6 점 + 흰 테두리):
   - 텍스트: 점 6개(모서리 4=크기 스케일·중심 고정이라 회전 상태에서도 동작, 좌우 중간 2=폭 조절·역회전 판정)
     + 하단 스틱 끝 회전 점.
   - 이미지/도형/링크: 같은 점 6개 (모서리=반대편 고정 리사이즈, 좌우=폭). 기존 단일 점 코드 삭제.
   - 핸들이 스스로 pointer capture → 인터랙션 레이어 경유 안 함. 레이어의 죽은 resize 분기 삭제.
4. editText/note 는 외곽선만 (기존과 동일).

**검증**: typecheck ✅ / test 18/18 ✅ / build ✅ → `PDF편집기-Setup-1.0.2.exe` 바탕화면 교체 ✅.
**다음**: 사용자 테스트 — 원샷 배치·자라는 입력 박스·점 6개 리사이즈·회전 실동작.

## 2026-07-08 — v1.0.1: 첫 설치 테스트 피드백 (페이저·텍스트 추가)

**피드백 전달 방식 변경**: 사용자가 스크린샷 디렉토리 규약을 신설 —
`pdf-editor-screenshots/`(우리 앱 스크린샷 = 피드백), `pdf-guru-screenshots/`(벤치마크 참고).
CLAUDE.md 부팅 프로토콜 4단계를 이 규약으로 갱신함. 처리한 스크린샷은 `docs/feedback-archive/2026-07-08-v1.0.0-pager-addtext/`.

**고친 것**:

1. **텍스트 추가 무반응 버그** (`PageCanvas.tsx`): 클릭 → textarea 생성·autoFocus 직후,
   같은 클릭의 mousedown 기본 동작(포커스 이동)이 textarea를 blur → 빈 텍스트라 즉시 삭제 → "아무 반응 없음"으로 보임.
   `addText`/`editText` 분기에서 `e.preventDefault()`로 해결.
2. **텍스트 상자 기능 확장** (Guru 파리티):
   - `core/objects.ts` TextObj에 `bgColor`(배경색), `rotation`(0..360도, 상자 중심 기준) 추가.
     `textBoxRect()` 신설(줄 수 반영, 선택 외곽선·히트테스트 공용), `hitTest`에 aspect 파라미터(회전 텍스트 역회전 판정),
     `rotateObjectCW`가 rotation을 90도 누적.
   - `editor/draw.ts`: 회전·배경색 렌더(오버레이=내보내기 공유라 저장도 자동 커버), `measureTextWidthPx()` 신설 —
     편집 확정/스타일 변경 시 실측 폭을 `w`에 저장해 그려진 텍스트와 선택 박스·회전 중심을 일치시킴.
   - `PageCanvas.tsx`: 선택 외곽선에 회전 적용 + **하단 스틱·원형 회전 손잡이**(드래그 = 자유 회전, 45° 근처 4도 스냅,
     손잡이에 pointer capture). 편집 textarea에 회전/배경색/정렬/밑줄 반영.
   - `SubToolbar.tsx`: 선택된 텍스트에 정렬 버튼·배경색(+"배경 없음") 추가, addText 기본 설정에도 배경색 추가.
3. **하단 플로팅 페이저** (`FloatingPager.tsx`):
   - 회색 박스 정체 = 구분선의 `width: 1` — MUI sx에서 1은 1px이 아니라 **100%**. 그 탓에 "페이지:"도 세로로 밀려 줄바꿈.
     구분선 제거 + `whiteSpace: nowrap`으로 가로 한 줄 고정.
   - "1/32" 16px·라벨 15px로 확대. `translateX(-50%)` 중앙 정렬이 반픽셀 블러 유발 → `left/right:0 + mx:auto`로 교체.
4. **글씨 깨짐** (`theme.ts`, `Toolbar.tsx`): 폰트 스택을 `'Segoe UI', 'Malgun Gothic', …` 순으로 —
   숫자·영문이 Malgun Gothic으로 그려지면 작은 크기에서 깨져 보임. 툴바 라벨 10→11px.

**검증**: typecheck ✅ / test 18/18 (신규 4: textBoxRect 줄수·회전 히트테스트·rotation 누적) ✅ / build ✅
→ `PDF편집기-Setup-1.0.1.exe` 바탕화면 교체 ✅. **다음**: 사용자 설치 테스트 대기 (특히 텍스트 회전·배경색·저장 결과).

## 2026-07-08 — 프로젝트 신설: PDF Guru 파리티 v1.0.0

**배경**: 사용자가 `file-converter` 방향을 PDF 편집 전용으로 전환하기로 결정.
pdfguru.com 스크린샷 26장을 기준으로 **새 프로젝트로 분리**(사용자 승인)하고 UI를 MUI로 재구축.
스크린샷 원본: `docs/feedback-archive/2026-07-08-pdfguru-benchmark/` (기능·레이아웃의 시각적 SSOT).

**만든 것 (v1.0.0)**:

- **스캐폴드**: electron-vite + React + TS + MUI + zustand. main/preload는 file-converter에서 이식(창 복구·저장 IPC), PDF 열기·인쇄 IPC 추가.
- **코어 모델** `src/core/` (테스트 14개 전부 통과):
  - `objects.ts` — 편집 객체(텍스트/텍스트수정/스트로크/도형/이미지/노트/링크), 정규화 좌표(0..1), 90° 회전 변환, 히트테스트
  - `pages.ts` — 페이지 연산(빈페이지/삭제/복제/회전/이동/가져오기)
  - `history.ts` — 스냅샷 undo/redo (상한 100)
- **PDF 서비스**: `pdf/docs.ts`(pdf.js 렌더·표시크기·Edit Text용 텍스트 스팬 추출), `pdf/save.ts`(pdf-lib: embedPage로 회전 평탄화 → 오버레이 PNG 굽기 → 링크/노트는 실제 PDF 주석)
- **편집기 UI** (PDF Guru 레이아웃):
  - 랜딩(드롭존+진행률 로딩) → 편집기(상단바·메인툴바·컨텍스트 서브툴바·썸네일 사이드바·플로팅 페이저)
  - 도구: 선택(이동/리사이즈/더블클릭 편집), 텍스트 추가, **텍스트 수정(기존 텍스트 자동 인식→덮고 재작성)**, 지우개(흰칠)/그리기 지우개, 형광펜, 연필, 이미지, 스탬프(프리셋 10종+커스텀 날짜/시간/색), 사각형/원/X/체크, 서명(그리기/이미지/타이핑+저장), 노트(스티키), 링크(URL/페이지), 손 도구
  - 페이지 관리 다이얼로그: 새 페이지·삭제·복제·좌/우 회전·앞/뒤 이동·문서 가져오기·전체선택
  - 페이지 레이아웃 메뉴: 현재/전체 페이지 회전
  - 줌(첫 로드 시 화면 맞춤 fit — 사용자 요구 "한 화면에 보이게"), Ctrl+Z/Y·Delete 단축키
- **저장**: 원본 벡터 유지 + 오버레이만 비트맵(180dpi). 인쇄는 임시 PDF→숨김 창 print.
- **검증**: typecheck ✅ / test 14/14 ✅ / build ✅ → `PDF편집기-Setup-1.0.0.exe` 바탕화면 복사 ✅

**설계 결정**: ADR-0001(프로젝트 분리·하네스), ADR-0002(편집기 아키텍처) 참조.

**다음(사용자 확인 대기)**: 설치 테스트 → 스크린샷 피드백. 알려진 한계는 `todo.md` P1/P2 참조.
