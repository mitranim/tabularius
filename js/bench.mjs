/*
Usage: add `import=js/bench.mjs` to URL query.
*/

import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as s from '../funs/schema.mjs'
import * as u from './util.mjs'
import * as p from './plot.mjs'

// Some tricky cases need a loop inside a benchmark to bench true.
const REPEAT_COUNT = 65_536

const plotAggInp = p.plotAggCliArgsDecode(``)
delete plotAggInp.src
const plotAggOpt = s.validPlotAggOpt(plotAggInp)

const sampleFact = {
  statType: `dmgDone`,
  statScope: `round`,
  entType: `runRoundBui`
}

const whereFields_compiled = u.whereFields(plotAggOpt.where)
const whereFields_interpreted = u.whereFields(plotAggOpt.where)

function whereFieldsInterpreted(src) {
  const funs = a.mapFlat(a.entries(src), whereFuns)

  return function whereFieldsInterpreted(tar) {
    for (const fun of funs) if (!fun(tar)) return false
    return true
  }
}

function whereFuns([key, vals]) {
  a.reqStructKey(key)
  const out = []
  for (const val of a.values(vals)) {
    out.push(function whereField(src) {return src?.[key] === val})
  }
  return out
}

// Indicates benchmark accuracy. Should be single digit nanoseconds, ideally 0.
t.bench(function bench_baseline() {})

// ≈20547 ns (Chrome 135).
t.bench(function bench_whereFields_compiled_static() {
  let ind = -1
  while (++ind < REPEAT_COUNT) whereFields_compiled(sampleFact)
})

// ≈20328 ns (Chrome 135).
t.bench(function bench_whereFields_interpreted_static() {
  let ind = -1
  while (++ind < REPEAT_COUNT) whereFields_interpreted(sampleFact)
})

// ≈312110 ns (Chrome 135).
t.bench(function bench_whereFields_compiled_dynamic() {
  const where = u.whereFields(plotAggOpt.where)
  let ind = -1
  while (++ind < REPEAT_COUNT) where(sampleFact)
})

/*
≈1197006 ns (Chrome 135). Around 4 times slower than the compiled version.
A curious case and the reason we "compile" our "where" function.
*/
t.bench(function bench_whereFields_interpreted_dynamic() {
  const where = whereFieldsInterpreted(plotAggOpt.where)
  let ind = -1
  while (++ind < REPEAT_COUNT) where(sampleFact)
})

console.log(`[bench] starting`)
t.deopt(), t.benches()
console.log(`[bench] done`)
