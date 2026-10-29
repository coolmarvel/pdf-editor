---
title: 에이전트 작업 계약 (단일 기본 · 필요할 때 팀)
created: 2026-10-29
updated: 2026-10-29
domain: development
---

# 에이전트 작업 계약

에이전트(Claude Code, Codex 등)가 이 저장소에서 일하는 방식의 SSOT. project-seed `guides/harness-engineering.md`(2026-10-27)를 이 프로젝트에 맞게 옮겼고, 자매 저장소 `~/pdf-editor-live/docs/agent-workflow.md` 와 같은 구조다. 이 문서는 운영 규약이며 실행기(runner)나 예산 차단이 설치됐다는 뜻이 아니다. 실제로 강제되는 것은 아래 표의 "Claude 훅" 행뿐이다.

## 실제 적용 상태

| 항목                  | 값                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 운영 모드             | single(기본). 이 저장소는 거의 동결이라 팀은 독립 작업 병렬화나 독립 리뷰의 이득이 조율 비용보다 클 때만                                                                                                                         |
| 실행 방식             | 대화형. 무인 실행기 없음, 예산·호출 수 자동 차단 없음                                                                                                                                                                            |
| 빠른 검증 (cwd 루트)  | `npm run typecheck` · `npm test`(`test/*.test.ts`, 순수 로직 `src/core`)                                                                                                                                                         |
| 통합 검증 (cwd 루트)  | `npm run typecheck && npm test && npm run build` + 엔진·저장·열기 경로는 `xvfb-run -a node e2e/engine-smoke.cjs`(산출물 `e2e/.engine/`, `pdfinfo`·`pdffonts`·`pdftoppm` 필요). UI 변경은 `e2e/{visual,search,pages,draft}-check.cjs` |
| 릴리스 검증           | `npm run dist:win`/`dist:mac` 은 사용자가 요청할 때만. 인스톨러 전에 통합 검증이 통과여야 하며, 설치 테스트는 사용자가 한다(`CLAUDE.md`)                                                                                         |
| 테스트 데이터 격리    | e2e 픽스처는 `e2e/minipdf.cjs` 합성 PDF. 실문서 `~/VPWinGate_Manual.pdf` 는 있을 때만 쓰고(저장소 밖) 없으면 건너뛴다. 사용자 파일을 고치지 않는다                                                                               |
| 커밋 / 푸시           | 사용자가 직접 하거나 요청할 때만. push 와 인스톨러 굽기도 요청이 있을 때만                                                                                                                                                      |
| Claude 훅             | `scripts/hooks/`: `env-guard.sh`(.env 편집 차단, `.env.example`·`.env.local` 허용) · `git-add-guard.sh`(`git add -A/--all/.`·비밀 파일 staging 차단). 입력은 stdin JSON(`read-input.cjs`), 회귀 검사 `bash scripts/hooks/test-guards.sh`. 포맷 훅은 없다(저장소에 Prettier 설정이 없음) |
| 다른 도구의 보호 장치 | 미확인. Claude 훅은 Codex 등에 적용되지 않는다. 그 도구는 `AGENTS.md` 규칙을 지시로만 따른다                                                                                                                                     |
| usage 기록            | 도구가 보여 준 값만. 못 얻은 값은 unknown(0 아님)                                                                                                                                                                                |

## 단일 모드 (기본)

루프: 요청과 근거 확인 -> 구현 -> 관련 검증 -> 기록(session-log 최상단 블록 + todo). 작은 작업에 작업 카드·결과 JSON·리뷰 에이전트를 따로 만들지 않는다.

1. 부팅은 `CLAUDE.md` 순서대로(session-log 최상단 1~2 블록, todo P1, 스크린샷 피드백). 전체 로그는 필요할 때 검색한다.
2. 결정적 명령으로 확인할 수 있는 것은 모델 추론 전에 명령으로 확인한다.
3. 같은 원인으로 2번 실패하면 재시도 전에 원인과 빠진 근거를 정리한다. 무한 재시도·무조건 상위 모델 전환 금지.
4. 이전 revision 의 검증 결과는 현재 revision 의 통과 증거가 아니다. 실행하지 않은 검사는 "미실행"으로 적고 통과로 쓰지 않는다.
5. 엔진 `pkg/` 사본은 읽기 전용이다. 엔진 동작을 바꿔야 하면 `~/pdf-editor-live/packages/engine` 에서 고친 뒤 사본을 다시 복사한다(`src/renderer/src/engine/pkg/README.md`).

## 팀 모드 (선택)

이 프로젝트에서 실제로 쓴 형태: 2026-10-29 v1.8.0 엔진 이식을 모노레포 쪽 엔진 작업과 병렬로 진행(그 저장소가 엔진 소스를 고치는 동안 여기서는 cargo 를 돌리지 않고 리드가 최종 `pkg` 를 복사).

- **리드만** `docs/session-log.md`·`docs/todo.md`·`docs/changelog.md`·버전(`package.json`)·공통 설정(`.claude/`, `CLAUDE.md`, `AGENTS.md`)을 고친다. worker 는 변경 파일·검사 명령과 종료 코드·미검증 항목·남은 위험을 결과로 돌려준다.
- 한 worker 에 한 결과물과 수정 경로를 준다. 파일 소유권이 겹치면 직렬로 돌린다. 예: `store/editor.ts`·`PageCanvas.tsx` 는 한 worker 만, `engine/pkg/` 는 아무도 고치지 않는다.
- Electron e2e(`xvfb-run`)는 한 번에 하나만 돌린다(Xvfb 디스플레이·`e2e/.engine/` 산출물 공유). 병렬 구현에는 worktree 를 쓸 수 있다.
- 리뷰 worker 는 구현자의 결론이 아니라 수용 기준과 실제 diff 에서 출발한다. 모델 간 다수결로 정답을 정하지 않는다.
- 모드를 바꿀 때 기준 commit, 미커밋 변경, 완료·미완료 범위, 검증 상태, 파일 소유권을 넘긴다. 같은 작업을 단일 에이전트와 worker 가 동시에 구현하지 않는다.

위임할 때의 최소 작업 카드(복잡한 작업만, 파일로 만들 의무 없음): 목표 · 기준 revision · 읽을 것 · 수정 허용 경로 · 범위 밖 · 수용 기준(`docs/domain-contract.md` 규칙 ID) · 검사 명령 · 중단 조건(권한 부족, 근거 없음, 2회 동일 실패).

## 완료 판정

수용 기준 충족 + 통합 상태에서의 검증 증거가 있을 때만 완료다. timeout, 환경 오류(WSLg·Xvfb 없음, 외부 도구 없음)로 못 돌린 검사는 완료가 아니며 미실행·실패와 구분해 적는다. 기대값을 바꿔 테스트를 통과시켰다면 그 근거(업무 규칙 변경, 엔진 출력 표현 변경 등)를 session-log 에 남긴다.

## 서브에이전트 모델

지정하지 않으면 메인 모델을 물려받는다. 가벼운 읽기·탐색·문서 작업은 `model: sonnet`(또는 `haiku`)을 명시하고, 엔진 이식처럼 판단이 무거운 일만 메인 모델. 기본값을 바꾸려면 `CLAUDE_CODE_SUBAGENT_MODEL`.
