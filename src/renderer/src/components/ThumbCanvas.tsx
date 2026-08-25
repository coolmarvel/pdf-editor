import { useEffect, useRef, useState } from 'react'
import type { RenderTask } from 'pdfjs-dist'
import type { PageRef } from '@core/pages'
import { renderPage } from '@renderer/pdf/docs'

/**
 * 페이지 썸네일 캔버스 (사이드바·Manage Pages 공용). width px(백킹 스토어)에 맞춰 렌더.
 * - 뷰포트 ±300px 안에 들어올 때만 렌더 (500쪽 문서를 열어도 보이는 것만 래스터화)
 * - ±1500px 밖으로 멀어지면 백킹 스토어를 비운다(width=0). 래퍼가 aspect-ratio 로 높이를 잡고 있어 스크롤 높이는 불변
 * - 언마운트/재렌더 시 진행 중인 pdf.js RenderTask 를 cancel (RenderingCancelledException 은 삼킨다)
 */
export default function ThumbCanvas({ page, width, pageW, pageH }: { page: PageRef; width: number; pageW: number; pageH: number }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const vis = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '300px 0px' })
    const nr = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '1500px 0px' })
    vis.observe(el)
    nr.observe(el)
    return () => {
      vis.disconnect()
      nr.disconnect()
    }
  }, [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (!visible) {
      if (!near) canvas.width = canvas.height = 0
      return
    }
    const ac = new AbortController()
    let task: RenderTask | undefined
    renderPage(page, canvas, width / pageW, {
      signal: ac.signal,
      onTask: (t) => {
        task = t
        if (ac.signal.aborted) t.cancel()
      }
    }).catch((err: unknown) => {
      // 취소는 정상 경로 (다음 effect 가 다시 그린다). 그 외는 원래처럼 밖으로
      if ((err as { name?: string })?.name !== 'RenderingCancelledException') throw err
    })
    return () => {
      ac.abort()
      task?.cancel()
    }
    // page identity 가 docId/pageIndex/extraRotation 변경을 모두 대변한다 (pages.ts 는 항상 새 객체를 만든다)
  }, [visible, near, page, width, pageW])

  return (
    <div style={{ width: '100%', aspectRatio: `${pageW} / ${pageH}` }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
