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

t.test(function test_plotAggCliArgsDecode() {
  function test(src, exp) {t.eq(p.plotAggCliArgsDecode(src), exp)}
  function fail(src, msg) {t.throws(() => p.plotAggCliArgsDecode(src), Error, msg)}

  test(``, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, where: {}, runLatest: false, userCurrent: false,
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
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, where: {}, runLatest: false, userCurrent: false,
  })

  test(`plot -x=runNum -y=dmgOver -z=buiType`, {
    src: `local`, X: `runNum`, Y: `dmgOver`, Z: `buiType`, agg: `sum`, where: {}, runLatest: false, userCurrent: false,
  })

  test(`plot -s=local`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, where: {}, runLatest: false, userCurrent: false,
  })

  test(`plot -s=cloud`, {
    src: `cloud`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, where: {}, runLatest: false, userCurrent: false,
  })

  fail(`plot one=two`, `"plot filters" must be one of: ${a.show(a.keys(s.ALLOWED_FILTER_KEYS))}`)

  test(`plot userId=one`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false,
    userCurrent: false,
    where: {userId: [`one`]},
  })

  test(`plot userId=current`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false,
    userCurrent: true,
    where: {},
  })

  test(`plot userId=one userId=current`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false,
    userCurrent: true,
    where: {userId: [`one`]},
  })

  test(`plot userId=one runId=two`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false, userCurrent: false,
    where: {userId: [`one`], runId: [`two`]},
  })

  test(`plot userId=one runId=two runId=three`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false, userCurrent: false,
    where: {userId: [`one`], runId: [`two`, `three`]},
  })

  test(`plot run=one`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false, userCurrent: false,
    where: {runId: [`one`]},
  })

  test(`plot runId=one`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false, userCurrent: false,
    where: {runId: [`one`]},
  })

  test(`plot run=12`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false, userCurrent: false,
    where: {runNum: [12]},
  })

  test(`plot run=0012`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false, userCurrent: false,
    where: {runNum: [12]},
  })

  test(`plot run=latest`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: true, userCurrent: false,
    where: {},
  })

  test(`plot runId=latest`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: true, userCurrent: false,
    where: {},
  })

  test(`plot round=one`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false, userCurrent: false,
    where: {roundId: [`one`]},
  })

  test(`plot round=12`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false, userCurrent: false,
    where: {roundNum: [12]},
  })

  test(`plot round=0012`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`, runLatest: false, userCurrent: false,
    where: {roundNum: [12]},
  })

  test(`plot -a=avg`, {
    src: `local`, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `avg`, where: {}, runLatest: false, userCurrent: false,
  })

  fail(`plot -a=one`, `"-a" must be one of: ${a.show(a.keys(s.AGGS))}`)
  fail(`plot -a=one`, `got: "one"`)

  fail(`plot -w`, `"plot filters" must be one of: ${a.show(a.keys(s.ALLOWED_FILTER_KEYS))}`)
  fail(`plot -w`, `got: "-w"`)

  fail(`plot one`, `plot args must be one of: "-flag", "-flag=val", or "field=val", got "one"`)

  {
    const inp = p.plotAggCliArgsDecode(``)
    delete inp.src
    s.validPlotAggOpt(inp)
  }
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
