/*
Usage: add `import=client/test.mjs` to URL query.
*/

import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as s from '../shared/schema.mjs'
import * as u from './util.mjs'
import * as ui from './ui.mjs'
import * as p from './plot.mjs'

const tar = window.tabularius ??= a.Emp()
tar.lib ??= a.Emp()
tar.lib.t = t
a.patch(window, tar)

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
    `errors in plot:

missing -x, consider using a preset such as -p=dmg

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot one`,
    `errors in plot one:

unrecognized one, plot args must be in one of the following forms: "-flag", "-flag=val", or "field=val", see help plot for available options

missing -x, consider using a preset such as -p=dmg

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot one=`,
    `errors in plot one=:

unrecognized filter one=, filters must be among:
${filterLines(a.keys(s.ALLOWED_FILTER_KEYS))}

missing -x, consider using a preset such as -p=dmg

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot one=two`,
    `errors in plot one=two:

unrecognized filter one=two, filters must be among:
${filterLines(a.keys(s.ALLOWED_FILTER_KEYS))}

missing -x, consider using a preset such as -p=dmg

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot -w`,
    `errors in plot -w:

unrecognized flag -w

missing -x, consider using a preset such as -p=dmg

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot -w=`,
    `errors in plot -w=:

unrecognized flag -w=

missing -x, consider using a preset such as -p=dmg

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot -w=one`,
    `errors in plot -w=one:

unrecognized flag -w=one

missing -x, consider using a preset such as -p=dmg

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot -x=run`,
    `errors in plot -x=run:

unrecognized -x=run, must be one of:
${flagLines(`-x`, a.keys(s.ALLOWED_X_KEYS))}

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot -x=round`,
    `errors in plot -x=round:

unrecognized -x=round, must be one of:
${flagLines(`-x`, a.keys(s.ALLOWED_X_KEYS))}

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot -y=dmg`,
    `errors in plot -y=dmg:

unrecognized -y=dmg, must be one of:
${flagLines(`-y`, a.keys(s.ALLOWED_TOTAL_TYPE_FILTERS))}

missing -x, consider using a preset such as -p=dmg

missing -z, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot -z=upg`,
    `errors in plot -z=upg:

unrecognized -z=upg, must be one of:
${flagLines(`-z`, a.keys(s.ALLOWED_Z_KEYS))}

missing -x, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg

missing -a, consider using a preset such as -p=dmg`,
  )

  fail(
    `plot -a=one`,
    `errors in plot -a=one:

unrecognized -a=one, must be one of:
${flagLines(`-a`, a.keys(s.AGGS))}

missing -x, consider using a preset such as -p=dmg

missing -z, consider using a preset such as -p=dmg

missing -y, consider using a preset such as -p=dmg`,
  )

  fail(
    `-x=round_num -y=dmg_done -z=bui_type_upg`,
    `errors in plot -x=round_num -y=dmg_done -z=bui_type_upg:

missing -a, consider using a preset such as -p=dmg`,
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
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
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
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      cloud: false,
      totals: [],
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
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      cloud: true,
      totals: [],
    },
  )

  test(
    `-p=dmg -a=avg`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `avg`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `avg`, aggFun: u.accAvg, totalFun: u.accAvg,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
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
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui_chi`], stat_type: [`dmg_done`]},
      totals: [],
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
      totals: [],
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
      totals: [],
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
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg user_id=all run_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: false, runLatest: false,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: false,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg user_id=one user_id=current`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], user_id: [`one`]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg user_id=one user_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], user_id: [`one`]},
      totals: [],
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
      totals: [],
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
      totals: [],
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
      totals: [],
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
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg -z=user_id`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg -z=user_id user_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg -z=user_id user_id=current`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg -z=user_id run_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg -z=user_id user_id=all run_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`,
      userCurrent: false, runLatest: false,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `user_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: false,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg user_id=all run_id=latest`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg run_id=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true,
      where: {ent_type: [`run_round_bui`], run_id: [`12`]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg run_id=all run_id=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`], run_id: [`12`]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg user_id=all user_id=one`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: false, runLatest: true,
      where: {ent_type: [`run_round_bui`], user_id: [`one`]},
      totals: [],
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
      totals: [],
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
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg -z=run_id run_id=all`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_id`,
      agg: `sum`,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_id`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: false,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
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
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg run_num=0012`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], run_num: [12]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg -z=run_num`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_num`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `run_num`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg round_id=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], round_id: [`12`]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg round_id=0012`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], round_id: [`0012`]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg round_num=12`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], round_num: [12]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg round_num=0012`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], round_num: [12]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg bui_type=Mirador`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], bui_type: [`CB15`]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg bui_type_upg=Mirador`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], bui_type_upg: [`CB15`]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg bui_type_upg=Mirador_AAA`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], bui_type_upg: [`CB15_AAA`]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg hero=Anysia`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], hero: [`F1H01`]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg diff=5`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], diff: [5]},
      totals: [],
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
      totals: [],
    },
  )

  test(
    `-p=dmg frontier=18`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], frontier: [18]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {
        ent_type: [`run_round_bui`],
        stat_type: [`dmg_done`],
        frontier: [18],
      },
      totals: [],
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

  fail(
    `-p=dmg -t=one`,
    `errors in plot -p=dmg -t=one:

unrecognized -t=one, must be one of:
${flagLines(`-t`, a.keys(s.SUPPORTED_TOTAL_KEYS))}`,
  )

  test(
    `-p=dmg -t=`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      totals: [],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [],
    },
  )

  test(
    `-p=dmg -t=bui_type`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      totals: [`bui_type`],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [`bui_type`],
    },
  )

  test(
    `-p=dmg -t=bui_type -t=bui_type_upg`,
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`]},
      totals: [`bui_type`, `bui_type_upg`],
    },
    {
      X: `round_num`, Y: `dmg_done`, Z: `bui_type_upg`,
      agg: `sum`, aggFun: u.accSum, totalFun: u.accSum,
      userCurrent: true, runLatest: true,
      where: {ent_type: [`run_round_bui`], stat_type: [`dmg_done`]},
      totals: [`bui_type`, `bui_type_upg`],
    },
  )
})

function filterLines(keys) {
  return a.joinLines(a.map(keys, appendEq).map(u.indent))
}

function flagLines(key, vals) {
  a.reqValidStr(key)
  return a.joinLines(a.map(vals, val => u.cliEq(key, val)).map(u.indent))
}

function appendEq(src) {return a.reqValidStr(src) + `=`}

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

t.test(function test_codedToNamed() {
  function test(key, src, exp) {
    const out = s.codedToNamed(key, src)
    t.is(out, exp)
  }

  test(`any`, `3ff8707299374189`, `3ff8707299374189`)
  test(`any`, `CB01`, `CB01`)
  test(`any`, `CB01_ABA`, `CB01_ABA`)

  test(`bui_type`, `23c410a2e505496a`, `23c410a2e505496a`)
  test(`bui_type`, `CB01`, `Bunker`)

  test(`bui_type_upg`, `9021b77f5da047af`, `9021b77f5da047af`)
  test(`bui_type_upg`, `CB01_ABA`, `Bunker_ABA`)
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
ui.LOG.info(msg)
console.log(msg)
