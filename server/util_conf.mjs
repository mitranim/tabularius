import * as a from '@mitranim/js/all.mjs'

export const DEV = a.boolOpt(getEnv(`DEV`, `false`))
export const TEST = a.boolOpt(getEnv(`TEST`, `false`))
export const LIVE_PORT = a.vac(DEV) && a.intOpt(getEnv(`LIVE_PORT`, ``))
export const LOG_DEBUG = a.boolOpt(getEnv(`LOG_DEBUG`, `false`))

export function getEnv(key, def) {
  const out = Deno.env.get(key) ?? def
  if (a.isSome(out)) return out
  throw Error(`missing env var ${a.show(key)}`)
}
