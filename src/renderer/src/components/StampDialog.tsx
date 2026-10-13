import { useMemo, useState } from 'react'
import { ui } from '@renderer/theme'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Paper from '@mui/material/Paper'
import useMediaQuery from '@mui/material/useMediaQuery'
import { PRESET_STAMPS, CUSTOM_STAMP_COLORS, renderStamp, nowStampDateTime, type StampSpec } from '@renderer/editor/stamp'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import SwatchRow from './ui/SwatchRow'

/** 날짜/시간이 고정인 프리셋의 렌더 결과 캐시 — autoDateTime 프리셋 2개만 열 때마다 다시 그린다 */
const staticPreviewCache = new Map<StampSpec, ReturnType<typeof renderStamp>>()
function presetPreview(spec: StampSpec): ReturnType<typeof renderStamp> {
  if (spec.autoDateTime) return renderStamp({ ...spec, ...nowStampDateTime() })
  let img = staticPreviewCache.get(spec)
  if (!img) {
    img = renderStamp(spec)
    staticPreviewCache.set(spec, img)
  }
  return img
}

const STAMP_COLORS = CUSTOM_STAMP_COLORS.map((cc) => cc.color)

/** 스탬프 선택/제작: 프리셋 그리드 ↔ 커스텀 빌더 (pdfguru와 동일 구성) */
export default function StampDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const t = useT()
  const setPendingImage = useEditor((s) => s.setPendingImage)
  const setTool = useEditor((s) => s.setTool)
  const [custom, setCustom] = useState(false)
  const [text, setText] = useState('')
  const [withDate, setWithDate] = useState(true)
  const [withTime, setWithTime] = useState(false)
  const [colorIdx, setColorIdx] = useState(0)
  // 폰 폭(< 600px): 전체 화면 — 프리셋 그리드가 화면 높이를 쓴다
  const narrow = useMediaQuery('(max-width: 599.95px)')

  function pick(spec: StampSpec): void {
    // REVISED/REJECTED 는 찍는 시점의 날짜·시간이 들어간다 (Guru)
    const withNow = spec.autoDateTime ? { ...spec, ...nowStampDateTime() } : spec
    const { dataUrl, aspect } = renderStamp(withNow)
    setPendingImage({ dataUrl, aspect, kind: 'stamp' })
    setTool('stamp')
    onClose()
  }

  // 프리셋 미리보기 = 실제 렌더 결과 (실물과 100% 동일). 다이얼로그 열릴 때 생성 (정적 프리셋은 모듈 캐시)
  const previews = useMemo(() => (open ? PRESET_STAMPS.map((spec) => ({ spec, img: presetPreview(spec) })) : []), [open])

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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={narrow}>
      <Box sx={{ p: narrow ? 2 : 2.5, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography fontWeight={700}>{custom ? t('customStamp') : t('presetStamp')}</Typography>
          <Button size="small" variant="outlined" color="secondary" onClick={() => setCustom(!custom)}>
            {custom ? t('presetStamp') : t('customStamp')}
          </Button>
        </Stack>

        {!custom ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, maxHeight: narrow ? 'none' : 460, flex: narrow ? 1 : undefined, minHeight: 0, alignContent: 'start', overflowY: 'auto', pr: 0.5 }}>
            {previews.map(({ spec, img }, i) => (
              <Paper
                key={i}
                variant="outlined"
                onClick={() => pick(spec)}
                sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 84, '&:hover': { borderColor: 'secondary.main', bgcolor: '#f9fafb' } }}
              >
                <img src={img.dataUrl} style={{ maxWidth: '92%', maxHeight: spec.icon ? 56 : 46, objectFit: 'contain' }} />
              </Paper>
            ))}
          </Box>
        ) : (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ border: `3px solid ${c.color}`, bgcolor: c.bg, color: c.color, px: 3, py: 1, borderRadius: 0, fontWeight: 700, fontStyle: 'italic', fontSize: 22, textAlign: 'center' }}>
                {customSpec.text}
                {(withDate || withTime) && (
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{[customSpec.date, customSpec.time].filter(Boolean).join(' ')}</Typography>
                )}
              </Box>
            </Paper>
            <TextField label={t('stampText')} size="small" fullWidth value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <Stack direction="row" spacing={2}>
              <FormControlLabel control={<Checkbox checked={withDate} onChange={(e) => setWithDate(e.target.checked)} />} label={t('date')} />
              <FormControlLabel control={<Checkbox checked={withTime} onChange={(e) => setWithTime(e.target.checked)} />} label={t('time')} />
            </Stack>
            <SwatchRow
              colors={STAMP_COLORS}
              value={c.color}
              onChange={(col) => setColorIdx(STAMP_COLORS.indexOf(col))}
              spacing={1}
              prefix={<Typography variant="body2">{t('color')}</Typography>}
              swatchSx={(_, sel) => ({ cursor: 'pointer', outline: sel ? `2px solid ${ui.classic.color.accent}` : `1px solid ${ui.classic.color.borderStrong}`, outlineOffset: 1 })} /* 서명 다이얼로그와 같은 선택 링 */
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button color="inherit" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button variant="contained" color="secondary" disabled={!text.trim()} onClick={() => pick(customSpec)}>
                {t('makeStamp')}
              </Button>
            </Stack>
          </Stack>
        )}

        {!custom && (
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button color="inherit" onClick={onClose}>
              {t('cancel')}
            </Button>
          </Stack>
        )}
      </Box>
    </Dialog>
  )
}
