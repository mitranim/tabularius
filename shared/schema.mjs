/*
Must be kept in sync with the table definitions in `schema.sql`.
*/

import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as gc from './game_const.mjs'

/*
TODO / missing: we need game versions in our stats.
*/
export const DATA_SCHEMA_VERSION = 3
export const ROUND_FIELDS_SCHEMA_VERSION = 2
export const DATA_DEBUG = false

export const STAT_TYPE_DMG_DONE = `dmg_done`
export const STAT_TYPE_DMG_OVER = `dmg_over`
export const STAT_TYPE_COST_EFF = `cost_eff`
export const STAT_TYPE_DMG_DONE_ACC = `dmg_done_acc`
export const STAT_TYPE_DMG_OVER_ACC = `dmg_over_acc`
export const STAT_TYPE_COST_EFF_ACC = `cost_eff_acc`

export const FACT_ENT_TYPE_BUI = `run_round_bui`
export const FACT_ENT_TYPE_CHI = `run_round_bui_chi`

export const BUI_KIND_NEUTRAL = `Neutral`

export const DAT_TABLES_ALL = Object.freeze({
  runs: true,
  run_rounds: true,
  run_buis: true,
  run_round_buis: true,
  facts: true,
})

const LOGGED_MISSING_COSTS = a.Emp()

/*
Decomposes a round into a flatter datasets for convenient aggregation.
The `composite` mode adds fields which are composite keys.
On the client, they're necessary. On the server, they may be optional.
*/
export function datAddRound({
  dat, round, user_id, run_num, run_ms, composite,
  tables: {runs, run_rounds, run_buis, run_round_buis, facts} = DAT_TABLES_ALL,
}) {
  a.reqObj(dat)
  a.reqDict(round)
  a.reqInt(run_num)
  a.reqNat(run_ms)
  a.reqValidStr(user_id)
  a.optBool(composite)

  let DEBUG_LOGGED = false

  const round_num = a.reqInt(round.RoundIndex)

  // Rounds with num 0 never have useful stats.
  if (!round_num) return

  const run_id = makeRunId(user_id, run_num, run_ms)
  const runIds = {user_id}
  if (composite) runIds.run_id = run_id

  const hero = round.HeroType
  const diff = round.DifficultyLevel
  const frontier_diff = round.CurrentExpertScore
  const time_ms = Date.parse(round.LastUpdated) || Date.now()

  if (runs) {
    dat.runs ??= new Map()
    dat.runs.set(run_id, {
      // schema_version: DATA_SCHEMA_VERSION,
      time_ms,
      ...runIds,
      run_num,
      run_ms,
      hero,
      diff,
      frontier_diff,
      frontier_doctrines: round.OwnedExpertSkills,
      // TODO game version!
    })
  }

  const round_id = makeRoundId(user_id, run_num, run_ms, round.RoundIndex)
  const roundIds = runIds
  if (composite) roundIds.round_id = round_id

  if (run_rounds) {
    dat.run_rounds ??= new Map()
    dat.run_rounds.set(round_id, {
      // schema_version: DATA_SCHEMA_VERSION,
      time_ms,
      ...roundIds,
      round_num,
      expired: round.MarkAsExpired,
      doctrines: round.Skills,
      neutral_odds: round.CurrentNeutralOdds,
    })
  }

  if (!run_buis && !run_round_buis && !facts) return

  for (const [bui_inst_str, bui] of a.entries(round.Buildings)) {
    const bui_inst = a.int(bui_inst_str)
    const bui_type = a.laxStr(bui.EntityID)
    const run_bui_id = u.joinKeys(run_id, bui_inst_str)
    const runBuiIds = roundIds
    const bui_kind = bui.BuildingType

    if (run_buis) {
      dat.run_buis ??= new Map()
      dat.run_buis.set(run_bui_id, {
        // schema_version: DATA_SCHEMA_VERSION,
        ...runBuiIds,
        bui_type,
        bui_kind,
      })
    }

    const run_round_bui_id = u.joinKeys(round_num, run_bui_id)
    const runRoundBuiIds = {...runBuiIds, bui_inst}
    const bui_upg = encodeUpgrades(bui.PurchasedUpgrades)
    const bui_type_upg = u.joinKeys(bui_type, bui_upg)
    const bui_cost = buiCost(bui_type, bui.PurchasedUpgrades, bui.SellPrice)

    if (run_round_buis) {
      dat.run_round_buis ??= new Map()
      dat.run_round_buis.set(run_round_bui_id, {
        // schema_version: DATA_SCHEMA_VERSION,
        ...runRoundBuiIds,
        bui_upg,
        bui_type_upg,
        bui_cost,
        bui_cost_curr: bui.SellCurrencyType,
      })
    }

    if (!facts) continue
    dat.facts ??= []

    const baseFact = {
      // schema_version: DATA_SCHEMA_VERSION,
      time_ms,
      ...runRoundBuiIds,
      hero,
      diff,
      frontier_diff,
      run_num,
      round_num,
      bui_type,
      bui_type_upg,
    }
    if (composite) baseFact.run_round_bui_id = run_round_bui_id

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
    const buiWepDisabled = a.Emp()

    for (const [ind, wep] of a.entries(bui.Weapons)) {
      const key = a.reqValidStr(wep.EntityID)
      buiWepTypes.add(key)
      buiWepDisabled[key] = !a.reqBool(wep.Enabled)

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

    for (const [chi_type, src] of a.entries(bui.ChildLiveStats)) {
      a.reqStr(chi_type)
      a.optObj(src)

      if (!chi_type) continue
      if (buiDumBulTypes.has(chi_type)) continue

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
        ent_type: FACT_ENT_TYPE_CHI,
        chi_type,
      }

      if (stats.DamageDone) {
        const statExists = !!a.reqFin(stats.DamageDone.valueThisGame)

        {
          const stat_val = a.reqFin(stats.DamageDone.valueThisGame)
          if (buiWepTypes.has(chi_type)) bui_dmgDone_runAcc_fromWepChi += stat_val
          else bui_dmgDone_runAcc_fromOtherChi += stat_val

          if (statExists || !buiWepDisabled[chi_type]) {
            dat.facts.push({
              ...chiFact,
              stat_type: STAT_TYPE_DMG_DONE_ACC,
              stat_val,
            })
          }
        }

        {
          const stat_val = a.reqFin(stats.DamageDone.valueThisWave)
          if (buiWepTypes.has(chi_type)) bui_dmgDone_round_fromWepChi += stat_val
          else bui_dmgDone_round_fromOtherChi += stat_val

          if (statExists || !buiWepDisabled[chi_type]) {
            dat.facts.push({
              ...chiFact,
              stat_type: STAT_TYPE_DMG_DONE,
              stat_val,
            })
          }
        }
      }

      if (stats.DamageOverkill) {
        const statExists = !!a.reqFin(stats.DamageOverkill.valueThisGame)

        {
          const stat_val = a.reqFin(stats.DamageOverkill.valueThisGame)
          if (buiWepTypes.has(chi_type)) bui_dmgOver_runAcc_fromWepChi += stat_val
          else bui_dmgOver_runAcc_fromOtherChi += stat_val

          if (statExists || !buiWepDisabled[chi_type]) {
            dat.facts.push({
              ...chiFact,
              stat_type: STAT_TYPE_DMG_OVER_ACC,
              stat_val,
            })
          }
        }

        {
          const stat_val = a.reqFin(stats.DamageOverkill.valueThisWave)
          if (buiWepTypes.has(chi_type)) bui_dmgOver_round_fromWepChi += stat_val
          else bui_dmgOver_round_fromOtherChi += stat_val

          if (statExists || !buiWepDisabled[chi_type]) {
            dat.facts.push({
              ...chiFact,
              stat_type: STAT_TYPE_DMG_OVER,
              stat_val,
            })
          }
        }
      }
    }

    const bui_dmgDone_runAcc_final = bui_dmgDone_runAcc + bui_dmgDone_runAcc_fromOtherChi
    const bui_dmgDone_round_final = bui_dmgDone_round + bui_dmgDone_round_fromOtherChi
    const bui_dmgOver_runAcc_final = bui_dmgOver_runAcc + bui_dmgOver_runAcc_fromOtherChi
    const bui_dmgOver_round_final = bui_dmgOver_round + bui_dmgOver_round_fromOtherChi
    const isNeutral = bui_kind === BUI_KIND_NEUTRAL

    const buiFact = {
      ...baseFact,
      ent_type: FACT_ENT_TYPE_BUI,
      chi_type: ``,
    }

    if (bui_dmgDone_runAcc_final || !isNeutral) {
      dat.facts.push({
        ...buiFact,
        stat_type: STAT_TYPE_DMG_DONE_ACC,
        stat_val: bui_dmgDone_runAcc_final,
      })
      dat.facts.push({
        ...buiFact,
        stat_type: STAT_TYPE_COST_EFF_ACC,
        stat_val: bui_cost ? bui_dmgDone_runAcc_final / bui_cost : 0,
      })
    }

    if (bui_dmgDone_round_final || !isNeutral) {
      dat.facts.push({
        ...buiFact,
        stat_type: STAT_TYPE_DMG_DONE,
        stat_val: bui_dmgDone_round_final,
      })
      dat.facts.push({
        ...buiFact,
        stat_type: STAT_TYPE_COST_EFF,
        stat_val: bui_cost ? bui_dmgDone_round_final / bui_cost : 0,
      })
    }

    if (bui_dmgOver_runAcc_final || !isNeutral) {
      dat.facts.push({
        ...buiFact,
        stat_type: STAT_TYPE_DMG_OVER_ACC,
        stat_val: bui_dmgOver_runAcc_final,
      })
    }

    if (bui_dmgOver_round_final || !isNeutral) {
      dat.facts.push({
        ...buiFact,
        stat_type: STAT_TYPE_DMG_OVER,
        stat_val: bui_dmgOver_round_final,
      })
    }

    /*
    Redundant data verification. Check if we correctly understand how weapon
    stats are computed. This check is incomplete, as it doesn't verify that we
    exclude "dummy bullets".
    */
    if (DATA_DEBUG && !DEBUG_LOGGED) {
      const pre = `round ${round_num}: building ${bui_inst_str} (${bui_type}): unexpected mismatch between building`
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

// Must be used for run directories inside user directories.
export function makeRunName(run_num, run_ms) {
  return u.joinKeys(u.intPadded(run_num), a.reqNat(run_ms))
}

export function splitRunName(src) {
  const [run_num, run_ms] = u.splitKeys(src)
  return [u.toIntReq(run_num), u.toIntReq(run_ms)]
}

export function makeRunId(user_id, run_num, run_ms) {
  return u.joinKeys(a.reqValidStr(user_id), makeRunName(run_num, run_ms))
}

export function makeRoundId(user_id, run_num, run_ms, round_num) {
  return u.joinKeys(makeRunId(user_id, run_num, run_ms, u.intPadded(round_num)))
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

export const AGG_TOTALS = new Map()
  .set(`sum`, u.accSum)
  .set(`avg`, u.accAvg)
  .set(`count`, u.accSum)

/*
The "real" Y axis in our plots is always `.stat_val` of facts. Meanwhile, the
"fake" Y axis is

The Y axis in our plots always corresponds to a number aggregated from the field
`.stat_val` of facts.
*/
export const ALLOWED_STAT_TYPE_FILTERS = new Set([
  STAT_TYPE_DMG_DONE,
  STAT_TYPE_DMG_OVER,
  STAT_TYPE_COST_EFF,
  STAT_TYPE_DMG_DONE_ACC,
  STAT_TYPE_DMG_OVER_ACC,
  STAT_TYPE_COST_EFF_ACC,
])

/*
The X axis in our plots needs to be bounded, a closed set of reasonable size.
It can't be derived from a field where the set of possible values is unbounded,
for example from various auto-generated ids.

In addition, it needs to be a number or a timestamp, as we currently only
support line plots.
*/
export const ALLOWED_X_KEYS = new Set([
  `run_num`,
  `round_num`,

  /*
  TODO: this seems to require bar plots.
  We currently only implement line plots.

  `bui_type`,
  `bui_type_upg`,
  `stat_type`,
  `ent_type`, // We currently enforce building-only aggregation; TODO un-hardcode.
  `chi_type`, // We currently enforce building-only aggregation; TODO un-hardcode.
  */
])

/*
The Z axis in our plots is the "series" which connect X/Y data points, usually
as a line. A typical example is "building type" or "building type with upgrade".
For now we allow arbitrary ids here, but that's going to be a problem later.
We'll either restrict this to closed sets, or introduce pagination-style limits
where only the top series are kept.

SYNC[plot_help_Z].
*/
export const ALLOWED_Z_KEYS = new Set([
  `user_id`,
  `run_id`,
  `round_id`,
  `run_bui_id`,
  `run_num`,
  `round_num`,
  `bui_type`,
  `bui_type_upg`,
  `ent_type`,
  `chi_type`,
  `stat_type`,
])

export const ALLOWED_FILTER_KEYS = new Set([
  `user_id`,
  `run_id`,
  `run_num`,
  `round_id`,
  `round_num`,
  `run_bui_id`,
  `run_round_bui_id`,
  `bui_type`,
  `bui_type_upg`,
  `ent_type`,
  `chi_type`,
  `stat_type`,
  `hero`,
  `diff`,
  `frontier_diff`,
])

export function validPlotAggOpt(src) {
  src ??= a.Emp()
  if (!a.isDict(src)) {
    throw TypeError(`plot agg opts must be a dict, got ${a.show(src)}`)
  }

  const errs = []
  const inp = u.dict(src)
  const out = a.Emp()
  out.where = a.Emp()

  const where = u.dictPop(inp, `where`)
  if (a.isSome(where)) {
    if (!a.isDict(where)) {
      errs.push(`opt "where" must be a dict`)
    }
    else {
      // SYNC[field_pattern].
      for (const [key, fil] of a.entries(where)) {
        if (!ALLOWED_FILTER_KEYS.has(key)) {
          errs.push(`unrecognized "where" key ${a.show(key)}, must be one of: ${a.show(a.keys(ALLOWED_FILTER_KEYS))}`)
          continue
        }

        if (a.isNil(fil)) continue

        if (!a.isArr(fil)) {
          errs.push(`every "where" entry must have a list of possible values, got ${a.show(fil)}`)
          continue
        }

        for (const val of fil) u.dictPush(out.where, key, val)
      }
    }
  }

  const X = u.dictPop(inp, `X`)
  if (!u.isIdent(X)) {
    errs.push(`opt "-x" must be a valid identifier, got ${a.show(X)}`)
  }
  else if (!ALLOWED_X_KEYS.has(X)) {
    errs.push(`opt "-x" must be one of: ${a.show(a.keys(ALLOWED_X_KEYS))}, got ${X}`)
  }
  else {
    out.X = X
  }

  const Z = u.dictPop(inp, `Z`)
  if (!u.isIdent(Z)) {
    errs.push(`opt "-z" must be a valid identifier, got ${a.show(Z)}`)
  }
  else if (!ALLOWED_Z_KEYS.has(Z)) {
    errs.push(`opt "-z" must be one of: ${a.show(a.keys(ALLOWED_Z_KEYS))}, got ${Z}`)
  }
  else {
    out.Z = Z
  }

  const Y = u.dictPop(inp, `Y`)
  const msgYInvalid = `opt "-y" must be a valid identifier unless "-z=stat_type", got ${a.show(Y)}`
  const msgYUnknown = `opt "-y" must be one of: ${a.show(a.keys(ALLOWED_STAT_TYPE_FILTERS))} (unless "-z=stat_type"), got ${Y}`
  const msgYFlag = `-y=` + Y

  // SYNC[plot_group_stat_type_z_versus_y].
  if (Z === `stat_type`) {
    if (a.isNil(Y) || Y === ``) {}
    else if (!u.isIdent(Y)) errs.push(msgYInvalid)
    else if (!ALLOWED_STAT_TYPE_FILTERS.has(Y)) errs.push(msgYUnknown)
  }
  else {
    if (!u.isIdent(Y)) errs.push(msgYInvalid)
    else if (!ALLOWED_STAT_TYPE_FILTERS.has(Y)) errs.push(msgYUnknown)
    else {
      // Purely informational. The consumer code is not expected to use this.
      out.Y = Y

      // SYNC[plot_group_stat_type_no_mixing_y_vs_filter].
      const len = a.len(out.where.stat_type)
      if (len) {
        if (!(len === 1 && out.where.stat_type[0] === Y)) {
          errs.push(`only one "stat_type" filter is allowed, unless "-z=stat_type"; the filter ${a.show(showFilter(`stat_type`, out.where.stat_type))} conflicts with ${a.show(msgYFlag)}`)
        }
      }
      // This is what `Y` really does.
      else out.where.stat_type = [Y]
    }
  }

  const agg = u.dictPop(inp, `agg`)
  if (!u.isIdent(agg)) {
    errs.push(`opt "-a" must be a valid aggregate name`)
  }
  else if (!AGGS.has(agg)) {
    errs.push(`opt "-a" must be one of: ${a.show(a.keys(AGGS))}`)
  }
  else {
    const totalFun = a.optFun(AGG_TOTALS.get(agg))
    if (!totalFun) {
      errs.push(`unknown how to calculate total for agg ${a.show(agg)}`)
    }
    else {
      out.agg = agg
      out.aggFun = a.reqFun(AGGS.get(agg))
      out.totalFun = totalFun
    }
  }
  delete inp.aggFun
  delete inp.totalFun

  const cloud = u.dictPop(inp, `cloud`)
  if (a.isSome(cloud)) {
    if (!a.isBool(cloud)) errs.push(`opt "-c" must be a boolean`)
    else out.cloud = cloud
  }

  const fetch = u.dictPop(inp, `fetch`)
  if (a.isSome(fetch)) {
    if (!a.isStr(fetch)) errs.push(`opt "-f" must be a string`)
    else out.fetch = fetch
  }

  const userCurrent = u.dictPop(inp, `userCurrent`)
  if (a.isSome(userCurrent)) {
    if (a.isBool(userCurrent)) out.userCurrent = userCurrent
    else errs.push(`opt "userCurrent" must be a boolean`)
  }

  const runLatest = u.dictPop(inp, `runLatest`)
  if (a.isSome(runLatest)) {
    if (!a.isBool(runLatest)) errs.push(`opt "runLatest" must be a boolean`)
    else out.runLatest = runLatest
  }

  const mode = u.dictPop(inp, `mode`)
  if (a.isSome(mode)) {
    if (!a.isStr(mode)) errs.push(`opt "-m" must be a string`)
    else out.mode = mode
  }

  // SYNC[plot_group_ent_type_no_mixing].
  if (Z !== `ent_type`) {
    if (!a.len(out.where.ent_type)) {
      errs.push(`missing "ent_type=" (required unless "-z=ent_type")`)
    }
    else if (a.len(out.where.ent_type) > 1) {
      errs.push(`exactly one "ent_type=" is required unless "-z=ent_type", got ${a.show(showFilter(`ent_type`, out.where.ent_type))}`)
    }
  }

  // SYNC[plot_agg_z_chi_type].
  if (Z === `chi_type` && !a.includes(out.where.ent_type, FACT_ENT_TYPE_CHI)) {
    const got = a.show(showFilter(`ent_type`, out.where.ent_type))
    errs.push(
      `"-z=chi_type" requires "ent_type=${FACT_ENT_TYPE_CHI}"` + (
        a.vac(got) ? `, got ` + got : ``
      )
    )
  }

  // SYNC[plot_agg_cost_eff_only_bui].
  if (
    (Y === STAT_TYPE_COST_EFF || Y === STAT_TYPE_COST_EFF_ACC) &&
    !a.includes(out.where.ent_type, FACT_ENT_TYPE_BUI)
  ) {
    errs.push(`"-y=${Y}" requires "ent_type=${FACT_ENT_TYPE_BUI}"`)
  }

  const keys = a.keys(inp)
  if (keys.length) errs.push(`unrecognized plot agg opts: ${a.show(keys)}`)
  if (errs.length) throw Error(errs.join(`; `))
  return out
}

function showFilter(key, src) {
  a.reqValidStr(key)
  return a.map(a.optArr(src), val => key + `=` + val).join(` `)
}

export function plotAggStateInit(state) {
  state.Z_X_Y ??= a.Emp()
  state.X_set ??= new Set()
}

export function plotAggFromFacts({facts, opt}) {
  const state = a.Emp()
  plotAggStateInit(state)
  plotAggAddFacts({facts, state, opt})
  const {totalFun} = opt
  return plotAggWithTotals({...plotAggCompact(state), totalFun})
}

export function plotAggAddFacts({facts, state, opt}) {
  for (const fact of a.laxArr(facts)) plotAggAddFact({fact, state, opt})
}

// SYNC[plot_agg_add_data_point].
export function plotAggAddFact({fact, state, opt}) {
  a.reqDict(fact)
  a.reqDict(opt)

  plotAggStateInit(state)
  const {Z_X_Y, X_set} = state
  const {Z: Z_key, X: X_key, aggFun} = opt

  const Z = fact[Z_key]
  if (!a.isKey(Z)) return

  const X = fact[X_key]
  if (!a.isKey(X)) return

  const X_Y = Z_X_Y[Z] ??= a.Emp()
  const Y = fact.stat_val

  /*
  We must skip nils to match SQL semantics, where aggregations skip unknown /
  missing data points. A sequence of values in a series can be disjoint, with
  values interspersed with nulls. We must count only the values, ignoring the
  nulls. Otherwise, rolling averages end up with wrong results, because they'd
  be averaging N values over M [values + nulls].

  SYNC[fold_not_nil].
  */
  if (a.isSome(Y)) {
    if (!X_Y[X]) {
      X_Y[X] = [aggFun(undefined, Y, 0), 0]
    }
    else {
      X_Y[X][1]++
      X_Y[X][0] = aggFun(X_Y[X][0], Y, X_Y[X][1])
    }
  }

  X_set.add(X)
}

export function plotAggCompact({Z_X_Y, X_set}) {
  a.reqDict(Z_X_Y)
  a.reqSet(X_set)

  const Z_vals = a.keys(Z_X_Y).sort()
  const X_vals = a.arr(X_set).sort(u.compareAsc)

  /*
  Produces something like:

    [
      [10, 20, 30], ← Z (plot series).
      [40, 50, 60], ← Z (another plot series).
       ↑ ․․․․․․․ Y_val for X_val at index 0 in X_vals.
           ↑ ․․․ Y_val for X_val at index 1 in X_vals.
               ↑ Y_val for X_val at index 2 in X_vals.
    ]

  Each super-array index corresponds to an index in Z_rows (a serie).
  Each sub-array index corresponds to an index in X_vals.
  Each sub-array value is the Y for that Z and X.

  `a.head` is used here because `plotAggAddFact` makes Y points two-value
  tuples of `[value, count]`, to support calculation of rolling averages.
  Here we unwrap them.
  */
  Z_X_Y = a.map(Z_vals, Z => a.map(X_vals, X => a.head(Z_X_Y[Z][X])))

  dropZeroRows(Z_vals, Z_X_Y)
  return {X_vals, Z_vals, Z_X_Y}
}

export function dropZeroRows(Z, Z_X_Y) {
  a.reqArr(Z)
  a.reqArr(Z_X_Y)
  if (Z.length !== Z_X_Y.length) {
    throw Error(`internal: length mismatch between Z (${Z.length}) and Z_X_Y (${Z_X_Y.length})`)
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

export function plotAggWithTotals({X_vals, Z_vals, Z_X_Y, totalFun}) {
  a.reqArr(X_vals)
  a.reqArr(Z_vals)
  a.reqArr(Z_X_Y)
  a.reqFun(totalFun)

  if (Z_vals.length !== Z_X_Y.length) {
    throw Error(`internal: different length between Z_vals (${Z_vals.length}) and ${Z_X_Y} (${Z_X_Y.length}) in plot aggregate`)
  }

  const Z_totals = a.map(Z_X_Y, val => u.foldSome(val, 0, totalFun))
  const sortedCombined = Z_vals
    .map((Z, ind) => ({Z, X_Y: Z_X_Y[ind], total: Z_totals[ind]}))
    .sort(compareByTotal)

  Z_vals = []
  Z_X_Y = []
  for (const {Z, X_Y} of sortedCombined) {
    Z_vals.push(Z)
    Z_X_Y.push(X_Y)
  }

  const X_total = Z_X_totals(Z_X_Y, totalFun)
  Z_vals = a.prepend(Z_vals, `Total`)
  Z_X_Y = a.prepend(Z_X_Y, X_total)
  return {X_vals, Z_vals, Z_X_Y}
}

function compareByTotal(one, two) {return two.total - one.total}

export function Z_X_totals(Z_X_Y, totalFun) {
  a.reqArrOf(Z_X_Y, a.isArr)
  a.reqFun(totalFun)

  const Z_len = Z_X_Y.length
  const X_len = Z_len ? Z_X_Y[0].length : 0
  const Y_col = Array(Z_len)
  const Z_X_totals = Array(X_len)
  let X = -1

  while (++X < X_len) {
    let Z = -1
    while (++Z < Z_len) Y_col[Z] = Z_X_Y[Z][X]
    Z_X_totals[X] = u.foldSome(Y_col, 0, totalFun)
  }
  return Z_X_totals
}

/*
The game data specifies `bui.SellPrice`. However, at the time of writing, it
only accounts for the building's own cost, but not for any of its upgrades.
Which makes it unusable for our purposes, since we want to calculate cost
efficiency _with_ upgrades.
*/
export function buiCost(type, upg) {
  a.reqStr(type)

  const costs = gc.BUI_COSTS[type]

  if (!costs) {
    // Neutral buildings don't have costs.
    if (type.startsWith(`NB`)) return 0
    if (!LOGGED_MISSING_COSTS[type]) {
      console.error(`missing costs for building type ${a.show(type)}`)
      LOGGED_MISSING_COSTS[type] = true
    }
    return 0
  }

  let out = a.reqFin(costs.base)
  if (!a.isArr(upg) || !upg.length) return out

  const upgCosts = a.optArr(costs.upg)
  if (!upgCosts?.length) {
    if (!LOGGED_MISSING_COSTS[type]) {
      console.error(`building type ${a.show(type)} claims to have upgrades, but we don't have upgrade cost data for it:`, upg)
      LOGGED_MISSING_COSTS[type] = true
    }
    return out
  }

  let ind = -1
  while (++ind < upg.length) {
    const upgInd = upg[ind]?.Index

    if (!a.isNat(upgInd)) {
      if (!LOGGED_MISSING_COSTS[type]) {
        console.error(`unrecognized upgrade format for building type ${a.show(type)}:`, upg)
        LOGGED_MISSING_COSTS[type] = true
        return out
      }
    }

    const upgPair = a.optArr(upgCosts[ind])
    const upgCost = a.isNum(upgInd) ? upgPair?.[upgInd] : undefined

    if (a.isNil(upgCost)) {
      if (!LOGGED_MISSING_COSTS[type]) {
        console.error(`our upgrade cost data seems incomplete for the building type ${a.show(type)}, which claims the following upgrades:`, upg)
        LOGGED_MISSING_COSTS[type] = true
      }
      return out
    }
    out += a.reqFin(upgCost)
  }
  return out
}

export function roundMigrated({round, userId, runNum, runMs}) {
  a.reqObj(round)
  a.reqValidStr(userId)
  a.reqInt(runNum)
  a.reqInt(runMs)

  let out = false

  if (changed(round, `tabularius_fields_schema_version`, ROUND_FIELDS_SCHEMA_VERSION)) out = true
  if (changed(round, `tabularius_user_id`, userId)) out = true
  if (changed(round, `tabularius_run_num`, runNum)) out = true
  if (changed(round, `tabularius_run_ms`, runMs)) out = true

  if (deleted(round, `tabularius_userId`)) out = true
  if (deleted(round, `tabularius_runId`)) out = true
  if (deleted(round, `tabularius_runNum`)) out = true
  if (deleted(round, `tabularius_roundId`)) out = true
  if (deleted(round, `tabularius_createdAt`)) out = true
  if (deleted(round, `tabularius_derivedSchemaVersion`)) out = true
  if (deleted(round, `tabularius_upload_api_version`)) out = true

  // Optional field:
  // round.tabularius_uploaded_at ??= undefined
  return out
}

function changed(tar, key, val) {
  a.reqObj(tar), a.reqStr(key)
  return !a.is(tar[key], (tar[key] = val))
}

function deleted(tar, key) {
  a.reqObj(tar), a.reqStr(key)
  return key in tar && delete tar[key]
}
