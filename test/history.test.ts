import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyHistory, push, undo, redo, MAX_HISTORY } from '../src/core/history'

test('undo/redo 왕복', () => {
  let state = 'A'
  let h = emptyHistory<string>()
  h = push(h, state)
  state = 'B'
  assert.equal(h.past.length, 1)
  const u = undo(h, state)!
  ;[state, h] = u
  assert.equal(state, 'A')
  assert.equal(h.future.length, 1)
  const r = redo(h, state)!
  ;[state, h] = r
  assert.equal(state, 'B')
})

test('push는 future를 버린다', () => {
  let h = emptyHistory<number>()
  h = push(h, 1)
  const [_, h2] = undo(h, 2)!
  h = push(h2, 1)
  assert.equal(h.future.length, 0)
})

test('히스토리 상한', () => {
  let h = emptyHistory<number>()
  for (let i = 0; i < MAX_HISTORY + 20; i++) h = push(h, i)
  assert.equal(h.past.length, MAX_HISTORY)
  // 가장 오래된 것부터 떨어지고 최신이 끝에 남는다
  assert.equal(h.past[0], 20)
  assert.equal(h.past[MAX_HISTORY - 1], MAX_HISTORY + 19)
})
