import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Paper from '@mui/material/Paper'
import { PRESET_STAMPS, CUSTOM_STAMP_COLORS, renderStamp, type StampSpec } from '@renderer/editor/stamp'
import { useEditor } from '@renderer/store/editor'

/** 스탬프 선택/제작: 프리셋 그리드 ↔ 커스텀 빌더 (pdfguru와 동일 구성) */
export default function StampDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const setPendingImage = useEditor((s) => s.setPendingImage)
  const setTool = useEditor((s) => s.setTool)
  const [custom, setCustom] = useState(false)
  const [text, setText] = useState('')
  const [withDate, setWithDate] = useState(true)
  const [withTime, setWithTime] = useState(false)
  const [colorIdx, setColorIdx] = useState(0)

  function pick(spec: StampSpec): void {
    const { dataUrl, aspect } = renderStamp(spec)
    setPendingImage({ dataUrl, aspect, kind: 'stamp' })
    setTool('stamp')
    onClose()
  }

  const now = new Date()
  const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(now.getFullYear() % 100).padStart(2, '0')}`
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const c = CUSTOM_STAMP_COLORS[colorIdx]
  const customSpec: StampSpec = {
    text: text || 'STAMP',
    color: c.color,
    bg: c.bg,
    date: withDate ? dateStr : undefined,
    time: withTime ? timeStr : undefined
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography fontWeight={800}>{custom ? '커스텀 스탬프' : '기본 스탬프 사용'}</Typography>
          <Button size="small" variant="outlined" color="secondary" onClick={() => setCustom(!custom)}>
            {custom ? '기본 스탬프 사용' : '커스텀 스탬프'}
          </Button>
        </Stack>

        {!custom ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, maxHeight: 420, overflowY: 'auto' }}>
            {PRESET_STAMPS.map((s) => (
              <Paper
                key={s.text}
                variant="outlined"
                onClick={() => pick(s)}
                sx={{ p: 2, display: 'flex', justifyContent: 'center', cursor: 'pointer', '&:hover': { borderColor: 'secondary.main' } }}
              >
                <Box sx={{ border: `2.5px solid ${s.color}`, bgcolor: s.bg, color: s.color, px: 2, py: 0.6, borderRadius: 1.5, fontWeight: 800, fontStyle: 'italic', fontSize: 15, whiteSpace: 'nowrap' }}>
                  {s.text}
                </Box>
              </Paper>
            ))}
          </Box>
        ) : (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ border: `3px solid ${c.color}`, bgcolor: c.bg, color: c.color, px: 3, py: 1, borderRadius: 1.5, fontWeight: 800, fontStyle: 'italic', fontSize: 22, textAlign: 'center' }}>
                {customSpec.text}
                {(withDate || withTime) && (
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{[customSpec.date, customSpec.time].filter(Boolean).join(' ')}</Typography>
                )}
              </Box>
            </Paper>
            <TextField label="스탬프 텍스트" size="small" fullWidth value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <Stack direction="row" spacing={2}>
              <FormControlLabel control={<Checkbox checked={withDate} onChange={(e) => setWithDate(e.target.checked)} />} label="날짜" />
              <FormControlLabel control={<Checkbox checked={withTime} onChange={(e) => setWithTime(e.target.checked)} />} label="시간" />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">색상</Typography>
              {CUSTOM_STAMP_COLORS.map((cc, i) => (
                <Box key={cc.color} onClick={() => setColorIdx(i)} sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: cc.color, cursor: 'pointer', border: i === colorIdx ? '3px solid #1f2430' : '3px solid transparent' }} />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button color="inherit" onClick={onClose}>
                취소
              </Button>
              <Button variant="contained" color="secondary" disabled={!text.trim()} onClick={() => pick(customSpec)}>
                스탬프 만들기
              </Button>
            </Stack>
          </Stack>
        )}

        {!custom && (
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button color="inherit" onClick={onClose}>
              취소
            </Button>
          </Stack>
        )}
      </Box>
    </Dialog>
  )
}
