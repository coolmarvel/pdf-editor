---
title: 편집기 동작 가이드
created: 2026-07-08
updated: 2026-10-29
domain: development
---

# 편집기 동작 가이드 (현재 코드 기준)

## 화면 흐름

`App.tsx` 가 `phase` 로 전환: `landing`(Landing.tsx) → `loading`(LoadingScreen.tsx) → `editor`(Editor.tsx).
파일 열기는 다이얼로그(`window.api.openPdf`) 또는 드래그&드롭(File.arrayBuffer).

## 데이터 흐름

```
소스 PDF bytes ──registerDoc──▶ pdf/registry.ts (docId → {bytes, 엔진 문서 id}) ──open──▶ Rust 엔진 워커(engine/worker.ts)
store/editor.ts: pages(PageRef[]) + objectsByPage + displaySizes + history
                 └ 모든 편집 = commit() → history push → 불변 갱신
렌더: PageCanvas = base canvas(엔진 render_page RGBA → putImageData) + overlay canvas(editor/draw.ts drawObjects)
스팬: pdf/docs.ts extractTextSpans = 엔진 page_text_spans(텍스트 명령 단위) → TextSpan (텍스트 수정·검색)
저장: pdf/save.ts buildPdf = 엔진 build_document(원본 페이지 복사 + 회전 + 오버레이 PNG + Link/Text 주석)
이미지→페이지: pdf/imageToPdf.ts = 엔진 build_document(빈 페이지 + under 이미지)
```

엔진(v1.8.0~): `src/renderer/src/engine/` — `pkg/`(모노레포 `~/pdf-editor-live/packages/engine` wasm-pack 산출물 사본, 출처·갱신법은 `pkg/README.md`),
`worker.ts`(모듈 워커, wasm 은 이 스레드에서만), `client.ts`(Promise RPC · 같은 캔버스 렌더 합치기 · 워커 트랩 시 `onEngineReset`), `types.ts`(계약).
워커가 죽으면 `registry.ts` 가 보관한 바이트로 새 워커에 다시 열고 `renderEpoch.ts` 로 캔버스를 다시 그린다.
비내장 서체는 엔진이 표준 14 만 그리므로 번들한 `assets/fonts/NanumGothic-Regular.ttf` 를 첫 문서 열 때 `setFallbackFont` 로 등록한다.
CSP(`src/renderer/index.html`)에 `'wasm-unsafe-eval'` 이 있어야 wasm 이 돈다.

```
```

## 도구 → 인터랙션 (전부 `PageCanvas.tsx`)

| 도구 | 제스처 | 결과 객체 |
|---|---|---|
| select | 클릭=선택, 드래그=이동, 우하단 핸들=리사이즈, 더블클릭=텍스트 편집, Delete=삭제 | — |
| addText | 클릭 → 인라인 textarea | TextObj |
| editText | 스팬 하이라이트 표시, 클릭 → 흰 덮개+재작성 | EditTextObj |
| pencil/highlight/whiteout | 드래그 | StrokeObj(kind) |
| eraseDrawing | 클릭/문지르기 → 스트로크 삭제 | — |
| rect/ellipse | 드래그 | ShapeObj |
| cross/check | 클릭(고정 크기) | ShapeObj |
| image/stamp | (다이얼로그에서 pendingImage 셋) → 클릭 배치 | ImageObj |
| sign | 다이얼로그(SignDialog)에서 Done/저장 카드 클릭 → **클릭 대기 없이** 화면에 보이는 페이지 영역 중앙에 즉시 배치 (`store/editor.ts` `placeSignOnCurrentPage`) | ImageObj(kind:'sign') |
| watermark | 컨텍스트 바에서 설정(텍스트/이미지·불투명도·기울기·크기·단일/바둑판·전체/현재) → [적용] = 범위 페이지에 한 커밋으로 추가 (`applyWatermark`). 텍스트도 비트맵 사전 렌더(`editor/watermark.ts`). 선택은 중앙 셀 클릭 | WatermarkObj |
| note | 클릭 → 노트 팝업 | NoteObj |
| link | 드래그 → 링크 설정 팝오버 | LinkObj |
| hand | 드래그로 스크롤 (PagesView) | — |

## 줌/페이지 추적

- 첫 로드: `PagesView` 가 1페이지가 화면에 다 들어오는 배율로 fit (`zoom` = px/pt).
- 스크롤 시 뷰포트 중앙에 걸린 페이지 = `currentPage` (페이저·썸네일 하이라이트).
- 페이저/썸네일 클릭 → `requestScrollTo` → scrollIntoView.

## 알려진 제약 (todo와 연동)

- Edit Text 는 엔진 텍스트 스팬 단위(텍스트 명령 하나 = 스팬, 줄 조각) — 문단 병합 없음. 원문은 흰 덮기로 가린다(원문 삭제·벡터 재기록은 모노레포에만).
- 저장 시 원본 페이지의 주석(링크 등)은 엔진 페이지 복사로 유지된다. 문서 수준 북마크·폼은 모든 페이지가 한 원본에서 오고 빠진 페이지가 없을 때만 유지(엔진 규칙, 모노레포 `docs/guides/engine.md`).

## 서명(Sign) 흐름 (v1.4.9)

- 저장 서명이 없으면 SignDialog 는 Draw/Image/Type **추가 화면**, 하나라도 있으면 **라이브러리 화면**
  (2열 카드 + 카드별 삭제 버튼 + Add signature)부터 표시.
- 저장 서명은 localStorage 키 `savedSigns` 로 영속화 — 앱 재시작에도 유지
  (`store/editor.ts` `loadSavedSigns`/`persistSavedSigns`).
- Done/카드 클릭 = 즉시 배치. 배치 좌표는 `SignDialog.tsx` `visiblePageCenter()` 가 현재 페이지의
  뷰포트 교차 영역 중심을 계산해 전달 (문서 좌표 0.5 고정이면 폭맞춤 화면에서 스크롤 밖에 떨어짐 — v1.4.9 사고).
