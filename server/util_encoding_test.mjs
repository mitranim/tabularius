/* global Deno */

import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as tu from './test_util.mjs'
import * as u from './util.mjs'

const TEST_PROGRESS = await Deno.readTextFile(new URL(`../samples/example_progress.gd`, import.meta.url))

await t.test(async function test_decoding_encoding_roundtrip() {
  const srcData = await u.decodeGdStr(TEST_PROGRESS)
  a.reqDict(srcData)
  a.reqInt(srcData.RoundIndex)

  const outText = await u.data_to_json_to_gzip_to_base64Str(srcData)
  const outData = await u.decodeGdStr(outText)
  a.reqDict(outData)
  a.reqInt(outData.RoundIndex)
})

await t.test(async function test_gzip_roundtrip() {
  const ctx = new tu.TestCtx()
  const srcData = await u.decodeGdStr(TEST_PROGRESS)
  a.reqDict(srcData)
  a.reqInt(srcData.RoundIndex)

  const outPath = pt.join(ctx.tmpDir, `example_progress.json.gz`)
  const outBin = await u.data_to_json_to_gzipByteArr(srcData)
  await io.writeFile(outPath, outBin)
  const outData = await u.textData_to_ungzip_to_unjsonData(await Deno.readFile(outPath))
  a.reqDict(outData)
  a.reqInt(outData.RoundIndex)
})

t.test(function test_hexStr_to_byteArr() {
  function test(src, exp) {
    const out = u.hexStr_to_byteArr(src)
    t.eq(out, exp)
    t.is(u.byteArr_to_hexStr(out), src)
  }

  test(`6f90e1085d3d4879b8c432a39103490c`, new Uint8Array([0x6f, 0x90, 0xe1, 0x08, 0x5d, 0x3d, 0x48, 0x79, 0xb8, 0xc4, 0x32, 0xa3, 0x91, 0x03, 0x49, 0x0c]))
  test(`eb69807b74c040ef98848efddb34a4a6`, new Uint8Array([0xeb, 0x69, 0x80, 0x7b, 0x74, 0xc0, 0x40, 0xef, 0x98, 0x84, 0x8e, 0xfd, 0xdb, 0x34, 0xa4, 0xa6]))
  test(`5c63a8a932884fc08ed96e859d18f88574ceaaaf79e84432bd46f0714614bdf1`, new Uint8Array([0x5c, 0x63, 0xa8, 0xa9, 0x32, 0x88, 0x4f, 0xc0, 0x8e, 0xd9, 0x6e, 0x85, 0x9d, 0x18, 0xf8, 0x85, 0x74, 0xce, 0xaa, 0xaf, 0x79, 0xe8, 0x44, 0x32, 0xbd, 0x46, 0xf0, 0x71, 0x46, 0x14, 0xbd, 0xf1]))
  test(`f29d7fdd8b744ff9a71c6475b78715931969fcf2a579421783f2d8982aa436a2`, new Uint8Array([0xf2, 0x9d, 0x7f, 0xdd, 0x8b, 0x74, 0x4f, 0xf9, 0xa7, 0x1c, 0x64, 0x75, 0xb7, 0x87, 0x15, 0x93, 0x19, 0x69, 0xfc, 0xf2, 0xa5, 0x79, 0x42, 0x17, 0x83, 0xf2, 0xd8, 0x98, 0x2a, 0xa4, 0x36, 0xa2]))
})
