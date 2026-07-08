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
import ThumbCanvas from './ThumbCanvas'

/** pdfguru의 Manage Pages 모달: 썸네일 그리드 + 페이지 일괄 작업 */
export default function ManagePagesDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const pages = useEditor((s) => s.pages)
  const displaySizes = useEditor((s) => s.displaySizes)
  const pageInsertBlank = useEditor((s) => s.pageInsertBlank)
  const pageRemove = useEditor((s) => s.pageRemove)
  const pageDuplicate = useEditor((s) => s.pageDuplicate)
  const pageRotate = useEditor((s) => s.pageRotate)
  const pageNudge = useEditor((s) => s.pageNudge)
  const pageImport = useEditor((s) => s.pageImport)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.history.past.length > 0)
  const canRedo = useEditor((s) => s.history.future.length > 0)

  const [sel, setSel] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)
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

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { height: '86vh' } }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
        <Button size="small" color="inherit" startIcon={<AddRounded />} onClick={() => pageInsertBlank(pages.length)}>
          새 페이지
        </Button>
        <Button size="small" color="inherit" startIcon={<DeleteOutlineRounded />} disabled={!has} onClick={() => { pageRemove(validSel); setSel(new Set()) }}>
          삭제
        </Button>
        <Button size="small" color="inherit" startIcon={<ContentCopyRounded />} disabled={!has} onClick={() => pageDuplicate(validSel)}>
          복제
        </Button>
        <Button size="small" color="inherit" startIcon={<RotateLeftRounded />} disabled={!has} onClick={() => pageRotate(validSel, -90)}>
          왼쪽 회전
        </Button>
        <Button size="small" color="inherit" startIcon={<RotateRightRounded />} disabled={!has} onClick={() => pageRotate(validSel, 90)}>
          오른쪽 회전
        </Button>
        <Button size="small" color="inherit" startIcon={<ArrowBackRounded />} disabled={!has} onClick={() => pageNudge(validSel, -1)}>
          앞으로
        </Button>
        <Button size="small" color="inherit" startIcon={<ArrowForwardRounded />} disabled={!has} onClick={() => pageNudge(validSel, 1)}>
          뒤로
        </Button>
        <Button size="small" color="inherit" startIcon={<UploadFileRounded />} onClick={() => fileRef.current?.click()}>
          문서 가져오기
        </Button>
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => void onImportFile(e)} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="실행취소">
          <span>
            <IconButton size="small" disabled={!canUndo} onClick={() => undo()}>
              <UndoRounded />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="다시실행">
          <span>
            <IconButton size="small" disabled={!canRedo} onClick={() => redo()}>
              <RedoRounded />
            </IconButton>
          </span>
        </Tooltip>
        <Button size="small" color="inherit" startIcon={<SelectAllRounded />} onClick={() => setSel(new Set(pages.map((p) => p.id)))}>
          전체 선택
        </Button>
        <Button size="small" color="inherit" startIcon={<DeselectRounded />} disabled={!has} onClick={() => setSel(new Set())}>
          선택 해제
        </Button>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 3, alignContent: 'start' }}>
        {pages.map((p, i) => {
          const size = displaySizes[p.id] ?? { w: 595, h: 842 }
          const selected = validSel.has(p.id)
          return (
            <Box key={p.id} sx={{ cursor: 'pointer' }} onClick={() => toggle(p.id)}>
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
      <Stack direction="row" justifyContent="space-between" sx={{ px: 2, py: 1.2 }}>
        <Button color="inherit" onClick={onClose}>
          닫기
        </Button>
        <Button variant="contained" onClick={onClose}>
          확인
        </Button>
      </Stack>
    </Dialog>
  )
}
