/*
This module governs our data schema, data analysis, data visualization.
*/

import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as fs from './fs.mjs'
import * as ui from './ui.mjs'
import * as pl from './plot.mjs'
import * as s from '../funs/schema.mjs'

import * as self from './dat.mjs'
const tar = window.tabularius ??= a.Emp()
tar.d = self
a.patch(window, tar)

// We use a "star schema". See `schema.mjs`.
export const DAT = new EventTarget()
s.datInit(DAT)

// Used only for locally-derived data.
export const USER_ID = `local_user`

// Needed for / allows live data updates and plot updates.
u.listenMessage(u.BROAD, datOnBroadcast)

export const ANALYSIS_MODES = {
  dmg: {
    desc: `damage per round per building type (with upgrade)`,
    fun: plotOptsDamagePerRoundPerBuiTypeUpg,
  },
  eff: {
    desc: `cost efficiency per round per building type (with upgrade) (currently INCORRECT: counts only the base building cost)`,
    fun: plotOptsCostEffPerRoundPerBuiTypeUpg,
  },
  /*
  More planned:

    plotOptsDamagePerRoundPerBuiType
    plotOptsDamagePerRoundPerBui
    ...
  */
}

function modeHelp([name, {desc}], ind) {
  return `  ` + name + `: ` + desc + (ind ? `` : ` (default)`)
}

cmdAnalyze.cmd = `analyze`
cmdAnalyze.desc = `analyze data`
cmdAnalyze.help = function cmdAnalyzeHelp() {
  return u.joinParagraphs(
    u.joinLines(
      `usage examples:`,
      `  analyze <run_id>`,
      `  analyze <run_id> <mode>`,
    ),
    a.spaced(
      `<run_id> is the name of an existing run in the history directory`,
      `(run "init" if you haven't created any; "ls /" to see existing runs)`,
    ),
    u.joinLines(
      `<run_id> can also be just "latest":`,
      `  analyze latest`,
      `  analyze latest <mode>`,
    ),
    u.joinLines(
      `<mode> chooses analysis mode; currently available modes:`,
      ...a.entries(ANALYSIS_MODES).map(modeHelp),
    ),
    `tip: try ctrl+click or cmd+click on plot labels`,
    `tip: use "ls /" to browse runs`,
  )
}

/*
TODO:
- The analysis type might be a flag, not an arg.
- Support specifying multiple types at once.
- Displaying multiple: either one under another, or as tabs.
- Media pane: consider supporting tabs natively.
*/
export async function cmdAnalyze({sig, args}) {
  args = u.splitCliArgs(args)
  let runId = args[1]
  const modeName = args[2]
  if (!runId || args.length > 3) return cmdAnalyze.help()

  const mode = (
    modeName
    ? ANALYSIS_MODES[modeName] || a.panic(Error(`unknown analysis mode ${a.show(modeName)}`))
    : a.head(ANALYSIS_MODES)
  )

  const isLatest = runId === `latest`
  if (isLatest) {
    runId = await fs.findLatestRunId(sig)
    if (!runId) throw Error(`unable to find latest run: no runs found`)
  }

  await datLoadRun(sig, runId)
  const plotFun = a.bind(mode.fun, {runId, isLatest})
  ui.MEDIA.add(new DatPlotter(plotFun))
}

/*
Goal: if FS is inited and we have an actual latest run, show its analysis.
Otherwise, show a sample run for prettiness sake.

TODO: make it possible to display multiple plots at once.

TODO: make it possible to select plot order or disable some.
*/
export async function analyzeDefault({sig}) {
  try {await cmdAnalyze({sig, args: `analyze latest`})}
  catch (err) {
    if (u.LOG_VERBOSE) u.log.err(`error analyzing latest run: `, err)
    u.log.verb(`unable to analyze latest run, showing example run`)
    await analyzeExampleRun()
  }
}

async function analyzeExampleRun() {
  const runId = `example_run`
  const rounds = await u.jsonDecompressDecode(await u.fetchText(`data/example_run.gd`))
  if (!a.len(rounds)) throw Error(`internal error: missing chart data`)

  for (const round of rounds) s.datAddRound(DAT, round, runId, USER_ID)
  const mode = a.head(ANALYSIS_MODES)
  const opts = mode.fun({runId})
  opts.title = `example run analyzis: ` + opts.title
  ui.MEDIA.add(new pl.Plotter(opts))
}

export async function datLoadRun(sig, runId) {
  const root = await fs.reqHistoryDir(sig)
  const runDir = await fs.chdir(sig, root, runId)
  await datLoadRunFromHandle(sig, runDir)
}

export async function datLoadRunFromHandle(sig, dir) {
  a.reqInst(dir, FileSystemDirectoryHandle)
  const runId = dir.name
  for (const file of await fs.readRunRoundHandlesAsc(sig, dir)) {
    await datLoadRoundFromHandle(sig, file, runId)
  }
}

export async function datLoadRoundFromHandle(sig, file, runId) {
  a.reqInst(file, FileSystemFileHandle)
  const roundId = s.makeRoundId(runId, u.strToInt(file.name))

  /*
  Because `DAT` is static, we must load rounds idempotently. We assume that
  if the round is present, it was fully loaded. Without this check, we would
  sometimes insert redundant facts and mess up the stats.
  */
  if (DAT.dimRoundInRun.has(roundId)) return

  const round = await fs.jsonDecompressDecodeFile(sig, file)
  s.datAddRound(DAT, round, runId, USER_ID)
}

function datOnBroadcast(src) {
  const type = src?.type
  if (type !== `new_round`) return

  const {roundData, runId} = src
  s.datAddRound(DAT, roundData, runId, USER_ID)
  u.dispatchMessage(DAT, src)
}

export function plotOptsDamagePerRoundPerBuiTypeUpg(opt, datMsg) {
  const runId = choosePlotRunId(opt.runId, opt.isLatest, datMsg)
  const agg = a.sum
  const [X_row, Z_labels, Z_X_Y_arr] = aggForRunPerRoundPerBuiTypeUpg(runId, s.STAT_TYPE_DMG_DONE, agg)

  Z_labels.unshift(`Total`)
  Z_X_Y_arr.unshift(totals(Z_X_Y_arr, agg))

  // Native `.map` passes an index, which is needed for stable colors.
  const Z_rows = a.arr(Z_labels).map(pl.serieWithSum)
  Z_rows[0].show = false

  return {
    ...pl.LINE_PLOT_OPTS,
    plugins: pl.plugins(),
    title: ANALYSIS_MODES.dmg.desc,
    series: [{label: `Round`}, ...Z_rows],
    data: [X_row, ...Z_X_Y_arr],
    axes: pl.axes(`round`, `damage`),
  }
}

export function plotOptsCostEffPerRoundPerBuiTypeUpg(opt, datMsg) {
  const runId = choosePlotRunId(opt.runId, opt.isLatest, datMsg)
  const agg = u.avg
  const [X_row, Z_labels, Z_X_Y_arr] = aggForRunPerRoundPerBuiTypeUpg(runId, s.STAT_TYPE_COST_EFF, agg)

  Z_labels.unshift(`Total`)
  Z_X_Y_arr.unshift(totals(Z_X_Y_arr, agg))

  // Native `.map` passes an index, which is needed for stable colors.
  const Z_rows = a.arr(Z_labels).map(pl.serieWithAvg)
  Z_rows[0].show = false

  return {
    ...pl.LINE_PLOT_OPTS,
    plugins: pl.plugins(),
    title: ANALYSIS_MODES.eff.desc,
    series: [{label: `Round`}, ...Z_rows],
    data: [X_row, ...Z_X_Y_arr],
    axes: pl.axes(`round`, `eff`),
  }
}

function choosePlotRunId(runId, isLatest, datMsg) {
  a.reqValidStr(runId)
  a.optBool(isLatest)
  if (!a.optObj(datMsg) || datMsg.type !== `new_round`) return runId
  if (!isLatest && datMsg.runId !== runId) return runId
  return a.reqValidStr(datMsg.runId)
}

function aggForRunPerRoundPerBuiTypeUpg(runId, statType, agg) {
  a.reqValidStr(runId)
  a.reqValidStr(statType)
  a.reqFun(agg)

  const X_set = a.bset()
  const Z_X_Y = a.Emp()

  for (const fact of DAT.facts) {
    if (fact.runId !== runId) continue
    if (fact.statType !== statType) continue
    if (fact.statScope !== s.STAT_SCOPE_ROUND) continue
    if (fact.chiType) continue

    const bui = DAT.dimBuiInRound.get(fact.buiInRoundId)
    const Z = a.reqValidStr(bui.buiTypeUpgName || bui.buiTypeUpg)
    const X = a.reqInt(DAT.dimRoundInRun.get(fact.roundId).roundIndex)
    const X_Y = Z_X_Y[Z] ??= a.Emp()

    X_Y[X] ??= []
    X_Y[X].push(fact.statValue)
    X_set.add(X)
  }

  const Z_labels = a.keys(Z_X_Y).sort()
  const X_row = a.arr(X_set).sort(a.compareFin)

  /*
  Produces something like:

    [
      [10, 20, 30], ← Building group.
      [40, 50, 60], ← Another building group.
       ↑ ․․․․․․․ val for round at index 0
           ↑ ․․․ val for round at index 1
               ↑ val for round at index 2
    ]

  Each super-array index corresponds to an index in Z_rows (a serie).
  Each sub-array index corresponds to an index in X_row.
  Each sub-array value is the Y for that Z and X.
  */
  const Z_X_Y_arr = a.map(Z_labels, Z => a.map(X_row, X => agg(Z_X_Y[Z][X])))

  dropZeroRows(Z_labels, Z_X_Y_arr)
  return [X_row, Z_labels, Z_X_Y_arr]
}

export function totals(Z_X_Y, agg) {
  a.reqArrOf(Z_X_Y, a.isArr)
  a.reqFun(agg)

  const Z_len = Z_X_Y.length
  const X_len = Z_len ? Z_X_Y[0].length : 0
  const Y_col = Array(Z_len)
  const Z_X_totals = Array(X_len)
  let X = -1

  while (++X < X_len) {
    let Z = -1
    while (++Z < Z_len) Y_col[Z] = Z_X_Y[Z][X]
    Z_X_totals[X] = agg(Y_col)
  }
  return Z_X_totals
}

export function dropZeroRows(Z, Z_X_Y) {
  a.reqArr(Z)
  a.reqArr(Z_X_Y)
  if (Z.length !== Z_X_Y.length) {
    throw Error(`internal error: length mismatch between Z (${Z.length}) and Z_X_Y (${Z_X_Y.length})`)
  }

  let Z_ind = -1
  while (++Z_ind < Z.length) {
    const X_Y = a.reqArr(Z_X_Y[Z_ind])

    if (!X_Y.length) continue
    if (a.some(X_Y, a.truthy)) continue

    Z.splice(Z_ind, 1)
    Z_X_Y.splice(Z_ind, 1)
    Z_ind--
  }
}

export class DatPlotter extends pl.Plotter {
  constructor(fun) {
    super(fun())
    this.fun = fun
  }

  init() {
    super.init()
    this.unsub = u.listenMessage(DAT, this.onDatMsg.bind(this))
  }

  deinit() {
    this.unsub?.()
    super.deinit()
  }

  onDatMsg(src) {
    if (!this.isConnected) {
      console.error(`internal error: ${a.show(this)} received a dat event when not connected to the DOM`)
      return
    }

    const opts = this.fun(src)
    if (!opts) return

    this.opts = opts
    this.init()
  }
}
