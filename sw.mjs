/*
This goal of this service worker is to make the app usable offline,
while not interfering with app updates.

For external assets loaded from CDNs, we prefer the local cache, since they're
semantically versioned and considered immutable.

For our own files, we prefer to hit the network; the browser will use its own
HTTP caching strategies. In case of network failure, we fall back on the local
cache.

We hardcode a list of assets and precache them on SW installation.
See `ASSETS` and `ASSETS_LAZY` below. When the SW detects cacheable
assets which are not in the asset lists, it prints a warning.

We pass the app version to the service worker because we need to update the
cache on each app update, replacing old assets with new ones, and removing
unused assets.
*/

const QUERY = new URLSearchParams(self.location.search)
const VER = QUERY.get(`VERSION`)
const DEV = QUERY.get(`DEV`) === `true`
const CACHE_KEY = `tabularius_` + VER
const PATH_BASE = new URL(self.registration.scope).pathname
const PATH_BASE_CLIENT = PATH_BASE + `client/`
const PATH_BASE_SHARED = PATH_BASE + `shared/`
const ASSETS_DETECTED = new Set() // Also see `ASSETS` below.

let CACHE

self.oninstall = onInstall
self.onactivate = onActivate
self.onfetch = onFetch

function onInstall(eve) {eve.waitUntil(installation())}
function onActivate(eve) {eve.waitUntil(activation())}

async function installation() {
  await getCache()
  await cacheAssets()

  // Immediately replace the current SW, if any.
  self.skipWaiting()
}

async function activation() {
  await self.registration.navigationPreload.enable().catch(console.error)
  await self.clients.claim()

  // No `await`: run in background.
  clearOldCaches()
}

async function clearOldCaches() {
  for (const key of await caches.keys()) {
    if (key !== CACHE_KEY) await caches.delete(key)
  }
}

async function cacheAssets() {
  const paths = [...ASSETS_ALL]
  await Promise.all(paths.map(cacheAsset))
}

async function cacheAsset(path) {
  const cache = await getCache()
  if (await cache.match(path)) return

  const res = await fetch(path)
  if (!res.ok) {
    throw Error(`unable to cache asset ${path}; ${await resErr(res)}`)
  }
  await cache.put(path, res)
}

function onFetch(eve) {
  const req = eve.request
  if (req.method !== `GET`) return

  const url = new URL(req.url)
  const {pathname} = url
  const sameOrigin = url.origin === self.location.origin

  const caching = (
    sameOrigin
    ? (
      ASSETS_ALL.has(pathname) ||
      pathname.startsWith(PATH_BASE_CLIENT) ||
      pathname.startsWith(PATH_BASE_SHARED)
    )
    : (
      // Detect semver. This looks weird because their versions are weird.
      /[@/][\^~>=]?v?(?:\d+|\*|x)[.](?:\d+|\*|x)[.](?:\d+|\*|x)/.test(
        decodeURIComponent(pathname)
      )
    )
  )

  if (!caching) return

  const key = sameOrigin ? pathname : req.url

  ASSETS_DETECTED.add(key)

  if (DEV && !ASSETS_ALL.has(key)) {
    console.warn(`unregistered asset ${JSON.stringify(key)}; run "printAssets()" in the service worker frame, then update "ASSETS" and "CACHE_KEY" in "sw.mjs"`)
  }

  eve.respondWith(fetchCaching({
    event: eve,
    pathname,
    key,
    navigation: req.mode === `navigate`,
  }))
}

async function fetchCaching({event: eve, preferCache, key, navigation}) {
  const req = eve.request

  if (!key) {
    if (!DEV) return fetch(req)
    throw Error(`internal service worker error: missing key for asset ${JSON.stringify(req.url)}`)
  }

  if (preferCache) {
    const res = await cacheMatch(key)
    if (res) return res
    if (DEV) console.log(`cache miss:`, key)
  }

  if (navigation) {
    const res = await eve.preloadResponse?.catch(console.error)
    if (res?.ok) {
      cacheOpt({eve, res, key})
      return res
    }
  }

  let res
  try {
    res = await fetch(req)
  }
  catch (err) {
    const match = await cacheMatch(key)
    if (match) return match
    throw err
  }

  if (res.ok) {
    cacheOpt({eve, res, key})
    return res
  }

  return (await cacheMatch(key)) ?? res
}

async function getCache() {return CACHE ??= await caches.open(CACHE_KEY)}

async function cacheMatch(key) {
  const cache = await getCache()
  return cache.match(key, {ignoreSearch: true})
}

async function cachePut(key, val) {
  const cache = await getCache()
  await cache.put(key, val)
}

function cacheOpt({eve, res, key}) {
  if (!shouldCache(res)) return
  eve.waitUntil(cachePut((key || eve.request), res.clone()))
}

function shouldCache(res) {return res?.ok && res?.type !== `opaque`}

async function resErr(res) {
  return `response code: ${res.status}; response body: ${await res.text()}`
}

function makeUrl(path) {
  return new URL(path, self.registration.scope)
}

function setSubtract(src, minus) {
  const out = new Set()
  for (const val of src) if (!minus.has(val)) out.add(val)
  return out
}

// deno-lint-ignore no-unused-vars
function printAssets() { // eslint-disable-line no-unused-vars
  const set = setSubtract(ASSETS_DETECTED, ASSETS_LAZY)
  const list = [...set].sort()
  console.log(JSON.stringify(list, undefined, 2).replace(/"/g, '`'))
}

/*
These are not always requested by the client.
This list is updated entirely manually.
*/
const ASSETS_LAZY = new Set([
  makeUrl(`client/wordlist.txt`).pathname,
  makeUrl(`samples/example_run.gd`).pathname, // SYNC[example_run_paths].
])

const ASSETS = new Set([
  `/tabularius/`,
  `/tabularius/client/auth.mjs`,
  `/tabularius/client/dat.mjs`,
  `/tabularius/client/edit.mjs`,
  `/tabularius/client/favicon.svg`,
  `/tabularius/client/fs.mjs`,
  `/tabularius/client/idb.mjs`,
  `/tabularius/client/ls.mjs`,
  `/tabularius/client/main.mjs`,
  `/tabularius/client/os.mjs`,
  `/tabularius/client/plot.mjs`,
  `/tabularius/client/setup.mjs`,
  `/tabularius/client/show_round_combined.mjs`,
  `/tabularius/client/show_round_split.mjs`,
  `/tabularius/client/svg.svg`,
  `/tabularius/client/ui.mjs`,
  `/tabularius/client/ui_log.mjs`,
  `/tabularius/client/ui_media.mjs`,
  `/tabularius/client/ui_misc.mjs`,
  `/tabularius/client/ui_prompt.mjs`,
  `/tabularius/client/ui_split.mjs`,
  `/tabularius/client/ui_style.mjs`,
  `/tabularius/client/ui_table.mjs`,
  `/tabularius/client/ui_util.mjs`,
  `/tabularius/client/upload.mjs`,
  `/tabularius/client/util.mjs`,
  `/tabularius/client/watch.mjs`,
  `/tabularius/shared/game_const.mjs`,
  `/tabularius/shared/schema.mjs`,
  `/tabularius/shared/util.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/all.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/coll.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/dom.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/dom_reg.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/http.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/iter.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/lang.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/obj.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/obs.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/path.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/prax.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/str.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/time.mjs`,
  `https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.85/url.mjs`,
  `https://cdn.jsdelivr.net/npm/@ungap/custom-elements@1.3.0/es.js`,
  `https://cdn.skypack.dev/-/tweetnacl@v1.0.3-G4yM3nQ8lnXXlGGQADqJ/dist=es2019,mode=imports,min/optimized/tweetnacl.js`,
  `https://cdn.skypack.dev/tweetnacl@1.0.3?min`,
  `https://esm.sh/@twind/core@%5E1.1.0?target=es2022`,
  `https://esm.sh/@twind/core@1.1.3`,
  `https://esm.sh/@twind/core@1.1.3/es2022/core.mjs`,
  `https://esm.sh/@twind/preset-autoprefix@1.0.7`,
  `https://esm.sh/@twind/preset-autoprefix@1.0.7/es2022/preset-autoprefix.mjs`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4/colors.js`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4/es2022/_/colors-e5e84df2.mjs`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4/es2022/base.mjs`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4/es2022/baseTheme.mjs`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4/es2022/colors.mjs`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4/es2022/preflight.mjs`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4/es2022/preset-tailwind.mjs`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4/es2022/rules.mjs`,
  `https://esm.sh/@twind/preset-tailwind@1.1.4/es2022/variants.mjs`,
  `https://esm.sh/idb@7.1.1`,
  `https://esm.sh/idb@7.1.1/es2022/build/wrap-idb-value.mjs`,
  `https://esm.sh/idb@7.1.1/es2022/idb.mjs`,
  `https://esm.sh/style-vendorizer@%5E2.2.3?target=es2022`,
  `https://esm.sh/style-vendorizer@2.2.3/es2022/style-vendorizer.mjs`,
  `https://esm.sh/uplot@1.6.27`,
  `https://esm.sh/uplot@1.6.27/es2022/uplot.mjs`,
])

const ASSETS_ALL = new Set([...ASSETS_LAZY, ...ASSETS])
