import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Popover from '@mui/material/Popover'
import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import FormatBoldRounded from '@mui/icons-material/FormatBoldRounded'
import FormatItalicRounded from '@mui/icons-material/FormatItalicRounded'
import FormatUnderlinedRounded from '@mui/icons-material/FormatUnderlinedRounded'
import FormatAlignLeftRounded from '@mui/icons-material/FormatAlignLeftRounded'
import FormatAlignCenterRounded from '@mui/icons-material/FormatAlignCenterRounded'
import FormatAlignRightRounded from '@mui/icons-material/FormatAlignRightRounded'
import VerticalAlignTopRounded from '@mui/icons-material/VerticalAlignTopRounded'
import VerticalAlignCenterRounded from '@mui/icons-material/VerticalAlignCenterRounded'
import VerticalAlignBottomRounded from '@mui/icons-material/VerticalAlignBottomRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import OpacityRounded from '@mui/icons-material/OpacityRounded'
import { useEditor, type TextStyle } from '@renderer/store/editor'
import type { PageObject, TextObj, EditTextObj, ShapeObj, NoteObj, DashStyle } from '@core/objects'
import { FONT_STACKS, measureTextWidthPx } from '@renderer/editor/draw'

/** 테두리 선 스타일 선택 — 각 항목을 실제 선 모양으로 표시 */
function DashSelect({ value, onChange }: { value: DashStyle; onChange: (d: DashStyle) => void }): JSX.Element {
  const sample = (d: DashStyle): JSX.Element => (
    <Box sx={{ width: 44, borderTop: `2.5px ${d === 'solid' ? 'solid' : d === 'dotted' ? 'dotted' : 'dashed'} #1f2430`, my: '9px' }} />
  )
  return (
    <Tooltip title="테두리 스타일">
      <Select size="small" value={value} onChange={(e) => onChange(e.target.value as DashStyle)} sx={{ '& .MuiSelect-select': { py: 0.4, display: 'flex', alignItems: 'center' } }}>
        {(['solid', 'dotted', 'dashed'] as const).map((d) => (
          <MenuItem key={d} value={d}>
            {sample(d)}
          </MenuItem>
        ))}
      </Select>
    </Tooltip>
  )
}

/** pt ↔ 정규화(세로 842pt 기준) 변환 — UI 표기용 */
const ptToSize = (pt: number): number => pt / 842
const sizeToPt = (size: number): number => Math.round(size * 842)
const ptToWidth = (pt: number): number => pt / 595
const widthToPt = (w: number): number => Math.round(w * 595)

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 24, 32, 40, 56, 72]
const PEN_WIDTHS = [1, 2, 3, 5, 8, 12, 18, 30]

/** pdfguru 스타일 프리셋 팔레트 (진한 6 / 파스텔 6 / 무채색 5) */
const PALETTE: string[][] = [
  ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#d946ef'],
  ['#f87171', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#f0abfc'],
  ['#ffffff', '#d1d5db', '#9ca3af', '#4b5563', '#111111']
]

function Swatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }): JSX.Element {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        bgcolor: color,
        border: color.toLowerCase() === '#ffffff' ? '1px solid #d7dae0' : '1px solid rgba(0,0,0,.08)',
        outline: selected ? '2px solid #3b82f6' : 'none',
        outlineOffset: 1
      }}
    />
  )
}

/** "없음" 스와치 (빨간 사선 원) */
function NoneSwatch({ selected, onClick }: { selected: boolean; onClick: () => void }): JSX.Element {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: '1px solid #d7dae0',
        outline: selected ? '2px solid #3b82f6' : 'none',
        outlineOffset: 1,
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#fff',
        '&::after': {
          content: '""',
          position: 'absolute',
          left: -3,
          right: -3,
          top: '50%',
          height: 2,
          bgcolor: '#e0343f',
          transform: 'rotate(-45deg)'
        }
      }}
    />
  )
}

interface PaletteControlProps {
  value: string | null
  onChange: (c: string | null) => void
  allowNone?: boolean
  title: string
  label?: string
}

/** 색 원 버튼 → 팔레트 팝오버 (프리셋 + Custom) */
function PaletteControl({ value, onChange, allowNone, title, label }: PaletteControlProps): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const customRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <Tooltip title={title}>
        <ButtonBase
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ borderRadius: 99, px: 0.4, py: 0.2, display: 'flex', alignItems: 'center', gap: 0.3, '&:hover': { bgcolor: '#f1f2f4' } }}
        >
          {label && (
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          )}
          {value ? (
            <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: value, border: value.toLowerCase() === '#ffffff' ? '1.5px solid #d7dae0' : '1.5px solid rgba(0,0,0,.1)' }} />
          ) : (
            <Box sx={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #d7dae0', position: 'relative', overflow: 'hidden', bgcolor: '#fff', '&::after': { content: '""', position: 'absolute', left: -3, right: -3, top: '50%', height: 2, bgcolor: '#e0343f', transform: 'rotate(-45deg)' } }} />
          )}
          <ArrowDropDownRounded sx={{ fontSize: 16, ml: -0.4, color: 'text.secondary' }} />
        </ButtonBase>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box sx={{ p: 1.5 }}>
          <Stack spacing={0.8}>
            {PALETTE.map((row, ri) => (
              <Stack key={ri} direction="row" spacing={0.8}>
                {ri === PALETTE.length - 1 && allowNone && <NoneSwatch selected={value === null} onClick={() => onChange(null)} />}
                {row.map((c) => (
                  <Swatch key={c} color={c} selected={value?.toLowerCase() === c.toLowerCase()} onClick={() => onChange(c)} />
                ))}
              </Stack>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
              직접 선택
            </Typography>
            <Box>
              <ButtonBase
                onClick={() => customRef.current?.click()}
                sx={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px dashed #b9bec7', color: '#6b7280', position: 'relative' }}
              >
                <AddRounded sx={{ fontSize: 16 }} />
                <input
                  ref={customRef}
                  type="color"
                  value={value ?? '#000000'}
                  onChange={(e) => onChange(e.target.value)}
                  style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                />
              </ButtonBase>
            </Box>
          </Stack>
        </Box>
      </Popover>
    </>
  )
}

/** 불투명도: % 표시 버튼 → 슬라이더 팝오버 */
function OpacityControl({ value, onChange }: { value: number; onChange: (v: number) => void }): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <Tooltip title="불투명도 (흐리게)">
        <ButtonBase
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ borderRadius: 2, px: 0.7, py: 0.4, display: 'flex', alignItems: 'center', gap: 0.3, border: '1px solid #d7dae0', '&:hover': { bgcolor: '#f1f2f4' } }}
        >
          <OpacityRounded sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ minWidth: 34 }}>
            {Math.round(value * 100)}%
          </Typography>
          <ArrowDropDownRounded sx={{ fontSize: 16, ml: -0.4, color: 'text.secondary' }} />
        </ButtonBase>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box sx={{ px: 2, py: 1, width: 180, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Slider size="small" min={10} max={100} value={Math.round(value * 100)} onChange={(_, v) => onChange((v as number) / 100)} />
          <Typography variant="caption" sx={{ width: 38, textAlign: 'right' }}>
            {Math.round(value * 100)}%
          </Typography>
        </Box>
      </Popover>
    </>
  )
}

/** 텍스트 도구/객체 공용 컨트롤 값 */
interface TextControlValues {
  font: string
  size: number
  color: string
  bgColor: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle' | 'bottom'
  opacity: number
}

const H_ALIGNS = [
  { v: 'left' as const, icon: FormatAlignLeftRounded, label: '왼쪽 정렬' },
  { v: 'center' as const, icon: FormatAlignCenterRounded, label: '가운데 정렬' },
  { v: 'right' as const, icon: FormatAlignRightRounded, label: '오른쪽 정렬' }
]
const V_ALIGNS = [
  { v: 'top' as const, icon: VerticalAlignTopRounded, label: '위 정렬' },
  { v: 'middle' as const, icon: VerticalAlignCenterRounded, label: '세로 가운데 정렬' },
  { v: 'bottom' as const, icon: VerticalAlignBottomRounded, label: '아래 정렬' }
]

function TextControls({ v, patch }: { v: TextControlValues; patch: (p: Partial<TextControlValues>) => void }): JSX.Element {
  return (
    <>
      <Select
        size="small"
        value={v.font}
        onChange={(e) => patch({ font: e.target.value })}
        sx={{ minWidth: 140, '& .MuiSelect-select': { fontFamily: FONT_STACKS[v.font] } }}
        MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
      >
        {Object.entries(FONT_STACKS).map(([name, stack]) => (
          <MenuItem key={name} value={name} sx={{ fontFamily: stack }}>
            {name}
          </MenuItem>
        ))}
      </Select>
      <Select size="small" value={sizeToPt(v.size)} onChange={(e) => patch({ size: ptToSize(Number(e.target.value)) })}>
        {[...new Set([...FONT_SIZES, sizeToPt(v.size)])].sort((a, b) => a - b).map((pt) => (
          <MenuItem key={pt} value={pt}>
            {pt}
          </MenuItem>
        ))}
      </Select>
      <Tooltip title="굵게">
        <IconButton size="small" color={v.bold ? 'primary' : 'default'} onClick={() => patch({ bold: !v.bold })}>
          <FormatBoldRounded />
        </IconButton>
      </Tooltip>
      <Tooltip title="기울임">
        <IconButton size="small" color={v.italic ? 'primary' : 'default'} onClick={() => patch({ italic: !v.italic })}>
          <FormatItalicRounded />
        </IconButton>
      </Tooltip>
      <Tooltip title="밑줄">
        <IconButton size="small" color={v.underline ? 'primary' : 'default'} onClick={() => patch({ underline: !v.underline })}>
          <FormatUnderlinedRounded />
        </IconButton>
      </Tooltip>
      <Divider orientation="vertical" flexItem />
      {H_ALIGNS.map(({ v: a, icon: Icon, label }) => (
        <Tooltip key={a} title={label}>
          <IconButton size="small" color={v.align === a ? 'primary' : 'default'} onClick={() => patch({ align: a })}>
            <Icon />
          </IconButton>
        </Tooltip>
      ))}
      <Divider orientation="vertical" flexItem />
      {V_ALIGNS.map(({ v: a, icon: Icon, label }) => (
        <Tooltip key={a} title={label}>
          <IconButton size="small" color={v.valign === a ? 'primary' : 'default'} onClick={() => patch({ valign: a })}>
            <Icon />
          </IconButton>
        </Tooltip>
      ))}
      <Divider orientation="vertical" flexItem />
      <PaletteControl title="글자색" value={v.color} onChange={(c) => patch({ color: c ?? '#111111' })} />
      <PaletteControl title="글자 배경색" label="배경" value={v.bgColor} onChange={(c) => patch({ bgColor: c })} allowNone />
      <OpacityControl value={v.opacity} onChange={(opacity) => patch({ opacity })} />
    </>
  )
}

const NOTE_COLORS = ['#facc15', '#fb923c', '#ef4444', '#ec4899', '#3b82f6', '#22c55e']

export default function SubToolbar(): JSX.Element | null {
  const tool = useEditor((s) => s.tool)
  const selected = useEditor((s) => s.selected)
  const objectsByPage = useEditor((s) => s.objectsByPage)
  const displaySizes = useEditor((s) => s.displaySizes)
  const textStyle = useEditor((s) => s.textStyle)
  const setTextStyle = useEditor((s) => s.setTextStyle)
  const penStyle = useEditor((s) => s.penStyle)
  const setPenStyle = useEditor((s) => s.setPenStyle)
  const highlightStyle = useEditor((s) => s.highlightStyle)
  const setHighlightStyle = useEditor((s) => s.setHighlightStyle)
  const eraserStyle = useEditor((s) => s.eraserStyle)
  const setEraserStyle = useEditor((s) => s.setEraserStyle)
  const shapeStyle = useEditor((s) => s.shapeStyle)
  const setShapeStyle = useEditor((s) => s.setShapeStyle)
  const updateObject = useEditor((s) => s.updateObject)
  const removeObject = useEditor((s) => s.removeObject)

  const selObj: PageObject | null = selected
    ? (objectsByPage[selected.pageId]?.find((o) => o.id === selected.objectId) ?? null)
    : null

  const bar = (children: React.ReactNode): JSX.Element => (
    // height 고정(minHeight 아님): 도구마다 내용 높이가 다르면 페이지가 세로로 튀어 좌표가 어긋난다
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: '#fff', height: 50, flexShrink: 0, overflowX: 'auto', overflowY: 'hidden' }}>
      {children}
      {selObj && selected && (
        <>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="선택한 객체 삭제 (Delete)">
            <IconButton size="small" onClick={() => removeObject(selected.pageId, selected.objectId)}>
              <DeleteOutlineRounded />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  )

  // ── 선택된 객체 우선: 그 객체 타입의 컨트롤을 보여주고 즉시 반영 ──
  if (selObj && selected) {
    if (selObj.type === 'text') {
      const t = selObj
      const patch = (p: Partial<TextControlValues>): void => {
        // 글꼴/크기/굵기/기울임 변경은 상자 폭에 영향 → 실측 폭을 다시 저장 (H=1000 기준 정규화)
        if ('font' in p || 'size' in p || 'bold' in p || 'italic' in p) {
          const nt = { ...t, ...p } as TextObj
          const sz = displaySizes[selected.pageId] ?? { w: 595, h: 842 }
          const wPx = measureTextWidthPx(nt.text, nt.size, nt.font, nt.bold, nt.italic, 1000)
          updateObject(selected.pageId, selected.objectId, { ...p, w: Math.min(1, wPx / (1000 * (sz.w / sz.h))) } as Partial<PageObject>)
          return
        }
        updateObject(selected.pageId, selected.objectId, p as Partial<PageObject>)
      }
      return bar(<TextControls v={t} patch={patch} />)
    }
    if (selObj.type === 'editText') {
      const t = selObj as EditTextObj
      const patch = (p: Partial<EditTextObj>): void => updateObject(selected.pageId, selected.objectId, p)
      return bar(
        <>
          <Select size="small" value={t.font} onChange={(e) => patch({ font: e.target.value })} sx={{ minWidth: 140, '& .MuiSelect-select': { fontFamily: FONT_STACKS[t.font] } }}>
            {Object.entries(FONT_STACKS).map(([name, stack]) => (
              <MenuItem key={name} value={name} sx={{ fontFamily: stack }}>
                {name}
              </MenuItem>
            ))}
          </Select>
          <Select size="small" value={sizeToPt(t.size)} onChange={(e) => patch({ size: ptToSize(Number(e.target.value)) })}>
            {[...new Set([...FONT_SIZES, sizeToPt(t.size)])].sort((a, b) => a - b).map((pt) => (
              <MenuItem key={pt} value={pt}>
                {pt}
              </MenuItem>
            ))}
          </Select>
          <IconButton size="small" color={t.bold ? 'primary' : 'default'} onClick={() => patch({ bold: !t.bold })}>
            <FormatBoldRounded />
          </IconButton>
          <IconButton size="small" color={t.italic ? 'primary' : 'default'} onClick={() => patch({ italic: !t.italic })}>
            <FormatItalicRounded />
          </IconButton>
          <PaletteControl title="글자색" value={t.color} onChange={(c) => patch({ color: c ?? '#111111' })} />
          <OpacityControl value={t.opacity} onChange={(opacity) => patch({ opacity })} />
        </>
      )
    }
    if (selObj.type === 'shape') {
      const sh = selObj as ShapeObj
      const patch = (p: Partial<ShapeObj>): void => updateObject(selected.pageId, selected.objectId, p)
      return bar(
        <>
          <PaletteControl title="선 색" value={sh.stroke} onChange={(c) => patch({ stroke: c ?? '#2563eb' })} />
          <Select size="small" value={widthToPt(sh.strokeWidth)} onChange={(e) => patch({ strokeWidth: ptToWidth(Number(e.target.value)) })}>
            {PEN_WIDTHS.map((pt) => (
              <MenuItem key={pt} value={pt}>
                {pt} pt
              </MenuItem>
            ))}
          </Select>
          <DashSelect value={sh.dash ?? 'solid'} onChange={(dash) => patch({ dash })} />
          {(sh.kind === 'rect' || sh.kind === 'ellipse') && (
            <PaletteControl title="채우기 색" label="채우기" value={sh.fill} onChange={(fill) => patch({ fill })} allowNone />
          )}
          <OpacityControl value={sh.opacity} onChange={(opacity) => patch({ opacity })} />
        </>
      )
    }
    if (selObj.type === 'note') {
      const n = selObj as NoteObj
      return bar(
        <>
          <Typography variant="caption" color="text.secondary">
            노트 색
          </Typography>
          {NOTE_COLORS.map((c) => (
            <Box key={c} onClick={() => updateObject(selected.pageId, selected.objectId, { color: c })} sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: c, cursor: 'pointer', border: n.color === c ? '2px solid #1f2430' : '2px solid transparent' }} />
          ))}
        </>
      )
    }
    if (selObj.type === 'image' || selObj.type === 'stroke' || selObj.type === 'link') {
      const patch = (p: Partial<PageObject>): void => updateObject(selected.pageId, selected.objectId, p)
      return bar(<OpacityControl value={selObj.opacity} onChange={(opacity) => patch({ opacity })} />)
    }
  }

  // ── 도구별 기본 설정 ──
  switch (tool) {
    case 'addText':
    case 'editText':
      return bar(
        <>
          <TextControls v={textStyle} patch={(p) => setTextStyle(p as Partial<TextStyle>)} />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
            {tool === 'addText' ? '페이지를 클릭해 텍스트를 입력하세요' : '페이지의 텍스트를 클릭하면 수정할 수 있습니다'}
          </Typography>
        </>
      )
    case 'pencil':
      return bar(
        <>
          <PaletteControl title="색상" value={penStyle.color} onChange={(c) => setPenStyle({ color: c ?? '#2563eb' })} />
          <Select size="small" value={widthToPt(penStyle.width)} onChange={(e) => setPenStyle({ width: ptToWidth(Number(e.target.value)) })}>
            {PEN_WIDTHS.map((pt) => (
              <MenuItem key={pt} value={pt}>
                {pt} pt
              </MenuItem>
            ))}
          </Select>
          <OpacityControl value={penStyle.opacity} onChange={(opacity) => setPenStyle({ opacity })} />
        </>
      )
    case 'highlight':
      return bar(
        <>
          <PaletteControl title="색상" value={highlightStyle.color} onChange={(c) => setHighlightStyle({ color: c ?? '#facc15' })} />
          <Select size="small" value={widthToPt(highlightStyle.width)} onChange={(e) => setHighlightStyle({ width: ptToWidth(Number(e.target.value)) })}>
            {[8, 12, 18, 30, 45].map((pt) => (
              <MenuItem key={pt} value={pt}>
                {pt} pt
              </MenuItem>
            ))}
          </Select>
          <OpacityControl value={highlightStyle.opacity} onChange={(opacity) => setHighlightStyle({ opacity })} />
        </>
      )
    case 'whiteout':
      // 지우개 = 도형으로 덮기 (Guru Eraser). 도형 선택은 메인 툴바의 도형 버튼(연동)에서
      return bar(
        <>
          <PaletteControl title="테두리 색" value={eraserStyle.stroke} onChange={(c) => setEraserStyle({ stroke: c ?? '#ffffff' })} />
          <Select size="small" value={widthToPt(eraserStyle.strokeWidth)} onChange={(e) => setEraserStyle({ strokeWidth: ptToWidth(Number(e.target.value)) })}>
            {PEN_WIDTHS.map((pt) => (
              <MenuItem key={pt} value={pt}>
                {pt} pt
              </MenuItem>
            ))}
          </Select>
          <DashSelect value={eraserStyle.dash} onChange={(dash) => setEraserStyle({ dash })} />
          <PaletteControl title="채우기 색" label="채우기" value={eraserStyle.fill} onChange={(c) => setEraserStyle({ fill: c ?? '#ffffff' })} />
          <OpacityControl value={eraserStyle.opacity} onChange={(opacity) => setEraserStyle({ opacity })} />
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            드래그한 영역을 덮어서 지웁니다
          </Typography>
        </>
      )
    case 'eraseDrawing':
      return bar(
        <Typography variant="caption" color="text.secondary">
          연필·형광펜 선을 클릭하거나 문질러 지웁니다
        </Typography>
      )
    case 'rect':
    case 'ellipse':
    case 'cross':
    case 'check':
      return bar(
        <>
          <PaletteControl title="선 색" value={shapeStyle.stroke} onChange={(c) => setShapeStyle({ stroke: c ?? '#2563eb' })} />
          <Select size="small" value={widthToPt(shapeStyle.strokeWidth)} onChange={(e) => setShapeStyle({ strokeWidth: ptToWidth(Number(e.target.value)) })}>
            {PEN_WIDTHS.map((pt) => (
              <MenuItem key={pt} value={pt}>
                {pt} pt
              </MenuItem>
            ))}
          </Select>
          <DashSelect value={shapeStyle.dash} onChange={(dash) => setShapeStyle({ dash })} />
          {(tool === 'rect' || tool === 'ellipse') && (
            <PaletteControl title="채우기 색" label="채우기" value={shapeStyle.fill} onChange={(fill) => setShapeStyle({ fill })} allowNone />
          )}
          {(tool === 'rect' || tool === 'ellipse') && (
            <Typography variant="caption" color="text.secondary">
              드래그해서 그리기
            </Typography>
          )}
          {(tool === 'cross' || tool === 'check') && (
            <Typography variant="caption" color="text.secondary">
              클릭한 위치에 표시
            </Typography>
          )}
        </>
      )
    case 'note':
      return bar(
        <Typography variant="caption" color="text.secondary">
          페이지를 클릭하면 노트가 붙습니다
        </Typography>
      )
    case 'link':
      return bar(
        <Typography variant="caption" color="text.secondary">
          링크를 걸 영역을 드래그하세요
        </Typography>
      )
    default:
      // 항상 바를 렌더한다 (pdfguru처럼 서식 줄 상시 표시).
      // 사라지면 문서 전체가 세로로 튀어(레이아웃 점프) 클릭 위치가 어긋난다.
      return bar(<TextControls v={textStyle} patch={(p) => setTextStyle(p as Partial<TextStyle>)} />)
  }
}
