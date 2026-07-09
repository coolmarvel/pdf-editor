/**
 * 편집 객체 캔버스 렌더러 — 라이브 오버레이와 PDF 내보내기가 같은 코드를 쓴다(1:1 보장).
 *
 * mode 'editor': 링크 영역·노트 아이콘도 표시(화면 안내용).
 * mode 'export': 링크/노트는 그리지 않는다 — 저장 시 실제 PDF 주석(Annot)으로 들어가기 때문.
 */
import type { PageObject, TextObj, EditTextObj, StrokeObj, ShapeObj, Rect, BlendMode } from '@core/objects'

/**
 * 객체의 실효 혼합 모드. 'normal' 이 아니면 백드롭(페이지 픽셀) 위에서 합성해야
 * 모드별 차이가 실제로 보인다 — 투명 캔버스에 블렌드하면 전부 똑같아 보임.
 */
export function effectiveBlend(o: PageObject): BlendMode {
  return o.type === 'stroke' ? (o.blend ?? (o.kind === 'highlight' ? 'multiply' : 'normal')) : 'normal'
}

/** 선택 가능한 폰트 (Windows 기본 탑재 위주 — 오버레이 굽기가 캔버스 렌더라 설치된 폰트면 저장도 동일) */
export const FONT_STACKS: Record<string, string> = {
  Helvetica: `Helvetica, Arial, sans-serif`,
  Arial: `Arial, sans-serif`,
  Calibri: `Calibri, sans-serif`,
  'Century Gothic': `'Century Gothic', 'Segoe UI', sans-serif`,
  Consolas: `Consolas, monospace`,
  Courier: `'Courier New', Courier, monospace`,
  Georgia: `Georgia, serif`,
  Impact: `Impact, sans-serif`,
  'Lucida Sans': `'Lucida Sans', 'Lucida Sans Unicode', sans-serif`,
  'Segoe UI': `'Segoe UI', sans-serif`,
  Tahoma: `Tahoma, sans-serif`,
  Times: `'Times New Roman', Times, serif`,
  'Trebuchet MS': `'Trebuchet MS', sans-serif`,
  Verdana: `Verdana, sans-serif`,
  맑은고딕: `'Malgun Gothic', '맑은 고딕', sans-serif`,
  바탕: `Batang, '바탕', serif`,
  굴림: `Gulim, '굴림', sans-serif`
}

export function fontCss(family: string): string {
  return FONT_STACKS[family] ?? FONT_STACKS['Helvetica']
}

function drawStroke(ctx: CanvasRenderingContext2D, s: StrokeObj, W: number, H: number): void {
  if (s.points.length === 0) return
  const blend = s.blend ?? (s.kind === 'highlight' ? 'multiply' : 'normal')
  ctx.globalCompositeOperation = blend === 'normal' ? 'source-over' : blend
  ctx.globalAlpha = s.opacity
  ctx.strokeStyle = s.kind === 'whiteout' ? '#ffffff' : s.color
  ctx.lineWidth = Math.max(1, s.width * W)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  const [x0, y0] = s.points[0]
  ctx.moveTo(x0 * W, y0 * H)
  if (s.points.length === 1) ctx.lineTo(x0 * W + 0.1, y0 * H)
  else for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0] * W, s.points[i][1] * H)
  // 채우기: 경로 내부를 먼저 칠하고 그 위에 선
  if (s.fill) {
    ctx.fillStyle = s.fill
    ctx.fill()
  }
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

function textCssFont(size: number, family: string, bold: boolean, italic: boolean, H: number): string {
  return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${Math.max(6, size * H)}px ${fontCss(family)}`
}

export function drawTextObj(ctx: CanvasRenderingContext2D, t: TextObj, W: number, H: number): void {
  ctx.save()
  ctx.globalAlpha = t.opacity
  ctx.font = textCssFont(t.size, t.font, t.bold, t.italic, H)
  ctx.textBaseline = 'top'
  const px = Math.max(6, t.size * H)
  const lh = px * 1.25
  const lines = t.text.split('\n')
  // textBoxRect(선택 외곽선·히트테스트)와 같은 기준: 실측 폭 + 명시 높이(없으면 내용 높이)
  const blockH = lh * lines.length
  const boxW = Math.max(t.w * W, Math.max(...lines.map((l) => ctx.measureText(l).width), 1))
  const boxH = t.h > 0 ? Math.max(t.h * H, blockH) : blockH
  const rot = t.rotation ?? 0
  if (rot !== 0) {
    // 상자 중심 기준 회전 (히트테스트·선택 UI와 동일 기준)
    const cx = t.x * W + boxW / 2
    const cy = t.y * H + boxH / 2
    ctx.translate(cx, cy)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  if (t.bgColor) {
    const pad = px * 0.12
    ctx.fillStyle = t.bgColor
    ctx.fillRect(t.x * W - pad, t.y * H - pad, boxW + pad * 2, boxH + pad * 2)
  }
  // 세로 정렬: 상자가 내용보다 클 때 글줄 블록을 위/중앙/아래로
  const valign = t.valign ?? 'top'
  const offY = valign === 'middle' ? (boxH - blockH) / 2 : valign === 'bottom' ? boxH - blockH : 0
  ctx.fillStyle = t.color
  // 반행간(half-leading): 글자를 줄박스(1.25em) 세로 중앙에 — CSS line-height 와 동일 규칙.
  // 이게 없으면 캔버스(textBaseline=top)가 줄박스 맨 위에 붙여 그려 위로 쏠려 보인다.
  const halfLeading = (lh - px) / 2
  lines.forEach((line, i) => {
    let x = t.x * W
    const lw = ctx.measureText(line).width
    if (t.align === 'center') x += (boxW - lw) / 2
    else if (t.align === 'right') x += boxW - lw
    const y = t.y * H + offY + i * lh + halfLeading
    ctx.fillText(line, x, y)
    if (t.underline && line.length > 0) {
      ctx.fillRect(x, y + px * 1.02, lw, Math.max(1, px / 14))
    }
  })
  ctx.restore()
}

let measureCtx: CanvasRenderingContext2D | null = null

/** 텍스트 객체의 실측 폭(px). 편집 확정 시 정규화 폭(w) 저장용 */
export function measureTextWidthPx(text: string, size: number, font: string, bold: boolean, italic: boolean, H: number): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!
  measureCtx.font = textCssFont(size, font, bold, italic, H)
  const lines = text.split('\n')
  return Math.max(...lines.map((l) => measureCtx!.measureText(l).width), 1)
}

function drawEditText(ctx: CanvasRenderingContext2D, t: EditTextObj, W: number, H: number): void {
  // 원본 덮기 — cover 는 이동과 무관하게 원래 자리에 남는다.
  // pdf.js 스팬 rect 가 글리프 상단/하단을 1~2px 못 덮는 경우가 있어 세로 여유를 더 준다
  ctx.fillStyle = '#ffffff'
  const padX = t.cover.h * H * 0.08 + 1.5
  const padY = t.cover.h * H * 0.18 + 1.5
  ctx.fillRect(t.cover.x * W - padX, t.cover.y * H - padY, t.cover.w * W + padX * 2, t.cover.h * H + padY * 2)
  // 새 텍스트는 box 위치에
  const box = t.box ?? t.cover
  ctx.globalAlpha = t.opacity
  ctx.fillStyle = t.color
  ctx.font = textCssFont(t.size, t.font, t.bold, t.italic, H)
  ctx.textBaseline = 'top'
  ctx.fillText(t.text, box.x * W, box.y * H)
  ctx.globalAlpha = 1
}

function drawShape(ctx: CanvasRenderingContext2D, sh: ShapeObj, W: number, H: number): void {
  const r: Rect = sh.rect
  const x = r.x * W
  const y = r.y * H
  const w = r.w * W
  const h = r.h * H
  ctx.globalAlpha = sh.opacity
  ctx.strokeStyle = sh.stroke
  const lw = Math.max(1, sh.strokeWidth * W)
  ctx.lineWidth = lw
  ctx.lineCap = sh.dash === 'dotted' ? 'butt' : 'round'
  ctx.lineJoin = 'round'
  // 테두리 선 스타일 (굵기에 비례)
  ctx.setLineDash(sh.dash === 'dotted' ? [lw, lw * 1.6] : sh.dash === 'dashed' ? [lw * 3, lw * 2] : [])
  switch (sh.kind) {
    case 'rect':
      if (sh.fill) {
        ctx.fillStyle = sh.fill
        ctx.fillRect(x, y, w, h)
      }
      ctx.strokeRect(x, y, w, h)
      break
    case 'ellipse':
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      if (sh.fill) {
        ctx.fillStyle = sh.fill
        ctx.fill()
      }
      ctx.stroke()
      break
    case 'cross':
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w, y + h)
      ctx.moveTo(x + w, y)
      ctx.lineTo(x, y + h)
      ctx.stroke()
      break
    case 'check':
      ctx.beginPath()
      ctx.moveTo(x, y + h * 0.55)
      ctx.lineTo(x + w * 0.38, y + h)
      ctx.lineTo(x + w, y)
      ctx.stroke()
      break
  }
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

const imgCache = new Map<string, HTMLImageElement>()

/** dataUrl 이미지를 미리 로드(오버레이 렌더는 동기라서 사전 로드 필요) */
export function preloadImage(dataUrl: string): Promise<HTMLImageElement> {
  const hit = imgCache.get(dataUrl)
  if (hit && hit.complete) return Promise.resolve(hit)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
    imgCache.set(dataUrl, img)
  })
}

function drawNoteIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color
  ctx.beginPath()
  const r = size * 0.18
  // 말풍선 몸통
  ctx.roundRect(x, y, size, size * 0.8, r)
  ctx.fill()
  // 꼬리
  ctx.beginPath()
  ctx.moveTo(x + size * 0.2, y + size * 0.78)
  ctx.lineTo(x + size * 0.2, y + size)
  ctx.lineTo(x + size * 0.45, y + size * 0.78)
  ctx.closePath()
  ctx.fill()
}

export type DrawMode = 'editor' | 'export'

/**
 * 페이지의 객체들을 캔버스에 그린다. W,H = 캔버스 픽셀 크기.
 * 이미지 객체는 preloadImage 로 캐시에 올라와 있어야 그려진다(없으면 건너뜀).
 */
export function drawObjects(ctx: CanvasRenderingContext2D, objects: PageObject[], W: number, H: number, mode: DrawMode): void {
  ctx.save()
  for (const o of objects) {
    switch (o.type) {
      case 'stroke':
        drawStroke(ctx, o, W, H)
        break
      case 'text':
        drawTextObj(ctx, o, W, H)
        break
      case 'editText':
        drawEditText(ctx, o, W, H)
        break
      case 'shape':
        drawShape(ctx, o, W, H)
        break
      case 'image': {
        const img = imgCache.get(o.dataUrl)
        if (img && img.complete) {
          ctx.globalAlpha = o.opacity
          ctx.drawImage(img, o.rect.x * W, o.rect.y * H, o.rect.w * W, o.rect.h * H)
          ctx.globalAlpha = 1
        }
        break
      }
      case 'note':
        if (mode === 'editor') drawNoteIcon(ctx, o.x * W, o.y * H, 0.028 * W, o.color)
        break
      case 'link':
        if (mode === 'editor') {
          ctx.strokeStyle = '#3b82f6'
          ctx.setLineDash([4, 3])
          ctx.lineWidth = 1.5
          ctx.strokeRect(o.rect.x * W, o.rect.y * H, o.rect.w * W, o.rect.h * H)
          ctx.setLineDash([])
        }
        break
    }
  }
  ctx.restore()
}
