import { useRef } from 'react'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { IMAGE_ACCEPT } from '@renderer/pdf/imageToPdf'

/**
 * PDF/이미지 → 페이지 가져오기 (사이드바 ⊕ 메뉴와 Manage Pages 공용).
 * openPdf/openImages(index) 로 숨은 <input> 을 열고, 선택되면 그 index 에 삽입한다 (index 없음 = 문서 끝).
 * 반환한 inputs 를 트리 어딘가에 한 번 렌더해야 한다.
 */
export function usePageImport(): { inputs: JSX.Element; openPdf: (index?: number) => void; openImages: (index?: number) => void } {
  const t = useT()
  const pageImport = useEditor((s) => s.pageImport)
  const pageImportImages = useEditor((s) => s.pageImportImages)
  const setNotice = useEditor((s) => s.setNotice)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const insertAtRef = useRef<number | undefined>(undefined)

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    await pageImport(bytes, insertAtRef.current)
  }

  /** 이미지 여러 장 → 각각 1페이지로 삽입 (한 번의 undo 단위) */
  async function onImportImages(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    try {
      await pageImportImages(files, insertAtRef.current)
      setNotice({ msg: t('imagePagesAdded'), severity: 'success' })
    } catch {
      setNotice({ msg: t('imageImportFailed'), severity: 'error' })
    }
  }

  return {
    openPdf: (index) => {
      insertAtRef.current = index
      fileRef.current?.click()
    },
    openImages: (index) => {
      insertAtRef.current = index
      imageRef.current?.click()
    },
    inputs: (
      <>
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => void onImportFile(e)} />
        <input ref={imageRef} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={(e) => void onImportImages(e)} />
      </>
    )
  }
}
