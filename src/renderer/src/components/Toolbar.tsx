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
import SvgIcon from '@mui/material/SvgIcon'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined'
import NearMeOutlined from '@mui/icons-material/NearMeOutlined'
import UndoRounded from '@mui/icons-material/UndoRounded'
import RedoRounded from '@mui/icons-material/RedoRounded'
import TitleRounded from '@mui/icons-material/TitleRounded'
import EditNoteRounded from '@mui/icons-material/EditNoteRounded'
import BorderColorRounded from '@mui/icons-material/BorderColorRounded'
import CreateRounded from '@mui/icons-material/CreateRounded'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import ApprovalRounded from '@mui/icons-material/ApprovalRounded'
import CropSquareRounded from '@mui/icons-material/CropSquareRounded'
import CircleOutlined from '@mui/icons-material/CircleOutlined'
import CloseRounded from '@mui/icons-material/CloseRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import DrawRounded from '@mui/icons-material/DrawRounded'
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded'
import LinkRounded from '@mui/icons-material/LinkRounded'
import RotateLeftRounded from '@mui/icons-material/RotateLeftRounded'
import RotateRightRounded from '@mui/icons-material/RotateRightRounded'
import ArticleOutlined from '@mui/icons-material/ArticleOutlined'
import GridViewRounded from '@mui/icons-material/GridViewRounded'
import { useEditor, type Tool } from '@renderer/store/editor'

/** MUI에 지우개 아이콘이 없어 커스텀 SVG */
function EraserIcon(props: React.ComponentProps<typeof SvgIcon>): JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="M16.24 3.56l4.2 4.2c.78.78.78 2.05 0 2.83L12 19.03H7.66L3.4 14.78c-.78-.78-.78-2.05 0-2.83l9.19-9.2c.78-.78 2.05-.78 2.83 0l.82.81zM4.81 13.36l3.54 3.54 2.48-2.48-3.54-3.54-2.48 2.48zM5 21h14v2H5v-2z" />
    </SvgIcon>
  )
}

interface ToolBtnProps {
  label: string
  icon: JSX.Element
  active?: boolean
  disabled?: boolean
  onClick: (e: React.MouseEvent<HTMLElement>) => void
  /** 있으면 스플릿 버튼: 기능 버튼(onClick=토글)과 별도의 ⌄ 버튼(메뉴 열기) — Guru 동작 */
  onDropdown?: (e: React.MouseEvent<HTMLElement>) => void
}

function ToolBtn({ label, icon, active, disabled, onClick, onDropdown }: ToolBtnProps): JSX.Element {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Tooltip title={label}>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={onClick}
            sx={{
              flexDirection: 'column',
              borderRadius: 2,
              px: 0.8,
              py: 0.4,
              color: active ? 'primary.main' : 'text.primary',
              bgcolor: active ? 'primary.light' : 'transparent',
              '&:hover': { bgcolor: active ? 'primary.light' : '#f1f2f4' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>{icon}</Box>
            <Typography variant="caption" sx={{ fontSize: 11, lineHeight: 1.15, mt: 0.2, whiteSpace: 'nowrap' }}>
              {label}
            </Typography>
          </IconButton>
        </span>
      </Tooltip>
      {onDropdown && (
        <IconButton size="small" onClick={onDropdown} sx={{ borderRadius: 1.5, p: 0, ml: -0.4, alignSelf: 'stretch', width: 16, color: 'text.secondary', '&:hover': { bgcolor: '#f1f2f4' } }}>
          <ArrowDropDownRounded sx={{ fontSize: 18 }} />
        </IconButton>
      )}
    </Box>
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

  const [eraserMenu, setEraserMenu] = useState<HTMLElement | null>(null)
  const [imageMenu, setImageMenu] = useState<HTMLElement | null>(null)
  const [shapeMenu, setShapeMenu] = useState<HTMLElement | null>(null)
  const [layoutMenu, setLayoutMenu] = useState<HTMLElement | null>(null)
  // 스플릿 버튼의 "기본값" = 마지막으로 쓴 변형 (기능 버튼이 이걸 켜고 끈다)
  const [lastEraser, setLastEraser] = useState<'whiteout' | 'eraseDrawing'>('whiteout')
  const [lastShape, setLastShape] = useState<'rect' | 'ellipse'>('rect')
  const [lastImage, setLastImage] = useState<'image' | 'stamp'>('image')

  const is = (t: Tool): boolean => tool === t
  /** 도구 토글 (Guru): 활성 상태에서 다시 누르면 비활성(선택 도구로) */
  const toggle = (t: Tool): void => setTool(tool === t ? 'select' : t)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.3, borderBottom: 1, borderColor: 'divider', bgcolor: '#fff', gap: 0.2, flexWrap: 'nowrap', overflowX: 'auto' }}>
      <ToolBtn label="페이지" icon={<ViewSidebarOutlined />} active={p.sidebarOpen} onClick={p.onToggleSidebar} />
      <ToolBtn label="선택" icon={<NearMeOutlined />} active={is('select')} onClick={() => setTool('select')} />
      <ToolBtn label="실행취소" icon={<UndoRounded />} disabled={!canUndo} onClick={() => undo()} />
      <ToolBtn label="다시실행" icon={<RedoRounded />} disabled={!canRedo} onClick={() => redo()} />

      <Box sx={{ flex: 1 }} />

      <ToolBtn label="텍스트 추가" icon={<TitleRounded />} active={is('addText')} onClick={() => toggle('addText')} />
      {/* 텍스트 수정은 토글(세션) — 켜져 있는 동안 하이라이트 유지, 다시 누르면 종료(변경 있으면 저장 확인) */}
      <ToolBtn label="텍스트 수정" icon={<EditNoteRounded />} active={is('editText')} onClick={() => setTool(is('editText') ? 'select' : 'editText')} />
      <ToolBtn
        label="지우개"
        icon={<EraserIcon />}
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
      <ToolBtn label="형광펜" icon={<BorderColorRounded />} active={is('highlight')} onClick={() => toggle('highlight')} />
      <ToolBtn label="연필" icon={<CreateRounded />} active={is('pencil')} onClick={() => toggle('pencil')} />
      <ToolBtn
        label={lastImage === 'stamp' ? '스탬프' : '이미지'}
        icon={lastImage === 'stamp' ? <ApprovalRounded /> : <ImageOutlined />}
        active={is('image') || is('stamp')}
        onClick={() => (lastImage === 'stamp' ? p.onOpenStamp() : p.onOpenImage())}
        onDropdown={(e) => setImageMenu(e.currentTarget)}
      />
      {/* 도형 버튼은 지우개(도형 덮기)와 연동: 지우개가 켜지면 그 도형(기본 사각형)을 표시하며 함께 활성 */}
      <ToolBtn
        label={(tool === 'rect' || tool === 'ellipse' ? tool : tool === 'whiteout' ? eraserKind : lastShape) === 'ellipse' ? '원' : '사각형'}
        icon={(tool === 'rect' || tool === 'ellipse' ? tool : tool === 'whiteout' ? eraserKind : lastShape) === 'ellipse' ? <CircleOutlined /> : <CropSquareRounded />}
        active={is('rect') || is('ellipse') || is('whiteout')}
        onClick={() => {
          if (is('rect') || is('ellipse') || is('whiteout')) setTool('select')
          else setTool(lastShape)
        }}
        onDropdown={(e) => setShapeMenu(e.currentTarget)}
      />
      <ToolBtn label="X 표시" icon={<CloseRounded />} active={is('cross')} onClick={() => toggle('cross')} />
      <ToolBtn label="체크" icon={<CheckRounded />} active={is('check')} onClick={() => toggle('check')} />
      <ToolBtn label="서명" icon={<DrawRounded />} active={is('sign')} onClick={p.onOpenSign} />
      <ToolBtn label="주석" icon={<ChatBubbleOutlineRounded />} active={is('note')} onClick={() => toggle('note')} />
      <ToolBtn label="링크" icon={<LinkRounded />} active={is('link')} onClick={() => toggle('link')} />

      <Box sx={{ flex: 1 }} />

      {/* 페이지 레이아웃은 순수 메뉴 버튼 — 본체·⌄ 어느 쪽을 눌러도 메뉴 */}
      <ToolBtn label="페이지 레이아웃" icon={<ArticleOutlined />} onClick={(e) => setLayoutMenu(e.currentTarget)} onDropdown={(e) => setLayoutMenu(e.currentTarget)} />
      <ToolBtn label="페이지 관리" icon={<GridViewRounded />} onClick={p.onManagePages} />

      {/* ── 드롭다운 메뉴들 ── */}
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
            <EraserIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="지우개" secondary="드래그한 영역을 도형으로 덮어서 지움" />
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
            <EraserIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="그리기 지우개" secondary="연필·형광펜 선을 지움" />
        </MenuItem>
      </Menu>

      <Menu anchorEl={imageMenu} open={!!imageMenu} onClose={() => setImageMenu(null)}>
        <MenuItem
          onClick={() => {
            setLastImage('image')
            setImageMenu(null)
            p.onOpenImage()
          }}
        >
          <ListItemIcon>
            <ImageOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>이미지</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setLastImage('stamp')
            setImageMenu(null)
            p.onOpenStamp()
          }}
        >
          <ListItemIcon>
            <ApprovalRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>스탬프</ListItemText>
        </MenuItem>
      </Menu>

      <Menu anchorEl={shapeMenu} open={!!shapeMenu} onClose={() => setShapeMenu(null)}>
        {/* 지우개(도형 덮기)가 켜져 있으면 이 메뉴는 지우개 도형을 바꾼다 */}
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
            <CropSquareRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>사각형</ListItemText>
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
            <CircleOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>원</ListItemText>
        </MenuItem>
      </Menu>

      <Menu anchorEl={layoutMenu} open={!!layoutMenu} onClose={() => setLayoutMenu(null)}>
        <Box sx={{ px: 2, py: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            현재 페이지 회전
          </Typography>
        </Box>
        <MenuItem
          onClick={() => {
            const pg = pages[currentPage]
            if (pg) pageRotate(new Set([pg.id]), -90)
          }}
        >
          <ListItemIcon>
            <RotateLeftRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>왼쪽으로 회전</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const pg = pages[currentPage]
            if (pg) pageRotate(new Set([pg.id]), 90)
          }}
        >
          <ListItemIcon>
            <RotateRightRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>오른쪽으로 회전</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            pageRotate(new Set(pages.map((x) => x.id)), 90)
          }}
        >
          <ListItemIcon>
            <RotateRightRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>모든 페이지 오른쪽 회전</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  )
}
