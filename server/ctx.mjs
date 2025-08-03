import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as io from '@mitranim/js/io'
import * as ud from './util_db.mjs'
import * as us from './util_srv.mjs'

/*
Stateful app configuration used by server code and testing code.
Allows to modify the behavior of server code in tests.

SYNC[ctx_iface].
*/
export class Ctx extends a.Emp {
  constructor({dbFile, dataDir, tmpDir}) {
    super()
    this.dbFile = a.reqValidStr(dbFile)
    this.dataDir = a.reqValidStr(dataDir)
    this.tmpDir = a.reqValidStr(tmpDir)
    this.httpDirUserRuns = new us.HttpDir({fsPath: this.userRunsDir})
  }

  get userRunsDir() {return pt.join(this.dataDir, `user_runs`)}

  #db
  async db() {return this.#db ??= (await this.#dbInit())}

  #conn
  async conn() {return this.#conn ??= (await (await this.db()).connect())}

  // Caller must `try {...} finally {conn.closeSync()}`.
  async connect() {return (await this.db()).connect()}

  async #dbInit() {
    const path = this.dbFile
    if (path === `:memory:`) return ud.DuckDb.create(path)
    await io.mkdir(pt.dir(path), {recursive: true})
    return ud.DuckDb.create(path)
  }

  deinit() {
    this.#conn?.closeSync()
    this.#db?.closeSync()
  }
}
