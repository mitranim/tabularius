import * as a from '@mitranim/js/all.mjs'
import * as io from '@mitranim/js/io'
import * as hl from '@mitranim/js/http_live.mjs'

export const DEV = a.boolOpt(getEnv(`DEV`, `false`))
export const TEST = a.boolOpt(getEnv(`TEST`, `false`))
export const LIVE_PORT = a.vac(DEV) && a.intOpt(getEnv(`LIVE_PORT`, ``))
export const LIVE = !!LIVE_PORT
export const LOG_DEBUG = a.boolOpt(getEnv(`LOG_DEBUG`, `false`))

export const LIVE_BRO = a.vac(LIVE) && new hl.LiveBroad()
export const LIVE_CLI = a.vac(LIVE) && new hl.LiveClient({port: LIVE_PORT})

export function getEnv(key, def) {
  a.reqStr(key)
  const out = io.ENV[key] ?? def
  if (a.isSome(out)) return out
  throw Error(`missing env var ${a.show(key)}`)
}
