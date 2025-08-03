import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as u from './util.mjs'

const HEX_SRC = `11972057b6874dd8b2b6d54aedf50d3a4abd1dc13dbd4175a59a3dcf1705cd5c68024451740648739a8480283b0c9b88`

function hexStr_to_byteArrSlower(src) {
  a.reqStr(src)
  const out = new Uint8Array(src.length / 2)
  for (let ind = 0; ind < src.length; ind += 2) {
    out[ind / 2] = parseInt(src.slice(ind, ind + 2), 16)
  }
  return out
}

t.bench(function bench_hexStr_to_byteArr() {
  u.hexStr_to_byteArr(HEX_SRC)
})

t.bench(function bench_hexStr_to_byteArrSlower() {
  hexStr_to_byteArrSlower(HEX_SRC)
})

await import(`../shared/bench.mjs`)

if (import.meta.main) {
  console.log(`[bench] starting`)
  t.deopt()
  t.benches()
  console.log(`[bench] done`)
}
