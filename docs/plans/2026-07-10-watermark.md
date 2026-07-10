---
title: 워터마크 도구 구현 계획
created: 2026-07-10
updated: 2026-07-10
domain: development
---

# 워터마크 도구 (v1.5.0)

> **상태: 2026-07-10 구현 완료** — 현재 동작은 `docs/guides/editor.md` 참조.

## 목표

텍스트 또는 이미지를 페이지 위에 반투명 워터마크로 얹는다. 참고할 Guru 스크린샷이 없어
(벤치마크 26장에 워터마크 화면 없음) **우리 컨텍스트 바 문법(SubToolbar Group/36px 컨트롤)** 에 맞춰
자체 설계한다. file-converter 의 `watermark/model.ts` 재사용을 검토했으나 이 머신에 소스가 없어 자체 구현.

## UX 설계

- **툴바**: `워터마크` 토글 버튼 (Sign 처럼 다이얼로그가 아니라 도구 — 설정은 컨텍스트 바에서).
- **컨텍스트 바 (도구 활성 시)**: [소스: 텍스트/이미지] [텍스트 입력 or 이미지 선택]
  [폰트(텍스트)] [색(텍스트)] [불투명도] [기울기(-45/-30/0/30/45/90°)] [크기(페이지 폭 %)]
  [배치: 단일/바둑판] [범위: 전체/현재 페이지] [적용] [모두 제거].
- **적용** = 범위 내 각 페이지에 워터마크 객체를 **한 번의 히스토리 커밋**으로 추가 (Ctrl+Z 한 번에 전체 취소).
- 적용 후 각 페이지의 워터마크는 **선택 가능한 객체**: 중앙 셀 클릭 → 이동/리사이즈/삭제,
  선택 시 컨텍스트 바에서 불투명도·기울기·배치 수정.

## 데이터 모델

`core/objects.ts` 에 `WatermarkObj` 추가:

```ts
interface WatermarkObj extends BaseObj {
  type: 'watermark'
  rect: Rect            // 중앙 마크 1개의 상자 (tile 은 이 상자를 기준 셀로 반복)
  dataUrl: string       // 사전 렌더된 비트맵 — 텍스트도 비트맵으로 (stamp/sign 과 동일 접근)
  angle: number         // 시계방향 회전(도)
  layout: 'single' | 'tile'
}
```

텍스트를 비트맵으로 사전 렌더하는 이유: draw.ts 에 폰트/측정 로직 중복 없이 이미지 경로 재사용
(스탬프·서명과 같은 방식). 적용 후 문구 수정은 불가 — 삭제 후 재적용 (스탬프와 동일한 트레이드오프).

## 구현 지점 (새 도구 추가 체크리스트)

| # | 파일 | 작업 |
|---|---|---|
| ① | `src/core/objects.ts` | `WatermarkObj`, union, `rotateObjectCW`(rect 회전+angle+90), `hitTest`(중앙 셀 rect) |
| ② | `src/renderer/src/editor/draw.ts` | `drawWatermark` — single: rect 중심 회전 1개 / tile: 벽돌 패턴 반복 |
| ② | `src/renderer/src/editor/watermark.ts` | `renderWatermarkText(text, font, color)` → dataUrl+aspect |
| ③ | `PageCanvas.tsx` | preload 필터·selRect·hasHandles·moveObject 에 watermark 추가 (rect 기반 경로 재사용) |
| ④ | `Toolbar.tsx` / `SubToolbar.tsx` | 토글 버튼 / 도구·선택 객체 컨텍스트 바 |
| ⑤ | `pdf/save.ts` | preload 필터에 watermark 추가 (drawObjects 공유라 굽기는 자동) |
| — | `store/editor.ts` | Tool 'watermark', `watermarkStyle`, `applyWatermark`, `removeAllWatermarks` |

## 기본값

텍스트 모드, 색 `#9ca3af`(회색), 불투명도 0.35, 기울기 -30°, 크기 = 페이지 폭 50%,
단일 배치, 전체 페이지.

## 검증

typecheck + test + build 후 Playwright E2E: 텍스트 워터마크 적용(전체 페이지 확인) → 언두 1번에
전체 제거 → 바둑판 배치 → 선택/삭제 → 저장 결과에 굽힘 확인(픽셀).
