---
title: pdfguru 파리티 로드맵
created: 2026-07-08
updated: 2026-07-10
domain: development
---

# pdfguru 파리티 로드맵

기준: 사용자가 제공한 pdfguru.com 스크린샷 26장 (`docs/feedback-archive/2026-07-08-pdfguru-benchmark/`).
목표: 그 화면·기능을 오프라인 데스크톱에서 재현.

## pdfguru 기능 인벤토리 → 구현 상태 (v1.4.9 기준)

| pdfguru | 상태 | 비고 |
|---|---|---|
| 업로드 → "Processing your document…" 진행률 | ✅ | 랜딩 → LoadingScreen |
| 상단바: 파일명 rename·Print·Download·Done | ✅ | Share는 오프라인이라 제외, Search는 P2 |
| Pages(썸네일 사이드바 토글) | ✅ | |
| Move(선택 도구)·Undo·Redo | ✅ | |
| Add Text (+폰트·크기·B/I/U·정렬·색 서브툴바) | ✅ | |
| Edit Text (기존 텍스트 자동 인식) | ✅ 기본형 | 스팬 단위 클릭→덮고 재작성. 정밀도 개선 P1 |
| Eraser / Erase drawing | ✅ | 흰칠 브러시 / 스트로크 삭제 |
| Highlight (multiply 블렌드) | ✅ | |
| Pencil | ✅ | |
| Image / Stamp (프리셋+커스텀 날짜·시간·색) | ✅ | |
| Rectangle / Ellipse | ✅ | |
| Cross / Check | ✅ | 클릭 배치 |
| Sign (Draw/Image/Type, 색 3종, Save Signature) | ✅ **사용자 확정** | v1.4.9: Done 즉시 배치, 라이브러리 화면, localStorage 영속화 |
| Annotations (스티키 노트) | ✅ 기본형 | 아이콘 세트·색 팔레트 일부 (전체 세트 P2) |
| Links (Website/Page) | ✅ | 실제 PDF Link 주석으로 저장 |
| Page layout (Mode/Transition/Rotation) | ✅ | v1.4.0: 단면/양면 모드·연속/장 단위 전환·회전 |
| Manage Pages (New/Delete/Duplicate/Rotate/Move/Import/Select All) | ✅ | 드래그 정렬은 P2 |
| More tools (Zoom/Document Crop) | ❌ P2 | 줌은 플로팅 페이저에 있음 |
| Search | ❌ P2 | |
| 하단 페이저(페이지 n/m·줌·손) | ✅ | |

## 이번 프로젝트 고유 추가 예정

- 워터마크 — ✅ v1.5.0 구현 (`docs/plans/2026-07-10-watermark.md`. file-converter 소스가 이 머신에 없어 자체 구현)
- PDF 전용 브랜딩 아이콘 — P3

## 검증 흐름

각 릴리스마다: `npm run typecheck && npm test && npm run build` → dist:win → 바탕화면 →
사용자 실물 테스트 → 스크린샷 피드백 → 다음 PATCH.
