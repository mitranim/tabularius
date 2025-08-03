import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as u from './util.mjs'

function binStr_to_byteArr_from(src) {
  return Uint8Array.from(a.reqStr(src), charCode0)
}

function charCode0(val) {return val.charCodeAt(0)}

function binStr_to_byteArr_loop(src) {
  a.reqStr(src)
  const len = src.length
  const out = new Uint8Array(len)
  let ind = -1
  while (++ind < len) out[ind] = src.charCodeAt(ind)
  return out
}

const byteArr = u.binStr_to_byteArr(`one two three`)

t.eq(binStr_to_byteArr_from(`one`), binStr_to_byteArr_loop(`one`))
t.notEq(binStr_to_byteArr_from(`one`), binStr_to_byteArr_loop(`two`))

t.bench(function bench_binStr_to_byteArr() {
  u.binStr_to_byteArr(`one two three`)
})

t.bench(function bench_binStr_to_byteArr_from() {
  binStr_to_byteArr_from(`one two three`)
})

t.bench(function bench_binStr_to_byteArr_loop() {
  binStr_to_byteArr_loop(`one two three`)
})

t.bench(function bench_byteArr_to_binStr() {
  u.byteArr_to_binStr(byteArr)
})

if (import.meta?.main) {
  console.log(`[bench] starting`)
  t.deopt()
  t.benches()
  console.log(`[bench] done`)
}
