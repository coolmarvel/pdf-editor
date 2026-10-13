/**
 * 클래식 메뉴 바 — 파일/편집/보기/… 텍스트 메뉴 (ADR-0004, sh-compositor `chrome/MenuBar.tsx` 이식).
 * 한 메뉴가 열려 있으면 옆 메뉴에 호버만 해도 넘어간다(Windows 메뉴 바). Alt 단독 = 첫 메뉴. 도구 버튼에 흩어진 기능을 키보드·메뉴로도 닿게 하는 게 목적.
 */
import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Popper from '@mui/material/Popper'
import Paper from '@mui/material/Paper'
import { ui } from '@renderer/theme'
import { Check, ChevronRight } from '../icons'

const { color, chrome, size, space, font, surface, focusRing } = ui.classic

/** 메뉴 항목 — 'sep' 은 구분선 (웹은 @editor/interfaces/ui 에 둔다) */
export type MenuEntry =
  | 'sep'
  | {
      label: string
      /** 표시용 단축키 문구 (실제 바인딩은 Editor 의 키 처리) */
      shortcut?: string
      onClick: () => void
      disabled?: boolean
      /** 켜짐 표시(체크) — undefined 면 체크 칸 없음 */
      checked?: boolean
      /** 하위 메뉴 (있으면 onClick 대신 오른쪽으로 펼침) */
      submenu?: MenuEntry[]
      testId?: string
    }

export interface MenuDef {
  label: string
  items: MenuEntry[]
  testId?: string
}

export default function MenuBar({ menus, right }: { menus: MenuDef[]; right?: React.ReactNode }): JSX.Element {
  const [open, setOpen] = useState<number | null>(null)
  const refs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    let altAlone = false
    const down = (e: KeyboardEvent): void => {
      altAlone = e.key === 'Alt' && !e.ctrlKey && !e.shiftKey
    }
    const up = (e: KeyboardEvent): void => {
      if (e.key === 'Alt' && altAlone) {
        e.preventDefault()
        setOpen((o) => (o === null ? 0 : null))
      }
      altAlone = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // 백드롭이 포인터를 통과시키므로(호버 전환용) 바깥 클릭 닫기는 직접 처리
  const barRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const [sub, setSub] = useState<{ j: number; el: HTMLElement } | null>(null)
  useEffect(() => setSub(null), [open])
  useEffect(() => {
    if (open === null) return
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (barRef.current?.contains(t) || paperRef.current?.contains(t) || subRef.current?.contains(t)) return
      setOpen(null)
    }
    window.addEventListener('mousedown', onDown, true)
    return () => window.removeEventListener('mousedown', onDown, true)
  }, [open])

  const current = open !== null ? menus[open] : null
  const run = (it: Exclude<MenuEntry, 'sep'>): void => {
    setOpen(null)
    it.onClick()
  }

  return (
    <Box
      ref={barRef}
      role="menubar"
      data-testid="menubar"
      sx={{ height: size.menuBar, flexShrink: 0, display: 'flex', alignItems: 'stretch', px: `${space.xs}px`, background: surface.chrome, borderBottom: `1px solid ${chrome.frame}`, minWidth: 0 }}
    >
      {menus.map((m, i) => (
        <ButtonBase
          key={m.label}
          ref={(el) => {
            refs.current[i] = el
          }}
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={open === i}
          data-testid={m.testId}
          onClick={() => setOpen(open === i ? null : i)}
          onMouseEnter={() => open !== null && open !== i && setOpen(i)}
          sx={{
            px: `${space.base}px`,
            fontSize: font.md,
            fontFamily: 'inherit',
            border: '1px solid transparent',
            color: color.text,
            whiteSpace: 'nowrap',
            // 열린 제목 = 흰 면 + 테두리 (sh-web-editor 메뉴바)
            ...(open === i ? { bgcolor: color.canvas, borderColor: chrome.frame } : { '&:hover': { bgcolor: color.canvas, borderColor: color.hoverEdge } }),
            '&.Mui-focusVisible': focusRing,
          }}
        >
          {m.label}
        </ButtonBase>
      ))}
      <Box sx={{ flex: 1 }} />
      {right}
      <Menu
        open={!!current}
        anchorEl={open !== null ? refs.current[open] : null}
        onClose={() => setOpen(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { ref: paperRef, sx: { minWidth: 220, mt: 0 } } }}
        sx={{ pointerEvents: 'none', '& .MuiPaper-root': { pointerEvents: 'auto' } }}
        disableAutoFocusItem
      >
        {current?.items.map((it, j) =>
          it === 'sep' ? (
            <Divider key={`s${j}`} sx={{ my: `${space.xs}px !important` }} />
          ) : (
            <MenuItem
              key={it.label}
              disabled={it.disabled}
              data-testid={it.testId}
              onMouseEnter={(e) => setSub(it.submenu ? { j, el: e.currentTarget } : null)}
              onClick={(e) => {
                if (it.submenu) return setSub({ j, el: e.currentTarget })
                run(it)
              }}
              selected={!!it.submenu && sub?.j === j}
              sx={{ gap: `${space.base}px`, pl: `${space.xs}px` }}
            >
              <Row it={it} />
            </MenuItem>
          ),
        )}
      </Menu>
      <Popper open={!!sub && !!current} anchorEl={sub?.el} placement="right-start" sx={{ zIndex: 1400 }} modifiers={[{ name: 'offset', options: { offset: [-4, 2] } }]}>
        <Paper ref={subRef} sx={{ minWidth: 200, py: '2px', border: `1px solid ${color.borderStrong}`, boxShadow: ui.classic.shadow.raised }}>
          {sub &&
            current &&
            (() => {
              const parent = current.items[sub.j]
              const items = parent !== 'sep' ? (parent.submenu ?? []) : []
              return items.map((it, k) =>
                it === 'sep' ? (
                  <Divider key={`ss${k}`} sx={{ my: `${space.xs}px !important` }} />
                ) : (
                  <MenuItem key={it.label} disabled={it.disabled} data-testid={it.testId} onClick={() => run(it)} sx={{ gap: `${space.base}px`, pl: `${space.xs}px` }}>
                    <Row it={it} />
                  </MenuItem>
                ),
              )
            })()}
        </Paper>
      </Popper>
    </Box>
  )
}

/** 메뉴 한 줄: 체크 칸 · 이름 · 단축키 · 하위 메뉴 화살표 */
function Row({ it }: { it: Exclude<MenuEntry, 'sep'> }): JSX.Element {
  return (
    <>
      <Box sx={{ width: size.icon, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{it.checked && <Check sx={{ fontSize: 14 }} />}</Box>
      <Box sx={{ flex: 1, whiteSpace: 'nowrap' }}>{it.label}</Box>
      {it.shortcut && (
        <Box component="span" sx={{ fontSize: font.xs, opacity: 0.75, pl: `${space.xl}px`, whiteSpace: 'nowrap' }}>
          {it.shortcut}
        </Box>
      )}
      {it.submenu && <ChevronRight sx={{ fontSize: 14, mr: '-4px', color: color.textSecondary }} />}
    </>
  )
}
