import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import IconButton from '@mui/material/IconButton'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import type { PageRef } from '@core/pages'
import type { PageObject, StrokeObj, TextObj, EditTextObj, LinkObj, NoteObj, Rect } from '@core/objects'
import { newId, hitTest, textBoxRect, textContentHeight, rectsOverlap } from '@core/objects'
import { renderPage, extractTextSpans, type TextSpan } from '@renderer/pdf/docs'
import { drawObjects, preloadImage, fontCss, measureTextWidthPx, effectiveBlend } from '@renderer/editor/draw'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'

interface Props {
  page: PageRef
  index: number
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

/** 선택 핸들(파란 점) 배치: 모서리 4 + 변 중간 4 = 8개 (pdfguru 스타일) */
const HANDLES: { id: HandleId; left: string; top: string; cursor: string }[] = [
  { id: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' },
  { id: 'n', left: '50%', top: '0%', cursor: 'ns-resize' },
  { id: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
  { id: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
  { id: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
  { id: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
  { id: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' },
  { id: 'w', left: '0%', top: '50%', cursor: 'ew-resize' }
]

const SEL_BLUE = '#3b82f6'
/** 텍스트 선택 박스: 글자에 바짝 붙지 않게 상하좌우로 띄우는 시각 여백(px) */
const TEXT_SEL_PAD = 7
/**
 * 회전 손잡이 전용 커서: 원형 화살표.
 * SVG 커서는 1배율로만 래스터돼 고해상도에서 흐릿하다 → image-set 으로 2x 비트맵을 함께 제공.
 * 흰 외곽선(paint-order: stroke)으로 어두운 배경에서도 또렷하게.
 */
const rotateCursorSvg = (px: number): string =>
  `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 24 24'%3E%3Cpath d='M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-8 8s3.57 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z' fill='%231f2430' stroke='white' stroke-width='1.6' paint-order='stroke' stroke-linejoin='round'/%3E%3C/svg%3E")`
const ROTATE_CURSOR = `-webkit-image-set(${rotateCursorSvg(24)} 1x, ${rotateCursorSvg(48)} 2x) 12 12, grab`

/** 그리기 지우개 커서: 속이 빈 원 (지우개 브러시 — Guru 동작). 흰 외곽선으로 어두운 배경에서도 보이게 */
const eraseCursorSvg = (px: number): string =>
  `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='8.5' fill='none' stroke='white' stroke-width='3.2'/%3E%3Ccircle cx='12' cy='12' r='8.5' fill='none' stroke='%231f2430' stroke-width='1.5'/%3E%3C/svg%3E")`
const ERASE_CURSOR = `-webkit-image-set(${eraseCursorSvg(24)} 1x, ${eraseCursorSvg(48)} 2x) 12 12, auto`

/** X/체크 도구 커서: 배치될 모양 그대로 노출한다. */
const markCursorSvg = (kind: 'cross' | 'check', color: string, px: number): string => {
  const stroke = color || '#2563eb'
  const path =
    kind === 'cross'
      ? "<path d='M8 8 L24 24 M24 8 L8 24' />"
      : "<path d='M7 17 L14 24 L25 8' />"
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 32 32'><g fill='none' stroke-linecap='round' stroke-linejoin='round'><g stroke='white' stroke-width='7'>${path}</g><g stroke='${stroke}' stroke-width='4'>${path}</g></g></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}
const MARK_CURSOR = (kind: 'cross' | 'check', color: string): string =>
  `-webkit-image-set(${markCursorSvg(kind, color, 32)} 1x, ${markCursorSvg(kind, color, 64)} 2x) 16 16, default`

/** 페이지 1장 = PDF 캔버스 + 객체 오버레이 + 인터랙션 레이어 */
export default function PageCanvas({ page, zoom }: Props): JSX.Element {
  const t = useT()
  const displaySizes = useEditor((s) => s.displaySizes)
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
  const markHistory = useEditor((s) => s.markHistory)
  const textStyle = useEditor((s) => s.textStyle)
  const penStyle = useEditor((s) => s.penStyle)
  const highlightStyle = useEditor((s) => s.highlightStyle)
  const eraserStyle = useEditor((s) => s.eraserStyle)
  const shapeStyle = useEditor((s) => s.shapeStyle)
  const pendingImage = useEditor((s) => s.pendingImage)
  const setPendingImage = useEditor((s) => s.setPendingImage)

  const size = displaySizes[page.id] ?? { w: 595, h: 842 }
  const cssW = size.w * zoom
  const cssH = size.h * zoom
  const aspect = size.w / size.h

  const baseRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const [, forceTick] = useState(0)
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

  // ── 가시성 감지 (보일 때만 PDF 렌더) ──
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '400px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── PDF 본문 렌더 ──
  useEffect(() => {
    if (!visible || !baseRef.current || zoom <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // 렌더 완료 후 오버레이 재그리기 — 혼합 모드 백드롭이 빈 페이지로 굳지 않게
    void renderPage(page, baseRef.current, zoom * dpr).then(() => bump())
  }, [visible, page, page.extraRotation, zoom])

  // ── 오버레이 렌더 ──
  // useCallback 금지: 의존성에서 빠진 tool/스타일이 stale 클로저로 잡혀 드래그 미리보기가
  // 옛 도구 스타일(예: 지우개인데 파란 도형)로 그려진다. 매 렌더 실행되는 이펙트라 메모이즈 이득도 없음.
  const redrawOverlay = async (): Promise<void> => {
    const canvas = overlayRef.current
    if (!canvas || zoom <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const imgs = objects.filter((o) => o.type === 'image') as { dataUrl: string }[]
    await Promise.all(imgs.map((o) => preloadImage(o.dataUrl).catch(() => null)))
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // 편집 중인 텍스트 객체는 캔버스에서 숨긴다 (textarea가 대신 보임).
    // 단 editText 는 cover(원본 가림)를 유지해야 하므로 텍스트만 비운 채 그린다
    const draw = objects.flatMap((o) => {
      if (o.id !== editing?.objectId) return [o]
      return o.type === 'editText' ? [{ ...o, text: '' } as PageObject] : []
    })
    // 진행 중 드래그(펜 선/도형)의 미리보기
    const d = dragRef.current
    const previews: PageObject[] = []
    if (d?.kind === 'draw' && d.points) previews.push(transientStroke(d.points))
    if (d?.kind === 'shape' && d.rect) previews.push(transientShape(d.rect))
    // 혼합 모드(multiply 등)는 페이지 픽셀을 백드롭으로 깔아야 실제로 섞인다
    // (투명 캔버스에 블렌드하면 모드 불문 동일하게 보임)
    const needBackdrop = [...draw, ...previews].some((o) => effectiveBlend(o) !== 'normal')
    if (needBackdrop && baseRef.current && baseRef.current.width > 0) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(baseRef.current, 0, 0, canvas.width, canvas.height)
    }
    drawObjects(ctx, draw, canvas.width, canvas.height, 'editor')
    if (previews.length > 0) {
      drawObjects(ctx, previews, canvas.width, canvas.height, 'editor')
    }
    if (d?.kind === 'link' && d.rect) {
      ctx.strokeStyle = '#3b82f6'
      ctx.setLineDash([4, 3])
      ctx.strokeRect(d.rect.x * canvas.width, d.rect.y * canvas.height, d.rect.w * canvas.width, d.rect.h * canvas.height)
      ctx.setLineDash([])
    }
  }

  useEffect(() => {
    void redrawOverlay()
  })

  function transientStroke(points: [number, number][]): StrokeObj {
    if (tool === 'highlight') {
      return {
        id: 'transient',
        type: 'stroke',
        kind: 'highlight',
        color: highlightStyle.color,
        width: highlightStyle.width,
        opacity: highlightStyle.opacity,
        fill: highlightStyle.fill,
        blend: highlightStyle.blend,
        points
      }
    }
    return {
      id: 'transient',
      type: 'stroke',
      kind: 'pencil',
      color: penStyle.color,
      width: penStyle.width,
      opacity: penStyle.opacity,
      fill: penStyle.fill,
      blend: penStyle.blend,
      points
    }
  }

  function transientShape(rect: Rect): PageObject {
    // 지우개 = 흰 도형으로 덮기 (pdfguru Eraser): 모양·테두리·채우기·스타일은 eraserStyle
    if (tool === 'whiteout') {
      return {
        id: 'transient',
        type: 'shape',
        kind: eraserStyle.kind,
        rect,
        stroke: eraserStyle.stroke,
        strokeWidth: eraserStyle.strokeWidth,
        fill: eraserStyle.fill,
        opacity: eraserStyle.opacity,
        dash: eraserStyle.dash
      }
    }
    return {
      id: 'transient',
      type: 'shape',
      kind: tool === 'ellipse' ? 'ellipse' : 'rect',
      rect,
      stroke: shapeStyle.stroke,
      strokeWidth: shapeStyle.strokeWidth,
      fill: shapeStyle.fill,
      opacity: shapeStyle.opacity,
      dash: shapeStyle.dash
    }
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

  const norm = (e: React.PointerEvent): [number, number] => {
    const r = boxRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }

  const editingObj = editing ? (objects.find((o) => o.id === editing.objectId) ?? null) : null

  /**
   * 그리기 지우개: 브러시가 지나간 경로(선분 x0,y0→x1,y1)에 닿은 "구간만" 지운다 — 선 전체가 아니라.
   * 닿은 점을 걷어내고 남은 연속 구간들을 각각 새 선으로 분리. 제스처당 히스토리 1단계(dragRef.moved).
   * 선분 판정인 이유: pointermove 가 병합되면 샘플 간격이 브러시보다 넓어져 중간이 건너뛰어진다.
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
    // 렌더 클로저의 objects 는 연속 pointermove 에서 stale 해질 수 있다 → 스토어에서 직접
    const live = useEditor.getState().objectsByPage[page.id] ?? []
    for (const o of live) {
      if (o.type !== 'stroke') continue
      const rr = 0.012 + o.width / 2
      const hitAt = (p: [number, number]): boolean => distToPath(p) < rr
      if (!o.points.some(hitAt)) continue
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
      const runs: [number, number][][] = []
      let cur: [number, number][] = []
      for (const p of dense) {
        if (hitAt(p)) {
          if (cur.length > 0) runs.push(cur)
          cur = []
        } else {
          cur.push(p)
        }
      }
      if (cur.length > 0) runs.push(cur)
      removeObjectTransient(page.id, o.id)
      for (const run of runs) {
        if (run.length >= 2) addObjectTransient(page.id, { ...o, id: newId(), points: run })
      }
    }
  }

  /** 클릭 지점(정규화)이 텍스트의 몇 번째 글자 앞인지 — 캐럿 초기 위치용 */
  function caretIndexFor(obj: TextObj | EditTextObj, xN: number, yN: number): number {
    const isText = obj.type === 'text'
    const rect = isText ? textBoxRect(obj) : obj.box
    // 회전 텍스트는 클릭점을 상자 로컬(비회전) 공간으로 역회전
    let px = xN
    let py = yN
    if (isText && obj.rotation) {
      const cx = (rect.x + rect.w / 2) * aspect
      const cy = rect.y + rect.h / 2
      const a = (-obj.rotation * Math.PI) / 180
      const dx = xN * aspect - cx
      const dy = yN - cy
      px = (cx + dx * Math.cos(a) - dy * Math.sin(a)) / aspect
      py = cy + dx * Math.sin(a) + dy * Math.cos(a)
    }
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
    let startX = 0
    if (isText && obj.align !== 'left') {
      const lineW = measureTextWidthPx(line, obj.size, obj.font, obj.bold, obj.italic, cssH)
      startX = obj.align === 'center' ? (rect.w * cssW - lineW) / 2 : rect.w * cssW - lineW
    }
    let idx = line.length
    for (let i = 0; i <= line.length; i++) {
      const wPrev = i === 0 ? 0 : measureTextWidthPx(line.slice(0, i), obj.size, obj.font, obj.bold, obj.italic, cssH)
      const wNext = i === line.length ? wPrev : measureTextWidthPx(line.slice(0, i + 1), obj.size, obj.font, obj.bold, obj.italic, cssH)
      if (localX < startX + (wPrev + wNext) / 2) {
        idx = i
        break
      }
    }
    return lines.slice(0, li).reduce((n, l) => n + l.length + 1, 0) + idx
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

  // ── 포인터 핸들러 ──
  function onPointerDown(e: React.PointerEvent): void {
    if (e.button !== 0 || zoom <= 0) return
    if (editing) {
      commitEditing()
      return
    }
    const [x, y] = norm(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

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
        const hit = [...objects].reverse().find((o) => hitTest(o, x, y, 0.008, aspect))
        if (hit) {
          const wasSelected = selected?.pageId === page.id && selected.objectId === hit.id
          setSelected({ pageId: page.id, objectId: hit.id })
          if (hit.type === 'note') {
            setNotePop({ objectId: hit.id, x: e.clientX, y: e.clientY })
            return
          }
          if (hit.type === 'link') {
            setLinkKind(hit.target.kind)
            setLinkValue(hit.target.kind === 'url' ? hit.target.url : String(hit.target.page))
            setLinkPop({ objectId: hit.id, x: e.clientX, y: e.clientY })
          }
          dragRef.current = { kind: 'move', objectId: hit.id, startX: x, startY: y, orig: hit, moved: false, wasSelected }
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
        const hitObj = [...objects].reverse().find((o) => o.type === 'editText' && hitTest(o, x, y, 0.008, aspect))
        if (hitObj) {
          const wasSelected = selected?.pageId === page.id && selected.objectId === hitObj.id
          setSelected({ pageId: page.id, objectId: hitObj.id })
          dragRef.current = { kind: 'move', objectId: hitObj.id, startX: x, startY: y, orig: hitObj, moved: false, wasSelected }
          break
        }
        const span = spans?.find((sp) => x >= sp.rect.x && x <= sp.rect.x + sp.rect.w && y >= sp.rect.y && y <= sp.rect.y + sp.rect.h)
        // 이미 다른 editText 의 cover 가 덮은 스팬은 무시 (이동한 객체의 원래 자리에서 중복 생성 방지)
        const coveredBy = span && objects.some((o) => o.type === 'editText' && rectsOverlap(o.cover, span.rect))
        if (span && !coveredBy) {
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
          setSelected({ pageId: page.id, objectId: obj.id })
          dragRef.current = { kind: 'move', objectId: obj.id, startX: x, startY: y, orig: obj, moved: false, wasSelected: true }
        } else if (!span) {
          setSelected(null)
        }
        break
      }
      case 'pencil':
      case 'highlight':
        dragRef.current = { kind: 'draw', startX: x, startY: y, points: [[x, y]] }
        bump()
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
        const s = 0.035
        addObject(page.id, {
          id: newId(),
          type: 'shape',
          kind: tool,
          rect: { x: x - s / 2, y: y - (s * size.w) / size.h / 2, w: s, h: (s * size.w) / size.h },
          stroke: shapeStyle.stroke,
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
            ? objects.some((o) => hitTest(o, hx, hy, 0.008, aspect))
            : objects.some((o) => o.type === 'editText' && hitTest(o, hx, hy, 0.008, aspect)) ||
              !!spans?.some((sp) => hx >= sp.rect.x && hx <= sp.rect.x + sp.rect.w && hy >= sp.rect.y && hy <= sp.rect.y + sp.rect.h)
        if (over !== hoverHit) setHoverHit(over)
      }
      return
    }
    const [x, y] = norm(e)
    if (d.kind === 'draw' && d.points) {
      d.points.push([x, y])
      bump()
    } else if ((d.kind === 'shape' || d.kind === 'link') && d.rect) {
      d.rect = { x: Math.min(d.startX, x), y: Math.min(d.startY, y), w: Math.abs(x - d.startX), h: Math.abs(y - d.startY) }
      bump()
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
    bump()
  }

  // ── 선택 객체 표시(외곽선/핸들) ──
  const selObj = selected?.pageId === page.id ? (objects.find((o) => o.id === selected.objectId) ?? null) : null
  const selRect: Rect | null = useMemo(() => {
    if (!selObj) return null
    switch (selObj.type) {
      case 'shape':
      case 'image':
      case 'link':
        return selObj.rect
      case 'editText':
        return selObj.box
      case 'text':
        return textBoxRect(selObj)
      case 'note':
        return { x: selObj.x, y: selObj.y, w: 0.03, h: 0.03 }
      default:
        return null
    }
  }, [selObj])

  const hasHandles =
    selObj && (selObj.type === 'text' || selObj.type === 'editText' || selObj.type === 'image' || selObj.type === 'shape' || selObj.type === 'link')
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
      const unrot = (px: number, py: number): [number, number] => {
        if (!rot) return [px, py]
        const a = (-rot * Math.PI) / 180
        const dx = (px - cx) * aspect
        const dy = py - cy
        return [cx + (dx * Math.cos(a) - dy * Math.sin(a)) / aspect, cy + dx * Math.sin(a) + dy * Math.cos(a)]
      }
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

    // 사각형 기반 객체(이미지/도형/링크/텍스트수정 cover): 모서리 = 반대편 고정 리사이즈, 좌우 = 폭
    const isCover = d.orig.type === 'editText'
    const r = isCover ? (d.orig as EditTextObj).box : (d.orig as { rect: Rect }).rect
    const right = r.x + r.w
    const bottom = r.y + r.h
    let nr: Rect = r
    switch (d.handle) {
      case 'se':
        nr = { x: r.x, y: r.y, w: Math.max(0.02, x - r.x), h: Math.max(0.02, y - r.y) }
        break
      case 'nw':
        nr = { x: Math.min(x, right - 0.02), y: Math.min(y, bottom - 0.02), w: 0, h: 0 }
        nr = { ...nr, w: right - nr.x, h: bottom - nr.y }
        break
      case 'ne':
        nr = { x: r.x, y: Math.min(y, bottom - 0.02), w: Math.max(0.02, x - r.x), h: 0 }
        nr = { ...nr, h: bottom - nr.y }
        break
      case 'sw':
        nr = { x: Math.min(x, right - 0.02), y: r.y, w: 0, h: Math.max(0.02, y - r.y) }
        nr = { ...nr, w: right - nr.x }
        break
      case 'e':
        nr = { ...r, w: Math.max(0.02, x - r.x) }
        break
      case 'w': {
        const nx = Math.min(x, right - 0.02)
        nr = { ...r, x: nx, w: right - nx }
        break
      }
      case 'n': {
        const ny = Math.min(y, bottom - 0.02)
        nr = { ...r, y: ny, h: bottom - ny }
        break
      }
      case 's':
        nr = { ...r, h: Math.max(0.02, y - r.y) }
        break
    }
    updateObjectTransient(page.id, d.objectId, (isCover ? { box: nr } : { rect: nr }) as Partial<PageObject>)
  }

  function onHandleUp(): void {
    if (dragRef.current?.kind === 'resize' || dragRef.current?.kind === 'rotate') dragRef.current = null
  }

  // 커서 규칙 (Guru): 객체/스팬 호버 = 포인터(👆), 잡고 있는 동안·드래그 = 이동(✥), 그 외 도구별
  const movingNow = dragRef.current?.kind === 'move' && !!dragRef.current.objectId
  const hasStrokes = objects.some((o) => o.type === 'stroke')
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
                ? MARK_CURSOR(tool, shapeStyle.stroke)
                : 'crosshair'

  const noteObj = notePop ? (objects.find((o) => o.id === notePop.objectId) as NoteObj | undefined) : undefined
  const linkObj = linkPop ? (objects.find((o) => o.id === linkPop.objectId) as LinkObj | undefined) : undefined

  return (
    <Box
      ref={boxRef}
      data-page-index
      sx={{ position: 'relative', width: cssW, height: cssH, bgcolor: '#fff', boxShadow: 2, flexShrink: 0 }}
    >
      <canvas ref={baseRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* editText 스팬 하이라이트 (이미 수정 객체가 덮은 스팬은 제외) */}
      {tool === 'editText' &&
        spans
          ?.filter((sp) => !objects.some((o) => o.type === 'editText' && rectsOverlap(o.cover, sp.rect)))
          .map((sp, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${sp.rect.x * 100}%`,
              top: `${sp.rect.y * 100}%`,
              width: `${sp.rect.w * 100}%`,
              height: `${sp.rect.h * 100}%`,
              outline: '1px solid rgba(91,91,214,.45)',
              bgcolor: 'rgba(91,91,214,.06)',
              pointerEvents: 'none'
            }}
          />
        ))}

      {/* 선택 외곽선 + 핸들 (점 6개 + 텍스트는 회전 점 1개).
          zIndex 6: 인터랙션 레이어(형제, DOM 뒤)가 핸들 클릭을 가로채지 않도록 위로 올린다 */}
      {selRect && !editing && (
        <Box
          data-testid="sel-outline"
          sx={{
            position: 'absolute',
            // 텍스트는 글자에 바짝 붙지 않게 상하좌우 여백을 두고 감싼다 (중심은 그대로 → 회전 불변)
            left: selObj?.type === 'text' ? `calc(${selRect.x * 100}% - ${TEXT_SEL_PAD}px)` : `${selRect.x * 100}%`,
            top: selObj?.type === 'text' ? `calc(${selRect.y * 100}% - ${TEXT_SEL_PAD}px)` : `${selRect.y * 100}%`,
            width: selObj?.type === 'text' ? `calc(${selRect.w * 100}% + ${TEXT_SEL_PAD * 2}px)` : `${selRect.w * 100}%`,
            height: selObj?.type === 'text' ? `calc(${selRect.h * 100}% + ${TEXT_SEL_PAD * 2}px)` : `${selRect.h * 100}%`,
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
                  <Box sx={{ position: 'absolute', left: '50%', top: '100%', width: '1.5px', height: 20, bgcolor: SEL_BLUE, transform: 'translateX(-50%)' }} />
                  <Tooltip title={t('rotateHandle')} placement="bottom" arrow>
                    <Box
                      onPointerDown={(e) => onHandleDown(e, 'rotate')}
                      onPointerMove={onHandleMove}
                      onPointerUp={onHandleUp}
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        top: '100%',
                        mt: '20px',
                        transform: 'translate(-50%, -1px)',
                        width: 11,
                        height: 11,
                        bgcolor: SEL_BLUE,
                        border: '1.5px solid #fff',
                        boxShadow: '0 0 3px rgba(0,0,0,.25)',
                        borderRadius: '50%',
                        cursor: ROTATE_CURSOR,
                        pointerEvents: 'auto',
                        touchAction: 'none'
                      }}
                    />
                  </Tooltip>
                </>
              )}
              {HANDLES.map((h) => (
                <Box
                  key={h.id}
                  onPointerDown={(e) => onHandleDown(e, 'resize', h.id)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  sx={{
                    position: 'absolute',
                    left: h.left,
                    top: h.top,
                    transform: 'translate(-50%, -50%)',
                    width: 9,
                    height: 9,
                    bgcolor: SEL_BLUE,
                    border: '1.5px solid #fff',
                    boxShadow: '0 0 3px rgba(0,0,0,.25)',
                    borderRadius: '50%',
                    cursor: h.cursor,
                    pointerEvents: 'auto',
                    touchAction: 'none'
                  }}
                />
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
              <DeleteOutlineRounded fontSize="small" />
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

const EMPTY: PageObject[] = []

/** 객체를 dx,dy 만큼 이동한 patch */
function moveObject(o: PageObject, dx: number, dy: number): Partial<PageObject> {
  switch (o.type) {
    case 'text':
    case 'note':
      return { x: o.x + dx, y: o.y + dy } as Partial<PageObject>
    case 'shape':
    case 'image':
    case 'link':
      return { rect: { ...o.rect, x: o.rect.x + dx, y: o.rect.y + dy } } as Partial<PageObject>
    case 'editText':
      // cover(원본 가림)는 남기고 텍스트 상자만 이동
      return { box: { ...o.box, x: o.box.x + dx, y: o.box.y + dy } } as Partial<PageObject>
    default:
      return {}
  }
}
