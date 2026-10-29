# /release-check - 릴리스(push·인스톨러) 전 점검 (pdf-editor)

push 나 인스톨러 굽기 직전에 실행한다. 전부 통과해야 진행을 권한다.

## 점검 항목

1. **검증 명령 전체 실행**(결과를 그대로 보고, 실패를 숨기지 않는다): `npm run typecheck && npm test && npm run build` -> `xvfb-run -a node e2e/engine-smoke.cjs`
   (+ 바꾼 영역의 `e2e/*-check.cjs`). 실행하지 않은 검사는 미실행으로 적는다.
2. **버전 정합**: `package.json` version · `docs/changelog.md` · 인스톨러 파일명이 같은 버전인가(CLAUDE.md 버전 정책). appId 는 그대로인가.
3. **엔진 사본**: `src/renderer/src/engine/pkg/` 를 손으로 고치지 않았는가. 모노레포 엔진이 바뀌었으면 재복사하고 README 의 출처 커밋·wasm sha256 을 갱신했는가.
4. **pdf.js·pdf-lib 재유입 없음**: `grep -rn "pdfjs\|pdf-lib\|pdf\.worker" src test e2e scripts package.json` 가 비어 있는가.
5. **문서**: `docs/session-log.md` 최상단 블록 · `docs/todo.md` · `docs/changelog.md` 가 이번 변경을 반영하는가.
6. **민감 파일**: 커밋·산출물에 `.env`·서명 이미지·사용자 PDF 가 섞이지 않았는가.
7. **인스톨러**: 사용자가 요청했을 때만 굽는다(`npm run dist:win`). 굽고 나면 바탕화면 복사·이전 버전 정리.

## 출력 형식

항목별 통과/실패/해당 없음과 근거(명령 출력 요약, 파일 경로). 실패가 하나라도 있으면 진행 보류를 권고한다.
