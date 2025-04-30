/*
Usage: add `import=js/test.mjs` to URL query.
*/

import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as s from '../shared/schema.mjs'
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

t.test(function test_decodePlotAggOpt_validPlotAggOpt() {
  function test(src, decoded, valid) {
    const out = p.decodePlotAggOpt(src)

    t.eq(out, decoded, `decoded CLI opts`)

    t.eq(s.validPlotAggOpt(decoded), valid, `validated structured opts`)

    // Motive: we sometimes validate opts on the client and then pass them to
    // the server.
    t.eq(
      s.validPlotAggOpt(s.validPlotAggOpt(decoded)),
      valid,
      `re-validation of structured opts must be idempotent`,
    )
  }

  function fail(src, exp) {
    t.throws(() => s.validPlotAggOpt(p.decodePlotAggOpt(src)), Error, exp)
  }

  fail(
    ``,
    `opt "-x" must be a valid identifier, got undefined; opt "-z" must be a valid identifier, got undefined; opt "-y" must be a valid identifier unless "-z=stat_type", got undefined; opt "-a" must be a valid aggregate name`,
  )

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

  fail(`plot -x=run`, `"-x" must be one of:`)
  fail(`plot -x=run`, `got: -x=run`)

  fail(`plot -x=round`, `"-x" must be one of:`)
  fail(`plot -x=round`, `got: -x=round`)

  fail(`plot -y=dmg`, `"-y" must be one of:`)
  fail(`plot -y=dmg`, `got: -y=dmg`)

  fail(`plot -z=upg`, `"-z" must be one of:`)
  fail(`plot -z=upg`, `got: -z=upg`)

  fail(`plot -a=one`, `"-a" must be one of:`)
  fail(`plot -a=one`, `got: -a=one`)

  fail(
    `-x=round_num -y=dmg_done -z=bui_type_upg`,
    `opt "-a" must be a valid aggregate name; missing "ent_type=" (required unless "-z=ent_type")`,
  )

  fail(
    `plot -x=round_num -y=dmg_done -z=bui_type_upg -a=sum`,
    `missing "ent_type=" (required unless "-z=ent_type")`,
  )

  test(
    `-p=dmg`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg -c=false`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      cloud: false,
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      cloud: false,
    },
  )

  test(
    `-p=dmg -c`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      cloud: true,
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      cloud: true,
    },
  )

  test(
    `-p=dmg -a=avg`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `avg`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `avg`, aggFun: u.accAvg, totalFun: u.accAvg,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  /*
  This test verifies that visible args override invisible args coming
  from a preset.
  */
  test(
    `-p=dmg ent_type=run_round_bui_chi`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui_chi`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui_chi`], stat_type: [`dmg_done`]},
    },
  )

  fail(
    `-p=dmg ent_type=run_round_bui ent_type=run_round_bui`,
    `exactly one "ent_type=" is required unless "-z=ent_type", got "ent_type=run_round_bui ent_type=run_round_bui"`,
  )

  fail(
    `-p=dmg ent_type=run_round_bui ent_type=run_round_bui_chi`,
    `exactly one "ent_type=" is required unless "-z=ent_type", got "ent_type=run_round_bui ent_type=run_round_bui_chi"`,
  )

  test(
    `plot -x=run_num -y=dmg_over -z=bui_type -a=sum ent_type=run_round_bui_chi`,
    {
      X: `run_num`, Y: `dmg_over`, Z: `bui_type`,
      agg: `sum`,
      where: {ent_type: [`run_round_bui_chi`]},
    },
    {
      X: `run_num`, Y: `dmg_over`, Z: `bui_type`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      where: {ent_type: [`run_round_bui_chi`], stat_type: [`dmg_over`]},
    },
  )

  test(
    `-p=dmg user_id=one`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      runLatest: true,
      where: {ent_type: [`run_round_bui`], user_id: [`one`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        user_id: [`one`],
      },
    },
  )

  test(
    `plot -x=round_num -y=dmg_done -z=bui_type_upg -a=sum ent_type=run_round_bui user_id=current`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg user_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg user_id=all run_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: false, runLatest: false,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: false,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg user_id=one user_id=current`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], user_id: [`one`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        user_id: [`one`],
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
      },
    },
  )

  test(
    `-p=dmg user_id=one user_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], user_id: [`one`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: true,
      where: {
        user_id: [`one`],
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
      },
    },
  )

  test(
    `-p=dmg user_id=one run_id=two`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      where: {
        ent_type: [`run_round_bui`],
        user_id: [`one`],
        run_id: [`two`],
      },
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        user_id: [`one`],
        run_id: [`two`],
      },
    },
  )

  test(
    `-p=dmg user_id=one run_id=two run_id=three`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      where: {
        ent_type: [`run_round_bui`],
        user_id: [`one`],
        run_id: [`two`, `three`],
      },
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        user_id: [`one`],
        run_id: [`two`, `three`],
      },
    },
  )

  test(
    `-p=dmg -z=user_id`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg -z=user_id user_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg -z=user_id user_id=current`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg -z=user_id run_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg -z=user_id user_id=all run_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: false, runLatest: false,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: false,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg user_id=all run_id=latest`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg run_id=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true,
      where: {ent_type: [`run_round_bui`], run_id: [`12`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        run_id: [`12`],
      },
    },
  )

  test(
    `-p=dmg run_id=all run_id=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`], run_id: [`12`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: false,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        run_id: [`12`],
      },
    },
  )

  test(
    `-p=dmg user_id=all user_id=one`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], user_id: [`one`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        user_id: [`one`],
      },
    },
  )

  test(
    `-x=round_num -y=dmg_done -z=bui_type_upg -a=sum ent_type=run_round_bui run_id=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      where: {ent_type: [`run_round_bui`], run_id: [`12`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        run_id: [`12`],
      },
    },
  )

  test(
    `-p=dmg -z=run_id`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_id`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg -z=run_id run_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_id`,
      agg: `sum`,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  /*
  We used to have implicit disabling, where `run_num=` would disable the default
  `run_id=latest`. But it was mind-blowing to maintain. When filtering by
  `run_num`, the user should either specify `run_id=all`, or splurge a preset
  inline, and remove `run_id=latest`.
  */
  test(
    `-p=dmg run_num=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], run_num: [12]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        run_num: [12],
      },
    },
  )

  test(
    `-p=dmg run_num=0012`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], run_num: [12]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        run_num: [12],
      },
    },
  )

  test(
    `-p=dmg -z=run_num`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_num`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_num`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-p=dmg round_id=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], round_id: [`12`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        round_id: [`12`],
      },
    },
  )

  test(
    `-p=dmg round_id=0012`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], round_id: [`0012`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        round_id: [`0012`],
      },
    },
  )

  test(
    `-p=dmg round_num=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], round_num: [12]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        round_num: [12],
      },
    },
  )

  test(
    `-p=dmg round_num=0012`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], round_num: [12]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        round_num: [12],
      },
    },
  )

  test(
    `-p=dmg bui_type=Mirador`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], bui_type: [`CB15`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        bui_type: [`CB15`],
      },
    },
  )

  test(
    `-p=dmg bui_type_upg=Mirador`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], bui_type_upg: [`CB15`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        bui_type_upg: [`CB15`],
      },
    },
  )

  test(
    `-p=dmg bui_type_upg=Mirador_AAA`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], bui_type_upg: [`CB15_AAA`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        bui_type_upg: [`CB15_AAA`],
      },
    },
  )

  test(
    `-p=dmg hero=Anysia`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], hero: [`F1H01`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        hero: [`F1H01`],
      },
    },
  )

  test(
    `-p=dmg diff=5`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], diff: [5]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        diff: [5],
      },
    },
  )

  test(
    `-p=dmg frontier_diff=18`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], frontier_diff: [18]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        frontier_diff: [18],
      },
    },
  )

  test(
    `-x=round_num -y=dmg_done -z=bui_type_upg -a=sum ent_type=run_round_bui_chi`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      where: {ent_type: [`run_round_bui_chi`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      where: {ent_type: [`run_round_bui_chi`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-x=round_num -y=dmg_done -z=ent_type -a=sum ent_type=run_round_bui_chi`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `ent_type`,
      agg: `sum`,
      where: {ent_type: [`run_round_bui_chi`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `ent_type`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      where: {ent_type: [`run_round_bui_chi`], stat_type: [`dmg_done`]},
    },
  )

  test(
    `-x=round_num -y=dmg_done -z=ent_type -a=sum ent_type=run_round_bui ent_type=run_round_bui_chi`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `ent_type`,
      agg: `sum`,
      where: {ent_type: [`run_round_bui`, `run_round_bui_chi`]},
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `ent_type`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      where: {ent_type: [`run_round_bui`, `run_round_bui_chi`], stat_type: [`dmg_done`]},
    },
  )
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

t.test(function test_legendDisplay() {
  function test(src, exp) {
    const out = p.legendDisplay(src)
    t.is(out, exp)
  }

  test(
    `edcbcb24533b40a0b50b1bb02a8fd399_e28739dc15b941268787b241805a9247_47a3ede7179844cf89bd59d0a5ef422e`,
    `edcbcb24533b40a0…9bd59d0a5ef422e`,
  )

  test(
    `93938a24661743e89604ff8cd930c479_cfac75910a1449719bf91d4c10ce3473`,
    `93938a24661743e8…bf91d4c10ce3473`,
  )

  test(
    `ca7c02bdd9324f0599a4b2e8f1940f13`,
    `ca7c02bdd9324f0599a4b2e8f1940f13`,
  )

  test(
    `3ff8707299374189`,
    `3ff8707299374189`,
  )
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

await import(`../shared/test.mjs`)
const msg = `[test] ok`
u.log.info(msg)
console.log(msg)
