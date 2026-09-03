import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import type { SxProps, Theme } from '@mui/material/styles'
import { DEFAULT_PAGE_SIZE, type PageRef } from '@core/pages'
import type { PageObject, StrokeObj, TextObj, EditTextObj, LinkObj, NoteObj, Rect } from '@core/objects'
import { newId, textContentHeight, rectsOverlap, objectRect, setObjectRect, SIGN_PLACE_W, IMAGE_PLACE_W } from '@core/objects'
import { extractTextSpans, type TextSpan } from '@renderer/pdf/docs'
import { drawObjects, measureTextWidthPx, effectiveBlend } from '@renderer/editor/draw'
import { cachedImage, imageUrlsOf, preloadImage } from '@renderer/editor/canvasUtil'
import { topHit, inSpan, moveObject } from '@renderer/editor/hit'
import { splitStrokesAlong } from '@renderer/editor/erase'
import { caretIndexAt, resizeTextPatch, type HandleId } from '@renderer/editor/textGeom'
import { ROTATE_CURSOR, MARK_CURSOR, cursorFor } from '@renderer/editor/cursors'
import { usePageRender } from '@renderer/hooks/usePageRender'
import { useEditor, type SearchMatch } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ui } from '@renderer/theme'
import InlineTextEditor from './InlineTextEditor'
import { NotePopover, LinkPopover, type PopAt } from './ObjectPopovers'

interface Props {
  page: PageRef
  zoom: number
}

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

const SEL_BLUE = ui.selection
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

/**
 * 터치(pointer: coarse): 핸들 상자를 36px 투명 히트 영역으로 키우고 점(12px)은 ::after 로 그린다 — 9px 점은 손가락으로 못 잡았다.
 * 마우스는 그대로 9px. 상자 자체가 커지므로 getBoundingClientRect 도 36 이다
 */
const COARSE_HIT = 36
const COARSE_HANDLE_SX = {
  '@media (pointer: coarse)': {
    width: COARSE_HIT,
    height: COARSE_HIT,
    bgcolor: 'transparent',
    border: 0,
    boxShadow: 'none',
    '&::after': {
      content: '""',
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 12,
      height: 12,
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      bgcolor: SEL_BLUE,
      border: '1.5px solid #fff',
      boxShadow: '0 0 3px rgba(0,0,0,.25)'
    }
  }
} as const

/** 선택 핸들(파란 점) 배치: 모서리 4 + 변 중간 4 = 8개. sx 는 정적이라 미리 만들어 둔다 */
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
  sx: { ...HANDLE_DOT_SX, left, top, cursor, transform: 'translate(-50%, -50%)', width: 9, height: 9, ...COARSE_HANDLE_SX }
}))

/** editText 스팬 하이라이트 상자 공통 스타일 */
const SPAN_SX = {
  position: 'absolute',
  outline: '1px solid rgba(14,116,144,.45)',
  bgcolor: 'rgba(14,116,144,.07)',
  pointerEvents: 'none'
} as const

/** 검색 일치 하이라이트 (반투명 노랑) · 현재 일치는 주황 — 클릭을 막지 않는다 */
const SEARCH_SX = { position: 'absolute', bgcolor: 'rgba(250,204,21,.45)', pointerEvents: 'none', borderRadius: '2px' } as const
const SEARCH_CUR_SX = { ...SEARCH_SX, bgcolor: 'rgba(251,146,60,.6)' } as const

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

const ROTATE_HANDLE_SX = {
  ...HANDLE_DOT_SX,
  left: '50%',
  top: '100%',
  mt: '20px',
  transform: 'translate(-50%, -1px)',
  width: 11,
  height: 11,
  cursor: ROTATE_CURSOR,
  // 터치: 36px 히트 영역, 점 중심은 원래 자리(막대 끝 + 5.5px)
  ...COARSE_HANDLE_SX,
  '@media (pointer: coarse)': { ...COARSE_HANDLE_SX['@media (pointer: coarse)'], mt: '24.5px', transform: 'translate(-50%, -50%)' }
} as const
const ROTATE_STICK_SX = { position: 'absolute', left: '50%', top: '100%', width: '1.5px', height: 20, bgcolor: SEL_BLUE, transform: 'translateX(-50%)' } as const



/** 페이지 1장 = PDF 캔버스 + 객체 오버레이 + 인터랙션 레이어 */
function PageCanvas({ page, zoom }: Props): JSX.Element {
  const t = useT()
  // 도구 스타일(펜/도형/텍스트 등)은 구독하지 않는다 — 포인터 이벤트 시점에 getState() 로 읽는다.
  // 슬라이더 하나 움직일 때 페이지 전부가 다시 렌더·재그리기되는 것을 막고, 항상 최신값을 보장한다.
  const size = useEditor((s) => s.displaySizes[page.id]) ?? DEFAULT_PAGE_SIZE
  const objects = useEditor((s) => s.objectsByPage[page.id] ?? EMPTY)
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  // 선택·마크 스타일·현재 검색 일치는 "이 페이지에 해당할 때만" 구독 — 다른 페이지의 선택/슬라이더/검색 이동에 N 페이지가 재렌더되지 않게
  const selected = useEditor((s) => (s.selected?.pageId === page.id ? s.selected : null))
  const setSelected = useEditor((s) => s.setSelected)
  const addObject = useEditor((s) => s.addObject)
  const addObjectTransient = useEditor((s) => s.addObjectTransient)
  const updateObject = useEditor((s) => s.updateObject)
  const updateObjectTransient = useEditor((s) => s.updateObjectTransient)
  const removeObject = useEditor((s) => s.removeObject)
  const removeObjectTransient = useEditor((s) => s.removeObjectTransient)
  const replaceObjects = useEditor((s) => s.replaceObjects)
  const markHistory = useEditor((s) => s.markHistory)
  const markStyle = useEditor((s) => (s.tool === 'cross' || s.tool === 'check' ? s.markStyle : null))
  const setPendingImage = useEditor((s) => s.setPendingImage)
  // 검색: 이 페이지의 일치만 구독 (store 가 페이지별로 미리 묶어둔 배열 → 참조 안정, 다른 페이지 결과엔 무반응)
  const searchMatches = useEditor((s) => s.search.matchesByPage[page.id] ?? EMPTY_MATCHES)
  const currentMatch = useEditor((s) => {
    const m = s.search.matches[s.search.current]
    return m?.pageId === page.id ? m : null
  })

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
  const [notePop, setNotePop] = useState<({ objectId: string } & PopAt) | null>(null)
  /** 링크 설정 팝업 (폼 상태는 팝업 안에서 객체의 현재 대상으로 초기화) */
  const [linkPop, setLinkPop] = useState<({ objectId: string } & PopAt) | null>(null)

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
    const missing = imageUrlsOf(objects).filter((u) => !cachedImage(u))
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


  // ── PDF 본문 렌더 (보일 때만). 완료 후 오버레이 재그리기 — 혼합 모드 백드롭이 빈 페이지로 굳지 않게 ──
  usePageRender(baseRef, page, zoom * Math.min(window.devicePixelRatio || 1, 2), visible && zoom > 0, scheduleRedraw)

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

  // ── editText: 도구 선택 시 보이는 페이지만 스팬 로드 (500쪽 문서에서 워커 요청 500개가 한꺼번에 큐잉되지 않게) ──
  useEffect(() => {
    if (tool !== 'editText' || !visible) {
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
  }, [tool, visible, page, page.extraRotation])

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
  const searchBoxes = useMemo(
    () =>
      searchMatches.length === 0
        ? null
        : searchMatches.map((m, i) => (
            <Box key={i} data-testid={m === currentMatch ? 'search-hit-current' : 'search-hit'} sx={{ ...(m === currentMatch ? SEARCH_CUR_SX : SEARCH_SX), ...rectSx(m.rect) }} />
          )),
    [searchMatches, currentMatch]
  )

  const norm = (e: React.PointerEvent): [number, number] => {
    const r = boxRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }

  const editingObj = editing ? (byId.get(editing.objectId) ?? null) : null

  /**
   * 그리기 지우개: 브러시가 지나간 경로(선분 x0,y0→x1,y1)에 닿은 "구간만" 지운다 — 계산은 erase.ts(순수).
   * 제스처당 히스토리 1단계(dragRef.moved). 결과는 스토어 갱신 한 번(replaceObjects)으로 반영.
   */
  function eraseStrokesAlong(x0: number, y0: number, x1: number, y1: number): void {
    // 렌더 클로저의 objects 는 연속 pointermove 에서 stale 해질 수 있다 → 스토어에서 직접
    const live = useEditor.getState().objectsByPage[page.id] ?? []
    const r = splitStrokesAlong(live, { x0, y0, x1, y1 }, { aspect, cssH })
    if (!r.touched) return
    if (dragRef.current && !dragRef.current.moved) {
      markHistory()
      dragRef.current.moved = true
    }
    replaceObjects(page.id, r.objects)
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
      const wN = pendingImage.kind === 'sign' ? SIGN_PLACE_W : IMAGE_PLACE_W
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
          if (hit.type === 'link') setLinkPop({ objectId: hit.id, x: e.clientX, y: e.clientY })
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
            // 원본 서체·굵기·기울임을 승계 (pdf.js 폰트 메타). 못 읽으면 툴바 기본값
            font: span.font ?? textStyle.font,
            bold: span.bold ?? textStyle.bold,
            italic: span.italic ?? textStyle.italic,
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
        // 찍기 전 컨텍스트 바에서 정한 크기·색 그대로 (커서 크기와 1:1). 이 도구일 땐 markStyle 이 구독돼 있다
        const s = markStyle!.size
        addObject(page.id, {
          id: newId(),
          type: 'shape',
          kind: tool,
          rect: { x: x - s / 2, y: y - (s * size.w) / size.h / 2, w: s, h: (s * size.w) / size.h },
          stroke: markStyle!.color,
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
      setEditing({ objectId: d.orig.id, isNew: false, caret: caretIndexAt(d.orig, x, y, { aspect, cssW, cssH }) })
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
      updateObjectTransient(page.id, d.objectId, resizeTextPatch(d.orig, d.handle, [d.startX, d.startY], [x, y], aspect))
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

  const movingNow = dragRef.current?.kind === 'move' && !!dragRef.current.objectId
  // X/체크 커서는 SVG 문자열 2개를 만들므로 입력이 같으면 재사용
  const markCursor = useMemo(
    () => ((tool === 'cross' || tool === 'check') && markStyle ? MARK_CURSOR(tool, markStyle.color, markStyle.size * size.w * zoom) : null),
    [tool, markStyle, size.w, zoom]
  )
  const cursor = cursorFor({ tool, movingNow, hoverHit, hasStrokes, markCursor })

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
      {/* 검색 일치 하이라이트 */}
      {searchBoxes}

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

      {/* 인라인 텍스트 편집기 — 내용만큼 자라는 상자 */}
      {editing && editingObj && (editingObj.type === 'text' || editingObj.type === 'editText') && (
        <InlineTextEditor
          obj={editingObj}
          value={editValue}
          cssW={cssW}
          cssH={cssH}
          caret={editing.caret}
          onChange={setEditValue}
          onCommit={commitEditing}
          onCancel={() => {
            if (editing.isNew) removeObjectTransient(page.id, editing.objectId)
            setEditing(null)
          }}
        />
      )}

      {/* 인터랙션 레이어 */}
      <Box
        data-testid="interaction-layer"
        sx={{ position: 'absolute', inset: 0, cursor, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      <NotePopover
        obj={noteObj}
        at={notePop}
        onClose={() => setNotePop(null)}
        onRemove={() => {
          if (notePop) removeObject(page.id, notePop.objectId)
          setNotePop(null)
        }}
        onChange={(text) => {
          if (notePop) updateObject(page.id, notePop.objectId, { text })
        }}
      />
      <LinkPopover
        obj={linkObj}
        at={linkPop}
        onClose={() => setLinkPop(null)}
        onCancel={() => {
          // 대상이 비어 있는(방금 그린) 링크는 취소 = 삭제
          if (linkPop && linkObj && linkObj.target.kind === 'url' && linkObj.target.url === '') removeObject(page.id, linkPop.objectId)
          setLinkPop(null)
        }}
        onApply={(target) => {
          if (linkPop) updateObject(page.id, linkPop.objectId, { target })
          setLinkPop(null)
        }}
      />
    </Box>
  )
}

/** props(page·zoom)가 같으면 다시 렌더하지 않는다 — 스크롤/다른 페이지 편집이 페이지 전부를 흔들지 않게 */
export default memo(PageCanvas)

const EMPTY: PageObject[] = []
const EMPTY_MATCHES: SearchMatch[] = []

