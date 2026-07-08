import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  insertBlank,
  removePages,
  duplicatePages,
  rotatePages,
  movePages,
  nudgePages,
  appendDocument,
  addRotation,
  type PageRef
} from '../src/core/pages'

function mk(n: number): PageRef[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    docId: 'main',
    pageIndex: i,
    extraRotation: 0 as const
  }))
}

test('insertBlank: 지정 위치에 빈 페이지', () => {
  const out = insertBlank(mk(2), 1)
  assert.equal(out.length, 3)
  assert.equal(out[1].docId, 'blank')
  assert.ok(out[1].blankSize)
})

test('removePages: 마지막 한 장은 남긴다', () => {
  const pages = mk(2)
  const out = removePages(pages, new Set(['p0', 'p1']))
  assert.equal(out.length, 1)
  const out2 = removePages(pages, new Set(['p0']))
  assert.deepEqual(out2.map((p) => p.id), ['p1'])
})

test('duplicatePages: 바로 뒤에 복제 + 원본 매핑', () => {
  const { pages, cloneOf } = duplicatePages(mk(3), new Set(['p1']))
  assert.equal(pages.length, 4)
  assert.equal(pages[2].pageIndex, 1)
  assert.notEqual(pages[2].id, 'p1')
  assert.equal(cloneOf[pages[2].id], 'p1')
})

test('rotatePages: 90도 순환', () => {
  let pages = rotatePages(mk(1), new Set(['p0']), 90)
  assert.equal(pages[0].extraRotation, 90)
  pages = rotatePages(pages, new Set(['p0']), -90)
  assert.equal(pages[0].extraRotation, 0)
  assert.equal(addRotation(270, 90), 0)
  assert.equal(addRotation(0, -90), 270)
})

test('movePages: 묶음을 target 앞/뒤로', () => {
  const before = movePages(mk(4), new Set(['p3']), 'p0', 'before')
  assert.deepEqual(before.map((p) => p.id), ['p3', 'p0', 'p1', 'p2'])
  const after = movePages(mk(4), new Set(['p0', 'p1']), 'p3', 'after')
  assert.deepEqual(after.map((p) => p.id), ['p2', 'p3', 'p0', 'p1'])
})

test('nudgePages: 한 칸 이동, 경계에서 멈춤', () => {
  const fwd = nudgePages(mk(3), new Set(['p0']), 1)
  assert.deepEqual(fwd.map((p) => p.id), ['p1', 'p0', 'p2'])
  const stuck = nudgePages(mk(3), new Set(['p0']), -1)
  assert.deepEqual(stuck.map((p) => p.id), ['p0', 'p1', 'p2'])
})

test('appendDocument: 가져온 문서를 끝에 붙인다', () => {
  const out = appendDocument(mk(1), 'imported', 2)
  assert.equal(out.length, 3)
  assert.equal(out[1].docId, 'imported')
  assert.equal(out[2].pageIndex, 1)
})
