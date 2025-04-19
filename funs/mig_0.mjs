/*
Re-derive data from `roundSnaps` due to schema changes,
then delete outdated derived documents from related collections.
*/

// import * as faa from 'firebase-admin/app'
import * as faf from 'firebase-admin/firestore'
import * as log from 'firebase-functions/logger'
import * as a from '@mitranim/js/all.mjs'
import * as s from './schema.mjs'
import * as uf from './util_fb.mjs'

const db = await uf.getDb()

await main()

async function main() {
  log.info(`[mig] starting`)

  await rebuildDerivedDocs()

  await deleteOutdatedFields(s.COLL_RUNS)
  await deleteOutdatedFields(s.COLL_RUN_ROUNDS)
  await deleteOutdatedFields(s.COLL_RUN_BUIS)
  await deleteOutdatedFields(s.COLL_RUN_ROUND_BUIS)

  await deleteOutdatedDocs(s.COLL_RUNS)
  await deleteOutdatedDocs(s.COLL_RUN_ROUNDS)
  await deleteOutdatedDocs(s.COLL_RUN_BUIS)
  await deleteOutdatedDocs(s.COLL_RUN_ROUND_BUIS)
  await deleteOutdatedDocs(s.COLL_FACTS)

  log.info(`[mig] done`)
}

async function rebuildDerivedDocs() {
  const query = db.collection(s.COLL_ROUND_SNAPS)
    .where(`tabularius_derivedSchemaVersion`, `<`, s.SCHEMA_VERSION)

  for await (const snaps of uf.documentSnapBatches(query)) {
    for (const snap of snaps) {
      const round = snap.data()
      if (!round) continue

      const batch = uf.roundBatch(db, snap.ref, round)
      if (!batch) continue

      if (uf.DRY_RUN) {
        log.debug(`skipping batch commit`)
      }
      else {
        const count = a.len(await batch.commit())
        log.debug(`derived ${count - 1} documents from ${snap.ref.path}`)
      }
    }
  }
}

async function deleteOutdatedFields(collName) {
  const query = db.collection(collName)
    .where(`schemaVersion`, `==`, s.SCHEMA_VERSION)
    .where(`frontierLevel`, `!=`, null)

  for await (const snaps of uf.documentSnapBatches(query)) {
    a.reqArr(snaps)
    log.debug(`in ${collName}, found ${snaps.length} to delete outdated fields on`)

    const batch = db.batch()
    for (const snap of snaps) {
      batch.update(snap.ref, {frontierLevel: faf.FieldValue.delete()})
    }

    if (uf.DRY_RUN) {
      log.debug(`skipping batch commit in ${collName}`)
    }
    else {
      const count = a.len(await batch.commit())
      log.info(`in ${collName}, deleted outdated fields on ${count} docs`)
    }
  }
}

async function deleteOutdatedDocs(collName) {
  const query = db.collection(collName)
    .where(`schemaVersion`, `<`, s.SCHEMA_VERSION)

  for await (const snaps of uf.documentSnapBatches(query)) {
    a.reqArr(snaps)
    log.debug(`in ${collName}, found ${snaps.length} outdated docs to delete`)

    const batch = db.batch()
    for (const snap of snaps) batch.delete(snap.ref)

    if (uf.DRY_RUN) {
      log.debug(`skipping batch commit`)
    }
    else {
      const count = a.len(await batch.commit())
      log.info(`in ${collName}, deleted ${count} outdated docs`)
    }
  }
}
