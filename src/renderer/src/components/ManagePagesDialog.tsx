import { useMemo, useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { DEFAULT_PAGE_SIZE } from "@core/pages";
import {
  useEditor,
  selectCanUndo,
  selectCanRedo,
} from "@renderer/store/editor";
import { useT } from "@renderer/i18n";
import { ui } from "@renderer/theme";
import { usePageImport } from "@renderer/hooks/usePageImport";
import { useDragReorder } from "@renderer/hooks/useDragReorder";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  FileUp,
  IconImage,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  SquareDashed,
  SquareDashedMousePointer,
  Trash2,
  Undo2,
} from "./icons";
import ThumbCanvas from "./ThumbCanvas";
import { DialogFooter } from "./ui/DialogBars";
import {
  FADE_W,
  fadeSx,
  H_SCROLL_SX,
  useHorizontalWheel,
} from "@renderer/hooks/useHorizontalScroll";

/** 툴바 버튼: 넓은 화면은 아이콘+라벨 Button, 좁은 화면은 아이콘 전용 IconButton(툴팁·aria-label 로 이름 유지) */
function TbBtn({
  narrow,
  icon,
  label,
  disabled,
  onClick,
}: {
  narrow: boolean;
  icon: JSX.Element;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}): JSX.Element {
  if (!narrow) {
    return (
      <Button
        size="small"
        color="inherit"
        startIcon={icon}
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </Button>
    );
  }
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          sx={{ width: 40, height: 40 }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** pdfguru의 Manage Pages 모달: 썸네일 그리드 + 일괄 작업 + 드래그 순서 변경 */
export default function ManagePagesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const pages = useEditor((s) => s.pages);
  const displaySizes = useEditor((s) => s.displaySizes);
  const pageInsertBlank = useEditor((s) => s.pageInsertBlank);
  const pageRemove = useEditor((s) => s.pageRemove);
  const pageDuplicate = useEditor((s) => s.pageDuplicate);
  const pageRotate = useEditor((s) => s.pageRotate);
  const pageNudge = useEditor((s) => s.pageNudge);
  const pageMoveToIndex = useEditor((s) => s.pageMoveToIndex);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor(selectCanUndo);
  const canRedo = useEditor(selectCanRedo);
  const { inputs, openPdf, openImages } = usePageImport();

  const [sel, setSel] = useState<Set<string>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  const has = sel.size > 0;
  // 폰 폭(< 600px): 전체 화면 + 2열 그리드. 폭 < 900(sm 포함): 툴바는 아이콘만(라벨은 툴팁/aria-label) + 오른쪽 페이드 —
  // 768 에서 텍스트 버튼 11개(1180px)가 704px 다이얼로그를 넘쳐 '문서 가져오기…' 가 숨겨져 있다는 단서가 없었다
  const narrow = useMediaQuery("(max-width: 599.95px)");
  const compact = useMediaQuery("(max-width: 899.95px)");
  // 툴바가 넘칠 때 마우스 세로 휠로도 가로 스크롤 + 오른쪽 페이드 힌트(좁은 폭)
  const wheelRef = useHorizontalWheel<HTMLDivElement>();
  /** 그리드 gap(px) — 드롭 바를 gap 한가운데 놓기 위해 sx 의 gap(2/3 = 16/24px) 과 같은 값 */
  const gapPx = narrow ? 16 : 24;

  function toggle(id: string): void {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // 삭제된 페이지가 선택에 남지 않게 정리 (id Set 은 pages 가 바뀔 때만 다시 만든다)
  const pageIds = useMemo(() => new Set(pages.map((p) => p.id)), [pages]);
  const validSel = useMemo(
    () => new Set([...sel].filter((id) => pageIds.has(id))),
    [sel, pageIds],
  );

  const { dragIdx, dropIdx, bind } = useDragReorder({
    containerRef: gridRef,
    itemSelector: "[data-mthumb]",
    axis: "grid",
    threshold: 7,
    onDrop: (index, drop) => {
      const dragged = pages[index];
      // 선택에 포함된 페이지를 끌면 선택 전체 이동, 아니면 그 페이지만
      const ids = validSel.has(dragged.id) ? validSel : new Set([dragged.id]);
      pageMoveToIndex(ids, drop);
    },
    onClick: (index) => toggle(pages[index].id), // 클릭 = 선택 토글
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      fullScreen={narrow}
      PaperProps={{
        sx: narrow
          ? { width: "100%", maxWidth: "none", height: "100%" }
          : {
              width: "min(1400px, 94vw)",
              maxWidth: "none",
              height: "min(860px, 90vh)",
            },
      }}
    >
      {/* 툴바는 한 줄 고정(1200px 폭에서 두 줄로 꺾였다). 폭이 모자라면 줄바꿈 대신 가로 스크롤(얇은 스크롤바 + 세로 휠 → 가로) */}
      <Box
        sx={{
          position: "relative",
          borderBottom: `1px solid ${ui.classic.chrome.frame}`,
          background: ui.classic.surface.toolbar,
          flexShrink: 0,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={`${ui.classic.space.xs}px`}
          ref={wheelRef}
          data-testid="manage-toolbar"
          sx={{
            height: ui.classic.size.toolBar,
            px: `${ui.classic.space.sm}px`,
            pr: compact ? `${FADE_W}px` : `${ui.classic.space.sm}px`,
            flexWrap: "nowrap",
            ...H_SCROLL_SX,
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            "& > .MuiButton-root": {
              flexShrink: 0,
              whiteSpace: "nowrap",
              minWidth: 0,
            },
            "& > .MuiButton-root .MuiSvgIcon-root": {
              fontSize: ui.classic.size.icon,
            },
            "& .MuiIconButton-root": { flexShrink: 0 },
            "& .MuiIconButton-root .MuiSvgIcon-root": {
              fontSize: ui.classic.size.icon,
            },
            "@media (pointer: coarse)": { height: ui.classic.size.touch + 4 },
          }}
        >
          <TbBtn
            narrow={compact}
            icon={<Plus />}
            label={t("newPage")}
            onClick={() => pageInsertBlank(pages.length)}
          />
          <TbBtn
            narrow={compact}
            icon={<Trash2 />}
            label={t("delete")}
            disabled={!has}
            onClick={() => {
              pageRemove(validSel);
              setSel(new Set());
            }}
          />
          <TbBtn
            narrow={compact}
            icon={<Copy />}
            label={t("duplicate")}
            disabled={!has}
            onClick={() => pageDuplicate(validSel)}
          />
          <TbBtn
            narrow={compact}
            icon={<RotateCcw />}
            label={t("rotateLeft")}
            disabled={!has}
            onClick={() => pageRotate(validSel, -90)}
          />
          <TbBtn
            narrow={compact}
            icon={<RotateCw />}
            label={t("rotateRight")}
            disabled={!has}
            onClick={() => pageRotate(validSel, 90)}
          />
          <TbBtn
            narrow={compact}
            icon={<ArrowLeft />}
            label={t("forward")}
            disabled={!has}
            onClick={() => pageNudge(validSel, -1)}
          />
          <TbBtn
            narrow={compact}
            icon={<ArrowRight />}
            label={t("backward")}
            disabled={!has}
            onClick={() => pageNudge(validSel, 1)}
          />
          <TbBtn
            narrow={compact}
            icon={<FileUp />}
            label={t("importDoc")}
            onClick={() => openPdf()}
          />
          <TbBtn
            narrow={compact}
            icon={<IconImage />}
            label={t("importImages")}
            onClick={() => openImages()}
          />
          {inputs}
          <Box sx={{ flex: 1, minWidth: 8 }} />
          <Tooltip title={t("undo")}>
            <span>
              <IconButton
                size="small"
                disabled={!canUndo}
                onClick={() => undo()}
              >
                <Undo2 />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("redo")}>
            <span>
              <IconButton
                size="small"
                disabled={!canRedo}
                onClick={() => redo()}
              >
                <Redo2 />
              </IconButton>
            </span>
          </Tooltip>
          <TbBtn
            narrow={compact}
            icon={<SquareDashedMousePointer />}
            label={t("selectAll")}
            onClick={() => setSel(new Set(pages.map((p) => p.id)))}
          />
          <TbBtn
            narrow={compact}
            icon={<SquareDashed />}
            label={t("deselect")}
            disabled={!has}
            onClick={() => setSel(new Set())}
          />
        </Stack>
        {compact && <Box sx={fadeSx} />}
      </Box>

      <Box
        ref={gridRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          p: narrow ? 2 : 3,
          display: "grid",
          gridTemplateColumns: narrow
            ? "repeat(auto-fill, minmax(140px, 1fr))"
            : "repeat(auto-fill, minmax(170px, 1fr))",
          gap: `${gapPx}px`,
          alignContent: "start",
        }}
      >
        {pages.map((p, i) => {
          const size = displaySizes[p.id] ?? DEFAULT_PAGE_SIZE;
          const selected = validSel.has(p.id);
          // 삽입점 표시: dropIdx === i → 이 썸네일 왼쪽 gap 의 한가운데 세로 바(2px 초록, 썸네일 높이), 마지막 뒤는 마지막 썸네일 오른쪽 gap
          // (예전엔 썸네일 옆에 붙은 두꺼운 그림자가 "( )" 처럼 보였다)
          const showLeft = dragIdx !== null && dropIdx === i;
          const showRight =
            dragIdx !== null &&
            dropIdx === pages.length &&
            i === pages.length - 1;
          const dropBar = {
            content: '""',
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 2,
            borderRadius: 0,
            bgcolor: "primary.main",
            pointerEvents: "none",
          } as const;
          return (
            <Box
              key={p.id}
              data-mthumb
              onPointerDown={(e) => bind.onPointerDown(e, i)}
              onPointerMove={bind.onPointerMove}
              onPointerUp={() => bind.onPointerUp(i)}
              sx={{
                cursor: "pointer",
                userSelect: "none",
                touchAction: "none",
                opacity: dragIdx === i ? 0.4 : 1,
                borderRadius: 0,
              }}
            >
              <Box
                data-drop-indicator={
                  showLeft ? "before" : showRight ? "after" : undefined
                }
                sx={{
                  position: "relative",
                  ...(showLeft
                    ? { "&::before": { ...dropBar, left: -(gapPx / 2) - 1 } }
                    : {}),
                  ...(showRight
                    ? { "&::after": { ...dropBar, right: -(gapPx / 2) - 1 } }
                    : {}),
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    overflow: "hidden",
                    borderColor: selected ? "secondary.main" : "divider",
                    borderWidth: selected ? 2.5 : 1,
                    borderRadius: 1.5,
                  }}
                >
                  <ThumbCanvas
                    page={p}
                    width={340}
                    pageW={size.w}
                    pageH={size.h}
                  />
                </Paper>
              </Box>
              <Typography
                variant="caption"
                display="block"
                textAlign="center"
                sx={{
                  mt: 0.5,
                  bgcolor: selected ? "secondary.main" : "transparent",
                  color: selected ? "#fff" : "text.secondary",
                  borderRadius: 0,
                  width: 36,
                  mx: "auto",
                }}
              >
                {i + 1}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <DialogFooter>
        <Button
          color="inherit"
          onClick={onClose}
          sx={narrow ? { height: 44 } : undefined}
        >
          {t("close")}
        </Button>
        {/* 안내 문구는 줄바꿈 금지 — 좁은 화면에서는 숨긴다 */}
        {!narrow && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: 2, whiteSpace: "nowrap" }}
          >
            {t("dragToReorder")}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          onClick={onClose}
          sx={narrow ? { height: 44 } : undefined}
        >
          {t("ok")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
