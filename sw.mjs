/* eslint-disable no-restricted-globals */
/* global self, caches */

/*
Caches semantically-versioned assets from CDNs. Useful for offline development.
Normally, browsers do cache external assets, but unload them periodically, like
once every few hours, which can be inconvenient when working without internet
access. This also bypasses "disable cache". In production this is unnecessary
but should be harmless.

Must be served from site root, not from subpath.
*/

self.onfetch = onFetch

function onFetch(event) {
  const {request: req} = event
  if (!shouldCache(req)) return
  event.respondWith(fetchWithCache(req))
}

let cache
async function fetchWithCache(req) {
  cache ??= await caches.open(`main`)

  let res = await cache.match(req)
  if (res) return res

  res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

/*
We cache URLs which seem to contain a version modifier similar to what is
supported in NPM and various CDNs that allow to import NPM modules by URL.
*/
function shouldCache(req) {
  return (
    req.method === `GET` &&
    /[@/][\^~>=]?v?(?:\d+|\*|x)[.](?:\d+|\*|x)[.](?:\d+|\*|x)/.test(decodeURI(req.url))
  )
}
