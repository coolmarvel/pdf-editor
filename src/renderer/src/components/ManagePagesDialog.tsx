import { useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import AddRounded from '@mui/icons-material/AddRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import RotateLeftRounded from '@mui/icons-material/RotateLeftRounded'
import RotateRightRounded from '@mui/icons-material/RotateRightRounded'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import UploadFileRounded from '@mui/icons-material/UploadFileRounded'
import UndoRounded from '@mui/icons-material/UndoRounded'
import RedoRounded from '@mui/icons-material/RedoRounded'
import SelectAllRounded from '@mui/icons-material/SelectAllRounded'
import DeselectRounded from '@mui/icons-material/DeselectRounded'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import ThumbCanvas from './ThumbCanvas'

/** pdfguru의 Manage Pages 모달: 썸네일 그리드 + 일괄 작업 + 드래그 순서 변경 */
export default function ManagePagesDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const t = useT()
  const pages = useEditor((s) => s.pages)
  const displaySizes = useEditor((s) => s.displaySizes)
  const pageInsertBlank = useEditor((s) => s.pageInsertBlank)
  const pageRemove = useEditor((s) => s.pageRemove)
  const pageDuplicate = useEditor((s) => s.pageDuplicate)
  const pageRotate = useEditor((s) => s.pageRotate)
  const pageNudge = useEditor((s) => s.pageNudge)
  const pageImport = useEditor((s) => s.pageImport)
  const pageMoveToIndex = useEditor((s) => s.pageMoveToIndex)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.history.past.length > 0 && !s.editTextSnapshot)
  const canRedo = useEditor((s) => s.history.future.length > 0 && !s.editTextSnapshot)

  const [sel, setSel] = useState<Set<string>>(new Set())
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const dragRef = useRef<{ index: number; startX: number; startY: number; active: boolean; drop: number | null } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const has = sel.size > 0

  function toggle(id: string): void {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // 삭제된 페이지가 선택에 남지 않게 정리
  const validSel = new Set([...sel].filter((id) => pages.some((p) => p.id === id)))

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    await pageImport(bytes)
  }

  /** 그리드에서 포인터 위치 → 삽입점 (행 내 좌/우 절반 기준) */
  function calcGridDrop(clientX: number, clientY: number): number {
    const nodes = gridRef.current?.querySelectorAll('[data-mthumb]')
    if (!nodes || nodes.length === 0) return 0
    let idx = nodes.length
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].getBoundingClientRect()
      if (clientY < r.top) {
        idx = i
        break
      }
      if (clientY <= r.bottom) {
        if (clientX < r.left + r.width / 2) {
          idx = i
          break
        }
        idx = i + 1
      }
    }
    return idx
  }

  function finishDrag(drop: number | null, index: number): void {
    if (drop !== null) {
      const dragged = pages[index]
      // 선택에 포함된 페이지를 끌면 선택 전체 이동, 아니면 그 페이지만
      const ids = validSel.has(dragged.id) ? validSel : new Set([dragged.id])
      pageMoveToIndex(ids, drop)
    }
    setDragIdx(null)
    setDropIdx(null)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { height: '86vh' } }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
        <Button size="small" color="inherit" startIcon={<AddRounded />} onClick={() => pageInsertBlank(pages.length)}>
          {t('newPage')}
        </Button>
        <Button size="small" color="inherit" startIcon={<DeleteOutlineRounded />} disabled={!has} onClick={() => { pageRemove(validSel); setSel(new Set()) }}>
          {t('delete')}
        </Button>
        <Button size="small" color="inherit" startIcon={<ContentCopyRounded />} disabled={!has} onClick={() => pageDuplicate(validSel)}>
          {t('duplicate')}
        </Button>
        <Button size="small" color="inherit" startIcon={<RotateLeftRounded />} disabled={!has} onClick={() => pageRotate(validSel, -90)}>
          {t('rotateLeft')}
        </Button>
        <Button size="small" color="inherit" startIcon={<RotateRightRounded />} disabled={!has} onClick={() => pageRotate(validSel, 90)}>
          {t('rotateRight')}
        </Button>
        <Button size="small" color="inherit" startIcon={<ArrowBackRounded />} disabled={!has} onClick={() => pageNudge(validSel, -1)}>
          {t('forward')}
        </Button>
        <Button size="small" color="inherit" startIcon={<ArrowForwardRounded />} disabled={!has} onClick={() => pageNudge(validSel, 1)}>
          {t('backward')}
        </Button>
        <Button size="small" color="inherit" startIcon={<UploadFileRounded />} onClick={() => fileRef.current?.click()}>
          {t('importDoc')}
        </Button>
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => void onImportFile(e)} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t('undo')}>
          <span>
            <IconButton size="small" disabled={!canUndo} onClick={() => undo()}>
              <UndoRounded />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('redo')}>
          <span>
            <IconButton size="small" disabled={!canRedo} onClick={() => redo()}>
              <RedoRounded />
            </IconButton>
          </span>
        </Tooltip>
        <Button size="small" color="inherit" startIcon={<SelectAllRounded />} onClick={() => setSel(new Set(pages.map((p) => p.id)))}>
          {t('selectAll')}
        </Button>
        <Button size="small" color="inherit" startIcon={<DeselectRounded />} disabled={!has} onClick={() => setSel(new Set())}>
          {t('deselect')}
        </Button>
      </Stack>

      <Box
        ref={gridRef}
        sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 3, alignContent: 'start' }}
      >
        {pages.map((p, i) => {
          const size = displaySizes[p.id] ?? { w: 595, h: 842 }
          const selected = validSel.has(p.id)
          // 삽입점 표시: dropIdx === i → 왼쪽 보라 선, 마지막 뒤는 마지막 아이템 오른쪽
          const showLeft = dragIdx !== null && dropIdx === i
          const showRight = dragIdx !== null && dropIdx === pages.length && i === pages.length - 1
          return (
            <Box
              key={p.id}
              data-mthumb
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault() // 드래그 중 텍스트 선택·자동 스크롤 방지
                dragRef.current = { index: i, startX: e.clientX, startY: e.clientY, active: false, drop: null }
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                const d = dragRef.current
                if (!d) return
                if (!d.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 7) {
                  d.active = true
                  setDragIdx(d.index)
                }
                if (d.active) {
                  d.drop = calcGridDrop(e.clientX, e.clientY)
                  setDropIdx(d.drop)
                }
              }}
              onPointerUp={() => {
                const d = dragRef.current
                dragRef.current = null
                if (d?.active) finishDrag(d.drop, d.index)
                else toggle(p.id) // 클릭 = 선택 토글
              }}
              sx={{
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none',
                opacity: dragIdx === i ? 0.4 : 1,
                boxShadow: showLeft ? '-4px 0 0 0 #5b5bd6' : showRight ? '4px 0 0 0 #5b5bd6' : 'none',
                borderRadius: 1
              }}
            >
              <Paper
                variant="outlined"
                sx={{ overflow: 'hidden', borderColor: selected ? 'secondary.main' : 'divider', borderWidth: selected ? 2.5 : 1, borderRadius: 1.5 }}
              >
                <ThumbCanvas page={p} width={340} pageW={size.w} />
              </Paper>
              <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5, bgcolor: selected ? 'secondary.main' : 'transparent', color: selected ? '#fff' : 'text.secondary', borderRadius: 1, width: 36, mx: 'auto' }}>
                {i + 1}
              </Typography>
            </Box>
          )
        })}
      </Box>

      <Divider />
      <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.2 }}>
        <Button color="inherit" onClick={onClose}>
          {t('close')}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
          {t('dragToReorder')}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={onClose}>
          {t('ok')}
        </Button>
      </Stack>
    </Dialog>
  )
}
