import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon'
import * as L from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * 앱 전체 아이콘 세트 = lucide: "stroke · 둥근 끝 · viewBox 24" 한 규격 1,500종이라 툴바 밖(컨텍스트 바·다이얼로그·랜딩)까지 톤이 맞는다.
 *
 * 규칙: MUI `SvgIcon` 으로 감싸 `fontSize`/`sx`/`color` 등 기존 호출부 API 를 그대로 유지한다.
 * SvgIcon 의 기본 CSS(fill: currentColor)가 lucide 의 fill="none" 속성을 덮어쓰므로 sx 로 fill:none 을 되돌린다.
 * 굵기는 1.5(DESIGN.md icon 토큰: lucide 20px stroke 1.5 round).
 */
const STROKE_WIDTH = 1.5

function wrap(Icon: LucideIcon, name: string): (props: SvgIconProps) => JSX.Element {
  const C = (props: SvgIconProps): JSX.Element => (
    <SvgIcon
      component={Icon}
      inheritViewBox
      {...({ strokeWidth: STROKE_WIDTH, 'data-testid': `${name}Icon` } as object)}
      {...props}
      sx={{ fill: 'none', ...props.sx }}
    />
  )
  C.displayName = name
  return C
}

// ── 상단 툴바 ────────────────
export const IconPages = wrap(L.PanelLeft, 'IconPages')
export const IconCursor = wrap(L.MousePointer2, 'IconCursor')
export const IconUndo = wrap(L.Undo2, 'IconUndo')
export const IconRedo = wrap(L.Redo2, 'IconRedo')
export const IconText = wrap(L.Type, 'IconText')
export const IconTextEdit = wrap(L.TextCursorInput, 'IconTextEdit')
export const IconEraser = wrap(L.Eraser, 'IconEraser')
export const IconHighlighter = wrap(L.Highlighter, 'IconHighlighter')
export const IconPen = wrap(L.Pencil, 'IconPen')
export const IconImage = wrap(L.Image, 'IconImage')
export const IconStamp = wrap(L.Stamp, 'IconStamp')
export const IconSquare = wrap(L.Square, 'IconSquare')
export const IconCircle = wrap(L.Circle, 'IconCircle')
export const IconCross = wrap(L.X, 'IconCross')
export const IconCheck = wrap(L.Check, 'IconCheck')
export const IconSign = wrap(L.Signature, 'IconSign')
export const IconWatermark = wrap(L.Droplets, 'IconWatermark')
export const IconNote = wrap(L.MessageSquare, 'IconNote')
export const IconLink = wrap(L.Link, 'IconLink')
export const IconLayout = wrap(L.LayoutTemplate, 'IconLayout')
export const IconGrid = wrap(L.LayoutGrid, 'IconGrid')
export const IconChevronDown = wrap(L.ChevronDown, 'IconChevronDown')
export const IconPageSingle = wrap(L.RectangleVertical, 'IconPageSingle')
export const IconPageDouble = wrap(L.Columns2, 'IconPageDouble')
export const IconFit = wrap(L.Maximize, 'IconFit')
export const IconScrollContinuous = wrap(L.GalleryVertical, 'IconScrollContinuous')
export const IconScrollPaged = wrap(L.Square, 'IconScrollPaged')
export const IconRotateLeft = wrap(L.RotateCcw, 'IconRotateLeft')
export const IconRotateRight = wrap(L.RotateCw, 'IconRotateRight')

// ── 그 외 화면 (옛 @mui/icons-material 대체, lucide 이름 그대로) ───────────
export const Trash2 = wrap(L.Trash2, 'Trash2')
export const FileUp = wrap(L.FileUp, 'FileUp')
export const RotateCw = wrap(L.RotateCw, 'RotateCw')
export const RotateCcw = wrap(L.RotateCcw, 'RotateCcw')
export const Plus = wrap(L.Plus, 'Plus')
export const FileText = wrap(L.FileText, 'FileText')
export const Copy = wrap(L.Copy, 'Copy')
export const ZoomIn = wrap(L.ZoomIn, 'ZoomIn')
export const ZoomOut = wrap(L.ZoomOut, 'ZoomOut')
export const AlignVerticalJustifyStart = wrap(L.AlignVerticalJustifyStart, 'AlignVerticalJustifyStart')
export const AlignVerticalJustifyCenter = wrap(L.AlignVerticalJustifyCenter, 'AlignVerticalJustifyCenter')
export const AlignVerticalJustifyEnd = wrap(L.AlignVerticalJustifyEnd, 'AlignVerticalJustifyEnd')
export const Undo2 = wrap(L.Undo2, 'Undo2')
export const Redo2 = wrap(L.Redo2, 'Redo2')
export const Type = wrap(L.Type, 'Type')
export const Shield = wrap(L.Shield, 'Shield')
export const SquareDashedMousePointer = wrap(L.SquareDashedMousePointer, 'SquareDashedMousePointer')
export const SquareDashed = wrap(L.SquareDashed, 'SquareDashed')
export const Download = wrap(L.Download, 'Download')
export const Printer = wrap(L.Printer, 'Printer')
export const Hand = wrap(L.Hand, 'Hand')
export const FilePlus = wrap(L.FilePlus, 'FilePlus')
export const EllipsisVertical = wrap(L.EllipsisVertical, 'EllipsisVertical')
export const Minus = wrap(L.Minus, 'Minus')
export const Spline = wrap(L.Spline, 'Spline')
export const Layers = wrap(L.Layers, 'Layers')
export const Languages = wrap(L.Languages, 'Languages')
export const ChevronUp = wrap(L.ChevronUp, 'ChevronUp')
export const ChevronDown = wrap(L.ChevronDown, 'ChevronDown')
export const ImageIcon = wrap(L.Image, 'ImageIcon')
export const LayoutGrid = wrap(L.LayoutGrid, 'LayoutGrid')
export const Grid3x3 = wrap(L.Grid3x3, 'Grid3x3')
export const Underline = wrap(L.Underline, 'Underline')
export const Italic = wrap(L.Italic, 'Italic')
export const Bold = wrap(L.Bold, 'Bold')
export const Baseline = wrap(L.Baseline, 'Baseline')
export const PaintBucket = wrap(L.PaintBucket, 'PaintBucket')
export const AlignLeft = wrap(L.AlignLeft, 'AlignLeft')
export const AlignCenter = wrap(L.AlignCenter, 'AlignCenter')
export const AlignRight = wrap(L.AlignRight, 'AlignRight')
export const Pencil = wrap(L.Pencil, 'Pencil')
export const FilePen = wrap(L.FilePen, 'FilePen')
export const Contrast = wrap(L.Contrast, 'Contrast')
export const Check = wrap(L.Check, 'Check')
export const Droplets = wrap(L.Droplets, 'Droplets')
export const PenLine = wrap(L.PenLine, 'PenLine')
export const Zap = wrap(L.Zap, 'Zap')
export const BookOpen = wrap(L.BookOpen, 'BookOpen')
export const Maximize = wrap(L.Maximize, 'Maximize')
export const ArrowUp = wrap(L.ArrowUp, 'ArrowUp')
export const ArrowRight = wrap(L.ArrowRight, 'ArrowRight')
export const ArrowDown = wrap(L.ArrowDown, 'ArrowDown')
export const ArrowLeft = wrap(L.ArrowLeft, 'ArrowLeft')
export const Search = wrap(L.Search, 'Search')
export const ChevronLeft = wrap(L.ChevronLeft, 'ChevronLeft')
export const ChevronRight = wrap(L.ChevronRight, 'ChevronRight')
export const X = wrap(L.X, 'X')
