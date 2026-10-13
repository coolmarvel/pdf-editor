/**
 * 한 줄 고정(nowrap) 툴바의 가로 스크롤 — 세로 휠을 가로 스크롤로 돌린다 + 공통 sx(얇은 스크롤바·오른쪽 페이드).
 * 터치/트랙패드는 원래 되므로 영향 없음. 컨테이너가 넘치지 않으면 아무것도 하지 않는다(페이지 스크롤 그대로).
 *
 * 왜 ref 로 네이티브 리스너인가(2026-10-13): React 의 onWheel 은 passive 라 `preventDefault()` 가 매 휠마다
 * "Unable to preventDefault inside passive event listener" 를 콘솔에 쏟았고, 포털로 열린 셀렉트 메뉴(글꼴 목록) 안에서 굴린 휠까지
 * React 트리로 버블돼 바가 가로채던 문제도 있었다. 네이티브 `{ passive: false }` 리스너는 그 요소 안에서 **실제로** 일어난 휠만 받는다.
 */
import { useCallback, useEffect, useRef, type RefCallback } from "react";

export function useHorizontalWheel<T extends HTMLElement = HTMLElement>(
  enabled = true,
): RefCallback<T> {
  const elRef = useRef<T | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const attach = useCallback(
    (el: T | null) => {
      cleanup.current?.();
      cleanup.current = null;
      elRef.current = el;
      if (!el || !enabled) return;
      const onWheel = (e: WheelEvent): void => {
        if (el.scrollWidth <= el.clientWidth + 1) return;
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // 이미 가로 제스처
        // 바 안에서 세로로 스크롤되는 자식(목록 등)에서 일어난 휠은 그 자식에게
        for (
          let n = e.target as HTMLElement | null;
          n && n !== el;
          n = n.parentElement
        )
          if (
            n.scrollHeight > n.clientHeight + 1 &&
            getComputedStyle(n).overflowY !== "visible"
          )
            return;
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      cleanup.current = () => el.removeEventListener("wheel", onWheel);
    },
    [enabled],
  );
  useEffect(() => () => cleanup.current?.(), []);
  return attach;
}

/** 가로 스크롤 컨테이너 공통 sx — 얇지만 항상 보이는 스크롤바(마우스 환경에서 "스크롤된다"는 신호) */
export const H_SCROLL_SX = {
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "thin",
  "&::-webkit-scrollbar": { height: 6 },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(0,0,0,.22)",
    borderRadius: 0,
  },
} as const;

/** 오른쪽 끝 페이드("더 있음" 힌트) — position: relative 인 래퍼의 자식으로 둔다. 컨테이너에는 fade 폭만큼 pr 을 줘 마지막 버튼이 가려지지 않게 */
export const FADE_W = 28;
export const fadeSx = {
  position: "absolute",
  top: 0,
  bottom: 0,
  right: 0,
  width: FADE_W,
  pointerEvents: "none",
  background: "linear-gradient(to right, rgba(255,255,255,0), #fff 80%)",
} as const;
