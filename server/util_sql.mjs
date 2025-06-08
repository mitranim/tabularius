import * as a from '@mitranim/js/all.mjs'
import * as su from '../shared/util.mjs'

/*
Must be used as a template string tag. Returns an `Sql` object. Example:

  const {text, args} = u.sql`
    select *
    from some_table
    where ${some_other_sql}
  `
  const _ = await conn.run(text, args)
*/
export function sql(src, ...inp) {
  a.reqArr(src)
  a.reqArr(inp)

  const out = new Sql()
  let ind = -1

  while (++ind < inp.length) {
    out.text += a.reqStr(src[ind])
    out.append(inp[ind])
  }
  if (ind < src.length) out.text += a.reqStr(src[ind])
  return out
}

export function sqlRaw(val) {return new SqlRaw(a.renderLax(val))}

export class SqlRaw extends String {
  sqlAppend(tar) {
    a.reqInst(tar, Sql)
    if (!this.length) return
    tar.text = ensureTrailingSpace(tar.text)
    tar.text += this
  }

  get text() {return this.toString()}
  get args() {return undefined}
}

export class SqlIdent extends SqlRaw {
  constructor(val) {super(su.reqIdent(val))}
}

export class Sql extends a.Emp {
  constructor(text, args) {
    super()
    this.text = a.laxStr(text)
    this.args = a.laxArr(args)
  }

  append(...val) {
    for (val of val) {
      this.text = ensureTrailingSpace(this.text)

      if (a.isNil(val)) {
        this.text += `null`
        continue
      }

      if (a.isNum(val) || a.isBool(val)) {
        this.text += val
        continue
      }

      if (a.hasMeth(val, `sqlAppend`)) {
        val.sqlAppend(this)
        continue
      }

      this.text += `?`
      this.args.push(val)
    }
    return this
  }

  sqlAppend(tar) {
    a.reqInst(tar, Sql)
    tar.text += this.text
    tar.args.push(...this.args)
  }

  static join(src, sep) {
    src = a.laxArr(src)
    sep = ensureTrailingSpace(ensureLeadingSpace(sep))

    const out = new Sql()
    if (!src.length) return out
    if (src.length === 1) return out.append(src[0])

    out.text += `(`
    for (const val of a.init(src)) {
      out.append(val)
      out.text += sep
    }
    out.append(a.last(src))
    out.text += `)`
    return out
  }
}

export class SqlSep extends Array {
  get sep() {throw Error(`must implement in subclass`)}

  sqlAppend(tar) {
    a.reqInst(tar, Sql)

    if (!this.length) return
    if (this.length === 1) {
      tar.append(this[0])
      return
    }

    const sep = ensureTrailingSpace(ensureLeadingSpace(this.sep))
    tar.text += `(`
    let ind = -1
    while (++ind < this.length - 1) {
      tar.append(this[ind])
      tar.text += sep
    }
    tar.append(a.last(this))
    tar.text += `)`
  }
}

export class SqlOr extends SqlSep {get sep() {return `or`}}

export class SqlAnd extends SqlSep {
  get sep() {return `and`}

  static fromDict(src) {
    a.optDict(src)
    const out = new this()
    for (const [key, vals] of a.entries(src)) {
      const ident = new SqlIdent(key)
      const buf = new SqlOr()
      for (const val of a.laxArr(vals)) buf.push(sql`${ident} = ${val}`)
      if (buf.length) out.push(buf)
    }
    return out
  }
}

export class SqlWhere extends SqlAnd {
  sqlAppend(tar) {
    a.reqInst(tar, Sql)
    if (!this.length) return
    tar.text += `where `
    super.sqlAppend(tar)
  }
}

function ensureLeadingSpace(val) {
  a.reqStr(val)
  if (!val || val.startsWith(` `)) return val
  return ` ` + val
}

function ensureTrailingSpace(val) {
  a.reqStr(val)
  if (!val || val.endsWith(` `)) return val
  return val + ` `
}
