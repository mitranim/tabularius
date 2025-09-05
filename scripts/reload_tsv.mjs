#!/usr/bin/env -S deno run --allow-read --allow-write

import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/all.mjs'
import * as pt from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/path.mjs'
import * as io from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/io_deno.mjs'

const {argv} = globalThis.process
const scriptPath = argv[1]
const srcPath = argv[2]
const outPath = argv[3]

async function main() {
  if (!srcPath || !outPath) {
    const name = pt.name(scriptPath || import.meta.url)
    throw Error(a.str(
      `please specify source and output file paths; example:`,
      `\n\n`,
      `./${name} Progress.gd reload.tsv`,
    ))
  }

  if (srcPath === outPath) {
    throw Error(`source and output paths must be distinct`)
  }

  const round = await readDecodeGameFile(srcPath)

  if (!a.isRec(round)) {
    throw TypeError(`unrecognized format of source data`)
  }

  const wepTimes = new Set()

  for (const bui of a.values(round.Buildings)) {
    const buiCode = a.reqStr(bui.EntityID)

    for (const wep of a.values(bui.Weapons)) {
      const wepCode = a.reqStr(wep.EntityID)
      const time = wep.ReloadTime?.baseValue

      if (a.isNil(time)) {
        console.warn(`missing reload time for ${buiCode}.${wepCode}`)
        continue
      }
      if (!a.isFin(time)) {
        console.warn(`unrecognized format of reload time for ${buiCode}.${wepCode}:`, time)
        continue
      }

      wepTimes.add(joinKeys(wepCode, time))
    }
  }

  const table = [
    [`weapon_code`, `reload_time`],
    ...a.values(wepTimes).sort().map(splitKeys),
  ]
  const tsv = table.map(joinTab).join(`\n`)
  await io.writeFile(outPath, tsv)

  console.log(`wrote TSV to`, outPath)
}

async function readDecodeGameFile(path) {
  const text = (
    path.endsWith(`.gz`)
    ? await textData_to_ungzip_to_str(await io.readFile(path))
    : await io.readFileText(path)
  )
  return decodeGdStr(text)
}

/*
A bunch of utils were copy-pasted from Tabularius `shared/util.mjs`
to make this runnable separately.
*/

async function decodeGdStr(src) {
  src = a.trim(src)
  const out = jsonDecodeOpt(src)
  if (a.isSome(out)) return out
  return a.jsonDecode(await str_to_unbase64_to_ungzip_to_str(src))
}

function str_to_unbase64_to_ungzip_to_str(src) {
  return textData_to_ungzip_to_str(base64Str_to_byteArr(src))
}

function base64Str_to_byteArr(src) {
  return binStr_to_byteArr(atob(a.reqStr(src)))
}

function textData_to_ungzip_to_str(src) {
  return resOkText(new Response(textData_to_ungzipStream(src)))
}

function textData_to_ungzipStream(src) {
  return textDataStream_to_ungzipStream(textData_to_stream(src))
}

function textDataStream_to_ungzipStream(src) {
  return src.pipeThrough(new DecompressionStream(`gzip`))
}

function textData_to_stream(src) {
  return new Response(reqValidTextData(src)).body
}

function binStr_to_byteArr(src) {
  a.reqStr(src)
  const len = src.length
  const out = new Uint8Array(len)
  let ind = -1
  while (++ind < len) out[ind] = src.charCodeAt(ind)
  return out
}

async function resOkText(src) {return (await a.resOk(src)).text()}

function jsonDecodeOpt(src, fun) {
  return isStrJsonLike(src) ? a.jsonDecode(src, fun) : undefined
}

function isStrJsonLike(src) {
  src = a.trim(src)
  return (
    src === `null` ||
    src === `false` ||
    src === `true` ||
    /^-?\d/.test(src) ||
    src.startsWith(`"`) ||
    src.startsWith(`{`) ||
    src.startsWith(`[`)
  )
}

function isValidTextData(val) {
  return a.isStr(val) || a.isInst(val, Uint8Array)
}

function reqValidTextData(val) {
  if (isValidTextData(val)) return val
  throw TypeError(`text data must be a string or a Uint8Array, got ${a.show(val)}`)
}

function joinTab(src) {return a.reqArr(src).join(`\t`)}
function joinKeys(...src) {return src.join(`___`)}
function splitKeys(src) {return a.split(src, `___`)}

if (import.meta.main) await main()
