/*
Unfinished sketch intended to eventually implement TD pathing algorithms.
Work in progress; not guaranteed to be continued.
*/

class ZoneType {
  // Sketch, could be used for placement eligibility.
  north = false
  south = false
  west = false
  east = false

  constructor({zoneTypeId, squares}) {
    this.zoneTypeId = zoneTypeId
    this.squares = squares

    for (const {X, Y} of squares) {
      if (Y === -2) this.north = true
      if (Y === +2) this.south = true
      if (X === -2) this.west = true
      if (X === +2) this.east = true
    }
  }
}

const ZONE_TYPES = indexBy([
  new ZoneType({
    zoneTypeId: `HQ`,
    squares: [
      // {X: 0,  Y: -2},
      // {X: 0,  Y: +2},
      // {X: -2, Y: 0},
      {X: +2, Y: 0},
    ],
  }),
  /*
      ┏━━━━━━━━━━━━━━━━━┓
      ┃  2     5     7  ┃
  ━━━━┛┄┄┄┄┄┏━━━━━┓┄┄┄┄┄┗━━━━
    1    3  ┃     ┃  8    10
  ━━━━┓┄┄┄┄┄┗━━━━━┛┄┄┄┄┄┏━━━━
      ┃  4     6     9  ┃
      ┗━━━━━━━━━━━━━━━━━┛
  */
  new ZoneType({
    zoneTypeId: `I`,
    squares: [
      {X: -2, Y: 0},
      {X: -1, Y: -1},
      {X: -1, Y: 0},
      {X: -1, Y: +1},
      {X: 0,  Y: -1},
      {X: 0,  Y: +1},
      {X: +1, Y: -1},
      {X: +1, Y: 0},
      {X: +1, Y: +1},
      {X: +2, Y: 0},
    ],
  }),
], getZoneTypeId)

function indexBy(src, fun) {
  const out = Object.create(null)
  for (src of src) out[fun(src)] = src
  return out
}

function getZoneTypeId(val) {return val.zoneTypeId}

class Zone {
  constructor({zoneTypeId, X, Y}) {
    this.zoneTypeId = zoneTypeId
    this.X = X
    this.Y = Y
  }

  isHQ() {return this.zoneTypeId.startsWith(`HQ`)}
}

class Square {
  constructor({X, Y, distMin, distMax}) {
    this.X = X
    this.Y = Y
    this.distMin = distMin ?? Number.MAX_SAFE_INTEGER
    this.distMax = distMax ?? Number.MAX_SAFE_INTEGER
  }
}

const ZONES = [
  new Zone({
    zoneTypeId: `HQ`,
    X: 0,
    Y: 0,
  }),
  ...times(31, ind => new Zone({
    zoneTypeId: `I`,
    X: ind+1,
    Y: 0
  })),
]

function times(len, fun) {
  const out = Array(len)
  let ind = -1
  while (++ind < len) out[ind] = fun(ind)
  return out
}

const SQUARE_INDEX = new Map()
const HQ_SQUARES = new Set()
const PATH_SQUARES = new Set()
const ENTRY_SQUARES = new Set()

for (const zone of ZONES) {
  const {zoneTypeId, X: ZX, Y: ZY} = zone
  const type = ZONE_TYPES[zoneTypeId]

  for (const {X: SX, Y: SY} of type.squares) {
    const HQ = zone.isHQ()
    const X = (ZX*5) + SX
    const Y = (ZY*5) + SY
    const distMin = HQ ? 0 : undefined
    const distMax = HQ ? 0 : undefined
    const sqr = new Square({X, Y, distMin, distMax})

    indexSquare(sqr)
    if (HQ) HQ_SQUARES.add(sqr)
    else PATH_SQUARES.add(sqr)
  }
}

function indexSquare(sqr) {
  const {X, Y} = sqr
  let tar = SQUARE_INDEX.get(X)
  if (!tar) {
    tar = new Map()
    SQUARE_INDEX.set(X, tar)
  }
  if (tar.has(Y)) throw Error(`redundant square ${JSON.stringify(sqr)}`)
  tar.set(Y, sqr)
}

const SQUARE_QUE = new Set(HQ_SQUARES)

for (const sqr of SQUARE_QUE) {
  const {X, Y, distMin, distMax} = sqr

  let entry = true
  if (enqueAdjacent(X,   Y-1, distMin+1, distMax+1)) entry = false
  if (enqueAdjacent(X,   Y+1, distMin+1, distMax+1)) entry = false
  if (enqueAdjacent(X+1, Y,   distMin+1, distMax+1)) entry = false
  if (enqueAdjacent(X+1, Y,   distMin+1, distMax+1)) entry = false

  // Known bug: looping around back to HQ counts as foe entry.
  // Our mock data doesn't have such cases yet.
  // We also don't detect BFs.
  if (entry) ENTRY_SQUARES.add(sqr)
}

function enqueAdjacent(X, Y, distMin, distMax) {
  const sqr = SQUARE_INDEX.get(X)?.get(Y)
  if (!sqr) return false

  /*
  This hack isn't going to work. This loss of info doesn't work when tracing
  from spawns. Sometimes min distance goes down, then up, and you don't know
  that the "up" one actually leads to another HQ entrance.
  */
  // sqr.distMin = Math.min(sqr.distMin, distMin)
  // sqr.distMax = Math.max(sqr.distMax, distMax)

  SQUARE_QUE.add(sqr)
  return true
}

// const FAR_TO_CLOSE_SQUARES = [...SQUARE_QUE].sort(compareDistDesc)
// function compareDistDesc(one, two) {return two.dist - one.dist}

// console.log(HQ_SQUARES)
// console.log(ENTRY_SQUARES)
