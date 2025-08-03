import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as cl from '@mitranim/js/cli.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as h from '@mitranim/js/http'
import * as io from '@mitranim/js/io'
import * as u from '../shared/util.mjs'
import * as us from './util_srv.mjs'
import * as ud from './util_db.mjs'

export const FLAG = cl.Flag.os()
export const RUN = FLAG.get(`--run`)

t.conf.setTestFilter(RUN)
t.conf.setBenchFilter(RUN)

// Indicates benchmark accuracy. Should be single digit nanoseconds, ideally 0.
t.bench(function bench_baseline() {})

export const TEST_SEED = new Uint8Array([
  247, 218, 206,  30, 143, 246,  12,
   69,  39,  87, 122, 216, 147,  60,
  170, 180, 193, 165, 128, 131, 109,
  127, 229, 204, 197, 127,  64, 245,
   97, 212,  20,  45
])

export const {publicKey: TEST_PUBLIC_KEY, secretKey: TEST_SECRET_KEY} = u.seedToKeyPair(TEST_SEED)

// SYNC[test_pub].
export const TEST_PUB = `e6db4b849dfc5c3c5a3870fa4b01a5855c5424eee3ac9e55f7deeb31e40d4231`

// SYNC[test_tmp_dir].
export const TEST_TMP_DIR = `.test_tmp`

// SYNC[ctx_iface].
export class TestCtx extends a.Emp {
  static {a.memGet(this)}

  get dbFile() {return `:memory:`}
  get dataDir() {return this.tmpDir}

  get tmpDir() {
    io.mkdirSync(TEST_TMP_DIR, {recursive: true})
    return io.mkdirTempSync({dir: TEST_TMP_DIR, prefix: `test_data_`})
  }

  get userRunsDir() {return pt.join(this.dataDir, `user_runs`)}
  get httpDirUserRuns() {return new h.HttpDir({fsPath: this.userRunsDir})}

  #db
  async db() {return this.#db ??= (await ud.DuckDb.create(this.dbFile))}

  #conn
  async conn() {return this.#conn ??= (await (await this.db()).connect())}
  async connect() {return (await this.db()).connect()}

  apiPath(...src) {return a.urlJoin(`http://localhost/api`, ...src)}

  deinit() {
    this.#conn?.closeSync()

    /*
    Actually calling this in tests crashes the process with a segmentation
    fault. So we don't bother calling `ctx.deinit` in tests.
    */
    this.#db?.closeSync()
  }
}

export async function testFailInsecurePaths(fun) {
  async function fail(path) {
    const err = await t.throws(
      async () => await fun(path),
      us.ErrHttp,
      `invalid path ${a.show(path)}`,
    )
    t.is(err.status, 400)
  }

  await fail(`/`)
  await fail(`/one`)
  await fail(`/..`)
  await fail(`/../`)
  await fail(`../..`)
  await fail(`../../`)
  await fail(`../../../readme.md`)
  await fail(`../../../private.key`)
}
