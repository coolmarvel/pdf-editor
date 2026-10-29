---
title: ADR-0003 PDF 엔진을 Rust/WebAssembly 로 교체 (pdf.js·pdf-lib 제거)
created: 2026-10-29
status: accepted
---

# ADR-0003: PDF 엔진을 Rust/WebAssembly 로 교체 (pdf.js·pdf-lib 제거)

## 상태

Accepted (2026-10-29, v1.8.0). 사용자 요청: "rust engine 부분만 적용" + "pdf-lib·pdf.js 는 전혀 쓰지 않는다".

## 맥락

- 웹 버전(`~/pdf-editor-live`)은 2026-10-12~13 에 PDF 엔진을 Rust 크레이트 `pdf-engine`(hayro 래스터 + lopdf 문서 모델, wasm-bindgen, Web Worker)으로 바꾸고 pdf.js·pdf-lib 를 지웠다(그 저장소 ADR-0003). 저장 크기 폭증(공유 서체가 페이지마다 복사)도 엔진의 원본 문서당 복사기로 구조적으로 풀었다.
- 모노레포에는 같은 에디터를 띄우는 `apps/desktop`(2.0.0)도 있지만 사용자는 이 저장소의 v1.7.2 UI·스토어·객체 모델·동작은 그대로 두고 **엔진만** 바꾸기를 원했다.

## 결정

1. wasm-pack 산출물을 `src/renderer/src/engine/pkg/` 에 **사본으로** 둔다(이 저장소에는 Rust 툴체인이 없다). 출처·해시·갱신 절차는 그 폴더 `README.md`.
2. 런타임은 모노레포의 워커/클라이언트를 데스크톱 스타일로 옮긴 부분집합: `engine/{worker,client,types}.ts`. 연산은 `open/close/pageCount/pageSize/render/pageTextSpans/setFallbackFont/buildDocument/version` 만.
3. `pdf/registry.ts`(바이트 + 엔진 문서 id, 워커 트랩 시 다시 열기) · `pdf/docs.ts`(표시 크기·캔버스 렌더·텍스트 스팬, 공개 API 는 v1.7.2 와 같음) · `pdf/save.ts`(엔진 `build_document`: 페이지 `doc/page/rotation` + 전면 `overlay` PNG + `links`/`notes`) · `pdf/imageToPdf.ts`(빈 페이지 + `under` 이미지).
4. 모노레포의 텍스트 수정 내부(원문 삭제 편집본 `page_erase_text`, 원본 서체 FontFace, 벡터 글자·경로 `items`, 서체 단계)는 **가져오지 않는다**. 텍스트 수정은 v1.7.2 처럼 흰 덮기 + 새 글자(오버레이 PNG)이고, 스팬만 엔진에서 받는다.
5. 대체 서체(나눔고딕 TTF, OFL)를 `assets/fonts/` 에 번들하고 Vite `?url` 자산으로 가져와 첫 문서 열 때 등록한다(웹은 `/fonts/...` 를 fetch 하지만 Electron `file://` 에선 상대 자산 URL 이 안전하다).
6. CSP 에 `'wasm-unsafe-eval'`·`connect-src 'self' data: blob:`, electron-vite `renderer.worker.format = 'es'`. 난독화는 엔진 워커 JS 도 같은 설정으로(엔진 본체는 .wasm).
7. `pdfjs-dist`·`pdf-lib` 의존성 제거. e2e 픽스처는 `e2e/minipdf.cjs`(의존성 없는 최소 PDF 작성기)로.

## 근거

- 웹과 같은 엔진 바이트를 쓰면 렌더·저장 결과가 두 앱에서 같고, 저장 크기 문제(공유 서체 중복)가 사라진다.
- 벡터 객체 쓰기·편집본을 함께 가져오면 객체 모델·저장 경로 대부분을 바꿔야 해 "엔진만" 요구를 넘는다. 오버레이 PNG 는 v1.7.2 결과와 같은 모양을 보장한다.
- 대안: `apps/desktop` 2.0.0 으로 갈아타기 — 같은 appId 의 다른 제품이라 사용자 요구(1.x UI 유지)와 다르다.

## 결과

- 긍정: pdf.js 메인/워커·pdf-lib 번들이 빠지고 엔진 wasm(5.3MB, 문서를 열 때 워커가 받는다)·나눔고딕 TTF(2.4MB)가 들어온다. 원본 페이지의 주석·서체는 페이지 복사로 그대로 남는다(v1.7.2 의 embedPage 평탄화는 손댄 페이지의 링크를 잃었다).
- 부정: 엔진이 바뀌면 사본을 다시 복사해야 한다(수동). hayro 는 비내장 서체를 표준 14 + 나눔고딕 대체로만 그린다. wasm 렌더는 동기라 진행 중 래스터를 끊지 못한다(결과만 버리고, 큐의 옛 요청은 합친다).
