/**
 * 페이지 객체 히트테스트·이동 — PageCanvas 의 포인터 처리에서 뗀 순수 함수 (React·스토어 무관, 단위 테스트 가능).
 * 좌표는 전부 정규화(0..1), aspect = 페이지 폭/높이 (회전 텍스트 역회전용).
 */
import type { PageObject, Rect } from '@core/objects'
import { hitTest, objectRect, setObjectRect } from '@core/objects'
import type { TextSpan } from '@renderer/pdf/docs'

/** 선택 히트 허용 오차(정규화) */
export const HIT_TOL = 0.008

/**
 * 히트테스트 사전 거르기용 축정렬 상자 캐시. 객체는 불변(수정 = 새 객체)이라 WeakMap 이 스스로 무효화된다.
 * stroke = 점들의 min/max, 회전 텍스트 = null(회전 상자는 축정렬이 아니라 그냥 정밀 판정으로).
 */
const bboxCache = new WeakMap<PageObject, Rect | null>()
export function bboxOf(o: PageObject): Rect | null {
  if (bboxCache.has(o)) return bboxCache.get(o)!
  let r: Rect | null
  if (o.type === 'stroke') {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const [px, py] of o.points) {
      if (px < x0) x0 = px
      if (px > x1) x1 = px
      if (py < y0) y0 = py
      if (py > y1) y1 = py
    }
    r = o.points.length === 0 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  } else if (o.type === 'text' && o.rotation) {
    r = null
  } else {
    r = objectRect(o)
  }
  bboxCache.set(o, r)
  return r
}

/** hitTest 와 결과가 같되, 상자 밖이면 점 루프 없이 바로 거른다 (stroke 는 tol + 선폭/2 만큼 부풀림) */
export function fastHit(o: PageObject, x: number, y: number, aspect: number): boolean {
  const b = bboxOf(o)
  if (b) {
    const pad = HIT_TOL + (o.type === 'stroke' ? o.width / 2 : 0)
    if (x < b.x - pad || x > b.x + b.w + pad || y < b.y - pad || y > b.y + b.h + pad) return false
  } else if (o.type === 'stroke') {
    return false // 점이 없는 선
  }
  return hitTest(o, x, y, HIT_TOL, aspect)
}

/** 위(마지막)에서부터 첫 히트 — 배열 복사 없이 역순 순회 */
export function topHit(objects: PageObject[], x: number, y: number, aspect: number, only?: PageObject['type']): PageObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i]
    if ((!only || o.type === only) && fastHit(o, x, y, aspect)) return o
  }
  return null
}

export const inSpan = (sp: TextSpan, x: number, y: number): boolean =>
  x >= sp.rect.x && x <= sp.rect.x + sp.rect.w && y >= sp.rect.y && y <= sp.rect.y + sp.rect.h

/** 객체를 dx,dy 만큼 이동한 patch. text 는 위치만(폭·높이 유지), editText 는 cover(원본 가림)를 남기고 box 만 */
export function moveObject(o: PageObject, dx: number, dy: number): Partial<PageObject> {
  if (o.type === 'text' || o.type === 'note') return { x: o.x + dx, y: o.y + dy } as Partial<PageObject>
  const r = objectRect(o)
  return r ? setObjectRect(o, { ...r, x: r.x + dx, y: r.y + dy }) : {}
}
