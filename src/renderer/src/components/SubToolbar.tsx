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
import FormatColorTextRounded from '@mui/icons-material/FormatColorTextRounded'
import FormatColorFillRounded from '@mui/icons-material/FormatColorFillRounded'
import BorderColorRounded from '@mui/icons-material/BorderColorRounded'
import ContrastRounded from '@mui/icons-material/ContrastRounded'
import LineWeightRounded from '@mui/icons-material/LineWeightRounded'
import LineStyleRounded from '@mui/icons-material/LineStyleRounded'
import LayersRounded from '@mui/icons-material/LayersRounded'
import TextFieldsRounded from '@mui/icons-material/TextFieldsRounded'
import { useEditor, type TextStyle } from '@renderer/store/editor'
import type { PageObject, TextObj, EditTextObj, ShapeObj, NoteObj, StrokeObj, DashStyle, BlendMode } from '@core/objects'
import { FONT_STACKS, measureTextWidthPx } from '@renderer/editor/draw'
import { useT, type I18nKey } from '@renderer/i18n'
import { ui } from '@renderer/theme'

/**
 * 컨텍스트 바 (Guru 문법): 컨트롤마다 [의미 아이콘] + [36px 통일 높이 박스] 로 묶고
 * 그룹 사이는 세로 구분선. 어떤 도구든 같은 규칙으로 읽힌다.
 */

/** 그룹: 회색 의미 아이콘 + 컨트롤 (아이콘에 툴팁) */
function Group({ icon, tooltip, children }: { icon?: React.ReactNode; tooltip?: string; children: React.ReactNode }): JSX.Element {
  const iconBox = icon ? <Box sx={{ display: 'flex', color: ui.gray[500], '& svg': { fontSize: 20 } }}>{icon}</Box> : null
  return (
    <Stack direction="row" alignItems="center" spacing={0.7} sx={{ flexShrink: 0 }}>
      {iconBox && (tooltip ? <Tooltip title={tooltip}>{iconBox}</Tooltip> : iconBox)}
      {children}
    </Stack>
  )
}

function GDivider(): JSX.Element {
  return <Divider orientation="vertical" flexItem sx={{ my: 1 }} />
}

/** 통일된 컨트롤 높이 (Guru 36px) */
const CTL_H = 36
const selectSx = {
  height: CTL_H,
  bgcolor: '#fff',
  '& .MuiSelect-select': { py: 0.5, display: 'flex', alignItems: 'center' }
} as const

/** 박스형 트리거 버튼 공통 스타일 (팔레트/불투명도) */
const boxBtnSx = {
  height: CTL_H,
  px: 0.8,
  borderRadius: 2,
  border: `1px solid ${ui.gray[300]}`,
  bgcolor: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 0.3,
  boxShadow: ui.shadow.xs,
  '&:hover': { bgcolor: ui.gray[50] }
} as const

/** 혼합 모드 (캔버스 globalCompositeOperation 과 1:1, Guru 목록 동일) */
const BLEND_MODES: { v: BlendMode; label: string }[] = [
  { v: 'normal', label: 'Normal' },
  { v: 'multiply', label: 'Multiply' },
  { v: 'screen', label: 'Screen' },
  { v: 'overlay', label: 'Overlay' },
  { v: 'darken', label: 'Darken' },
  { v: 'lighten', label: 'Lighten' },
  { v: 'color-dodge', label: 'Color Dodge' },
  { v: 'color-burn', label: 'Color Burn' },
  { v: 'hard-light', label: 'Hard Light' },
  { v: 'soft-light', label: 'Soft Light' },
  { v: 'difference', label: 'Difference' },
  { v: 'exclusion', label: 'Exclusion' }
]

function BlendSelect({ value, onChange }: { value: BlendMode; onChange: (b: BlendMode) => void }): JSX.Element {
  const t = useT()
  return (
    <Group icon={<LayersRounded />} tooltip={t('blendMode')}>
      <Select size="small" value={value} onChange={(e) => onChange(e.target.value as BlendMode)} sx={{ ...selectSx, minWidth: 118 }} MenuProps={{ PaperProps: { sx: { maxHeight: 380 } } }}>
        {BLEND_MODES.map((b) => (
          <MenuItem key={b.v} value={b.v}>
            {b.label}
          </MenuItem>
        ))}
      </Select>
    </Group>
  )
}

/** 테두리 선 스타일 — 항목을 실제 선 모양으로 표시 */
function DashSelect({ value, onChange }: { value: DashStyle; onChange: (d: DashStyle) => void }): JSX.Element {
  const t = useT()
  const sample = (d: DashStyle): JSX.Element => (
    <Box sx={{ width: 40, borderTop: `2.5px ${d === 'solid' ? 'solid' : d === 'dotted' ? 'dotted' : 'dashed'} ${ui.gray[800]}`, my: '9px' }} />
  )
  return (
    <Group icon={<LineStyleRounded />} tooltip={t('borderStyle')}>
      <Select size="small" value={value} onChange={(e) => onChange(e.target.value as DashStyle)} sx={selectSx}>
        {(['solid', 'dotted', 'dashed'] as const).map((d) => (
          <MenuItem key={d} value={d}>
            {sample(d)}
          </MenuItem>
        ))}
      </Select>
    </Group>
  )
}

/** pt ↔ 정규화(세로 842pt 기준) 변환 — UI 표기용 */
const ptToSize = (pt: number): number => pt / 842
const sizeToPt = (size: number): number => Math.round(size * 842)
const ptToWidth = (pt: number): number => pt / 595
const widthToPt = (w: number): number => Math.round(w * 595)

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 24, 32, 40, 56, 72]
const PEN_WIDTHS = [1, 2, 3, 5, 8, 12, 18, 30]

/** 선 굵기 셀렉트 (≡ 아이콘 + pt 목록, 현재 값 포함 보장) */
function WidthSelect({ value, onChange, list = PEN_WIDTHS }: { value: number; onChange: (w: number) => void; list?: number[] }): JSX.Element {
  const t = useT()
  const pt = widthToPt(value)
  return (
    <Group icon={<LineWeightRounded />} tooltip={t('thickness')}>
      <Select size="small" value={pt} onChange={(e) => onChange(ptToWidth(Number(e.target.value)))} sx={{ ...selectSx, minWidth: 78 }}>
        {[...new Set([...list, pt])].sort((a, b) => a - b).map((p) => (
          <MenuItem key={p} value={p}>
            {p} pt
          </MenuItem>
        ))}
      </Select>
    </Group>
  )
}

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
        border: color.toLowerCase() === '#ffffff' ? `1px solid ${ui.gray[300]}` : '1px solid rgba(0,0,0,.08)',
        outline: selected ? '2px solid #3b82f6' : 'none',
        outlineOffset: 1
      }}
    />
  )
}

/** "없음" 표시 (빨간 사선 원) — onClick 있으면 버튼 */
function NoneSwatch({ selected, onClick, size = 24 }: { selected?: boolean; onClick?: () => void; size?: number }): JSX.Element {
  const sx = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `1px solid ${ui.gray[300]}`,
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
  } as const
  return onClick ? <ButtonBase onClick={onClick} sx={sx} /> : <Box sx={sx} />
}

interface PaletteControlProps {
  value: string | null
  onChange: (c: string | null) => void
  allowNone?: boolean
  title: string
  icon?: React.ReactNode
}

/** [아이콘] + 박스형 색 버튼(스와치+⌄) → 팔레트 팝오버 (Guru 스타일) */
function PaletteControl({ value, onChange, allowNone, title, icon }: PaletteControlProps): JSX.Element {
  const t = useT()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const customRef = useRef<HTMLInputElement>(null)
  return (
    <Group icon={icon} tooltip={title}>
      <Tooltip title={title}>
        <ButtonBase onClick={(e) => setAnchor(e.currentTarget)} sx={boxBtnSx}>
          {value ? (
            <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: value, border: value.toLowerCase() === '#ffffff' ? `1.5px solid ${ui.gray[300]}` : '1.5px solid rgba(0,0,0,.1)' }} />
          ) : (
            <NoneSwatch size={18} />
          )}
          <ArrowDropDownRounded sx={{ fontSize: 18, color: ui.gray[500] }} />
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
              {t('customColor')}
            </Typography>
            <Box>
              <ButtonBase
                onClick={() => customRef.current?.click()}
                sx={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px dashed ${ui.gray[400]}`, color: ui.gray[500], position: 'relative' }}
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
    </Group>
  )
}

/** 불투명도: [◐ 아이콘] + 박스형 % 버튼 → 슬라이더 팝오버 */
function OpacityControl({ value, onChange }: { value: number; onChange: (v: number) => void }): JSX.Element {
  const t = useT()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <Group icon={<ContrastRounded />} tooltip={t('opacity')}>
      <Tooltip title={t('opacity')}>
        <ButtonBase onClick={(e) => setAnchor(e.currentTarget)} sx={{ ...boxBtnSx, px: 1 }}>
          <Typography sx={{ fontSize: 14.5, minWidth: 38, textAlign: 'left' }}>{Math.round(value * 100)}%</Typography>
          <ArrowDropDownRounded sx={{ fontSize: 18, color: ui.gray[500] }} />
        </ButtonBase>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box sx={{ px: 2, py: 1, width: 190, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Slider size="small" min={10} max={100} value={Math.round(value * 100)} onChange={(_, v) => onChange((v as number) / 100)} />
          <Typography variant="caption" sx={{ width: 40, textAlign: 'right' }}>
            {Math.round(value * 100)}%
          </Typography>
        </Box>
      </Popover>
    </Group>
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
  { v: 'left' as const, icon: FormatAlignLeftRounded, label: 'alignLeft' as I18nKey },
  { v: 'center' as const, icon: FormatAlignCenterRounded, label: 'alignCenter' as I18nKey },
  { v: 'right' as const, icon: FormatAlignRightRounded, label: 'alignRight' as I18nKey }
]
const V_ALIGNS = [
  { v: 'top' as const, icon: VerticalAlignTopRounded, label: 'alignTop' as I18nKey },
  { v: 'middle' as const, icon: VerticalAlignCenterRounded, label: 'alignMiddle' as I18nKey },
  { v: 'bottom' as const, icon: VerticalAlignBottomRounded, label: 'alignBottom' as I18nKey }
]

/** 토글형 아이콘 버튼 (B/I/U, 정렬) — 켜지면 브랜드 틴트 */
function TIcon({ title, on, onClick, children }: { title: string; on?: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          color: on ? 'primary.main' : ui.gray[700],
          bgcolor: on ? 'primary.light' : 'transparent',
          '&:hover': { bgcolor: on ? 'primary.light' : ui.gray[100] }
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  )
}

function TextControls({ v, patch }: { v: TextControlValues; patch: (p: Partial<TextControlValues>) => void }): JSX.Element {
  const t = useT()
  return (
    <>
      <Group icon={<TextFieldsRounded />}>
        <Select
          size="small"
          value={v.font}
          onChange={(e) => patch({ font: e.target.value })}
          sx={{ ...selectSx, minWidth: 132, '& .MuiSelect-select': { py: 0.5, fontFamily: FONT_STACKS[v.font] } }}
          MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
        >
          {Object.entries(FONT_STACKS).map(([name, stack]) => (
            <MenuItem key={name} value={name} sx={{ fontFamily: stack }}>
              {name}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={sizeToPt(v.size)} onChange={(e) => patch({ size: ptToSize(Number(e.target.value)) })} sx={{ ...selectSx, minWidth: 66 }}>
          {[...new Set([...FONT_SIZES, sizeToPt(v.size)])].sort((a, b) => a - b).map((pt) => (
            <MenuItem key={pt} value={pt}>
              {pt}
            </MenuItem>
          ))}
        </Select>
      </Group>
      <GDivider />
      <Group>
        <TIcon title={t('bold')} on={v.bold} onClick={() => patch({ bold: !v.bold })}>
          <FormatBoldRounded fontSize="small" />
        </TIcon>
        <TIcon title={t('italic')} on={v.italic} onClick={() => patch({ italic: !v.italic })}>
          <FormatItalicRounded fontSize="small" />
        </TIcon>
        <TIcon title={t('underline')} on={v.underline} onClick={() => patch({ underline: !v.underline })}>
          <FormatUnderlinedRounded fontSize="small" />
        </TIcon>
      </Group>
      <GDivider />
      <Group>
        {H_ALIGNS.map(({ v: a, icon: Icon, label }) => (
          <TIcon key={a} title={t(label)} on={v.align === a} onClick={() => patch({ align: a })}>
            <Icon fontSize="small" />
          </TIcon>
        ))}
      </Group>
      <GDivider />
      <Group>
        {V_ALIGNS.map(({ v: a, icon: Icon, label }) => (
          <TIcon key={a} title={t(label)} on={v.valign === a} onClick={() => patch({ valign: a })}>
            <Icon fontSize="small" />
          </TIcon>
        ))}
      </Group>
      <GDivider />
      <PaletteControl icon={<FormatColorTextRounded />} title={t('textColor')} value={v.color} onChange={(c) => patch({ color: c ?? '#111111' })} />
      <PaletteControl icon={<FormatColorFillRounded />} title={t('bgColor')} value={v.bgColor} onChange={(bgColor) => patch({ bgColor })} allowNone />
      <OpacityControl value={v.opacity} onChange={(opacity) => patch({ opacity })} />
    </>
  )
}

const NOTE_COLORS = ['#facc15', '#fb923c', '#ef4444', '#ec4899', '#3b82f6', '#22c55e']

export default function SubToolbar(): JSX.Element | null {
  const t = useT()
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: '#fff', height: 52, flexShrink: 0, overflowX: 'auto', overflowY: 'hidden' }}>
      {children}
      {selObj && selected && (
        <>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={t('deleteSelected')}>
            <IconButton size="small" onClick={() => removeObject(selected.pageId, selected.objectId)}>
              <DeleteOutlineRounded />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  )

  const hint = (key: I18nKey): JSX.Element => (
    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
      {t(key)}
    </Typography>
  )

  // ── 선택된 객체 우선: 그 객체 타입의 컨트롤을 보여주고 즉시 반영 ──
  if (selObj && selected) {
    if (selObj.type === 'text') {
      const obj = selObj
      const patch = (p: Partial<TextControlValues>): void => {
        // 글꼴/크기/굵기/기울임 변경은 상자 폭에 영향 → 실측 폭을 다시 저장 (H=1000 기준 정규화)
        if ('font' in p || 'size' in p || 'bold' in p || 'italic' in p) {
          const nt = { ...obj, ...p } as TextObj
          const sz = displaySizes[selected.pageId] ?? { w: 595, h: 842 }
          const wPx = measureTextWidthPx(nt.text, nt.size, nt.font, nt.bold, nt.italic, 1000)
          updateObject(selected.pageId, selected.objectId, { ...p, w: Math.min(1, wPx / (1000 * (sz.w / sz.h))) } as Partial<PageObject>)
          return
        }
        updateObject(selected.pageId, selected.objectId, p as Partial<PageObject>)
      }
      return bar(<TextControls v={obj} patch={patch} />)
    }
    if (selObj.type === 'editText') {
      const et = selObj as EditTextObj
      const patch = (p: Partial<EditTextObj>): void => updateObject(selected.pageId, selected.objectId, p)
      return bar(
        <>
          <Group icon={<TextFieldsRounded />}>
            <Select size="small" value={et.font} onChange={(e) => patch({ font: e.target.value })} sx={{ ...selectSx, minWidth: 132, '& .MuiSelect-select': { py: 0.5, fontFamily: FONT_STACKS[et.font] } }}>
              {Object.entries(FONT_STACKS).map(([name, stack]) => (
                <MenuItem key={name} value={name} sx={{ fontFamily: stack }}>
                  {name}
                </MenuItem>
              ))}
            </Select>
            <Select size="small" value={sizeToPt(et.size)} onChange={(e) => patch({ size: ptToSize(Number(e.target.value)) })} sx={{ ...selectSx, minWidth: 66 }}>
              {[...new Set([...FONT_SIZES, sizeToPt(et.size)])].sort((a, b) => a - b).map((pt) => (
                <MenuItem key={pt} value={pt}>
                  {pt}
                </MenuItem>
              ))}
            </Select>
          </Group>
          <GDivider />
          <Group>
            <TIcon title={t('bold')} on={et.bold} onClick={() => patch({ bold: !et.bold })}>
              <FormatBoldRounded fontSize="small" />
            </TIcon>
            <TIcon title={t('italic')} on={et.italic} onClick={() => patch({ italic: !et.italic })}>
              <FormatItalicRounded fontSize="small" />
            </TIcon>
          </Group>
          <GDivider />
          <PaletteControl icon={<FormatColorTextRounded />} title={t('textColor')} value={et.color} onChange={(c) => patch({ color: c ?? '#111111' })} />
          <OpacityControl value={et.opacity} onChange={(opacity) => patch({ opacity })} />
        </>
      )
    }
    if (selObj.type === 'shape') {
      const sh = selObj as ShapeObj
      const patch = (p: Partial<ShapeObj>): void => updateObject(selected.pageId, selected.objectId, p)
      return bar(
        <>
          <PaletteControl icon={<BorderColorRounded />} title={t('strokeColor')} value={sh.stroke} onChange={(c) => patch({ stroke: c ?? '#2563eb' })} />
          {(sh.kind === 'rect' || sh.kind === 'ellipse') && (
            <PaletteControl icon={<FormatColorFillRounded />} title={t('fillColor')} value={sh.fill} onChange={(fill) => patch({ fill })} allowNone />
          )}
          <GDivider />
          <OpacityControl value={sh.opacity} onChange={(opacity) => patch({ opacity })} />
          <GDivider />
          <WidthSelect value={sh.strokeWidth} onChange={(strokeWidth) => patch({ strokeWidth })} />
          <GDivider />
          <DashSelect value={sh.dash ?? 'solid'} onChange={(dash) => patch({ dash })} />
        </>
      )
    }
    if (selObj.type === 'note') {
      const n = selObj as NoteObj
      return bar(
        <>
          <Typography variant="caption" color="text.secondary">
            {t('noteColor')}
          </Typography>
          {NOTE_COLORS.map((c) => (
            <Box key={c} onClick={() => updateObject(selected.pageId, selected.objectId, { color: c })} sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: c, cursor: 'pointer', border: n.color === c ? `2px solid ${ui.gray[800]}` : '2px solid transparent' }} />
          ))}
        </>
      )
    }
    if (selObj.type === 'stroke') {
      const st = selObj as StrokeObj
      const patch = (p: Partial<StrokeObj>): void => updateObject(selected.pageId, selected.objectId, p)
      return bar(
        <>
          <PaletteControl icon={<BorderColorRounded />} title={t('color')} value={st.color} onChange={(c) => patch({ color: c ?? '#facc15' })} />
          <PaletteControl icon={<FormatColorFillRounded />} title={t('fillColor')} value={st.fill ?? null} onChange={(fill) => patch({ fill })} allowNone />
          <GDivider />
          <OpacityControl value={st.opacity} onChange={(opacity) => patch({ opacity })} />
          <GDivider />
          <WidthSelect value={st.width} onChange={(width) => patch({ width })} list={[1, 2, 3, 5, 8, 12, 18, 30, 45]} />
          <GDivider />
          <BlendSelect value={st.blend ?? (st.kind === 'highlight' ? 'multiply' : 'normal')} onChange={(blend) => patch({ blend })} />
        </>
      )
    }
    if (selObj.type === 'image' || selObj.type === 'link') {
      const patch = (p: Partial<PageObject>): void => updateObject(selected.pageId, selected.objectId, p)
      return bar(<OpacityControl value={selObj.opacity} onChange={(opacity) => patch({ opacity })} />)
    }
  }

  // ── 도구별 기본 설정 ──
  switch (tool) {
    case 'addText':
    case 'editText':
      return bar(<TextControls v={textStyle} patch={(p) => setTextStyle(p as Partial<TextStyle>)} />)
    case 'pencil':
      return bar(
        <>
          <PaletteControl icon={<BorderColorRounded />} title={t('color')} value={penStyle.color} onChange={(c) => setPenStyle({ color: c ?? '#2563eb' })} />
          <PaletteControl icon={<FormatColorFillRounded />} title={t('fillColor')} value={penStyle.fill} onChange={(fill) => setPenStyle({ fill })} allowNone />
          <GDivider />
          <OpacityControl value={penStyle.opacity} onChange={(opacity) => setPenStyle({ opacity })} />
          <GDivider />
          <WidthSelect value={penStyle.width} onChange={(width) => setPenStyle({ width })} />
          <GDivider />
          <BlendSelect value={penStyle.blend} onChange={(blend) => setPenStyle({ blend })} />
        </>
      )
    case 'highlight':
      return bar(
        <>
          <PaletteControl icon={<BorderColorRounded />} title={t('color')} value={highlightStyle.color} onChange={(c) => setHighlightStyle({ color: c ?? '#facc15' })} />
          <PaletteControl icon={<FormatColorFillRounded />} title={t('fillColor')} value={highlightStyle.fill} onChange={(fill) => setHighlightStyle({ fill })} allowNone />
          <GDivider />
          <OpacityControl value={highlightStyle.opacity} onChange={(opacity) => setHighlightStyle({ opacity })} />
          <GDivider />
          <WidthSelect value={highlightStyle.width} onChange={(width) => setHighlightStyle({ width })} list={[8, 12, 18, 30, 45]} />
          <GDivider />
          <BlendSelect value={highlightStyle.blend} onChange={(blend) => setHighlightStyle({ blend })} />
        </>
      )
    case 'whiteout':
      // 지우개 = 도형으로 덮기 (Guru Eraser). 도형 선택은 메인 툴바의 도형 버튼(연동)에서
      return bar(
        <>
          <PaletteControl icon={<BorderColorRounded />} title={t('borderColor')} value={eraserStyle.stroke} onChange={(c) => setEraserStyle({ stroke: c ?? '#ffffff' })} />
          <PaletteControl icon={<FormatColorFillRounded />} title={t('fillColor')} value={eraserStyle.fill} onChange={(c) => setEraserStyle({ fill: c ?? '#ffffff' })} />
          <GDivider />
          <OpacityControl value={eraserStyle.opacity} onChange={(opacity) => setEraserStyle({ opacity })} />
          <GDivider />
          <WidthSelect value={eraserStyle.strokeWidth} onChange={(strokeWidth) => setEraserStyle({ strokeWidth })} />
          <GDivider />
          <DashSelect value={eraserStyle.dash} onChange={(dash) => setEraserStyle({ dash })} />
        </>
      )
    case 'eraseDrawing':
      return bar(hint('hintEraseDrawing'))
    case 'rect':
    case 'ellipse':
    case 'cross':
    case 'check':
      return bar(
        <>
          <PaletteControl icon={<BorderColorRounded />} title={t('strokeColor')} value={shapeStyle.stroke} onChange={(c) => setShapeStyle({ stroke: c ?? '#2563eb' })} />
          {(tool === 'rect' || tool === 'ellipse') && (
            <PaletteControl icon={<FormatColorFillRounded />} title={t('fillColor')} value={shapeStyle.fill} onChange={(fill) => setShapeStyle({ fill })} allowNone />
          )}
          <GDivider />
          <WidthSelect value={shapeStyle.strokeWidth} onChange={(strokeWidth) => setShapeStyle({ strokeWidth })} />
          <GDivider />
          <DashSelect value={shapeStyle.dash} onChange={(dash) => setShapeStyle({ dash })} />
        </>
      )
    case 'note':
      return bar(hint('hintNote'))
    case 'link':
      return bar(hint('hintLink'))
    default:
      // 항상 바를 렌더한다 (pdfguru처럼 서식 줄 상시 표시).
      // 사라지면 문서 전체가 세로로 튀어(레이아웃 점프) 클릭 위치가 어긋난다
      return bar(<TextControls v={textStyle} patch={(p) => setTextStyle(p as Partial<TextStyle>)} />)
  }
}
