import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'

export const SCHEMA_VERSION = 1
export const DATA_DEBUG = false

export const COLL_ROUND_SNAPS      = `roundSnaps`
export const COLL_FACTS            = `facts`
export const COLL_RUNS             = `runs`
export const COLL_RUN_ROUNDS       = `runRounds`
export const COLL_RUN_BUIS         = `runBuis`
export const COLL_RUN_ROUND_BUIS   = `runRoundBuis`

// TODO / missing: we need game versions in our stats.
export const STAT_SCOPE_RUN_ACC = `runAcc`
export const STAT_SCOPE_ROUND   = `round`
export const STAT_TYPE_DMG_DONE = `dmgDone`
export const STAT_TYPE_DMG_OVER = `dmgOver`
export const STAT_TYPE_COST_EFF = `costEff`

export const FACT_ENT_TYPE_BUI = `runRoundBui`
export const FACT_ENT_TYPE_CHI = `runRoundBuiChi`

export const BUI_KIND_NEUTRAL = `Neutral`
export const BUI_TYPE_SMOKE_SIGNAL = `CB12A`
export const BUI_SELL_PRICE_AIR_COMMAND = 1500

export class Dim extends a.TypedMap {
  reqKey(key) {return a.reqValidStr(key)}
  reqVal(val) {return a.reqDict(val)}
}

export function datInit(dat) {
  a.reqObj(dat)
  dat.facts ??= []
  dat.runs ??= new Dim()
  dat.runRounds ??= new Dim()
  dat.runBuis ??= new Dim()
  dat.runRoundBuis ??= new Dim()
}

/*
Decomposes a round into dimensions and facts.
We use a "star schema" for convenient aggregation.
We embed all relevant data into facts for REALLY convenient aggregation.
*/
export function datAddRound({dat, round, runId, runNum, userId}) {
  a.reqObj(dat)
  a.reqDict(round)
  a.reqValidStr(runId)
  a.reqInt(runNum)
  a.reqValidStr(userId)
  datInit(dat)

  let DEBUG_LOGGED = false
  const runIds = {userId, runId}

  dat.runs.set(runId, {
    schemaVersion: SCHEMA_VERSION,
    ...runIds,
    runNum,
    hero: round.HeroType,
    diff: round.DifficultyLevel,
    frontierLevel: round.CurrentExpertScore,
    frontierDoctrines: round.OwnedExpertSkills,
    // TODO game version!
  })

  const roundNum = a.reqInt(round.RoundIndex)
  const roundId = makeRoundId(runId, round.RoundIndex)
  const roundIds = {...runIds, roundId}

  dat.runRounds.set(roundId, {
    schemaVersion: SCHEMA_VERSION,
    ...roundIds,
    roundNum,
    expired: round.MarkAsExpired,
    doctrines: round.Skills,
    neutralOdds: round.CurrentNeutralOdds,
  })

  for (const [buiGameEngineInstId, bui] of a.entries(round.Buildings)) {
    const buiType = a.laxStr(bui.EntityID)
    const runBuiId = u.joinKeys(runId, buiGameEngineInstId)
    const runBuiIds = {...roundIds, runBuiId}
    const buiKind = bui.BuildingType

    dat.runBuis.set(runBuiId, {
      schemaVersion: SCHEMA_VERSION,
      ...runBuiIds,
      buiType,
      buiKind,
    })

    const runRoundBuiId = u.joinKeys(roundNum, runBuiId)
    const runRoundBuiIds = {...runBuiIds, runRoundBuiId}
    const buiUpg = encodeUpgrades(bui.PurchasedUpgrades)
    const buiTypeUpg = u.joinKeys(buiType, buiUpg)

    dat.runRoundBuis.set(runRoundBuiId, {
      schemaVersion: SCHEMA_VERSION,
      ...runRoundBuiIds,
      buiUpg,
      buiTypeUpg,
      sellPrice: bui.SellPrice,
      sellCurr: bui.SellCurrencyType,
    })

    const baseFact = {
      schemaVersion: SCHEMA_VERSION,
      ...runRoundBuiIds,
      runNum,
      roundNum,
      buiType,
      buiTypeUpg,
    }

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
      const chiFact = {
        ...baseFact,
        entType: FACT_ENT_TYPE_CHI,
        chiType,
      }

      if (stats.DamageDone) {
        const dmgRunAcc = a.reqFin(stats.DamageDone.valueThisGame)
        if (buiWepTypes.has(chiType)) bui_dmgDone_runAcc_fromWepChi += dmgRunAcc
        else bui_dmgDone_runAcc_fromOtherChi += dmgRunAcc

        dat.facts.push({
          ...chiFact,
          statType: STAT_TYPE_DMG_DONE,
          statScope: STAT_SCOPE_RUN_ACC,
          statValue: dmgRunAcc,
        })

        const dmgRound = a.reqFin(stats.DamageDone.valueThisWave)
        if (buiWepTypes.has(chiType)) bui_dmgDone_round_fromWepChi += dmgRound
        else bui_dmgDone_round_fromOtherChi += dmgRound

        dat.facts.push({
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
          ...chiFact,
          statType: STAT_TYPE_DMG_OVER,
          statScope: STAT_SCOPE_RUN_ACC,
          statValue: dmgRunAcc,
        })

        const dmgRound = a.reqFin(stats.DamageOverkill.valueThisWave)
        if (buiWepTypes.has(chiType)) bui_dmgOver_round_fromWepChi += dmgRound
        else bui_dmgOver_round_fromOtherChi += dmgRound

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
    const isNeutral = buiKind === BUI_KIND_NEUTRAL

    /*
    TODO: HQ deals damage but can't be sold, no sell price, so it doesn't appear
    in the cost efficiency chart!
    */
    const sellPrice = (
      buiType === BUI_TYPE_SMOKE_SIGNAL
      ? BUI_SELL_PRICE_AIR_COMMAND
      : bui.SellPrice
    )

    const buiFact = {
      ...baseFact,
      entType: FACT_ENT_TYPE_BUI,
    }

    if (bui_dmgDone_runAcc_final || !isNeutral) {
      dat.facts.push({
        ...buiFact,
        statType: STAT_TYPE_DMG_DONE,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: bui_dmgDone_runAcc_final,
      })
      dat.facts.push({
        ...buiFact,
        statType: STAT_TYPE_COST_EFF,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: sellPrice ? bui_dmgDone_runAcc_final / sellPrice : 0,
      })
    }

    if (bui_dmgDone_round_final || !isNeutral) {
      dat.facts.push({
        ...buiFact,
        statType: STAT_TYPE_DMG_DONE,
        statScope: STAT_SCOPE_ROUND,
        statValue: bui_dmgDone_round_final,
      })
      dat.facts.push({
        ...buiFact,
        statType: STAT_TYPE_COST_EFF,
        statScope: STAT_SCOPE_ROUND,
        statValue: sellPrice ? bui_dmgDone_round_final / sellPrice : 0,
      })
    }

    if (bui_dmgOver_runAcc_final || !isNeutral) {
      dat.facts.push({
        ...buiFact,
        statType: STAT_TYPE_DMG_OVER,
        statScope: STAT_SCOPE_RUN_ACC,
        statValue: bui_dmgOver_runAcc_final,
      })
    }

    if (bui_dmgOver_round_final || !isNeutral) {
      dat.facts.push({
        ...buiFact,
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
      const pre = `round ${roundNum}: building ${buiGameEngineInstId} (${buiType}): unexpected mismatch between building`
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
  return u.joinKeys(a.reqValidStr(userId), a.reqValidStr(runDir))
}

export function makeRoundId(runId, roundNum) {
  return u.joinKeys(a.reqValidStr(runId), u.intPadded(roundNum))
}

// See `test_encodeUpgrade`.
export function encodeUpgrades(src) {
  return a.map(src, encodeUpgrade).join(``)
}

export function encodeUpgrade(src) {
  const ind = a.onlyNat(src?.Index)
  return ind >= 0 ? `ABCDEFGHIJKLMNOPQRSTUVWXYZ`[ind] : ``
}

export const AGGS = new Map()
  .set(`sum`, u.accSum)
  .set(`avg`, u.accAvg)
  .set(`count`, u.accCount)

/*
The Y axis in our plots always corresponds to a number aggregated from the field
`.statValue` of facts. We don't really care which stats the client requests, but
it's useful to tell the client which stat types actually exist.
*/
export const ALLOWED_Y_STAT_TYPES = new Set([
  STAT_TYPE_DMG_DONE,
  STAT_TYPE_DMG_OVER,
  STAT_TYPE_COST_EFF,
])

/*
The X axis in our plots needs to be bounded, a closed set of reasonable size.
It can't be derived from a field where the set of possible values is unbounded,
for example from various auto-generated ids.
*/
export const ALLOWED_X_KEYS = new Set([
  `runNum`,
  `roundNum`,
  `buiType`,
  `buiTypeUpg`,
  // `entType`, // We currently enforce building-only aggregation; TODO un-hardcode.
  // `chiType`, // We currently enforce building-only aggregation; TODO un-hardcode.
  `statScope`,
  `statType`,
])

/*
The Z axis in our plots is the "series" which connect X/Y data points, usually
as a line. A typical example is "building type" or "building type with upgrade".
For now we allow arbitrary ids here, but that's going to be a problem later.
We'll either restrict this to closed sets, or introduce pagination-style limits
where only the top series are kept.
*/
export const ALLOWED_Z_KEYS = new Set([
  `userId`,
  `runId`,
  `roundId`,
  `runBuiId`,
  ...ALLOWED_X_KEYS,
])

// Purely for informational purposes, to tell users which keys we can filter on.
export const ALLOWED_FILTER_KEYS = new Set([
  `schemaVersion`,
  `userId`,
  `runId`,
  `runNum`,
  `roundId`,
  `roundNum`,
  `runBuiId`,
  `runRoundBuiId`,
  `buiType`,
  `buiTypeUpg`,
  `entType`,
  `chiType`,
  `statScope`,
  `statValue`,

  // As a special case, this filter is the Y parameter.
  // `statType`,
])

export function validPlotAggOpt(src) {
  src ??= a.Emp()
  if (!a.isDict(src)) {
    throw TypeError(`plot agg opts must be a dict, got ${a.show(src)}`)
  }

  const inp = u.dict(src)
  const out = a.Emp()
  const errs = []

  const X = u.dictPop(inp, `X`)
  if (!a.isValidStr(X)) {
    errs.push(`opt "X" must be a valid field name`)
  }
  else if (!ALLOWED_X_KEYS.has(X)) {
    errs.push(`opt "X" must be one of: ${a.show(a.arr(ALLOWED_X_KEYS))}, got ${X}`)
  }
  out.X = X

  const Y = u.dictPop(inp, `Y`)
  if (!a.isValidStr(Y)) {
    errs.push(`opt "Y" must be a valid stat type`)
  }
  else if (!ALLOWED_Y_STAT_TYPES.has(Y)) {
    errs.push(`opt "Y" must be one of: ${a.show(a.arr(ALLOWED_Y_STAT_TYPES))}, got ${Y}`)
  }
  out.Y = Y

  const Z = u.dictPop(inp, `Z`)
  if (!a.isValidStr(Z)) {
    errs.push(`opt "Z" must be a valid field name`)
  }
  else if (!ALLOWED_Z_KEYS.has(Z)) {
    errs.push(`opt "Z" must be one of: ${a.show(a.arr(ALLOWED_Z_KEYS))}, got ${Z}`)
  }
  out.Z = Z

  out.where = a.Emp()
  out.where.statType = [Y]
  out.where.statScope = [STAT_SCOPE_ROUND] // TODO un-hardcode.
  out.where.entType = [FACT_ENT_TYPE_BUI] // TODO un-hardcode.

  const where = u.dictPop(inp, `where`)
  if (a.isSome(where)) {
    if (!a.isDict(where)) {
      errs.push(`opt "where" must be a dict`)
    }
    else {
      // SYNC[field_pattern].
      for (const [key, fil] of a.entries(where)) {
        if (!ALLOWED_FILTER_KEYS.has(key)) {
          errs.push(`unrecognized where key ${a.show(key)}, must be one of: ${a.show(a.arr(ALLOWED_FILTER_KEYS))}`)
          continue
        }

        if (a.isNil(fil)) continue

        if (!a.isArr(fil)) {
          errs.push(`every where entry must have a list of possible values, got ${a.show(fil)}`)
          continue
        }

        for (const val of fil) u.dictPush(out.where, key, val)
      }
    }
  }

  const runLatest = u.dictPop(inp, `runLatest`)
  if (a.isSome(runLatest)) {
    if (!a.isBool(runLatest)) {
      errs.push(`opt "runLatest" must be a boolean`)
    }
    else {
      out.runLatest = runLatest
    }
  }

  const userCurrent = u.dictPop(inp, `userCurrent`)
  if (a.isSome(userCurrent)) {
    if (!a.isBool(userCurrent)) {
      errs.push(`opt "userCurrent" must be a boolean`)
    }
    else {
      out.userCurrent = userCurrent
    }
  }

  const agg = u.dictPop(inp, `agg`)
  if (!a.isValidStr(agg)) {
    errs.push(`opt "agg" must be a valid aggregate name`)
  }
  else if (!AGGS.has(agg)) {
    errs.push(`opt "agg" must be one of: ${a.show(a.keys(AGGS))}`)
  }
  out.agg = AGGS.get(agg)

  const keys = a.keys(inp)
  if (keys.length) {
    errs.push(`unrecognized plot agg opts: ${a.show(keys)}`)
  }
  if (errs.length) throw Error(errs.join(`; `))

  return out
}

export function plotAggFromFacts({facts, Z_key, X_key, agg}) {
  a.reqArr(facts)
  a.reqValidStr(Z_key)
  a.reqValidStr(X_key)
  a.reqFun(agg)

  const Z_X_Y = a.Emp()
  const X_set = new Set()
  plotAggAddFacts({facts, Z_X_Y, X_set, Z_key, X_key, agg})
  return plotWithTotals(...plotAggCompact(Z_X_Y, X_set), agg)
}

export function plotAggAddFacts({facts, Z_X_Y, X_set, Z_key, X_key, agg}) {
  a.reqDict(Z_X_Y)
  a.reqSet(X_set)
  a.reqKey(Z_key)
  a.reqKey(X_key)
  a.reqFun(agg)

  for (const fact of a.laxArr(facts)) {
    plotAggAddFact({fact, Z_X_Y, X_set, Z_key, X_key, agg})
  }
}

export function plotAggAddFact({fact, Z_X_Y, X_set, Z_key, X_key, agg}) {
  a.reqDict(fact)

  const Z = fact[Z_key]
  if (!a.isKey(Z)) return

  const X = fact[X_key]
  if (!a.isKey(X)) return

  const X_Y = Z_X_Y[Z] ??= a.Emp()
  const Y_val = fact.statValue

  if (!X_Y[X]) {
    X_Y[X] = [agg(undefined, Y_val, 0), 1]
  }
  else {
    X_Y[X][1]++
    X_Y[X][0] = agg(X_Y[X][0], Y_val, X_Y[X][1])
  }

  X_set.add(X)
}

export function plotAggCompact(Z_X_Y, X_set) {
  a.reqDict(Z_X_Y)
  a.reqSet(X_set)

  const Z_labels = a.keys(Z_X_Y).sort()
  const X_row = a.arr(X_set).sort(u.compareAsc)

  /*
  Produces something like:

    [
      [10, 20, 30], ← Z (plot series).
      [40, 50, 60], ← Z (another plot series).
       ↑ ․․․․․․․ Y_val for X_val at index 0 in X_row.
           ↑ ․․․ Y_val for X_val at index 1 in X_row.
               ↑ Y_val for X_val at index 2 in X_row.
    ]

  Each super-array index corresponds to an index in Z_rows (a serie).
  Each sub-array index corresponds to an index in X_row.
  Each sub-array value is the Y for that Z and X.
  */
  const Z_X_Y_arr = a.map(Z_labels, Z => a.map(X_row, X => a.head(Z_X_Y[Z][X])))

  dropZeroRows(Z_labels, Z_X_Y_arr)
  return [X_row, Z_labels, Z_X_Y_arr]
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

export function plotWithTotals(X_row, Z_labels, Z_X_Y_arr, agg) {
  Z_labels.unshift(`Total`)
  Z_X_Y_arr.unshift(totals(Z_X_Y_arr, agg))
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
    Z_X_totals[X] = Y_col.reduce(agg, 0)
  }
  return Z_X_totals
}
