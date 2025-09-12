/*
Usage:

  deno run --allow-import bui_costs.mjs

Requires `deno.json` in the same dir with the following content:

  {
    "imports": {
      "@mitranim/js/": "https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/"
    }
  }
*/

import * as a from '@mitranim/js/all.mjs'
import * as gc from 'https://mitranim.com/tabularius/shared/game_const.mjs'

const COSTS = a.Emp()
const UPG_PATHS = upgPaths()

for (let [code, {base, upg}] of a.entries(gc.BUI_COSTS_1_47)) {
  a.reqStr(code)
  a.reqFin(base)
  a.optArr(upg)

  const bui_type = gc.codeToNameShort(code)

  if (!upg) {
    COSTS[bui_type] = base
    continue
  }

  function addUpg(acc, upgInd, ind) {return acc + a.reqFin(upg[ind][upgInd])}

  for (const path of UPG_PATHS) {
    const bui_type_upg = joinKeys(bui_type, encodeUpgradePath(path))
    COSTS[bui_type_upg] = path.reduce(addUpg, base)
  }
}

const COST_LIST = []
for (const [bui_type_upg, cost] of a.entries(COSTS)) {
  COST_LIST.push({bui_type_upg, cost})
}
COST_LIST.sort(compareByCost)

console.table(COST_LIST)

/* Utils */

function upgPaths() {
  const vals = [0, 1]
  const out = []
  for (const val0 of vals) {
    for (const val1 of vals) {
      for (const val2 of vals) {
        out.push([val0, val1, val2])
      }
    }
  }
  return out
}

function encodeUpgradePath(src) {return a.map(src, encodeUpgrade).join(``)}

function encodeUpgrade(ind) {
  return `ABCDEFGHIJKLMNOPQRSTUVWXYZ`[a.reqNat(ind)] || ``
}

function joinKeys(...src) {return a.joinOptLax(src, `_`)}

function compareByCost(one, two) {return two.cost - one.cost}
