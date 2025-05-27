/*
Must be kept in sync with the table definitions in `schema.sql`.
*/

import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as gc from './game_const.mjs'

/*
The game doesn't seem to provide its version in the game files. For now, we
attempt to match the latest version and just hope that most of our users update
both the game and our app together, which of course won't happen all the time.
We need the game version actually specified in the game files!
*/
export const GAME_SEMVER = Object.freeze(new u.Semver(1, 11))
export const GAME_VER = GAME_SEMVER.toString()

export const DATA_SCHEMA_VERSION = 6
export const ROUND_FIELDS_SCHEMA_VERSION = 2
export const DATA_DEBUG = false

export const STAT_TYPE_DMG_DONE = `dmg_done`
export const STAT_TYPE_DMG_OVER = `dmg_over`
export const STAT_TYPE_COST_EFF = `cost_eff`
export const STAT_TYPE_DMG_DONE_ACC = `dmg_done_acc`
export const STAT_TYPE_DMG_OVER_ACC = `dmg_over_acc`
export const STAT_TYPE_COST_EFF_ACC = `cost_eff_acc`

export const STAT_TYPES = [
  STAT_TYPE_DMG_DONE,
  STAT_TYPE_DMG_OVER,
  STAT_TYPE_COST_EFF,
  STAT_TYPE_DMG_DONE_ACC,
  STAT_TYPE_DMG_OVER_ACC,
  STAT_TYPE_COST_EFF_ACC,
]

// TODO rename to `bui`.
export const FACT_ENT_TYPE_BUI = `run_round_bui`

// TODO rename to `chi`.
export const FACT_ENT_TYPE_CHI = `run_round_bui_chi`

export const BUI_KIND_NEUTRAL = `Neutral`

export const DAT_TABLES_ALL = Object.freeze(u.dict({
  runs: true,
  run_rounds: true,
  run_buis: true,
  run_round_buis: true,
  round_buis: false,
  facts: true,
}))

const LOGGED_MISSING_COSTS = a.Emp()

/*
Decomposes a round into flatter datasets for convenient aggregation.
The `composite` mode adds fields which are composite keys.
At the moment, they're necessary on both client and server.
If we ever implement support for ephemeral composite keys on the server,
then the composite fields may be skipped when calling this in server code.
*/
export function datAddRound({
  dat, round, user_id, run_num, run_ms, composite, tables = DAT_TABLES_ALL,
}) {
  a.reqObj(dat)
  a.reqDict(round)
  a.reqInt(run_num)
  a.reqNat(run_ms)
  a.reqValidStr(user_id)
  a.optBool(composite)
  a.optBool(tables.runs)
  a.optBool(tables.run_rounds)
  a.optBool(tables.run_buis)
  a.optBool(tables.run_round_buis)
  a.optBool(tables.round_buis)
  a.optBool(tables.facts)

  let DEBUG_LOGGED = false
  const round_num = a.reqInt(round.RoundIndex)

  // Rounds with num 0 never have useful stats.
  if (!round_num) return

  const run_id = makeRunId(user_id, run_num, run_ms)
  const runIds = {user_id}
  if (composite) runIds.run_id = run_id

  const hero = round.HeroType
  const diff = round.DifficultyLevel
  const frontier = round.CurrentExpertScore
  const round_ms = Date.parse(round.LastUpdated) || Date.now()
  const release = gc.findGameReleaseForMs(round_ms)
  const game_ver = a.reqValidStr(release.ver)

  if (tables.runs) {
    dat.runs ??= a.Emp()
    dat.runs[run_id] = {
      game_ver,
      ...runIds,
      run_num,
      run_ms,
      hero,
      diff,
      frontier,
      frontier_doctrines: round.OwnedExpertSkills,
    }
  }

  const round_id = makeRoundId(user_id, run_num, run_ms, round.RoundIndex)
  const roundIds = runIds
  if (composite) roundIds.round_id = round_id

  if (tables.run_rounds) {
    dat.run_rounds ??= a.Emp()
    dat.run_rounds[round_id] = {
      game_ver,
      ...roundIds,
      round_num,
      round_ms,
      expired: round.MarkAsExpired,
      doctrines: round.Skills,
      neutral_odds: round.CurrentNeutralOdds,
    }
  }

  if (!(
    tables.run_buis ||
    tables.run_round_buis ||
    tables.round_buis ||
    tables.facts
  )) {
    return
  }

  for (const [bui_inst_str, bui] of a.entries(round.Buildings)) {
    const bui_inst = a.int(bui_inst_str)
    const bui_type = a.laxStr(bui.EntityID)
    const run_bui_id = u.joinKeys(run_id, bui_inst_str)
    const runBuiIds = {...roundIds, run_bui_id}
    const bui_kind = bui.BuildingType

    if (tables.run_buis) {
      dat.run_buis ??= a.Emp()
      dat.run_buis[run_bui_id] = {
        game_ver,
        ...runBuiIds,
        bui_type,
        bui_kind,
      }
    }

    const run_round_bui_id = u.joinKeys(round_num, run_bui_id)
    const runRoundBuiIds = {...runBuiIds, bui_inst}
    const bui_upg = encodeUpgrades(bui.PurchasedUpgrades)
    const bui_type_upg = u.joinKeys(bui_type, bui_upg)
    const bui_cost = buiCost({
      release,
      bui_type,
      upgs: bui.PurchasedUpgrades,
      sell: bui.SellPrice,
      hero,
    })

    if (tables.run_round_buis) {
      dat.run_round_buis ??= a.Emp()
      dat.run_round_buis[run_round_bui_id] = {
        game_ver,
        ...runRoundBuiIds,
        bui_upg,
        bui_type_upg,
        bui_cost,
        bui_cost_curr: bui.SellCurrencyType,
      }
    }

    if (!(tables.round_buis || tables.facts)) continue
    if (tables.round_buis) dat.round_buis ??= a.Emp()
    if (tables.facts) dat.facts ??= []

    const round_bui = a.Emp()
    round_bui.inst = bui_inst_str
    round_bui.bui_type = bui_type
    round_bui.bui_type_upg = bui_type_upg
    round_bui.cost = bui_cost
    round_bui.wepTypes = new Set()
    round_bui.dumBulTypes = new Set()
    round_bui.enabledWepTypes = new Set()
    round_bui.stats = a.vac(tables.round_buis) && a.Emp()
    if (tables.round_buis) datRoundBuiAddUniq(dat.round_buis, round_bui)

    const baseFact = a.vac(tables.facts) && {
      game_ver,
      run_ms,
      round_ms,
      ...runRoundBuiIds,
      hero,
      diff,
      frontier,
      run_num,
      round_num,
      bui_type,
      bui_type_upg,
    }
    if (baseFact && composite) baseFact.run_round_bui_id = run_round_bui_id

    /*
    A building has `.LiveStats`, `.Weapons`, `.WeaponStats`, `.ChildLiveStats`.

    Damage from the building's own HP, such as for HQ, Barricade, Plasma Fence,
    is only counted in `.LiveStats`.

    Damage from the building's own weapons is counted redundantly in:
    - `.LiveStats`
    - `.WeaponStats`
    - `.ChildLiveStats`

    Damage from the troops spawned by the building, such as JOC assault teams,
    is counted only in `.ChildLiveStats`.

    `.ChildLiveStats` include stats for weapons _and_ so-called "dummy bullets"
    which are associated with weapons. Those stats are duplicated, redundantly.

    As a result, it seems that to compute a building's damage, we must add up:
    - Damage from `.LiveStats` (HP + weapons).
    - Damage from `.ChildLiveStats`, ONLY for non-weapons, non-dummy-bullets.

    In `DATA_DEBUG` mode, we also calculate damages from `.WeaponStats` to
    double-check ourselves.

    TODO: use `timeSpentThisGame` and `timeSpentThisWave` to get uptime, and
    use it to calculate DPS. Then also calculate DPS efficiency.
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

    for (const [ind, wep] of a.entries(bui.Weapons)) {
      const key = a.reqValidStr(wep.EntityID)
      round_bui.wepTypes.add(key)
      if (wep.Enabled) round_bui.enabledWepTypes.add(key)

      const dumBulType = wep.DummyBullet?.EntityID
      if (dumBulType) round_bui.dumBulTypes.add(a.reqStr(dumBulType))

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
      if (round_bui.dumBulTypes.has(chi_type)) continue

      const stats = src?.stats
      if (!stats) continue

      /*
      Child facts are associated with a hypothetical "building child type"
      dimension. We might want to filter or group on specific child types.
      However, for now, we're not creating a table `Dat..dimBuiChi` because
      it would only have 1 field: its primary key. We simply reference this
      missing dimension by child type in child facts.
      */
      const chiFact = baseFact && {
        ...baseFact,
        ent_type: FACT_ENT_TYPE_CHI,
        chi_type,
      }

      if (stats.DamageDone) {
        const statExists = !!a.reqFin(stats.DamageDone.valueThisGame)

        {
          const stat_val = a.reqFin(stats.DamageDone.valueThisGame)
          if (round_bui.wepTypes.has(chi_type)) bui_dmgDone_runAcc_fromWepChi += stat_val
          else bui_dmgDone_runAcc_fromOtherChi += stat_val

          if (chiFact && (statExists || round_bui.enabledWepTypes.has(chi_type))) {
            dat.facts.push({
              ...chiFact,
              stat_type: STAT_TYPE_DMG_DONE_ACC,
              stat_val,
            })
          }
        }

        {
          const stat_val = a.reqFin(stats.DamageDone.valueThisWave)
          if (round_bui.wepTypes.has(chi_type)) bui_dmgDone_round_fromWepChi += stat_val
          else bui_dmgDone_round_fromOtherChi += stat_val

          if (chiFact && (statExists || round_bui.enabledWepTypes.has(chi_type))) {
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
          if (round_bui.wepTypes.has(chi_type)) bui_dmgOver_runAcc_fromWepChi += stat_val
          else bui_dmgOver_runAcc_fromOtherChi += stat_val

          if (chiFact && (statExists || round_bui.enabledWepTypes.has(chi_type))) {
            dat.facts.push({
              ...chiFact,
              stat_type: STAT_TYPE_DMG_OVER_ACC,
              stat_val,
            })
          }
        }

        {
          const stat_val = a.reqFin(stats.DamageOverkill.valueThisWave)
          if (round_bui.wepTypes.has(chi_type)) bui_dmgOver_round_fromWepChi += stat_val
          else bui_dmgOver_round_fromOtherChi += stat_val

          if (chiFact && (statExists || round_bui.enabledWepTypes.has(chi_type))) {
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

    const buiFact = baseFact && {
      ...baseFact,
      ent_type: FACT_ENT_TYPE_BUI,
      chi_type: ``,
    }

    const buiStats = round_bui.stats

    function buiAdd(stat_type, stat_val) {
      if (buiFact) dat.facts.push({...buiFact, stat_type, stat_val})
      if (buiStats) buiStats[stat_type] = stat_val
    }

    if (bui_dmgDone_runAcc_final || !isNeutral) {
      buiAdd(
        STAT_TYPE_DMG_DONE_ACC,
        bui_dmgDone_runAcc_final,
      )
      buiAdd(
        STAT_TYPE_COST_EFF_ACC,
        (bui_cost ? bui_dmgDone_runAcc_final / bui_cost : 0),
      )
    }

    if (bui_dmgDone_round_final || !isNeutral) {
      buiAdd(
        STAT_TYPE_DMG_DONE,
        bui_dmgDone_round_final,
      )
      buiAdd(
        STAT_TYPE_COST_EFF,
        (bui_cost ? bui_dmgDone_round_final / bui_cost : 0),
      )
    }

    if (bui_dmgOver_runAcc_final || !isNeutral) {
      buiAdd(
        STAT_TYPE_DMG_OVER_ACC,
        bui_dmgOver_runAcc_final,
      )
    }

    if (bui_dmgOver_round_final || !isNeutral) {
      buiAdd(
        STAT_TYPE_DMG_OVER,
        bui_dmgOver_round_final,
      )
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

/*
The pseudo-table `round_buis` is intended and supported only for single-round
stats, mainly for `show_round`. It's not even viable for several rounds in a
single run. This internal check should prevent accidental misuse.
*/
function datRoundBuiAddUniq(tar, val) {
  a.reqDict(tar)
  a.reqDict(val)
  const key = a.reqValidStr(val.inst)
  if (!a.hasOwn(tar, key)) return (tar[key] = val)
  throw Error(`internal: redundant building instance ${key}`)
}

// Sums don't exactly match because of float imprecision.
// Below 100, we don't really care.
function isDamageSimilar(one, two) {return (a.laxNum(one) - a.laxNum(two)) < 100}

export function runIdToRunNameReq(src) {
  const out = runIdToRunNameOpt(src)
  if (out) return out
  throw SyntaxError(`unable to convert ${a.show(src)} to run name: it doesn't appear to be a valid run id`)
}

// SYNC[run_id_name_format].
export function runIdToRunNameOpt(src) {
  const seg = u.splitKeys(src)
  if (seg.length < 2) return undefined
  return u.joinKeys(seg[seg.length - 2], seg[seg.length - 1])
}

// Must be used for run directories inside user directories.
export function makeRunName(run_num, run_ms) {
  return u.joinKeys(u.intPadded(run_num), a.reqNat(run_ms))
}

// SYNC[run_id_name_format].
export function splitRunName(src) {
  const [run_num, run_ms] = u.splitKeys(src)
  return [u.toNatReq(run_num), u.toNatReq(run_ms)]
}

// SYNC[run_id_name_format].
export function makeRunId(user_id, run_num, run_ms) {
  return makeRunIdWithName(user_id, makeRunName(run_num, run_ms))
}

export function makeRunIdWithName(user_id, runName) {
  return u.joinKeys(a.reqValidStr(user_id), a.reqValidStr(runName))
}

export function makeRoundId(user_id, run_num, run_ms, round_num) {
  return u.joinKeys(makeRunId(user_id, run_num, run_ms), u.intPadded(round_num))
}

// See `test_encodeUpgrade`.
export function encodeUpgrades(src) {
  return a.map(src, encodeUpgrade).join(``)
}

export function encodeUpgrade(src) {
  const ind = a.onlyNat(src?.Index)
  return ind >= 0 ? `ABCDEFGHIJKLMNOPQRSTUVWXYZ`[ind] : ``
}

export const AGGS = u.dict({
  sum: u.accSum,
  avg: u.accAvg,
  count: u.accCount,
})

export const AGG_TOTALS = u.dict({
  sum: u.accSum,
  avg: u.accAvg,
  count: u.accSum,
})

/*
The "real" Y axis in our plots is always `.stat_val` of facts. Meanwhile, the
"fake" Y axis is

The Y axis in our plots always corresponds to a number aggregated from the field
`.stat_val` of facts.
*/
export const ALLOWED_TOTAL_TYPE_FILTERS = new Set([
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
  `game_ver`,
  `user_id`,
  `run_id`,
  `round_id`,
  `run_bui_id`,
  `run_num`,
  `round_num`,
  `bui_inst`,
  `bui_type`,
  `bui_type_upg`,
  `ent_type`,
  `chi_type`,
  `stat_type`,
])

export const ALLOWED_FILTER_KEYS = new Set([
  `game_ver`,
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
  `frontier`,
])

// SYNC[plot_agg_stats].
export const SUPPORTED_TOTAL_KEYS = new Set([
  `game_ver`,
  `user_id`,
  `run_id`,
  `run_num`,
  `round_id`,
  `bui_inst`,
  `bui_type`,
  `bui_type_upg`,
  `chi_type`,
  `hero`,
  `diff`,
  `frontier`,
])

export const GLOSSARY = u.dict({
  dmg_done: `damage done in round`,
  dmg_done_acc: `damage done in run`,

  dmg_over: `damage overkill in round`,
  dmg_over_acc: `damage overkill in run`,

  cost_eff: `cost efficiency (dmg/cost) in round`,
  cost_eff_acc: `cost efficiency in run`,

  bui_cost: `building cost (base + upgrades)`,

  user_id: `unique user id`,
  run_id: `unique run id`,
  run_num: `run number (from 0); unique per user`,
  round_id: `unique round id`,
  round_num: `round number (from 1); unique per run`,
  stat_type: `one of the damage or efficiency stats`,

  agg: `aggregation type`,
  avg: `average between stat data points`,
  sum: `sum of stat data points`,
  count: `count of unique stat data points`,

  ent_type: `entity type`,
  bui_inst: `building instance`,
  bui_type: `building type`,
  bui_type_upg: `building type with upgrade`,
  chi_type: `building child entity type`,

  run_bui_id: `id of unique building in run`,
  run_round_bui_chi: `child of a building in one round`,
  run_round_bui: `a building in one round`,
  run_round_bui_id: `id of a building in one round`,

  game_ver: `game version (known: ${a.head(gc.GAME_RELEASES).ver} -- ${a.last(gc.GAME_RELEASES).ver})`,
  hero: `commander`,
  diff: `difficulty`,
  frontier: `frontier difficulty`,
})

export const SUPPORTED_TOTAL_KEYS_CHI = [...SUPPORTED_TOTAL_KEYS]
export const SUPPORTED_TOTAL_KEYS_BUI = a.remove(SUPPORTED_TOTAL_KEYS_CHI, `chi_type`)

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

  // SYNC[plot_agg_requires_x].
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

  // SYNC[plot_agg_requires_z].
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
  const msgYUnknown = `opt "-y" must be one of: ${a.show(a.keys(ALLOWED_TOTAL_TYPE_FILTERS))} (unless "-z=stat_type"), got ${Y}`
  const msgYFlag = `-y=` + Y

  // SYNC[plot_group_stat_type_z_versus_y].
  if (Z === `stat_type`) {
    if (a.isNil(Y) || Y === ``) {}
    else if (!u.isIdent(Y)) errs.push(msgYInvalid)
    else if (!ALLOWED_TOTAL_TYPE_FILTERS.has(Y)) errs.push(msgYUnknown)
  }
  else {
    if (!u.isIdent(Y)) errs.push(msgYInvalid)
    else if (!ALLOWED_TOTAL_TYPE_FILTERS.has(Y)) errs.push(msgYUnknown)
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

  // SYNC[plot_agg_requires_agg].
  const agg = u.dictPop(inp, `agg`)
  if (!u.isIdent(agg)) {
    errs.push(`opt "-a" must be a valid aggregate name`)
  }
  else if (!(agg in AGGS)) {
    errs.push(`opt "-a" must be one of: ${a.show(a.keys(AGGS))}`)
  }
  else {
    const totalFun = a.optFun(AGG_TOTALS[agg])
    if (!totalFun) {
      errs.push(`unknown how to calculate total for agg ${a.show(agg)}`)
    }
    else {
      out.agg = agg
      out.aggFun = a.reqFun(AGGS[agg])
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

  const totals = u.dictPop(inp, `totals`)
  if (a.isSome(totals)) {
    if (!a.isArr(totals)) {
      errs.push(`opt "-t" must be an array`)
    }
    else {
      out.totals = []
      for (const val of totals) {
        if (!SUPPORTED_TOTAL_KEYS.has(val)) {
          errs.push(`unsupported value of "-t": ${a.show(val)}`)
        }
        else out.totals.push(val)
      }
    }
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
  state.totalSets ??= a.Emp()
}

export function plotAggFromFacts({facts, opt}) {
  const state = a.Emp()
  plotAggStateInit(state)
  plotAggAddFacts({facts, state, opt})

  const out = plotAggStateToPlotAgg(state)
  if (opt.totals) out.totals = plotAggTotals(state.totalSets)
  return out
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
  X_set.add(X)

  const X_Y = Z_X_Y[Z] ??= a.Emp()
  const Y = fact.stat_val

  // SYNC[plot_agg_stats].
  if (a.optArr(opt.totals)) plotAggAddStats(fact, state.totalSets, opt)

  /*
  We must skip nils to match SQL semantics, where aggregations skip unknown /
  missing data points. A sequence of values in a series can be disjoint, with
  values interspersed with nulls. We must count only the values, ignoring the
  nulls. Otherwise, rolling averages end up with wrong results, because they'd
  be averaging N values over M [values + nulls].

  SYNC[fold_not_nil].
  */
  if (a.isNil(Y)) return

  if (!X_Y[X]) {
    X_Y[X] = [aggFun(undefined, Y, 0), 0]
  }
  else {
    X_Y[X][1]++
    X_Y[X][0] = aggFun(X_Y[X][0], Y, X_Y[X][1])
  }
}

function plotAggAddStats(fact, sets, opt) {
  a.reqObj(fact)
  a.reqObj(sets)

  let keys = a.reqArr(opt.totals)
  if (!keys.length) keys = defaultTotalKeys(opt)

  for (const key of keys) {
    a.reqStr(key)
    if (!(key in fact)) continue
    const set = sets[key] ??= new Set()
    set.add(fact[key])
  }
}

export function plotAggTotals(src) {
  const counts = a.Emp()
  const values = a.Emp()

  for (const [key, val] of a.entries(src)) {
    a.reqStr(key)
    a.reqSet(val)
    counts[key] = val.size
    values[key] = [...val].sort(u.compareAsc)
  }
  return {counts, values}
}

export function plotAggStateToPlotAgg({Z_X_Y, X_set}) {
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

  dropEmptySeries(Z_vals, Z_X_Y)
  return {X_vals, Z_vals, Z_X_Y}
}

export function dropEmptySeries(Z, Z_X_Y) {
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

export function plotAggWithTotalSeries({X_vals, Z_vals, Z_X_Y, totalFun}) {
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
Note: we don't use this when calculating cost efficiency, because it wouldn't
seem to make sense. Cost efficiency is per paid, not per would-be refunded.
*/
export function buiSellPrice(...src) {return buiCost(...src) * gc.SELL_COST_MUL}

/*
The game data specifies `bui.SellPrice`. However, at the time of writing, it
only accounts for the building's own cost, but not for any of its upgrades.
Which makes it unusable for our purposes, since we want to calculate cost
efficiency _with_ upgrades.
*/
export function buiCost({release, bui_type: type, upgs, sell, hero}) {
  a.reqObj(release)
  a.reqStr(type)
  a.optArr(upgs)
  a.optFin(sell)
  a.optStr(hero)

  const costTable = a.reqObj(release.costs)
  const costs = costTable[type]

  if (!costs) {
    // Neutral buildings don't have costs.
    if (type.startsWith(`NB`)) return 0
    if (!LOGGED_MISSING_COSTS[type]) {
      console.error(`missing costs for building type ${a.show(type)}`)
      LOGGED_MISSING_COSTS[type] = true
    }
    return 0
  }

  /*
  SmokSig is a double special case. We handle Trevia here, and the regular 1500
  cost is special-cased in `BUI_COSTS`.
  */
  if (
    type === gc.BUI_CODE_SMOK_SIG &&
    hero === gc.HEROS_TO_CODES_SHORT.Trevia &&
    a.isFin(sell) &&
    // It's always 500 at the time of writing.
    // We're being fuzzy in case of future changes.
    sell >= 100
  ) {
    return sell
  }

  /*
  Jorg's Charge System can cost either 50 or 0. The game reports the sell price.
  The building has no upgrades. So just like with Trevia's SmokSig, we can
  actually use the number provided by the game.
  */
  if (type === gc.BUI_CODE_EXP_CHAR_SYS && a.isFin(sell)) return sell

  let out = a.reqFin(costs.base)
  if (!upgs?.length) return out

  const upgCosts = a.optArr(costs.upg)
  if (!upgCosts?.length) {
    if (!LOGGED_MISSING_COSTS[type]) {
      console.error(`building type ${a.show(type)} claims to have upgrades, but we don't have upgrade cost data for it:`, upgs)
      LOGGED_MISSING_COSTS[type] = true
    }
    return out
  }

  let ind = -1
  while (++ind < upgs.length) {
    const upgInd = upgs[ind]?.Index

    if (!a.isNat(upgInd)) {
      if (!LOGGED_MISSING_COSTS[type]) {
        console.error(`unrecognized upgrade format for building type ${a.show(type)}:`, upgs)
        LOGGED_MISSING_COSTS[type] = true
        return out
      }
    }

    const upgPair = a.optArr(upgCosts[ind])
    const upgCost = a.isNum(upgInd) ? upgPair?.[upgInd] : undefined

    if (a.isNil(upgCost)) {
      if (!LOGGED_MISSING_COSTS[type]) {
        console.error(`our upgrade cost data seems incomplete for the building type ${a.show(type)}, which claims the following upgrades:`, upgs)
        LOGGED_MISSING_COSTS[type] = true
      }
      return out
    }
    out += a.reqFin(upgCost)
  }
  return out
}

export function defaultTotalKeys(opt) {
  const chi = opt?.where?.ent_type?.includes(FACT_ENT_TYPE_CHI)
  if (chi) return SUPPORTED_TOTAL_KEYS_CHI
  return SUPPORTED_TOTAL_KEYS_BUI
}

/*
Converts labels such as `CB01` to `Bunker`, `CB01_ABA` to `Bunker_ABA`, and
other similar things. We could generate and store those names statically, but
doing this dynamically seems more reliable, considering that new entities may
be added later. Updating the table of codes is easier than updating the data.

SYNC[coded_named].
*/
export function codedToNamed(key, val) {
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
Inverse of `codedToNamed`. Should be used to convert user-readable filters such
as `bui_type=Bunker` into coded ones that match the actual fact fields.

SYNC[coded_named].
*/
export function namedToCoded(key, val) {
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

export function roundMigrated({round, userId, runNum, runMs}) {
  a.reqObj(round)
  a.reqValidStr(userId)
  a.reqInt(runNum)
  a.reqInt(runMs)

  let out = false
  if (changed(round, `tabularius_fields_schema_version`, ROUND_FIELDS_SCHEMA_VERSION)) out = true

  if (
    !a.isValidStr(round.tabularius_game_ver) &&
    changed(round, `tabularius_game_ver`, GAME_VER)
  ) out = true

  if (changed(round, `tabularius_user_id`, userId)) out = true
  if (changed(round, `tabularius_run_num`, runNum)) out = true
  if (changed(round, `tabularius_run_ms`, runMs)) out = true

  // Drop deprecated fields.
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

export function changed(tar, key, val) {
  a.reqObj(tar), a.reqStr(key)
  return !a.is(tar[key], (tar[key] = val))
}

export function deleted(tar, key) {
  a.reqObj(tar), a.reqStr(key)
  return key in tar && delete tar[key]
}
