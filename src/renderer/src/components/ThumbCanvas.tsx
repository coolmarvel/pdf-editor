import { useEffect, useRef, useState } from 'react'
import type { PageRef } from '@core/pages'
import { usePageRender } from '@renderer/hooks/usePageRender'
import { useEditor } from '@renderer/store/editor'
import { drawObjects } from '@renderer/editor/draw'
import { preloadObjectImages } from '@renderer/editor/canvasUtil'

/**
 * 페이지 썸네일 캔버스 (사이드바·Manage Pages 공용). width px(백킹 스토어)에 맞춰 렌더.
 * - 뷰포트 ±300px 안에 들어올 때만 렌더 (500쪽 문서를 열어도 보이는 것만 래스터화)
 * - ±1500px 밖으로 멀어지면 백킹 스토어를 비운다(width=0). 래퍼가 aspect-ratio 로 높이를 잡고 있어 스크롤 높이는 불변
 * - 언마운트/재렌더 시 진행 중인 엔진 렌더 손잡이를 cancel (RenderingCancelledException 은 삼킨다)
 * - 페이지 위 객체(서명·텍스트·낙서 등)는 별도 오버레이 캔버스에 그린다 — 객체가 바뀔 때 엔진 재래스터화 없이 오버레이만 다시 그림
 */
export default function ThumbCanvas({ page, width, pageW, pageH }: { page: PageRef; width: number; pageW: number; pageH: number }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const objects = useEditor((s) => s.objectsByPage[page.id])
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
    if (canvas && !visible && !near) canvas.width = canvas.height = 0
  }, [visible, near])
  usePageRender(ref, page, width / pageW, visible)

  // 객체 오버레이: 보일 때만, 이미지 디코드 후 한 프레임에 그린다. 객체가 없으면 백킹 스토어를 비워 메모리를 아낀다
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    const list = objects ?? []
    if (!visible || list.length === 0) {
      canvas.width = canvas.height = 0
      return
    }
    let cancelled = false
    void preloadObjectImages(list).then(() => {
      if (cancelled) return
      const W = width
      const H = Math.round((width * pageH) / pageW)
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W
        canvas.height = H
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      drawObjects(ctx, list, W, H, 'export')
    })
    return () => {
      cancelled = true
    }
  }, [visible, objects, width, pageW, pageH])

  return (
    <div style={{ width: '100%', aspectRatio: `${pageW} / ${pageH}`, position: 'relative' }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
      <canvas ref={overlayRef} data-testid="thumb-overlay" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  )
}
