import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'

const DRY_RUN = false

// SYNC[test_pub].
const TEST_PUB = `e6db4b849dfc5c3c5a3870fa4b01a5855c5424eee3ac9e55f7deeb31e40d4231`

if (import.meta.main) await updateExampleRuns()

async function updateExampleRuns() {
  const url = new URL(`../samples/example_runs.gd`, import.meta.url)
  const rounds = await u.decodeGdStr(await Deno.readTextFile(url))
  let changed = false

  for (const [ind, round] of a.reqArr(rounds).entries()) {
    let userId = (
      round.tabularius_user_id ??
      round.tabularius_userId
    )

    const runNum = (
      round.tabularius_run_num ??
      round.tabularius_runNum
    )

    /*
    This sample data was originally uploaded to Firestore, resulting in
    Firebase user ids. Now that we're migrating to DuckDB and custom auth,
    we rewrite the user id to make it compatible with our own auth, which
    allows our tests to verify that filtering by the current user works
    properly.
    */
    if (userId === `jYr87InSS5RL5z4wwHsdSPk247e2`) {
      userId = TEST_PUB
    }

    if (!u.roundMigrated(round, userId, runNum)) {
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

  await Deno.writeTextFile(url, await u.data_to_json_to_gzip_to_base64Str(rounds))
  console.log(`rounds updated`)
}
