/*
For Dockerfile builds only. Should include all 3rd party dependencies
from `deno.json`. Should not import local files.
*/

import '@mitranim/js/all.mjs'
import '@mitranim/js/path.mjs'
import '@mitranim/js/io_deno.mjs'
import '@mitranim/js/http_deno.mjs'
import '@mitranim/js/live_deno.mjs'
import '@duckdb/node-api'
import '@duckdb/node-bindings'
import 'tweetnacl'
