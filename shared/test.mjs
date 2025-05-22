// import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as u from './util.mjs'

const TEST_SEED = new Uint8Array([
  107, 116, 166,  25,  34, 167,  86, 163,
  193, 111, 192, 214,  17,  80, 136, 217,
   90, 224,  32, 137, 164,  80,  29,  33,
   53, 117,   0,  37, 131, 196, 164,  68
])

const TEST_KEYS = u.seedToKeyPair(TEST_SEED)

await t.test(async function test_pass_to_seedArrBuf() {
  t.throws(async () => await u.pass_to_seedArrBuf(` one`), Error, `must not contain leading or trailing whitespace`)
  t.throws(async () => await u.pass_to_seedArrBuf(`one `), Error, `must not contain leading or trailing whitespace`)
  t.throws(async () => await u.pass_to_seedArrBuf(`one`), Error, `must have at least 8 chars, got 3 chars`)
  t.throws(async () => await u.pass_to_seedArrBuf(`➡️⬅️⬇️⬆️`), Error, `must have at least 8 chars, got 4 chars`)

  t.eq(new Uint8Array(await u.pass_to_seedArrBuf(`one two three`)), TEST_SEED)
  t.eq(new Uint8Array(await u.pass_to_seedArrBuf(`one two three`)), TEST_SEED)
  t.notEq(new Uint8Array(await u.pass_to_seedArrBuf(`one two three four`)), TEST_SEED)
  t.notEq(new Uint8Array(await u.pass_to_seedArrBuf(`one two three`)), new Uint8Array())
})

t.test(function test_seedToKeyPair() {
  t.eq(u.seedToKeyPair(TEST_SEED), TEST_KEYS)

  t.eq(
    TEST_KEYS,
    {
      publicKey: new Uint8Array([192, 73, 53, 212, 12, 163, 59, 143, 237, 31, 103, 239, 176, 228, 215, 49, 218, 182, 126, 1, 45, 177, 50, 145, 123, 240, 12, 62, 5, 191, 36, 87]),
      secretKey: new Uint8Array([107, 116, 166, 25, 34, 167, 86, 163, 193, 111, 192, 214, 17, 80, 136, 217, 90, 224, 32, 137, 164, 80, 29, 33, 53, 117, 0, 37, 131, 196, 164, 68, 192, 73, 53, 212, 12, 163, 59, 143, 237, 31, 103, 239, 176, 228, 215, 49, 218, 182, 126, 1, 45, 177, 50, 145, 123, 240, 12, 62, 5, 191, 36, 87]),
    }
  )

  t.is(
    u.byteArr_to_hexStr(TEST_KEYS.publicKey),
    `c04935d40ca33b8fed1f67efb0e4d731dab67e012db132917bf00c3e05bf2457`,
  )
})

t.test(function test_authToken() {
  const {publicKey, secretKey} = TEST_KEYS

  t.is(
    u.authToken(publicKey, secretKey, 0),
    u.authToken(publicKey, secretKey, 0),
  )

  t.isnt(
    u.authToken(publicKey, secretKey, 0),
    u.authToken(publicKey, secretKey, 1),
  )

  t.is(
    u.authToken(publicKey, secretKey, 1),
    u.authToken(publicKey, secretKey, 1),
  )

  t.is(
    u.authToken(publicKey, secretKey, 0),
    `c04935d40ca33b8fed1f67efb0e4d731dab67e012db132917bf00c3e05bf2457.0.ca1ca9cbe473098dcf2004bcfb91ed218316b6a673cf421638efe19a9b2cb28ec1245475641f079b3d6686beccc9dd9424262219fdf2b83fb1f806af5ec91d0c`,
  )

  t.is(
    u.authToken(publicKey, secretKey, 1),
    `c04935d40ca33b8fed1f67efb0e4d731dab67e012db132917bf00c3e05bf2457.1.bab4bf8cdb6147ee70a2cb2794ead02565103392ae1fb1786c156728ce8c1bdf39e505e1275e36f25753c2e99aef313cea5b0b7afe5f59de04f181e60dd05405`,
  )

  t.isnt(
    u.authToken(publicKey, secretKey, 2),
    u.authToken(publicKey, secretKey, 3),
  )
})

t.test(function test_reversible_encoding_decoding_bin_str_byte_arr() {
  function test(srcStr, expArr) {
    const outArr = u.binStr_to_byteArr(srcStr)
    t.eq(outArr, new Uint8Array(expArr))

    const outStr = u.byteArr_to_binStr(outArr)
    t.is(outStr, srcStr)
  }

  test(``, [])
  test(`one`, [111, 110, 101])
  test(`two`, [116, 119, 111])
  test(`one two`, [111, 110, 101, 32, 116, 119, 111])
  test(`one two three`, [111, 110, 101, 32, 116, 119, 111, 32, 116, 104, 114, 101, 101])
})

t.test(function test_reversible_encoding_decoding_hex() {
  function test(srcArr, expStr) {
    const outStr = u.byteArr_to_hexStr(new Uint8Array(srcArr))
    t.is(outStr, expStr)

    const outArr = u.hexStr_to_byteArr(outStr)
    t.eq(outArr, new Uint8Array(srcArr))
  }

  test([], ``)
  test([10], `0a`)
  test([10, 20], `0a14`)
  test([10, 20, 30], `0a141e`)
  test([10, 20, 30, 40], `0a141e28`)
})

t.test(function test_reversible_encoding_decoding_base64() {
  function test(srcArr, expStr) {
    const outStr = u.byteArr_to_base64Str(new Uint8Array(srcArr))
    t.is(outStr, expStr)

    const outArr = u.base64Str_to_byteArr(outStr)
    t.eq(outArr, new Uint8Array(srcArr))
  }

  test([], ``)
  test([10], `Cg==`)
  test([10, 20], `ChQ=`)
  test([10, 20, 30], `ChQe`)
  test([10, 20, 30, 40], `ChQeKA==`)
})

t.test(function test_Semver() {
  function test(src, [major, minor, patch], expStr = src) {
    const exp = new u.Semver(major, minor, patch)
    const act = u.Semver.fromString(src)
    t.eq({...act}, {...exp})
    t.is(u.Semver.compare(act, exp), 0)
    t.is(act.toString(), expStr)
  }

  t.is(u.Semver.fromStringOpt(), undefined)
  t.is(u.Semver.fromStringOpt(undefined), undefined)
  t.is(u.Semver.fromStringOpt(null), undefined)

  test(``, [0, 0, 0], `0.0.0`)
  test(`.`, [0, 0, 0], `0.0.0`)
  test(`..`, [0, 0, 0], `0.0.0`)
  test(`0`, [0, 0, 0], `0.0.0`)
  test(`1`, [1, 0, 0], `1.0.0`)
  test(`2`, [2, 0, 0], `2.0.0`)
  test(`12`, [12, 0, 0], `12.0.0`)
  test(`123`, [123, 0, 0], `123.0.0`)

  test(`v`, [0, 0, 0], `0.0.0`)
  test(`v1`, [1, 0, 0], `1.0.0`)
  test(`v2`, [2, 0, 0], `2.0.0`)
  test(`v12`, [12, 0, 0], `12.0.0`)
  test(`v123`, [123, 0, 0], `123.0.0`)

  test(`0.1`, [0, 1, 0], `0.1.0`)
  test(`0.2`, [0, 2, 0], `0.2.0`)
  test(`1.0`, [1, 0, 0], `1.0.0`)
  test(`1.2`, [1, 2, 0], `1.2.0`)
  test(`2.3`, [2, 3, 0], `2.3.0`)
  test(`12.34`, [12, 34, 0], `12.34.0`)
  test(`123.456`, [123, 456, 0], `123.456.0`)

  test(`0.2.3`, [0, 2, 3])
  test(`1.0.3`, [1, 0, 3])
  test(`1.2.0`, [1, 2, 0])
  test(`1.2.3`, [1, 2, 3])
  test(`2.3.4`, [2, 3, 4])
  test(`12.34.56`, [12, 34, 56])
  test(`123.456.789`, [123, 456, 789])

  function fail(src, msg) {
    t.throws(() => u.Semver.fromString(src), Error, msg)
  }

  fail(`...`, `too many parts in semver "..."`)
  fail(`str`, `Cannot convert str to a BigInt`)
  fail(`10.str`, `Cannot convert str to a BigInt`)
  fail(`10.20.str`, `Cannot convert str to a BigInt`)
})

console.log(`[test_shared] ok`)
