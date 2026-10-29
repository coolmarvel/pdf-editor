---
title: 도메인 판정 계약 (업무 불변조건 · 근거 · 검사 경로)
created: 2026-10-29
updated: 2026-10-29
domain: development
---

# 도메인 판정 계약

"무엇이 올바른 결과인가"를 규칙 ID 로 모은 색인. 규칙의 원문 SSOT 는 출처 열의 ADR·가이드·코드이고, 이 문서는 규칙과 검사를 잇는 연결표다(같은 사실을 두 번 쓰지 않는다). 확인자는 사용자(이성현) 1인. 테스트가 통과해도 기대값 자체가 옳다는 증거는 아니다. 기대값을 바꾸려면 규칙 변경으로 session-log 에 이유를 남기고 여기 상태를 고친다. 자매 저장소 웹 버전의 같은 이름 문서는 서버 규칙이 많아 이 표와 겹치는 것은 PDF 규칙뿐이다.

상태: confirmed(사용자 결정 또는 ADR accepted) · assumed(코드로 확인한 현재 동작, 사용자 확인 전) · unknown(결정 전).

## 규칙

| ID     | 불변조건                                                                                                                                                                              | 출처                                         | 상태      | 검사 경로                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| PDF-01 | 열기·렌더·텍스트 스팬·저장은 모두 로컬 앱 안에서만 처리한다. 네트워크로 PDF 를 보내지 않는다(CSP `connect-src 'self' data: blob:`)                                                      | ADR-0003 결정 6, `CLAUDE.md`                 | confirmed | `engine-smoke.cjs` 콘솔 오류 0 · 수동 확인(네트워크 차단 검사는 없음)                                     |
| PDF-02 | 엔진은 Rust/wasm 하나뿐이다. pdf.js·pdf-lib 를 의존성·코드에 다시 넣지 않는다. `engine/pkg/` 는 `pdf-editor-live` 사본이며 손으로 고치지 않는다                                       | ADR-0003, 사용자 지시 2026-10-29             | confirmed | `npm ls pdfjs-dist pdf-lib` 비어 있음 · `engine/pkg/README.md` 해시와 사본 대조(수동)                     |
| PDF-03 | 저장은 원본 페이지를 복사해 서체·주석(링크 등)을 그대로 남긴다. 손댄 페이지도 같다. 객체는 오버레이 PNG 로, 링크/노트는 주석으로 얹는다                                                 | ADR-0003 결정 3·결과                         | confirmed | `engine-smoke.cjs`(악보 pdffonts 6종 유지, 원문 텍스트 유지, Link/Text 주석, 쪽 수, `pdftoppm` 오류 없음) |
| PDF-04 | 저장한 PDF 의 쪽 수·회전은 편집 결과와 같다(회전은 엔진 `rotation` 명세). 큰 문서가 공유 서체 중복으로 불어나지 않는다(예: 30쪽 한글 매뉴얼 5.9MB -> 2.2MB)                              | session-log 2026-10-13·2026-10-29            | confirmed | `engine-smoke.cjs`(저장 4쪽·3쪽 가로·30쪽 크기) · 회전 4방향 실물 확인은 todo P1 미완                    |
| PDF-05 | 엔진 워커가 죽으면 보관한 바이트로 등록 문서를 다시 연다. 10초 안 3회를 넘으면 다시 열지 않고 렌더 오류로 남긴다                                                                       | `pdf/registry.ts`(`RESET_WINDOW_MS`·`RESET_LIMIT`) | assumed   | 자동 검사 없음(트랩 재현 e2e 미작성). 웹 쪽 `engine-recovery.spec` 이 같은 계약                           |
| EDT-01 | 페이지 연산(빈 페이지 삽입·삭제·복제·회전)은 순수 로직이다. 마지막 한 장은 지울 수 없다. undo/redo 는 왕복이 보존된다                                                                 | `src/core/pages.ts`·`history.ts`             | confirmed | `test/pages.test.ts` · `test/history.test.ts` · `test/objects.test.ts`                                    |
| EDT-02 | 임시 저장(draft)은 페이지가 참조하는 소스 문서만 담고(빈 페이지 제외, 중복 제거), 복원 뒤 새 문서 id 가 기존 `doc-N` 과 겹치지 않는다                                                   | `src/core/draft.ts`                          | assumed   | `test/draft.test.ts`. 복원 전체 흐름의 e2e 는 없음(`e2e/draft-check.cjs` 는 레이아웃 검사)                |
| EDT-03 | 텍스트 수정은 흰 덮기 + 새 글자(오버레이)다. 원문 삭제·원본 서체 이어쓰기는 이 앱에 없다(웹과 다름). 바꾸려면 ADR-0003 개정                                                            | ADR-0003 결정 4, todo P1                     | confirmed | `engine-smoke.cjs`(텍스트 수정 항목) · `visual-check.cjs` 육안                                            |
| VER-01 | 버전은 PATCH 가 기본, MINOR 승격은 사용자만 선언, MAJOR 는 상의. 모노레포 `apps/desktop` 2.0.0 과 appId 가 같아 이 저장소는 2.x 로 가지 않는다                                         | `CLAUDE.md` 버전 정책, session-log 2026-10-29 | confirmed | 자동 검사 없음(`package.json` version 은 사람이 확인)                                                     |
| REL-01 | 인스톨러·DMG 는 typecheck+test+build 통과 뒤에만, 사용자가 요청할 때만 굽는다                                                                                                         | `CLAUDE.md` 변경 후 규칙, `guides/packaging.md` | confirmed | 절차 규칙(자동 검사 없음)                                                                                 |
| UI-01  | UI 문구에 줄표(em-dash·en-dash) 금지. 디자인 토큰은 웹과 공유(`classic/tokens.ts`), 공유 파일을 고치면 양쪽 모두                                                                       | 사용자 규칙 2026-10-13(웹 `DESIGN.md` §3), 웹 `docs/guides/editor-sync.md` | confirmed | 수동(자동 검사 없음)                                                                                      |

## 기준 데이터

- 합성 PDF: `e2e/minipdf.cjs`(의존성 없는 Helvetica 텍스트 PDF 작성기). 악보 샘플(`Goepel Feel #7`)과 `~/VPWinGate_Manual.pdf`(30쪽 한글)는 저장소 밖 실문서로, 없으면 `engine-smoke.cjs` 가 건너뛴다.
- 비어 있는 것: 비내장 한글 서체 PDF, 스캔본, 양식, 암호 PDF 의 고정 corpus 와 저장 후 재열기 기대값(todo P1 엔진 후속 ④). 실패한 실제 사례는 비식별화해 `e2e/` 픽스처로 옮기고 여기 사례로 남긴다.
