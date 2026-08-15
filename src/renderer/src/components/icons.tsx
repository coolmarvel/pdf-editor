import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon'

/**
 * 상단 툴바 전용 자체 아이콘 세트 (2026-08-15).
 *
 * 왜 만들었나: 기존엔 MUI Material 아이콘(Rounded/Outlined 혼용)을 그대로 썼는데,
 * 채움 위주의 두꺼운 글리프라 벤치마킹한 pdfguru 툴바와 인상이 거의 같았다.
 * 전부 "선(stroke) 기반 · 1.7px · 둥근 끝" 한 규격으로 다시 그려 톤을 분리한다.
 *
 * 규칙: viewBox 24×24 · fill 없음 · stroke=currentColor(활성색 상속) ·
 * 여백 3px 안쪽으로 그린다(툴바 24px 박스에서 잘리지 않게).
 */
function Stroke({ children, ...props }: SvgIconProps): JSX.Element {
  return (
    <SvgIcon
      {...props}
      viewBox="0 0 24 24"
      sx={{
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        ...props.sx
      }}
    >
      {children}
    </SvgIcon>
  )
}

/** 페이지 패널 토글 — 문서 틀 + 좌측 사이드 칼럼 */
export function IconPages(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9.5 4v16" />
    </Stroke>
  )
}

/** 선택 — 커서 화살표 */
export function IconCursor(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M5.6 3.4 18.6 10.9l-6.1 1.4-2.6 6.1z" />
    </Stroke>
  )
}

export function IconUndo(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M8.5 6.5 4 11l4.5 4.5" />
      <path d="M4 11h9.8a4.7 4.7 0 0 1 0 9.4H9.5" />
    </Stroke>
  )
}

export function IconRedo(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M15.5 6.5 20 11l-4.5 4.5" />
      <path d="M20 11h-9.8a4.7 4.7 0 0 0 0 9.4h4.3" />
    </Stroke>
  )
}

/** 텍스트 추가 — 세리프 T */
export function IconText(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M5 7.5V5.5h14v2" />
      <path d="M12 5.5v13" />
      <path d="M9 18.5h6" />
    </Stroke>
  )
}

/** 텍스트 수정 — 편집 영역 모서리 + T */
export function IconTextEdit(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M3.5 7.5v-4h4M20.5 7.5v-4h-4M3.5 16.5v4h4M20.5 16.5v4h-4" />
      <path d="M8 10.2V9h8v1.2" />
      <path d="M12 9v6" />
      <path d="M10.2 15h3.6" />
    </Stroke>
  )
}

/** 지우개 — 기울어진 몸체 + 바닥선 */
export function IconEraser(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M19.4 12.6 12.6 5.8a2 2 0 0 0-2.8 0l-6 6a2 2 0 0 0 0 2.8l3.6 3.6h6.4z" />
      <path d="m9.2 8.6 6.4 6.4" />
      <path d="M6.5 21h13.5" />
    </Stroke>
  )
}

/** 형광펜 — 치즐 팁 마커 + 그은 자국 */
export function IconHighlighter(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M16.4 3.6a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8l-9.3 9.3-4.4 1.1 1.1-4.4z" />
      <path d="m14.1 5.9 4 4" />
      <path d="M3.5 20.7h17" />
    </Stroke>
  )
}

/** 펜(자유 그리기) — 얇은 펜촉 */
export function IconPen(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M17.1 3.4a2.1 2.1 0 0 1 3 3L8.3 18.2l-4.4 1.4 1.4-4.4z" />
      <path d="m14.4 6.1 3.5 3.5" />
    </Stroke>
  )
}

/** 이미지 — 사진 프레임 */
export function IconImage(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.7" cy="9.7" r="1.7" />
      <path d="m3.4 17.4 4.8-4.8 4.3 4.3 3.2-3.2 4.9 4.9" />
    </Stroke>
  )
}

/** 스탬프 — 손잡이 + 받침 + 바닥선 */
export function IconStamp(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M9.2 14.5V10a2.8 2.8 0 1 1 5.6 0v4.5" />
      <path d="M5.5 18.5v-1.2a2.8 2.8 0 0 1 2.8-2.8h7.4a2.8 2.8 0 0 1 2.8 2.8v1.2z" />
      <path d="M6 21.3h12" />
    </Stroke>
  )
}

export function IconSquare(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
    </Stroke>
  )
}

export function IconCircle(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="8.2" />
    </Stroke>
  )
}

export function IconCross(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M5.8 5.8 18.2 18.2" />
      <path d="M18.2 5.8 5.8 18.2" />
    </Stroke>
  )
}

export function IconCheck(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="m4.2 12.6 5.1 5.2L19.8 6.2" />
    </Stroke>
  )
}

/** 서명 — 필기 곡선 + 서명선 */
export function IconSign(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M3.5 16.4c1.5 0 1.8-2.6 3-2.6 1.1 0 .8 2.6 2.2 2.6 1.6 0 2.3-8.6 4.2-8.6 1.4 0 .5 8.6 2.4 8.6 1.3 0 1.8-2.2 3.2-2.2" />
      <path d="M4 20h16" />
    </Stroke>
  )
}

/** 워터마크 — 페이지 위에 기울어진 글자 */
export function IconWatermark(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      {/* 대각선으로 찍힌 글자줄 — "페이지를 가로지르는 워터마크" */}
      <path d="M6.8 14.2 10.4 9.2" />
      <path d="M9.4 16.2 14.6 9" />
      <path d="M13.2 16.6 16.4 12.2" />
    </Stroke>
  )
}

/** 노트 — 말풍선 */
export function IconNote(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M20.5 14.4a2.6 2.6 0 0 1-2.6 2.6H9.4L4.6 20.6V6.6A2.6 2.6 0 0 1 7.2 4h10.7a2.6 2.6 0 0 1 2.6 2.6z" />
      <path d="M8.6 8.9h6.8M8.6 12.2h4.4" />
    </Stroke>
  )
}

/** 링크 — 사슬 두 고리 */
export function IconLink(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M10.3 13.7a4.2 4.2 0 0 0 6 0l2.4-2.4a4.2 4.2 0 1 0-6-6l-1.4 1.4" />
      <path d="M13.7 10.3a4.2 4.2 0 0 0-6 0l-2.4 2.4a4.2 4.2 0 1 0 6 6l1.4-1.4" />
    </Stroke>
  )
}

/** 페이지 레이아웃 — 헤더 + 2단 */
export function IconLayout(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9.2h18" />
      <path d="M9.8 9.2V20" />
    </Stroke>
  )
}

/** 페이지 관리 — 4분할 그리드 */
export function IconGrid(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="3.4" y="3.4" width="7.4" height="7.4" rx="1.8" />
      <rect x="13.2" y="3.4" width="7.4" height="7.4" rx="1.8" />
      <rect x="3.4" y="13.2" width="7.4" height="7.4" rx="1.8" />
      <rect x="13.2" y="13.2" width="7.4" height="7.4" rx="1.8" />
    </Stroke>
  )
}

/** 스플릿 버튼의 ⌄ (Material 삼각형 대신 얇은 갈매기) */
export function IconChevronDown(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="m7 10 5 5 5-5" />
    </Stroke>
  )
}

/** 단쪽 보기 */
export function IconPageSingle(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="6" y="3.5" width="12" height="17" rx="2" />
    </Stroke>
  )
}

/** 두쪽 보기 */
export function IconPageDouble(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="2.8" y="4.5" width="8.4" height="15" rx="1.8" />
      <rect x="12.8" y="4.5" width="8.4" height="15" rx="1.8" />
    </Stroke>
  )
}

/** 화면에 맞춤 */
export function IconFit(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M3.5 8.5v-5h5M20.5 8.5v-5h-5M3.5 15.5v5h5M20.5 15.5v5h-5" />
      <rect x="8" y="8" width="8" height="8" rx="1.5" />
    </Stroke>
  )
}

/** 이어서 스크롤 */
export function IconScrollContinuous(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="4" y="2.8" width="16" height="7.4" rx="1.8" />
      <rect x="4" y="13.8" width="16" height="7.4" rx="1.8" />
    </Stroke>
  )
}

/** 한 장씩 보기 */
export function IconScrollPaged(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </Stroke>
  )
}

export function IconRotateLeft(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M4.2 5.4v5h5" />
      <path d="M4.9 10.4a8 8 0 1 1 .3 5.6" />
    </Stroke>
  )
}

export function IconRotateRight(props: SvgIconProps): JSX.Element {
  return (
    <Stroke {...props}>
      <path d="M19.8 5.4v5h-5" />
      <path d="M19.1 10.4a8 8 0 1 0-.3 5.6" />
    </Stroke>
  )
}
