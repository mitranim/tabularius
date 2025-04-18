/*
Usage: add `import=js/test.mjs` to URL query.
*/

import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as s from '../funs/schema.mjs'
import * as u from './util.mjs'
import * as p from './plot.mjs'

/*
Tests for small utility functions should be placed here.
The app can be switched into test mode via the `test` command.
Alternatively, this can be imported via URL query param `import=js/test.mjs`.
*/

t.test(function test_encodeUpgrade() {
  function test(src, exp) {t.is(s.encodeUpgrades(src), exp)}

  test([], ``)
  test([{Index: 1}], `B`)
  test([{Index: 1}, {Index: 0}], `BA`)
  test([{Index: 1}, {Index: 0}, {Index: 1}], `BAB`)

  // We support degenerate cases all the way to Z.
  test([{Index: 2}, {Index: 3}, {Index: 4}], `CDE`)
})

t.test(function test_compareAsc() {
  t.is(u.compareAsc(), 0)

  t.is(u.compareAsc(`one`, `two`), -1) // Due to fallback on string sorting.
  t.is(u.compareAsc(`two`, `one`), 1) // Due to fallback on string sorting.
  t.is(u.compareAsc(`0`, `one`), -1)
  t.is(u.compareAsc(`one`, `0`), 1)

  t.is(u.compareAsc(`0`, `0`), 0)
  t.is(u.compareAsc(`0`, `1`), -1)
  t.is(u.compareAsc(`1`, `0`), 1)
  t.is(u.compareAsc(`1`, `1`), 0)

  t.is(u.compareAsc(`00`, `00`), 0)
  t.is(u.compareAsc(`00`, `01`), -1)
  t.is(u.compareAsc(`01`, `00`), 1)
  t.is(u.compareAsc(`01`, `01`), 0)

  t.is(u.compareAsc(`00`, `one`), -1)
  t.is(u.compareAsc(`01`, `one`), -1)

  t.is(u.compareAsc(`one`, `00`), 1)
  t.is(u.compareAsc(`one`, `01`), 1)
})

t.test(function test_compareDesc() {
  t.is(u.compareDesc(), 0)

  t.is(u.compareDesc(`one`, `two`), 1) // Due to fallback on string sorting.
  t.is(u.compareDesc(`two`, `one`), -1) // Due to fallback on string sorting.
  t.is(u.compareDesc(`0`, `one`), -1)
  t.is(u.compareDesc(`one`, `0`), 1)

  t.is(u.compareDesc(`0`, `0`), 0)
  t.is(u.compareDesc(`0`, `1`), 1)
  t.is(u.compareDesc(`1`, `0`), -1)
  t.is(u.compareDesc(`1`, `1`), 0)

  t.is(u.compareDesc(`00`, `00`), 0)
  t.is(u.compareDesc(`00`, `01`), 1)
  t.is(u.compareDesc(`01`, `00`), -1)
  t.is(u.compareDesc(`01`, `01`), 0)

  t.is(u.compareDesc(`00`, `one`), -1)
  t.is(u.compareDesc(`01`, `one`), -1)

  t.is(u.compareDesc(`one`, `00`), 1)
  t.is(u.compareDesc(`one`, `01`), 1)
})

t.test(function test_cmdPlotDecodeArgs() {
  function test(src, exp) {t.eq(p.cmdPlotDecodeArgs(src), exp)}
  function fail(src, msg) {t.throws(() => p.cmdPlotDecodeArgs(src), Error, msg)}

  test(``, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, where: {}, runLatest: true, userCurrent: true,
  })

  test(`plot`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, where: {}, runLatest: true, userCurrent: true,
  })

  fail(`plot -x=run`, `"-x" must be one of: ${a.show(a.keys(s.ALLOWED_X_KEYS))}`)
  fail(`plot -x=run`, `got: "run"`)

  fail(`plot -x=round`, `"-x" must be one of: ${a.show(a.keys(s.ALLOWED_X_KEYS))}`)
  fail(`plot -x=round`, `got: "round"`)

  fail(`plot -y=dmg`, `"-y" must be one of: ${a.show(a.keys(s.ALLOWED_Y_STAT_TYPES))}`)
  fail(`plot -y=dmg`, `got: "dmg"`)

  fail(`plot -z=upg`, `"-z" must be one of: ${a.show(a.keys(s.ALLOWED_Z_KEYS))}`)
  fail(`plot -z=upg`, `got: "upg"`)

  test(`plot -x=roundNum -y=dmgDone -z=buiTypeUpg`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, where: {},
    userCurrent: true, runLatest: true,
  })

  test(`plot -x=runNum -y=dmgOver -z=buiType`, {
    cloud: false, X: `runNum`, Y: `dmgOver`, Z: `buiType`, agg: `sum`, where: {},
    userCurrent: true, runLatest: true,
  })

  test(`plot -c`, {
    cloud: true, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, where: {},
    userCurrent: true, runLatest: true,
  })

  fail(`plot one=two`, `"plot filters" must be one of: ${a.show(a.keys(s.ALLOWED_FILTER_KEYS))}`)

  test(`plot userId=one`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: true,
    where: {userId: [`one`]},
  })

  test(`plot userId=current`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {},
  })

  test(`plot userId=one userId=current`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {userId: [`one`]},
  })

  test(`plot userId=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: true,
    where: {},
  })

  test(`plot userId=one userId=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: true,
    where: {userId: [`one`]},
  })

  test(`plot userId=one runId=two`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: false,
    where: {userId: [`one`], runId: [`two`]},
  })

  test(`plot userId=one runId=two runId=three`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: false,
    where: {userId: [`one`], runId: [`two`, `three`]},
  })

  test(`plot run=one`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {runId: [`one`]},
  })

  test(`plot runId=one`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {runId: [`one`]},
  })

  test(`plot run=12`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {runNum: [12]},
  })

  test(`plot run=0012`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {runNum: [12]},
  })

  test(`plot run=latest`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {},
  })

  test(`plot runId=latest`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {},
  })

  test(`plot runId=0001 runId=latest`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {runId: [`0001`]},
  })

  test(`plot run=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {},
  })

  test(`plot runId=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {},
  })

  test(`plot runNum=1`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {runNum: [1]},
  })

  test(`plot round=one`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {roundId: [`one`]},
  })

  test(`plot round=12`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {roundNum: [12]},
  })

  test(`plot round=0012`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {roundNum: [12]},
  })

  test(`plot -a=avg`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `avg`,
    userCurrent: true, runLatest: true,
    where: {},
  })

  fail(`plot -a=one`, `"-a" must be one of: ${a.show(a.keys(s.AGGS))}`)
  fail(`plot -a=one`, `got: "one"`)

  fail(`plot -w`, `"plot filters" must be one of: ${a.show(a.keys(s.ALLOWED_FILTER_KEYS))}`)
  fail(`plot -w`, `got: "-w"`)

  fail(`plot one`, `plot args must be one of: "-flag", "-flag=val", or "field=val", got "one"`)

  test(`plot buiType=Mirador`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {buiType: [`CB15`]},
  })

  test(`plot buiTypeUpg=Mirador`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {buiTypeUpg: [`CB15`]},
  })

  test(`plot buiTypeUpg=Mirador_AAA`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {buiTypeUpg: [`CB15_AAA`]},
  })

  {
    const inp = p.cmdPlotDecodeArgs()
    delete inp.cloud
    s.validPlotAggOpt(inp)
  }
})

t.test(function test_stripPreSpaced() {
  function test(src, pre, exp) {t.is(u.stripPreSpaced(src, pre), exp)}
  test(``, ``, ``)
  test(`one`, ``, `one`)
  test(``, `one`, ``)
  test(`one two`, `one`, `two`)
  test(`one one two`, `one`, `one two`)
  test(`two one`, `one`, `two one`)
  test(`oneone`, `one`, `oneone`)
  test(`onetwo`, `one`, `onetwo`)
})

// TODO test generic XYZ aggregation; see `schema.mjs`.
//
// t.test(function test_agg() {
//   const src = a.times(8, ind => [
//     {bui: `bui_0`, round: ind, type: `dmg`, val: ind * 10},
//     {bui: `bui_1`, round: ind, type: `dmg`, val: ind * 20},
//     {bui: `bui_2`, round: ind, type: `dmg`, val: ind * 30},
//   ]).flat()
//   console.log(`src:`, src)
// })

const msg = `[test] ok`
u.log.info(msg)
console.log(msg)
