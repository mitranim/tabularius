import * as a from '@mitranim/js/all.mjs'
import * as idb from 'idb'

import * as self from './idb.mjs'
const tar = globalThis.tabularius ??= a.Emp()
tar.i = self
tar.lib ??= a.Emp()
tar.lib.idb = idb
a.patch(globalThis, tar)

export const IDB_NAME = `tabularius`
export const IDB_VERSION = 1
export const IDB_STORE_HANDLES = `handles`

// Create/open the IndexedDB database.
export const dbPromise = idb.openDB(IDB_NAME, IDB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(IDB_STORE_HANDLES)) {
      db.createObjectStore(IDB_STORE_HANDLES)
    }
  }
})

// Save a value to IndexedDB.
export async function dbPut(store, key, val) {
  a.reqValidStr(store)
  a.reqValidStr(key)
  await (await dbPromise).put(store, val, key)
}

// Get a value from IndexedDB.
export async function dbGet(store, key) {
  a.reqValidStr(store)
  a.reqValidStr(key)
  return (await dbPromise).get(store, key)
}

// Delete a value in IndexedDB.
export async function dbDel(store, key) {
  a.reqValidStr(store)
  a.reqValidStr(key)
  return (await dbPromise).delete(store, key)
}