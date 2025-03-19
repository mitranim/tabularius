/*
Proposed schema for our resulting data. An extremely flat, atomic approach.
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

/*
For now we assert entity kind as a separate fact.

TODO consider moving it to entity ids instead, as a prefix.

TODO missing facts and stats:
- Game version.
- Is weapon enabled or not.
- Do include zero damage stats for weapons which were enabled at some point.
- Precalculate sell cost in Supply (convert other resources).
- Precalculate cost efficiency (dmg per cost).
*/
const KEY_KIND = `kind`
const KEY_TYPE = `type`
const KEY_GROUP = `group`
const KEY_UPG = `upg`
const KEY_TYPE_UPG = u.joinKeys(KEY_TYPE, KEY_UPG)
const KEY_INDEX = `ind`
const KEY_EXPIRED = `exp`
const KEY_COST = `cost`
const KEY_CURRENCY = `curr`
const KEY_DMG_DONE_GAME = `dmg_done_game`
const KEY_DMG_DONE_ROUND = `dmg_done_round`

const KIND_RUN = `run`
const KIND_ROUND = `round`
const KIND_BUILDING = `bui`
const KIND_WEAPON = `wep`

/*
Keys for relations. TODO consider: it may be viable to use the same key for
all relations. On a single entity id, we can repeat it to assign multiple
relations. This would lose information, but could simplify some relational
queries, such as fetching all facts related to some entity transitively.
*/
const KEY_USER_ID = `user`
const KEY_RUN_ID = KIND_RUN // Accidentally identical.
const KEY_WAVE_ID = KIND_ROUND // Accidentally identical.
const KEY_BUILDING_ID = KIND_BUILDING // Accidentally identical.

async function fetchJson(path) {
  const url = new URL(path, import.meta.url)
  const res = await a.resOk(fetch(url))
  return res.json()
}

const SRC_ROUNDS = await fetchJson(`../data/rounds_example.json`)
console.log(SRC_ROUNDS)

const FACTS = []

function fact(id, key, val) {
  a.reqKey(id)
  a.reqKey(key)
  if (!a.vac(val)) return // Skip empty facts.
  FACTS.push([id, key, val])
}

fact(RUN_ID, KEY_KIND, KIND_RUN)
fact(RUN_ID, KEY_USER_ID, USER_ID)

console.time(`build`)
for (const round of SRC_ROUNDS) {
  const roundId = u.joinKeys(RUN_ID, u.intToOrdStr(round.RoundIndex))

  fact(roundId, KEY_KIND, KIND_ROUND)
  fact(roundId, KEY_USER_ID, USER_ID) // Denormalized for easy querying.
  fact(roundId, KEY_RUN_ID, RUN_ID)
  fact(roundId, KEY_INDEX, round.RoundIndex)
  fact(roundId, KEY_EXPIRED, round.MarkAsExpired)

  let buiOrd = -1
  for (const [key, building] of a.entries(round.Buildings)) {
    buiOrd++
    const buildingId = u.joinKeys(roundId, u.intToOrdStr(buiOrd))

    fact(buildingId, KEY_KIND, KIND_BUILDING)
    fact(buildingId, KEY_USER_ID, USER_ID) // Denormalized for easy querying.
    fact(buildingId, KEY_RUN_ID, RUN_ID) // Denormalized for easy querying.
    fact(buildingId, KEY_WAVE_ID, roundId) // Denormalized for easy querying.
    fact(buildingId, KEY_GROUP, a.intOpt(key) || key)
    fact(buildingId, KEY_TYPE, building.EntityID)
    fact(buildingId, KEY_COST, building.SellPrice)
    fact(buildingId, KEY_CURRENCY, building.SellCurrencyType)

    const upg = d.encodeUpgrades(building.PurchasedUpgrades)
    if (upg) {
      fact(buildingId, KEY_UPG, upg)
      fact(buildingId, KEY_TYPE_UPG, u.joinKeys(building.EntityID, upg))
    }

    const stats = building.LiveStats?.stats?.DamageDone
    if (stats) {
      fact(buildingId, KEY_DMG_DONE_GAME, stats.valueThisGame)
      fact(buildingId, KEY_DMG_DONE_ROUND, stats.valueThisWave)
    }

    for (const [ind, val] of a.entries(building.Weapons)) {
      const stats = building.WeaponStats?.[ind]?.stats?.DamageDone
      if (!stats) continue

      const id = u.joinKeys(buildingId, u.intToOrdStr(ind))
      fact(id, KEY_KIND, KIND_WEAPON)
      fact(id, KEY_USER_ID, USER_ID) // Denormalized for easy querying.
      fact(id, KEY_RUN_ID, RUN_ID) // Denormalized for easy querying.
      fact(id, KEY_WAVE_ID, roundId) // Denormalized for easy querying.
      fact(id, KEY_BUILDING_ID, buildingId) // Denormalized for easy querying.
      fact(id, KEY_DMG_DONE_GAME, stats.valueThisGame)
      fact(id, KEY_DMG_DONE_ROUND, stats.valueThisWave)
    }
  }
}
console.timeEnd(`build`)

function factsToDamagePerRoundPerBuildingType(src) {
  src = a.values(src)
  const kinds = factsToIndexByKey(src, KEY_KIND)
  const roundIdToRoundIndex = a.Emp()
  const buildingIdToBuilding = a.Emp()

  for (const [id, key, val] of src) {
    if (kinds[id] === KIND_ROUND) {
      if (key === KEY_INDEX) roundIdToRoundIndex[id] = val
      continue
    }

    if (kinds[id] === KIND_BUILDING) {
      // Select only what we need.
      if (
        key === KEY_WAVE_ID ||
        key === KEY_TYPE ||
        key === KEY_UPG ||
        key === KEY_COST ||
        key === KEY_DMG_DONE_ROUND
      ) {
        (buildingIdToBuilding[id] ??= a.Emp())[key] = val
      }
    }
  }

  const buildingPerRoundPerTypeToStat = a.Emp()

  for (const src of a.values(buildingIdToBuilding)) {
    const label = u.joinKeys(src.type, src.upg)
    const key = u.joinKeys(src.round, label)
    const tar = buildingPerRoundPerTypeToStat[key] ??= a.Emp()
    tar.label = label
    tar.round = roundIdToRoundIndex[src.round]
    tar.dmg = a.laxFin(tar.dmg) + a.laxFin(src.dmg_done_round)
    // Unused below, but we could make another dataset with efficiency as a metric.
    tar.eff = tar.dmg ? a.laxFin(tar.dmg) / a.laxFin(src.cost) : 0
  }

  console.log(roundIdToRoundIndex)
  console.log(buildingIdToBuilding)
  console.log(buildingPerRoundPerTypeToStat)

  /*
  The source data for a line chart is 3-dimensional:
    - label
    - X number
    - Y number
  */
  const out = []
  for (const val of a.values(buildingPerRoundPerTypeToStat)) {
    out.push([val.label, val.round, val.dmg])
  }
  return out
}

function factsToIndexes(src, ...funs) {
  const len = funs.length
  const out = a.times(len, a.Emp)
  if (!len) return out

  for (src of a.values(src)) {
    let ind = -1
    while (++ind < len) {
      const fun = funs[ind]
      fun(out[ind], src)
    }
  }
  return out
}

function foldEnt(out, [id, key, val]) {
  const ent = out[id] ??= a.Emp()
  if (!(key in ent)) {
    ent[key] = val
    return
  }

  const prev = ent[key]
  if (a.is(prev, val)) return
  if (a.isArr(prev)) prev.push(val)
  else if (a.isArr(val)) ent[key] = a.prepend(val, prev)
  else ent[key] = [prev, val]
}

function factsToIndexByKey(src, expKey) {
  a.reqKey(expKey)
  const out = a.Emp()
  for (const [id, key, val] of a.values(src)) {
    if (key === expKey) out[id] = val
  }
  return out
}

function factsToIndexByKeys(src, keys) {
  const set = new Set()
  for (const key of a.values(keys)) set.add(a.reqValidStr(key))
  const out = a.Emp()
  for (const [id, key, val] of a.values(src)) {
    if (set.has(key)) (out[id] ??= a.Emp())[key] = val
  }
  return out
}

// console.log(`rounds JSON size:`, a.jsonEncode(SRC_ROUNDS).length)
console.log(`JSON size:`, a.jsonEncode(FACTS).length)
console.log(`JSON gzip size:`, (await u.gzipBytes(a.jsonEncode(FACTS))).length)
// console.log(a.jsonEncode(SRC_ROUNDS))
// console.log(a.jsonEncode(FACTS))
// console.table(FACTS)
// console.log(factsToIndexes(FACTS, foldEnt))

console.time(`agg`)
console.log(factsToDamagePerRoundPerBuildingType(FACTS))
console.timeEnd(`agg`)
