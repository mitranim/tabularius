# Coding Guidelines

## Core Principles
- **Brevity**: Concise, focused code. Be terse. Be really terse.
- **Simplicity**: Prefer simple solutions over complex ones
- **Less is more**: Minimize code, dependencies, and complexity
- **Single Responsibility**: Functions and components do one thing well
- **Composition**: Small, reusable parts
- **SMALL BRICKS**: Small building blocks, composed hierarchically
- **Fail Fast**: Validate inputs, fail early and loudly

## Development Approach
- Understand the task
- Break down into smaller tasks
- Figure out solutions
- Break down into smaller solutions
- Bottom-up design: build primitives first, then compose
- After finding an initial solution, refine to find the most elegant approach
- Identify opportunities to convert application code to reusable library code
- Define small reusable utility functions (and constants) instead of hardcoding inline
- Apply new reusable code to existing code to reduce duplication

## Function Design
- Small, focused functions (3 or fewer arguments)
- Each function does one thing well
- Named functions over anonymous inline closures
- Move functions as close to root scope as possible
- Use function hoisting for better code organization
- Avoid parameter destructuring and complex default values
- Validate inputs immediately
- Fail early and loudly

## State Management
- Minimize state and state changes
- Make state changes explicit and traceable
- Avoid invalid states; make zero values useful
- Prefer immutability: create-once, assign-once, use-once
- Use observables for UI reactivity when necessary, but avoid observables for non-UI data
- Inside functions, prefer to read object properties once rather than many times

## Data & Type Safety
- Runtime validation functions:
  - `a.isX` - Returns boolean indicating if value matches type
  - `a.reqX` - Requires value to match type, throws `TypeError` otherwise
  - `a.optX` - Accepts the type or nil
  - `a.onlyX` - Returns value if it matches type, otherwise `undefined`
  - `a.laxX` - Returns default value if nil, otherwise requires type
  - `a.reqInst` - Returns same value if instance of given class, throws `TypeError` otherwise
  - `a.optInst` - Returns nil or same value if instance of given class, throws `TypeError` otherwise
- Create domain-specific validators following library patterns
- Use null-prototype (`a.Emp()`) instead of `{}` for dictionaries
- Minimize `.find` and `.filter`, prefer dictionaries for easy lookup
- In UI code, don't assume collection type (array/map/set), prefer generic functions over methods: `a.map(coll, fun)`, `a.len(coll)`
- `const` by default, `let` when needed, never `var`

## Error Handling
- Use type assertion functions for parameter validation
- Provide clear error messages with context; include the offending value using `a.show(val)`
- Only catch errors you can handle meaningfully
- Avoid excessive `try/catch`

## Functional Programming
- Use functional utilities for data manipulation (`a.map`, `a.fold`, etc.)
- Prefer immutable operations that return new data structures
- Combine operations to avoid multiple iterations
- Build from small, composable functions
- Use dicts/maps for efficient lookup

## API Design
- Implement the general case; optimize for the common case
- Make APIs flexible but simple
- Idempotent functions should return indicators of which path was taken

## Project Structure
- Organize by feature rather than by type when possible
- High-level code at the top, low-level code at the bottom
- Utility code in utility modules
- Separate business logic from UI/presentation code
- Minimize cross-dependencies between modules

## Code Style & Syntax
- No semicolons
- Use backticks for string literals (except in imports)
- 2-space indentation
- Avoid nesting the code as much as possible
- Early returns over nested conditionals
- Ternary expressions for simple conditionals
- Avoid extra spacing in parentheses, brackets, and braces
- Comments tell why, not what (code already tells what)
- Imports use `*` with short alias
- Prefer `async`/`await` over `.then`

## Naming Conventions
- Prefer 3 characters
- Role-based names:
  - `val` for generic values
  - `err` for errors
  - `out` for outputs
  - `tar` for targets of modification
  - `ind` for index
  - `key` for keys
  - `src` for source
- Type-based for unclear roles: `str`, `num`, `obj`, `arr`, `map`, `set`
- Short names that reflect purpose
- Singular names for singular types, plural for collections
- Ultra-short names for import aliases
- Initialization and deinitialization methods are called `init` and `deinit`
- `onX` over `handleX` for callbacks
- Names must match entity types / roles / concepts

## Logging
- Silence by default
- Verbosity is opt-in

## Shell commands
- `rg` (ripgrep) over `find` for searching files
- `trash` over `rm` for deleting files

## Examples

Example of importing modules:

```js
import * as a from '@mitranim/js/all.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as u from './util.mjs'
import * as fs from './fs.mjs'
```

Example of validating inputs and handling nil:

```js
function emailReceiver(src) {
  // Nil input = nil output.
  if (a.isNil(src)) return undefined

  // Validate relevant values.
  // Fail fast, trust the caller to handle errors.
  a.reqObj(src)

  // Some strings are optional.
  a.optStr(src.name)

  // Some strings must be non-empty.
  a.reqValidStr(src.email)

  // Now safe to use.
  return src.name ? `${src.name} <${src.email}>` : src.email
}
```

Example of collection transformations:

```js
const doubles = a.map(nums, val => val * 2)

const active = a.filter(users, val => val.isActive)

const domains = a.map(
  a.filter(users, val => val.isActive),
  val => a.laxStr(val.email).split(`@`)[1]
)
```

For creating and manipulating the DOM, use the tools provided by `@mitranim/js`. Examples below:

```js
import * as p from '@mitranim/js/prax.mjs'
import * as ob from '@mitranim/js/obs.mjs'
import * as od from '@mitranim/js/obs_dom.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'

// Create renderer.
const REN = new p.Ren()
const E = REN.E.bind(REN)

// Create or mutate elements via `E`.
const elem = E(`div`, {class: `container`},
  E(`h1`, {}, `Title`),
  E(`p`, {}, `Content`)
)

// Use observables for mutable state. Observables monitor access to object
// properties, and notify subscribers on changes in object properties.
const obs = ob.obs({count: 0})

function inc() {obs.count++}

// Reactive custom elements automatically subscribe to observables.
class Counter extends od.MixReacElem(dr.MixReg(HTMLElement)) {
  run() {
    E(this, {},
      E(`button`, {type: `button`, onclick: inc}, obs.count)
    )
  }
}
elem.append(new Counter())
```

Early returns over nested conditionals:

```js
// GOOD: flat control flow
function simple() {
  const one = something0()
  if (!one) return

  const two = something1()
  if (!two) return

  something2()
}

// BAD: nested control flow
function perplexing() {
  const one = something0()
  if (one) {
    const two = something1()
    if (two) {
      something2()
    }
  }
}
```

Make UI markup as flat as possible, minimize nesting:

```js
// GOOD: minimal nesting, smaller building blocks
function Page() {
  return E(`div`, {},
    Header(),
    Content(),
    Footer(),
  )
}

// BAD: deep nesting
function Page() {
  return E(`div`, {},
    E(`header`, {...}, ...), // Million lines of code.
    E(`main`, {...}, ...),   // Million lines of code.
    E(`footer`, {...}, ...), // Million lines of code.
  )
}
```

Treat `null` and `undefined` identically, by using the function `a.isNil`.

## App-specific special cases

Shared code in dir `shared` must be directly runnable in Deno and browsers.

Server code in dir `server` must be directly runnable in Deno.

Client code in dir `client` must be directly runnable in browsers.

JS file names end with `.mjs`.

All client-side logging must be done via the element `log` in `./client/util.mjs`; errors are logged with `log.err`, other messages with `log.info`.

Deconstruct imports for the function `E`; avoid import deconstruction in other cases:

```js
import {E} from './ui.mjs'
import * as ui from './ui.mjs'
```

When hiding an element, use the property `.hidden`; avoid `.style.display`.

### Guidelines for CSS

We use Tailwind CSS for styling.

We use CSS-in-JS via the library `twind`, which dynamically generates Tailwind-compliant styles.

The vast majority of the styling is done in JS. Avoid modifying styles in HTML files unless absolutely unavoidable.

We support both light and dark modes.

Whitespace:

* Always space with `flex gap-*`.
* Never use margins.
* Padding is always all-around: `p-*`, never `pb-*`, `pt-*`, etc.
  * The existing counter-examples in the code are legacy; ignore.
* In inline text, space-out with regular space characters.
* The default unit of spacing is `1rem`, corresponding to 4 units in Tailwind classes.

Simplicity:

* We're a terminal emulator (with embedded media). The UI is minimal and simple.

Typography:

* We set the monospace font family at the top level, and don't alter it anywhere else.
* Stick to default font size, avoid modifying it.
* Avoid bold or italic fonts.
