import * as io from '@mitranim/js/io_deno.mjs'
import * as u from '../shared/util.mjs'
import * as c from './ctx.mjs'

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

export class TestCtx extends c.Ctx {
  constructor() {
    // SYNC[test_tmp_dir].
    const tmpDir = `.test_tmp`
    Deno.mkdirSync(tmpDir, {recursive: true})

    const dataDir = io.paths.join(Deno.makeTempDirSync({dir: tmpDir}), `test_data`)
    super({dbFile: `:memory:`, dataDir, tmpDir})
  }

  deinit() {
    super.deinit()
    try {Deno.removeSync(this.dataDir, {recursive: true})} catch {}
    try {Deno.removeSync(this.tmpDir, {recursive: true})} catch {}
  }
}
