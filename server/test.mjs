Error.stackTraceLimit = Infinity

import * as io from '@mitranim/js/io'
import * as tu from './test_util.mjs'

await import(`../shared/test.mjs`)
await import(`./util_encoding_test.mjs`)
await import(`./util_auth_test.mjs`)
await import(`./api/api_upload_round_test.mjs`)
await import(`./api/api_download_file_test.mjs`)
await import(`./api/api_download_round_test.mjs`)
await import(`./api/api_ls_test.mjs`)
await import(`./api/api_plot_agg_test.mjs`)

// Enable on demand.
// await import(`./fs_mig_test.mjs`)

await io.remove(tu.TEST_TMP_DIR, {recursive: true})

console.log(`[test_server] ok`)
