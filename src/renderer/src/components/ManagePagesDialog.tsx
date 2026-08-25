import { useMemo, useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import { useEditor, selectCanUndo, selectCanRedo } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ui } from '@renderer/theme'
import { usePageImport } from '@renderer/hooks/usePageImport'
import { useDragReorder } from '@renderer/hooks/useDragReorder'
import { ArrowLeft, ArrowRight, Copy, FileUp, IconImage, Plus, Redo2, RotateCcw, RotateCw, SquareDashed, SquareDashedMousePointer, Trash2, Undo2 } from './icons'
import ThumbCanvas from './ThumbCanvas'
import { DialogFooter } from './ui/DialogBars'

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
  const pageMoveToIndex = useEditor((s) => s.pageMoveToIndex)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor(selectCanUndo)
  const canRedo = useEditor(selectCanRedo)
  const { inputs, openPdf, openImages } = usePageImport()

  const [sel, setSel] = useState<Set<string>>(new Set())
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

  // 삭제된 페이지가 선택에 남지 않게 정리 (id Set 은 pages 가 바뀔 때만 다시 만든다)
  const pageIds = useMemo(() => new Set(pages.map((p) => p.id)), [pages])
  const validSel = useMemo(() => new Set([...sel].filter((id) => pageIds.has(id))), [sel, pageIds])

  const { dragIdx, dropIdx, bind } = useDragReorder({
    containerRef: gridRef,
    itemSelector: '[data-mthumb]',
    axis: 'grid',
    threshold: 7,
    onDrop: (index, drop) => {
      const dragged = pages[index]
      // 선택에 포함된 페이지를 끌면 선택 전체 이동, 아니면 그 페이지만
      const ids = validSel.has(dragged.id) ? validSel : new Set([dragged.id])
      pageMoveToIndex(ids, drop)
    },
    onClick: (index) => toggle(pages[index].id) // 클릭 = 선택 토글
  })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { height: '86vh' } }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
        <Button size="small" color="inherit" startIcon={<Plus />} onClick={() => pageInsertBlank(pages.length)}>
          {t('newPage')}
        </Button>
        <Button size="small" color="inherit" startIcon={<Trash2 />} disabled={!has} onClick={() => { pageRemove(validSel); setSel(new Set()) }}>
          {t('delete')}
        </Button>
        <Button size="small" color="inherit" startIcon={<Copy />} disabled={!has} onClick={() => pageDuplicate(validSel)}>
          {t('duplicate')}
        </Button>
        <Button size="small" color="inherit" startIcon={<RotateCcw />} disabled={!has} onClick={() => pageRotate(validSel, -90)}>
          {t('rotateLeft')}
        </Button>
        <Button size="small" color="inherit" startIcon={<RotateCw />} disabled={!has} onClick={() => pageRotate(validSel, 90)}>
          {t('rotateRight')}
        </Button>
        <Button size="small" color="inherit" startIcon={<ArrowLeft />} disabled={!has} onClick={() => pageNudge(validSel, -1)}>
          {t('forward')}
        </Button>
        <Button size="small" color="inherit" startIcon={<ArrowRight />} disabled={!has} onClick={() => pageNudge(validSel, 1)}>
          {t('backward')}
        </Button>
        <Button size="small" color="inherit" startIcon={<FileUp />} onClick={() => openPdf()}>
          {t('importDoc')}
        </Button>
        <Button size="small" color="inherit" startIcon={<IconImage sx={{ fontSize: 19 }} />} onClick={() => openImages()}>
          {t('importImages')}
        </Button>
        {inputs}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t('undo')}>
          <span>
            <IconButton size="small" disabled={!canUndo} onClick={() => undo()}>
              <Undo2 />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('redo')}>
          <span>
            <IconButton size="small" disabled={!canRedo} onClick={() => redo()}>
              <Redo2 />
            </IconButton>
          </span>
        </Tooltip>
        <Button size="small" color="inherit" startIcon={<SquareDashedMousePointer />} onClick={() => setSel(new Set(pages.map((p) => p.id)))}>
          {t('selectAll')}
        </Button>
        <Button size="small" color="inherit" startIcon={<SquareDashed />} disabled={!has} onClick={() => setSel(new Set())}>
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
              onPointerDown={(e) => bind.onPointerDown(e, i)}
              onPointerMove={bind.onPointerMove}
              onPointerUp={() => bind.onPointerUp(i)}
              sx={{
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none',
                opacity: dragIdx === i ? 0.4 : 1,
                boxShadow: showLeft ? `-4px 0 0 0 ${ui.accent.main}` : showRight ? `4px 0 0 0 ${ui.accent.main}` : 'none',
                borderRadius: 1
              }}
            >
              <Paper
                variant="outlined"
                sx={{ overflow: 'hidden', borderColor: selected ? 'secondary.main' : 'divider', borderWidth: selected ? 2.5 : 1, borderRadius: 1.5 }}
              >
                <ThumbCanvas page={p} width={340} pageW={size.w} pageH={size.h} />
              </Paper>
              <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5, bgcolor: selected ? 'secondary.main' : 'transparent', color: selected ? '#fff' : 'text.secondary', borderRadius: 1, width: 36, mx: 'auto' }}>
                {i + 1}
              </Typography>
            </Box>
          )
        })}
      </Box>

      <DialogFooter sx={{ px: 2, py: 1.2, borderColor: 'divider' }}>
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
      </DialogFooter>
    </Dialog>
  )
}
