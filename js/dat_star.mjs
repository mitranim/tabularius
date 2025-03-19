/*
Proposed schema for our resulting data. A variation of a "star schema".
We would transforming the source data (progress file contents) into this.
*/

import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as t from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/test.mjs'
import * as d from './dat.mjs'
import * as u from './util.mjs'

// Hardcoded for now. Will be dynamic later.
const USER_ID = `user`

/*
Hardcoded for now. Will be dynamic later.
Each user has multiple runs.
Each run has multiple rounds.
Each round has multiple buildings.
Each building has multiple weapons.
Weapons have stats.
Buildings have stats aggregated from weapons.
*/
const RUN_ID = `run`

async function fetchJson(path) {
  const url = new URL(path, import.meta.url)
  const res = await a.resOk(fetch(url))
  return res.json()
}

const SRC_ROUNDS = await fetchJson(`../data/rounds_example.json`)
const BUILDING_CODES = await fetchJson(`../data/building_codes.json`)
console.log(SRC_ROUNDS)

const FACTS = []
const DIM_RUN = a.bmap()
const DIM_ROUND = a.bmap()
const DIM_BUILDING_ENT_TYPE = a.bmap()
const DIM_BUILDING_ENT_TYPE_UPG = a.bmap()
const DIM_BUILDING_BY_RUN = a.bmap()

const DIMS = [
  DIM_RUN,
  DIM_ROUND,
  DIM_BUILDING_ENT_TYPE,
  DIM_BUILDING_ENT_TYPE_UPG,
  DIM_BUILDING_BY_RUN,
]

/*
Missing fields and stats (TODO):
- Game version.
- Precalculate sell cost in Supply (converting other resources).
- Precalculate cost efficiency.
*/
const STAT_TYPE_DMG_DONE = `dmg_done`
const STAT_TYPE_DMG_OVER = `dmg_over`
const STAT_SCOPE_RUN_ACC = `run_acc`
const STAT_SCOPE_ROUND = `round`
const BUILDING_TYPE_NEUTRAL = `Neutral`

console.time(`build`)
for (const round of SRC_ROUNDS) {
  if (!DIM_RUN.has(RUN_ID)) {
    DIM_RUN.set(RUN_ID, {
      userId: USER_ID,
      runId: RUN_ID,
      hero: round.HeroType,
      diff: round.DifficultyLevel,
      frontierLevel: round.CurrentExpertScore,
      frontierDoctrines: round.OwnedExpertSkills,
      // TODO game version!
    })
  }

  const roundIndex = a.reqInt(round.RoundIndex)

  // Currently locally unique. When we add a cloud DB, we'll change this to DB's
  // unique document id.
  const roundId = u.joinKeys(RUN_ID, u.intToOrdStr(roundIndex))

  DIM_ROUND.set(roundId, {
    userId: USER_ID,
    runId: RUN_ID,
    roundId,
    roundIndex,
    expired: round.MarkAsExpired,
    doctrines: round.Skills,
    neutralOdds: round.CurrentNeutralOdds,
  })

  for (const [buildingGameEngineInstId, building] of a.entries(round.Buildings)) {
    const buildingEntType = a.laxStr(building.EntityID)
    const buildingName = BUILDING_CODES[buildingEntType] || buildingEntType
    const buildingByEntType = {
      buildingEntType,
      buildingName,
    }
    if (!DIM_BUILDING_ENT_TYPE.has(buildingEntType)) {
      DIM_BUILDING_ENT_TYPE.set(buildingEntType, buildingByEntType)
    }

    const buildingUpg = d.encodeUpgrades(building.PurchasedUpgrades)
    const buildingEntTypeUpg = u.joinKeys(buildingEntType, buildingUpg)
    const buildingEntTypeUpgName = buildingName ? a.spaced(buildingName, buildingUpg) : buildingEntTypeUpg
    const buildingByEntTypeUpg = {
      ...buildingByEntType,
      buildingEntTypeUpg,
      buildingEntTypeUpgName,
    }
    if (!DIM_BUILDING_ENT_TYPE_UPG.has(buildingEntTypeUpg)) {
      DIM_BUILDING_ENT_TYPE_UPG.set(buildingEntTypeUpg, buildingByEntTypeUpg)
    }

    const buildingByRunId = u.joinKeys(RUN_ID, buildingGameEngineInstId)
    const buildingType = building.BuildingType
    if (!DIM_BUILDING_BY_RUN.has(buildingByRunId)) {
      const buildingByRun = {
        ...buildingByEntTypeUpg,
        buildingByRunId,
        buildingType,
        sellPrice: building.SellPrice,
        sellCurrency: building.SellCurrencyType,
        // sellSupply: TODO precalculate by converting other currencies.
      }
      DIM_BUILDING_BY_RUN.set(buildingByRunId, buildingByRun)
    }

    const buildingFact = {
      userId: USER_ID,
      runId: RUN_ID,
      roundId,
      roundIndex,
      buildingByRunId,
      buildingType,
    }

    const buildingStatsDmgDone = building.LiveStats?.stats?.DamageDone
    if (buildingStatsDmgDone) {
      const {valueThisGame, valueThisWave} = buildingStatsDmgDone

      if (valueThisGame) {
        FACTS.push({
          ...buildingFact,
          statType: STAT_TYPE_DMG_DONE,
          statScope: STAT_SCOPE_RUN_ACC,
          statValue: valueThisGame,
        })
      }

      if (valueThisWave) {
        FACTS.push({
          ...buildingFact,
          statType: STAT_TYPE_DMG_DONE,
          statScope: STAT_SCOPE_ROUND,
          statValue: valueThisWave,
        })
      }
    }

    const dmgDone = building.LiveStats?.stats?.DamageDone
    FACTS.push(...damageFacts(buildingFact, dmgDone, STAT_TYPE_DMG_DONE, buildingType === BUILDING_TYPE_NEUTRAL))

    const dmgOver = building.LiveStats?.stats?.DamageOverkill
    FACTS.push(...damageFacts(buildingFact, dmgOver, STAT_TYPE_DMG_OVER, buildingType === BUILDING_TYPE_NEUTRAL))

    for (const [ind, wep] of a.entries(building.Weapons)) {
      const stats = building.WeaponStats?.[ind]?.stats
      if (!stats) continue

      /*
      Weapon entity type is certainly a viable dimension. We might want to query
      damage facts per weapon entity type for specific buildings. However, for
      now, we're not creating a table `DIM_WEAPON_TYPE` because it would only
      have 1 column: its primary key. We simply "reference" this missing
      dimension by weapon entity type in weapon facts.
      */
      const weaponEntType = wep.EntityID
      const wepFact = {...buildingFact, weaponEntType}

      const dmgDone = stats.DamageDone
      FACTS.push(...damageFacts(wepFact, dmgDone, STAT_TYPE_DMG_DONE, false))

      const dmgOver = stats.DamageOverkill
      FACTS.push(...damageFacts(wepFact, dmgOver, STAT_TYPE_DMG_OVER, false))
    }
  }
}
console.timeEnd(`build`)

function damageFacts(fact, stat, type, skipZero) {
  a.reqDict(fact)
  a.optDict(stat)
  a.reqValidStr(type)

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

function factsToDamagePerRoundPerBuildingType() {
  const agg = a.Emp()

  for (const fact of FACTS) {
    if (fact.statType !== STAT_TYPE_DMG_DONE) continue
    if (fact.statScope !== STAT_SCOPE_ROUND) continue
    if (fact.weaponEntType) continue

    const building = DIM_BUILDING_BY_RUN.get(fact.buildingByRunId)
    const label = a.reqValidStr(building.buildingEntTypeUpg)
    const round = a.reqInt(fact.roundIndex)
    const key = u.joinKeys(label, round)

    const tar = agg[key] ??= a.Emp()
    tar.label = label
    tar.round = round
    tar.dmg = a.laxFin(tar.dmg) + a.laxFin(fact.statValue)
    // Unused below, but we could make another dataset with efficiency as a metric.
    tar.eff = tar.dmg ? a.laxFin(tar.dmg) / a.laxFin(building.sellPrice) : 0
  }

  /*
  The source data for a line chart is 3-dimensional:
    - label
    - X number
    - Y number
  The grouping by label is done by chart-drawing code.
  */
  const out = []
  for (const val of a.values(agg)) {
    out.push([val.label, val.round, val.dmg])
  }
  return out
}

console.log(`JSON size:`, a.jsonEncode([DIMS, FACTS]).length)
console.log(`JSON gzip size:`, (await u.gzipBytes(a.jsonEncode([DIMS, FACTS]))).length)
console.log(`dimensions:`, DIMS)
console.log(`facts:`, FACTS)
// console.log(JSON.stringify([DIMS, FACTS], null, 2))

console.time(`agg`)
console.log(factsToDamagePerRoundPerBuildingType())
console.timeEnd(`agg`)
