import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as u from './util.mjs'
import {E} from './util.mjs'

import * as self from './dat.mjs'
const tar = window.tabularius ??= a.Emp()
tar.d = self
a.patch(window, tar)

const PLOT_DESC_plotOptsDamagePerRoundPerBuiTypeUpg = `damage per round per building type (with upgrade)`
const PLOT_DESC_plotOptsCostEffPerRoundPerBuiTypeUpg = `cost efficiency per round per building type (with upgrade)`

export const ANALYSIS_MODES = {
  cost: {
    desc: PLOT_DESC_plotOptsCostEffPerRoundPerBuiTypeUpg,
    fun: plotOptsCostEffPerRoundPerBuiTypeUpg,
  },
  dmg: {
    desc: PLOT_DESC_plotOptsDamagePerRoundPerBuiTypeUpg,
    fun: plotOptsDamagePerRoundPerBuiTypeUpg,
  },
  /*
  More planned:

    plotOptsDamagePerRoundPerBuiType
    plotOptsDamagePerRoundPerBui
    ...
  */
}

function cmdAnalyzeHelp() {
  return u.joinParagraphs(
    `usage: "analyze <run_id>" or "analyze <run_id> <cmd>;`,
    `<run_id> is the name of an existing run in the history directory (run "init" if you haven't created any; "ls /" to see existing runs)`,
    a.joinLines([
      `<cmd> chooses analysis mode; currently available modes:`,
      ...a.entries(ANALYSIS_MODES).map(modeHelp),
    ]),
  )
}

function modeHelp([name, {desc}], ind) {
  return name + `: ` + desc + (ind ? `` : ` (default)`)
}

/*
TODO:
- Use sub-cmds.
- If no sub-cmd name is provided, use the first one by default.
- The analysis type might be a flag, not an arg.
- Support specifying multiple types at once.
- Displaying multiple: either one under another, or as tabs.
- Media pane: consider supporting tabs natively.
- Allow to specify just the run id, rather than the full dir name.
*/
export async function cmdAnalyze(sig, args) {
  u.reqArrOfStr(args)
  const runId = args[1]
  const modeName = args[2]
  if (!runId || args.length > 3) return cmdAnalyzeHelp()

  const sub = modeName && ANALYSIS_MODES[modeName] || a.head(ANALYSIS_MODES)
  if (!sub) throw Error(modeName ? `unknown analysis mode ${modeName}` : `missing analysis mode`)

  const fs = await import(`./fs.mjs`)
  const root = await fs.reqHistoryDir(sig)
  const runDir = await fs.chdir(sig, root, [runId])
  const dat = new Dat()
  await initBuiCodes()

  for await (const val of fs.readRunRounds(sig, runDir)) {
    datAddRound(dat, runId, val)
  }

  const fun = sub.fun
  const opts = await fun(dat)
  const pl = await import(`./plot.mjs`)
  const ui = await import(`./ui.mjs`)
  ui.MEDIA.set(E(new pl.Plotter(opts), {class: `block w-full h-full`}))
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

export class Dim extends a.TypedMap {
  reqKey(key) {return a.reqValidStr(key)}
  reqVal(val) {return a.reqDict(val)}
}

export class Dat extends a.Emp {
  constructor() {
    super()
    this.facts = []
    this.dimRun = new Dim()
    this.dimRoundInRun = new Dim()
    this.dimBuiInRun = new Dim()
    this.dimBuiInRound = new Dim()
  }
}

export let BUI_CODES

export async function initBuiCodes() {
  BUI_CODES ??= await u.fetchJson(new URL(`../data/building_codes.json`, import.meta.url))
}

/*
Decomposes a round into dimensions and facts, adding them to our `Dat`.
If rounds are provided in an arbitrary order, then the resulting tables
are unsorted.
*/
export function datAddRound(dat, runId, round) {
  a.reqInst(dat, Dat)
  a.reqValidStr(runId)
  a.reqDict(round)

  let DEBUG_LOGGED = false
  const runIds = {userId: USER_ID, runId}

  if (!dat.dimRun.has(runId)) {
    dat.dimRun.set(runId, {
      ...runIds,
      hero: round.HeroType,
      diff: round.DifficultyLevel,
      frontierLevel: round.CurrentExpertScore,
      frontierDoctrines: round.OwnedExpertSkills,
      // TODO game version!
    })
  }

  const roundIndex = a.reqInt(round.RoundIndex)
  const roundId = u.joinKeys(runId, u.intToOrdStr(roundIndex))
  const roundIds = {...runIds, roundId}

  dat.dimRoundInRun.set(roundId, {
    ...roundIds,
    roundIndex,
    expired: round.MarkAsExpired,
    doctrines: round.Skills,
    neutralOdds: round.CurrentNeutralOdds,
  })

  for (const [buiGameEngineInstId, bui] of a.entries(round.Buildings)) {
    const buiType = a.laxStr(bui.EntityID)
    const buiName = BUI_CODES[buiType]
    const buiInRunId = u.joinKeys(runId, buiGameEngineInstId)
    const buiInRunIds = {
      ...roundIds,
      buiInRunId,
    }
    const buiKind = bui.BuildingType
    const buiInRun = {
      ...buiInRunIds,
      buiType,
      buiName,
      buiKind,
    }
    if (!dat.dimBuiInRun.has(buiInRunId)) {
      dat.dimBuiInRun.set(buiInRunId, buiInRun)
    }

    const buiInRoundId = u.joinKeys(buiInRunId, roundIndex)
    const buiInRoundIds = {
      ...buiInRunIds,
      buiInRoundId,
    }

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
    dat.dimBuiInRound.set(buiInRoundId, buiInRound)

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
    let bui_dmgDone_runAcc = a.laxFin(bui.LiveStats?.DamageDone?.valueThisGame)
    let bui_dmgDone_round = a.laxFin(bui.LiveStats?.DamageDone?.valueThisWave)
    let bui_dmgOver_runAcc = a.laxFin(bui.LiveStats?.DamageOverkill?.valueThisGame)
    let bui_dmgOver_round = a.laxFin(bui.LiveStats?.DamageOverkill?.valueThisWave)

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

      const dumBulType = wep?.DummyBullet?.EntityID
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

      if (buiDumBulTypes.has(chiType)) continue
      const stats = src?.stats
      if (!stats) continue

      /*
      Child facts are associated with a hypothetical "building child" dimension.
      We might want to filter or group on specific child types. However, for
      now, we're not creating a table `Dat..dimBuiChi` because it would only
      have 1 field: its primary key. We simply reference this missing dimension
      by child type in child facts.
      */
      const chiFact = {...buiInRoundIds, chiType}

      if (stats.DamageDone) {
        const dmgRunAcc = a.reqFin(stats.DamageDone.valueThisGame)
        bui_dmgDone_runAcc_fromOtherChi += dmgRunAcc
        if (buiWepTypes?.has(chiType)) bui_dmgDone_runAcc_fromWepChi += dmgRunAcc

        dat.facts.push({
          ...chiFact,
          statType: STAT_TYPE_DMG_DONE,
          statScope: STAT_SCOPE_RUN_ACC,
          statValue: dmgRunAcc,
        })

        const dmgRound = a.reqFin(stats.DamageDone.valueThisWave)
        bui_dmgDone_round_fromOtherChi += dmgRound
        if (buiWepTypes?.has(chiType)) bui_dmgDone_round_fromWepChi += dmgRound

        dat.facts.push({
          ...chiFact,
          statType: STAT_TYPE_DMG_DONE,
          statScope: STAT_SCOPE_ROUND,
          statValue: dmgRound,
        })
      }

      if (stats.DamageOverkill) {
        const dmgRunAcc = a.reqFin(stats.DamageOverkill.valueThisGame)
        bui_dmgOver_runAcc_fromOtherChi += dmgRunAcc
        if (buiWepTypes?.has(chiType)) bui_dmgOver_runAcc_fromWepChi += dmgRunAcc

        dat.facts.push({
          ...chiFact,
          statType: STAT_TYPE_DMG_OVER,
          statScope: STAT_SCOPE_RUN_ACC,
          statValue: dmgRunAcc,
        })

        const dmgRound = a.reqFin(stats.DamageOverkill.valueThisWave)
        bui_dmgOver_round_fromOtherChi += dmgRound
        if (buiWepTypes?.has(chiType)) bui_dmgOver_round_fromWepChi += dmgRound

        dat.facts.push({
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

    const sellPrice = (
      buiType === BUI_TYPE_SMOKE_SIGNAL
      ? BUI_SELL_PRICE_AIR_COMMAND
      : bui.SellPrice
    )

    if (bui_dmgDone_runAcc_final || !isNeutral) {
      dat.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_DONE,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: bui_dmgDone_runAcc_final,
      })
      dat.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_COST_EFF,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: sellPrice ? bui_dmgDone_runAcc_final / sellPrice : 0,
      })
    }

    if (bui_dmgDone_round_final || !isNeutral) {
      dat.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_DONE,
        statScope: STAT_SCOPE_ROUND,
        statValue: bui_dmgDone_round_final,
      })
      dat.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_COST_EFF,
        statScope: STAT_SCOPE_ROUND,
        statValue: sellPrice ? bui_dmgDone_round_final / sellPrice : 0,
      })
    }

    if (bui_dmgOver_runAcc_final || !isNeutral) {
      dat.facts.push({
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_OVER,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: bui_dmgOver_runAcc_final,
      })
    }

    if (bui_dmgOver_round_final || !isNeutral) {
      dat.facts.push({
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

export async function plotOptsCostEffPerRoundPerBuiTypeUpg(dat) {
  a.reqInst(dat, Dat)

  const pl = await import(`./plot.mjs`)
  const [X_row, Z_labels, Z_X_Y_arr] = aggPerRoundPerBuiTypeUpg(dat, STAT_TYPE_COST_EFF)
  const Z_rows = a.map(Z_labels, pl.serie)

  return {
    ...pl.LINE_PLOT_OPTS,
    plugins: pl.plugins(),
    title: PLOT_DESC_plotOptsCostEffPerRoundPerBuiTypeUpg,
    series: [{label: `Round`}, ...Z_rows],
    data: [X_row, ...Z_X_Y_arr],
    axes: pl.axes(`round`, `eff`),
  }
}

export async function plotOptsDamagePerRoundPerBuiTypeUpg(dat) {
  a.reqInst(dat, Dat)

  const pl = await import(`./plot.mjs`)
  const [X_row, Z_labels, Z_X_Y_arr] = aggPerRoundPerBuiTypeUpg(dat, STAT_TYPE_DMG_DONE)
  const Z_rows = a.map(Z_labels, pl.serie)

  return {
    ...pl.LINE_PLOT_OPTS,
    plugins: pl.plugins(),
    title: PLOT_DESC_plotOptsDamagePerRoundPerBuiTypeUpg,
    series: [{label: `Round`}, ...Z_rows],
    data: [X_row, ...Z_X_Y_arr],
    axes: pl.axes(`round`, `damage`),
  }
}

function aggPerRoundPerBuiTypeUpg(dat, statType) {
  a.reqInst(dat, Dat)
  a.reqValidStr(statType)

  const X_set = a.bset()
  const Z_X_Y = a.Emp()

  for (const fact of dat.facts) {
    if (fact.statType !== statType) continue
    if (fact.statScope !== STAT_SCOPE_ROUND) continue
    if (fact.wepType) continue

    const bui = dat.dimBuiInRound.get(fact.buiInRoundId)
    const Z = a.reqValidStr(bui.buiTypeUpgName || bui.buiTypeUpg)
    const X = a.reqInt(dat.dimRoundInRun.get(fact.roundId).roundIndex)
    const X_Y = Z_X_Y[Z] ??= a.Emp()

    X_Y[X] = a.laxFin(X_Y[X]) + a.laxFin(fact.statValue)
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
  const Z_X_Y_arr = a.map(Z_labels, Z => a.map(X_row, X => Z_X_Y[Z][X]))

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
