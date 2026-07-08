/**
 * 페이지 위에 올라가는 편집 객체 모델 (SSOT).
 *
 * 좌표·크기는 모두 **표시(뷰포트) 기준 정규화(0..1)** 로 저장한다 — 화면 표시 크기와
 * 내보내기 해상도에 독립적이어야 하기 때문. x,y = 페이지 폭/높이 대비 비율.
 * 렌더 함수(drawObjects)는 라이브 오버레이와 PDF 내보내기가 공유한다.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type ObjectId = string

interface BaseObj {
  id: ObjectId
  opacity: number // 0..1
}

/** Add Text — 새로 얹는 텍스트 상자 */
export interface TextObj extends BaseObj {
  type: 'text'
  x: number
  y: number
  /** 폭(정규화). 0이면 내용 길이만큼 */
  w: number
  /** 상자 높이(정규화). 0이면 내용(줄 수)에 맞춤 */
  h: number
  text: string
  /** 글자 크기 = 페이지 높이 대비 비율 */
  size: number
  color: string
  /** 글자 배경(하이라이트) 색. null = 없음 */
  bgColor: string | null
  font: string
  bold: boolean
  italic: boolean
  underline: boolean
  /** 상자 안 가로 정렬 */
  align: 'left' | 'center' | 'right'
  /** 상자 안 세로 정렬 (h 가 내용보다 클 때 의미) */
  valign: 'top' | 'middle' | 'bottom'
  /** 상자 중심 기준 회전(도, 시계방향 0..360). 표시 px 공간 기준 */
  rotation: number
}

/** 텍스트 내용(줄 수) 기준 최소 상자 높이(정규화) */
export function textContentHeight(t: Pick<TextObj, 'text' | 'size'>): number {
  return t.size * 1.25 * Math.max(1, t.text.split('\n').length)
}

/** Edit Text — 원본 텍스트를 흰 상자로 덮고 새 텍스트를 그린다 */
export interface EditTextObj extends BaseObj {
  type: 'editText'
  /** 덮을 원본 텍스트 영역 — 객체가 이동해도 여기 남아 원본을 계속 가린다 */
  cover: Rect
  /** 새 텍스트가 그려지는 상자 (이동·리사이즈 대상). 생성 시 cover 와 동일 */
  box: Rect
  text: string
  /** 원본 스팬의 텍스트 — "손대지 않은" 객체 판별용 (세션 종료 시 정리) */
  origText: string
  size: number
  color: string
  font: string
  bold: boolean
  italic: boolean
}

export type StrokeKind = 'pencil' | 'highlight' | 'whiteout'

/** 자유 곡선: 연필/형광펜/지우개(흰칠) */
export interface StrokeObj extends BaseObj {
  type: 'stroke'
  kind: StrokeKind
  color: string
  /** 선 굵기 = 페이지 폭 대비 비율 */
  width: number
  points: [number, number][]
}

export type ShapeKind = 'rect' | 'ellipse' | 'cross' | 'check'

export interface ShapeObj extends BaseObj {
  type: 'shape'
  kind: ShapeKind
  rect: Rect
  stroke: string
  /** 테두리 굵기 = 페이지 폭 대비 비율 */
  strokeWidth: number
  fill: string | null
}

/** 이미지/스탬프/서명 — 전부 비트맵으로 얹는다 */
export interface ImageObj extends BaseObj {
  type: 'image'
  kind: 'image' | 'stamp' | 'sign'
  rect: Rect
  dataUrl: string
}

/** 스티키 노트 (PDF Text 주석으로 내보냄) */
export interface NoteObj extends BaseObj {
  type: 'note'
  x: number
  y: number
  color: string
  text: string
}

/** 링크 영역 (PDF Link 주석으로 내보냄) */
export interface LinkObj extends BaseObj {
  type: 'link'
  rect: Rect
  target: { kind: 'url'; url: string } | { kind: 'page'; page: number }
}

export type PageObject = TextObj | EditTextObj | StrokeObj | ShapeObj | ImageObj | NoteObj | LinkObj

let seq = 0
export function newId(): ObjectId {
  return `obj-${++seq}-${Math.random().toString(36).slice(2, 8)}`
}

/** 90도 회전 시 객체 좌표를 새 표시 공간으로 변환 (시계방향 1회) */
export function rotatePointCW(p: [number, number]): [number, number] {
  return [1 - p[1], p[0]]
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function rotateRectCW(r: Rect): Rect {
  // 좌상단 기준 rect: 회전 후 좌상단은 (1 - (y+h), x)
  return { x: 1 - (r.y + r.h), y: r.x, w: r.h, h: r.w }
}

/** 객체 하나를 표시 공간 시계방향 90도 회전에 맞춰 변환 */
export function rotateObjectCW(o: PageObject): PageObject {
  switch (o.type) {
    case 'text': {
      const [x, y] = rotatePointCW([o.x, o.y])
      return { ...o, x, y, rotation: ((o.rotation ?? 0) + 90) % 360 }
    }
    case 'editText':
      return { ...o, cover: rotateRectCW(o.cover), box: rotateRectCW(o.box) }
    case 'stroke':
      return { ...o, points: o.points.map(rotatePointCW) }
    case 'shape':
      return { ...o, rect: rotateRectCW(o.rect) }
    case 'image':
      return { ...o, rect: rotateRectCW(o.rect) }
    case 'note': {
      const [x, y] = rotatePointCW([o.x, o.y])
      return { ...o, x, y }
    }
    case 'link':
      return { ...o, rect: rotateRectCW(o.rect) }
  }
}

/**
 * 텍스트 상자의 표시 영역(정규화). 줄 수를 반영한다 — 선택 외곽선·히트테스트 공용.
 * 글자를 정확히 감싼다(여백 없음) — 시각 여백은 선택 UI 가 균등하게 두른다.
 * w=0(실측 폭 미저장)일 때만 최소 폭 폴백.
 */
export function textBoxRect(t: TextObj): Rect {
  const contentH = textContentHeight(t)
  return { x: t.x, y: t.y, w: t.w > 0 ? t.w : 0.1, h: t.h > 0 ? Math.max(t.h, contentH) : contentH }
}

/**
 * 점이 객체에 닿는지 (지우개·선택 히트테스트, tol = 정규화 거리).
 * aspect = 페이지 폭/높이 — 회전 텍스트는 px 공간에서 돌아가므로 역회전에 필요.
 */
export function hitTest(o: PageObject, x: number, y: number, tol: number, aspect = 1): boolean {
  const inRect = (r: Rect): boolean => x >= r.x - tol && x <= r.x + r.w + tol && y >= r.y - tol && y <= r.y + r.h + tol
  switch (o.type) {
    case 'text': {
      const r = textBoxRect(o)
      const rot = o.rotation ?? 0
      if (rot === 0) return inRect(r)
      // 클릭점을 상자 중심 기준으로 역회전한 뒤 축정렬 검사 (px 공간 = aspect 보정)
      const cx = (r.x + r.w / 2) * aspect
      const cy = r.y + r.h / 2
      const a = (-rot * Math.PI) / 180
      const dx = x * aspect - cx
      const dy = y - cy
      const ux = (cx + dx * Math.cos(a) - dy * Math.sin(a)) / aspect
      const uy = cy + dx * Math.sin(a) + dy * Math.cos(a)
      return ux >= r.x - tol && ux <= r.x + r.w + tol && uy >= r.y - tol && uy <= r.y + r.h + tol
    }
    case 'editText':
      return inRect(o.box)
    case 'stroke':
      return o.points.some(([px, py]) => Math.hypot(px - x, py - y) < tol + o.width / 2)
    case 'shape':
      return inRect(o.rect)
    case 'image':
      return inRect(o.rect)
    case 'note':
      return inRect({ x: o.x, y: o.y, w: 0.03, h: 0.03 })
    case 'link':
      return inRect(o.rect)
  }
}
