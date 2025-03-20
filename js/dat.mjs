import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as u from './util.mjs'
import * as fs from './fs.mjs'

const CMD_ANALYZE_HELP = a.spaced(
  `usage: "analyze <run_id>", where run_id`,
  `is the name of an existing run directory,`,
  `containing per-round backups of run progress`,
)

export async function cmdAnalyze(sig, args) {
  u.reqArrOfValidStr(args)
  const id = args[1]
  if (!id || a.len(args) !== 2) return CMD_ANALYZE_HELP
  return `(work in progress)`
}

/*
Placeholder for data transformation code.
See the candidate approaches in `./dat_atomic.mjs` and `./dat_star.mjs`.
*/

// See `test_encodeUpgrade`.
export function encodeUpgrades(src) {
  return a.map(src, encodeUpgrade).join(``)
}

function encodeUpgrade(src) {
  const ind = a.onlyNat(src?.Index)
  return ind >= 0 ? `ABCDEFGHIJKLMNOPQRSTUVWXYZ`[ind] : ``
}

function isRunExpired(src) {return !!src?.MarkAsExpired}
