---
title: 편집기 동작 가이드
created: 2026-07-08
updated: 2026-07-08
domain: development
---

# 편집기 동작 가이드 (현재 코드 기준)

## 화면 흐름

`App.tsx` 가 `phase` 로 전환: `landing`(Landing.tsx) → `loading`(LoadingScreen.tsx) → `editor`(Editor.tsx).
파일 열기는 다이얼로그(`window.api.openPdf`) 또는 드래그&드롭(File.arrayBuffer).

## 데이터 흐름

```
소스 PDF bytes ──registerDoc──▶ pdf/docs.ts (docId → {bytes, pdf.js proxy})
store/editor.ts: pages(PageRef[]) + objectsByPage + displaySizes + history
                 └ 모든 편집 = commit() → history push → 불변 갱신
렌더: PageCanvas = base canvas(pdf.js) + overlay canvas(editor/draw.ts drawObjects)
저장: pdf/save.ts buildPdf = embedPage 평탄화 + 오버레이 PNG + Link/Text 주석
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
| image/stamp/sign | (다이얼로그에서 pendingImage 셋) → 클릭 배치 | ImageObj |
| note | 클릭 → 노트 팝업 | NoteObj |
| link | 드래그 → 링크 설정 팝오버 | LinkObj |
| hand | 드래그로 스크롤 (PagesView) | — |

## 줌/페이지 추적

- 첫 로드: `PagesView` 가 1페이지가 화면에 다 들어오는 배율로 fit (`zoom` = px/pt).
- 스크롤 시 뷰포트 중앙에 걸린 페이지 = `currentPage` (페이저·썸네일 하이라이트).
- 페이저/썸네일 클릭 → `requestScrollTo` → scrollIntoView.

## 알려진 제약 (todo와 연동)

- Edit Text 는 pdf.js 텍스트 스팬 단위(줄 조각) — 문단 병합 없음.
- 저장 시 원본 문서의 기존 링크/북마크는 유지되지 않음 (ADR-0002 트레이드오프).
- 저장된 서명(savedSigns)은 앱 재시작 시 사라짐.
