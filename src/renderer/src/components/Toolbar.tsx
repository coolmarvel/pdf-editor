import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  IconPages,
  IconCursor,
  IconUndo,
  IconRedo,
  IconText,
  IconTextEdit,
  IconEraser,
  IconHighlighter,
  IconPen,
  IconImage,
  IconStamp,
  IconSquare,
  IconCircle,
  IconCross,
  IconCheck,
  IconSign,
  IconWatermark,
  IconNote,
  IconLink,
  IconLayout,
  IconGrid,
  IconChevronDown,
  IconPageSingle,
  IconPageDouble,
  IconFit,
  IconScrollContinuous,
  IconScrollPaged,
  IconRotateLeft,
  IconRotateRight,
} from "./icons";
import {
  useEditor,
  selectCanUndo,
  selectCanRedo,
  type Tool,
} from "@renderer/store/editor";
import { useT } from "@renderer/i18n";
import { ui } from "@renderer/theme";
import MenuAction from "./ui/MenuAction";
import { useHorizontalWheel } from "@renderer/hooks/useHorizontalScroll";

interface ToolBtnProps {
  label: string;
  icon: JSX.Element;
  active?: boolean;
  disabled?: boolean;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
  /** 있으면 스플릿 버튼: 주 버튼(onClick)과 ▾(메뉴 열기)가 **하나의 hover 영역**을 이루고, 메뉴는 ▾ 를 눌렀을 때만 열린다 */
  onDropdown?: (e: React.MouseEvent<HTMLElement>) => void;
  /** ▾ 의 data-testid (e2e 가 메뉴를 여는 손잡이) */
  menuTestId?: string;
  /** 터치 환경: 라벨을 숨기고 아이콘만(한 화면에 더 많이) */
  compact?: boolean;
}

const { color, chrome, size, space, surface, focusRing } = ui.classic;

/**
 * 툴 버튼 — 클래식(pdf-editor-live ADR-0004): 24px 평면 버튼, 16px 아이콘 + 12px 라벨 가로 배치, 호버에 1px 파란 테두리 + 흰 면, 활성은 눌린 면.
 * 스플릿이면 ▾(12px)가 오른쪽에 붙어 같은 테두리 안에서 하나의 호버 영역을 이루고, 메뉴는 ▾ 를 눌렀을 때만 열린다.
 * 라벨은 절대 줄바꿈·말줄임하지 않는다(버튼이 라벨 폭만큼 자란다). 터치(pointer: coarse)에서만 36px 높이.
 */
const DROPDOWN_W = 12;
const pressedSx = {
  background: surface.pressed,
  borderColor: chrome.toolbarEdge,
  color: color.text,
  boxShadow: `inset 1px 1px 0 ${chrome.pressed}`,
  "&:hover": { background: surface.pressed, borderColor: color.hoverEdge },
} as const;

function ToolBtn({
  label,
  icon,
  active,
  disabled,
  onClick,
  onDropdown,
  menuTestId,
  compact,
}: ToolBtnProps): JSX.Element {
  const t = useT();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        flexShrink: 0,
        height: size.ctlMd,
        border: "1px solid transparent",
        "@media (pointer: coarse)": { height: size.touch },
        // 주 버튼 + ▾ 를 감싸는 컨테이너 하나가 테두리를 받는다 (두 조각이 따로 밝아지지 않는다)
        ...(active
          ? pressedSx
          : disabled
            ? { color: color.text }
            : {
                color: color.text,
                "&:hover": {
                  bgcolor: color.canvas,
                  borderColor: color.hoverEdge,
                },
              }),
      }}
    >
      <Tooltip title={compact ? label : ""}>
        <span style={{ display: "flex" }}>
          <ButtonBase
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
            sx={{
              height: "100%",
              minWidth: size.ctlMd,
              px: `${space.sm}px`,
              gap: `${space.sm}px`,
              color: "inherit",
              fontSize: 12,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              "& svg": {
                fontSize: size.icon,
                color: active ? color.accentPressed : color.textSecondary,
              },
              "&:active": { background: surface.pressed },
              "&.Mui-focusVisible": focusRing,
              "&.Mui-disabled": {
                color: color.textDisabled,
                "& svg": { color: color.textDisabled },
              },
              "@media (pointer: coarse)": { minWidth: size.touch },
            }}
          >
            {icon}
            {!compact && (
              <Box
                component="span"
                sx={{ whiteSpace: "nowrap", lineHeight: 1 }}
              >
                {label}
              </Box>
            )}
          </ButtonBase>
        </span>
      </Tooltip>
      {onDropdown && (
        <ButtonBase
          aria-label={t("moreOptions")}
          aria-haspopup="menu"
          data-testid={menuTestId}
          onClick={onDropdown}
          sx={{
            width: compact ? size.touch / 2 + 6 : DROPDOWN_W,
            borderLeft: `1px solid ${active ? chrome.toolbarEdge : "transparent"}`,
            color: color.textSecondary,
            "&:hover": { bgcolor: chrome.toolbarFace, color: color.text },
            "&:active": { background: surface.pressed },
            "& svg": { fontSize: 12 },
          }}
        >
          <IconChevronDown />
        </ButtonBase>
      )}
    </Box>
  );
}

/** 음각 세로 구분선 (진한 선 + 흰 선) */
function GDivider(): JSX.Element {
  return (
    <Box
      aria-hidden
      sx={{
        width: "2px",
        height: 18,
        flexShrink: 0,
        mx: `${space.xs}px`,
        borderLeft: `1px solid ${chrome.separator}`,
        borderRight: `1px solid ${color.canvas}`,
      }}
    />
  );
}

interface SplitItem<K extends string> {
  k: K;
  icon: JSX.Element;
  label: string;
  secondary?: string;
  selected?: boolean;
}

/**
 * 스플릿 그룹(주 버튼 + ▾ 메뉴) 공통 상태: 마지막으로 고른 하위 도구(last)·메뉴 앵커·메뉴 JSX.
 * 메뉴 항목을 고르면 pick(k) → (false 를 돌려주지 않는 한) last 갱신 → 닫기. 주 버튼의 동작은 호출부가 last 로 정한다
 */
function useSplitGroup<K extends string>(
  items: SplitItem<K>[],
  initial: K,
  pick: (k: K) => boolean | void,
): {
  last: K;
  open: (e: React.MouseEvent<HTMLElement>) => void;
  menu: JSX.Element;
} {
  const [last, setLast] = useState<K>(initial);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menu = (
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
      {items.map((x) => (
        <MenuAction
          key={x.k}
          icon={x.icon}
          label={x.label}
          secondary={x.secondary}
          selected={x.selected}
          onClick={() => {
            if (pick(x.k) !== false) setLast(x.k);
            setAnchor(null);
          }}
        />
      ))}
    </Menu>
  );
  return { last, open: (e) => setAnchor(e.currentTarget), menu };
}

/** 페이지 레이아웃 패널의 아이콘 토글 버튼 */
function LayoutBtn({
  title,
  selected,
  onClick,
  children,
}: {
  title: string;
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          ...(selected ? pressedSx : null),
          ...(selected ? { color: color.accentPressed } : null),
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

export interface ToolbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onManagePages: () => void;
  onOpenImage: () => void;
  onOpenStamp: () => void;
  onOpenSign: () => void;
}

export default function Toolbar(p: ToolbarProps): JSX.Element {
  const t = useT();
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor(selectCanUndo);
  const canRedo = useEditor(selectCanRedo);
  const pageRotate = useEditor((s) => s.pageRotate);
  const eraserKind = useEditor((s) => s.eraserStyle.kind);
  const setEraserStyle = useEditor((s) => s.setEraserStyle);
  const pageMode = useEditor((s) => s.pageMode);
  const setPageMode = useEditor((s) => s.setPageMode);
  const pageTransition = useEditor((s) => s.pageTransition);
  const setPageTransition = useEditor((s) => s.setPageTransition);
  const requestFit = useEditor((s) => s.requestFit);

  // 터치(pointer: coarse) → 아이콘만. 폭이 모자라면 가로 스크롤(세로 휠 → 가로)
  const coarse = useMediaQuery("(pointer: coarse)");
  const wheelRef = useHorizontalWheel<HTMLDivElement>();
  const [layoutMenu, setLayoutMenu] = useState<HTMLElement | null>(null);

  /** 현재 페이지 회전 — pages·currentPage 는 클릭 시점에 읽는다(currentPage 는 스크롤마다 바뀌어 구독하면 툴바 전체가 리렌더) */
  const rotateCurrentPage = (deg: -90 | 90): void => {
    const { pages, currentPage } = useEditor.getState();
    const pg = pages[currentPage];
    if (pg) pageRotate(new Set([pg.id]), deg);
  };
  const is = (x: Tool): boolean => tool === x;
  /** 도구 토글 (Guru): 활성 상태에서 다시 누르면 비활성(선택 도구로) */
  const toggle = (x: Tool): void => setTool(tool === x ? "select" : x);
  /** 지우개(도형 덮기) 진입 — 도형은 항상 사각형으로 리셋 (Guru 동작). 본체 버튼·메뉴 항목 공용 */
  const enterWhiteout = (): void => {
    setEraserStyle({ kind: "rect" });
    setTool("whiteout");
  };

  // 스플릿 그룹: 주 버튼 = 마지막으로 고른 하위 도구(라벨·아이콘도 그것), ▾ = 메뉴. 텍스트(추가/수정)·표시(X/체크)·주석(서명/주석/링크)·지우개·이미지·도형
  const TEXT_ITEMS = [
    {
      k: "addText" as const,
      icon: <IconText />,
      label: t("addText"),
      selected: is("addText"),
    },
    {
      k: "editText" as const,
      icon: <IconTextEdit />,
      label: t("editText"),
      selected: is("editText"),
    },
  ];
  const MARK_ITEMS = [
    {
      k: "cross" as const,
      icon: <IconCross />,
      label: t("cross"),
      selected: is("cross"),
    },
    {
      k: "check" as const,
      icon: <IconCheck />,
      label: t("check"),
      selected: is("check"),
    },
  ];
  const ANNOT_ITEMS = [
    {
      k: "sign" as const,
      icon: <IconSign />,
      label: t("sign"),
      selected: is("sign"),
    },
    {
      k: "note" as const,
      icon: <IconNote />,
      label: t("note"),
      selected: is("note"),
    },
    {
      k: "link" as const,
      icon: <IconLink />,
      label: t("link"),
      selected: is("link"),
    },
  ];
  const text = useSplitGroup(TEXT_ITEMS, "addText", setTool);
  const mark = useSplitGroup(MARK_ITEMS, "cross", setTool);
  // 주석 메뉴: 서명은 다이얼로그, 주석/링크는 도구 켜기
  const annot = useSplitGroup(ANNOT_ITEMS, "sign", (k) =>
    k === "sign" ? p.onOpenSign() : setTool(k),
  );
  const eraser = useSplitGroup(
    [
      {
        k: "whiteout" as const,
        icon: <IconEraser fontSize="small" />,
        label: t("eraser"),
        secondary: t("eraserDesc"),
        selected: is("whiteout"),
      },
      {
        k: "eraseDrawing" as const,
        icon: <IconEraser fontSize="small" />,
        label: t("eraseDrawing"),
        secondary: t("eraseDrawingDesc"),
        selected: is("eraseDrawing"),
      },
    ],
    "whiteout",
    (k) => (k === "whiteout" ? enterWhiteout() : setTool(k)),
  );
  const image = useSplitGroup(
    [
      {
        k: "image" as const,
        icon: <IconImage fontSize="small" />,
        label: t("image"),
      },
      {
        k: "stamp" as const,
        icon: <IconStamp fontSize="small" />,
        label: t("stamp"),
      },
    ],
    "image",
    (k) => (k === "image" ? p.onOpenImage() : p.onOpenStamp()),
  );
  // 도형 메뉴: 지우개가 켜져 있으면 지우개 도형을 바꾼다 (마지막 도형은 건드리지 않는다)
  const shape = useSplitGroup(
    (["rect", "ellipse"] as const).map((k) => ({
      k,
      icon:
        k === "rect" ? (
          <IconSquare fontSize="small" />
        ) : (
          <IconCircle fontSize="small" />
        ),
      label: k === "rect" ? t("rectangle") : t("ellipse"),
      selected: tool === "whiteout" ? eraserKind === k : is(k),
    })),
    "rect",
    (k) => {
      if (tool !== "whiteout") {
        setTool(k);
        return;
      }
      setEraserStyle({ kind: k });
      return false;
    },
  );
  const shapeShown =
    tool === "rect" || tool === "ellipse"
      ? tool
      : tool === "whiteout"
        ? eraserKind
        : shape.last;
  // 그룹 주 버튼에 보이는 하위 도구 = 지금 켜진 것(스토어에서 직접 켠 경우 포함) 아니면 마지막으로 고른 것
  const textShown =
    tool === "addText" || tool === "editText" ? tool : text.last;
  const markShown = tool === "cross" || tool === "check" ? tool : mark.last;
  const annotShown =
    tool === "sign" || tool === "note" || tool === "link" ? tool : annot.last;
  const textItem = TEXT_ITEMS.find((x) => x.k === textShown)!;
  const markItem = MARK_ITEMS.find((x) => x.k === markShown)!;
  const annotItem = ANNOT_ITEMS.find((x) => x.k === annotShown)!;
  /** 주석 그룹 실행: 서명은 다이얼로그, 주석/링크는 토글 */
  const runAnnot = (k: "sign" | "note" | "link"): void => {
    if (k === "sign") p.onOpenSign();
    else toggle(k);
  };

  return (
    <Box
      ref={wheelRef}
      data-testid="toolbar"
      sx={{
        height: size.toolBar,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        px: `${space.sm}px`,
        gap: "1px",
        flexWrap: "nowrap",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
        background: surface.toolbar,
        borderBottom: `1px solid ${chrome.frame}`,
        "&::after": { content: '""', flex: "0 0 4px" },
        "@media (pointer: coarse)": { height: size.touch + 4 },
      }}
    >
      <ToolBtn
        compact={coarse}
        label={t("pages")}
        icon={<IconPages />}
        active={p.sidebarOpen}
        onClick={p.onToggleSidebar}
      />
      <ToolBtn
        compact={coarse}
        label={t("select")}
        icon={<IconCursor />}
        active={is("select")}
        onClick={() => setTool("select")}
      />
      <GDivider />
      <ToolBtn
        compact={coarse}
        label={t("undo")}
        icon={<IconUndo />}
        disabled={!canUndo}
        onClick={() => undo()}
      />
      <ToolBtn
        compact={coarse}
        label={t("redo")}
        icon={<IconRedo />}
        disabled={!canRedo}
        onClick={() => redo()}
      />
      <GDivider />

      {/* 텍스트 그룹: 추가/수정. 텍스트 수정은 토글(세션) — 켜져 있는 동안 하이라이트 유지, 다시 누르면 종료(변경 있으면 저장 확인) */}
      <ToolBtn
        compact={coarse}
        label={textItem.label}
        icon={textItem.icon}
        active={is("addText") || is("editText")}
        onClick={() => toggle(textShown)}
        onDropdown={text.open}
        menuTestId="tool-text-menu"
      />
      <ToolBtn
        compact={coarse}
        label={t("eraser")}
        icon={<IconEraser />}
        active={is("whiteout") || is("eraseDrawing")}
        onClick={() => {
          if (is("whiteout") || is("eraseDrawing")) {
            setTool("select");
          } else if (eraser.last === "whiteout") {
            enterWhiteout();
          } else {
            setTool("eraseDrawing");
          }
        }}
        onDropdown={eraser.open}
        menuTestId="tool-eraser-menu"
      />
      <ToolBtn
        compact={coarse}
        label={t("highlight")}
        icon={<IconHighlighter />}
        active={is("highlight")}
        onClick={() => toggle("highlight")}
      />
      <ToolBtn
        compact={coarse}
        label={t("pencil")}
        icon={<IconPen />}
        active={is("pencil")}
        onClick={() => toggle("pencil")}
      />
      <ToolBtn
        compact={coarse}
        label={image.last === "stamp" ? t("stamp") : t("image")}
        icon={image.last === "stamp" ? <IconStamp /> : <IconImage />}
        active={is("image") || is("stamp")}
        onClick={() =>
          image.last === "stamp" ? p.onOpenStamp() : p.onOpenImage()
        }
        onDropdown={image.open}
        menuTestId="tool-image-menu"
      />
      {/* 도형 버튼은 지우개(도형 덮기)와 연동: 지우개가 켜지면 그 도형(기본 사각형)을 표시하며 함께 활성 */}
      <ToolBtn
        compact={coarse}
        label={shapeShown === "ellipse" ? t("ellipse") : t("rectangle")}
        icon={shapeShown === "ellipse" ? <IconCircle /> : <IconSquare />}
        active={is("rect") || is("ellipse") || is("whiteout")}
        onClick={() => {
          if (is("rect") || is("ellipse") || is("whiteout")) setTool("select");
          else setTool(shape.last);
        }}
        onDropdown={shape.open}
        menuTestId="tool-shape-menu"
      />
      {/* 표시 그룹: X 표시 / 체크 */}
      <ToolBtn
        compact={coarse}
        label={markItem.label}
        icon={markItem.icon}
        active={is("cross") || is("check")}
        onClick={() => toggle(markShown)}
        onDropdown={mark.open}
        menuTestId="tool-mark-menu"
      />
      {/* 주석 그룹: 서명 / 주석 / 링크 */}
      <ToolBtn
        compact={coarse}
        label={annotItem.label}
        icon={annotItem.icon}
        active={is("sign") || is("note") || is("link")}
        onClick={() => runAnnot(annotShown)}
        onDropdown={annot.open}
        menuTestId="tool-annot-menu"
      />
      <ToolBtn
        compact={coarse}
        label={t("watermark")}
        icon={<IconWatermark />}
        active={is("watermark")}
        onClick={() => toggle("watermark")}
      />
      <GDivider />

      {/* 페이지 레이아웃은 순수 메뉴 버튼 — 본체·⌄ 어느 쪽을 눌러도 패널 */}
      <ToolBtn
        compact={coarse}
        label={t("pageLayout")}
        icon={<IconLayout />}
        active={!!layoutMenu}
        onClick={(e) => setLayoutMenu(e.currentTarget)}
        onDropdown={(e) => setLayoutMenu(e.currentTarget)}
        menuTestId="tool-layout-menu"
      />
      <ToolBtn
        compact={coarse}
        label={t("managePages")}
        icon={<IconGrid />}
        onClick={p.onManagePages}
      />

      {text.menu}
      {mark.menu}
      {annot.menu}
      {eraser.menu}
      {image.menu}
      {shape.menu}

      {/* ── 페이지 레이아웃 패널 (Guru: Page Mode / Page Transition / Page Rotation) ── */}
      <Menu
        anchorEl={layoutMenu}
        open={!!layoutMenu}
        onClose={() => setLayoutMenu(null)}
      >
        <Box sx={{ px: 2, py: 0.5, width: 280 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 0.5,
            }}
          >
            <Typography variant="body2">{t("pageMode")}</Typography>
            <Box sx={{ display: "flex", gap: 0.3 }}>
              <LayoutBtn
                title={t("pageModeSingle")}
                selected={pageMode === "single"}
                onClick={() => setPageMode("single")}
              >
                <IconPageSingle fontSize="small" />
              </LayoutBtn>
              <LayoutBtn
                title={t("pageModeDouble")}
                selected={pageMode === "double"}
                onClick={() => setPageMode("double")}
              >
                <IconPageDouble fontSize="small" />
              </LayoutBtn>
              <LayoutBtn title={t("pageModeFit")} onClick={() => requestFit()}>
                <IconFit fontSize="small" />
              </LayoutBtn>
            </Box>
          </Box>
          <Divider />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 0.5,
            }}
          >
            <Typography variant="body2">{t("pageTransition")}</Typography>
            <Box sx={{ display: "flex", gap: 0.3 }}>
              <LayoutBtn
                title={t("transitionContinuous")}
                selected={pageTransition === "continuous"}
                onClick={() => setPageTransition("continuous")}
              >
                <IconScrollContinuous fontSize="small" />
              </LayoutBtn>
              <LayoutBtn
                title={t("transitionPaged")}
                selected={pageTransition === "paged"}
                onClick={() => setPageTransition("paged")}
              >
                <IconScrollPaged fontSize="small" />
              </LayoutBtn>
            </Box>
          </Box>
          <Divider />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 0.5,
            }}
          >
            <Typography variant="body2">{t("pageRotation")}</Typography>
            <Box sx={{ display: "flex", gap: 0.3 }}>
              <LayoutBtn
                title={t("rotateLeft")}
                onClick={() => rotateCurrentPage(-90)}
              >
                <IconRotateLeft fontSize="small" />
              </LayoutBtn>
              <LayoutBtn
                title={t("rotateRight")}
                onClick={() => rotateCurrentPage(90)}
              >
                <IconRotateRight fontSize="small" />
              </LayoutBtn>
            </Box>
          </Box>
        </Box>
      </Menu>
    </Box>
  );
}
