/**
 * 텍스트 상자 기하 — 캐럿 위치·리사이즈 패치. PageCanvas 에서 뗀 순수 계산(measureTextWidthPx 만 캔버스 의존).
 * 좌표는 정규화, aspect = 페이지 폭/높이, cssW/cssH = 페이지 표시 크기 px.
 */
import type { EditTextObj, PageObject, TextObj } from '@core/objects'
import { TEXT_LINE_HEIGHT, textBoxRect, textContentHeight, unrotatePoint } from '@core/objects'
import { measureTextWidthPx } from './draw'

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** 클릭 지점(정규화)이 텍스트의 몇 번째 글자 앞인지 — 캐럿 초기 위치용 */
export function caretIndexAt(obj: TextObj | EditTextObj, xN: number, yN: number, view: { aspect: number; cssW: number; cssH: number }): number {
  const { aspect, cssW, cssH } = view
  const isText = obj.type === 'text'
  const rect = isText ? textBoxRect(obj) : obj.box
  // 회전 텍스트는 클릭점을 상자 로컬(비회전) 공간으로 역회전
  const [px, py] = isText && obj.rotation ? unrotatePoint(xN, yN, rect.x + rect.w / 2, rect.y + rect.h / 2, obj.rotation, aspect) : [xN, yN]
  const localX = (px - rect.x) * cssW
  let localY = (py - rect.y) * cssH
  const lhPx = obj.size * cssH * TEXT_LINE_HEIGHT
  const lines = obj.text.split('\n')
  if (isText) {
    const blockH = lines.length * lhPx
    const boxH = rect.h * cssH
    localY -= obj.valign === 'middle' ? (boxH - blockH) / 2 : obj.valign === 'bottom' ? boxH - blockH : 0
  }
  const li = Math.max(0, Math.min(lines.length - 1, Math.floor(localY / lhPx)))
  const line = lines[li]
  const widthOf = (n: number): number => (n === 0 ? 0 : measureTextWidthPx(line.slice(0, n), obj.size, obj.font, obj.bold, obj.italic, cssH))
  let startX = 0
  if (isText && obj.align !== 'left') {
    const lineW = widthOf(line.length)
    startX = obj.align === 'center' ? (rect.w * cssW - lineW) / 2 : rect.w * cssW - lineW
  }
  // 접두 폭은 단조 증가 → "클릭점이 i번째 글자의 중간보다 왼쪽" 인 첫 i 를 이진 탐색 (측정 O(log L))
  const memo = new Map<number, number>()
  const w = (n: number): number => {
    let v = memo.get(n)
    if (v === undefined) memo.set(n, (v = widthOf(n)))
    return v
  }
  const before = (i: number): boolean => localX < startX + (w(i) + w(Math.min(i + 1, line.length))) / 2
  let lo = 0
  let hi = line.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (before(mid)) hi = mid
    else lo = mid + 1
  }
  return lines.slice(0, li).reduce((n, l) => n + l.length + 1, 0) + lo
}

/**
 * 텍스트 상자 핸들 리사이즈 패치. 시작점 대비 이동량(delta) 기반 — 시각 여백·최소폭과 무관하게 튐 없이 동작.
 * 좌우 중간점 = 폭, 상하 중간점 = 높이(내용 높이 미만 불가), 모서리 = 글자 크기 스케일(중심 고정).
 * 회전돼 있으면 포인터를 상자 로컬(비회전) 공간으로 역회전해 판정.
 */
export function resizeTextPatch(o: TextObj, handle: HandleId, start: [number, number], cur: [number, number], aspect: number): Partial<PageObject> {
  const r0 = textBoxRect(o)
  const cx = r0.x + r0.w / 2
  const cy = r0.y + r0.h / 2
  const rot = o.rotation ?? 0
  const unrot = (px: number, py: number): [number, number] => (rot ? unrotatePoint(px, py, cx, cy, rot, aspect) : [px, py])
  const [ux, uy] = unrot(cur[0], cur[1])
  const [sx, sy] = unrot(start[0], start[1])
  if (handle === 'e' || handle === 'w') {
    const dxu = ux - sx
    const w0 = o.w > 0 ? o.w : 0.1
    if (handle === 'e') return { w: Math.max(0.04, w0 + dxu) } as Partial<PageObject>
    const right = o.x + w0
    const nx = Math.min(o.x + dxu, right - 0.04)
    return { x: nx, w: right - nx } as Partial<PageObject>
  }
  if (handle === 'n' || handle === 's') {
    const dyu = uy - sy
    const minH = textContentHeight(o)
    const h0 = r0.h
    if (handle === 's') return { h: Math.max(minH, h0 + dyu) } as Partial<PageObject>
    const bottom = o.y + h0
    const ny = Math.min(o.y + dyu, bottom - minH)
    return { y: ny, h: bottom - ny } as Partial<PageObject>
  }
  const d0 = Math.max(1e-6, Math.hypot((start[0] - cx) * aspect, start[1] - cy))
  const d1 = Math.hypot((cur[0] - cx) * aspect, cur[1] - cy)
  const size = Math.min(0.2, Math.max(0.006, o.size * (d1 / d0)))
  const f = size / o.size
  const w = o.w * f
  return {
    size,
    w,
    h: o.h > 0 ? o.h * f : 0,
    x: cx - (w > 0 ? w : 0.1) / 2,
    y: cy - (r0.h * f) / 2
  } as Partial<PageObject>
}
