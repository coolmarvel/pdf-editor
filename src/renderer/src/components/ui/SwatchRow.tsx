import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import type { SxProps, Theme } from '@mui/material/styles'

interface SwatchRowProps {
  colors: readonly string[]
  value: string | null
  onChange: (color: string) => void
  /** 지름 px */
  size?: number
  /** 선택/비선택 표시 규칙 — 호출처마다 다르다 (아웃라인·테두리·링 그림자) */
  swatchSx: (color: string, selected: boolean) => SxProps<Theme>
  /** true → ButtonBase(리플 있음), 기본은 onClick 달린 Box */
  ripple?: boolean
  /** Stack spacing */
  spacing?: number
  sx?: SxProps<Theme>
  /** 첫 스와치 앞에 끼워 넣을 요소 (예: "없음" 스와치, 라벨) */
  prefix?: React.ReactNode
}

/** 가로 색상 스와치 줄. 값 비교는 대소문자 무시 (#FFFFFF == #ffffff) */
export default function SwatchRow({ colors, value, onChange, size = 24, swatchSx, ripple, spacing = 0.8, sx, prefix }: SwatchRowProps): JSX.Element {
  const cur = value?.toLowerCase()
  return (
    <Stack direction="row" spacing={spacing} alignItems="center" sx={sx}>
      {prefix}
      {colors.map((c) => {
        const sel = cur === c.toLowerCase()
        const s = [{ width: size, height: size, borderRadius: '50%', bgcolor: c }, swatchSx(c, sel)] as SxProps<Theme>
        return ripple ? <ButtonBase key={c} onClick={() => onChange(c)} sx={s} /> : <Box key={c} onClick={() => onChange(c)} sx={s} />
      })}
    </Stack>
  )
}
