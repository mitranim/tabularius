import * as a from '@mitranim/js/all.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as ud from './util_db.mjs'

/*
Stateful app configuration used by server code and testing code.
Allows use to modify the behavior of server code in tests.
*/
export class Ctx extends a.Emp {
  constructor({dbFile, dataDir, tmpDir}) {
    super()
    this.dbFile = a.reqValidStr(dbFile)
    this.dataDir = a.reqValidStr(dataDir)
    this.tmpDir = a.reqValidStr(tmpDir)
  }

  get userRunsDir() {return io.paths.join(this.dataDir, `user_runs`)}

  #db
  async db() {return this.#db ??= (await ud.DuckDb.create(this.dbFile))}

  #conn
  async conn() {return this.#conn ??= (await (await this.db()).connect())}

  // Caller must `try {...} finally {conn.closeSync()}`.
  async connect() {return (await this.db()).connect()}

  deinit() {
    this.#conn?.closeSync()
    this.#db?.closeSync()
  }
}
