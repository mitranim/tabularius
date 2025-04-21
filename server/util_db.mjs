import * as a from '@mitranim/js/all.mjs'
import * as dn from '@duckdb/node-api'
import dnb from '@duckdb/node-bindings'
import * as u from './util.mjs'

// See the comment on `facts` in `./schema.sql`.
export const SCHEMA_FACTS_COMPOSITE = true

export class ErrDb extends u.Err {}

export class DuckDb extends dn.DuckDBInstance {
  static async create(path) {return new this(await dnb.open(path))}
  async connect() {return new DuckConn(await dnb.connect(this.db))}
}

export class DuckConn extends dn.DuckDBConnection {
  /*
  The DuckDB binding library throws errors without stack traces. So we have to
  catch and wrap with traces for debugging. We don't pass the cause because
  that would duplicate the message and it doesn't have another trace anyway.
  */
  async run(...src) {
    try {
      return await super.run(...src)
    }
    catch (err) {
      if (
        !a.isErr(err) ||
        (
          a.trim(err.message) ===
          a.trim(a.stripPre(err.stack, a.reqValidStr(err.constructor.name + `: `)))
        )
      ) throw new ErrDb(err)
      throw err
    }
  }

  async queryScalar(...src) {
    const read = await this.runAndRead(...src)
    await read.readUntil(1)

    const rows = a.reqArr(read.getRows())
    if (!rows.length) return undefined

    if (rows.length > 1) {
      throw Error(`too many rows: expected 1, got ${rows.length}`)
    }

    const row = a.reqArr(rows[0])
    if (row.length > 1) {
      throw Error(`too many columns: expected 1, got ${row.length}`)
    }
    return row[0]
  }

  async queryScalars(...src) {
    const read = await this.runAndReadAll(...src)
    const cols = a.reqArr(read.getColumnsJS())
    if (!cols.length) return []
    if (cols.length !== 1) {
      throw Error(`expected exactly 1 column, got ${cols.length}`)
    }
    return cols[0]
  }

  async queryRow(...src) {
    const read = await this.runAndRead(...src)
    await read.readUntil(1)
    return a.head(read.getRowsJS())
  }

  async queryRows(...src) {
    const read = await this.runAndReadAll(...src)
    return read.getRowsJS()
  }

  async queryCols(...src) {
    const read = await this.runAndReadAll(...src)
    return read.getColumnsJS()
  }

  async queryDoc(...src) {
    const read = await this.runAndRead(...src)
    await read.readUntil(1)
    return a.head(read.getRowObjectsJS())
  }

  async queryDocs(...src) {
    const read = await this.runAndReadAll(...src)
    return read.getRowObjectsJS()
  }
}

export function isValidColVal(val) {return a.isKey(val)}

export function reqValidColVal(val) {
  if (isValidColVal(val)) return val
  throw TypeError(`value ${a.show(val)} is incompatible with our DB schema; field values must be non-nil primitives`)
}

export function pickCols(src, keys) {
  a.reqObj(src)
  const out = []
  for (const key of a.reqArr(keys)) {
    const val = src[a.reqStr(key)]
    if (isValidColVal(val)) out.push(val)
    else throw TypeError(`in ${a.show(src)}, field ${a.show(key)} has value ${a.show(val)} which is incompatible with our DB schema; field values must be non-nil primitives`)
  }
  return out
}

export function qTableCols(name) {
  return `
select column_name as name
from information_schema.columns
where table_name = ${sqlStr(u.reqIdent(name))}
order by ordinal_position
`
}

export function qSql(name) {
  return `
select sql
from duckdb_tables()
where internal = false and table_name = ${sqlStr(u.reqIdent(name))}
`
}

export const Q_SCHEMAS = `
select schema_name as schema
from duckdb_tables()
where internal = false
`

export const Q_TABLE_NAMES = `
select table_name as name
from information_schema.tables
`

export const Q_TABLE_SQL = `
select schema_name, table_name, sql
from duckdb_tables()
where internal = false
`

export function sqlStr(val) {
  return `'` + a.laxStr(val).replaceAll(`'`, `''`) + `'`
}
