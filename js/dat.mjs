import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as u from './util.mjs'
import {E} from './util.mjs'

import * as self from './dat.mjs'
window.tabularius ??= a.Emp()
window.tabularius.d = self

const CMD_ANALYZE_HELP = a.spaced(
  `usage: "analyze <run_id>", where "run_id"`,
  `is the name of an existing run directory,`,
  `containing per-round backups of run progress;`,
  `run "ls /" to see existing run ids`,
)

export async function cmdAnalyze(sig, args) {
  u.reqArrOfValidStr(args)
  const runId = args[1]
  if (!runId || a.len(args) !== 2) return CMD_ANALYZE_HELP

  const fs = await import(`./fs.mjs`)
  const root = await fs.reqHistoryDir(sig)
  const runDir = await fs.chdir(sig, root, [runId])
  const dat = new Dat()
  await initBuiCodes()

  for await (const val of fs.readRunRounds(sig, runDir)) {
    datAddRound(dat, runId, val)
  }

  const opts = await plotOptsDamagePerRoundPerBuiTypeUpg(dat)
  const pl = await import(`./plot.mjs`)
  const ui = await import(`./ui.mjs`)
  ui.MEDIA.set(E(new pl.Plotter(opts), {class: `block w-full h-full`}))
}

// Hardcoded until we integrate a cloud DB.
const USER_ID = `local_user`

/*
Missing fields and stats (TODO):
- Game version.
- Precalculate sell cost in Supply (converting other resources).
- Precalculate cost efficiency.
*/
export const STAT_SCOPE_RUN_ACC = `run_acc`
export const STAT_SCOPE_ROUND = `round`
export const STAT_TYPE_DMG_DONE = `dmg_done`
export const STAT_TYPE_DMG_OVER = `dmg_over`
export const STAT_TYPE_ENABLED = `enabled`
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

export function datAddRound(dat, runId, round) {
  a.reqInst(dat, Dat)
  a.reqValidStr(runId)
  a.reqDict(round)

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
      // sellSupply: TODO precalculate by converting other currencies.
    }
    dat.dimBuiInRound.set(buiInRoundId, buiInRound)

    const dmgDone = bui.LiveStats?.stats?.DamageDone
    dat.facts.push(...damageFacts(buiInRoundIds, dmgDone, STAT_TYPE_DMG_DONE, buiKind === BUILDING_KIND_NEUTRAL))

    const dmgOver = bui.LiveStats?.stats?.DamageOverkill
    dat.facts.push(...damageFacts(buiInRoundIds, dmgOver, STAT_TYPE_DMG_OVER, buiKind === BUILDING_KIND_NEUTRAL))

    for (const [ind, wep] of a.entries(bui.Weapons)) {
      const stats = bui.WeaponStats?.[ind]?.stats
      if (!stats) continue

      /*
      Weapon entity type is certainly a viable dimension. We might want to query
      damage facts per weapon entity type for specific buildings. However, for
      now, we're not creating a table `DIM_WEAPON_TYPE` because it would only
      have 1 column: its primary key. We simply "reference" this missing
      dimension by weapon entity type in weapon facts.
      */
      const wepType = a.reqValidStr(wep.EntityID)
      const wepFact = {...buiInRoundIds, wepType}

      dat.facts.push({
        ...wepFact,
        statScope: STAT_SCOPE_ROUND,
        statType: STAT_TYPE_ENABLED,
        statValue: a.reqBool(wep.Enabled),
      })

      const dmgDone = stats.DamageDone
      dat.facts.push(...damageFacts(wepFact, dmgDone, STAT_TYPE_DMG_DONE, false))

      const dmgOver = stats.DamageOverkill
      dat.facts.push(...damageFacts(wepFact, dmgOver, STAT_TYPE_DMG_OVER, false))
    }
  }
}

function damageFacts(fact, stat, type, skipZero) {
  a.reqDict(fact)
  a.optDict(stat)
  a.reqValidStr(type)
  a.optBool(skipZero)

  const out = []
  if (!stat) return out
  const {valueThisGame, valueThisWave} = stat

  if (valueThisGame || !skipZero) {
    out.push({
      ...fact,
      statType: type,
      statScope: STAT_SCOPE_RUN_ACC,
      statValue: valueThisGame,
    })
  }

  if (valueThisWave || !skipZero) {
    out.push({
      ...fact,
      statType: type,
      statScope: STAT_SCOPE_ROUND,
      statValue: valueThisWave,
    })
  }
  return out
}

export async function plotOptsDamagePerRoundPerBuiTypeUpg(dat) {
  a.reqInst(dat, Dat)
  const X_set = a.bset()
  const Z_X_Y = a.Emp()

  for (const fact of dat.facts) {
    if (fact.statType !== STAT_TYPE_DMG_DONE) continue
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
  const Y_rows = a.map(Z_labels, Z => a.map(X_row, X => u.roundDefault(Z_X_Y[Z][X])))
  const rows = [X_row, ...Y_rows]
  const pl = await import(`./plot.mjs`)
  const series = [{label: `Round`}, ...a.map(Z_labels, pl.serie)]

  return {
    ...pl.LINE_PLOT_OPTS,
    plugins: pl.plugins(),
    title: `Damage per round per building type (with upgrades)`,
    series,
    data: rows,
    axes: pl.axes(`Round`, `Damage`),
  }
}

// See `test_encodeUpgrade`.
export function encodeUpgrades(src) {
  return a.map(src, encodeUpgrade).join(``)
}

function encodeUpgrade(src) {
  const ind = a.onlyNat(src?.Index)
  return ind >= 0 ? `ABCDEFGHIJKLMNOPQRSTUVWXYZ`[ind] : ``
}
