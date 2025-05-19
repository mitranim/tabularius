import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import Plot from 'uplot'
import * as gc from '../shared/game_const.mjs'
import * as s from '../shared/schema.mjs'
import {E} from './util.mjs'
import * as u from './util.mjs'
import * as ui from './ui.mjs'
import * as fs from './fs.mjs'
import * as d from './dat.mjs'
import * as au from './auth.mjs'

import * as self from './plot.mjs'
const tar = window.tabularius ??= a.Emp()
tar.p = self
tar.gc = gc
tar.s = s
a.patch(window, tar)

cmdPlot.cmd = `plot`
cmdPlot.desc = `analyze data, visualizing with a plot 📈📉`

// TODO: use `<details>` to collapse sections.
cmdPlot.help = function cmdPlotHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdPlot.desc),
    `build your query by clicking the buttons below!`,

    [
      BtnAppend(`-c`),
      ` -- use cloud data; the default without "-c" is to use local data, which`,
      ` requires granting access to the history directory via `,
      os.BtnCmdWithHelp(fs.HISTORY_DIR_CONF.cmd),
      `; also see `, BtnAppend(`-f`), ` for fetching specific files`,
    ],

    u.LogLines(
      [BtnAppend(`-p`), ` -- preset; supported values:`],
      u.LogParagraphs(
        ...a.map(a.entries(PLOT_PRESETS), Help_preset).map(u.indentNode),
      ),
    ),

    u.LogLines(
      [
        BtnAppend(`-x`),
        ` -- X axis (progress); supported values:`,
      ],
      ...FlagAppendBtns(a.keys(s.ALLOWED_X_KEYS), `-x`).map(u.indentNode),
    ),

    u.LogLines(
      [
        BtnAppend(`-y`),
        ` -- Y axis (stat type); supported values:`,
      ],
      ...FlagAppendBtns(a.keys(s.ALLOWED_TOTAL_TYPE_FILTERS), `-y`).map(u.indentNode),
    ),

    u.LogLines(
      [
        BtnAppend(`-z`),
        ` -- Z axis (plot series); supported values:`,
      ],
      ...a.map(a.keys(s.ALLOWED_Z_KEYS), Help_Z).map(u.indentNode),
    ),

    u.LogLines(
      [
        BtnAppend(`-a`),
        ` -- aggregation mode; supported values:`,
      ],
      ...FlagAppendBtns(a.keys(s.AGGS), `-a`).map(u.indentNode),
    ),

    u.LogLines(
      [
        BtnAppend(`-t`),
        ` -- print totals from the aggregated data; usage:`,
      ],
      [`  -t`, `                      -- all additional totals`],
      [`  -t <stat>`, `               -- one specific stat`],
      [`  -t <stat> -t <stat> ...`, ` -- several specific totals`],
      `also:`
      [`  `, BtnAppend(`-t=false`), ` -- disable totals (preset override)`],
    ),

    u.LogLines(
      [
        BtnAppend(`-f`),
        ` -- fetch a run file / rounds file from the given URL; overrides `,
        BtnAppend(`-c`), `; examples:`
      ],
      [`  `, BtnAppend(`-f=samples/example_run.gd user_id=all run_id=all -p=dmg`)],
      [`  `, BtnAppend(`-f=samples/example_runs.gd user_id=all run_id=all -p=dmg`)],
    ),

    u.LogLines(
      `supported filters:`,
      ...a.map(a.keys(s.ALLOWED_FILTER_KEYS), Help_filter).map(u.indentNode),
    ),

    u.LogLines(
      [`tip: repeat a filter to combine via logical "OR"; examples:`],
      [`  `, BtnAppend(`run_num=1 run_num=2`), ` -- first and second runs`],
      [`  `, BtnAppend(`round_num=1 round_num=2`), ` -- first and second rounds`],
    ),

    `tip: try ctrl+click / cmd+click / shift+click on plot legend labels`,
    [`tip: `, os.BtnCmdWithHelp(`verbose`), ` mode shows full opts after expanding presets`],
    [`tip: use `, os.BtnCmdWithHelp(`ls /`), ` to browse local files`],
    [`tip: use `, os.BtnCmdWithHelp(`ls -c`), ` to browse cloud files`],

    u.LogLines(
      `more examples:`,
      [`  `, BtnAppend(`-c -p=dmg user_id=all`), ` -- building damages in latest run`],
      [`  `, BtnAppend(`-c -p=chi_dmg user_id=all`), ` -- weapon damages in latest run`],
      [`  `, BtnAppend(`-c -p=eff user_id=all run_id=all`), ` -- building efficiency across all runs and all users`],
      [`  `, BtnAppend(`-c -p=eff user_id=all run_id=all -z=bui_type`), ` -- simplified building efficiency`],
      [`  `, BtnAppend(`-c -p=dmg_runs user_id=all -z=user_id`), ` -- user damage trajectory`],
      [`  `, BtnAppend(`-c -p=eff_runs user_id=all -z=user_id`), ` -- user efficiency trajectory`],
    ),
  )
}

export async function cmdPlot({sig, args, user}) {
  args = u.stripPreSpaced(args, cmdPlot.cmd)
  if (!args) return cmdPlot.help()

  const opt = decodePlotAggOpt(args)
  const inp = {sig, args, opt, user}
  const {state} = ui.PLOT_PLACEHOLDER
  state.count++

  try {
    if (opt.cloud) return await cmdPlotCloud(inp)
    if (opt.fetch) return await cmdPlotFetch(inp)
    return await cmdPlotLocal(inp)
  }
  finally {state.count--}
}

/*
TODO: on `DAT` events, don't update if unaffected.

Technical and UX note. When totals are requested, this renders two reactive
elements: `PlotTotals` in terminal, `LivePlotter` in media. When new rounds
are added, the `LivePlotter` invokes `makeOpts`, which updates the observable
used by the `PlotTotals`. When the `LivePlotter` is removed from the media,
the `PlotTotals` may remain in the terminal, no longer receiving updates.
Seems kinda sloppy, but is very simple, and makes for an okay UX. If the user
clicks a button to remove a plot, they either no longer care about its stats,
or are satisfied with them staying as-is.
*/
export async function cmdPlotLocal({sig, args, opt}) {
  opt = s.validPlotAggOpt(opt)
  await d.datLoad({sig, dat: d.DAT, opt})

  const agg = makeAgg()
  if (isPlotAggEmpty(agg)) return msgPlotDataEmpty(args, opt)

  const obs = agg.totals && o.obs({args, totals: agg.totals})
  const opts = plotOptsWith({...agg, opt, args})

  function makeAgg() {
    return s.plotAggFromFacts({facts: d.datQueryFacts(d.DAT, opt), opt})
  }

  function makeOpts() {
    const agg = makeAgg()
    if (obs) obs.totals = agg.totals
    return plotOptsWith({...agg, opt, args})
  }

  return new os.Combo({
    logMsgs: a.vac(obs) && [new PlotTotals(obs)],
    mediaItems: [new LivePlotter(opts, makeOpts)],
  })
}

export async function cmdPlotFetch({sig, args, opt, user, example}) {
  opt = s.validPlotAggOpt(opt)
  a.reqValidStr(args)

  const src = a.reqValidStr(opt.fetch)
  const rounds = await u.decodeGdStr(await u.fetchText(src, {signal: sig}))
  if (!a.len(rounds)) throw Error(`no rounds in ${a.show(src)}`)

  const dat = a.Emp()

  for (const round of rounds) {
    const user_id = a.optStr(round.tabularius_user_id) || d.USER_ID
    const run_num = round.tabularius_run_num ?? 1
    const run_ms = round.tabularius_run_ms ?? Date.now()
    s.datAddRound({dat, round, user_id, run_num, run_ms, composite: true})
  }

  // SYNC[plot_user_current].
  if (opt.userCurrent) {
    u.dictPush(opt.where, `user_id`, plotReqUserId())
    opt.userCurrent = false
  }

  const facts = d.datQueryFacts(dat, opt)
  const agg = u.consistentNil_undefined(s.plotAggFromFacts({facts, opt}))
  if (isPlotAggEmpty(agg)) return msgPlotDataEmpty(args, opt)

  const opts = plotOptsWith({...agg, opt, args, example})
  return showPlot({opts, totals: agg.totals, args, user})
}

export async function cmdPlotCloud({sig, args, opt, user}) {
  u.reqSig(sig)
  opt = s.validPlotAggOpt(opt)

  if (opt.userCurrent && !au.STATE.userId) {
    // SYNC[plot_user_current_err_msg].
    throw new u.ErrLog(
      `filtering cloud data by current user requires authentication; run `,
      os.BtnCmdWithHelp(`auth`), ` or use `, BtnAppend(`user_id=all`),
    )
  }

  const agg = u.consistentNil_undefined(await apiPlotAgg(sig, opt))
  if (isPlotAggEmpty(agg)) return msgPlotDataEmpty(args, opt)

  return showPlot({opts: plotOptsWith({...agg, opt, args}), totals: agg.totals, args, user})
}

// Note: `cmdPlotLocal` does it differently.
function showPlot({opts, totals, args}) {
  a.reqStr(args)

  return new os.Combo({
    logMsgs: a.vac(totals) && [new PlotTotals({args, totals})],
    mediaItems: [new Plotter(opts)],
  })
}

function plotReqUserId() {
  const id = au.STATE.userId
  if (id) return id
  throw new u.ErrLog(
    `filtering plot data by `,
    BtnAppend(`user_id=current`),
    ` requires `, os.BtnCmdWithHelp(`auth`),
    `; alternatively, use `, BtnAppend(`user_id=all`),
  )
}

const EXAMPLE_TITLE_PRE = `example run analysis: `

/*
TODO: use `argument[0].totals`, when provided.
Some could be usefully rendered under the plot.
*/
export function plotOptsWith({X_vals, Z_vals, Z_X_Y, opt, args, example}) {
  a.reqArr(X_vals)
  a.reqArr(Z_vals)
  a.reqArr(Z_X_Y)
  a.reqDict(opt)

  const {agg, totalFun} = opt
  ;[{X_vals, Z_vals, Z_X_Y}] = [s.plotAggWithTotalSeries({X_vals, Z_vals, Z_X_Y, totalFun})]

  const Z_rows = Z_vals
    .map(Z => codedToTitled(opt.Z, Z))
    .map((val, ind) => serieWithTotal(val, ind, totalFun))

  // Hide the total serie by default.
  // TODO: when updating a live plot, preserve series show/hide state.
  if (Z_rows[0]) Z_rows[0].show = false

  const tooltipOpt = agg === `count` ? {preY: `count of `} : undefined

  let title = plotTitleText(opt)

  // Dumb special case but not worth generalizing.
  if (example) title = EXAMPLE_TITLE_PRE + title

  return {
    ...LINE_PLOT_OPTS,

    /*
    Minor note on plot plugins: we used to have one for sorting series by values
    descending, which worked but didn't seem like an UX improvement, because
    frequent reordering of series, as you hover the plot, makes it harder to
    find specific series you're looking for. So, give up on that idea.
    */
    plugins: [new TooltipPlugin(tooltipOpt).opts()],

    title,
    series: [{label: opt.X}, ...Z_rows],
    data: [X_vals, ...a.arr(Z_X_Y)],
    axes: axes(opt.X, opt.Y),

    // For our own usage.
    plotOpt: opt,
    plotArgs: args,
    // Dumb special case but not worth generalizing.
    plotTitlePre: a.vac(example) && u.Muted(EXAMPLE_TITLE_PRE),
  }
}

// SYNC[plot_title_text].
// SYNC[plot_group_stat_type_z_versus_y].
function plotTitleText({X, Y, Z, agg}) {
  a.reqValidStr(X)
  a.optStr(Y)
  a.reqValidStr(Z)
  a.reqValidStr(agg)

  if (Z === `stat_type`) return agg + ` of ` + Z + ` per ` + X
  a.reqValidStr(Y)
  return agg + ` of ` + Y + ` per ` + Z + ` per ` + X
}

// SYNC[plot_title_text].
// SYNC[plot_group_stat_type_z_versus_y].
export function PlotTitle({elem, opt, args, pre, close}) {
  a.reqElement(elem)
  a.reqDict(opt)
  args = u.stripPreSpaced(args, cmdPlot.cmd)

  const {X, Y, Z, agg} = opt
  const btn = a.vac(args) && BtnReplace(args, args)

  if (btn) {
    btn.className = a.spaced(btn.className, `w-full trunc`)
    btn.style.textAlign = `center` // Override class.
  }

  return E(
    elem,
    {class: `flex justify-between gap-2 p-2`},
    E(
      `div`,
      {
        class: a.spaced(
          `flex-1 flex-shrink-1 w-full min-w-0`,
          `flex col-sta-cen gap-2`,
        ),
      },
      E(
        `span`,
        {class: `w-full trunc text-center`},
        pre,
        (
          Z === `stat_type`
          ? [
            u.Bold(agg), u.Muted(` of `), u.Bold(Z), u.Muted(` per `), u.Bold(X),
          ]
          : [
            u.Bold(agg), u.Muted(` of `), u.Bold(Y), u.Muted(` per `), u.Bold(Z), u.Muted(` per `), u.Bold(X)
          ]
        ),
      ),
      btn,
    ),
    close,
  )
}

/*
Converts CLI args to a format suitable as an input for `s.validPlotAggOpt`,
which is what's actually used by the various plotting functions.
*/
export function decodePlotAggOpt(src) {
  const cmd = cmdPlot.cmd
  const errs = []
  const keys = new Set()
  const out = a.Emp()
  out.where = a.Emp()

  src = u.stripPreSpaced(src, cmd)
  const srcPairs = a.reqArr(u.cliDecode(src))
  const outPairs = a.reqArr(plotAggOptExpandPresets(srcPairs))

  if (u.LOG_VERBOSE && srcPairs.length !== outPairs.length) {
    const opts = a.map(outPairs, u.cliEncodePair).join(` `)
    if (opts) u.log.verb(`[plot] expanded opts: `, BtnAppend(opts))
  }

  for (let [key, val, pair] of outPairs) {
    keys.add(key)

    if (key === `-c`) {
      out.cloud = ui.cliBool(cmd, key, val)
      continue
    }

    if (key === `-x`) {
      try {out.X = ui.cliEnum(cmd, key, val, s.ALLOWED_X_KEYS)}
      catch (err) {errs.push(err)}
      continue
    }

    if (key === `-y`) {
      try {out.Y = ui.cliEnum(cmd, key, val, s.ALLOWED_TOTAL_TYPE_FILTERS)}
      catch (err) {errs.push(err)}
      continue
    }

    if (key === `-z`) {
      try {out.Z = ui.cliEnum(cmd, key, val, s.ALLOWED_Z_KEYS)}
      catch (err) {errs.push(err)}
      continue
    }

    if (key === `-a`) {
      try {out.agg = ui.cliEnum(cmd, key, val, s.AGGS)}
      catch (err) {errs.push(err)}
      continue
    }

    if (key === `-t`) {
      // Allow to disable preset totals via `-t=false`.
      if (val === `false`) continue

      out.totals ??= []
      if (!val || val === `true`) continue

      // TODO this error message should mention `true` and `false` as valid.
      try {out.totals.push(ui.cliEnum(cmd, key, val, s.SUPPORTED_TOTAL_KEYS))}
      catch (err) {errs.push(err)}
      continue
    }

    if (key === `-f`) {
      if (val) out.fetch = val
      else {
        errs.push([
          BtnAppend(`-f`),
          ` must be a non-empty path or URL pointing to a ".gd" or ".json" file which must contain a sequence of rounds to be aggregated and analyzed`,
        ])
      }
      continue
    }

    // A secret option for comparing DB querying modes.
    if (key === `-m`) {
      out.mode = val
      continue
    }

    if (!key) {
      errs.push([
        `unrecognized `, BtnAppend(val),
        `, plot args must be in one of the following forms: "-flag", "-flag=val", or "field=val"`,
        `, see `, os.BtnCmd(`help plot`), ` for available options`,
      ])
      continue
    }

    if (!s.ALLOWED_FILTER_KEYS.has(key)) {
      if (key.startsWith(`-`)) {
        errs.push([`unrecognized flag `, BtnAppend(pair)])
      }
      else {
        errs.push(u.LogLines(
          [`unrecognized filter `, BtnAppend(pair), `, filters must be among:`],
          ...a.map(
            a.keys(s.ALLOWED_FILTER_KEYS),
            BtnAppendEq,
          ).map(u.indentNode),
        ))
      }
      continue
    }

    if (key === `user_id`) {
      if (val === `all`) {
        out.userCurrent = false
        continue
      }
      if (val === `current`) {
        out.userCurrent = true
        continue
      }
      u.dictPush(out.where, key, val)
      continue
    }

    // SYNC[plot_default_run_latest].
    if (key === `run_id`) {
      if (val === `all`) {
        out.runLatest = false
        continue
      }
      if (val === `latest`) {
        out.runLatest = true
        continue
      }
      u.dictPush(out.where, key, val)
      continue
    }

    // SYNC[plot_default_run_latest].
    if (key === `run_num`) {
      out.runLatest ??= false
      const int = u.toNatOpt(val)
      if (a.isNil(int)) {
        errs.push([BtnAppend(key), ` must begin with a positive integer, got `, a.show(val)])
        continue
      }
      u.dictPush(out.where, key, int)
      continue
    }

    if (
      key === `diff` ||
      key === `frontier_diff` ||
      key === `round_num`
    ) {
      const int = u.toNatOpt(val)
      if (a.isNil(int)) {
        errs.push([BtnAppend(key), ` must begin with a positive integer, got `, a.show(val)])
        continue
      }
      u.dictPush(out.where, key, int)
      continue
    }

    val = titledToCoded(key, val)

    /*
    Inputs: `one=two one=three four=five`.
    Outputs: `{one: ["two", "three"], four: ["five"]}`.
    SYNC[field_pattern].
    */
    u.dictPush(out.where, key, val)
  }

  // SYNC[plot_agg_requires_x].
  if (!out.X && !keys.has(`-x`)) errs.push(msgMissing(`-x`))

  // SYNC[plot_agg_requires_z].
  if (!out.Z && !keys.has(`-z`)) errs.push(msgMissing(`-z`))

  // SYNC[plot_group_stat_type_z_versus_y].
  if (!out.Y && !keys.has(`-y`) && out.Z !== `stat_type`) {
    errs.push(msgMissing(`-y`))
  }

  // SYNC[plot_agg_requires_agg].
  if (!out.agg && !keys.has(`-a`)) errs.push(msgMissing(`-a`))

  // SYNC[plot_agg_z_chi_type].
  if (out.Z === `chi_type` && !a.includes(out.where.ent_type, s.FACT_ENT_TYPE_CHI)) {
    errs.push([
      BtnAppend(`-z=chi_type`),
      ` requires `,
      BtnAppend(`ent_type=` + s.FACT_ENT_TYPE_CHI),
      a.vac(out.where.ent_type) && [
        `, got `,
        FlagAppendBtns(out.where.ent_type, `ent_type`),
      ],
    ])
  }

  // SYNC[plot_agg_cost_eff_only_bui].
  if (
    (out.Y === s.STAT_TYPE_COST_EFF || out.Y === s.STAT_TYPE_COST_EFF_ACC) &&
    !a.includes(out.where.ent_type, s.FACT_ENT_TYPE_BUI)
  ) {
    const got = FlagAppendBtns(out.where.ent_type, `ent_type`)
    errs.push([
      BtnAppend(`-y=` + out.Y), ` requires `,
      BtnAppend(`ent_type=` + s.FACT_ENT_TYPE_BUI),
      a.vac(got) && `, got `, got,
    ])
  }

  if (errs.length) {
    throw new u.ErrLog(...u.LogParagraphs(
      [`errors in `, BtnReplace(src), `:`],
      ...errs,
    ))
  }
  return out
}

export const PLOT_PRESETS = new Map()
  // SYNC[plot_agg_opt_dmg].
  .set(`dmg`, {
    args: `-x=round_num -y=${s.STAT_TYPE_DMG_DONE} -z=bui_type_upg -a=sum -t ent_type=${s.FACT_ENT_TYPE_BUI} user_id=current run_id=latest`,
  })
  .set(`chi_dmg`, {
    args: `-x=round_num -y=${s.STAT_TYPE_DMG_DONE} -z=chi_type -a=sum -t ent_type=${s.FACT_ENT_TYPE_CHI} user_id=current run_id=latest`,
  })
  .set(`chi_dmg_over`, {
    args: `-x=round_num -y=${s.STAT_TYPE_DMG_OVER} -z=chi_type -a=sum -t ent_type=${s.FACT_ENT_TYPE_CHI} user_id=current run_id=latest`,
  })
  .set(`eff`, {
    args: `-x=round_num -y=${s.STAT_TYPE_COST_EFF} -z=bui_type_upg -a=avg -t ent_type=${s.FACT_ENT_TYPE_BUI} user_id=current run_id=latest`,
  })
  .set(`dmg_over`, {
    args: `-x=round_num -y=${s.STAT_TYPE_DMG_OVER} -z=bui_type_upg -a=sum -t ent_type=${s.FACT_ENT_TYPE_BUI} user_id=current run_id=latest`,
  })
  .set(`dmg_runs`, {
    args: `-x=run_num -y=${s.STAT_TYPE_DMG_DONE} -z=bui_type_upg -a=sum -t ent_type=${s.FACT_ENT_TYPE_BUI} user_id=current run_id=all`,
  })
  .set(`eff_runs`, {
    args: `-x=run_num -y=${s.STAT_TYPE_COST_EFF} -z=bui_type_upg -a=avg -t ent_type=${s.FACT_ENT_TYPE_BUI} user_id=current run_id=all`,
  })
  .set(`round_stats`, {
    args: `-x=round_num -z=stat_type -a=sum -t ent_type=${s.FACT_ENT_TYPE_BUI} user_id=current run_id=latest`,
  })
  .set(`run_stats`, {
    args: `-x=run_num -z=stat_type -a=sum -t ent_type=${s.FACT_ENT_TYPE_BUI} user_id=current run_id=all`,
  })
  .set(`run_stats_all`, {
    args: `-x=run_num -z=stat_type -a=sum -t ent_type=${s.FACT_ENT_TYPE_BUI} run_id=all`,
  })

function plotAggOptExpandPresets(src) {
  const out = []
  const over = new Set()

  for (const [key] of src) if (key) over.add(key)

  for (const pair of src) {
    const [key, val] = pair
    if (key !== `-p`) {
      out.push(pair)
      continue
    }

    ui.cliEnum(cmdPlot.cmd, `-p`, val, PLOT_PRESETS)
    const {args} = PLOT_PRESETS.get(val)

    for (const prePair of u.cliDecode(args)) {
      if (over.has(prePair[0])) continue
      out.push(prePair)
    }
  }
  return out
}

/*
Goal: if FS is inited and we have an actual latest run, show its analysis.
Otherwise, show a sample run for prettiness sake.
*/
export async function plotDefault() {
  const sig = u.sig
  try {
    if (await fs.hasRoundFile(sig)) return await plotDefaultLocal()
  }
  catch (err) {
    if (u.LOG_VERBOSE) u.log.err(`error analyzing latest run: `, err)
    u.log.verb(`unable to plot latest run, plotting example run`)
  }
  return plotDefaultExample(sig)
}

export async function plotDefaultLocalOpt({sig = u.sig, quiet} = {}) {
  if (!ui.MEDIA.isDefault()) return
  if (!await fs.hasRoundFile(sig).catch(u.logErr)) return
  await plotDefaultLocal({quiet})
}

export async function plotDefaultLocal(opt) {
  // Passing the previous proc's promise to the next proc delays the output
  // but not the execution, ensuring proper ordering of outputs.
  let waitFor
  for (const val of defaultLocalPlotCmds(opt)) {
    waitFor = os.runCmd(val, {waitFor})
  }
  await waitFor
}

export async function plotDefaultExample(sig) {
  const args = `plot -f=samples/example_run.gd -p=dmg -t=false user_id=all run_id=all`
  const out = await cmdPlotFetch({sig, args, opt: decodePlotAggOpt(args), example: true})
  a.reqInst(out, os.Combo)
  for (const val of out.mediaItems) ui.markElementMediaDefault(val)
  return out
}

/*
Interfaces:
  https://github.com/leeoniya/uPlot/blob/master/dist/uPlot.d.ts

Source:
  https://github.com/leeoniya/uPlot/blob/master/src/uPlot.js

Demos:
  https://leeoniya.github.io/uPlot/demos/index.html

Dark mode demo:
  https://leeoniya.github.io/uPlot/demos/line-paths.html

Usage examples:

  E(document.body, {}, new p.Plotter(opts))
  ui.MEDIA.add(new p.Plotter(opts))
*/
export class Plotter extends u.Elem {
  constructor(opts) {
    super()
    this.className = `flex col-sta-str`
    this.setOpts(opts)
  }

  plotInit() {
    this.plotDeinit()
    this.plot = new Plot({...this.opts, ...this.sizes()})
    this.appendChild(this.plot.root)
    this.updatePlotDom()
  }

  plotDeinit() {
    this.plot?.root?.remove()
    this.plot?.destroy()
    this.plot = undefined
  }

  connectedCallback() {
    this.disconnectedCallback()

    u.darkModeMediaQuery.addEventListener(`change`, this)
    this.resObs = new ResizeObserver(this.onResize.bind(this))
    this.resObs.observe(this)

    // Need to wait a tick for the element's geometry to be determined.
    const init = () => {if (this.isConnected) this.plotInit()}
    window.requestAnimationFrame(init)
  }

  disconnectedCallback() {
    this.resObs?.disconnect()
    u.darkModeMediaQuery.removeEventListener(`change`, this)
    this.plotDeinit()
  }

  setOpts(opts) {
    a.reqDict(opts)
    this.opts = opts
  }

  lastResize = 0

  onResize() {
    if (!this.plot) return

    // Tentative. Should make jittering recursive resize less likely.
    if (!((Date.now() - this.lastResize) > 32)) return

    const par = this.parentNode
    if (!par) return

    const sizes = this.sizes()

    // Never exceed the container.
    // This also avoids recursive resize in some cases.
    if (sizes.width > par.clientWidth) return

    this.plot.setSize(sizes)
    this.lastResize = Date.now()
  }

  sizes() {
    return {
      width: this.clientWidth,
      height: this.clientWidth/(16/9), // Golden ratio.
    }
  }

  handleEvent(eve) {if (eve.type === `change` && eve.media) this.plotInit()}

  closeBtn = undefined

  // Invoked by `MEDIA`.
  addCloseBtn(btn) {this.closeBtn = a.reqElement(btn)}

  updatePlotDom() {
    const root = this.plot?.root
    this.updatePlotTitle(root)
    this.updatePlotLegend(root)
  }

  updatePlotTitle(root) {
    if (!root) return

    const elem = root.firstElementChild
    if (!elem || !elem.classList.contains(`u-title`)) return

    const opts = this.opts
    if (!opts) return

    const {plotOpt: opt, plotArgs: args, plotTitlePre} = this.opts
    if (!opt) return

    PlotTitle({elem, opt, args, pre: plotTitlePre, close: this.closeBtn})
  }

  updatePlotLegend(root) {
    if (!root) return

    const series = this.plot?.series
    const maxLen = u.maxBy(series, getLabelLen)
    if (!maxLen) return

    const COL_VAL_LEN = 6
    const colMinLen = maxLen + COL_VAL_LEN

    // SYNC[plot_grid_column_len].
    const MAX_LEN = 20
    if (!(colMinLen < MAX_LEN)) return

    const tbody = root.querySelector(`tbody`)
    if (!tbody) return

    tbody.style.gridTemplateColumns = `repeat(auto-fit, minmax(${colMinLen}ch, 1fr))`
  }
}

function getLabel(val) {return a.onlyStr(val?.label)}
function getLabelLen(val) {return getLabel(val)?.length}

export class LivePlotter extends Plotter {
  constructor(opts, fun) {
    super(opts || fun())
    this.fun = a.reqFun(fun)
  }

  plotInit() {
    super.plotInit()
    this.unsub = u.listenMessage(d.DAT, this.onDatMsg.bind(this))
  }

  plotDeinit() {
    this.unsub?.()
    super.plotDeinit()
  }

  /*
  TODO update the plot incrementally instead of rebuilding it.
  Probably something like:
    `plot.setData(opts.data)`
    `plot.setSeries(opts.series)`
  */
  onDatMsg(src) {
    if (!this.isConnected) {
      console.error(`internal: ${a.show(this)} received a dat event when not connected to the DOM`)
      return
    }

    const opts = this.fun(src)
    if (!opts) return

    this.setOpts(opts)
    this.plotInit()
  }
}

export const SCALE_X = {time: false}
export const SCALE_Y = SCALE_X
export const SCALES = {x: SCALE_X, y: SCALE_Y}

export const LINE_PLOT_OPTS = {
  axes: axes(),
  scales: SCALES,
  legend: {
    // Apply colors directly to serie labels instead of showing dedicated icons.
    markers: {show: false},

    /*
    Inverts the default behavior of clicking legend labels.

    Default:
    - Click: disable or enable.
    - Ctrl+click or Cmd+click: isolate: disable other series.
    - Shift+click: add or remove a serie from the current group.

    With `isolate: true`:
    - Click: isolate: disable other series.
    - Ctrl+click or Cmd+click: add or remove a serie from the current group.
    - Shift+click: replace the current group with the clicked serie.

    The default behavior makes it easy to disable individual series.
    The inverted behavior makes it easy to disable everything else
    and select a few. The best thing about the inverted behavior is
    that the useful operations don't involve Shift, so you don't end
    up with accidental text selection ranges.
    */
    isolate: true,
  },

  /*
  TODO: more clearly indicate the currently hovered series, maybe with an outline.
  Then we don't have to make other series unreadable.
  */
  focus: {alpha: 0.3},

  cursor: {
    /*
    When the setting `../focus/alpha` is enabled, hovering near a datapoint
    applies the opacity to all other series. This setting determines the
    proximity threshold.
    */
    focus: {prox: 8},
  },
}

export function axes(nameX, nameY) {
  return [
    // This one doesn't have a label, not even an empty string, because that
    // causes the plot library to waste space.
    {
      scale: `x`,
      stroke: axisStroke,
      secretName: nameX,
    },
    // This one does have an empty label to prevent the numbers from clipping
    // through the left side of the container.
    {
      scale: `y`,
      label: ``,
      stroke: axisStroke,
      secretName: nameY,
    },
  ]
}

export function axisStroke() {
  return u.darkModeMediaQuery.matches ? `white` : `black`
}

export function serieWithTotal(label, ind, totalFun) {
  a.reqFun(totalFun)

  return {
    ...serie(label, ind),
    value(plot, val, ind) {
      return serieFormatVal(plot, val, ind, totalFun)
    },
  }
}

export function serie(label, ind) {
  return {label, stroke: nextFgColor(ind), width: 2, value: formatVal}
}

export function serieFormatVal(plot, val, seriesInd, totalFun) {
  a.reqInt(seriesInd)
  a.reqFun(totalFun)
  const ind = plot.cursor.idx
  return formatVal(a.laxFin(
    a.isInt(ind) && ind >= 0
    ? val
    // SYNC[fold_not_nil].
    : u.foldSome(plot.data[seriesInd], 0, totalFun)
  ))
}

// Our default value formatter, which should be used for all plot values.
export function formatVal(val) {
  if (!a.isNum(val)) return val
  return formatNumCompact(val)
}

/*
We could also use `Intl.NumberFormat` with `notation: "compact"`.
This `k`, `kk`, `kkk` notation is experimental.
*/
export function formatNumCompact(val) {
  a.reqNum(val)
  let scale = 0
  const mul = 1000
  while (a.isFin(val) && Math.abs(val) > mul) {
    scale++
    val /= mul
  }
  return numFormat.format(val) + `k`.repeat(scale)
}

export const numFormat = new Intl.NumberFormat(`en-US`, {
  maximumFractionDigits: 1,
  roundingMode: `halfExpand`,
})

let COLOR_INDEX = -1

export function resetColorIndex() {COLOR_INDEX = -1}

export function nextFgColor(ind) {
  ind = a.optNat(ind) ?? ++COLOR_INDEX
  ind %= FG_COLORS.length
  return FG_COLORS[ind]
}

/*
Copy-paste, reordered, of `*-500` color variants from:

  https://tailwindcss.com/docs/colors#default-color-palette-reference
*/
const FG_COLORS = [
  `oklch(0.637 0.237 25.331)`,  // red
  `oklch(0.623 0.214 259.815)`, // blue
  `oklch(0.723 0.219 149.579)`, // green
  `oklch(0.705 0.213 47.604)`,  // orange
  `oklch(0.715 0.143 215.221)`, // cyan
  `oklch(0.769 0.188 70.08)`,   // amber
  `oklch(0.585 0.233 277.117)`, // indigo
  `oklch(0.795 0.184 86.047)`,  // yellow
  `oklch(0.768 0.233 130.85)`,  // lime
  `oklch(0.696 0.17 162.48)`,   // emerald
  `oklch(0.704 0.14 182.503)`,  // teal
  `oklch(0.685 0.169 237.323)`, // sky
  `oklch(0.606 0.25 292.717)`,  // violet
  `oklch(0.627 0.265 303.9)`,   // purple
  `oklch(0.667 0.295 322.15)`,  // fuchsia
  `oklch(0.656 0.241 354.308)`, // pink
  `oklch(0.645 0.246 16.439)`,  // rose
  `oklch(0.554 0.046 257.417)`, // slate
  `oklch(0.551 0.027 264.364)`, // gray
  `oklch(0.552 0.016 285.938)`, // zinc
  `oklch(0.556 0 0)`,           // neutral
  `oklch(0.553 0.013 58.071)`,  // stone
]

/*
Plugin interface:

  export interface Plugin {
    opts?: (plot: uPlot, opts: Options) => void | Options
    hooks: Hooks.ArraysOrFuncs
  }

Hooks (paraphrased):

  interface Hooks {
    init?:       func | func[]
    addSeries?:  func | func[]
    delSeries?:  func | func[]
    setScale?:   func | func[]
    setCursor?:  func | func[]
    setLegend?:  func | func[]
    setSelect?:  func | func[]
    setSeries?:  func | func[]
    setData?:    func | func[]
    setSize?:    func | func[]
    drawClear?:  func | func[]
    drawAxes?:   func | func[]
    drawSeries?: func | func[]
    draw?:       func | func[]
    ready?:      func | func[]
    destroy?:    func | func[]
    syncRect?:   func | func[]
  }

Relevant demos with tooltips:

  https://leeoniya.github.io/uPlot/demos/tooltips.html
  https://leeoniya.github.io/uPlot/demos/tooltips-closest.html
*/
export class TooltipPlugin extends a.Emp {
  // Index of currenly hovered series.
  indS = undefined

  // Additional options if any.
  opt = undefined

  constructor(opt) {
    super()
    this.opt = a.optObj(opt)
  }

  opts() {
    return {
      hooks: {
        // Called when a cursor hovers a particular series.
        setSeries: this.setSeries.bind(this),
        // Called on any cursor movement.
        setCursor: this.draw.bind(this),
      }
    }
  }

  /*
  Known gotcha / limitation: when multiple series _overlap_ on a data point,
  either completely, or at least visually, we still select just one series,
  instead of grouping them and including all in the tooltip.
  */
  setSeries(plot, ind) {
    this.indS = ind
    this.draw(plot)
  }

  draw(plot) {
    const {indS} = this
    const indX = plot.cursor.idx
    if (a.isNil(indS) || a.isNil(indX)) {
      this.tooltip?.remove()
      return
    }

    const series = plot.series[indS]
    const valX = plot.data[0][indX]
    const valY = plot.data[indS][indX]
    const posX = plot.valToPos(valX, `x`, false)
    const posY = plot.valToPos(valY, `y`, false)

    if (!a.isFin(valX) || !a.isFin(valY) || !a.isFin(posX) || !a.isFin(posY)) {
      this.tooltip?.remove()
      return
    }

    const preX = a.laxStr(this.opt?.preX)
    const preY = a.laxStr(this.opt?.preY)
    const axisNameX = preX + (plot.axes?.[0]?.secretName || `X`)
    const axisNameY = preY + (plot.axes?.[1]?.secretName || `Y`)
    const nameSuf = `: `
    const nameLen = nameSuf.length + Math.max(axisNameX.length, axisNameY.length)
    const label = u.ellMid(a.render(series.label), LEGEND_LEN_MAX)
    const elem = this.tooltip ??= this.makeTooltip()

    elem.textContent = u.joinLines(
      label,
      (axisNameX + nameSuf).padEnd(nameLen, ` `) + formatVal(valX),
      (axisNameY + nameSuf).padEnd(nameLen, ` `) + formatVal(valY),
    )

    const wid = plot.over.offsetWidth
    const hei = plot.over.offsetHeight
    u.tooltipOrient({elem, posX, posY, wid, hei})
    plot.over.appendChild(elem)
  }

  makeTooltip() {
    // Inline styles bypass `all: unset` we accidentally apply to this in `index.html`.
    // TODO un-apply `all: unset` and convert to Tailwind classes.
    // Also TODO lighter background in dark mode.
    return E(`div`, {
      style: {
        padding: `0.3rem`,
        pointerEvents: `none`,
        position: `absolute`,
        background: `oklch(0.45 0.31 264.05 / 0.1)`,
        whiteSpace: `pre`,
        backdropFilter: `blur(2px)`,
        borderRadius: `0.25rem`,
      },
    })
  }
}

export const LEGEND_LEN_MAX = 32

/*
Converts labels such as `CB01` to `Bunker`, `CB01_ABA` to `Bunker_ABA`, and
other similar things. We could generate and store those names statically, but
doing this dynamically seems more reliable, considering that new entities may
be added later. Updating the table of codes is easier than updating the data.

SYNC[plot_fields_coded_titled].
*/
export function codedToTitled(key, val) {
  a.reqValidStr(key)
  if (!a.isStr(val)) return val

  if (key === `bui_type`) {
    return gc.CODES_TO_BUIS_SHORT[val] || val
  }
  if (key === `bui_type_upg`) {
    [key, ...val] = u.splitKeys(val)
    return u.joinKeys(gc.CODES_TO_BUIS_SHORT[key] || key, ...val)
  }
  if (key === `chi_type`) {
    return gc.CODES_TO_CHIS_SHORT[val] || val
  }
  if (key === `hero`) {
    return gc.CODES_TO_HEROS_SHORT[val] || val
  }
  return val
}

/*
Inverse of `codedToTitled`. Should be used to convert user-readable filters such
as `bui_type=Bunker` into coded ones that match the actual fact fields.

SYNC[plot_fields_coded_titled].
*/
export function titledToCoded(key, val) {
  a.reqValidStr(key)
  if (!a.isStr(val)) return val

  if (key === `bui_type`) {
    return gc.BUIS_TO_CODES_SHORT[val] || val
  }
  if (key === `bui_type_upg`) {
    [key, ...val] = u.splitKeys(val)
    return u.joinKeys(gc.BUIS_TO_CODES_SHORT[key] || key, ...val)
  }
  if (key === `chi_type`) {
    return gc.CHIS_TO_CODES_SHORT[val] || val
  }
  if (key === `hero`) {
    return gc.HEROS_TO_CODES_SHORT[val] || val
  }
  return val
}

function BtnAppend(val, alias) {
  return ui.BtnPrompt({cmd: cmdPlot.cmd, suf: val, chi: alias})
}

function BtnReplace(val, alias) {
  return ui.BtnPromptReplace({
    val: u.preSpacedOpt(val, cmdPlot.cmd),
    chi: alias,
  })
}

function BtnAppendEq(key) {
  return BtnAppend(a.reqValidStr(key) + `=`)
}

function BtnAppendTrunc({key, val, width}) {
  val = a.render(val)
  return ui.BtnPrompt({
    cmd: cmdPlot.cmd,
    suf: u.cliEq(key, val),
    chi: val,
    trunc: true,
    width,
  })
}

function FlagAppendBtns(src, flag) {
  return a.map(src, key => BtnAppend(a.str(flag, `=`, key)))
}

function Help_preset([key, {args, help}]) {
  return [
    BtnAppend(`-p=${key}`), ` -- `, BtnAppend(args),
    a.vac(help) && [` `, help],
  ]
}

function Help_Z(key) {
  a.reqValidStr(key)
  const btn = BtnAppend(`-z=${key}`)
  if (key === `round_num`) {
    return [btn, ` (recommended: `, BtnAppend(`-x=run_num`), `)`]
  }
  if (key === `stat_type`) {
    // SYNC[plot_group_stat_type_z_versus_y].
    return [btn, ` (disables `, BtnAppend(`-y`), `)`]
  }
  return btn
}

function Help_filter(key) {
  a.reqValidStr(key)
  const btn = BtnAppend(`${key}=`)
  if (key === `user_id`) {
    return [btn, ` (special: `, BtnAppend(`user_id=all`), ` `, BtnAppend(`user_id=current`), `)`]
  }
  if (key === `run_id`) {
    return [btn, ` (special: `, BtnAppend(`run_id=all`), ` `, BtnAppend(`run_id=latest`), `)`]
  }
  if (key === `bui_type`) {
    return [btn, ` (short name, like `, BtnAppend(`bui_type=MedMort`), `)`]
  }
  if (key === `bui_type_upg`) {
    return [btn, ` (short name, like `, BtnAppend(`bui_type_upg=MedMort_ABA`), `)`]
  }
  // SYNC[plot_group_ent_type_no_mixing].
  if (key === `ent_type`) {
    return [btn, ` (exactly one is required unless `, BtnAppend(`-z=ent_type`), `)`]
  }
  if (key === `hero`) {
    return [btn, ` (short name, like `, BtnAppend(`hero=Anysia`), `)`]
  }
  return btn
}

function isPlotAggEmpty({X_vals, Z_vals, Z_X_Y}) {
  return isPlotDataEmpty([X_vals, Z_vals, Z_X_Y])
}

/*
The plot library we use requires this as an array, while internally across the
system we prefer named fields.
*/
function isPlotDataEmpty([X_vals, Z_vals, Z_X_Y]) {
  a.optArr(X_vals)
  a.optArr(Z_vals)
  a.optArr(Z_X_Y)
  return a.isEmpty(X_vals)
}

function msgPlotDataEmpty(args, opt) {
  a.reqStr(args)
  return u.LogParagraphs(
    [`no data found for `, BtnReplace(args)],
    a.vac(opt.userCurrent && (opt.cloud || opt.fetch)) && [
      `data was filtered by `, BtnAppend(`user_id=current`),
      `, consider `, BtnAppend(`user_id=all`),
    ],
    a.vac(opt.runLatest) && [
      `data was filtered by `, BtnAppend(`run_id=latest`),
      `, consider `, BtnAppend(`run_id=all`),
    ],
  )
}

function msgMissing(key) {
  return new u.ErrLog(
    `missing `, BtnAppend(key), `, `,
    `consider using a preset such as `, BtnAppend(`-p=dmg`),
  )
}

export function plotArgsToAggOpt(src) {
  return s.validPlotAggOpt(decodePlotAggOpt(src))
}

const PLOT_AGG_MODE = u.QUERY.get(`plot_agg_mode`)

const PLOT_AGG_HEADERS = (
  PLOT_AGG_MODE
  ? a.append(a.HEADERS_JSON_INOUT, [`plot_agg_mode`, PLOT_AGG_MODE])
  : a.HEADERS_JSON_INOUT
)

export function apiPlotAgg(sig, body) {
  const url = u.paths.join(u.API_URL, `plot_agg`)
  const opt = {
    signal: u.reqSig(sig),
    method: a.POST,
    headers: a.concat(PLOT_AGG_HEADERS, au.authHeadersOpt()),
    body: JSON.stringify(body),
  }
  return u.fetchJson(url, opt)
}

cmdPlotLink.cmd = `plot_link`
cmdPlotLink.desc = `easily make a link for analyzing a local or cloud run`

cmdPlotLink.help = function cmdPlotLinkHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdPlotLink.desc),
    `usage:`,
    [
      `  `,
      os.BtnCmd(`plot_link`),
      ` -- get a link that shows multiple plots analyzing the latest local run;`,
      ` the analysis is always for the latest run, and is live (always up-to-date);`,
      ` the link can be shared, but other users will see their own local runs, not yours;`,
      ` requires `, os.BtnCmdWithHelp(`saves`), ` and `, os.BtnCmdWithHelp(`history`),
      ` to grant FS access and start building`,
      ` a local run history`,
    ],
    [
      `  `,
      os.BtnCmd(`plot_link -c`),
      ` -- get a shareable link that shows multiple plots analyzing the currently-latest`,
      ` cloud run of the current user; requires `,
      os.BtnCmdWithHelp(`saves`), ` and `, os.BtnCmdWithHelp(`history`),
      ` for building the local run history and `, os.BtnCmdWithHelp(`auth`),
      ` for uploading it to the cloud`,
    ],
    [
      `  `,
      ui.BtnPrompt({full: true, cmd: `plot_link`, suf: `-c `, eph: `<user_id>`}),
      ` -- get a shareable link for the currently-latest cloud run of a specific user`,
    ],
  )
}

export async function cmdPlotLink({sig, args}) {
  const cmd = cmdPlotLink.cmd
  let cloud
  const userIds = []

  for (const [key, val, pair] of u.cliDecode(u.stripPreSpaced(args, cmd))) {
    if (key === `-c`) {
      cloud = ui.cliBool(cmd, key, val)
      continue
    }

    if (key) {
      u.log.err(
        `unrecognized `, ui.BtnPrompt({cmd, suf: pair}),
        ` in `, ui.BtnPromptReplace({val: args})
      )
      return os.cmdHelpDetailed(cmdPlotLink)
    }

    if (!val) continue
    userIds.push(val)
  }

  if (!cloud && userIds.length) {
    throw new u.ErrLog(
      `unexpected user id inputs ${a.show(userIds)} in local mode;`,
      ` did you mean `,
      ui.BtnPromptReplace({val: a.spaced(args, `-c`)}),
      `?`,
    )
  }

  if (!cloud) {
    const url = urlClean()
    for (const val of defaultLocalPlotCmds()) {
      url.searchParams.append(`run`, val)
    }

    return u.LogParagraphs(
      (await msgPlotLink(url)),
      [
        `note: this link can be shared, but other users will see`,
        ` their own local runs, not yours;`, ` use `, os.BtnCmd(`plot_link -c`),
        ` to create a shareable link`,
      ],
      a.vac(!await fs.historyDirOpt(sig).catch(u.logErr)) && [
        `warning: run history directory not initialized; run `,
        os.BtnCmdWithHelp(`history`), ` to grant access`,
      ],
    )
  }

  if (!userIds.length) userIds.push(au.reqUserId())

  for (const userId of userIds) {
    const current = userId === au.STATE.userId
    const run = await apiLatestRun(sig, userId)
    if (!run) {
      u.log.info(`no runs found for user `, userId, a.vac(current) && ` (current)`)
      continue
    }

    const runId = a.reqValidStr(run.run_id)
    const url = urlClean()
    for (const val of PLOT_LINK_PRESETS) {
      url.searchParams.append(`run`, plotCmdCloud(val, runId))
    }
    u.log.info(...await msgPlotLink(url))
  }
}

async function msgPlotLink(url) {
  const href = a.reqValidStr(a.render(url).replaceAll(`+`, `%20`))
  const copied = await u.copyToClipboard(href).catch(u.logErr)

  return [
    (copied ? `copied plot link to clipboard: ` : `plot link: `),
    E(`a`, {href, class: u.CLS_BTN_INLINE, ...ui.TARBLAN}, href),
  ]
}

const PLOT_LINK_PRESETS = [`dmg_over`, `dmg`, `eff`, `chi_dmg`]

function plotCmdLocal(preset, opt) {
  const quiet = a.optBool(a.optDict(opt)?.quiet)
  ui.cliEnum(cmdPlot.cmd, `-p`, preset, PLOT_PRESETS)
  return a.spaced(`plot -p=${preset}`, a.vac(quiet) && `-t=false`)
}

function plotCmdCloud(preset, runId) {
  a.reqValidStr(runId)
  ui.cliEnum(cmdPlot.cmd, `-p`, preset, PLOT_PRESETS)
  return `plot -p=${preset} -c run_id=${runId} user_id=all`
}

function defaultLocalPlotCmds(opt) {
  return a.map(PLOT_LINK_PRESETS, val => plotCmdLocal(val, opt))
}

function urlClean() {
  const url = new URL(window.location)
  url.hash = ``
  url.search = ``
  return url
}

export function apiLatestRun(sig, user) {
  const url = u.paths.join(u.API_URL, `latest_run`, a.laxStr(user))
  const opt = {signal: u.reqSig(sig)}
  return u.fetchJson(url, opt)
}

export class PlotTotals extends u.ReacElem {
  // May or may not be observable.
  src = undefined

  constructor(src) {
    super()
    this.src = a.reqObj(src)
  }

  logPrefix = undefined
  title = undefined

  run() {
    const args = a.reqStr(this.src.args)
    const totals = a.reqDict(this.src.totals)
    const counts = a.reqDict(totals.counts)
    const values = a.reqDict(totals.values)

    E(
      this,
      {class: `inline-block w-full whitespace-pre`},
      u.LogLines(
        this.title ??= E(`span`, {class: `w-full trunc`},
          this.logPrefix,
          `totals for `, BtnReplace(args), `:`,
        ),
        ...a.map(a.keys(counts), a.bind(PlotTotalEntry, counts, values)),
      ),
    )
  }

  addLogPrefix(val) {
    this.logPrefix = val
    this.title?.prepend(val)
  }
}

const INDENT = `  `

function PlotTotalEntry(counts, values, key) {
  const totalCount = a.laxInt(counts[key])
  const samples = a.laxArr(values[key])
  const sampleCount = a.laxNat(samples.length)
  const omitted = totalCount - sampleCount

  // For the rest of this function we assume `omitted >= 0`.
  if (omitted < 0 && u.LOG_VERBOSE) {
    u.log.verb(`[plot] unexpected state in plot totals: `, counts, values)
  }

  if (!totalCount && !sampleCount) return undefined

  const keyNode = u.Muted(key, `: `)

  if (totalCount === 1 && sampleCount === 1) {
    const sample = a.render(samples[0])
    if (!sample) return undefined

    return Sample({
      key,
      val: sample,
      pre: [INDENT, keyNode],
      preLen: INDENT.length + keyNode.textContent.length,
    })
  }

  if (!sampleCount) return [keyNode, totalCount]

  const INDENT2 = INDENT + INDENT

  return E(`details`, {class: `inline-block w-full`},
    E(
      `summary`,
      {class: `w-full trunc`},
      INDENT,
      E(`span`, {class: `cursor-pointer hover:underline hover:decoration-dotted`},
        keyNode, totalCount,
        // TODO: say "collapse" if already expanded.
        u.Muted(
          totalCount === sampleCount
          ? ` (expand)`
          : ` (expand ` + sampleCount + `)`
        ),
      ),
    ),
    ...u.LogLines(
      ...a.map(samples, val => Sample({key, val, pre: INDENT2})),
      a.vac(omitted) && u.Muted(
        INDENT2 + `... ` + omitted + ` omitted`,
      ),
    ),
  )
}

function Sample({key, val, pre, preLen}) {
  val = codedToTitled(key, val)
  const inf = ` `
  const chars = inf.length + (a.optNat(preLen) ?? a.laxStr(pre).length)
  const btn = BtnAppendTrunc({
    key,
    val,
    width: `max-w-[calc(100%-${chars}ch-${u.ICON_BTN_SIZE})]`,
  })
  const clip = u.BtnClip(val)
  return [pre, btn, inf, clip]
}
