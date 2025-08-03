import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as io from '@mitranim/js/io'
import * as tu from '../test_util.mjs'
import * as u from '../util.mjs'
import * as db from '../db.mjs'
import * as aur from './api_upload_round.mjs'
import * as adr from './api_download_round.mjs'

await t.test(async function test_downloadRound() {
  const ctx = new tu.TestCtx()
  const srcUrl = new URL(`../../samples/example_runs.gd`, import.meta.url)
  const srcText = await io.readFileText(srcUrl)
  const rounds = await u.decodeGdStr(srcText)
  const auth = u.authHeadersOpt(tu.TEST_PUBLIC_KEY, tu.TEST_SECRET_KEY)
  const conn = await ctx.conn()
  await db.initSchema(conn)

  function upload(round) {
    a.reqDict(round)

    return aur.uploadRound(ctx, new Request(ctx.apiPath(`upload_round`), {
      method: a.POST,
      body: a.jsonEncode(a.reqDict(round)),
      headers: auth,
    }))
  }

  await t.throws(
    async () => await adr.downloadRound(ctx),
    u.ErrHttp,
    `unable to find round ""`,
  )

  for (const round of rounds) {
    // Upload requires authentication. Pretending that it's all from one user
    // is easier for this test.
    round.tabularius_user_id = tu.TEST_PUB

    const res = await upload(round)
    if (res.redundant) throw Error(`redundant upload: ${res}`)
    if (!res.factCount) throw Error(`empty upload: ${res}`)
  }

  await testDownloadRound(ctx, undefined, {
    user_id: tu.TEST_PUB,
    run_num: 2,
    round_num: 35,
  })

  await testDownloadRound(ctx, tu.TEST_PUB, {
    user_id: tu.TEST_PUB,
    run_num: 2,
    round_num: 35,
  })

  await t.throws(
    async () => await adr.downloadRound(ctx, tu.TEST_PUB + `/1`),
    Error,
    `unable to find round ${a.show(tu.TEST_PUB + `/1`)}`,
  )

  await testDownloadRound(ctx, tu.TEST_PUB + `/2`, {
    user_id: tu.TEST_PUB,
    run_num: 2,
    round_num: 35,
  })

  await testDownloadRound(ctx, tu.TEST_PUB + `/2/30`, {
    user_id: tu.TEST_PUB,
    run_num: 2,
    round_num: 30,
  })

  await testDownloadRound(ctx, tu.TEST_PUB + `/12`, {
    user_id: tu.TEST_PUB,
    run_num: 12,
    round_num: 35,
  })

  await testDownloadRound(ctx, tu.TEST_PUB + `/12/19`, {
    user_id: tu.TEST_PUB,
    run_num: 12,
    round_num: 19,
  })

  await testDownloadRound(ctx, tu.TEST_PUB + `//17`, {
    user_id: tu.TEST_PUB,
    run_num: 2,
    round_num: 17,
  })

  await testDownloadRound(ctx, tu.TEST_PUB + `//`, {
    user_id: tu.TEST_PUB,
    run_num: 2,
    round_num: 35,
  })
})

async function testDownloadRound(ctx, path, {user_id, run_num, round_num}) {
  const res = await adr.downloadRound(ctx, path)
  const text = await u.reqResBodyText(res)
  const data = a.jsonDecode(text)
  t.is(data.tabularius_user_id, user_id)
  t.is(data.tabularius_run_num, run_num)
  t.is(data.RoundIndex, round_num)
}
