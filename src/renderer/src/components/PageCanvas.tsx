import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import IconButton from '@mui/material/IconButton'
import type { SxProps, Theme } from '@mui/material/styles'
import type { PageRef } from '@core/pages'
import type { PageObject, StrokeObj, TextObj, EditTextObj, LinkObj, NoteObj, Rect } from '@core/objects'
import { newId, hitTest, textBoxRect, textContentHeight, rectsOverlap, objectRect, setObjectRect, unrotatePoint } from '@core/objects'
import type { RenderTask } from 'pdfjs-dist'
import { renderPage, extractTextSpans, type TextSpan } from '@renderer/pdf/docs'
import { drawObjects, fontCss, measureTextWidthPx, effectiveBlend } from '@renderer/editor/draw'
import { cachedImage, preloadImage } from '@renderer/editor/canvasUtil'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { Trash2 } from './icons'

interface Props {
  page: PageRef
  zoom: number
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface DragState {
  kind: 'move' | 'resize' | 'draw' | 'shape' | 'link' | 'rotate'
  objectId?: string
  handle?: HandleId
  startX: number
  startY: number
  orig?: PageObject
  points?: [number, number][]
  rect?: Rect
  /** move/resize/rotate: 실제 이동이 시작됐는지 — 첫 이동 때만 markHistory (클릭만으로 히스토리 오염 방지) */
  moved?: boolean
  /** move: 포인터다운 시점에 이미 선택돼 있던 객체였나 — 그렇다면 이동 없이 놓을 때 캐럿 편집 진입 */
  wasSelected?: boolean
}

const SEL_BLUE = '#3b82f6'
/** 텍스트 선택 박스: 글자에 바짝 붙지 않게 상하좌우로 띄우는 시각 여백(px) */
const TEXT_SEL_PAD = 7

/** 핸들 점 공통 스타일 — 렌더마다 새 객체를 만들면 emotion 이 매번 직렬화하므로 모듈 상수로 */
const HANDLE_DOT_SX = {
  position: 'absolute',
  bgcolor: SEL_BLUE,
  border: '1.5px solid #fff',
  boxShadow: '0 0 3px rgba(0,0,0,.25)',
  borderRadius: '50%',
  pointerEvents: 'auto',
  touchAction: 'none'
} as const

/** 선택 핸들(파란 점) 배치: 모서리 4 + 변 중간 4 = 8개 (pdfguru 스타일). sx 는 정적이라 미리 만들어 둔다 */
const HANDLES: { id: HandleId; sx: SxProps<Theme> }[] = (
  [
    ['nw', '0%', '0%', 'nwse-resize'],
    ['n', '50%', '0%', 'ns-resize'],
    ['ne', '100%', '0%', 'nesw-resize'],
    ['e', '100%', '50%', 'ew-resize'],
    ['se', '100%', '100%', 'nwse-resize'],
    ['s', '50%', '100%', 'ns-resize'],
    ['sw', '0%', '100%', 'nesw-resize'],
    ['w', '0%', '50%', 'ew-resize']
  ] as [HandleId, string, string, string][]
).map(([id, left, top, cursor]) => ({
  id,
  sx: { ...HANDLE_DOT_SX, left, top, cursor, transform: 'translate(-50%, -50%)', width: 9, height: 9 }
}))

/** editText 스팬 하이라이트 상자 공통 스타일 */
const SPAN_SX = {
  position: 'absolute',
  outline: '1px solid rgba(14,116,144,.45)',
  bgcolor: 'rgba(14,116,144,.07)',
  pointerEvents: 'none'
} as const

/** 정규화 rect → left/top/width/height 퍼센트 (padPx 만큼 사방으로 키움) */
function rectSx(r: Rect, padPx = 0): { left: string; top: string; width: string; height: string } {
  if (!padPx) return { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }
  return {
    left: `calc(${r.x * 100}% - ${padPx}px)`,
    top: `calc(${r.y * 100}% - ${padPx}px)`,
    width: `calc(${r.w * 100}% + ${padPx * 2}px)`,
    height: `calc(${r.h * 100}% + ${padPx * 2}px)`
  }
}

/**
 * 회전 손잡이 전용 커서: 원형 화살표.
 * SVG 커서는 1배율로만 래스터돼 고해상도에서 흐릿하다 → image-set 으로 2x 비트맵을 함께 제공.
 * 흰 외곽선(paint-order: stroke)으로 어두운 배경에서도 또렷하게.
 */
const rotateCursorSvg = (px: number): string =>
  `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 24 24'%3E%3Cpath d='M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-8 8s3.57 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z' fill='%231f2430' stroke='white' stroke-width='1.6' paint-order='stroke' stroke-linejoin='round'/%3E%3C/svg%3E")`
const ROTATE_CURSOR = `-webkit-image-set(${rotateCursorSvg(24)} 1x, ${rotateCursorSvg(48)} 2x) 12 12, grab`
const ROTATE_HANDLE_SX = {
  ...HANDLE_DOT_SX,
  left: '50%',
  top: '100%',
  mt: '20px',
  transform: 'translate(-50%, -1px)',
  width: 11,
  height: 11,
  cursor: ROTATE_CURSOR
} as const
const ROTATE_STICK_SX = { position: 'absolute', left: '50%', top: '100%', width: '1.5px', height: 20, bgcolor: SEL_BLUE, transform: 'translateX(-50%)' } as const

/** 그리기 지우개 커서: 속이 빈 원 (지우개 브러시 — Guru 동작). 흰 외곽선으로 어두운 배경에서도 보이게 */
const eraseCursorSvg = (px: number): string =>
  `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='8.5' fill='none' stroke='white' stroke-width='3.2'/%3E%3Ccircle cx='12' cy='12' r='8.5' fill='none' stroke='%231f2430' stroke-width='1.5'/%3E%3C/svg%3E")`
const ERASE_CURSOR = `-webkit-image-set(${eraseCursorSvg(24)} 1x, ${eraseCursorSvg(48)} 2x) 12 12, auto`

/** X/체크 도구 커서: 배치될 모양·크기 그대로 노출한다 (px = 화면상 배치 크기와 1:1). */
const MARK_VISUAL_RATIO = 0.75 // viewBox 안에서 마크가 차지하는 비율 (여백 = 흰 외곽선용)
const markCursorSvg = (kind: 'cross' | 'check', color: string, px: number): string => {
  const stroke = color || '#111111'
  const path =
    kind === 'cross'
      ? "<path d='M4 4 L28 28 M28 4 L4 28' />"
      : "<path d='M4 17 L13 26 L28 6' />"
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 32 32'><g fill='none' stroke-linecap='round' stroke-linejoin='round'><g stroke='white' stroke-width='6'>${path}</g><g stroke='${stroke}' stroke-width='3.4'>${path}</g></g></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}
/** markPx = 화면에 찍힐 마크의 px 크기 → 커서 박스는 외곽선 여백만큼 키우고 중앙 핫스팟 */
const MARK_CURSOR = (kind: 'cross' | 'check', color: string, markPx: number): string => {
  const px = Math.min(64, Math.max(16, Math.round(markPx / MARK_VISUAL_RATIO)))
  const hot = Math.round(px / 2)
  return `-webkit-image-set(${markCursorSvg(kind, color, px)} 1x, ${markCursorSvg(kind, color, px * 2)} 2x) ${hot} ${hot}, default`
}

const DEFAULT_SIZE = { w: 595, h: 842 }
const HIT_TOL = 0.008

/**
 * 히트테스트 사전 거르기용 축정렬 상자 캐시. 객체는 불변(수정 = 새 객체)이라 WeakMap 이 스스로 무효화된다.
 * stroke = 점들의 min/max, 회전 텍스트 = null(회전 상자는 축정렬이 아니라 그냥 정밀 판정으로).
 */
const bboxCache = new WeakMap<PageObject, Rect | null>()
function bboxOf(o: PageObject): Rect | null {
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
function fastHit(o: PageObject, x: number, y: number, aspect: number): boolean {
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
function topHit(objects: PageObject[], x: number, y: number, aspect: number, only?: PageObject['type']): PageObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i]
    if ((!only || o.type === only) && fastHit(o, x, y, aspect)) return o
  }
  return null
}

const inSpan = (sp: TextSpan, x: number, y: number): boolean =>
  x >= sp.rect.x && x <= sp.rect.x + sp.rect.w && y >= sp.rect.y && y <= sp.rect.y + sp.rect.h

/** 페이지 1장 = PDF 캔버스 + 객체 오버레이 + 인터랙션 레이어 */
function PageCanvas({ page, zoom }: Props): JSX.Element {
  const t = useT()
  // 도구 스타일(펜/도형/텍스트 등)은 구독하지 않는다 — 포인터 이벤트 시점에 getState() 로 읽는다.
  // 슬라이더 하나 움직일 때 페이지 전부가 다시 렌더·재그리기되는 것을 막고, 항상 최신값을 보장한다.
  const size = useEditor((s) => s.displaySizes[page.id]) ?? DEFAULT_SIZE
  const objects = useEditor((s) => s.objectsByPage[page.id] ?? EMPTY)
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const selected = useEditor((s) => s.selected)
  const setSelected = useEditor((s) => s.setSelected)
  const addObject = useEditor((s) => s.addObject)
  const addObjectTransient = useEditor((s) => s.addObjectTransient)
  const updateObject = useEditor((s) => s.updateObject)
  const updateObjectTransient = useEditor((s) => s.updateObjectTransient)
  const removeObject = useEditor((s) => s.removeObject)
  const removeObjectTransient = useEditor((s) => s.removeObjectTransient)
  const replaceObjects = useEditor((s) => s.replaceObjects)
  const markHistory = useEditor((s) => s.markHistory)
  const markStyle = useEditor((s) => s.markStyle)
  const setPendingImage = useEditor((s) => s.setPendingImage)

  const cssW = size.w * zoom
  const cssH = size.h * zoom
  const aspect = size.w / size.h

  const baseRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const [, forceTick] = useState(0)
  /** 제스처 종료 시 커서(move) 등 렌더 파생값 갱신용 — 드래그 중 매 이동에는 쓰지 않는다 (scheduleRedraw) */
  const bump = (): void => forceTick((n) => n + 1)

  /** 텍스트 인라인 편집 상태. caret = 시작 커서 위치(클릭 지점) */
  const [editing, setEditing] = useState<{ objectId: string; isNew: boolean; caret?: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  /** select 도구에서 객체 위 호버 여부 (포인터 커서용) */
  const [hoverHit, setHoverHit] = useState(false)
  /** editText 도구: 추출된 스팬 */
  const [spans, setSpans] = useState<TextSpan[] | null>(null)
  /** 노트 팝업 */
  const [notePop, setNotePop] = useState<{ objectId: string; x: number; y: number } | null>(null)
  /** 링크 설정 팝업 */
  const [linkPop, setLinkPop] = useState<{ objectId: string; x: number; y: number } | null>(null)
  const [linkKind, setLinkKind] = useState<'url' | 'page'>('url')
  const [linkValue, setLinkValue] = useState('')

  /** id → 객체 (렌더당 O(n) find 여러 번 대신 한 번) + 낙서 유무 */
  const { byId, hasStrokes } = useMemo(() => {
    const m = new Map<string, PageObject>()
    let strokes = false
    for (const o of objects) {
      m.set(o.id, o)
      if (o.type === 'stroke') strokes = true
    }
    return { byId: m, hasStrokes: strokes }
  }, [objects])

  // ── 가시성 감지 (보일 때만 PDF 렌더) ──
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '400px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── 화면에서 멀어진 페이지는 두 캔버스의 백킹 스토어를 놓아준다 (수백 페이지 문서 메모리 상한).
  //    다시 보이면 위 rootMargin 덕에 스크롤이 닿기 전에 렌더 이펙트가 되살린다 ──
  useEffect(() => {
    if (visible) return
    for (const c of [baseRef.current, overlayRef.current]) {
      if (c && (c.width > 0 || c.height > 0)) {
        c.width = 0
        c.height = 0
      }
    }
  }, [visible])

  // ── 오버레이 렌더 ──
  // useCallback 금지: 의존성에서 빠진 tool/스타일이 stale 클로저로 잡혀 드래그 미리보기가
  // 옛 도구 스타일(예: 지우개인데 파란 도형)로 그려진다. 대신 매 렌더의 최신 클로저를 drawRef 에 넣고,
  // 포인터 이벤트는 scheduleRedraw() 로 rAF 한 프레임에 한 번만 그 클로저를 호출한다 (React 재조정 없음).
  const drawRef = useRef<() => void>(() => {})
  const rafRef = useRef(0)
  /** 비동기(이미지 디코드 대기) 그리기의 세대 번호 — 더 새 요청이 있으면 옛 것은 그리지 않는다 */
  const seqRef = useRef(0)

  const redrawOverlay = (): void => {
    const canvas = overlayRef.current
    if (!canvas || zoom <= 0 || !visible) return
    const seq = ++seqRef.current
    const paint = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const W = Math.round(cssW * dpr)
      const H = Math.round(cssH * dpr)
      // 크기 대입은 백킹 스토어 재할당 — 실제로 바뀔 때만
      if (canvas.width !== W) canvas.width = W
      if (canvas.height !== H) canvas.height = H
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, W, H)
      // 편집 중인 텍스트 객체는 캔버스에서 숨긴다 (textarea가 대신 보임).
      // 단 editText 는 cover(원본 가림)를 유지해야 하므로 텍스트만 비운 채 그린다
      const draw = objects.flatMap((o) => {
        if (o.id !== editing?.objectId) return [o]
        return o.type === 'editText' ? [{ ...o, text: '' } as PageObject] : []
      })
      // 진행 중 드래그(펜 선/도형/링크 영역)의 미리보기
      const d = dragRef.current
      const previews: PageObject[] = []
      if (d?.kind === 'draw' && d.points) previews.push(transientStroke(d.points))
      if (d?.kind === 'shape' && d.rect) previews.push(transientShape(d.rect))
      if (d?.kind === 'link' && d.rect) previews.push({ id: 'transient', type: 'link', rect: d.rect, target: { kind: 'url', url: '' }, opacity: 1 })
      // 혼합 모드(multiply 등)는 페이지 픽셀을 백드롭으로 깔아야 실제로 섞인다
      // (투명 캔버스에 블렌드하면 모드 불문 동일하게 보임)
      const needBackdrop = draw.some((o) => effectiveBlend(o) !== 'normal') || previews.some((o) => effectiveBlend(o) !== 'normal')
      if (needBackdrop && baseRef.current && baseRef.current.width > 0) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, W, H)
        ctx.drawImage(baseRef.current, 0, 0, W, H)
      }
      drawObjects(ctx, draw, W, H, 'editor')
      if (previews.length > 0) drawObjects(ctx, previews, W, H, 'editor')
    }
    // 이미지가 전부 디코드돼 있으면 동기로 바로 그린다 (드래그 중 마이크로태스크 홉 없음)
    const missing: string[] = []
    for (const o of objects) if ((o.type === 'image' || o.type === 'watermark') && !cachedImage(o.dataUrl)) missing.push(o.dataUrl)
    if (missing.length === 0) {
      paint()
      return
    }
    void Promise.all(missing.map((u) => preloadImage(u).catch(() => null))).then(() => {
      if (seqRef.current === seq) paint()
    })
  }
  drawRef.current = redrawOverlay

  /** 다음 프레임에 한 번만 다시 그린다 (연속 pointermove 를 한 프레임으로 합침) */
  const scheduleRedraw = (): void => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      drawRef.current()
    })
  }
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    []
  )

  // 그리기 입력이 바뀌면 즉시 다시 그린다 (예약된 프레임은 취소 — 같은 내용을 두 번 그리지 않게)
  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    redrawOverlay()
  }, [objects, cssW, cssH, zoom, visible, editing?.objectId])

  // ── PDF 본문 렌더 ──
  useEffect(() => {
    const canvas = baseRef.current
    if (!visible || !canvas || zoom <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ac = new AbortController()
    let task: RenderTask | undefined
    // 렌더 완료 후 오버레이 재그리기 — 혼합 모드 백드롭이 빈 페이지로 굳지 않게
    renderPage(page, canvas, zoom * dpr, {
      signal: ac.signal,
      onTask: (t) => {
        task = t
        if (ac.signal.aborted) t.cancel()
      }
    }).then(
      () => {
        if (!ac.signal.aborted) scheduleRedraw()
      },
      () => {} // RenderingCancelledException(줌 연타로 이전 렌더 취소) — 정상 경로
    )
    return () => {
      // 같은 캔버스에 새 렌더가 걸리기 전에 진행 중 pdf.js 렌더를 끊는다
      ac.abort()
      task?.cancel()
    }
  }, [visible, page, page.extraRotation, zoom])

  function transientStroke(points: [number, number][]): StrokeObj {
    const s = useEditor.getState()
    const st = tool === 'highlight' ? s.highlightStyle : s.penStyle
    return { id: 'transient', type: 'stroke', kind: tool === 'highlight' ? 'highlight' : 'pencil', ...st, points }
  }

  function transientShape(rect: Rect): PageObject {
    // 지우개 = 흰 도형으로 덮기 (pdfguru Eraser): 모양·테두리·채우기·스타일은 eraserStyle
    const s = useEditor.getState()
    const st = tool === 'whiteout' ? s.eraserStyle : s.shapeStyle
    const kind = tool === 'whiteout' ? s.eraserStyle.kind : tool === 'ellipse' ? 'ellipse' : 'rect'
    return { id: 'transient', type: 'shape', kind, rect, stroke: st.stroke, strokeWidth: st.strokeWidth, fill: st.fill, opacity: st.opacity, dash: st.dash }
  }

  // ── editText: 도구 선택 시 스팬 로드 ──
  useEffect(() => {
    if (tool !== 'editText') {
      setSpans(null)
      return
    }
    let alive = true
    void extractTextSpans(page).then((s) => {
      if (alive) setSpans(s)
    })
    return () => {
      alive = false
    }
  }, [tool, page, page.extraRotation])

  /** 아직 editText 객체의 cover 가 덮지 않은 스팬 (하이라이트 표시·클릭 대상). 렌더마다 다시 걸러내지 않는다 */
  const freeSpans = useMemo(() => {
    if (!spans) return null
    const covers: Rect[] = []
    for (const o of objects) if (o.type === 'editText') covers.push(o.cover)
    return covers.length === 0 ? spans : spans.filter((sp) => !covers.some((c) => rectsOverlap(c, sp.rect)))
  }, [spans, objects])
  const spanBoxes = useMemo(
    () => freeSpans?.map((sp, i) => <Box key={i} sx={{ ...SPAN_SX, ...rectSx(sp.rect) }} />) ?? null,
    [freeSpans]
  )

  const norm = (e: React.PointerEvent): [number, number] => {
    const r = boxRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }

  const editingObj = editing ? (byId.get(editing.objectId) ?? null) : null

  /**
   * 그리기 지우개: 브러시가 지나간 경로(선분 x0,y0→x1,y1)에 닿은 "구간만" 지운다 — 선 전체가 아니라.
   * 닿은 점을 걷어내고 남은 연속 구간들을 각각 새 선으로 분리. 제스처당 히스토리 1단계(dragRef.moved).
   * 선분 판정인 이유: pointermove 가 병합되면 샘플 간격이 브러시보다 넓어져 중간이 건너뛰어진다.
   * 결과는 스토어 갱신 한 번(replaceObjects)으로 반영 — 닿은 선을 제거하고 남은 구간들을 뒤에 붙인다.
   */
  function eraseStrokesAlong(x0: number, y0: number, x1: number, y1: number): void {
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
    // 렌더 클로저의 objects 는 연속 pointermove 에서 stale 해질 수 있다 → 스토어에서 직접
    const live = useEditor.getState().objectsByPage[page.id] ?? []
    const kept: PageObject[] = []
    const added: PageObject[] = []
    for (const o of live) {
      if (o.type !== 'stroke') {
        kept.push(o)
        continue
      }
      const rr = 0.012 + o.width / 2
      const b = bboxOf(o)
      // 거리 판정은 px 공간(x·aspect)이라 x 여유는 rr/aspect — 보수적으로 걸러 결과는 동일
      const near =
        b !== null && b.x - rr / aspect <= sx1 && b.x + b.w + rr / aspect >= sx0 && b.y - rr <= sy1 && b.y + b.h + rr >= sy0
      const hitAt = (p: [number, number]): boolean => distToPath(p) < rr
      if (!near || !o.points.some(hitAt)) {
        kept.push(o)
        continue
      }
      if (dragRef.current && !dragRef.current.moved) {
        markHistory()
        dragRef.current.moved = true
      }
      // 점이 드문 선(특히 형광펜)은 한 점만 지워도 긴 구간이 통째로 사라져 뭉텅이로 보인다
      // → 지우기 전에 점을 촘촘히 보간해 브러시가 닿은 만큼만 매끄럽게 잘리게 한다
      const maxStep = 0.004
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
    if (added.length > 0 || kept.length !== live.length) replaceObjects(page.id, kept.concat(added))
  }

  /** 클릭 지점(정규화)이 텍스트의 몇 번째 글자 앞인지 — 캐럿 초기 위치용 */
  function caretIndexFor(obj: TextObj | EditTextObj, xN: number, yN: number): number {
    const isText = obj.type === 'text'
    const rect = isText ? textBoxRect(obj) : obj.box
    // 회전 텍스트는 클릭점을 상자 로컬(비회전) 공간으로 역회전
    const [px, py] = isText && obj.rotation ? unrotatePoint(xN, yN, rect.x + rect.w / 2, rect.y + rect.h / 2, obj.rotation, aspect) : [xN, yN]
    const localX = (px - rect.x) * cssW
    let localY = (py - rect.y) * cssH
    const lhPx = obj.size * cssH * 1.25
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

  function commitEditing(): void {
    if (!editing || !editingObj) {
      setEditing(null)
      return
    }
    const trimmed = editValue.replace(/\s+$/, '')
    const isNew = editing.isNew
    if (editingObj.type === 'editText') {
      // 빈 텍스트여도 cover 는 남긴다 = 원본을 지운 상태 (Guru 동작)
      updateObject(page.id, editing.objectId, { text: trimmed })
    } else if (trimmed === '' && editingObj.type === 'text') {
      // 새 객체는 히스토리 없이 조용히 취소 (아직 히스토리에 없음)
      if (isNew) removeObjectTransient(page.id, editing.objectId)
      else removeObject(page.id, editing.objectId)
    } else if (editingObj.type === 'text') {
      // 실측 폭을 저장해 선택 외곽선·회전 중심·히트테스트가 그려진 텍스트와 일치하게 한다
      const wPx = measureTextWidthPx(trimmed, editingObj.size, editingObj.font, editingObj.bold, editingObj.italic, cssH)
      // 사용자가 늘린 상자 높이(h>0)는 유지하되 내용이 넘치면 내용 높이로 확장
      const h = editingObj.h > 0 ? Math.max(editingObj.h, textContentHeight({ text: trimmed, size: editingObj.size })) : 0
      const patch = { text: trimmed, w: Math.min(1, wPx / cssW), h }
      if (isNew) {
        // 임시 객체를 걷어내고 확정본을 한 번에 추가 → Ctrl+Z 한 번이면 상자째 사라진다
        removeObjectTransient(page.id, editing.objectId)
        addObject(page.id, { ...editingObj, ...patch })
        setSelected({ pageId: page.id, objectId: editingObj.id })
      } else {
        updateObject(page.id, editing.objectId, patch)
      }
    }
    setEditing(null)
  }

  /** 객체를 잡는다: 선택 + 이동 드래그 시작 (이미 선택돼 있었으면 놓을 때 캐럿 편집으로) */
  function beginMove(hit: PageObject, x: number, y: number, wasSelected = selected?.pageId === page.id && selected.objectId === hit.id): void {
    setSelected({ pageId: page.id, objectId: hit.id })
    dragRef.current = { kind: 'move', objectId: hit.id, startX: x, startY: y, orig: hit, moved: false, wasSelected }
  }

  // ── 포인터 핸들러 ──
  function onPointerDown(e: React.PointerEvent): void {
    if (e.button !== 0 || zoom <= 0) return
    if (editing) {
      commitEditing()
      return
    }
    const [x, y] = norm(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const { pendingImage, textStyle, shapeStyle } = useEditor.getState()

    // 이미지/스탬프/서명 배치
    if (pendingImage) {
      const wN = pendingImage.kind === 'sign' ? 0.28 : 0.32
      const hN = (wN * size.w) / pendingImage.aspect / size.h
      const obj: PageObject = {
        id: newId(),
        type: 'image',
        kind: pendingImage.kind,
        rect: { x: x - wN / 2, y: y - hN / 2, w: wN, h: hN },
        dataUrl: pendingImage.dataUrl,
        opacity: 1
      }
      addObject(page.id, obj)
      setPendingImage(null)
      setTool('select')
      setSelected({ pageId: page.id, objectId: obj.id })
      return
    }

    switch (tool) {
      case 'select': {
        // 위에서부터 히트테스트
        const hit = topHit(objects, x, y, aspect)
        if (hit) {
          beginMove(hit, x, y)
          if (hit.type === 'note') {
            dragRef.current = null
            setNotePop({ objectId: hit.id, x: e.clientX, y: e.clientY })
            return
          }
          if (hit.type === 'link') {
            setLinkKind(hit.target.kind)
            setLinkValue(hit.target.kind === 'url' ? hit.target.url : String(hit.target.page))
            setLinkPop({ objectId: hit.id, x: e.clientX, y: e.clientY })
          }
        } else {
          setSelected(null)
        }
        break
      }
      case 'addText': {
        // mousedown 기본 동작(포커스 이동)이 방금 뜬 textarea를 blur→삭제시키는 것을 막는다
        e.preventDefault()
        const obj: TextObj = {
          id: newId(),
          type: 'text',
          x,
          y,
          w: 0,
          h: 0,
          text: '',
          size: textStyle.size,
          color: textStyle.color,
          bgColor: textStyle.bgColor,
          font: textStyle.font,
          bold: textStyle.bold,
          italic: textStyle.italic,
          underline: textStyle.underline,
          align: textStyle.align,
          valign: textStyle.valign,
          rotation: 0,
          opacity: textStyle.opacity
        }
        addObjectTransient(page.id, obj) // 확정(commitEditing) 때 한 단계로 히스토리에 올린다
        setEditValue('')
        setEditing({ objectId: obj.id, isNew: true })
        // 원샷 배치: 한 번 찍으면 도구가 풀린다 (setTool이 선택을 지우므로 setSelected가 뒤)
        setTool('select')
        setSelected({ pageId: page.id, objectId: obj.id })
        break
      }
      case 'editText': {
        e.preventDefault()
        // 세션 모드(도구 유지): ① 이미 만든 editText 객체 → 선택/이동/캐럿 ② 스팬 → 새 객체
        const hitObj = topHit(objects, x, y, aspect, 'editText')
        if (hitObj) {
          beginMove(hitObj, x, y)
          break
        }
        const span = spans?.find((sp) => inSpan(sp, x, y))
        // 이미 다른 editText 의 cover 가 덮은 스팬은 무시 (이동한 객체의 원래 자리에서 중복 생성 방지)
        if (span && freeSpans!.includes(span)) {
          // Guru 흐름: 클릭 → 글자 크기만큼 박스 선택(드래그로 이동 가능), 놓으면 그 지점에 캐럿
          const obj: EditTextObj = {
            id: newId(),
            type: 'editText',
            cover: span.rect,
            box: span.rect,
            text: span.text,
            origText: span.text,
            size: span.size,
            color: textStyle.color,
            font: textStyle.font,
            bold: textStyle.bold,
            italic: textStyle.italic,
            opacity: 1
          }
          addObject(page.id, obj) // 세션 중이므로 히스토리 없이 버퍼에 쌓인다 (저장/취소는 세션 종료 때)
          beginMove(obj, x, y, true)
        } else if (!span) {
          setSelected(null)
        }
        break
      }
      case 'pencil':
      case 'highlight':
        dragRef.current = { kind: 'draw', startX: x, startY: y, points: [[x, y]] }
        scheduleRedraw()
        break
      case 'whiteout': // 지우개: 드래그 = 흰 도형으로 덮기
        dragRef.current = { kind: 'shape', startX: x, startY: y, rect: { x, y, w: 0, h: 0 } }
        break
      case 'eraseDrawing': {
        dragRef.current = { kind: 'move', startX: x, startY: y, moved: false } // 문지르기 지우기용 마커 (startX/Y = 직전 위치)
        eraseStrokesAlong(x, y, x, y)
        break
      }
      case 'rect':
      case 'ellipse':
        dragRef.current = { kind: 'shape', startX: x, startY: y, rect: { x, y, w: 0, h: 0 } }
        break
      case 'cross':
      case 'check': {
        // 찍기 전 컨텍스트 바에서 정한 크기·색 그대로 (커서 크기와 1:1)
        const s = markStyle.size
        addObject(page.id, {
          id: newId(),
          type: 'shape',
          kind: tool,
          rect: { x: x - s / 2, y: y - (s * size.w) / size.h / 2, w: s, h: (s * size.w) / size.h },
          stroke: markStyle.color,
          strokeWidth: shapeStyle.strokeWidth,
          fill: null,
          opacity: shapeStyle.opacity
        })
        break
      }
      case 'note': {
        const obj: NoteObj = { id: newId(), type: 'note', x, y, color: '#facc15', text: '', opacity: 1 }
        addObject(page.id, obj)
        setSelected({ pageId: page.id, objectId: obj.id })
        setNotePop({ objectId: obj.id, x: e.clientX, y: e.clientY })
        setTool('select')
        break
      }
      case 'link':
        dragRef.current = { kind: 'link', startX: x, startY: y, rect: { x, y, w: 0, h: 0 } }
        break
      default:
        break
    }
  }

  function onPointerMove(e: React.PointerEvent): void {
    const d = dragRef.current
    if (!d) {
      // 드래그 중이 아니면 호버 감지 → 객체/스팬 위에서 포인터(👆) 커서
      if (tool === 'select' || tool === 'editText') {
        const [hx, hy] = norm(e)
        const over =
          tool === 'select'
            ? topHit(objects, hx, hy, aspect) !== null
            : topHit(objects, hx, hy, aspect, 'editText') !== null || !!spans?.some((sp) => inSpan(sp, hx, hy))
        if (over !== hoverHit) setHoverHit(over)
      }
      return
    }
    const [x, y] = norm(e)
    if (d.kind === 'draw' && d.points) {
      d.points.push([x, y])
      scheduleRedraw()
    } else if ((d.kind === 'shape' || d.kind === 'link') && d.rect) {
      d.rect = { x: Math.min(d.startX, x), y: Math.min(d.startY, y), w: Math.abs(x - d.startX), h: Math.abs(y - d.startY) }
      scheduleRedraw()
    } else if (d.kind === 'move' && d.objectId && d.orig) {
      if (!d.moved) {
        markHistory()
        d.moved = true
      }
      const dx = x - d.startX
      const dy = y - d.startY
      updateObjectTransient(page.id, d.objectId, moveObject(d.orig, dx, dy))
    } else if (tool === 'eraseDrawing') {
      eraseStrokesAlong(d.startX, d.startY, x, y) // 직전 위치→현재 위치 경로 전체를 지운다
      d.startX = x
      d.startY = y
    }
  }

  function onPointerUp(e: React.PointerEvent): void {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    // 이미 선택된 텍스트를 이동 없이 클릭→놓으면 그 지점에 캐럿을 놓고 인라인 편집 (Guru 동작)
    if (d.kind === 'move' && !d.moved && d.wasSelected && d.orig && (d.orig.type === 'text' || d.orig.type === 'editText')) {
      const [x, y] = norm(e)
      setEditValue(d.orig.text)
      setEditing({ objectId: d.orig.id, isNew: false, caret: caretIndexFor(d.orig, x, y) })
      bump()
      return
    }
    if (d.kind === 'draw' && d.points && d.points.length > 0) {
      addObject(page.id, { ...transientStroke(d.points), id: newId() })
    } else if (d.kind === 'shape' && d.rect && d.rect.w > 0.005 && d.rect.h > 0.005) {
      const obj = { ...transientShape(d.rect), id: newId() }
      addObject(page.id, obj)
      // 지우개는 연속 사용이 잦아 도구를 유지한다 (Guru 동작). 도형은 원샷 → 선택 도구로
      if (tool !== 'whiteout') setTool('select')
      setSelected({ pageId: page.id, objectId: obj.id })
    } else if (d.kind === 'link' && d.rect && d.rect.w > 0.01 && d.rect.h > 0.01) {
      const obj: LinkObj = { id: newId(), type: 'link', rect: d.rect, target: { kind: 'url', url: '' }, opacity: 1 }
      addObject(page.id, obj)
      setSelected({ pageId: page.id, objectId: obj.id })
      setLinkKind('url')
      setLinkValue('')
      setLinkPop({ objectId: obj.id, x: e.clientX, y: e.clientY })
      setTool('select')
    }
    // 미리보기를 걷어내고(객체가 안 생긴 드래그 포함) 커서(move) 등 렌더 파생값을 되돌린다
    scheduleRedraw()
    bump()
  }

  // ── 선택 객체 표시(외곽선/핸들) ──
  const selObj = selected?.pageId === page.id ? (byId.get(selected.objectId) ?? null) : null
  const selRect: Rect | null = useMemo(() => (selObj ? objectRect(selObj) : null), [selObj])

  const hasHandles =
    selObj &&
    (selObj.type === 'text' || selObj.type === 'editText' || selObj.type === 'image' || selObj.type === 'shape' || selObj.type === 'link' || selObj.type === 'watermark')
  const selRotation = selObj?.type === 'text' ? (selObj.rotation ?? 0) : 0

  /** 핸들(점) 드래그 시작 — 핸들 자신이 pointer capture 해서 인터랙션 레이어를 거치지 않는다 */
  function onHandleDown(e: React.PointerEvent, kind: 'resize' | 'rotate', handle?: HandleId): void {
    e.stopPropagation()
    e.preventDefault()
    if (!selObj) return
    const [x, y] = norm(e)
    dragRef.current = { kind, handle, objectId: selObj.id, startX: x, startY: y, orig: selObj, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onHandleMove(e: React.PointerEvent): void {
    const d = dragRef.current
    if (!d || !d.objectId || !d.orig || !selRect) return
    if (!d.moved) {
      markHistory()
      d.moved = true
    }
    const [x, y] = norm(e)

    if (d.kind === 'rotate') {
      // 상자 중심→포인터 각도 (핸들이 아래쪽 = 0°), 45° 배수 근처 스냅
      const r = boxRef.current!.getBoundingClientRect()
      const cx = r.left + (selRect.x + selRect.w / 2) * r.width
      const cy = r.top + (selRect.y + selRect.h / 2) * r.height
      let deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI - 90
      deg = ((deg % 360) + 360) % 360
      if (Math.abs(deg - Math.round(deg / 45) * 45) < 4) deg = (Math.round(deg / 45) * 45) % 360
      updateObjectTransient(page.id, d.objectId, { rotation: deg } as Partial<PageObject>)
      return
    }
    if (d.kind !== 'resize' || !d.handle) return

    if (d.orig.type === 'text') {
      const o = d.orig
      const r0 = textBoxRect(o)
      const cx = r0.x + r0.w / 2
      const cy = r0.y + r0.h / 2
      // 시작점 대비 이동량(delta) 기반 — 시각 여백(TEXT_SEL_PAD)·최소폭과 무관하게 튐 없이 동작.
      // 회전돼 있으면 포인터를 상자 로컬(비회전) 공간으로 역회전해 판정.
      const rot = o.rotation ?? 0
      const unrot = (px: number, py: number): [number, number] => (rot ? unrotatePoint(px, py, cx, cy, rot, aspect) : [px, py])
      const [ux, uy] = unrot(x, y)
      const [sx, sy] = unrot(d.startX, d.startY)
      if (d.handle === 'e' || d.handle === 'w') {
        // 좌우 중간점 = 상자 폭
        const dxu = ux - sx
        const w0 = o.w > 0 ? o.w : 0.1
        if (d.handle === 'e') {
          updateObjectTransient(page.id, d.objectId, { w: Math.max(0.04, w0 + dxu) } as Partial<PageObject>)
        } else {
          const right = o.x + w0
          const nx = Math.min(o.x + dxu, right - 0.04)
          updateObjectTransient(page.id, d.objectId, { x: nx, w: right - nx } as Partial<PageObject>)
        }
      } else if (d.handle === 'n' || d.handle === 's') {
        // 상하 중간점 = 상자 높이 (내용 높이보다 작아질 수 없음 — 세로 정렬이 의미를 가짐)
        const dyu = uy - sy
        const minH = textContentHeight(o)
        const h0 = r0.h
        if (d.handle === 's') {
          updateObjectTransient(page.id, d.objectId, { h: Math.max(minH, h0 + dyu) } as Partial<PageObject>)
        } else {
          const bottom = o.y + h0
          const ny = Math.min(o.y + dyu, bottom - minH)
          updateObjectTransient(page.id, d.objectId, { y: ny, h: bottom - ny } as Partial<PageObject>)
        }
      } else {
        // 모서리 = 글자 크기 스케일 (중심 고정 — 회전과 무관하게 동작). 상자 폭·높이도 같은 비율로
        const d0 = Math.max(1e-6, Math.hypot((d.startX - cx) * aspect, d.startY - cy))
        const d1 = Math.hypot((x - cx) * aspect, y - cy)
        const size = Math.min(0.2, Math.max(0.006, o.size * (d1 / d0)))
        const f = size / o.size
        const w = o.w * f
        updateObjectTransient(page.id, d.objectId, {
          size,
          w,
          h: o.h > 0 ? o.h * f : 0,
          x: cx - (w > 0 ? w : 0.1) / 2,
          y: cy - (r0.h * f) / 2
        } as Partial<PageObject>)
      }
      return
    }

    // 사각형 기반 객체(이미지/도형/링크/텍스트수정 box): 잡은 변만 포인터를 따라가고 반대편은 고정.
    // 최소 크기 0.02 — 동/남쪽은 폭·높이를, 서/북쪽은 위치를 반대편에서 0.02 안쪽으로 클램프
    const r = objectRect(d.orig)!
    const right = r.x + r.w
    const bottom = r.y + r.h
    const has = (c: 'n' | 's' | 'e' | 'w'): boolean => d.handle!.includes(c)
    const nx = has('w') ? Math.min(x, right - 0.02) : r.x
    const ny = has('n') ? Math.min(y, bottom - 0.02) : r.y
    const nr: Rect = {
      x: nx,
      y: ny,
      w: has('e') ? Math.max(0.02, x - r.x) : right - nx,
      h: has('s') ? Math.max(0.02, y - r.y) : bottom - ny
    }
    updateObjectTransient(page.id, d.objectId, setObjectRect(d.orig, nr))
  }

  function onHandleUp(): void {
    if (dragRef.current?.kind === 'resize' || dragRef.current?.kind === 'rotate') dragRef.current = null
  }

  // 커서 규칙 (Guru): 객체/스팬 호버 = 포인터(👆), 잡고 있는 동안·드래그 = 이동(✥), 그 외 도구별
  const movingNow = dragRef.current?.kind === 'move' && !!dragRef.current.objectId
  const cursor = movingNow
    ? 'move'
    : tool === 'hand'
      ? 'grab'
      : tool === 'select' || tool === 'editText'
        ? hoverHit
          ? 'pointer'
          : 'default'
        : tool === 'addText'
          ? 'text'
          : tool === 'eraseDrawing'
            ? hasStrokes
              ? ERASE_CURSOR // 낙서가 있어야 지우개 원이 뜬다 (없으면 기본 커서)
              : 'default'
            : tool === 'highlight'
              ? ERASE_CURSOR // 형광펜도 빈 원 브러시 커서 (사용자 요청)
              : tool === 'cross' || tool === 'check'
                ? MARK_CURSOR(tool, markStyle.color, markStyle.size * size.w * zoom)
                : tool === 'watermark'
                  ? 'default' // 클릭 배치 도구가 아니므로 + 커서를 쓰지 않는다 (2026-07-10 피드백)
                  : 'crosshair'

  const noteObj = notePop ? (byId.get(notePop.objectId) as NoteObj | undefined) : undefined
  const linkObj = linkPop ? (byId.get(linkPop.objectId) as LinkObj | undefined) : undefined

  return (
    <Box
      ref={boxRef}
      data-page-index
      sx={{ position: 'relative', width: cssW, height: cssH, bgcolor: '#fff', boxShadow: 2, flexShrink: 0 }}
    >
      <canvas ref={baseRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* editText 스팬 하이라이트 (이미 수정 객체가 덮은 스팬은 제외) */}
      {tool === 'editText' && spanBoxes}

      {/* 선택 외곽선 + 핸들 (점 6개 + 텍스트는 회전 점 1개).
          zIndex 6: 인터랙션 레이어(형제, DOM 뒤)가 핸들 클릭을 가로채지 않도록 위로 올린다 */}
      {selRect && !editing && (
        <Box
          data-testid="sel-outline"
          sx={{
            position: 'absolute',
            // 텍스트는 글자에 바짝 붙지 않게 상하좌우 여백을 두고 감싼다 (중심은 그대로 → 회전 불변)
            ...rectSx(selRect, selObj?.type === 'text' ? TEXT_SEL_PAD : 0),
            outline: `1.5px solid ${SEL_BLUE}`,
            pointerEvents: 'none',
            zIndex: 6,
            transform: selRotation ? `rotate(${selRotation}deg)` : undefined,
            transformOrigin: 'center center'
          }}
        >
          {hasHandles && (
            <>
              {/* 텍스트: 하단 스틱 + 회전 점 */}
              {selObj?.type === 'text' && (
                <>
                  <Box sx={ROTATE_STICK_SX} />
                  <Tooltip title={t('rotateHandle')} placement="bottom" arrow>
                    <Box onPointerDown={(e) => onHandleDown(e, 'rotate')} onPointerMove={onHandleMove} onPointerUp={onHandleUp} sx={ROTATE_HANDLE_SX} />
                  </Tooltip>
                </>
              )}
              {HANDLES.map((h) => (
                <Box key={h.id} onPointerDown={(e) => onHandleDown(e, 'resize', h.id)} onPointerMove={onHandleMove} onPointerUp={onHandleUp} sx={h.sx} />
              ))}
            </>
          )}
        </Box>
      )}

      {/* 인라인 텍스트 편집기 — 내용만큼 자라는 상자 (pdfguru 스타일) */}
      {editing &&
        editingObj &&
        (editingObj.type === 'text' || editingObj.type === 'editText') &&
        (() => {
          const fontPx = editingObj.size * cssH
          const isText = editingObj.type === 'text'
          // 테두리·패딩만큼 왼쪽 위로 당겨서, 확정 후 캔버스에 그려질 위치와 글자가 정확히 겹치게 한다
          const padX = 6
          const padY = 4
          const bw = 1
          const textW = measureTextWidthPx(editValue, editingObj.size, editingObj.font, editingObj.bold, editingObj.italic, cssH)
          const lineCount = editValue.split('\n').length
          // editText 는 최소 원본 상자 폭, 그 외엔 내용 실측 폭 (textarea 기본 rows/cols 크기 방지)
          const minWpx = isText ? 0 : editingObj.box.w * cssW
          const innerW = Math.max(textW + Math.max(4, fontPx * 0.15), fontPx * 0.9, minWpx)
          // 상자 높이(h)가 내용보다 크면 세로 정렬 위치에 입력창을 띄운다 (그려질 위치와 일치)
          const contentHpx = lineCount * fontPx * 1.25
          const boxHpx = isText && editingObj.h > 0 ? Math.max(editingObj.h * cssH, contentHpx) : contentHpx
          const vOff = !isText ? 0 : editingObj.valign === 'middle' ? (boxHpx - contentHpx) / 2 : editingObj.valign === 'bottom' ? boxHpx - contentHpx : 0
          return (
            <textarea
              autoFocus
              wrap="off"
              spellCheck={false}
              ref={(el) => {
                // 클릭 지점에 캐럿 배치 (최초 1회만 — 이후 타이핑 캐럿을 건드리지 않는다)
                if (el && editing.caret != null && el.dataset.caretApplied !== '1') {
                  el.dataset.caretApplied = '1'
                  const c = Math.min(editing.caret, el.value.length)
                  el.setSelectionRange(c, c)
                }
              }}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEditing}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  if (editing.isNew) removeObjectTransient(page.id, editing.objectId)
                  setEditing(null)
                }
              }}
              style={{
                position: 'absolute',
                left: `${(isText ? editingObj.x : editingObj.box.x) * 100}%`,
                top: `calc(${(isText ? editingObj.y : editingObj.box.y) * 100}% + ${vOff}px)`,
                marginLeft: -(padX + bw),
                marginTop: -(padY + bw),
                boxSizing: 'border-box',
                width: innerW + (padX + bw) * 2,
                height: lineCount * fontPx * 1.25 + (padY + bw) * 2,
                padding: `${padY}px ${padX}px`,
                fontSize: fontPx,
                fontFamily: fontCss(editingObj.font),
                fontWeight: editingObj.bold ? 700 : 400,
                fontStyle: editingObj.italic ? 'italic' : 'normal',
                textDecoration: isText && editingObj.underline ? 'underline' : undefined,
                textAlign: isText ? editingObj.align : undefined,
                transform: isText && editingObj.rotation ? `rotate(${editingObj.rotation}deg)` : undefined,
                transformOrigin: 'center center',
                color: editingObj.color,
                caretColor: '#111',
                lineHeight: 1.25,
                // "입력 팝업" 느낌 제거: 얇은 테두리만, 그림자 없음, 배경은 제자리 그대로
                // (editText 는 원본 글자를 덮어야 하므로 흰 배경 유지)
                border: `${bw}px solid #7aabf0`,
                borderRadius: 2,
                outline: 'none',
                background: isText ? (editingObj.bgColor ?? 'transparent') : '#fff',
                resize: 'none',
                margin: 0,
                overflow: 'hidden',
                whiteSpace: 'pre',
                zIndex: 5
              }}
            />
          )
        })()}

      {/* 인터랙션 레이어 */}
      <Box
        data-testid="interaction-layer"
        sx={{ position: 'absolute', inset: 0, cursor, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* 노트 편집 팝업 */}
      <Popover
        open={!!notePop && !!noteObj}
        anchorReference="anchorPosition"
        anchorPosition={notePop ? { left: notePop.x, top: notePop.y } : undefined}
        onClose={() => setNotePop(null)}
      >
        <Box sx={{ p: 1.5, width: 260, bgcolor: noteObj?.color ?? '#facc15' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <strong style={{ fontSize: 13 }}>{t('noteTitle')}</strong>
            <IconButton
              size="small"
              onClick={() => {
                if (notePop) removeObject(page.id, notePop.objectId)
                setNotePop(null)
              }}
            >
              <Trash2 fontSize="small" />
            </IconButton>
          </Stack>
          <TextField
            multiline
            minRows={4}
            fullWidth
            autoFocus
            variant="standard"
            placeholder={t('notePlaceholder')}
            defaultValue={noteObj?.text ?? ''}
            onBlur={(e) => {
              if (notePop) updateObject(page.id, notePop.objectId, { text: e.target.value })
            }}
            sx={{ '& .MuiInputBase-root': { fontSize: 13 } }}
          />
        </Box>
      </Popover>

      {/* 링크 설정 팝업 */}
      <Popover
        open={!!linkPop && !!linkObj}
        anchorReference="anchorPosition"
        anchorPosition={linkPop ? { left: linkPop.x, top: linkPop.y } : undefined}
        onClose={() => setLinkPop(null)}
      >
        <Box sx={{ p: 2, width: 300 }}>
          <Stack spacing={1.5}>
            <strong style={{ fontSize: 13 }}>{t('linkSettings')}</strong>
            <ToggleButtonGroup size="small" exclusive value={linkKind} onChange={(_, v) => v && setLinkKind(v)} fullWidth>
              <ToggleButton value="url">{t('website')}</ToggleButton>
              <ToggleButton value="page">{t('pages')}</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              size="small"
              autoFocus
              fullWidth
              placeholder={linkKind === 'url' ? 'www.example.com' : t('pageNo')}
              type={linkKind === 'page' ? 'number' : 'text'}
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  if (linkPop && linkObj && linkObj.target.kind === 'url' && linkObj.target.url === '') {
                    removeObject(page.id, linkPop.objectId)
                  }
                  setLinkPop(null)
                }}
              >
                {t('cancel')}
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!linkValue.trim()}
                onClick={() => {
                  if (linkPop) {
                    updateObject(page.id, linkPop.objectId, {
                      target: linkKind === 'url' ? { kind: 'url', url: linkValue.trim() } : { kind: 'page', page: Number(linkValue) || 1 }
                    })
                  }
                  setLinkPop(null)
                }}
              >
                {t('apply')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Popover>
    </Box>
  )
}

/** props(page·zoom)가 같으면 다시 렌더하지 않는다 — 스크롤/다른 페이지 편집이 페이지 전부를 흔들지 않게 */
export default memo(PageCanvas)

const EMPTY: PageObject[] = []

/** 객체를 dx,dy 만큼 이동한 patch. text 는 위치만(폭·높이 유지), editText 는 cover(원본 가림)를 남기고 box 만 */
function moveObject(o: PageObject, dx: number, dy: number): Partial<PageObject> {
  if (o.type === 'text' || o.type === 'note') return { x: o.x + dx, y: o.y + dy } as Partial<PageObject>
  const r = objectRect(o)
  return r ? setObjectRect(o, { ...r, x: r.x + dx, y: r.y + dy }) : {}
}
