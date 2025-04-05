/*
This module governs our data schema, data analysis, data visualization.
*/

import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import * as u from './util.mjs'
import * as fs from './fs.mjs'
import * as ui from './ui.mjs'
import * as pl from './plot.mjs'

import * as self from './dat.mjs'
const tar = window.tabularius ??= a.Emp()
tar.d = self
a.patch(window, tar)

export class Dat extends EventTarget {}

export class Dim extends a.TypedMap {
  reqKey(key) {return a.reqValidStr(key)}
  reqVal(val) {return a.reqDict(val)}
}

// We use a "star schema". See `datAddRound`.
export const DAT = new Dat()
DAT.facts = []
DAT.dimRun = new Dim()
DAT.dimRoundInRun = new Dim()
DAT.dimBuiInRun = new Dim()
DAT.dimBuiInRound = new Dim()

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
  ui.MEDIA.set(new DatPlotter(plotFun))
}

/*
Goal: if FS is inited and we have an actual latest run, show its analysis.
Otherwise, show a sample run for prettiness sake.

TODO: make it possible to display multiple plots at once.

TODO: make it possible to select plot order or disable some.
*/
export async function analyzeDefault({sig}) {
  try {await cmdAnalyze({sig, args: `analyze latest`})}
  catch (_) {
    u.log.verb(`unable to analyze latest run, showing example run`)
    await analyzeExampleRun()
  }
}

async function analyzeExampleRun() {
  const runId = `example_run`
  const rounds = await u.jsonDecompressDecode(await u.fetchText(`data/example_run.gd`))
  if (!a.len(rounds)) throw Error(`internal error: missing chart data`)

  await initCodes()
  for (const round of rounds) datAddRound(round, runId)

  const mode = a.head(ANALYSIS_MODES)
  const opts = mode.fun({runId})
  opts.title = `example run analyzis: ` + opts.title
  ui.MEDIA.set(new pl.Plotter(opts))
}

export let CODES

export async function initCodes() {
  return CODES ??= await u.fetchJson(new URL(`../data/codes.json`, import.meta.url))
}

export async function datLoadRun(sig, runId) {
  const root = await fs.reqHistoryDir(sig)
  const runDir = await fs.chdir(sig, root, [runId])
  await datLoadRunFromHandle(sig, runDir)
}

export async function datLoadRunFromHandle(sig, dir) {
  a.reqInst(dir, FileSystemDirectoryHandle)
  const runId = dir.name

  for await (const file of fs.readRunRoundHandles(sig, dir)) {
    await datLoadRoundFromHandle(sig, file, runId)
  }
}

export async function datLoadRoundFromHandle(sig, file, runId) {
  a.reqInst(file, FileSystemFileHandle)
  const roundId = makeRoundId(runId, u.strToInt(file.name))

  /*
  Because `DAT` is static, we must load rounds idempotently. We assume that
  if the round is present, it was fully loaded. Without this check, we would
  sometimes insert redundant facts and mess up the stats.
  */
  if (DAT.dimRoundInRun.has(roundId)) return

  const round = await fs.jsonDecompressDecodeFile(sig, file)
  await initCodes()
  datAddRound(round, runId)
}

// TODO this should be a URL query parameter; default false in production.
export const DATA_DEBUG = false

export const BUI_TYPE_SMOKE_SIGNAL = `CB12A`
export const BUI_SELL_PRICE_AIR_COMMAND = 1500

// Hardcoded until we integrate a cloud DB.
export const USER_ID = `local_user`

// TODO / missing: we need game versions in our stats.
export const STAT_SCOPE_RUN_ACC = `run_acc`
export const STAT_SCOPE_ROUND = `round`
export const STAT_TYPE_DMG_DONE = `dmg_done`
export const STAT_TYPE_DMG_OVER = `dmg_over`
export const STAT_TYPE_COST_EFF = `cost_eff`
export const BUILDING_KIND_NEUTRAL = `Neutral`

/*
Decomposes a round into dimensions and facts, adding them to our `Dat`.
If rounds are provided in an arbitrary order, then the resulting tables
are unsorted.
*/
export function datAddRound(round, runId) {
  a.reqDict(round)
  a.reqValidStr(runId)

  let DEBUG_LOGGED = false
  const runIds = {userId: USER_ID, runId}

  if (!DAT.dimRun.has(runId)) {
    DAT.dimRun.set(runId, {
      ...runIds,
      hero: round.HeroType,
      diff: round.DifficultyLevel,
      frontierLevel: round.CurrentExpertScore,
      frontierDoctrines: round.OwnedExpertSkills,
      // TODO game version!
    })
  }

  const roundIndex = a.reqInt(round.RoundIndex)
  const roundId = makeRoundId(runId, round.RoundIndex)
  const roundIds = {...runIds, roundId}

  if (DAT.dimRoundInRun.has(roundId)) {
    throw Error(`internal error: redundant attempt to add round ${roundId} to the data`)
  }

  DAT.dimRoundInRun.set(roundId, {
    ...roundIds,
    roundIndex,
    expired: round.MarkAsExpired,
    doctrines: round.Skills,
    neutralOdds: round.CurrentNeutralOdds,
  })

  for (const [buiGameEngineInstId, bui] of a.entries(round.Buildings)) {
    const buiType = a.laxStr(bui.EntityID)
    const buiName = CODES.buildings[buiType]
    const buiInRunId = u.joinKeys(runId, buiGameEngineInstId)
    const buiInRunIds = {...roundIds, buiInRunId}
    const buiKind = bui.BuildingType
    const buiInRun = {...buiInRunIds, buiType, buiName, buiKind}
    if (!DAT.dimBuiInRun.has(buiInRunId)) {
      DAT.dimBuiInRun.set(buiInRunId, buiInRun)
    }
    const buiInRoundId = u.joinKeys(buiInRunId, roundIndex)
    const buiInRoundIds = {...buiInRunIds,buiInRoundId}
    const buiUpg = encodeUpgrades(bui.PurchasedUpgrades)
    const buiTypeUpg = u.joinKeys(buiType, buiUpg)
    const buiTypeUpgName = buiName ? a.spaced(buiName, buiUpg) : buiTypeUpg
    const buiInRound = {
      ...buiInRoundIds,
      buiUpg,
      buiTypeUpg,
      buiTypeUpgName,
      sellPrice: bui.SellPrice,
      sellCurr: bui.SellCurrencyType,
    }
    DAT.dimBuiInRound.set(buiInRoundId, buiInRound)

    /*
    A building has `.LiveStats`, `.Weapons`, `.WeaponStats`, `.LiveChildStats`.

    Damage from the building's own HP, such as for HQ, Barricade, Plasma Fence,
    is only counted in `.LiveStats`.

    Damage from the building's own weapons is counted redundantly in:
    - `.LiveStats`
    - `.WeaponStats`
    - `.LiveChildStats`

    Damage from the troops spawned by the building, such as JOC assault teams,
    is counted only in `.LiveChildStats`.

    `.LiveChildStats` include stats for weapons _and_ so-called "dummy bullets"
    which are associated with weapons. Those stats are duplicated, redundantly.

    As a result, it seems that to compute a building's damage, we must add up:
    - Damage from `.LiveStats` (HP + weapons).
    - Damage from `.LiveChildStats`, ONLY for non-weapons, non-dummy-bullets.

    We also calculate damages from `.WeaponStats` to double-check ourselves.
    */
    const bui_dmgDone_runAcc = a.laxFin(bui.LiveStats?.stats?.DamageDone?.valueThisGame)
    const bui_dmgDone_round = a.laxFin(bui.LiveStats?.stats?.DamageDone?.valueThisWave)
    const bui_dmgOver_runAcc = a.laxFin(bui.LiveStats?.stats?.DamageOverkill?.valueThisGame)
    const bui_dmgOver_round = a.laxFin(bui.LiveStats?.stats?.DamageOverkill?.valueThisWave)

    let bui_dmgDone_runAcc_fromWep = 0
    let bui_dmgDone_round_fromWep = 0
    let bui_dmgOver_runAcc_fromWep = 0
    let bui_dmgOver_round_fromWep = 0

    let bui_dmgDone_runAcc_fromWepChi = 0
    let bui_dmgDone_round_fromWepChi = 0
    let bui_dmgOver_runAcc_fromWepChi = 0
    let bui_dmgOver_round_fromWepChi = 0

    let bui_dmgDone_runAcc_fromOtherChi = 0
    let bui_dmgDone_round_fromOtherChi = 0
    let bui_dmgOver_runAcc_fromOtherChi = 0
    let bui_dmgOver_round_fromOtherChi = 0

    const buiWepTypes = new Set()
    const buiDumBulTypes = new Set()

    for (const [ind, wep] of a.entries(bui.Weapons)) {
      buiWepTypes.add(a.reqValidStr(wep.EntityID))

      const dumBulType = wep.DummyBullet?.EntityID
      if (dumBulType) buiDumBulTypes.add(a.reqStr(dumBulType))

      if (DATA_DEBUG) {
        const stats = bui.WeaponStats?.[ind]?.stats
        bui_dmgDone_runAcc_fromWep += a.laxFin(stats?.DamageDone?.valueThisGame)
        bui_dmgDone_round_fromWep += a.laxFin(stats?.DamageDone?.valueThisWave)
        bui_dmgOver_runAcc_fromWep += a.laxFin(stats?.DamageOverkill?.valueThisGame)
        bui_dmgOver_round_fromWep += a.laxFin(stats?.DamageOverkill?.valueThisWave)
      }
    }

    for (const [chiType, src] of a.entries(bui.ChildLiveStats)) {
      a.reqStr(chiType)
      a.optObj(src)

      if (!chiType) continue
      if (buiDumBulTypes.has(chiType)) continue

      const stats = src?.stats
      if (!stats) continue

      /*
      Child facts are associated with a hypothetical "building child type"
      dimension. We might want to filter or group on specific child types.
      However, for now, we're not creating a table `Dat..dimBuiChi` because
      it would only have 1 field: its primary key. We simply reference this
      missing dimension by child type in child facts.
      */
      const chiFact = {...buiInRoundIds, chiType}

      if (stats.DamageDone) {
        const dmgRunAcc = a.reqFin(stats.DamageDone.valueThisGame)
        if (buiWepTypes.has(chiType)) bui_dmgDone_runAcc_fromWepChi += dmgRunAcc
        else bui_dmgDone_runAcc_fromOtherChi += dmgRunAcc

        DAT.facts.push({
          ...chiFact,
          statType: STAT_TYPE_DMG_DONE,
          statScope: STAT_SCOPE_RUN_ACC,
          statValue: dmgRunAcc,
        })

        const dmgRound = a.reqFin(stats.DamageDone.valueThisWave)
        if (buiWepTypes.has(chiType)) bui_dmgDone_round_fromWepChi += dmgRound
        else bui_dmgDone_round_fromOtherChi += dmgRound

        DAT.facts.push({
          ...chiFact,
          statType: STAT_TYPE_DMG_DONE,
          statScope: STAT_SCOPE_ROUND,
          statValue: dmgRound,
        })
      }

      if (stats.DamageOverkill) {
        const dmgRunAcc = a.reqFin(stats.DamageOverkill.valueThisGame)
        if (buiWepTypes.has(chiType)) bui_dmgOver_runAcc_fromWepChi += dmgRunAcc
        else bui_dmgOver_runAcc_fromOtherChi += dmgRunAcc

        DAT.facts.push({
          ...chiFact,
          statType: STAT_TYPE_DMG_OVER,
          statScope: STAT_SCOPE_RUN_ACC,
          statValue: dmgRunAcc,
        })

        const dmgRound = a.reqFin(stats.DamageOverkill.valueThisWave)
        if (buiWepTypes.has(chiType)) bui_dmgOver_round_fromWepChi += dmgRound
        else bui_dmgOver_round_fromOtherChi += dmgRound

        DAT.facts.push({
          ...chiFact,
          statType: STAT_TYPE_DMG_OVER,
          statScope: STAT_SCOPE_ROUND,
          statValue: dmgRound,
        })
      }
    }

    const bui_dmgDone_runAcc_final = bui_dmgDone_runAcc + bui_dmgDone_runAcc_fromOtherChi
    const bui_dmgDone_round_final = bui_dmgDone_round + bui_dmgDone_round_fromOtherChi
    const bui_dmgOver_runAcc_final = bui_dmgOver_runAcc + bui_dmgOver_runAcc_fromOtherChi
    const bui_dmgOver_round_final = bui_dmgOver_round + bui_dmgOver_round_fromOtherChi
    const isNeutral = buiKind === BUILDING_KIND_NEUTRAL

    /*
    TODO: HQ deals damage but can't be sold, no sell price, so it doesn't appear
    in the cost efficiency chart!
    */
    const sellPrice = (
      buiType === BUI_TYPE_SMOKE_SIGNAL
      ? BUI_SELL_PRICE_AIR_COMMAND
      : bui.SellPrice
    )

    if (bui_dmgDone_runAcc_final || !isNeutral) {
      DAT.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_DONE,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: bui_dmgDone_runAcc_final,
      })
      DAT.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_COST_EFF,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: sellPrice ? bui_dmgDone_runAcc_final / sellPrice : 0,
      })
    }

    if (bui_dmgDone_round_final || !isNeutral) {
      DAT.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_DONE,
        statScope: STAT_SCOPE_ROUND,
        statValue: bui_dmgDone_round_final,
      })
      DAT.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_COST_EFF,
        statScope: STAT_SCOPE_ROUND,
        statValue: sellPrice ? bui_dmgDone_round_final / sellPrice : 0,
      })
    }

    if (bui_dmgOver_runAcc_final || !isNeutral) {
      DAT.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_OVER,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: bui_dmgOver_runAcc_final,
      })
    }

    if (bui_dmgOver_round_final || !isNeutral) {
      DAT.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_OVER,
        statScope: STAT_SCOPE_ROUND,
        statValue: bui_dmgOver_round_final,
      })
    }

    /*
    Redundant data verification. Check if we correctly understand how weapon
    stats are computed. This check is incomplete, as it doesn't verify that we
    exclude "dummy bullets".
    */
    if (DATA_DEBUG && !DEBUG_LOGGED) {
      const pre = `round ${roundIndex}: building ${buiGameEngineInstId} (${buiType}): unexpected mismatch between building`
      if (!isDamageSimilar(bui_dmgDone_round_fromWep, bui_dmgDone_round_fromWepChi)) {
        debugLog(`${pre} damage calculated from its weapon list vs from weapons in its child stats: ${bui_dmgDone_round_fromWep} vs ${bui_dmgDone_round_fromWepChi}`)
      }
      if (!isDamageSimilar(bui_dmgOver_round_fromWep, bui_dmgOver_round_fromWepChi)) {
        debugLog(`${pre} damage overkill calculated from its weapon list vs from weapons in its child stats: ${bui_dmgOver_round_fromWep} vs ${bui_dmgOver_round_fromWepChi}`)
      }
    }
  }

  function debugLog(...src) {
    console.debug(...src)
    DEBUG_LOGGED = true
  }
}

// Sums don't exactly match because of float imprecision.
// Below 100, we don't really care.
function isDamageSimilar(one, two) {return (a.laxNum(one) - a.laxNum(two)) < 100}

function makeRoundId(runId, roundIndex) {
  return u.joinKeys(a.reqValidStr(runId), u.intToOrdStr(roundIndex))
}

function datOnBroadcast(src) {
  const type = src?.type
  if (type !== `new_round`) return

  const {roundData, runId} = src
  datAddRound(roundData, runId)
  u.dispatchMessage(DAT, src)
}

export function plotOptsDamagePerRoundPerBuiTypeUpg(opt, datMsg) {
  const runId = choosePlotRunId(opt.runId, opt.isLatest, datMsg)
  const [X_row, Z_labels, Z_X_Y_arr] = aggForRunPerRoundPerBuiTypeUpg(runId, STAT_TYPE_DMG_DONE, a.sum)
  // Native `.map` passes an index, which is needed for stable colors.
  const Z_rows = a.arr(Z_labels).map(pl.serieWithSum)

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
  const [X_row, Z_labels, Z_X_Y_arr] = aggForRunPerRoundPerBuiTypeUpg(runId, STAT_TYPE_COST_EFF, u.avg)
  // Native `.map` passes an index, which is needed for stable colors.
  const Z_rows = a.arr(Z_labels).map(pl.serieWithAvg)

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
    if (fact.statScope !== STAT_SCOPE_ROUND) continue
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

// See `test_encodeUpgrade`.
export function encodeUpgrades(src) {
  return a.map(src, encodeUpgrade).join(``)
}

export function encodeUpgrade(src) {
  const ind = a.onlyNat(src?.Index)
  return ind >= 0 ? `ABCDEFGHIJKLMNOPQRSTUVWXYZ`[ind] : ``
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
