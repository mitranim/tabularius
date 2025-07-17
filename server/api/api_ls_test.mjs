/* global Deno */

import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as tu from '../test_util.mjs'
import * as als from './api_ls.mjs'

await t.test(async function test_apiLs() {
  const ctx = new tu.TestCtx()
  const dirPath = ctx.userRunsDir
  const fileName = `mock.txt`
  const fileText = `mock_text`
  const filePath = pt.join(dirPath, fileName)

  await Deno.mkdirSync(dirPath, {recursive: true})
  await io.writeFile(filePath, fileText)

  tu.testFailInsecurePaths(a.bind(als.apiLsEntry, ctx))

  async function dirTest(path) {
    t.eq(
      await als.apiLsEntry(ctx, path),
      {
        kind: `directory`,
        name: `user_runs`,
        entries: [{kind: `file`, name: fileName}],
      },
    )
  }

  await dirTest(``)
  await dirTest(`.`)

  t.eq(
    await als.apiLsEntry(ctx, fileName),
    {kind: `file`, name: fileName},
  )

  t.is(await als.apiLsEntry(ctx, filePath), undefined)
})
