/* global Deno */

Error.stackTraceLimit = Infinity

// import * as t from '@mitranim/js/test.mjs'
// t.conf.setTestFilter(`test_migrateUserRuns`)

/*
for await (const {name, isFile} of Deno.readDir(new URL(`.`, import.meta.url))) {
  if (isFile && name.endsWith(`_test.mjs`)) {
    await import(new URL(name, import.meta.url))
  }
}
*/

await import(`./encoding_test.mjs`)
await import(`./auth_test.mjs`)
await import(`./upload_test.mjs`)
await import(`./plot_agg_test.mjs`)
await import(`../shared/test.mjs`)

// Enable on demand.
// await import(`./fs_mig_test.mjs`)

import * as tu from './test_util.mjs'
await Deno.remove(tu.TEST_TMP_DIR, {recursive: true})

console.log(`[test_server] ok`)
