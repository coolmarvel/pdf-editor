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

const INK_COLORS = ['#111111', '#1e99f5', '#5742ea']
const DIALOG_DARK = '#0b1015'
const PANEL_DARK = '#2d3139'
const DIVIDER = '#555b66'
const ACTIVE = '#a9bdff'
const LIGHT_CANVAS = '#f4f7fd'

/** 서명 추가: 그리기 / 이미지 / 타이핑 3탭 (pdfguru와 동일) */
export default function SignDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const t = useT()
  const setPendingImage = useEditor((s) => s.setPendingImage)
  const setTool = useEditor((s) => s.setTool)
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

  function place(dataUrl: string, aspect: number, shouldSave = save): void {
    if (shouldSave) addSavedSign(dataUrl)
    setPendingImage({ dataUrl, aspect, kind: 'sign' })
    setTool('sign')
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
        backdrop: { sx: { bgcolor: 'rgba(12, 16, 20, .55)' } },
        paper: {
          sx: {
            width: 'min(1120px, calc(100vw - 80px))',
            maxHeight: 'calc(100vh - 72px)',
            borderRadius: 1,
            bgcolor: DIALOG_DARK,
            color: '#f8fafc',
            overflow: 'hidden'
          }
        }
      }}
    >
      {mode === 'library' ? (
        <Box sx={{ minHeight: 640, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3.5, py: 3, borderBottom: `1px solid ${DIVIDER}` }}>
            <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{t('signatures')}</Typography>
            <Button variant="contained" onClick={() => { resetDraft(); setMode('add') }} sx={primaryButtonSx}>
              {t('addSign')}
            </Button>
          </Stack>

          <Box sx={{ flex: 1, bgcolor: PANEL_DARK, p: 3.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))', gap: 3, maxWidth: 960 }}>
              {savedSigns.map((s, i) => (
                <Paper
                  key={`${s.slice(0, 24)}-${i}`}
                  variant="outlined"
                  onClick={() => placeSaved(s)}
                  sx={{
                    position: 'relative',
                    height: 156,
                    borderRadius: 0.5,
                    borderColor: '#cdd3df',
                    bgcolor: LIGHT_CANVAS,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    '&:hover': { borderColor: ACTIVE, boxShadow: `0 0 0 2px ${ACTIVE}` }
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
                    sx={{ position: 'absolute', top: 8, right: 8, bgcolor: '#3c414b', color: '#fff', borderRadius: 0.5, '&:hover': { bgcolor: '#242932' } }}
                  >
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                  <img src={s} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                </Paper>
              ))}
            </Box>
          </Box>

          <Stack direction="row" justifyContent="flex-end" sx={{ px: 3.5, py: 2.5, borderTop: `1px solid ${DIVIDER}` }}>
            <Button color="inherit" onClick={closeDialog} sx={secondaryButtonSx}>
              {t('cancel')}
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box sx={{ minHeight: 720, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 3.5, py: 3, borderBottom: `1px solid ${DIVIDER}` }}>
            <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{t('addSign')}</Typography>
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v)
              drawingRef.current = false
              if (v === 0) setHasDrawing(false)
            }}
            sx={{
              minHeight: 72,
              px: 3.5,
              bgcolor: DIALOG_DARK,
              borderBottom: `1px solid ${DIVIDER}`,
              '& .MuiTabs-indicator': { bgcolor: ACTIVE, height: 3 },
              '& .MuiTab-root': { minHeight: 72, color: '#d6dbe5', fontSize: 17, fontWeight: 700, mr: 2 },
              '& .Mui-selected': { color: `${ACTIVE} !important` }
            }}
          >
            <Tab label={t('draw')} />
            <Tab label={t('image')} />
            <Tab label={t('typing')} />
          </Tabs>

          <Box sx={{ flex: 1, bgcolor: PANEL_DARK, px: 6, py: 3.5, overflowY: 'auto' }}>
            {showInk && <InkSwatches color={color} setColor={setColor} />}

            {tab === 0 && (
              <Stack spacing={2} alignItems="center">
                <Box sx={{ width: '100%', border: '1.5px dashed #697180', bgcolor: LIGHT_CANVAS, position: 'relative', mt: 2 }}>
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
                  <Typography sx={{ color: '#707684', fontSize: 17, fontWeight: 700 }}>{t('signHere')}</Typography>
                ) : (
                  <Button variant="text" onClick={clearCurrentSignature} sx={clearButtonSx}>
                    {t('clearSignature')}
                  </Button>
                )}
              </Stack>
            )}

            {tab === 1 && (
              <Stack spacing={2} alignItems="center">
                <Box
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    void useImageFile(e.dataTransfer.files?.[0])
                  }}
                  sx={{
                    width: '100%',
                    minHeight: 360,
                    border: '1.5px dashed #697180',
                    mt: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: image
                      ? 'transparent'
                      : PANEL_DARK,
                    backgroundImage: image
                      ? 'linear-gradient(45deg, #262b34 25%, transparent 25%), linear-gradient(-45deg, #262b34 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #262b34 75%), linear-gradient(-45deg, transparent 75%, #262b34 75%)'
                      : 'none',
                    backgroundSize: image ? '24px 24px' : undefined,
                    backgroundPosition: image ? '0 0, 0 12px, 12px -12px, -12px 0px' : undefined
                  }}
                >
                  {image ? (
                    <img src={image.dataUrl} style={{ maxWidth: '82%', maxHeight: 330, objectFit: 'contain', display: 'block' }} />
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
                  <Typography sx={{ color: '#707684', fontSize: 17, fontWeight: 700 }}>{t('selectOrDragImage')}</Typography>
                )}
              </Stack>
            )}

            {tab === 2 && (
              <Stack spacing={2.5} alignItems="center">
                <Box sx={{ width: '100%', bgcolor: LIGHT_CANVAS, border: '1px solid #c5cbd7', mt: 2, px: 2.5, py: 3 }}>
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
                      fontSize: 34,
                      fontWeight: 700,
                      lineHeight: '72px',
                      letterSpacing: 0,
                      '&::placeholder': { color: '#9aa3b2' }
                    }}
                  />
                </Box>
                <Button variant="text" disabled={!typed.trim()} onClick={clearCurrentSignature} sx={clearButtonSx}>
                  {t('clearSignature')}
                </Button>
                <Box sx={{ width: 'calc(100% + 96px)', mx: -6, display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${DIVIDER}` }}>
                  {SIGN_FONTS.map((font, i) => (
                    <Box
                      key={font}
                      component="button"
                      type="button"
                      onClick={() => setFontIdx(i)}
                      sx={{
                        minHeight: 104,
                        border: 0,
                        borderRight: i % 2 === 0 ? `1px solid ${DIVIDER}` : 0,
                        borderBottom: i < 2 ? `1px solid ${DIVIDER}` : 0,
                        bgcolor: DIALOG_DARK,
                        color: '#e5e9f0',
                        cursor: 'pointer',
                        textAlign: 'left',
                        px: 3,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        '&:hover': { bgcolor: '#111821' }
                      }}
                    >
                      <Radio
                        checked={fontIdx === i}
                        sx={{
                          color: '#f8fafc',
                          '&.Mui-checked': { color: '#f8fafc' },
                          p: 0
                        }}
                      />
                      <Typography sx={{ fontFamily: font, fontSize: 30, lineHeight: 1, color: '#e7edf6', letterSpacing: 0 }}>
                        {typed || 'Signature'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Stack>
            )}
          </Box>

          <Stack direction="row" alignItems="center" sx={{ px: 3.5, py: 2.5, borderTop: `1px solid ${DIVIDER}` }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={save}
                  onChange={(e) => setSave(e.target.checked)}
                  sx={{ color: '#f8fafc', '&.Mui-checked': { color: '#f8fafc' } }}
                />
              }
              label={t('saveSign')}
              sx={{ color: '#e8edf5', '& .MuiFormControlLabel-label': { fontSize: 17, fontWeight: 700 } }}
            />
            <Box sx={{ flex: 1 }} />
            <Button color="inherit" onClick={savedSigns.length > 0 ? () => { resetDraft(); setMode('library') } : closeDialog} sx={secondaryButtonSx}>
              {t('cancel')}
            </Button>
            <Button variant="contained" disabled={!canConfirm} onClick={confirm} sx={{ ...primaryButtonSx, ml: 2, opacity: canConfirm ? 1 : 0.62 }}>
              {t('done')}
            </Button>
          </Stack>
        </Box>
      )}
    </Dialog>
  )
}

function InkSwatches({ color, setColor }: { color: string; setColor: (color: string) => void }): JSX.Element {
  return (
    <Stack direction="row" spacing={2.5} justifyContent="flex-end" sx={{ mb: 2, pr: 4 }}>
      {INK_COLORS.map((cc) => (
        <Box
          key={cc}
          onClick={() => setColor(cc)}
          sx={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            bgcolor: cc,
            cursor: 'pointer',
            boxShadow: color === cc ? `0 0 0 4px ${ACTIVE}, 0 0 0 6px rgba(0,0,0,.65)` : '0 0 0 1px rgba(255,255,255,.2)',
            outline: cc === '#111111' ? '1px solid rgba(255,255,255,.35)' : 'none'
          }}
        />
      ))}
    </Stack>
  )
}

const primaryButtonSx = {
  bgcolor: ACTIVE,
  color: '#293142',
  borderRadius: 0.5,
  px: 3,
  py: 1.2,
  fontWeight: 800,
  textTransform: 'none',
  '&:hover': { bgcolor: '#b8c8ff' },
  '&.Mui-disabled': { bgcolor: '#747b89', color: '#242a34' }
}

const secondaryButtonSx = {
  border: '1px solid #606879',
  bgcolor: '#3f4653',
  color: '#f8fafc',
  borderRadius: 0.5,
  px: 2.8,
  py: 1.1,
  fontWeight: 800,
  textTransform: 'none',
  '&:hover': { bgcolor: '#4b5361' }
}

const clearButtonSx = {
  color: ACTIVE,
  fontSize: 16,
  fontWeight: 800,
  textTransform: 'none',
  '&:hover': { bgcolor: 'rgba(169, 189, 255, .08)' },
  '&.Mui-disabled': { color: '#677080' }
}
