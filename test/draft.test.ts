import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectDraftDocs, bumpDocSeq, clampPage } from '../src/core/draft'
import type { PageRef } from '../src/core/pages'

const pg = (id: string, docId: string): PageRef => ({ id, docId, pageIndex: 0, extraRotation: 0 })

test('collectDraftDocs: 참조된 문서만, blank 제외, 중복 제거', () => {
  const a = new Uint8Array([1])
  const b = new Uint8Array([2])
  const out = collectDraftDocs([pg('1', 'doc-1'), pg('2', 'blank'), pg('3', 'doc-1'), pg('4', 'doc-3')], { 'doc-1': a, 'doc-2': new Uint8Array([9]), 'doc-3': b })
  assert.deepEqual(Object.keys(out).sort(), ['doc-1', 'doc-3'])
  assert.equal(out['doc-1'], a)
  assert.equal(out['doc-3'], b)
})

test('collectDraftDocs: 없는 docId 는 throw', () => {
  assert.throws(() => collectDraftDocs([pg('1', 'doc-7')], {}), /unknown doc doc-7/)
})

test('bumpDocSeq: 숫자 접미사 이상으로 올리고, 다른 형식은 유지', () => {
  assert.equal(bumpDocSeq(0, 'doc-5'), 5)
  assert.equal(bumpDocSeq(9, 'doc-5'), 9)
  assert.equal(bumpDocSeq(3, 'imported'), 3)
})

test('clampPage: 범위 안으로', () => {
  assert.equal(clampPage(-1, 3), 0)
  assert.equal(clampPage(7, 3), 2)
  assert.equal(clampPage(0, 0), 0)
})
