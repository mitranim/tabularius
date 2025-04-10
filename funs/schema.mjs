import * as a from '@mitranim/js/all.mjs'
import * as c from './codes.mjs'

export const SCHEMA_VERSION = 1
export const DATA_DEBUG = false
export const BUI_TYPE_SMOKE_SIGNAL = `CB12A`
export const BUI_SELL_PRICE_AIR_COMMAND = 1500

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

export function datInit(dat) {
  a.reqObj(dat)
  dat.facts ??= []
  dat.dimRun ??= new Dim()
  dat.dimRoundInRun ??= new Dim()
  dat.dimBuiInRun ??= new Dim()
  dat.dimBuiInRound ??= new Dim()
}

/*
Decomposes a round into dimensions and facts.
We use a "star schema" for convenient aggregation.
*/
export function datAddRound(dat, round, runId, userId) {
  a.reqDict(round)
  a.reqValidStr(runId)
  a.reqValidStr(userId)
  datInit(dat)

  let DEBUG_LOGGED = false
  const runIds = {userId, runId}

  dat.dimRun.set(runId, {
    schemaVersion: SCHEMA_VERSION,
    ...runIds,
    hero: round.HeroType,
    diff: round.DifficultyLevel,
    frontierLevel: round.CurrentExpertScore,
    frontierDoctrines: round.OwnedExpertSkills,
    // TODO game version!
  })

  const roundIndex = a.reqInt(round.RoundIndex)
  const roundId = makeRoundId(runId, round.RoundIndex)
  const roundIds = {...runIds, roundId}

  dat.dimRoundInRun.set(roundId, {
    schemaVersion: SCHEMA_VERSION,
    ...roundIds,
    roundIndex,
    expired: round.MarkAsExpired,
    doctrines: round.Skills,
    neutralOdds: round.CurrentNeutralOdds,
  })

  for (const [buiGameEngineInstId, bui] of a.entries(round.Buildings)) {
    const buiType = a.laxStr(bui.EntityID)
    const buiName = c.BUILDINGS_SHORT[buiType]
    const buiInRunId = joinKeys(runId, buiGameEngineInstId)
    const buiInRunIds = {...roundIds, buiInRunId}
    const buiKind = bui.BuildingType
    const buiInRun = {
      schemaVersion: SCHEMA_VERSION,
      ...buiInRunIds,
      buiType,
      buiName,
      buiKind,
    }
    if (!dat.dimBuiInRun.has(buiInRunId)) {
      dat.dimBuiInRun.set(buiInRunId, buiInRun)
    }

    const buiInRoundId = joinKeys(buiInRunId, roundIndex)
    const buiInRoundIds = {...buiInRunIds,buiInRoundId}
    const buiUpg = encodeUpgrades(bui.PurchasedUpgrades)
    const buiTypeUpg = joinKeys(buiType, buiUpg)
    const buiTypeUpgName = buiName ? joinKeys(buiName, buiUpg) : buiTypeUpg
    const buiInRound = {
      schemaVersion: SCHEMA_VERSION,
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

        dat.facts.push({
          schemaVersion: SCHEMA_VERSION,
          ...chiFact,
          statType: STAT_TYPE_DMG_DONE,
          statScope: STAT_SCOPE_RUN_ACC,
          statValue: dmgRunAcc,
        })

        const dmgRound = a.reqFin(stats.DamageDone.valueThisWave)
        if (buiWepTypes.has(chiType)) bui_dmgDone_round_fromWepChi += dmgRound
        else bui_dmgDone_round_fromOtherChi += dmgRound

        dat.facts.push({
          schemaVersion: SCHEMA_VERSION,
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

        dat.facts.push({
          schemaVersion: SCHEMA_VERSION,
          ...chiFact,
          statType: STAT_TYPE_DMG_OVER,
          statScope: STAT_SCOPE_RUN_ACC,
          statValue: dmgRunAcc,
        })

        const dmgRound = a.reqFin(stats.DamageOverkill.valueThisWave)
        if (buiWepTypes.has(chiType)) bui_dmgOver_round_fromWepChi += dmgRound
        else bui_dmgOver_round_fromOtherChi += dmgRound

        dat.facts.push({
          schemaVersion: SCHEMA_VERSION,
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
      dat.facts.push({
        schemaVersion: SCHEMA_VERSION,
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_DONE,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: bui_dmgDone_runAcc_final,
      })
      dat.facts.push({
        schemaVersion: SCHEMA_VERSION,
        ...buiInRoundIds,
        statType: STAT_TYPE_COST_EFF,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: sellPrice ? bui_dmgDone_runAcc_final / sellPrice : 0,
      })
    }

    if (bui_dmgDone_round_final || !isNeutral) {
      dat.facts.push({
        schemaVersion: SCHEMA_VERSION,
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_DONE,
        statScope: STAT_SCOPE_ROUND,
        statValue: bui_dmgDone_round_final,
      })
      dat.facts.push({
        schemaVersion: SCHEMA_VERSION,
        ...buiInRoundIds,
        statType: STAT_TYPE_COST_EFF,
        statScope: STAT_SCOPE_ROUND,
        statValue: sellPrice ? bui_dmgDone_round_final / sellPrice : 0,
      })
    }

    if (bui_dmgOver_runAcc_final || !isNeutral) {
      dat.facts.push({
        schemaVersion: SCHEMA_VERSION,
        ...buiInRoundIds,
        statType: STAT_TYPE_DMG_OVER,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: bui_dmgOver_runAcc_final,
      })
    }

    if (bui_dmgOver_round_final || !isNeutral) {
      dat.facts.push({
        schemaVersion: SCHEMA_VERSION,
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

export function makeRunId(userId, runDir) {
  return joinKeys(a.reqValidStr(userId), a.reqValidStr(runDir))
}

export function makeRoundId(runId, roundIndex) {
  return joinKeys(a.reqValidStr(runId), intToOrdStr(roundIndex))
}

// See `test_encodeUpgrade`.
export function encodeUpgrades(src) {
  return a.map(src, encodeUpgrade).join(``)
}

export function encodeUpgrade(src) {
  const ind = a.onlyNat(src?.Index)
  return ind >= 0 ? `ABCDEFGHIJKLMNOPQRSTUVWXYZ`[ind] : ``
}

/*
How many digits to use for local ordinal ids for runs and rounds. Needs to be
long enough for any realistic amount of runs, and short enough to easily type.
*/
export const ORD_STR_LEN = 4

export function joinKeys(...src) {return a.joinOptLax(src, `_`)}

export function intToOrdStr(val) {
  return String(a.reqInt(val)).padStart(ORD_STR_LEN, `0`)
}
