import MenuItem, { type MenuItemProps } from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'

interface MenuActionProps extends Omit<MenuItemProps, 'children'> {
  icon: JSX.Element
  label: string
  secondary?: string
}

/**
 * 메뉴 항목 = [아이콘] + 라벨(+보조 설명). 사이드바 ⋮/⊕ 메뉴와 툴바 스플릿 메뉴가 공유.
 * MenuItemProps 를 그대로 흘려보내야 MUI MenuList 가 첫 항목에 주입하는 autoFocus/tabIndex 가 살아있다.
 */
export default function MenuAction({ icon, label, secondary, ...rest }: MenuActionProps): JSX.Element {
  return (
    <MenuItem {...rest}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} secondary={secondary} />
    </MenuItem>
  )
}
