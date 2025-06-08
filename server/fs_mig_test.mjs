import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as tu from './test_util.mjs'
import * as u from './util.mjs'
import * as fm from './fs_mig.mjs'

/*
This test assumes there's a local data directory with some user runs in an older
format, and hardcodes assumptions about the directory structure. That's because
it's not worth generalizing. When we next need an FS migration, we'll change it.
*/
await t.test(async function test_migrateUserRuns() {
  const ctx = new tu.TestCtx()

  await cpDirRec(
    new URL(`../data/user_runs`, import.meta.url),
    ctx.userRunsDir,
  )

  const user = `c04935d40ca33b8fed1f67efb0e4d731dab67e012db132917bf00c3e05bf2457`
  const dir0 = io.paths.join(ctx.userRunsDir, user, `0000`)
  const dir1 = io.paths.join(ctx.userRunsDir, user, `0015`)
  const file0 = `0014.json.gz`
  const file1 = `0034.json.gz`

  testOldRunRoundFormat(
    await u.readDecodeGameFile(io.paths.join(dir0, file0))
  )

  testOldRunRoundFormat(
    await u.readDecodeGameFile(io.paths.join(dir1, file1))
  )

  t.eq(
    await fm.migrateUserRuns(ctx),
    {
      userCheck: 1,
      userMig: 1,
      runCheck: 16,
      runMig: 16,
      roundCheck: 479,
      roundMig: 479,
    },
  )

  await testNotExists(dir0)
  await testNotExists(dir1)

  const runMs0 = 1741482870383
  const runMs1 = 1744498279426

  testNewRunRoundFormat(
    await u.readDecodeGameFile(io.paths.join(ctx.userRunsDir, user, `0000_` + runMs0, file0)),
    runMs0,
  )

  testNewRunRoundFormat(
    await u.readDecodeGameFile(io.paths.join(ctx.userRunsDir, user, `0015_` + runMs1, file1)),
    runMs1,
  )

  t.eq(
    await fm.migrateUserRuns(ctx),
    {
      userCheck: 1,
      userMig: 0,
      runCheck: 1,
      runMig: 0,
      roundCheck: 1,
      roundMig: 0,
    },
  )
})

function testOldRunRoundFormat(round) {
  a.reqRec(round)
  t.is(round.tabularius_fields_schema_version, 1)
  a.is(round.tabularius_run_ms, undefined)
}

function testNewRunRoundFormat(round, runMs) {
  a.reqRec(round)
  a.reqIntPos(runMs)
  t.is(round.tabularius_fields_schema_version, 2)
  a.is(round.tabularius_run_ms, runMs)
}

async function testNotExists(path) {
  const info = await io.FileInfo.statOpt(path)
  if (!info) return
  throw Error(`unexpected file or dir at ${a.show(path)}: ${a.show(info)}`)
}

// Rough equivalent of `cp -r`.
// TODO reimplement to avoid big dependency.
async function cpDirRec(src, out) {
  const {copy} = await import(`https://deno.land/std/fs/mod.ts`)
  await copy(src, out, {overwrite: true})
}

console.log(`[fs_mig_test] done`)
