/* global Deno */

import * as a from '@mitranim/js/all.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as s from '../shared/schema.mjs'
import * as u from './util.mjs'

const DRY_RUN = false

if (import.meta.main) await migSamples()

async function migSamples() {await migExampleRuns()}

async function migExampleRuns() {
  const url = new URL(`../samples/example_runs.gd`, import.meta.url)
  const rounds = await u.decodeGdStr(await Deno.readTextFile(url))
  let changed = false

  const runId_to_runMs = a.Emp()

  for (const [ind, round] of a.reqArr(rounds).entries()) {
    const userId = a.reqValidStr(round.tabularius_user_id)
    const runNum = a.reqInt(round.tabularius_run_num)
    const runId = u.joinKeys(userId, runNum)
    const runMs = runId_to_runMs[runId] ??= a.reqInt(Date.parse(round.LastUpdated))

    if (!s.roundMigrated({round, userId, runNum, runMs})) {
      console.log(`round data ${ind} unmodified, skipping`)
      continue
    }

    console.log(`round data ${ind} modified`)
    changed = true
  }

  if (!changed) {
    console.log(`no changes`)
    return
  }

  if (DRY_RUN) {
    console.log(`dry run: skipping pending modifications`)
    return
  }

  await io.writeFile(url, await u.data_to_json_to_gzip_to_base64Str(rounds))
  console.log(`rounds updated`)
}
