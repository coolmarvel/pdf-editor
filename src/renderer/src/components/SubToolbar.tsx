import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import type { SxProps, Theme } from '@mui/material/styles'
import { AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, Baseline, Bold, BookOpen, Contrast, Droplets, Grid3x3, IconChevronDown, ImageIcon, Italic, Layers, Maximize, Minus, PaintBucket, PenLine, Plus, RotateCw, Spline, Trash2, Type, Underline } from './icons'
import { useEditor, type TextStyle } from '@renderer/store/editor'
import type { PageObject, TextObj, EditTextObj, ShapeObj, NoteObj, StrokeObj, WatermarkObj, DashStyle, BlendMode } from '@core/objects'
import { FONT_STACKS, measureTextWidthPx } from '@renderer/editor/draw'
import { renderWatermarkText } from '@renderer/editor/watermark'
import { fileToDataUrl } from '@renderer/editor/stamp'
import { useT, type I18nKey } from '@renderer/i18n'
import { ui } from '@renderer/theme'
import SwatchRow from './ui/SwatchRow'

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

interface SelectControlProps<T> {
  icon?: React.ReactNode
  tooltip?: string
  value: T
  onChange: (v: T) => void
  items: { v: T; label: React.ReactNode; sx?: React.ComponentProps<typeof MenuItem>['sx'] }[]
  minWidth?: number
  /** 드롭다운 최대 높이 (없으면 MUI 기본) */
  menuMaxH?: number
  sx?: React.ComponentProps<typeof Select>['sx']
}

/**
 * 셀렉트 공통 뼈대: icon 이 있으면 [아이콘+툴팁] Group 으로 감싸고, 없으면 셀렉트만 (상위 Group 안에 놓일 때).
 * MUI Select 는 MenuItem 의 value 를 타입 그대로 돌려주므로 숫자/리터럴 값도 그대로 쓴다.
 */
function SelectControl<T extends string | number>({ icon, tooltip, value, onChange, items, minWidth, menuMaxH, sx }: SelectControlProps<T>): JSX.Element {
  const sel = (
    <Select
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      sx={{ ...selectSx, ...(minWidth ? { minWidth } : {}), ...(sx as object) }}
      MenuProps={menuMaxH ? { PaperProps: { sx: { maxHeight: menuMaxH } } } : undefined}
    >
      {items.map((it) => (
        <MenuItem key={it.v} value={it.v} sx={it.sx}>
          {it.label}
        </MenuItem>
      ))}
    </Select>
  )
  return icon ? (
    <Group icon={icon} tooltip={tooltip}>
      {sel}
    </Group>
  ) : (
    sel
  )
}

interface NumberSelectProps {
  value: number
  /** 프리셋 목록 — 현재 값이 없으면 끼워 넣어 정렬 (현재 값 표시 보장) */
  list: readonly number[]
  onChange: (v: number) => void
  unit?: string
  icon?: React.ReactNode
  tooltip?: string
  minWidth?: number
}

/** "목록 ∪ 현재 값, 오름차순" 숫자 셀렉트 (굵기·글자 크기·각도·크기 % 공용) */
function NumberSelect({ value, list, onChange, unit = '', icon, tooltip, minWidth }: NumberSelectProps): JSX.Element {
  const items = [...new Set([...list, value])].sort((a, b) => a - b).map((n) => ({ v: n, label: `${n}${unit}` }))
  return <SelectControl icon={icon} tooltip={tooltip} value={value} onChange={onChange} items={items} minWidth={minWidth} />
}

const FONT_ITEMS = Object.entries(FONT_STACKS).map(([name, stack]) => ({ v: name, label: name, sx: { fontFamily: stack } }))

/** 글꼴 셀렉트 — 현재 글꼴로 표시. 텍스트 도구/편집 객체/워터마크 공용 */
function FontSelect({ value, onChange, minWidth = 132, menuMaxH = 360 }: { value: string; onChange: (f: string) => void; minWidth?: number; menuMaxH?: number | null }): JSX.Element {
  return (
    <SelectControl
      value={value}
      onChange={onChange}
      items={FONT_ITEMS}
      minWidth={minWidth}
      menuMaxH={menuMaxH ?? undefined}
      sx={{ '& .MuiSelect-select': { py: 0.5, fontFamily: FONT_STACKS[value] } }}
    />
  )
}

function BlendSelect({ value, onChange }: { value: BlendMode; onChange: (b: BlendMode) => void }): JSX.Element {
  const t = useT()
  return <SelectControl icon={<Layers />} tooltip={t('blendMode')} value={value} onChange={onChange} items={BLEND_MODES} minWidth={118} menuMaxH={380} />
}

/** 테두리 선 스타일 — 항목을 실제 선 모양으로 표시 */
const DASH_ITEMS = (['solid', 'dotted', 'dashed'] as const).map((d) => ({
  v: d,
  label: <Box sx={{ width: 40, borderTop: `2.5px ${d === 'solid' ? 'solid' : d === 'dotted' ? 'dotted' : 'dashed'} ${ui.gray[800]}`, my: '9px' }} />
}))
function DashSelect({ value, onChange }: { value: DashStyle; onChange: (d: DashStyle) => void }): JSX.Element {
  const t = useT()
  return <SelectControl icon={<Spline />} tooltip={t('borderStyle')} value={value} onChange={onChange} items={DASH_ITEMS} />
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
  return <NumberSelect icon={<Minus />} tooltip={t('thickness')} value={widthToPt(value)} list={list} onChange={(pt) => onChange(ptToWidth(pt))} unit=" pt" minWidth={78} />
}

/** pdfguru 스타일 프리셋 팔레트 (진한 6 / 파스텔 6 / 무채색 5) */
const PALETTE: string[][] = [
  ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#d946ef'],
  ['#f87171', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#f0abfc'],
  ['#ffffff', '#d1d5db', '#9ca3af', '#4b5563', '#111111']
]

/** 팔레트 스와치: 흰색만 회색 테두리, 선택은 파란 아웃라인 */
const paletteSwatchSx = (color: string, selected: boolean): SxProps<Theme> => ({
  border: color.toLowerCase() === '#ffffff' ? `1px solid ${ui.gray[300]}` : '1px solid rgba(0,0,0,.08)',
  outline: selected ? '2px solid #3b82f6' : 'none',
  outlineOffset: 1
})

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
      bgcolor: '#d92d20' /* "색 없음" 사선 — 브랜드색이 아니라 경고 레드 */,
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
          <IconChevronDown sx={{ fontSize: 15, color: ui.gray[500] }} />
        </ButtonBase>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box sx={{ p: 1.5 }}>
          <Stack spacing={0.8}>
            {PALETTE.map((row, ri) => (
              <SwatchRow
                key={ri}
                colors={row}
                value={value}
                onChange={onChange}
                ripple
                swatchSx={paletteSwatchSx}
                prefix={ri === PALETTE.length - 1 && allowNone ? <NoneSwatch selected={value === null} onClick={() => onChange(null)} /> : undefined}
              />
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
              {t('customColor')}
            </Typography>
            <Box>
              <ButtonBase
                onClick={() => customRef.current?.click()}
                sx={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px dashed ${ui.gray[400]}`, color: ui.gray[500], position: 'relative' }}
              >
                <Plus sx={{ fontSize: 16 }} />
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
    <Group icon={<Contrast />} tooltip={t('opacity')}>
      <Tooltip title={t('opacity')}>
        <ButtonBase onClick={(e) => setAnchor(e.currentTarget)} sx={{ ...boxBtnSx, px: 1 }}>
          <Typography sx={{ fontSize: 14.5, minWidth: 38, textAlign: 'left' }}>{Math.round(value * 100)}%</Typography>
          <IconChevronDown sx={{ fontSize: 15, color: ui.gray[500] }} />
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
  { v: 'left' as const, icon: AlignLeft, label: 'alignLeft' as I18nKey },
  { v: 'center' as const, icon: AlignCenter, label: 'alignCenter' as I18nKey },
  { v: 'right' as const, icon: AlignRight, label: 'alignRight' as I18nKey }
]
const V_ALIGNS = [
  { v: 'top' as const, icon: AlignVerticalJustifyStart, label: 'alignTop' as I18nKey },
  { v: 'middle' as const, icon: AlignVerticalJustifyCenter, label: 'alignMiddle' as I18nKey },
  { v: 'bottom' as const, icon: AlignVerticalJustifyEnd, label: 'alignBottom' as I18nKey }
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

type TextFeature = 'underline' | 'align' | 'valign' | 'bg'
const ALL_TEXT_FEATURES: TextFeature[] = ['underline', 'align', 'valign', 'bg']

interface TextControlsProps {
  /** editText 객체는 밑줄/정렬/배경이 없어 필수 필드만 요구한다 */
  v: Pick<TextControlValues, 'font' | 'size' | 'bold' | 'italic' | 'color' | 'opacity'> & Partial<TextControlValues>
  patch: (p: Partial<TextControlValues>) => void
  /** 표시할 부가 컨트롤. 기본 전부. editText 는 [] (글꼴·크기·B/I·색·불투명도만) */
  features?: TextFeature[]
  /** 글꼴 드롭다운 최대 높이 (null = MUI 기본) */
  fontMenuMaxH?: number | null
}

function TextControls({ v, patch, features = ALL_TEXT_FEATURES, fontMenuMaxH = 360 }: TextControlsProps): JSX.Element {
  const t = useT()
  const has = (f: TextFeature): boolean => features.includes(f)
  return (
    <>
      <Group icon={<Type />}>
        <FontSelect value={v.font} onChange={(font) => patch({ font })} menuMaxH={fontMenuMaxH} />
        <NumberSelect value={sizeToPt(v.size)} list={FONT_SIZES} onChange={(pt) => patch({ size: ptToSize(pt) })} minWidth={66} />
      </Group>
      <GDivider />
      <Group>
        <TIcon title={t('bold')} on={v.bold} onClick={() => patch({ bold: !v.bold })}>
          <Bold fontSize="small" />
        </TIcon>
        <TIcon title={t('italic')} on={v.italic} onClick={() => patch({ italic: !v.italic })}>
          <Italic fontSize="small" />
        </TIcon>
        {has('underline') && (
          <TIcon title={t('underline')} on={v.underline} onClick={() => patch({ underline: !v.underline })}>
            <Underline fontSize="small" />
          </TIcon>
        )}
      </Group>
      <GDivider />
      {has('align') && (
        <>
          <Group>
            {H_ALIGNS.map(({ v: a, icon: Icon, label }) => (
              <TIcon key={a} title={t(label)} on={v.align === a} onClick={() => patch({ align: a })}>
                <Icon fontSize="small" />
              </TIcon>
            ))}
          </Group>
          <GDivider />
        </>
      )}
      {has('valign') && (
        <>
          <Group>
            {V_ALIGNS.map(({ v: a, icon: Icon, label }) => (
              <TIcon key={a} title={t(label)} on={v.valign === a} onClick={() => patch({ valign: a })}>
                <Icon fontSize="small" />
              </TIcon>
            ))}
          </Group>
          <GDivider />
        </>
      )}
      <PaletteControl icon={<Baseline />} title={t('textColor')} value={v.color} onChange={(c) => patch({ color: c ?? '#111111' })} />
      {has('bg') && <PaletteControl icon={<PaintBucket />} title={t('bgColor')} value={v.bgColor ?? null} onChange={(bgColor) => patch({ bgColor })} allowNone />}
      <OpacityControl value={v.opacity} onChange={(opacity) => patch({ opacity })} />
    </>
  )
}

/** 선(연필/형광펜) 공용 컨트롤: 색 · 채움 · 불투명도 · 굵기 · 혼합 */
interface StrokeValues {
  color: string
  fill: string | null
  opacity: number
  width: number
  blend: BlendMode
}
function StrokeControls({ v, patch, widths, colorFallback }: { v: StrokeValues; patch: (p: Partial<StrokeValues>) => void; widths?: number[]; colorFallback: string }): JSX.Element {
  const t = useT()
  return (
    <>
      <PaletteControl icon={<PenLine />} title={t('color')} value={v.color} onChange={(c) => patch({ color: c ?? colorFallback })} />
      <PaletteControl icon={<PaintBucket />} title={t('fillColor')} value={v.fill} onChange={(fill) => patch({ fill })} allowNone />
      <GDivider />
      <OpacityControl value={v.opacity} onChange={(opacity) => patch({ opacity })} />
      <GDivider />
      <WidthSelect value={v.width} onChange={(width) => patch({ width })} list={widths} />
      <GDivider />
      <BlendSelect value={v.blend} onChange={(blend) => patch({ blend })} />
    </>
  )
}

/** 도형(사각/타원/지우개) 공용 컨트롤: 테두리색 · [채움] · [불투명도] · 굵기 · 선 스타일 */
interface ShapeValues {
  stroke: string
  fill: string | null
  opacity: number
  strokeWidth: number
  dash: DashStyle
}
interface ShapeControlsProps {
  v: ShapeValues
  patch: (p: Partial<ShapeValues>) => void
  strokeTitle: I18nKey
  strokeFallback: string
  /** 'none' = 채움 컨트롤 없음, 'optional' = 없음 허용, 'required' = 항상 색 (지우개는 흰색으로 되돌린다) */
  fill: 'none' | 'optional' | 'required'
  opacity?: boolean
}
function ShapeControls({ v, patch, strokeTitle, strokeFallback, fill, opacity }: ShapeControlsProps): JSX.Element {
  const t = useT()
  return (
    <>
      <PaletteControl icon={<PenLine />} title={t(strokeTitle)} value={v.stroke} onChange={(c) => patch({ stroke: c ?? strokeFallback })} />
      {fill === 'optional' && <PaletteControl icon={<PaintBucket />} title={t('fillColor')} value={v.fill} onChange={(fill) => patch({ fill })} allowNone />}
      {fill === 'required' && <PaletteControl icon={<PaintBucket />} title={t('fillColor')} value={v.fill} onChange={(c) => patch({ fill: c ?? '#ffffff' })} />}
      <GDivider />
      {opacity && (
        <>
          <OpacityControl value={v.opacity} onChange={(opacity) => patch({ opacity })} />
          <GDivider />
        </>
      )}
      <WidthSelect value={v.strokeWidth} onChange={(strokeWidth) => patch({ strokeWidth })} />
      <GDivider />
      <DashSelect value={v.dash} onChange={(dash) => patch({ dash })} />
    </>
  )
}

const NOTE_COLORS = ['#facc15', '#fb923c', '#ef4444', '#ec4899', '#3b82f6', '#22c55e']
const noteSwatchSx = (_: string, selected: boolean): SxProps<Theme> => ({ cursor: 'pointer', border: selected ? `2px solid ${ui.gray[800]}` : '2px solid transparent' })

const MARK_SIZES = [12, 16, 20, 24, 32, 40, 56]
const WM_ANGLES = [-90, -45, -30, 0, 30, 45, 90]
const WM_SIZES = [25, 35, 50, 70, 90] // 페이지 폭 %

/** 기울기 셀렉트 — 도구 설정과 선택된 워터마크 객체가 공유 */
function AngleSelect({ value, onChange }: { value: number; onChange: (a: number) => void }): JSX.Element {
  const t = useT()
  return <NumberSelect icon={<RotateCw />} tooltip={t('wmAngle')} value={value} list={WM_ANGLES} onChange={onChange} unit="°" minWidth={84} />
}

/** 배치 셀렉트 (단일/바둑판) — 도구 설정과 선택된 워터마크 객체가 공유 */
function LayoutSelect({ value, onChange }: { value: 'single' | 'tile'; onChange: (l: 'single' | 'tile') => void }): JSX.Element {
  const t = useT()
  return (
    <SelectControl
      icon={<Grid3x3 />}
      tooltip={t('wmLayout')}
      value={value}
      onChange={onChange}
      items={[
        { v: 'single', label: t('wmSingle') },
        { v: 'tile', label: t('wmTile') }
      ]}
      minWidth={96}
    />
  )
}

/** 워터마크 도구 컨텍스트 바: 소스(텍스트/이미지)·스타일·배치·범위 설정 후 [적용] */
function WatermarkToolControls(): JSX.Element {
  const t = useT()
  const ws = useEditor((s) => s.watermarkStyle)
  const setWs = useEditor((s) => s.setWatermarkStyle)
  const applyWatermark = useEditor((s) => s.applyWatermark)
  const removeAllWatermarks = useEditor((s) => s.removeAllWatermarks)
  const hasWatermarks = useEditor((s) => Object.values(s.objectsByPage).some((l) => l.some((o) => o.type === 'watermark')))
  const fileRef = useRef<HTMLInputElement>(null)

  const canApply = ws.mode === 'text' ? !!ws.text.trim() : !!ws.image

  function apply(): void {
    if (ws.mode === 'text' && ws.text.trim()) {
      const r = renderWatermarkText(ws.text.trim(), ws.font, ws.color)
      applyWatermark(r.dataUrl, r.aspect)
    } else if (ws.mode === 'image' && ws.image) {
      applyWatermark(ws.image.dataUrl, ws.image.aspect)
    }
  }

  return (
    <>
      <SelectControl
        icon={<Droplets />}
        tooltip={t('watermark')}
        value={ws.mode}
        onChange={(mode) => setWs({ mode })}
        items={[
          { v: 'text', label: t('wmText') },
          { v: 'image', label: t('wmImage') }
        ]}
        minWidth={96}
      />
      <GDivider />
      {ws.mode === 'text' ? (
        <>
          <Group icon={<Type />}>
            <Box
              component="input"
              value={ws.text}
              placeholder={t('wmTextPlaceholder')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWs({ text: e.target.value })}
              sx={{
                height: CTL_H,
                width: 168,
                px: 1.2,
                border: `1px solid ${ui.gray[300]}`,
                borderRadius: 2,
                bgcolor: '#fff',
                fontSize: 14.5,
                outline: 'none',
                boxShadow: ui.shadow.xs,
                '&:focus': { borderColor: '#3b82f6' },
                '&::placeholder': { color: ui.gray[400] }
              }}
            />
            <FontSelect value={ws.font} onChange={(font) => setWs({ font })} minWidth={112} />
          </Group>
          <PaletteControl icon={<Baseline />} title={t('textColor')} value={ws.color} onChange={(c) => setWs({ color: c ?? '#9ca3af' })} />
        </>
      ) : (
        <Group icon={<ImageIcon />} tooltip={t('wmImage')}>
          {ws.image && <Box component="img" src={ws.image.dataUrl} sx={{ height: CTL_H - 6, maxWidth: 72, objectFit: 'contain', border: `1px solid ${ui.gray[300]}`, borderRadius: 1, bgcolor: '#fff' }} />}
          <Button variant="outlined" size="small" onClick={() => fileRef.current?.click()} sx={{ height: CTL_H, textTransform: 'none', whiteSpace: 'nowrap' }}>
            {t('wmChooseImage')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void fileToDataUrl(f).then((image) => setWs({ image }))
            }}
          />
        </Group>
      )}
      <GDivider />
      <OpacityControl value={ws.opacity} onChange={(opacity) => setWs({ opacity })} />
      <AngleSelect value={ws.angle} onChange={(angle) => setWs({ angle })} />
      <NumberSelect icon={<Maximize />} tooltip={t('wmSize')} value={Math.round(ws.scale * 100)} list={WM_SIZES} onChange={(p) => setWs({ scale: p / 100 })} unit="%" minWidth={78} />
      <LayoutSelect value={ws.layout} onChange={(layout) => setWs({ layout })} />
      <SelectControl
        icon={<BookOpen />}
        tooltip={t('wmScope')}
        value={ws.scope}
        onChange={(scope) => setWs({ scope })}
        items={[
          { v: 'all', label: t('wmAllPages') },
          { v: 'current', label: t('wmCurrentPage') }
        ]}
        minWidth={118}
      />
      <GDivider />
      <Button variant="contained" size="small" disabled={!canApply} onClick={apply} sx={{ height: CTL_H, px: 2, textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {t('wmApply')}
      </Button>
      <Button variant="text" size="small" color="inherit" disabled={!hasWatermarks} onClick={removeAllWatermarks} sx={{ height: CTL_H, textTransform: 'none', whiteSpace: 'nowrap', color: ui.gray[600] }}>
        {t('wmRemoveAll')}
      </Button>
    </>
  )
}

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
  const markStyle = useEditor((s) => s.markStyle)
  const setMarkStyle = useEditor((s) => s.setMarkStyle)
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
              <Trash2 />
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
      // 밑줄/정렬/배경 없음 — editText 객체엔 그 속성이 없다
      return bar(<TextControls v={et} patch={(p) => patch(p as Partial<EditTextObj>)} features={[]} fontMenuMaxH={null} />)
    }
    if (selObj.type === 'shape') {
      const sh = selObj as ShapeObj
      const patch = (p: Partial<ShapeObj>): void => updateObject(selected.pageId, selected.objectId, p)
      return bar(
        <ShapeControls
          v={{ ...sh, dash: sh.dash ?? 'solid' }}
          patch={patch}
          strokeTitle="strokeColor"
          strokeFallback="#2563eb"
          fill={sh.kind === 'rect' || sh.kind === 'ellipse' ? 'optional' : 'none'}
          opacity
        />
      )
    }
    if (selObj.type === 'note') {
      const n = selObj as NoteObj
      return bar(
        <SwatchRow
          colors={NOTE_COLORS}
          value={n.color}
          onChange={(color) => updateObject(selected.pageId, selected.objectId, { color })}
          size={22}
          spacing={1.2}
          swatchSx={noteSwatchSx}
          prefix={
            <Typography variant="caption" color="text.secondary">
              {t('noteColor')}
            </Typography>
          }
        />
      )
    }
    if (selObj.type === 'stroke') {
      const st = selObj as StrokeObj
      const patch = (p: Partial<StrokeObj>): void => updateObject(selected.pageId, selected.objectId, p)
      return bar(
        <StrokeControls
          v={{ ...st, fill: st.fill ?? null, blend: st.blend ?? (st.kind === 'highlight' ? 'multiply' : 'normal') }}
          patch={patch}
          widths={[1, 2, 3, 5, 8, 12, 18, 30, 45]}
          colorFallback="#facc15"
        />
      )
    }
    if (selObj.type === 'watermark') {
      const wm = selObj as WatermarkObj
      const patch = (p: Partial<WatermarkObj>): void => updateObject(selected.pageId, selected.objectId, p as Partial<PageObject>)
      return bar(
        <>
          <OpacityControl value={wm.opacity} onChange={(opacity) => patch({ opacity })} />
          <GDivider />
          <AngleSelect value={wm.angle} onChange={(angle) => patch({ angle })} />
          <LayoutSelect value={wm.layout} onChange={(layout) => patch({ layout })} />
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
      return bar(<StrokeControls v={penStyle} patch={setPenStyle} colorFallback="#2563eb" />)
    case 'highlight':
      return bar(<StrokeControls v={highlightStyle} patch={setHighlightStyle} widths={[8, 12, 18, 30, 45]} colorFallback="#facc15" />)
    case 'whiteout':
      // 지우개 = 도형으로 덮기 (Guru Eraser). 도형 선택은 메인 툴바의 도형 버튼(연동)에서
      return bar(<ShapeControls v={eraserStyle} patch={setEraserStyle as (p: Partial<ShapeValues>) => void} strokeTitle="borderColor" strokeFallback="#ffffff" fill="required" opacity />)
    case 'eraseDrawing':
      return bar(hint('hintEraseDrawing'))
    case 'rect':
    case 'ellipse':
      return bar(<ShapeControls v={shapeStyle} patch={setShapeStyle} strokeTitle="strokeColor" strokeFallback="#2563eb" fill="optional" />)
    case 'cross':
    case 'check':
      // X/체크: 찍기 전에 색·크기를 정한다 — 커서가 이 크기 그대로 보이고 그대로 찍힌다
      return bar(
        <>
          <PaletteControl icon={<PenLine />} title={t('strokeColor')} value={markStyle.color} onChange={(c) => setMarkStyle({ color: c ?? '#111111' })} />
          <GDivider />
          <NumberSelect icon={<Maximize />} tooltip={t('wmSize')} value={widthToPt(markStyle.size)} list={MARK_SIZES} onChange={(pt) => setMarkStyle({ size: ptToWidth(pt) })} unit=" pt" minWidth={78} />
          <GDivider />
          <WidthSelect value={shapeStyle.strokeWidth} onChange={(strokeWidth) => setShapeStyle({ strokeWidth })} />
        </>
      )
    case 'watermark':
      return bar(<WatermarkToolControls />)
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
