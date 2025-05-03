import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import * as s from '../shared/schema.mjs'
import * as fs from './fs.mjs'
import {E} from './util.mjs'
import * as u from './util.mjs'

const SCHEMA_PREV = 1
const SCHEMA_NEXT = 2

/*
Assumes the current dir structure (at the time of writing). If we change the
naming format to something entirely incompatible in the future, this may
no longer be idempotent or valid.

TODO: use a cross-tab mutex.

SYNC[fs_mig].
*/
export async function migrateRuns() {
  const state = o.obs({
    status: `migrating`,
    runsChecked: 0,
    runsMigrated: 0,
    roundsChecked: 0,
    roundsMigrated: 0,
  })
  let logged = false

  const root = fs.HISTORY_DIR_CONF.handle
  if (!root) {
    u.log.info(`[fs_mig] skipping migration: history dir handle not available`)
    return state
  }

  if (!await fs.hasPermission(root, {mode: `readwrite`})) {
    u.log.info(`[fs_mig] skipping migration: insufficient permissions on history dir`)
    return state
  }

  /*
  Un-cancelable background signal. We want this migration to run to completion,
  if possible. We only bother to use a signal here because much of our utility
  code requires one.
  */
  const sig = u.sig
  const runDirs = await fs.readRunsAsc(sig, root)
  if (!runDirs.length) return state

  /*
  Check if the last run and round are already migrated.
  If so, we can skip the migration completely.
  */
  {
    runDirs.sort(fs.compareHandlesDesc)
    const runHandle = runDirs[0]
    const runName = runHandle.name

    if (!isRunOld(runName)) {
      const roundFiles = await fs.readRunRoundHandlesDesc(sig, runHandle)
      const roundHandle = a.head(roundFiles)

      if (roundHandle) {
        const round = await fs.readDecodeGameFile(sig, roundHandle)

        if (!isRoundOld(round)) {
          u.log.verb(`[fs_mig] skipping migration: latest run and round up to date`)
          state.runsChecked++
          state.roundsChecked++
          return state
        }
      }
    }
  }

  runDirs.sort(fs.compareHandlesAsc)

  for (const runHandle of runDirs) {
    state.runsChecked++
    const runDirName = a.reqValidStr(runHandle.name)
    let runRoundsChecked = 0
    let runRoundsMigrated = 0
    let runMs

    if (!logged) {
      u.log.info(u.LogLines(
        `[fs_mig] updating the history dir to a newer schema; might take a minute because browser file system API is slow; current progress:`,
        new FsMigProg(state),
      ))
      logged = true
    }

    for (const roundHandle of await fs.readRunRoundHandlesAsc(sig, runHandle)) {
      const roundPath = u.paths.join(runDirName, roundHandle.name)
      const round = await fs.readDecodeGameFile(sig, roundHandle)

      runMs ??= a.reqInt(Date.parse(round.LastUpdated))
      runRoundsChecked++
      state.roundsChecked++

      if (!isRoundOld(round)) {
        u.log.verb(`[fs_mig] skipping up-to-date round: ${a.show(roundPath)}`)
        continue
      }

      round.tabularius_fields_schema_version = SCHEMA_NEXT
      round.tabularius_run_ms = runMs

      await fs.writeEncodeGameFile(sig, roundHandle, round)
      u.log.verb(`[fs_mig] migrated round: ${a.show(roundPath)}`)

      runRoundsMigrated++
      state.roundsMigrated++
    }

    if (!runRoundsChecked) {
      u.log.verb(`[fs_mig] unexpected empty run dir: `, runDirName)
      continue
    }

    if (isRunNew(runDirName)) {
      if (runRoundsMigrated) state.runsMigrated++
      continue
    }

    if (!runMs) {
      u.log.err(`[fs_mig] internal: missing runMs for run: ${a.show(runDirName)}`)
      continue
    }

    await migrateRunDir({
      sig, state, dirHandleParent: root, dirHandlePrev: runHandle, runMs,
    })
    state.runsMigrated++
  }

  state.status = `FS migration done`
  return state
}

/*
For migrating a run dir when renaming is needed,
after migrating all the round files inside.
TODO generalize into `fs.cpDir`.
*/
async function migrateRunDir({
  sig, state, dirHandleParent, dirHandlePrev, runMs,
}) {
  u.reqSig(sig)
  a.reqInst(dirHandleParent, FileSystemDirectoryHandle)
  a.reqInst(dirHandlePrev, FileSystemDirectoryHandle)

  const dirNamePrev = a.reqValidStr(dirHandlePrev.name)
  const dirNameNext = s.makeRunName(u.toIntReq(dirNamePrev), runMs)
  const dirPathNext = u.paths.join(dirHandleParent.name, dirNameNext)

  state.status = `creating new run directory ` + dirNameNext
  const dirHandleNext = await fs.getDirectoryHandle(sig, dirHandleParent, dirNameNext, {create: true})

  try {
    state.status = `inspecting contents of directory ` + dirNamePrev
    const handles = await fs.readRunRoundHandlesAsc(sig, dirHandlePrev)

    for (const file of handles) {
      state.status = `writing file ` + a.show(u.paths.join(dirHandleNext.name, file.name))

      console.time(`writing_file`)
      // TODO generalize into `fs.cpFile`.
      await fs.writeDirFile(
        sig, dirHandleNext, file.name,
        await fs.readFileText(sig, file),
      )
      console.timeEnd(`writing_file`)
    }

    u.log.verb(`[fs_mig] copied run dir ${a.show(dirNamePrev)} to ${a.show(dirPathNext)}`)
  }
  catch (err) {
    state.status = `error`
    u.log.err(`[fs_mig] unable to migrate run dir ${a.show(dirNamePrev)}: ${err}`)

    // Clean up new dir on error.
    console.time(`deleting_err`)
    await dirHandleParent.removeEntry(dirNameNext, {recursive: true})
    console.timeEnd(`deleting_err`)

    throw err
  }

  // Drop old dir on success.
  console.time(`deleting_old_dir`)
  await dirHandleParent.removeEntry(dirNamePrev, {recursive: true})
  console.timeEnd(`deleting_old_dir`)
  u.log.verb(`[fs_mig] removed run dir ${a.show(dirNamePrev)}`)
}

export class FsMigProg extends u.ReacElem {
  constructor(state) {
    super()
    this.state = a.reqObj(state)
  }

  run() {
    const {status, runsChecked, runsMigrated, roundsChecked, roundsMigrated} = this.state

    E(this, {}, u.joinLines(
      `  status: ${status}`,
      `  runs checked: ${runsChecked}`,
      `  runs migrated: ${runsMigrated}`,
      `  rounds checked: ${roundsChecked}`,
      `  rounds migrated: ${roundsMigrated}`,
    ))
  }
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
  return (
    !round.tabularius_fields_schema_version ||
    round.tabularius_fields_schema_version === SCHEMA_PREV
  )
}

function isRoundNew(round) {
  a.reqObj(round)
  return round.tabularius_fields_schema_version === SCHEMA_NEXT
}

function _isRoundUnknown(round) {
  return !isRoundOld(round) && !isRoundNew(round)
}
