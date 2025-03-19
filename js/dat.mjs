import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'

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
