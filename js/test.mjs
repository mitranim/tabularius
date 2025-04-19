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

t.test(function test_plotDecodeCliArgs() {
  function test(src, exp) {t.eq(p.plotDecodeCliArgs(src), exp)}
  function fail(src, exp) {t.throws(() => p.plotDecodeCliArgs(src), Error, exp)}

  fail(
    `plot one`,
    `plot args must be one of: "-flag", "-flag=val", or "field=val", got "one"`,
  )

  fail(
    `plot one=`,
    `plot filters must be among: ${withEqs(a.keys(s.ALLOWED_FILTER_KEYS))}, got: one=`,
  )

  fail(
    `plot one=two`,
    `plot filters must be among: ${withEqs(a.keys(s.ALLOWED_FILTER_KEYS))}, got: one=`,
  )

  fail(
    `plot -w`,
    `plot filters must be among: ${withEqs(a.keys(s.ALLOWED_FILTER_KEYS))}, got: -w=`,
  )

  fail(
    `plot -w=`,
    `plot filters must be among: ${withEqs(a.keys(s.ALLOWED_FILTER_KEYS))}, got: -w=`,
  )

  fail(
    `plot -w=one`,
    `plot filters must be among: ${withEqs(a.keys(s.ALLOWED_FILTER_KEYS))}, got: -w=`,
  )

  test(``, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    runLatest: true, userCurrent: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    runLatest: true, userCurrent: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot -c`, {
    cloud: true, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot -c=false`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  fail(`plot -x=run`, `must be one of:`)
  fail(`plot -x=run`, `got: -x=run`)

  fail(`plot -x=round`, `"-x" must be one of:`)
  fail(`plot -x=round`, `got: -x=round`)

  fail(`plot -y=dmg`, `"-y" must be one of:`)
  fail(`plot -y=dmg`, `got: -y=dmg`)

  fail(`plot -z=upg`, `"-z" must be one of:`)
  fail(`plot -z=upg`, `got: -z=upg`)

  fail(`plot -a=one`, `"-a" must be one of:`)
  fail(`plot -a=one`, `got: -a=one`)

  test(`plot -a=avg`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `avg`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot -x=roundNum -y=dmgDone -z=buiTypeUpg`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot -x=runNum -y=dmgOver -z=buiType`, {
    cloud: false, X: `runNum`, Y: `dmgOver`, Z: `buiType`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot userId=one`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], userId: [`one`]},
  })

  test(`plot userId=current`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot userId=one userId=current`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], userId: [`one`]},
  })

  test(`plot userId=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot userId=one userId=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], userId: [`one`]},
  })

  test(`plot userId=one runId=two`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI], userId: [`one`], runId: [`two`]},
  })

  test(`plot userId=one runId=two runId=three`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: false, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI], userId: [`one`], runId: [`two`, `three`]},
  })

  test(`plot -z=userId`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `userId`, agg: `sum`,
    userCurrent: false, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot -z=userId userId=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `userId`, agg: `sum`,
    userCurrent: false, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot -z=userId userId=current`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `userId`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot -z=userId runId=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `userId`, agg: `sum`,
    userCurrent: false, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot runId=one`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI], runId: [`one`]},
  })

  test(`plot runId=latest`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot runId=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot runId=12 runId=latest`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], runId: [`12`]},
  })

  test(`plot runId=0012 runId=latest`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], runId: [`0012`]},
  })

  test(`plot -z=runId`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `runId`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot -z=runId runId=all`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `runId`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot -z=runId runId=latest`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `runId`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot runNum=12`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI], runNum: [12]},
  })

  test(`plot runNum=0012`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI], runNum: [12]},
  })

  test(`plot -z=runNum`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `runNum`, agg: `sum`,
    userCurrent: true, runLatest: false,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot roundId=12`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], roundId: [`12`]},
  })

  test(`plot roundId=0012`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], roundId: [`0012`]},
  })

  test(`plot roundNum=12`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], roundNum: [12]},
  })

  test(`plot roundNum=0012`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], roundNum: [12]},
  })

  test(`plot buiType=Mirador`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], buiType: [`CB15`]},
  })

  test(`plot buiTypeUpg=Mirador`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], buiTypeUpg: [`CB15`]},
  })

  test(`plot buiTypeUpg=Mirador_AAA`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], buiTypeUpg: [`CB15_AAA`]},
  })

  test(`plot hero=Anysia`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], hero: [`F1H01`]},
  })

  test(`plot diff=5`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], diff: [5]},
  })

  test(`plot frontierDiff=18`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI], frontierDiff: [18]},
  })

  test(`plot entType=${s.FACT_ENT_TYPE_BUI}`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_BUI]},
  })

  test(`plot entType=${s.FACT_ENT_TYPE_CHI}`, {
    cloud: false, X: `roundNum`, Y: `dmgDone`, Z: `buiTypeUpg`, agg: `sum`,
    userCurrent: true, runLatest: true,
    where: {entType: [s.FACT_ENT_TYPE_CHI]},
  })

  fail(
    `plot entType=${s.FACT_ENT_TYPE_BUI} entType=${s.FACT_ENT_TYPE_CHI}`,
    `only one entType= is allowed, unless -z=entType`,
  )

  {
    const inp = p.plotDecodeCliArgs()
    delete inp.cloud
    s.validPlotAggOpt(inp)
  }
})

function withEqs(src) {return a.map(src, withEq).join(` `)}
function withEq(src) {return a.reqValidStr(src) + `=`}

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
