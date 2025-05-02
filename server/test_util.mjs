import * as a from '@mitranim/js/all.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as u from '../shared/util.mjs'
import * as ud from './util_db.mjs'

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
  get dbFile() {return `:memory:`}
  get dataDir() {return this.tmpDir}

  #tmp
  get tmpDir() {
    return this.#tmp ??= (
      Deno.mkdirSync(TEST_TMP_DIR, {recursive: true}),
      Deno.makeTempDirSync({dir: TEST_TMP_DIR, prefix: `test_data_`})
    )
  }

  get userRunsDir() {return io.paths.join(this.dataDir, `user_runs`)}

  #db
  async db() {return this.#db ??= (await ud.DuckDb.create(this.dbFile))}

  #conn
  async conn() {return this.#conn ??= (await (await this.db()).connect())}
  async connect() {return (await this.db()).connect()}

  deinit() {
    this.#conn?.closeSync()

    // Actually calling this in tests crashes the process with a segmentation
    // fault. So we don't bother.
    this.#db?.closeSync()
  }
}
