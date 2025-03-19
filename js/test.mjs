// import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as t from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/test.mjs'
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

const msg = `[test] ok`
u.log.inf(msg)
console.log(msg)
