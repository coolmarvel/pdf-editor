import { useEffect, useRef } from 'react'
import type { PageRef } from '@core/pages'
import { renderPage } from '@renderer/pdf/docs'

/** 페이지 썸네일 캔버스 (사이드바·Manage Pages 공용). width px에 맞춰 렌더 */
export default function ThumbCanvas({ page, width, pageW }: { page: PageRef; width: number; pageW: number }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true
    const canvas = ref.current
    if (!canvas) return
    void renderPage(page, canvas, width / pageW).then(() => {
      if (!alive) return
    })
    return () => {
      alive = false
    }
    // extraRotation·docId·pageIndex 가 바뀌면 다시 렌더
  }, [page.docId, page.pageIndex, page.extraRotation, width, pageW, page])

  return <canvas ref={ref} style={{ width: '100%', display: 'block' }} />
}
