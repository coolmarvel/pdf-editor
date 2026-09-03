/**
 * 그리기 지우개의 순수 계산 — 브러시가 지나간 선분에 닿은 "구간만" 지운다(선 전체가 아니라).
 * PageCanvas 는 결과가 touched 일 때 히스토리 마킹 + replaceObjects 만 담당한다.
 */
import type { PageObject } from '@core/objects'
import { newId } from '@core/objects'
import { bboxOf } from './hit'

/** 지우개 커서 원의 반지름(CSS px) — 24px 커서, viewBox 24 에서 r=8.5. 지우기 판정 반경은 이 값과 1:1 (보이는 원만큼만 지운다) */
export const ERASE_CURSOR_R_PX = 8.5

export interface EraseSegment {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * 선분 (x0,y0)→(x1,y1) 에 닿은 점을 걷어내고 남은 연속 구간들을 각각 새 선으로 분리한다.
 * 선분 판정인 이유: pointermove 가 병합되면 샘플 간격이 브러시보다 넓어져 중간이 건너뛰어진다.
 * 반환 objects = 닿은 선을 제거하고 남은 구간들을 뒤에 붙인 새 목록, touched = 하나라도 닿았나.
 * aspect = 페이지 폭/높이(px 공간 거리 보정), cssH = 페이지 표시 높이 px(커서 반지름을 정규화로 바꾸는 기준).
 */
export function splitStrokesAlong(live: PageObject[], seg: EraseSegment, opts: { aspect: number; cssH: number }): { objects: PageObject[]; touched: boolean } {
  const { aspect, cssH } = opts
  const { x0, y0, x1, y1 } = seg
  // px 공간 선분-점 거리 (aspect 보정)
  const ax = x0 * aspect
  const ay = y0
  const dxs = x1 * aspect - ax
  const dys = y1 - ay
  const len2 = dxs * dxs + dys * dys
  const distToPath = (p: [number, number]): number => {
    const px = p[0] * aspect
    const py = p[1]
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dxs + (py - ay) * dys) / len2))
    return Math.hypot(px - (ax + dxs * t), py - (ay + dys * t))
  }
  // 브러시가 쓸고 간 선분의 축정렬 상자(정규화) — 이 밖의 선은 점 루프 없이 거른다
  const sx0 = Math.min(x0, x1)
  const sx1 = Math.max(x0, x1)
  const sy0 = Math.min(y0, y1)
  const sy1 = Math.max(y0, y1)
  const kept: PageObject[] = []
  const added: PageObject[] = []
  let touched = false
  for (const o of live) {
    if (o.type !== 'stroke') {
      kept.push(o)
      continue
    }
    // 판정 반경 = 화면의 커서 원 반지름 + 선 반폭 (둘 다 px 공간 = 페이지 높이 기준 정규화). 예전 고정값 0.012 는 커서보다 2~3배 커서
    // "보이는 원보다 넓게 지워진다" 는 피드백의 원인이었다. o.width 는 페이지 폭 비율이라 aspect 로 높이 단위로 바꾼다
    const rr = ERASE_CURSOR_R_PX / cssH + (o.width * aspect) / 2
    const b = bboxOf(o)
    // 거리 판정은 px 공간(x·aspect)이라 x 여유는 rr/aspect — 보수적으로 걸러 결과는 동일
    const near =
      b !== null && b.x - rr / aspect <= sx1 && b.x + b.w + rr / aspect >= sx0 && b.y - rr <= sy1 && b.y + b.h + rr >= sy0
    const hitAt = (p: [number, number]): boolean => distToPath(p) < rr
    if (!near || !o.points.some(hitAt)) {
      kept.push(o)
      continue
    }
    touched = true
    // 점이 드문 선(특히 형광펜)은 한 점만 지워도 긴 구간이 통째로 사라져 뭉텅이로 보인다
    // → 지우기 전에 점을 촘촘히 보간해 브러시가 닿은 만큼만 매끄럽게 잘리게 한다
    const maxStep = 0.001 // ≈1px — 보간이 성기면 잘린 끝이 커서 원보다 밖으로 튀어나온다
    const dense: [number, number][] = []
    for (let i = 0; i < o.points.length; i++) {
      if (i > 0) {
        const q = o.points[i - 1]
        const p = o.points[i]
        const seg = Math.hypot((p[0] - q[0]) * aspect, p[1] - q[1])
        const n = Math.floor(seg / maxStep)
        for (let k = 1; k <= n; k++) {
          dense.push([q[0] + ((p[0] - q[0]) * k) / (n + 1), q[1] + ((p[1] - q[1]) * k) / (n + 1)])
        }
      }
      dense.push(o.points[i])
    }
    // 살아남은 연속 구간으로 분할
    let cur: [number, number][] = []
    const flush = (): void => {
      if (cur.length >= 2) added.push({ ...o, id: newId(), points: cur })
      cur = []
    }
    for (const p of dense) {
      if (hitAt(p)) flush()
      else cur.push(p)
    }
    flush()
  }
  return { objects: touched ? kept.concat(added) : live, touched }
}
