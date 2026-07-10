import { useEffect, useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { renderTypedSign, fileToDataUrl, SIGN_FONTS } from '@renderer/editor/stamp'
import { ui } from '@renderer/theme'

const INK_COLORS = ['#111111', '#1e99f5', '#5742ea']
// 우리 브랜드 라이트 스킨 (Guru 캡처는 다크모드였음 — 2026-07-10 피드백으로 흰/빨강 전환)
const DIVIDER = ui.gray[200]
const ACTIVE = ui.brand[500]
const CANVAS_BG = '#fff'

/** 서명 추가: 그리기 / 이미지 / 타이핑 3탭 (pdfguru와 동일) */
export default function SignDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const t = useT()
  const placeSignOnCurrentPage = useEditor((s) => s.placeSignOnCurrentPage)
  const currentPage = useEditor((s) => s.currentPage)
  const savedSigns = useEditor((s) => s.savedSigns)
  const addSavedSign = useEditor((s) => s.addSavedSign)
  const removeSavedSign = useEditor((s) => s.removeSavedSign)

  const [mode, setMode] = useState<'library' | 'add'>('add')
  const [tab, setTab] = useState(0)
  const [color, setColor] = useState(INK_COLORS[0])
  const [save, setSave] = useState(true)
  const [typed, setTyped] = useState('')
  const [fontIdx, setFontIdx] = useState(0)
  const [image, setImage] = useState<{ dataUrl: string; aspect: number } | null>(null)
  const [hasDrawing, setHasDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setMode(savedSigns.length > 0 ? 'library' : 'add')
    resetDraft()
  }, [open, savedSigns.length])

  useEffect(() => {
    if (!open || mode !== 'add' || tab !== 0) return
    clearCanvas()
  }, [open, mode, tab])

  function resetDraft(): void {
    setTab(0)
    setColor(INK_COLORS[0])
    setSave(true)
    setTyped('')
    setFontIdx(0)
    setImage(null)
    setHasDrawing(false)
    drawingRef.current = false
    clearCanvas()
  }

  function clearCanvas(): void {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  function clearCurrentSignature(): void {
    if (tab === 0) {
      setHasDrawing(false)
      clearCanvas()
    } else if (tab === 1) {
      setImage(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } else {
      setTyped('')
    }
  }

  function closeDialog(): void {
    resetDraft()
    onClose()
  }

  // Guru 동작: Done(또는 저장 카드 클릭) 즉시 화면에 보이는 페이지 영역 중앙에 서명이 나타난다 — 클릭 대기 없음
  function place(dataUrl: string, aspect: number, shouldSave = save): void {
    if (shouldSave) addSavedSign(dataUrl)
    placeSignOnCurrentPage(dataUrl, aspect, visiblePageCenter(currentPage))
    closeDialog()
  }

  function placeSaved(dataUrl: string): void {
    const img = new Image()
    img.onload = () => place(dataUrl, img.width / img.height, false)
    img.src = dataUrl
  }

  function confirm(): void {
    if (tab === 0) {
      const canvas = canvasRef.current
      if (!canvas || !hasDrawing) return
      const ctx = canvas.getContext('2d')!
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let minX = canvas.width
      let minY = canvas.height
      let maxX = 0
      let maxY = 0
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data.data[(y * canvas.width + x) * 4 + 3] > 10) {
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }
      }
      if (maxX <= minX || maxY <= minY) return
      const pad = 8
      const w = maxX - minX + pad * 2
      const h = maxY - minY + pad * 2
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      out.getContext('2d')!.drawImage(canvas, minX - pad, minY - pad, w, h, 0, 0, w, h)
      place(out.toDataURL('image/png'), w / h)
    } else if (tab === 1 && image) {
      place(image.dataUrl, image.aspect)
    } else if (tab === 2 && typed.trim()) {
      const r = renderTypedSign(typed.trim(), SIGN_FONTS[fontIdx], color)
      place(r.dataUrl, r.aspect)
    }
  }

  const canConfirm = (tab === 0 && hasDrawing) || (tab === 1 && !!image) || (tab === 2 && !!typed.trim())

  function pointerPos(e: React.PointerEvent): [number, number] {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height]
  }

  async function useImageFile(file?: File): Promise<void> {
    if (!file) return
    setImage(await fileToDataUrl(file))
  }

  const showInk = tab !== 1

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      fullWidth
      maxWidth="lg"
      slotProps={{
        backdrop: { sx: { bgcolor: 'rgba(16, 24, 40, .4)' } },
        paper: {
          sx: {
            width: 'min(720px, calc(100vw - 64px))',
            maxHeight: 'calc(100vh - 96px)',
            borderRadius: 2,
            bgcolor: '#fff',
            color: ui.gray[900],
            overflow: 'hidden',
            boxShadow: ui.shadow.lg
          }
        }
      }}
    >
      {mode === 'library' ? (
        <Box sx={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3, py: 2, borderBottom: `1px solid ${DIVIDER}` }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{t('signatures')}</Typography>
            <Button variant="contained" onClick={() => { resetDraft(); setMode('add') }} sx={primaryButtonSx}>
              {t('addSign')}
            </Button>
          </Stack>

          <Box sx={{ flex: 1, bgcolor: ui.gray[50], p: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(200px, 1fr))', gap: 2 }}>
              {savedSigns.map((s, i) => (
                <Paper
                  key={`${s.slice(0, 24)}-${i}`}
                  variant="outlined"
                  onClick={() => placeSaved(s)}
                  sx={{
                    position: 'relative',
                    height: 120,
                    borderRadius: 1.5,
                    borderColor: ui.gray[300],
                    bgcolor: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1.5,
                    '&:hover': { borderColor: ACTIVE, boxShadow: `0 0 0 1px ${ACTIVE}` }
                  }}
                >
                  <IconButton
                    aria-label={t('delete')}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSavedSign(i)
                      if (savedSigns.length === 1) {
                        resetDraft()
                        setMode('add')
                      }
                    }}
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      bgcolor: '#fff',
                      color: ui.gray[500],
                      border: `1px solid ${ui.gray[300]}`,
                      borderRadius: 1,
                      '&:hover': { bgcolor: ui.brand[50], color: ui.brand[600], borderColor: ui.brand[500] }
                    }}
                  >
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                  <img src={s} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                </Paper>
              ))}
            </Box>
          </Box>

          <Stack direction="row" justifyContent="flex-end" sx={{ px: 3, py: 1.8, borderTop: `1px solid ${DIVIDER}` }}>
            <Button color="inherit" onClick={closeDialog} sx={secondaryButtonSx}>
              {t('cancel')}
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box sx={{ minHeight: 480, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${DIVIDER}` }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{t('addSign')}</Typography>
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v)
              drawingRef.current = false
              if (v === 0) setHasDrawing(false)
            }}
            sx={{
              minHeight: 46,
              px: 3,
              borderBottom: `1px solid ${DIVIDER}`,
              '& .MuiTabs-indicator': { bgcolor: ACTIVE, height: 2.5 },
              '& .MuiTab-root': { minHeight: 46, color: ui.gray[500], fontSize: 15, fontWeight: 700, mr: 1.5, textTransform: 'none' },
              '& .Mui-selected': { color: `${ACTIVE} !important` }
            }}
          >
            <Tab label={t('draw')} />
            <Tab label={t('image')} />
            <Tab label={t('typing')} />
          </Tabs>

          <Box sx={{ flex: 1, bgcolor: ui.gray[50], px: 3, py: 2, overflowY: 'auto' }}>
            {showInk && <InkSwatches color={color} setColor={setColor} />}

            {tab === 0 && (
              <Stack spacing={1.5} alignItems="center">
                <Box sx={{ width: '100%', border: `1.5px dashed ${ui.gray[300]}`, borderRadius: 1.5, bgcolor: CANVAS_BG, position: 'relative', mt: 1 }}>
                  <canvas
                    ref={canvasRef}
                    width={1040}
                    height={420}
                    style={{ width: '100%', display: 'block', touchAction: 'none', cursor: 'crosshair' }}
                    onPointerDown={(e) => {
                      drawingRef.current = true
                      const canvas = canvasRef.current!
                      canvas.setPointerCapture(e.pointerId)
                      const ctx = canvas.getContext('2d')!
                      const [x, y] = pointerPos(e)
                      ctx.strokeStyle = color
                      ctx.lineWidth = 4
                      ctx.lineCap = 'round'
                      ctx.lineJoin = 'round'
                      ctx.beginPath()
                      ctx.moveTo(x, y)
                      setHasDrawing(true)
                    }}
                    onPointerMove={(e) => {
                      if (!drawingRef.current) return
                      const ctx = canvasRef.current!.getContext('2d')!
                      const [x, y] = pointerPos(e)
                      ctx.lineTo(x, y)
                      ctx.stroke()
                    }}
                    onPointerUp={() => {
                      drawingRef.current = false
                    }}
                    onPointerCancel={() => {
                      drawingRef.current = false
                    }}
                  />
                </Box>
                {!hasDrawing ? (
                  <Typography sx={{ color: ui.gray[400], fontSize: 15, fontWeight: 600 }}>{t('signHere')}</Typography>
                ) : (
                  <Button variant="text" onClick={clearCurrentSignature} sx={clearButtonSx}>
                    {t('clearSignature')}
                  </Button>
                )}
              </Stack>
            )}

            {tab === 1 && (
              <Stack spacing={1.5} alignItems="center">
                <Box
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    void useImageFile(e.dataTransfer.files?.[0])
                  }}
                  sx={{
                    width: '100%',
                    minHeight: 240,
                    border: `1.5px dashed ${ui.gray[300]}`,
                    borderRadius: 1.5,
                    mt: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#fff',
                    backgroundImage: image
                      ? 'linear-gradient(45deg, #eef1f5 25%, transparent 25%), linear-gradient(-45deg, #eef1f5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eef1f5 75%), linear-gradient(-45deg, transparent 75%, #eef1f5 75%)'
                      : 'none',
                    backgroundSize: image ? '20px 20px' : undefined,
                    backgroundPosition: image ? '0 0, 0 10px, 10px -10px, -10px 0px' : undefined
                  }}
                >
                  {image ? (
                    <img src={image.dataUrl} style={{ maxWidth: '82%', maxHeight: 220, objectFit: 'contain', display: 'block' }} />
                  ) : (
                    <Button variant="outlined" color="inherit" onClick={() => fileInputRef.current?.click()} sx={secondaryButtonSx}>
                      {t('chooseImage')}
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => {
                      void useImageFile(e.target.files?.[0])
                    }}
                  />
                </Box>
                {image ? (
                  <Button variant="text" onClick={clearCurrentSignature} sx={clearButtonSx}>
                    {t('clearSignature')}
                  </Button>
                ) : (
                  <Typography sx={{ color: ui.gray[400], fontSize: 15, fontWeight: 600 }}>{t('selectOrDragImage')}</Typography>
                )}
              </Stack>
            )}

            {tab === 2 && (
              <Stack spacing={1.5} alignItems="center">
                <Box sx={{ width: '100%', bgcolor: '#fff', border: `1.5px dashed ${ui.gray[300]}`, borderRadius: 1.5, mt: 1, px: 2, py: 1.5 }}>
                  <Box
                    component="input"
                    autoFocus
                    value={typed}
                    placeholder="Signature"
                    onChange={(e) => setTyped(e.currentTarget.value)}
                    sx={{
                      width: '100%',
                      border: 0,
                      outline: 0,
                      bgcolor: 'transparent',
                      color,
                      textAlign: 'center',
                      fontFamily: SIGN_FONTS[fontIdx],
                      fontSize: 30,
                      fontWeight: 700,
                      lineHeight: '56px',
                      letterSpacing: 0,
                      '&::placeholder': { color: ui.gray[400] }
                    }}
                  />
                </Box>
                <Button variant="text" disabled={!typed.trim()} onClick={clearCurrentSignature} sx={clearButtonSx}>
                  {t('clearSignature')}
                </Button>
                <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {SIGN_FONTS.map((font, i) => (
                    <Box
                      key={font}
                      component="button"
                      type="button"
                      onClick={() => setFontIdx(i)}
                      sx={{
                        minHeight: 60,
                        border: `1px solid ${fontIdx === i ? ACTIVE : ui.gray[300]}`,
                        borderRadius: 1.5,
                        bgcolor: '#fff',
                        color: ui.gray[800],
                        cursor: 'pointer',
                        textAlign: 'left',
                        px: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        boxShadow: fontIdx === i ? `0 0 0 1px ${ACTIVE}` : 'none',
                        '&:hover': { borderColor: ACTIVE }
                      }}
                    >
                      <Radio
                        checked={fontIdx === i}
                        size="small"
                        sx={{
                          color: ui.gray[400],
                          '&.Mui-checked': { color: ACTIVE },
                          p: 0
                        }}
                      />
                      <Typography sx={{ fontFamily: font, fontSize: 24, lineHeight: 1, color: ui.gray[800], letterSpacing: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typed || 'Signature'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Stack>
            )}
          </Box>

          <Stack direction="row" alignItems="center" sx={{ px: 3, py: 1.8, borderTop: `1px solid ${DIVIDER}` }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={save}
                  onChange={(e) => setSave(e.target.checked)}
                  sx={{ color: ui.gray[400], '&.Mui-checked': { color: ACTIVE } }}
                />
              }
              label={t('saveSign')}
              sx={{ color: ui.gray[700], '& .MuiFormControlLabel-label': { fontSize: 15, fontWeight: 600 } }}
            />
            <Box sx={{ flex: 1 }} />
            <Button color="inherit" onClick={savedSigns.length > 0 ? () => { resetDraft(); setMode('library') } : closeDialog} sx={secondaryButtonSx}>
              {t('cancel')}
            </Button>
            <Button variant="contained" disabled={!canConfirm} onClick={confirm} sx={{ ...primaryButtonSx, ml: 1.5 }}>
              {t('done')}
            </Button>
          </Stack>
        </Box>
      )}
    </Dialog>
  )
}

/** 현재 페이지에서 화면에 실제로 보이는 영역의 중심 (페이지 정규화 좌표). 페이지가 안 보이면 중앙 */
function visiblePageCenter(pageIndex: number): { x: number; y: number } | undefined {
  const el = document.querySelectorAll('[data-page-index]')[pageIndex]
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return undefined
  const top = Math.max(r.top, 0)
  const bottom = Math.min(r.bottom, window.innerHeight)
  const left = Math.max(r.left, 0)
  const right = Math.min(r.right, window.innerWidth)
  if (bottom <= top || right <= left) return undefined
  return { x: ((left + right) / 2 - r.left) / r.width, y: ((top + bottom) / 2 - r.top) / r.height }
}

function InkSwatches({ color, setColor }: { color: string; setColor: (color: string) => void }): JSX.Element {
  return (
    <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mb: 1, pr: 0.5 }}>
      {INK_COLORS.map((cc) => (
        <Box
          key={cc}
          onClick={() => setColor(cc)}
          sx={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            bgcolor: cc,
            cursor: 'pointer',
            boxShadow: color === cc ? `0 0 0 2px #fff, 0 0 0 4px ${ACTIVE}` : '0 0 0 1px rgba(0,0,0,.12)'
          }}
        />
      ))}
    </Stack>
  )
}

const primaryButtonSx = {
  bgcolor: ui.brand[500],
  color: '#fff',
  borderRadius: 1.5,
  px: 2.5,
  py: 0.9,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { bgcolor: ui.brand[600], boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: ui.gray[200], color: ui.gray[400] }
}

const secondaryButtonSx = {
  border: `1px solid ${ui.gray[300]}`,
  bgcolor: '#fff',
  color: ui.gray[700],
  borderRadius: 1.5,
  px: 2.2,
  py: 0.8,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: ui.shadow.xs,
  '&:hover': { bgcolor: ui.gray[50] }
}

const clearButtonSx = {
  color: ui.brand[600],
  fontSize: 14.5,
  fontWeight: 700,
  textTransform: 'none',
  '&:hover': { bgcolor: ui.brand[50] },
  '&.Mui-disabled': { color: ui.gray[400] }
}
