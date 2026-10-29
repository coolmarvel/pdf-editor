# AGENTS.md - pdf-editor

모든 AI 코딩 에이전트(Codex, Claude Code, Cursor 등)의 도구 중립 진입점. 프로젝트 사실·명령·코드 지도·버전 정책·인스톨러 절차는 `CLAUDE.md`(Claude 는 자동 로드, 다른 도구는 먼저 열어 읽는다). 운영 규약은 `docs/agent-workflow.md`, 업무 불변조건은 `docs/domain-contract.md`. 이 파일을 자동 로드하지 않는 에이전트에 위임하면 리드가 이 내용을 직접 전달한다. `.claude/` 설정·훅은 Claude Code 에서만 동작한다고 가정한다.

Electron 데스크톱 PDF 편집기. 성숙했고 거의 동결에 가깝다(v1.8.0 에서 엔진만 Rust/wasm 으로 교체). 새 기능보다 정합성·회귀 방지가 우선이다.

## 작업 전에 읽는다

`docs/session-log.md` 최상단 1~2 블록 -> `docs/todo.md` P1 -> 스크린샷 피드백(`pdf-editor-screenshots/`·`pdf-guru-screenshots/`·루트 `스크린샷 *.png`, 있으면 반영 뒤 `docs/feedback-archive/YYYY-MM-DD-*/` 로 이동) -> 필요할 때만 관련 ADR·가이드. 전체 로그는 검색으로. `git status` 에 모르는 변경이 있으면 session-log 와 대조한다(다른 세션·에이전트의 작업일 수 있다, 건드리지 않는다).

## 절대 규칙

1. **같은 작업 단위에 문서 갱신**: `docs/session-log.md` 최상단 블록 + `docs/todo.md`(+릴리스급이면 `docs/changelog.md`), 규칙은 `docs/writing-guide.md`. 팀 작업이면 리드만 갱신하고 worker 는 결과를 돌려준다.
2. **검증 없이 완료라 하지 않는다**: `npm run typecheck && npm test && npm run build` + 엔진·저장 경로를 건드렸으면 `xvfb-run -a node e2e/engine-smoke.cjs`(UI 변경은 `e2e/*-check.cjs`). 실행하지 않은 검사는 미실행으로 보고하고 통과로 쓰지 않는다. 검증 없이 인스톨러를 굽지 않는다.
3. **커밋·push·인스톨러는 요청이 있을 때만**: 커밋과 push 는 사용자가 직접 하거나 요청할 때만(이 저장소는 성긴 단위 커밋, 요청 없으면 커밋 메시지만 제안), `npm run dist:*` 도 같다. 버전은 PATCH 가 기본이고 MINOR 승격은 사용자만 선언한다(`CLAUDE.md` 버전 정책).
4. **`.env`(`.env.example`·`.env.local` 제외) 직접 수정 금지**, **`git add -A` / `git add .` 금지**(파일 지정).
5. **설계와 다르게 가려면 ADR 먼저**(`docs/adr/`). 엔진은 ADR-0003.
6. **`src/renderer/src/engine/pkg/` 는 `~/pdf-editor-live/packages/engine/pkg` 의 사본**이다. 손으로 고치지 않고, 여기서 cargo/wasm-pack 을 돌리지 않는다. 갱신은 그 폴더의 `README.md` 절차(출처 커밋·sha256 기록). pdf.js·pdf-lib 는 다시 넣지 않는다.
7. **공유 에디터 파일을 고치면 웹 쪽도**: `src/core`·`src/renderer` 의 에디터 코드는 `~/pdf-editor-live/packages/editor` 와 수동 동기화다(`docs/todo.md` P1).
8. **UI 문구에 줄표(em-dash, en-dash) 금지**, 새로 쓰는 문서·주석·커밋 메시지도 `docs/writing-guide.md` 기호 규칙(2026-10-29부터)을 따른다.

커밋 메시지(요청 시): `<type>: <한국어 제목>` + 본문 + 도구가 지정한 `Co-Authored-By` 트레일러.
