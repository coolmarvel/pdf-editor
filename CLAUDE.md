# CLAUDE.md — PDF 편집기 작업 가이드

이 파일은 **세션이 바뀌어도 맥락을 즉시 복구**하기 위한 진입점이다. Claude Code는 세션 시작 시
이 파일을 자동으로 읽는다. 아래 "부팅 프로토콜"이 나머지 상태 파일까지 로드하도록 지시한다.

## 🟢 세션 시작 부팅 프로토콜 (매 세션 첫 작업 전에 반드시 수행)

새 세션에서 이 프로젝트 작업을 시작하면, **코드를 건드리기 전에** 순서대로:

1. `docs/session-log.md` 읽기 — 마지막으로 무엇을 했고 지금 어디쯤인지 (**진행 이력 SSOT**, git history 대용)
2. `docs/todo.md` 읽기 — 남은 일 (P1~P4)
3. 최근 `docs/plans/*.md` 1개 읽기 — 진행 중 기능의 설계 의도
4. **스크린샷 피드백 확인** (2026-07-08 사용자가 디렉토리 규약 신설):
   - `pdf-editor-screenshots/` — **우리 앱** 스크린샷 = 사용자의 새(미처리) 피드백. Read 로 보고 요구사항으로 해석.
   - `pdf-guru-screenshots/` — 벤치마킹 대상 pdfguru.com 스크린샷 = 구현 목표의 시각 참고.
   - 반영을 끝내면 두 디렉토리의 png 를 `docs/feedback-archive/YYYY-MM-DD-*/` 로 옮겨 비운다
     → 디렉토리 안의 png = 항상 "아직 안 본 새 피드백". (루트에 `스크린샷 *.png` 가 있으면 그것도 동일하게 취급)

이 4단계를 끝내면 이전 세션의 맥락을 완전히 복구한 상태가 된다. 그 다음 작업을 시작한다.

## 🔴 변경 후 자동 규칙 (사용자가 매번 요청하지 않아도 수행)

1. 코드를 바꾸면 **같은 턴에** `docs/session-log.md`(최상단 블록 추가)·`docs/todo.md`(+릴리스급이면 `changelog.md`)를 갱신한다. 문서 작성 규칙은 `docs/writing-guide.md`.
2. `npm run typecheck && npm test && npm run build` 로 깨지지 않았는지 확인한다. **검증 없이 인스톨러를 굽지 않는다.**
3. **버전을 판단해 올린다**(아래 "버전 정책"). `package.json`의 `version` 수정.
4. **인스톨러를 바로 굽고 바탕화면에 반영**(사용자 지시: "테스트·검증 후 계속 구워줘"):
   ```bash
   npm run dist:win
   V=$(node -p "require('./package.json').version")
   rm -f /mnt/c/Users/user/Desktop/PDF편집기-Setup-*.exe   # 옛 버전 정리
   cp "release/PDF편집기-Setup-$V.exe" "/mnt/c/Users/user/Desktop/"
   ```
   (WSL에 wine 있음. 데스크톱 = `/mnt/c/Users/user/Desktop`. 파일명은 version을 따라감.)
5. 사용자에게 "vX.Y.Z 인스톨러를 바탕화면에 구웠으니 설치·테스트 후 스크린샷 달라"고 알린다.

## 버전 정책 (semver `MAJOR.MINOR.PATCH` — 2026-07-08 사용자가 규칙 확정)

**MINOR 승격은 사용자만 선언한다.** Claude 가 판단해서 올리지 않는다 (한 번 성급하게 1.1.0 올렸다가 1.0.3 으로 정정한 이력 있음).

- **PATCH**(1.Y.**n**) — **기본값**. 지금 다듬는 중인 기능의 수정 하나 반영할 때마다 +1.
- **MINOR**(1.**Y**.0) — 사용자가 **"이 기능은 더 수정할 게 없다, 넘어가자"라고 선언한 그 시점**에만.
  예: 텍스트 추가를 1.0.x 로 다듬다가 → 사용자 확정 → **1.1.0**. 다음 기능(텍스트 수정 등)을 다듬으면
  1.1.1~1.1.n → 그 기능도 확정되면 **1.2.0** → 반복.
- **MAJOR**(**X**.0.0) — 대규모 재설계/호환 깨짐. 사용자와 상의.
- 매번 `package.json` version 올리고 → 인스톨러 파일명·changelog·session-log에 반영.

## 이 프로젝트가 뭔가

**pdfguru.com 을 벤치마킹한 오프라인 데스크톱 PDF 편집기** (Electron + React + MUI).
`file-converter` 프로젝트(파일 변환기)에서 방향을 전환해 **PDF 편집 전용으로 신설**한 프로젝트다 (2026-07-08).
벤치마킹 기준 스크린샷 26장은 `docs/feedback-archive/2026-07-08-pdfguru-benchmark/` 에 있다 — **UI/기능의 시각적 SSOT**.
사용자(이성현)가 직접 인스톨러로 설치해서 테스트한다. 상세 스택/구조는 `README.md` 참고.

## 개발자(사용자)와의 작업 방식 — 중요

- 사용자는 **스크린샷을 프로젝트 최상단(루트)에 복사**해서 요구사항/수정사항을 전달한다.
- 작업 후 **검증(typecheck+test+build)을 통과한 뒤에만** 인스톨러를 바탕화면에 굽는다.
- 사용자는 그 인스톨러로 직접 설치·실행해서 테스트하고 다시 스크린샷으로 피드백을 준다.
- 그래서 **모든 진행 사항은 `docs/` 에 파일로 기록**한다. 세션이 끊겨도 이어서 작업할 수 있게.
- 완료 이력의 SSOT는 `docs/session-log.md`. (2026-07-08부터 git 에 올리지만 **커밋/푸시는 사용자가 직접** —
  Claude 는 요청 시 커밋 메시지만 작성. git history 를 이력 SSOT 로 삼지 않는다.)

## 문서 인덱스 (docs/)

문서 규약은 자매 프로젝트 `file-converter`(← `cm_groupware`·`pt_schedule`) 표준을 이식한 것.

| 파일 | 용도 |
|---|---|
| `docs/writing-guide.md` | **문서 지배 규칙** (SSOT·frontmatter·코드 1:1 대조). 문서 쓰기 전 필독 |
| `docs/session-log.md` | 세션별 진행 이력. **"언제 무슨 일" SSOT** (최신이 위) |
| `docs/todo.md` | 미해결·향후 작업만 (P1~P4). 완료분은 session-log로 |
| `docs/changelog.md` | 인스톨러 릴리스 단위 사람용 요약 |
| `docs/adr/*.md` | 구조적 결정 기록. 왜 이렇게 했는가 |
| `docs/plans/*.md` | 기능 단위 구현 계획 (`YYYY-MM-DD-*`) |
| `docs/guides/*.md` | 기능별 현재 동작·코드 위치 |
| `docs/feedback-archive/` | 처리 완료한 사용자 스크린샷 피드백 보관소 |

## 자주 쓰는 명령

```bash
npm run dev          # 개발 모드 (HMR)
npm run typecheck    # 타입 검사 (node + web)
npm test             # core 순수 로직 테스트
npm run dist:win     # 인스톨러 → release/PDF편집기-Setup-<version>.exe (Wine 필요)
npm run pack:win     # Wine 없이 폴더 확인용 → release/win-unpacked/

# Playwright 시각 자가검증 (WSLg 디스플레이 필요; npm run build 후):
node e2e/visual-check.cjs   # Electron 실행→PDF 드롭→텍스트 배치/선택/언두 스크린샷 + 중앙정렬 픽셀 계측
# 스크린샷은 e2e/ 에 떨어짐(E2E_OUT 로 변경 가능). Read 로 직접 보고 판단할 것. *.png 는 커밋/보관 대상 아님
```

## 코드 지도 (수정 시 어디를 보나)

- **순수 로직(테스트 대상)**: `src/core/` — `objects.ts`(편집 객체 모델·회전·히트테스트), `pages.ts`(페이지 연산), `history.ts`(undo/redo)
- **PDF 서비스**: `src/renderer/src/pdf/` — `docs.ts`(pdf.js 렌더·텍스트 추출·소스 문서 저장소), `save.ts`(pdf-lib 저장: 평탄화+오버레이 굽기+링크/노트 주석)
- **객체 렌더러(오버레이=내보내기 공유)**: `src/renderer/src/editor/draw.ts`, 스탬프/서명 비트맵: `editor/stamp.ts`
- **전역 상태**: `src/renderer/src/store/editor.ts` (zustand — 문서·객체·히스토리·도구 설정)
- **화면**: `src/renderer/src/components/` — `Editor.tsx`(셸·저장·인쇄·단축키), `Toolbar.tsx`/`SubToolbar.tsx`, `PageCanvas.tsx`(**도구 인터랙션 전부**), `PagesView.tsx`(스크롤·줌·fit), `ThumbnailSidebar`, `FloatingPager`, 다이얼로그: `ManagePagesDialog`/`StampDialog`/`SignDialog`
- **Electron**: `src/main/index.ts`(창·파일 열기/저장·인쇄 IPC), `src/preload/index.ts`
- **설치 브랜딩**: `build/` (file-converter에서 이식; PDF 전용 아이콘 교체는 todo)

**새 편집 도구 추가** = ① `core/objects.ts` 객체 타입 ② `editor/draw.ts` 렌더 ③ `PageCanvas.tsx` 인터랙션 ④ `Toolbar/SubToolbar` 버튼·설정 ⑤ 저장이 오버레이 굽기로 커버 안 되면 `pdf/save.ts`.
