import * as a from '@mitranim/js/all.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as u from './util.mjs'

const SCHEMA_PREV = 1
const SCHEMA_NEXT = 2

/*
Assumes the current dir structure (at the time of writing). If we change the
naming format to something entirely incompatible in the future, this may
no longer be idempotent or valid. Should be run only once.
*/
export async function migrateUserRuns(ctx) {
  const out = a.Emp()
  out.userCheck = 0
  out.userMig = 0
  out.runCheck = 0
  out.runMig = 0
  out.roundCheck = 0
  out.roundMig = 0

  const baseDir = ctx.userRunsDir

  userLoop:
  for await (const userId of await u.readDirs(baseDir)) {
    out.userCheck++

    const userDir = io.paths.join(baseDir, userId)
    const runDirs = await u.readRunDirs(userDir)
    if (!runDirs.length) continue
    let userRunsMigrated = 0

    /*
    Check if the last run and round are already migrated.
    If so, we can skip this user's dir.
    */
    {
      runDirs.sort(u.compareDesc)
      const runName = runDirs[0]

      if (!isRunOld(runName)) {
        const runDir = io.paths.join(userDir, runName)
        const roundFiles = (await u.readFiles(runDir)).sort(u.compareDesc)
        const roundName = roundFiles[0]

        if (roundName) {
          const roundFile = io.paths.join(runDir, roundName)
          const round = await u.readDecodeGameFile(roundFile)

          if (!isRoundOld(round)) {
            verb(`[fs_mig] skipping run: latest round up to date:`, a.show(roundFile))
            out.runCheck++
            out.roundCheck++
            continue userLoop
          }
        }
      }
    }

    runDirs.sort(u.compareAsc)

    for (const runName of runDirs) {
      out.runCheck++
      const runDir = io.paths.join(userDir, runName)
      let runRoundsChecked = 0
      let runRoundsMigrated = 0
      let runMs

      for (const roundName of await u.readRoundFiles(runDir)) {
        const roundFile = io.paths.join(runDir, roundName)
        const round = await u.readDecodeGameFile(roundFile)
        runMs ??= a.reqInt(Date.parse(round.LastUpdated))

        runRoundsChecked++
        out.roundCheck++

        if (!isRoundOld(round)) {
          verb(`[fs_mig] skipping up-to-date round:`, a.show(roundFile))
          continue
        }

        round.tabularius_fields_schema_version = SCHEMA_NEXT
        round.tabularius_run_ms = runMs

        await u.writeEncodeGameFile(roundFile, round)
        verb(`[fs_mig] migrated round:`, a.show(roundFile))

        runRoundsMigrated++
        out.roundMig++
      }

      if (!runRoundsChecked) {
        verb(`[fs_mig] deleting empty run dir:`, a.show(runDir))
        await Deno.remove(runDir)
        userRunsMigrated++
        out.runMig++
        continue
      }

      if (isRunNew(runName)) {
        if (runRoundsMigrated) {
          userRunsMigrated++
          out.runMig++
        }
        continue
      }

      if (!runMs) {
        console.error(`[fs_mig] internal: missing runMs for run:`, a.show(runDir))
        continue
      }

      const runNameNext = u.joinKeys(runName, runMs)
      const runDirNext = io.paths.join(userDir, runNameNext)

      await Deno.rename(runDir, runDirNext)
      verb(`[fs_mig] renamed run dir`, a.show(runDir), `to`, a.show(runDirNext))
      userRunsMigrated++
      out.runMig++
    }

    if (userRunsMigrated) out.userMig++
  }

  return out
}

function isRunOld(runName) {
  a.reqValidStr(runName)
  const keys = u.splitKeys(runName)
  return keys.length === 1 && keys.every(u.hasIntPrefix)
}

function isRunNew(runName) {
  a.reqValidStr(runName)
  const keys = u.splitKeys(runName)
  return keys.length === 2 && keys.every(u.hasIntPrefix)
}

function isRoundOld(round) {
  a.reqObj(round)
  return round.tabularius_fields_schema_version === SCHEMA_PREV
}

function isRoundNew(round) {
  a.reqObj(round)
  return round.tabularius_fields_schema_version === SCHEMA_NEXT
}

function isRoundUnknown(round) {
  return !isRoundOld(round) && !isRoundNew(round)
}

function verb(...src) {if (u.LOG_DEBUG) console.debug(...src)}
