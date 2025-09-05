import * as a from '@mitranim/js/all.mjs'
import * as io from '@mitranim/js/io'
import * as u from '../server/util.mjs'

const history = new URL(`../local/td_3/history/`, import.meta.url)
const runNames = await io.readDir(history)

const PRIOS = new Set()
const PRIO_TO_BUI = a.Emp()
const PRIO_TO_WEP = a.Emp()
const WEP_TO_PRIO = a.Emp()

for (let runName of runNames) {
  runName = a.render(runName)

  if (!isRunDirName(runName)) continue
  const runDir = new URL(runName + `/`, history)

  for (let roundName of await io.readDir(runDir)) {
    roundName = a.render(roundName)

    if (!isRoundFileName(roundName)) continue

    const path = new URL(roundName, runDir)
    const data = await u.readDecodeGameFile({path})

    for (const bui of a.values(data.Buildings)) {
      for (const wep of a.values(bui.Weapons)) {
        for (const prio of a.values(wep.TargetingPriorities)) {
          PRIOS.add(prio)

          const prioToBui = PRIO_TO_BUI[prio] ??= new Set()
          prioToBui.add(bui.EntityID)

          const prioToWep = PRIO_TO_WEP[prio] ??= new Set()
          prioToWep.add(wep.EntityID)

          const wepToPrio = WEP_TO_PRIO[wep.EntityID] ??= new Set()
          wepToPrio.add(prio)
        }
      }
    }
  }
}

function isRunDirName(val) {
  if (!a.optStr(val)) return false
  const [run_num, run_ms] = u.splitKeys(val)
  return a.isSome(u.toNatOpt(run_num)) && a.isSome(u.toNatOpt(run_ms))
}

function isRoundFileName(name) {
  return u.isGameFileName(name) && u.hasIntPrefix(name)
}

console.log(`PRIOS:`, PRIOS)
console.log(`PRIO_TO_BUI:`, PRIO_TO_BUI)
console.log(`PRIO_TO_WEP:`, PRIO_TO_WEP)
console.log(`WEP_TO_PRIO:`, WEP_TO_PRIO)
