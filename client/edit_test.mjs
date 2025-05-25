/*
Usage: add `import=client/edit_test.mjs` to URL query.
*/

import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
// import * as s from '../shared/schema.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as e from './edit.mjs'

const tar = window.tabularius ??= a.Emp()
tar.lib ??= a.Emp()
tar.lib.t = t
a.patch(window, tar)

/*
TODO: properly automate this test.
Run multiple edits, and verify the results automatically.

TODO: Read and parse the `Unlockables.gd` file and verify that we "know" every
unlockable, i.e. have a name for it and can list it as one of the available
options in `help edit`.
*/

const saveDir = await fs.saveDirOpt(u.sig)
const histDir = await fs.historyDirOpt(u.sig)

await t.test(async function test_edit() {
  if (!saveDir) {
    u.LOG.info(`missing `, os.BtnCmd(`saves`), `, skipping edit test`)
    return
  }
  if (!histDir) {
    u.LOG.info(`missing `, os.BtnCmd(`history`), `, skipping edit test`)
    return
  }

  const sig = u.sig
  const testDir = await fs.getDirectoryHandle(sig, histDir, `edit_test`, {create: true})
  const testSaveDir = await fs.getDirectoryHandle(sig, testDir, `saves`, {create: true})
  const testHistDir = await fs.getDirectoryHandle(sig, testDir, `history`, {create: true})

  await fs.copyFileBetween(sig, saveDir, testSaveDir, `Settings.gd`)
  await fs.copyFileBetween(sig, saveDir, testSaveDir, `Unlockables.gd`)
  await fs.copyFileBetween(sig, saveDir, testSaveDir, `Progress.gd`)

  const state = new e.EditState()
  state.args = `edit`
  state.saveDir = testSaveDir
  state.histDir = testHistDir

  // state.args = `edit diff=5 frontier=19 hero=Anysia hero=Denshikova hero=Droh`
  // state.args = `edit diff=5 frontier=19 hero=Anysia hero=Denshikova hero=Droh -w`
  // state.args = `edit hero=Anysia hero=Denshikova hero=Droh`
  // state.args = `edit hero=Anysia hero=Denshikova hero=Droh -w`
  // state.args = `edit frontier=19 hero=all`
  // state.args = `edit frontier=19 hero=all -w`
  // state.args = `edit diff=1 frontier=19 hero=all`
  // state.args = `edit diff=1 frontier=19 hero=all -w`
  // state.args = `edit diff=5 frontier=19 hero=all`
  // state.args = `edit diff=5 frontier=19 hero=all -w`
  // state.args = `edit hero=all`
  // state.args = `edit hero=all -w`
  // state.args = `edit hero=all -l`
  // state.args = `edit hero=all -l -w`
  // state.args = `edit hero=Anysia hero=Denshikova hero=Droh -l`
  // state.args = `edit hero=Anysia hero=Denshikova hero=Droh -l -w`
  // state.args = `edit bui=all`
  // state.args = `edit bui=all -w`
  // state.args = `edit bui=all -l`
  // state.args = `edit bui=all -l -w`
  // state.args = `edit bui=Mirador bui=Bunker bui=Claymore bui=Bastion`
  // state.args = `edit bui=Mirador bui=Bunker bui=Claymore bui=Bastion -w`
  // state.args = `edit bui=CB999`
  // state.args = `edit bui=CB999 -w`
  // state.args = `edit -a`
  // state.args = `edit -a -w`
  // state.args = `edit -a -l`
  // state.args = `edit -a -l -w`
  // state.args = `edit -a diff=4`
  // state.args = `edit -a diff=4 -w`
  // state.args = `edit -a diff=5`
  // state.args = `edit -a frontier=19`
  // state.args = `edit doct=all`
  // state.args = `edit doct=all -w`
  // state.args = `edit doct=Negotiation_skills doct=Final_mobilization -w`
  await e.edit(sig, state)
})
