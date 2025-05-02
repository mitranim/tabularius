import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as tu from './test_util.mjs'
import * as u from './util.mjs'

t.test(function test_auth() {
  function fail(src, ts, msg) {t.throws(() => u.auth(src, ts), Error, msg)}

  fail(`one`, 0, `auth token must be <pub>.<ts>.<sig>, got "one"`)
  fail(`one.two`, 0, `auth token must be <pub>.<ts>.<sig>, got "one.two"`)
  fail(`one.two.three.`, 0, `auth token must be <pub>.<ts>.<sig>, got "one.two.three."`)
  fail(`one.two.three.four`, 0, `auth token must be <pub>.<ts>.<sig>, got "one.two.three.four"`)
  fail(`one.two.three`, 0, `auth token: malformed pub key: "one", expected a 64-char hex string`)
  const pub = a.uuid() + a.uuid()
  fail(pub + `..two`, 0, `auth token: malformed timestamp: ""`)
  fail(pub + `.two.three`, 0, `auth token: malformed timestamp: "two"`)
  fail(pub + `.NaN.three`, 0, `auth token: malformed timestamp: "NaN"`)

  t.is(u.auth(), undefined)
  t.is(u.auth(``), undefined)

  const token = u.authToken(tu.TEST_PUBLIC_KEY, tu.TEST_SECRET_KEY, 0)
  const tokenTs = 0
  t.is(token, tu.TEST_PUB + `.` + tokenTs + `.07888c60b1d711e2eb045b0845773e39e78886a5a2ef5115a17a9d3fe5837189dd0c5fc84cab48db553d2d49f8c684ee2a87ec4c314f906d38889b73967bb305`)

  function test(ts) {
    const out = u.auth(token, ts)
    t.is(out, tu.TEST_PUB)
    t.is(out, u.byteArr_to_hexStr(tu.TEST_PUBLIC_KEY))
  }

  test(tokenTs)

  {
    const broken = `00` + token.slice(2)
    fail(broken, tokenTs, `auth token: signature doesn't match claims`)
  }

  {
    const broken = token.replace(`.0.`, `.1.`)
    fail(broken, tokenTs, `auth token: signature doesn't match claims`)
  }

  {
    const broken = token.slice(0, -2) + `00`
    fail(broken, tokenTs, `auth token: signature doesn't match claims`)
  }

  test(tokenTs - u.AUTH_TS_EXP)
  test(tokenTs + u.AUTH_TS_EXP)

  fail(token, tokenTs - u.AUTH_TS_EXP - 1, `auth token: timestamp too far in the future`)
  fail(token, tokenTs + u.AUTH_TS_EXP + 1, `auth token: timestamp too far in the past`)
})
