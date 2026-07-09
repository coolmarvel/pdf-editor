import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import GridViewRounded from '@mui/icons-material/GridViewRounded'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded'
import RotateLeftRounded from '@mui/icons-material/RotateLeftRounded'
import RotateRightRounded from '@mui/icons-material/RotateRightRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import SaveAltRounded from '@mui/icons-material/SaveAltRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import UploadFileRounded from '@mui/icons-material/UploadFileRounded'
import NoteAddOutlined from '@mui/icons-material/NoteAddOutlined'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { buildPdf } from '@renderer/pdf/save'
import ThumbCanvas from './ThumbCanvas'

const MIN_W = 150
const MAX_W = 420

/**
 * 좌측 페이지 사이드바 (Guru 파리티):
 * 폭 조절 핸들 · 호버 시 ⋮ 메뉴(이동/회전/복제/추출/삭제) · 드래그로 순서 변경(보라 삽입선) ·
 * 페이지 사이 실선+⊕(페이지 추가/PDF 업로드)
 */
export default function ThumbnailSidebar({ onManagePages }: { onManagePages: () => void }): JSX.Element {
  const t = useT()
  const pages = useEditor((s) => s.pages)
  const displaySizes = useEditor((s) => s.displaySizes)
  const objectsByPage = useEditor((s) => s.objectsByPage)
  const currentPage = useEditor((s) => s.currentPage)
  const requestScrollTo = useEditor((s) => s.requestScrollTo)
  const pageNudge = useEditor((s) => s.pageNudge)
  const pageRotate = useEditor((s) => s.pageRotate)
  const pageDuplicate = useEditor((s) => s.pageDuplicate)
  const pageRemove = useEditor((s) => s.pageRemove)
  const pageInsertBlank = useEditor((s) => s.pageInsertBlank)
  const pageImport = useEditor((s) => s.pageImport)
  const pageMoveToIndex = useEditor((s) => s.pageMoveToIndex)
  const fileName = useEditor((s) => s.fileName)

  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem('sidebarW'))
    return saved >= MIN_W && saved <= MAX_W ? saved : 208
  })
  /** ⋮ 메뉴 */
  const [pageMenu, setPageMenu] = useState<{ anchor: HTMLElement; index: number } | null>(null)
  /** ⊕ 메뉴 (삽입 위치) */
  const [addMenu, setAddMenu] = useState<{ anchor: HTMLElement; index: number } | null>(null)
  /** 드래그 중인 페이지 index / 삽입점 (포인터 기반 — HTML5 dnd 는 Electron 에서 불안정) */
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const dragRef = useRef<{ index: number; startY: number; active: boolean; drop: number | null } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const insertAtRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  function startResize(e: React.PointerEvent): void {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const onMove = (ev: PointerEvent): void => {
      setWidth(Math.max(MIN_W, Math.min(MAX_W, startW + ev.clientX - startX)))
    }
    const onUp = (ev: PointerEvent): void => {
      const w = Math.max(MIN_W, Math.min(MAX_W, startW + ev.clientX - startX))
      localStorage.setItem('sidebarW', String(w))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  async function extractPage(index: number): Promise<void> {
    const p = pages[index]
    const bytes = await buildPdf({ pages: [p], objectsByPage: { [p.id]: objectsByPage[p.id] ?? [] }, displaySizes })
    await window.api.saveBuffer(`${fileName || 'document'}-p${index + 1}.pdf`, bytes)
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    await pageImport(bytes, insertAtRef.current)
  }

  /** 컨테이너 기준 드래그 위치 → 삽입점 계산 (썸네일 중앙 기준 위/아래) */
  function calcDropIndex(clientY: number): number {
    const nodes = listRef.current?.querySelectorAll('[data-thumb]')
    if (!nodes || nodes.length === 0) return 0
    let idx = nodes.length
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) {
        idx = i
        break
      }
    }
    return idx
  }

  /** 페이지 사이 실선 + ⊕ (호버 시 진해짐) */
  const gap = (index: number): JSX.Element => (
    <Box
      key={`gap-${index}`}
      sx={{
        position: 'relative',
        height: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '& .gapline': { position: 'absolute', left: 4, right: 4, top: '50%', height: '1px', bgcolor: 'divider' },
        '& .gapbtn': { opacity: 0, transition: 'opacity .12s', zIndex: 1 },
        '&:hover .gapbtn': { opacity: 1 },
        // 드롭 삽입점 표시 (보라 선)
        ...(dropIdx === index && dragIdx !== null ? { '& .gapline': { position: 'absolute', left: 4, right: 4, top: '50%', height: '3px', bgcolor: 'secondary.main', borderRadius: 2 } } : {})
      }}
    >
      <Box className="gapline" />
      <IconButton
        className="gapbtn"
        size="small"
        onClick={(e) => setAddMenu({ anchor: e.currentTarget, index })}
        sx={{ width: 18, height: 18, bgcolor: '#fff', border: '1px solid #d7dae0', '&:hover': { bgcolor: '#f1f2f4' } }}
      >
        <AddRounded sx={{ fontSize: 13 }} />
      </IconButton>
    </Box>
  )

  return (
    <Box sx={{ position: 'relative', width, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: '#fcfcfd', display: 'flex', flexDirection: 'column' }}>
      <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', p: 1.5, pt: 1.5 }}>
        <Button fullWidth size="small" variant="outlined" color="inherit" startIcon={<GridViewRounded />} onClick={onManagePages} sx={{ mb: 0.5 }}>
          {t('managePages')}
        </Button>
        {gap(0)}
        {pages.map((p, i) => {
          const size = displaySizes[p.id] ?? { w: 595, h: 842 }
          const active = i === currentPage
          return (
            <Box key={p.id}>
              <Box
                data-thumb
                data-pgid={p.id}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault() // 드래그 중 텍스트 선택·브라우저 자동 스크롤 방지
                  dragRef.current = { index: i, startY: e.clientY, active: false, drop: null }
                  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                }}
                onPointerMove={(e) => {
                  const d = dragRef.current
                  if (!d) return
                  if (!d.active && Math.abs(e.clientY - d.startY) > 6) {
                    d.active = true
                    setDragIdx(d.index)
                  }
                  if (d.active) {
                    d.drop = calcDropIndex(e.clientY)
                    setDropIdx(d.drop)
                  }
                }}
                onPointerUp={() => {
                  const d = dragRef.current
                  dragRef.current = null
                  if (d?.active) {
                    if (d.drop !== null) pageMoveToIndex(new Set([pages[d.index].id]), d.drop)
                    setDragIdx(null)
                    setDropIdx(null)
                  } else {
                    requestScrollTo(i) // 클릭 = 해당 페이지로 이동
                  }
                }}
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  userSelect: 'none',
                  touchAction: 'none',
                  opacity: dragIdx === i ? 0.4 : 1,
                  '& .thumbmenu': { opacity: 0, transition: 'opacity .12s' },
                  '&:hover .thumbmenu': { opacity: 1 }
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{ overflow: 'hidden', borderColor: active ? 'secondary.main' : 'divider', borderWidth: active ? 2 : 1, borderRadius: 1.5 }}
                >
                  <ThumbCanvas page={p} width={300} pageW={size.w} />
                </Paper>
                {/* 호버 ⋮ 메뉴 버튼 (우측 상단) */}
                <IconButton
                  className="thumbmenu"
                  size="small"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPageMenu({ anchor: e.currentTarget, index: i })
                  }}
                  sx={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, bgcolor: 'rgba(255,255,255,.95)', border: '1px solid #d7dae0', boxShadow: 1, '&:hover': { bgcolor: '#fff' } }}
                >
                  <MoreVertRounded sx={{ fontSize: 16 }} />
                </IconButton>
                <Typography variant="caption" display="block" textAlign="center" color={active ? 'secondary.main' : 'text.secondary'} fontWeight={active ? 700 : 400}>
                  {i + 1}
                </Typography>
              </Box>
              {gap(i + 1)}
            </Box>
          )
        })}
      </Box>

      {/* 폭 조절 핸들 */}
      <Box
        onPointerDown={startResize}
        sx={{
          position: 'absolute',
          top: 0,
          right: -3,
          width: 7,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 5,
          '&:hover': { bgcolor: 'rgba(91,91,214,.18)' }
        }}
      />

      {/* ⋮ 페이지 메뉴 */}
      <Menu anchorEl={pageMenu?.anchor ?? null} open={!!pageMenu} onClose={() => setPageMenu(null)}>
        <MenuItem
          disabled={pageMenu?.index === 0}
          onClick={() => {
            if (pageMenu) pageNudge(new Set([pages[pageMenu.index].id]), -1)
            setPageMenu(null)
          }}
        >
          <ListItemIcon>
            <ArrowUpwardRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('moveUp')}</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={pageMenu?.index === pages.length - 1}
          onClick={() => {
            if (pageMenu) pageNudge(new Set([pages[pageMenu.index].id]), 1)
            setPageMenu(null)
          }}
        >
          <ListItemIcon>
            <ArrowDownwardRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('moveDown')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (pageMenu) pageRotate(new Set([pages[pageMenu.index].id]), -90)
            setPageMenu(null)
          }}
        >
          <ListItemIcon>
            <RotateLeftRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('rotateLeft')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (pageMenu) pageRotate(new Set([pages[pageMenu.index].id]), 90)
            setPageMenu(null)
          }}
        >
          <ListItemIcon>
            <RotateRightRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('rotateRight')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (pageMenu) pageDuplicate(new Set([pages[pageMenu.index].id]))
            setPageMenu(null)
          }}
        >
          <ListItemIcon>
            <ContentCopyRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('duplicate')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (pageMenu) void extractPage(pageMenu.index)
            setPageMenu(null)
          }}
        >
          <ListItemIcon>
            <SaveAltRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('extractPage')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          disabled={pages.length <= 1}
          onClick={() => {
            if (pageMenu) pageRemove(new Set([pages[pageMenu.index].id]))
            setPageMenu(null)
          }}
          sx={{ color: 'primary.main' }}
        >
          <ListItemIcon>
            <DeleteOutlineRounded fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>{t('delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* ⊕ 삽입 메뉴 */}
      <Menu anchorEl={addMenu?.anchor ?? null} open={!!addMenu} onClose={() => setAddMenu(null)}>
        <MenuItem
          onClick={() => {
            if (addMenu) {
              insertAtRef.current = addMenu.index
              fileRef.current?.click()
            }
            setAddMenu(null)
          }}
        >
          <ListItemIcon>
            <UploadFileRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('uploadPdf')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (addMenu) pageInsertBlank(addMenu.index)
            setAddMenu(null)
          }}
        >
          <ListItemIcon>
            <NoteAddOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('addPage')}</ListItemText>
        </MenuItem>
      </Menu>

      <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => void onImportFile(e)} />
    </Box>
  )
}
