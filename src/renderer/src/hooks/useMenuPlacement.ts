/**
 * 드롭다운(메뉴·팝오버·셀렉트 목록)의 열림 방향 — 앵커 아래 공간이 모자라면 **위로** 연다(ADR-0004, 피드백 2026-10-13: 옵션 바의
 * 글꼴 목록이 페이지를 덮고 스크롤을 끝까지 내려야 보였다). MUI Popover 는 화면 밖으로 나가면 밀어 넣기만 하고 뒤집지 않는다.
 * 사용: `const place = useMenuPlacement(anchorEl, 320)` → `<Menu {...place} />` / `<Select MenuProps={{ ...place, PaperProps: { sx: { maxHeight: place.maxHeight } } }} />`.
 * 앵커가 없을 땐 아래로. 높이 추정값은 목록의 보통 높이(항목 수 × 22 + 여백) — 실제보다 크면 조금 일찍 뒤집힌다.
 */
import { useMemo } from "react";

export interface MenuPlacement {
  anchorOrigin: {
    vertical: "top" | "bottom";
    horizontal: "left" | "right" | "center";
  };
  transformOrigin: {
    vertical: "top" | "bottom";
    horizontal: "left" | "right" | "center";
  };
  /** 열리는 쪽에 남은 공간(px) — 목록 maxHeight 로 넘겨 화면 밖으로 나가지 않게 */
  maxHeight: number;
  flipped: boolean;
}

/** 화면 가장자리에서 남길 여백 */
const EDGE = 8;

export function menuPlacement(
  anchorEl: Element | null,
  estimatedHeight = 320,
  horizontal: MenuPlacement["anchorOrigin"]["horizontal"] = "left",
): MenuPlacement {
  if (!anchorEl)
    return {
      anchorOrigin: { vertical: "bottom", horizontal },
      transformOrigin: { vertical: "top", horizontal },
      maxHeight: estimatedHeight,
      flipped: false,
    };
  const r = anchorEl.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - EDGE;
  const above = r.top - EDGE;
  const flipped =
    below < Math.min(estimatedHeight, Math.max(120, above)) && above > below;
  return {
    anchorOrigin: { vertical: flipped ? "top" : "bottom", horizontal },
    transformOrigin: { vertical: flipped ? "bottom" : "top", horizontal },
    maxHeight: Math.max(96, Math.floor(flipped ? above : below)),
    flipped,
  };
}

/** 앵커가 바뀔 때(열릴 때) 한 번 계산 — 열린 동안 스크롤로 위치가 바뀌는 경우는 드물고 MUI 가 화면 안으로 밀어 넣는다 */
export function useMenuPlacement(
  anchorEl: Element | null,
  estimatedHeight = 320,
  horizontal: MenuPlacement["anchorOrigin"]["horizontal"] = "left",
): MenuPlacement {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => menuPlacement(anchorEl, estimatedHeight, horizontal),
    [anchorEl, estimatedHeight, horizontal],
  );
}
