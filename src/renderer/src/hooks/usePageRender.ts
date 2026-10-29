import { useEffect, type RefObject } from 'react'
import type { PageRef } from '@core/pages'
import { renderPage, type RenderHandle } from '@renderer/pdf/docs'
import { useRenderEpoch } from '@renderer/pdf/renderEpoch'

/**
 * 엔진 페이지 → 캔버스 렌더 이펙트 (PageCanvas·ThumbCanvas 공용).
 * - enabled 가 false 면 아무것도 하지 않는다 (호출부가 백킹 스토어 해제를 담당)
 * - 입력이 바뀌거나 언마운트되면 진행 중 렌더 손잡이를 cancel(결과 폐기) — 같은 캔버스에 새 렌더가 걸리기 전에 이전 렌더를 끊는다.
 *   RenderingCancelledException 은 정상 경로(삼킨다), 그 외 오류는 밖으로
 * - onDone 은 취소되지 않고 끝난 렌더 뒤에만 불린다
 */
export function usePageRender(ref: RefObject<HTMLCanvasElement>, page: PageRef, scale: number, enabled: boolean, onDone?: () => void): void {
  // 엔진 워커가 죽었다 다시 열리면 세대가 올라 다시 그린다
  const epoch = useRenderEpoch()
  useEffect(() => {
    const canvas = ref.current
    if (!enabled || !canvas) return
    const ac = new AbortController()
    let task: RenderHandle | undefined
    renderPage(page, canvas, scale, {
      signal: ac.signal,
      onTask: (t) => {
        task = t
        if (ac.signal.aborted) t.cancel()
      }
    }).then(
      () => {
        if (!ac.signal.aborted) onDone?.()
      },
      (err: unknown) => {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') throw err
      }
    )
    return () => {
      ac.abort()
      task?.cancel()
    }
    // page identity 가 docId/pageIndex/extraRotation 변경을 모두 대변한다 (pages.ts 는 항상 새 객체를 만든다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page, page.extraRotation, scale, epoch])
}
