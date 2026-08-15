import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
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
import { useEditor, type Tool } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'

interface ToolBtnProps {
  label: string
  icon: JSX.Element
  active?: boolean
  disabled?: boolean
  onClick: (e: React.MouseEvent<HTMLElement>) => void
  /** 있으면 스플릿 버튼: 기능 버튼(onClick=토글)과 별도의 ⌄ 버튼(메뉴 열기) — Guru 동작 */
  onDropdown?: (e: React.MouseEvent<HTMLElement>) => void
}

/** 모든 툴 버튼 규격 통일: 본체 76×48px 고정, ⌄ 는 16px 고정 부가물 — 라벨 길이와 무관하게 같은 박스 */
const TOOLBTN_W = 76
const TOOLBTN_H = 48

function ToolBtn({ label, icon, active, disabled, onClick, onDropdown }: ToolBtnProps): JSX.Element {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <Tooltip title={label}>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={onClick}
            sx={{
              width: TOOLBTN_W,
              height: TOOLBTN_H,
              flexDirection: 'column',
              justifyContent: 'center',
              borderRadius: 2,
              p: 0,
              color: active ? 'primary.main' : 'text.primary',
              bgcolor: active ? 'primary.light' : 'transparent',
              '&:hover': { bgcolor: active ? 'primary.light' : '#f2f4f7' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', height: 24 }}>{icon}</Box>
            <Typography variant="caption" sx={{ fontSize: 11.5, lineHeight: 1.15, mt: 0.2, whiteSpace: 'nowrap', maxWidth: TOOLBTN_W - 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </Typography>
          </IconButton>
        </span>
      </Tooltip>
      {onDropdown && (
        <IconButton size="small" onClick={onDropdown} sx={{ borderRadius: 1.5, p: 0, width: 16, height: TOOLBTN_H, color: 'text.secondary', '&:hover': { bgcolor: '#f2f4f7' } }}>
          <IconChevronDown sx={{ fontSize: 15 }} />
        </IconButton>
      )}
    </Box>
  )
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
          '&:hover': { bgcolor: selected ? 'primary.light' : '#f2f4f7' }
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
  const canUndo = useEditor((s) => s.history.past.length > 0 && !s.editTextSnapshot)
  const canRedo = useEditor((s) => s.history.future.length > 0 && !s.editTextSnapshot)
  const pages = useEditor((s) => s.pages)
  const currentPage = useEditor((s) => s.currentPage)
  const pageRotate = useEditor((s) => s.pageRotate)
  const eraserKind = useEditor((s) => s.eraserStyle.kind)
  const setEraserStyle = useEditor((s) => s.setEraserStyle)
  const pageMode = useEditor((s) => s.pageMode)
  const setPageMode = useEditor((s) => s.setPageMode)
  const pageTransition = useEditor((s) => s.pageTransition)
  const setPageTransition = useEditor((s) => s.setPageTransition)
  const requestFit = useEditor((s) => s.requestFit)

  const [eraserMenu, setEraserMenu] = useState<HTMLElement | null>(null)
  const [imageMenu, setImageMenu] = useState<HTMLElement | null>(null)
  const [shapeMenu, setShapeMenu] = useState<HTMLElement | null>(null)
  const [layoutMenu, setLayoutMenu] = useState<HTMLElement | null>(null)
  // 스플릿 버튼의 "기본값" = 마지막으로 쓴 변형 (기능 버튼이 이걸 켜고 끈다)
  const [lastEraser, setLastEraser] = useState<'whiteout' | 'eraseDrawing'>('whiteout')
  const [lastShape, setLastShape] = useState<'rect' | 'ellipse'>('rect')
  const [lastImage, setLastImage] = useState<'image' | 'stamp'>('image')

  const is = (x: Tool): boolean => tool === x
  /** 도구 토글 (Guru): 활성 상태에서 다시 누르면 비활성(선택 도구로) */
  const toggle = (x: Tool): void => setTool(tool === x ? 'select' : x)

  const shapeShown = tool === 'rect' || tool === 'ellipse' ? tool : tool === 'whiteout' ? eraserKind : lastShape

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.3, borderBottom: 1, borderColor: 'divider', bgcolor: '#fff', gap: 0.2, flexWrap: 'nowrap', overflowX: 'auto' }}>
      <ToolBtn label={t('pages')} icon={<IconPages />} active={p.sidebarOpen} onClick={p.onToggleSidebar} />
      <ToolBtn label={t('select')} icon={<IconCursor />} active={is('select')} onClick={() => setTool('select')} />
      <ToolBtn label={t('undo')} icon={<IconUndo />} disabled={!canUndo} onClick={() => undo()} />
      <ToolBtn label={t('redo')} icon={<IconRedo />} disabled={!canRedo} onClick={() => redo()} />

      <Box sx={{ flex: 1 }} />

      <ToolBtn label={t('addText')} icon={<IconText />} active={is('addText')} onClick={() => toggle('addText')} />
      {/* 텍스트 수정은 토글(세션) — 켜져 있는 동안 하이라이트 유지, 다시 누르면 종료(변경 있으면 저장 확인) */}
      <ToolBtn label={t('editText')} icon={<IconTextEdit />} active={is('editText')} onClick={() => setTool(is('editText') ? 'select' : 'editText')} />
      <ToolBtn
        label={t('eraser')}
        icon={<IconEraser />}
        active={is('whiteout') || is('eraseDrawing')}
        onClick={() => {
          if (is('whiteout') || is('eraseDrawing')) {
            setTool('select')
          } else if (lastEraser === 'whiteout') {
            setEraserStyle({ kind: 'rect' })
            setTool('whiteout')
          } else {
            setTool('eraseDrawing')
          }
        }}
        onDropdown={(e) => setEraserMenu(e.currentTarget)}
      />
      <ToolBtn label={t('highlight')} icon={<IconHighlighter />} active={is('highlight')} onClick={() => toggle('highlight')} />
      <ToolBtn label={t('pencil')} icon={<IconPen />} active={is('pencil')} onClick={() => toggle('pencil')} />
      <ToolBtn
        label={lastImage === 'stamp' ? t('stamp') : t('image')}
        icon={lastImage === 'stamp' ? <IconStamp /> : <IconImage />}
        active={is('image') || is('stamp')}
        onClick={() => (lastImage === 'stamp' ? p.onOpenStamp() : p.onOpenImage())}
        onDropdown={(e) => setImageMenu(e.currentTarget)}
      />
      {/* 도형 버튼은 지우개(도형 덮기)와 연동: 지우개가 켜지면 그 도형(기본 사각형)을 표시하며 함께 활성 */}
      <ToolBtn
        label={shapeShown === 'ellipse' ? t('ellipse') : t('rectangle')}
        icon={shapeShown === 'ellipse' ? <IconCircle /> : <IconSquare />}
        active={is('rect') || is('ellipse') || is('whiteout')}
        onClick={() => {
          if (is('rect') || is('ellipse') || is('whiteout')) setTool('select')
          else setTool(lastShape)
        }}
        onDropdown={(e) => setShapeMenu(e.currentTarget)}
      />
      <ToolBtn label={t('cross')} icon={<IconCross />} active={is('cross')} onClick={() => toggle('cross')} />
      <ToolBtn label={t('check')} icon={<IconCheck />} active={is('check')} onClick={() => toggle('check')} />
      <ToolBtn label={t('sign')} icon={<IconSign />} active={is('sign')} onClick={p.onOpenSign} />
      <ToolBtn label={t('watermark')} icon={<IconWatermark />} active={is('watermark')} onClick={() => toggle('watermark')} />
      <ToolBtn label={t('note')} icon={<IconNote />} active={is('note')} onClick={() => toggle('note')} />
      <ToolBtn label={t('link')} icon={<IconLink />} active={is('link')} onClick={() => toggle('link')} />

      <Box sx={{ flex: 1 }} />

      {/* 페이지 레이아웃은 순수 메뉴 버튼 — 본체·⌄ 어느 쪽을 눌러도 패널 */}
      <ToolBtn label={t('pageLayout')} icon={<IconLayout />} onClick={(e) => setLayoutMenu(e.currentTarget)} onDropdown={(e) => setLayoutMenu(e.currentTarget)} />
      <ToolBtn label={t('managePages')} icon={<IconGrid />} onClick={p.onManagePages} />

      {/* ── 지우개 메뉴 ── */}
      <Menu anchorEl={eraserMenu} open={!!eraserMenu} onClose={() => setEraserMenu(null)}>
        <MenuItem
          selected={is('whiteout')}
          onClick={() => {
            setLastEraser('whiteout')
            setEraserStyle({ kind: 'rect' }) // 지우개 진입 시 도형은 항상 사각형으로 리셋 (Guru 동작)
            setTool('whiteout')
            setEraserMenu(null)
          }}
        >
          <ListItemIcon>
            <IconEraser fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('eraser')} secondary={t('eraserDesc')} />
        </MenuItem>
        <MenuItem
          selected={is('eraseDrawing')}
          onClick={() => {
            setLastEraser('eraseDrawing')
            setTool('eraseDrawing')
            setEraserMenu(null)
          }}
        >
          <ListItemIcon>
            <IconEraser fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('eraseDrawing')} secondary={t('eraseDrawingDesc')} />
        </MenuItem>
      </Menu>

      {/* ── 이미지/스탬프 메뉴 ── */}
      <Menu anchorEl={imageMenu} open={!!imageMenu} onClose={() => setImageMenu(null)}>
        <MenuItem
          onClick={() => {
            setLastImage('image')
            setImageMenu(null)
            p.onOpenImage()
          }}
        >
          <ListItemIcon>
            <IconImage fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('image')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setLastImage('stamp')
            setImageMenu(null)
            p.onOpenStamp()
          }}
        >
          <ListItemIcon>
            <IconStamp fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('stamp')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── 도형 메뉴 (지우개가 켜져 있으면 지우개 도형을 바꾼다) ── */}
      <Menu anchorEl={shapeMenu} open={!!shapeMenu} onClose={() => setShapeMenu(null)}>
        <MenuItem
          selected={tool === 'whiteout' ? eraserKind === 'rect' : is('rect')}
          onClick={() => {
            if (tool === 'whiteout') {
              setEraserStyle({ kind: 'rect' })
            } else {
              setLastShape('rect')
              setTool('rect')
            }
            setShapeMenu(null)
          }}
        >
          <ListItemIcon>
            <IconSquare fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('rectangle')}</ListItemText>
        </MenuItem>
        <MenuItem
          selected={tool === 'whiteout' ? eraserKind === 'ellipse' : is('ellipse')}
          onClick={() => {
            if (tool === 'whiteout') {
              setEraserStyle({ kind: 'ellipse' })
            } else {
              setLastShape('ellipse')
              setTool('ellipse')
            }
            setShapeMenu(null)
          }}
        >
          <ListItemIcon>
            <IconCircle fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('ellipse')}</ListItemText>
        </MenuItem>
      </Menu>

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
                onClick={() => {
                  const pg = pages[currentPage]
                  if (pg) pageRotate(new Set([pg.id]), -90)
                }}
              >
                <IconRotateLeft fontSize="small" />
              </LayoutBtn>
              <LayoutBtn
                title={t('rotateRight')}
                onClick={() => {
                  const pg = pages[currentPage]
                  if (pg) pageRotate(new Set([pg.id]), 90)
                }}
              >
                <IconRotateRight fontSize="small" />
              </LayoutBtn>
            </Box>
          </Box>
        </Box>
      </Menu>
    </Box>
  )
}
