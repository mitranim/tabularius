import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as io from '@mitranim/js/io'
import * as tu from '../test_util.mjs'
import * as u from '../util.mjs'
import * as adf from './api_download_file.mjs'

const FILE_TEXT = `mock_text`

await t.test(async function test_fileDownload() {
  const ctx = new tu.TestCtx()
  const dirPath = ctx.userRunsDir
  await io.mkdirSync(dirPath, {recursive: true})

  /*
  Needless to say, one should not bother with compression for files so small.
  The actual files we upload and download are large _and_ highly compressible.
  */
  const files = [
    {
      name: `mock.txt`,
      body: FILE_TEXT,
    },
    {
      name: `mock.txt.gz`,
      body: await u.str_to_gzipByteArr(FILE_TEXT),
    },
  ]

  for (const {name, body} of files) {
    await io.writeFile(pt.join(dirPath, name), body)
  }

  tu.testFailInsecurePaths(a.bind(adf.downloadFile, ctx))

  fail(ctx, ``)
  fail(ctx, `missing_file.txt`)
  fail(ctx, `missing_dir`)
  fail(ctx, dirPath)

  for (const file of files) await testFileDownload(ctx, dirPath, file)
})

async function testFileDownload(ctx, dirPath, {name: fileName, body: fileBody}) {
  const filePath = pt.join(dirPath, fileName)
  await io.writeFile(filePath, fileBody)

  fail(ctx, filePath)

  t.is(
    (await u.reqResBodyText(await adf.downloadFile(ctx, fileName))),
    FILE_TEXT,
  )
}

async function fail(ctx, path) {
  const err = await t.throws(
    async () => await adf.downloadFile(ctx, path),
    u.ErrHttp,
    `unable to find user file at ${a.show(path)}`,
  )
  t.is(err.status, 404)
}
