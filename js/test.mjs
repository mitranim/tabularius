import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import * as t from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/test.mjs'
import * as d from './dat.mjs'
import * as u from './util.mjs'

/*
Tests for small utility functions should be placed here.
The app can be switched into test mode via the `test` command.
Alternatively, this can be imported via URL query param `import=js/test.mjs`.
*/

t.test(function test_encodeUpgrade() {
  function test(src, exp) {t.is(d.encodeUpgrades(src), exp)}

  test([], ``)
  test([{Index: 1}], `B`)
  test([{Index: 1}, {Index: 0}], `BA`)
  test([{Index: 1}, {Index: 0}, {Index: 1}], `BAB`)

  // We support degenerate cases all the way to Z.
  test([{Index: 2}, {Index: 3}, {Index: 4}], `CDE`)
})

t.test(function test_compareOrdNamesDesc() {
  t.is(u.compareOrdNamesDesc(), 0)

  t.is(u.compareOrdNamesDesc(`one`, `two`), 0)
  t.is(u.compareOrdNamesDesc(`two`, `one`), 0)
  t.is(u.compareOrdNamesDesc(`0`, `one`), -1)
  t.is(u.compareOrdNamesDesc(`one`, `0`), 1)

  t.is(u.compareOrdNamesDesc(`0`, `0`), 0)
  t.is(u.compareOrdNamesDesc(`0`, `1`), 1)
  t.is(u.compareOrdNamesDesc(`1`, `0`), -1)
  t.is(u.compareOrdNamesDesc(`1`, `1`), 0)

  t.is(u.compareOrdNamesDesc(`00`, `00`), 0)
  t.is(u.compareOrdNamesDesc(`00`, `01`), 1)
  t.is(u.compareOrdNamesDesc(`01`, `00`), -1)
  t.is(u.compareOrdNamesDesc(`01`, `01`), 0)

  t.is(u.compareOrdNamesDesc(`00`, `one`), -1)
  t.is(u.compareOrdNamesDesc(`01`, `one`), -1)

  t.is(u.compareOrdNamesDesc(`one`, `00`), 1)
  t.is(u.compareOrdNamesDesc(`one`, `01`), 1)
})

const msg = `[test] ok`
u.log.info(msg)
console.log(msg)