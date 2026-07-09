---
title: 배포 패키징 가이드
created: 2026-07-09
updated: 2026-07-09
domain: packaging
---

# 배포 패키징 가이드

## 개요

Windows 와 macOS 설치 파일을 만드는 현재 규칙의 SSOT다. 여러 에이전트가 Windows/맥에서 번갈아 작업해도
패키징 설정을 임의로 바꾸지 않도록, 이 문서를 먼저 확인한다.

## 공통 규칙

- 릴리스 전 검증은 `npm run typecheck && npm test && npm run build`.
- 릴리스급 변경은 `package.json`/`package-lock.json` version, `docs/session-log.md`, `docs/todo.md`,
  `docs/changelog.md`를 같은 턴에 갱신한다.
- MINOR 승격은 사용자 선언이 있을 때만 한다. 일반 수정은 PATCH.
- 개발 기준 런타임은 Node 24 LTS 계열. npm 12의 install-script 승인 기능 때문에 `package.json`의
  `allowScripts`에 `esbuild` 두 버전을 명시해 둔다.

## Windows

- 명령: `npm run dist:win`
- 산출물: `release/PDF편집기-Setup-<version>.exe`
- 설정: `package.json`의 `build.win`/`build.nsis`
- App ID: `seonghyunlee.pdfeditor` (`package.json`의 전역 `build.appId`)
- Windows 표시 이름과 설치 바로가기 이름은 한글 `PDF 편집기`를 유지한다.

2026-07-09 이전 Windows 설치본은 예전 appId(`xyz.chungmu.pdfeditor`)로 만들어졌을 수 있다. 새 인스톨러는
`seonghyunlee.pdfeditor`를 쓰므로, 첫 Windows 실물 테스트에서 기존 설치본 업그레이드/제거 동작을 확인한다.

## macOS

- 명령: `npm run dist:mac`
- 산출물: `release/PDF편집기-<version>-arm64.dmg`
- 구현: `scripts/dist-mac.cjs`
- Bundle ID: `seonghyunlee.pdfeditor`

macOS 번들의 내부 이름은 반드시 ASCII `PDFEditor`를 유지한다.

- `CFBundleName`: `PDFEditor`
- `CFBundleExecutable`: `PDFEditor`
- Helper app 이름: `PDFEditor Helper...`
- 외부 `.app` 폴더명: `PDF 편집기.app`
- Finder 표시 이름: `CFBundleDisplayName = PDF 편집기`

2026-07-09 사고: 내부 제품명/실행 파일명/helper 이름까지 한글 `PDF 편집기`로 만들면 macOS에서
시작 즉시 `EXC_BREAKPOINT(SIGTRAP)` / `CrBrowserMain` / V8 스택으로 크래시했다. `app.asar`는 정상이고,
내부 이름을 `PDFEditor`로 통일한 번들은 정상 실행됐다. 외부 `.app` 폴더명만 한글인 것은 안전하다.

Developer ID 인증서가 아직 없으므로 `scripts/dist-mac.cjs`는 DMG 생성 전 ad-hoc `codesign --sign -`으로
내부 프레임워크 서명을 정리한다. 정식 배포 전에는 `Developer ID Application` 인증서와 notarization을 추가한다.

## 관련 코드

- `package.json`: npm scripts, electron-builder 기본 설정
- `scripts/dist-mac.cjs`: macOS DMG 생성 후처리
- `build/icon.png`, `build/icon.ico`: 앱/설치 아이콘
