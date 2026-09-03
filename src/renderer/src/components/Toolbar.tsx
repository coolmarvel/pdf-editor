import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Menu from '@mui/material/Menu'
import Divider from '@mui/material/Divider'
import useMediaQuery from '@mui/material/useMediaQuery'
import {
  IconPages,
  IconCursor,
  IconUndo,
  IconRedo,
  IconText,
  IconTextEdit,
  IconEraser,
  IconHighlighter,
  IconPen,
  IconImage,
  IconStamp,
  IconSquare,
  IconCircle,
  IconCross,
  IconCheck,
  IconSign,
  IconWatermark,
  IconNote,
  IconLink,
  IconLayout,
  IconGrid,
  IconChevronDown,
  IconPageSingle,
  IconPageDouble,
  IconFit,
  IconScrollContinuous,
  IconScrollPaged,
  IconRotateLeft,
  IconRotateRight
} from './icons'
import { useEditor, selectCanUndo, selectCanRedo, type Tool } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ui } from '@renderer/theme'
import MenuAction from './ui/MenuAction'
import { FADE_W, fadeSx, H_SCROLL_SX, useHorizontalWheel } from '@renderer/hooks/useHorizontalScroll'

interface ToolBtnProps {
  label: string
  icon: JSX.Element
  active?: boolean
  disabled?: boolean
  onClick: (e: React.MouseEvent<HTMLElement>) => void
  /** 있으면 스플릿 버튼: 주 버튼(onClick)과 ▾(메뉴 열기)가 **하나의 hover 영역**을 이루고, 메뉴는 ▾ 를 눌렀을 때만 열린다 */
  onDropdown?: (e: React.MouseEvent<HTMLElement>) => void
  /** ▾ 의 data-testid (e2e 가 메뉴를 여는 손잡이) */
  menuTestId?: string
  /** 터치 환경: 주 버튼 최소 64px, ▾ 24px (한 화면에 더 많이, 터치 타깃 확보) */
  compact?: boolean
}

/**
 * 툴 버튼 규격 (DESIGN.md toolbar-split 조정판): 주 버튼 폭은 라벨 기준 auto(최소 64), ▾ 16×48(터치 24), 높이 48, 반경 8.
 * 'Manage Pages' 같은 긴 라벨이 어떤 폭에서도 잘리지 않는다(ellipsis 금지). 고정 76 은 1280 폭에서 툴바가 넘쳐 마지막 라벨이 잘렸다.
 */
const TOOLBTN_MIN_W = 64
const TOOLBTN_H = 48
const TOOLBTN_MIN_W_TOUCH = 64
const DROPDOWN_W = 16
const DROPDOWN_W_TOUCH = 40 // 터치: 테마의 IconButton 40px 규칙과 같은 값(작게 두면 테마가 덮어써 무의미)

function ToolBtn({ label, icon, active, disabled, onClick, onDropdown, menuTestId, compact }: ToolBtnProps): JSX.Element {
  const t = useT()
  const minW = compact ? TOOLBTN_MIN_W_TOUCH : TOOLBTN_MIN_W
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        borderRadius: 2,
        height: TOOLBTN_H,
        color: active ? 'primary.main' : 'text.primary',
        bgcolor: active ? 'primary.light' : 'transparent',
        // 주 버튼 + ▾ 를 감싸는 컨테이너 하나가 hover 를 받는다 (두 조각이 따로 밝아지지 않는다)
        ...(disabled ? {} : { '&:hover': { bgcolor: active ? ui.brand[100] : ui.gray[100] } })
      }}
    >
      {/* 터치(compact): 탭이 합성 hover 를 내 툴팁이 남아 셀렉트를 가린다 — 라벨이 버튼에 있으니 툴팁을 아예 두지 않는다 */}
      <Tooltip title={compact ? '' : label}>
        <span style={{ display: 'flex' }}>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={onClick}
            sx={{
              minWidth: minW,
              height: TOOLBTN_H,
              flexDirection: 'column',
              justifyContent: 'center',
              borderRadius: 2,
              ...(onDropdown ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : {}),
              px: 0.75,
              py: 0,
              color: 'inherit',
              bgcolor: 'transparent',
              '&:hover': { bgcolor: 'transparent' },
              '&.Mui-disabled': { color: ui.gray[400] },
              '& .MuiSvgIcon-root': { fontSize: 20 }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', height: 22 }}>{icon}</Box>
            <Typography component="span" sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1.15, mt: 0.25, whiteSpace: 'nowrap', color: 'inherit' }}>
              {label}
            </Typography>
          </IconButton>
        </span>
      </Tooltip>
      {onDropdown && (
        <IconButton
          size="small"
          aria-label={t('moreOptions')}
          aria-haspopup="menu"
          data-testid={menuTestId}
          onClick={onDropdown}
          sx={{
            borderRadius: 2,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            p: 0,
            width: compact ? DROPDOWN_W_TOUCH : DROPDOWN_W,
            minWidth: 0,
            height: TOOLBTN_H,
            color: active ? 'primary.main' : 'text.secondary',
            '&:hover': { bgcolor: active ? ui.brand[100] : ui.gray[200] }
          }}
        >
          <IconChevronDown sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  )
}

interface SplitItem<K extends string> {
  k: K
  icon: JSX.Element
  label: string
  secondary?: string
  selected?: boolean
}

/**
 * 스플릿 그룹(주 버튼 + ▾ 메뉴) 공통 상태: 마지막으로 고른 하위 도구(last)·메뉴 앵커·메뉴 JSX.
 * 메뉴 항목을 고르면 pick(k) → (false 를 돌려주지 않는 한) last 갱신 → 닫기. 주 버튼의 동작은 호출부가 last 로 정한다
 */
function useSplitGroup<K extends string>(items: SplitItem<K>[], initial: K, pick: (k: K) => boolean | void): { last: K; open: (e: React.MouseEvent<HTMLElement>) => void; menu: JSX.Element } {
  const [last, setLast] = useState<K>(initial)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const menu = (
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
      {items.map((x) => (
        <MenuAction
          key={x.k}
          icon={x.icon}
          label={x.label}
          secondary={x.secondary}
          selected={x.selected}
          onClick={() => {
            if (pick(x.k) !== false) setLast(x.k)
            setAnchor(null)
          }}
        />
      ))}
    </Menu>
  )
  return { last, open: (e) => setAnchor(e.currentTarget), menu }
}

/** 페이지 레이아웃 패널의 아이콘 토글 버튼 */
function LayoutBtn({ title, selected, onClick, children }: { title: string; selected?: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          borderRadius: 1.5,
          color: selected ? 'primary.main' : 'text.secondary',
          bgcolor: selected ? 'primary.light' : 'transparent',
          '&:hover': { bgcolor: selected ? 'primary.light' : ui.gray[100] }
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  )
}

export interface ToolbarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onManagePages: () => void
  onOpenImage: () => void
  onOpenStamp: () => void
  onOpenSign: () => void
}

export default function Toolbar(p: ToolbarProps): JSX.Element {
  const t = useT()
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor(selectCanUndo)
  const canRedo = useEditor(selectCanRedo)
  const pageRotate = useEditor((s) => s.pageRotate)
  const eraserKind = useEditor((s) => s.eraserStyle.kind)
  const setEraserStyle = useEditor((s) => s.setEraserStyle)
  const pageMode = useEditor((s) => s.pageMode)
  const setPageMode = useEditor((s) => s.setPageMode)
  const pageTransition = useEditor((s) => s.pageTransition)
  const setPageTransition = useEditor((s) => s.setPageTransition)
  const requestFit = useEditor((s) => s.requestFit)

  // 터치(pointer: coarse) → 버튼을 촘촘히(64px) + ⌄ 24px. 폭 < 900 → 얇은 스크롤바 + 오른쪽 끝 "더 있음" 페이드 + 세로 휠 → 가로 스크롤(마우스)
  const coarse = useMediaQuery('(pointer: coarse)')
  const narrow = useMediaQuery('(max-width: 899.95px)')
  const onWheel = useHorizontalWheel()
  const [layoutMenu, setLayoutMenu] = useState<HTMLElement | null>(null)

  /** 현재 페이지 회전 — pages·currentPage 는 클릭 시점에 읽는다(currentPage 는 스크롤마다 바뀌어 구독하면 툴바 전체가 리렌더) */
  const rotateCurrentPage = (deg: -90 | 90): void => {
    const { pages, currentPage } = useEditor.getState()
    const pg = pages[currentPage]
    if (pg) pageRotate(new Set([pg.id]), deg)
  }
  const is = (x: Tool): boolean => tool === x
  /** 도구 토글 (Guru): 활성 상태에서 다시 누르면 비활성(선택 도구로) */
  const toggle = (x: Tool): void => setTool(tool === x ? 'select' : x)
  /** 지우개(도형 덮기) 진입 — 도형은 항상 사각형으로 리셋 (Guru 동작). 본체 버튼·메뉴 항목 공용 */
  const enterWhiteout = (): void => {
    setEraserStyle({ kind: 'rect' })
    setTool('whiteout')
  }

  // 스플릿 그룹: 주 버튼 = 마지막으로 고른 하위 도구(라벨·아이콘도 그것), ▾ = 메뉴. 텍스트(추가/수정)·표시(X/체크)·주석(서명/주석/링크)·지우개·이미지·도형
  const TEXT_ITEMS = [
    { k: 'addText' as const, icon: <IconText />, label: t('addText'), selected: is('addText') },
    { k: 'editText' as const, icon: <IconTextEdit />, label: t('editText'), selected: is('editText') }
  ]
  const MARK_ITEMS = [
    { k: 'cross' as const, icon: <IconCross />, label: t('cross'), selected: is('cross') },
    { k: 'check' as const, icon: <IconCheck />, label: t('check'), selected: is('check') }
  ]
  const ANNOT_ITEMS = [
    { k: 'sign' as const, icon: <IconSign />, label: t('sign'), selected: is('sign') },
    { k: 'note' as const, icon: <IconNote />, label: t('note'), selected: is('note') },
    { k: 'link' as const, icon: <IconLink />, label: t('link'), selected: is('link') }
  ]
  const text = useSplitGroup(TEXT_ITEMS, 'addText', setTool)
  const mark = useSplitGroup(MARK_ITEMS, 'cross', setTool)
  // 주석 메뉴: 서명은 다이얼로그, 주석/링크는 도구 켜기
  const annot = useSplitGroup(ANNOT_ITEMS, 'sign', (k) => (k === 'sign' ? p.onOpenSign() : setTool(k)))
  const eraser = useSplitGroup(
    [
      { k: 'whiteout' as const, icon: <IconEraser fontSize="small" />, label: t('eraser'), secondary: t('eraserDesc'), selected: is('whiteout') },
      { k: 'eraseDrawing' as const, icon: <IconEraser fontSize="small" />, label: t('eraseDrawing'), secondary: t('eraseDrawingDesc'), selected: is('eraseDrawing') }
    ],
    'whiteout',
    (k) => (k === 'whiteout' ? enterWhiteout() : setTool(k))
  )
  const image = useSplitGroup(
    [
      { k: 'image' as const, icon: <IconImage fontSize="small" />, label: t('image') },
      { k: 'stamp' as const, icon: <IconStamp fontSize="small" />, label: t('stamp') }
    ],
    'image',
    (k) => (k === 'image' ? p.onOpenImage() : p.onOpenStamp())
  )
  // 도형 메뉴: 지우개가 켜져 있으면 지우개 도형을 바꾼다 (마지막 도형은 건드리지 않는다)
  const shape = useSplitGroup(
    (['rect', 'ellipse'] as const).map((k) => ({
      k,
      icon: k === 'rect' ? <IconSquare fontSize="small" /> : <IconCircle fontSize="small" />,
      label: k === 'rect' ? t('rectangle') : t('ellipse'),
      selected: tool === 'whiteout' ? eraserKind === k : is(k)
    })),
    'rect',
    (k) => {
      if (tool !== 'whiteout') {
        setTool(k)
        return
      }
      setEraserStyle({ kind: k })
      return false
    }
  )
  const shapeShown = tool === 'rect' || tool === 'ellipse' ? tool : tool === 'whiteout' ? eraserKind : shape.last
  // 그룹 주 버튼에 보이는 하위 도구 = 지금 켜진 것(스토어에서 직접 켠 경우 포함) 아니면 마지막으로 고른 것
  const textShown = tool === 'addText' || tool === 'editText' ? tool : text.last
  const markShown = tool === 'cross' || tool === 'check' ? tool : mark.last
  const annotShown = tool === 'sign' || tool === 'note' || tool === 'link' ? tool : annot.last
  const textItem = TEXT_ITEMS.find((x) => x.k === textShown)!
  const markItem = MARK_ITEMS.find((x) => x.k === markShown)!
  const annotItem = ANNOT_ITEMS.find((x) => x.k === annotShown)!
  /** 주석 그룹 실행: 서명은 다이얼로그, 주석/링크는 토글 */
  const runAnnot = (k: 'sign' | 'note' | 'link'): void => {
    if (k === 'sign') p.onOpenSign()
    else toggle(k)
  }

  return (
    <Box sx={{ position: 'relative', borderBottom: 1, borderColor: 'divider', bgcolor: '#fff' }}>
    <Box
      onWheel={narrow ? onWheel : undefined}
      data-testid="toolbar"
      sx={{
        display: 'flex', alignItems: 'center', px: 1, py: 0.5, gap: 0.25, flexWrap: 'nowrap', overflowX: 'auto',
        // 마지막 버튼 뒤 여백: 스크롤 컨테이너는 오른쪽 padding 을 먹기 쉬우니 ::after 로 보장한다
        '&::after': { content: '""', flex: '0 0 8px' },
        // 페이드는 형제(absolute)로 두고 그만큼 pr 을 준다 — 예전 sticky ::after 는 마지막 '페이지 관리' 버튼을 덮어 잘려 보였다
        ...(narrow ? { ...H_SCROLL_SX, pr: `${FADE_W}px` } : {})
      }}
    >
      <ToolBtn compact={coarse} label={t('pages')} icon={<IconPages />} active={p.sidebarOpen} onClick={p.onToggleSidebar} />
      <ToolBtn compact={coarse} label={t('select')} icon={<IconCursor />} active={is('select')} onClick={() => setTool('select')} />
      <ToolBtn compact={coarse} label={t('undo')} icon={<IconUndo />} disabled={!canUndo} onClick={() => undo()} />
      <ToolBtn compact={coarse} label={t('redo')} icon={<IconRedo />} disabled={!canRedo} onClick={() => redo()} />

      <Box sx={{ flex: 1 }} />

      {/* 텍스트 그룹: 추가/수정. 텍스트 수정은 토글(세션) — 켜져 있는 동안 하이라이트 유지, 다시 누르면 종료(변경 있으면 저장 확인) */}
      <ToolBtn compact={coarse}
        label={textItem.label}
        icon={textItem.icon}
        active={is('addText') || is('editText')}
        onClick={() => toggle(textShown)}
        onDropdown={text.open}
        menuTestId="tool-text-menu"
      />
      <ToolBtn compact={coarse}
        label={t('eraser')}
        icon={<IconEraser />}
        active={is('whiteout') || is('eraseDrawing')}
        onClick={() => {
          if (is('whiteout') || is('eraseDrawing')) {
            setTool('select')
          } else if (eraser.last === 'whiteout') {
            enterWhiteout()
          } else {
            setTool('eraseDrawing')
          }
        }}
        onDropdown={eraser.open}
        menuTestId="tool-eraser-menu"
      />
      <ToolBtn compact={coarse} label={t('highlight')} icon={<IconHighlighter />} active={is('highlight')} onClick={() => toggle('highlight')} />
      <ToolBtn compact={coarse} label={t('pencil')} icon={<IconPen />} active={is('pencil')} onClick={() => toggle('pencil')} />
      <ToolBtn compact={coarse}
        label={image.last === 'stamp' ? t('stamp') : t('image')}
        icon={image.last === 'stamp' ? <IconStamp /> : <IconImage />}
        active={is('image') || is('stamp')}
        onClick={() => (image.last === 'stamp' ? p.onOpenStamp() : p.onOpenImage())}
        onDropdown={image.open}
        menuTestId="tool-image-menu"
      />
      {/* 도형 버튼은 지우개(도형 덮기)와 연동: 지우개가 켜지면 그 도형(기본 사각형)을 표시하며 함께 활성 */}
      <ToolBtn compact={coarse}
        label={shapeShown === 'ellipse' ? t('ellipse') : t('rectangle')}
        icon={shapeShown === 'ellipse' ? <IconCircle /> : <IconSquare />}
        active={is('rect') || is('ellipse') || is('whiteout')}
        onClick={() => {
          if (is('rect') || is('ellipse') || is('whiteout')) setTool('select')
          else setTool(shape.last)
        }}
        onDropdown={shape.open}
        menuTestId="tool-shape-menu"
      />
      {/* 표시 그룹: X 표시 / 체크 */}
      <ToolBtn compact={coarse}
        label={markItem.label}
        icon={markItem.icon}
        active={is('cross') || is('check')}
        onClick={() => toggle(markShown)}
        onDropdown={mark.open}
        menuTestId="tool-mark-menu"
      />
      {/* 주석 그룹: 서명 / 주석 / 링크 */}
      <ToolBtn compact={coarse}
        label={annotItem.label}
        icon={annotItem.icon}
        active={is('sign') || is('note') || is('link')}
        onClick={() => runAnnot(annotShown)}
        onDropdown={annot.open}
        menuTestId="tool-annot-menu"
      />
      <ToolBtn compact={coarse} label={t('watermark')} icon={<IconWatermark />} active={is('watermark')} onClick={() => toggle('watermark')} />

      <Box sx={{ flex: 1 }} />

      {/* 페이지 레이아웃은 순수 메뉴 버튼 — 본체·⌄ 어느 쪽을 눌러도 패널 */}
      <ToolBtn compact={coarse} label={t('pageLayout')} icon={<IconLayout />} active={!!layoutMenu} onClick={(e) => setLayoutMenu(e.currentTarget)} onDropdown={(e) => setLayoutMenu(e.currentTarget)} menuTestId="tool-layout-menu" />
      <ToolBtn compact={coarse} label={t('managePages')} icon={<IconGrid />} onClick={p.onManagePages} />

      {text.menu}
      {mark.menu}
      {annot.menu}
      {eraser.menu}
      {image.menu}
      {shape.menu}

      {/* ── 페이지 레이아웃 패널 (Guru: Page Mode / Page Transition / Page Rotation) ── */}
      <Menu anchorEl={layoutMenu} open={!!layoutMenu} onClose={() => setLayoutMenu(null)}>
        <Box sx={{ px: 2, py: 0.5, width: 280 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Typography variant="body2">{t('pageMode')}</Typography>
            <Box sx={{ display: 'flex', gap: 0.3 }}>
              <LayoutBtn title={t('pageModeSingle')} selected={pageMode === 'single'} onClick={() => setPageMode('single')}>
                <IconPageSingle fontSize="small" />
              </LayoutBtn>
              <LayoutBtn title={t('pageModeDouble')} selected={pageMode === 'double'} onClick={() => setPageMode('double')}>
                <IconPageDouble fontSize="small" />
              </LayoutBtn>
              <LayoutBtn title={t('pageModeFit')} onClick={() => requestFit()}>
                <IconFit fontSize="small" />
              </LayoutBtn>
            </Box>
          </Box>
          <Divider />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Typography variant="body2">{t('pageTransition')}</Typography>
            <Box sx={{ display: 'flex', gap: 0.3 }}>
              <LayoutBtn title={t('transitionContinuous')} selected={pageTransition === 'continuous'} onClick={() => setPageTransition('continuous')}>
                <IconScrollContinuous fontSize="small" />
              </LayoutBtn>
              <LayoutBtn title={t('transitionPaged')} selected={pageTransition === 'paged'} onClick={() => setPageTransition('paged')}>
                <IconScrollPaged fontSize="small" />
              </LayoutBtn>
            </Box>
          </Box>
          <Divider />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Typography variant="body2">{t('pageRotation')}</Typography>
            <Box sx={{ display: 'flex', gap: 0.3 }}>
              <LayoutBtn
                title={t('rotateLeft')}
                onClick={() => rotateCurrentPage(-90)}
              >
                <IconRotateLeft fontSize="small" />
              </LayoutBtn>
              <LayoutBtn
                title={t('rotateRight')}
                onClick={() => rotateCurrentPage(90)}
              >
                <IconRotateRight fontSize="small" />
              </LayoutBtn>
            </Box>
          </Box>
        </Box>
      </Menu>
    </Box>
    {narrow && <Box sx={fadeSx} />}
    </Box>
  )
}
