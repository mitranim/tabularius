/*
Usage: add `import=js/bench.mjs` to URL query.
*/

import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as s from '../shared/schema.mjs'
import * as u from './util.mjs'
import * as p from './plot.mjs'

// Some tricky cases need a loop inside a benchmark to bench true.
const REPEAT_COUNT = 65_536

const plotAggOpt = p.plotArgsToAggOpt(`-p=dmg`)

const sampleFact = {
  ent_type: s.FACT_ENT_TYPE_BUI,
  stat_type: s.STAT_TYPE_DMG_DONE,
  stat_val: 1.234,
}

const whereFields_compiled = u.whereFields(plotAggOpt.where)
const whereFields_interpreted = u.whereFields(plotAggOpt.where)

function whereFieldsInterpreted(src) {
  const groups = a.mapCompact(a.entries(src), whereGroup)
  if (!groups.length) return undefined

  return function whereFieldsInterpreted(tar) {
    outer:
    for (const group of groups) {
      for (const [key, val] of group) {
        if (tar?.[key] === val) continue outer
      }
      return false
    }
    return true
  }
}

function whereGroup([key, vals]) {
  a.reqStructKey(key)
  return a.vac(a.map(vals, val => [key, val]))
}

// Indicates benchmark accuracy. Should be single digit nanoseconds, ideally 0.
t.bench(function bench_baseline() {})

// ≈20µs (Chrome 135).
t.bench(function bench_whereFields_compiled_static() {
  let ind = -1
  while (++ind < REPEAT_COUNT) whereFields_compiled(sampleFact)
})

// ≈20µs (Chrome 135).
t.bench(function bench_whereFields_interpreted_static() {
  let ind = -1
  while (++ind < REPEAT_COUNT) whereFields_interpreted(sampleFact)
})

/*
≈290-310µs (Chrome 135).

Curious performance note. We compared inlining the filter values, vs defining
arguments and passing the filter values as arguments when evaluating the
function. The version with arguments clocked at around ≈1.3ms, still better
than the non-compiled version, but horrible compared to the version with
inlined filter values.
*/
t.bench(function bench_whereFields_compiled_dynamic() {
  const where = u.whereFields(plotAggOpt.where)
  let ind = -1
  while (++ind < REPEAT_COUNT) where(sampleFact)
})

/*
≈2.2ms (Chrome 135).

An earlier result had ≈1.2ms (Chrome 135).

Much slower than the compiled version.

A curious case and the reason we compile a function from filters,
instead of interpreting the filters.
*/
t.bench(function bench_whereFields_interpreted_dynamic() {
  const where = whereFieldsInterpreted(plotAggOpt.where)
  let ind = -1
  while (++ind < REPEAT_COUNT) where(sampleFact)
})

await import(`../shared/bench.mjs`)
console.log(`[bench] starting`)
t.deopt(), t.benches()
console.log(`[bench] done`)
