import { useEffect, useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Paper from '@mui/material/Paper'
import { useEditor } from '@renderer/store/editor'
import { renderTypedSign, fileToDataUrl, SIGN_FONTS } from '@renderer/editor/stamp'

const INK_COLORS = ['#111111', '#1e88e5', '#5b5bd6']

/** 서명 추가: 그리기 / 이미지 / 타이핑 3탭 (pdfguru와 동일) */
export default function SignDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const setPendingImage = useEditor((s) => s.setPendingImage)
  const setTool = useEditor((s) => s.setTool)
  const savedSigns = useEditor((s) => s.savedSigns)
  const addSavedSign = useEditor((s) => s.addSavedSign)

  const [tab, setTab] = useState(0)
  const [color, setColor] = useState(INK_COLORS[0])
  const [save, setSave] = useState(true)
  const [typed, setTyped] = useState('')
  const [fontIdx, setFontIdx] = useState(0)
  const [image, setImage] = useState<{ dataUrl: string; aspect: number } | null>(null)
  const [hasDrawing, setHasDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setHasDrawing(false)
    setImage(null)
    setTyped('')
    const canvas = canvasRef.current
    if (canvas) {
      canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [open, tab])

  function place(dataUrl: string, aspect: number): void {
    if (save) addSavedSign(dataUrl)
    setPendingImage({ dataUrl, aspect, kind: 'sign' })
    setTool('sign')
    onClose()
  }

  function confirm(): void {
    if (tab === 0) {
      const canvas = canvasRef.current
      if (!canvas || !hasDrawing) return
      // 여백 잘라내기
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

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
        <Typography fontWeight={800} sx={{ mb: 1 }}>
          서명 추가
        </Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="그리기" />
          <Tab label="이미지" />
          <Tab label="타이핑" />
        </Tabs>
      </Box>

      <Box sx={{ px: 3, pb: 1 }}>
        {tab !== 1 && (
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 1 }}>
            {INK_COLORS.map((cc) => (
              <Box key={cc} onClick={() => setColor(cc)} sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: cc, cursor: 'pointer', border: color === cc ? '3px solid #9aa2b1' : '3px solid transparent' }} />
            ))}
          </Stack>
        )}

        {tab === 0 && (
          <Box sx={{ border: '1.5px dashed #c6cbd4', borderRadius: 1.5, position: 'relative' }}>
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
            />
            {!hasDrawing && (
              <Typography sx={{ position: 'absolute', bottom: 8, width: '100%', textAlign: 'center', color: 'text.secondary', pointerEvents: 'none' }} variant="body2">
                여기에 서명하세요
              </Typography>
            )}
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ border: '1.5px dashed #c6cbd4', borderRadius: 1.5, height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            {image ? (
              <img src={image.dataUrl} style={{ maxWidth: '90%', maxHeight: 200 }} />
            ) : (
              <>
                <Button variant="outlined" component="label" color="inherit">
                  이미지 선택
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (f) setImage(await fileToDataUrl(f))
                    }}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary">
                  서명 이미지를 선택하세요
                </Typography>
              </>
            )}
          </Box>
        )}

        {tab === 2 && (
          <Stack spacing={1.5}>
            <Paper variant="outlined" sx={{ py: 3, textAlign: 'center' }}>
              <Typography sx={{ fontFamily: SIGN_FONTS[fontIdx], fontSize: 40, color }}>{typed || 'Signature'}</Typography>
            </Paper>
            <TextField size="small" fullWidth autoFocus placeholder="이름 입력" value={typed} onChange={(e) => setTyped(e.target.value)} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {SIGN_FONTS.map((f, i) => (
                <Paper key={f} variant="outlined" onClick={() => setFontIdx(i)} sx={{ px: 1.5, py: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', borderColor: fontIdx === i ? 'secondary.main' : 'divider' }}>
                  <Radio size="small" checked={fontIdx === i} />
                  <Typography sx={{ fontFamily: f, fontSize: 22 }}>{typed || 'Signature'}</Typography>
                </Paper>
              ))}
            </Box>
          </Stack>
        )}

        {savedSigns.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, overflowX: 'auto' }} alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              저장된 서명:
            </Typography>
            {savedSigns.map((s, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 0.5, cursor: 'pointer', flexShrink: 0 }} onClick={() => {
                const img = new Image()
                img.onload = () => place(s, img.width / img.height)
                img.src = s
              }}>
                <img src={s} style={{ height: 34, display: 'block' }} />
              </Paper>
            ))}
          </Stack>
        )}
      </Box>

      <Stack direction="row" alignItems="center" sx={{ px: 3, py: 1.5, borderTop: 1, borderColor: 'divider', mt: 1 }}>
        <FormControlLabel control={<Checkbox checked={save} onChange={(e) => setSave(e.target.checked)} />} label="서명 저장" />
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={onClose}>
          취소
        </Button>
        <Button variant="contained" disabled={!canConfirm} onClick={confirm} sx={{ ml: 1 }}>
          완료
        </Button>
      </Stack>
    </Dialog>
  )
}
