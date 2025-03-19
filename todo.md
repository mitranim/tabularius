## Setup

<!-- (Done) Serve with GitHub Pages. If build/deploy is necessary, use GitHub Actions. -->

Firebase: maybe DB-side aggregations for clients, for analytics.

Snapshots include user ID, from Firebase authentication.

Snapshots include run ID (auto-generate it).

In case of defeat, last snapshot indicates defeat.

<!-- (Done) The SPA asks for permissions for the save directory (or just progress file), and for the run history directory. The SPA watches the progress file by periodically checking timestamps. On changes, it also checks the round index or run ID. On changes, it cleans up the data and stores it in the run history directory. -->

The SPA lets you view run history, per round, per run.

The SPA may provide an option to roll back the save.

Detect multiple concurrent instances of the app, only one should deal with files.

## Data

### Cleanup

We store snapshots without cleanup, because any changes might break the game in case of rollbacks.

We cleanup either before analyzing the data, or before uploading to Firebase. Rollbacks are supported only from local files, not from Firebase.

Cleanup: drop zero values. Recursively: empty children, empty parents.

Maybe before uploading to Firebase, remove stuff not useful for analytics, like unlocks.

Upgrades: convert to the `ABA`-style format.

Convert long field names to shortened ones for smaller sizes. Choose well, because we're stuck with them. Semi-abbreviated field names are fine.

### Fields

Not everything from the source data is of interest to us. Considering using the following:

* `Version` (if we fail to parse, look at the version and report the difference; at the time of writing, only version 1 exists)
* `RoundIndex`
* `MarkAsExpired` (detect end of run)
* `HeroType` (detect when a commander skews some stats)
* `Skills` (doctrines)
* `OwnedExpertSkills` (Frontier modifiers)
* `DifficultyLevel`
* `CurrentExpertScore` (Frontier heat level)
* `CurrentNeutralOdds` (in combination with neutral buildings, for analyzing Discovery)
* `LastUpdated`

And by far the biggest: `Buildings`.

From buildings:

* id (building's key in the dictionary)
* `EntityID` (building type)
* `PurchasedUpgrades`
* `BuildingType` (`HQ`/`Regular`/`Neutral`, maybe more)
* `SellPrice`
* `SellCurrencyType`
* `LiveStats.stats.DamageDone`
* `LiveStats.stats.DamageDone.valueThisGame`
* `LiveStats.stats.DamageDone.valueThisWave`
* `LiveStats.stats.DamageOverkill.valueThisGame` (untrustworthy?)
* `LiveStats.stats.DamageOverkill.valueThisWave` (untrustworthy?)
* Weapon stats, via one of the following (choose one):
  * `ChildLiveStats`
    * Requires deduplication, stats for some weapons are repeated; for example, in a fully upgraded `SB04`, this repeats stats for `Defender_M5` and `Defender_M5_slug`
  * `Weapons` + `WeaponStats`
    * `WeaponStats` don't have weapon types; we have to match them by indexes to `Weapons` which do; both are lists
    * `WeaponStats[index].stats.DamageDone.valueThisGame`
    * `WeaponStats[index].stats.DamageDone.valueThisWave`
    * `WeaponStats[index].stats.DamageOverkill.valueThisGame` (untrustworthy?)
    * `WeaponStats[index].stats.DamageOverkill.valueThisWave` (untrustworthy?)

Other stats for consideration:
* `Currencies` (to see when players are sitting on too much cash, and also for Grenadier production)
* `LiveStats.stats.DamageDone.countThisGame`
* `LiveStats.stats.DamageDone.countThisWave`
* `LiveStats.stats.DamageOverkill.countThisGame` (untrustworthy?)
* `LiveStats.stats.DamageOverkill.countThisWave` (untrustworthy?)

Building ids: see the Unity docs for object ID generation: https://docs.unity3d.com/ScriptReference/Object.GetInstanceID.html. According to the docs, instance ids may change between sessions, like when repeatedly loading, saving, exiting. This means building ids _may_ change between rounds in such cases. We probably can't rely on them staying consistent. Needs confirmation.

Building ids: when converting them from keys to values, consider parsing as integers, falling back on the original string representation. Motive: they're sequential (newer objects have larger ids), and this would allow us to sort them. The string representations would not be properly sorted by string-sorting algorithms due to varying lengths.

When looking at `DamageDone` or `DamageOverkill` for buildings and weapons, sometimes we should skip it for that round. The game pre-creates them for a lot of objects, even when it's useless. Examples:

* Stats are often preallocated for non-existent weapons. Particularly egregious for buildings with many swappable weapons. We'd be polluting our data with stats for a weapon which does not exist, skewing the results.
  * Every HQ has a Cruiser Cannon (`Cruiser_canon`), even without the corresponding doctrine.
  * Every faction 1 HQ has even more weapons.
  * In `.WeaponStats`, non-existent weapons may have `"stats": {}` (not preallocated), but we shouldn't rely on that.
* All neutral buildings have damage stats, which are usually zero because the building does not actually have weapons. At the very least, we should check for the presence of weapons, or skip all neutrals via `.BuildingType === "Neutral"`.

Note that when a weapon does exist and is enabled, then we _do_ want to count its stats even if they're all zero. Which means when looking at `.WeaponStats[index]` for a particular round, we should check `.Weapons[index].Enabled`. When a weapon is enabled, we count its stats for that round, and vice versa. This should give us stats for situations where a building is not shooting because of bad placement.

Weapon stats could be per building instance, or per building type.

Why bother with weapon stats instead of just building stats? Because upgrades change weapons, and it's very useful to know which perform when, for both players and developers.

### Querying

We want many options for filtering, grouping, aggregating.

* Group by user
* Group by run
* Group by round
* Group by building id
* Group by building type
* Group by building type + upgrades (Mirador AA <> Mirador AAA)
  * May precompute keys: `.EntityID + encodeUpgrade(.PurchasedUpgrades)`
* Group by building kind (Mirador = Advanced Mirador)
* Filter by any of the above
* Aggregate cost
* Aggregate damage done
* Aggregate damage overkill
* Aggregate damage efficiency (damage per cost)

### Flatting

Considering flatting the data to a much flatter, simpler format. Various considerations:
* Could be a list of atomic facts (datoms).
* Could be an event log (similar to the above).
* Probably want to pre-compute some aggregates for later ease.

## Forks

We detect rollbacks. Rollbacks fork the history of a run.

Maybe something like:

* current branch has index 0
* when adding a round, check if there is already that round in the current run
* if true, get that round and all higher rounds, assign them index + 1, and stash them in a folder with the current run ID and the index + 1
* in the Firebase data, update those rounds, assigning them index + 1
* when querying all data, we include old branches
* when querying a specific run, include only rounds with index 0

Could even not bother with indexing, and just set a boolean `isOutdated = true`.

## Permissions

In the Firebase rules, we set restrictions. A user is only allowed to upload snapshots with their own user ID, the snapshots are immutable except for that one field (branch index or "outdated") which is mutable.

Thus, they can't fuck around with other players' data.

Guess we'll have to authenticate them, Firebase has OAuth integrations, it's like 2 clicks.

In the UI, we explain something like:

> Why authentication? To isolate data per player, keeping it safe.
> The app does not store _any_ of your personal information. (No name, no email, etc.)

And display the randomly assigned user ID in the UI, so they can share it with others when asking to look at their data.

Data filtering has an option to filter by user ID.

We _could_ make all data viewable without authentication. We could also make local run history collection available without auth. The uploading of data to Firebase is what needs authentication. We could also require auth from the get-go, to make sure users provide data. Later when the game launches, we might lift that restriction.

If data collection is optional, show "please send us the data!" (rephrase this), with many animated arrows pointing from all sides to the button that authenticates and enables data collection, and the whole thing pulsating.

Sell data upload by mentioning that this gives you your personal run history, in the cloud and safe from local data deletion, cross-platform, viewable from any device, and shareable. (And it helps the devs improve the game.)

## Bot integration

Since we already have a terminal, it should be easy to integrate a bot. Users should be able to type:

```sh
ai Analyze latest run.
```

...and see charts and stuff. Here's how.

Bot requests are structured: we provide definitions of "functions" the bot can use. Functions may be optionally grouped into "tools". The function definitions correspond to actual JS functions. Minimum set:

* Browsing the local files (progress file and history dir)
  * Get a tree of dir and file names
  * Read specific file
    * Files are too large, so we'll need to cleanup/compact content here
* Functions for aggregating data, such as:
  * Aggregate metric A per round
  * Aggregate metric A per building
  * Aggregate metric A across the entire run
* Functions for displaying data, such as showing a line chart

When the bot response describes a function call, we execute that function, send the result to the bot, and wait for its next reply, rinse and repeat. Otherwise we simply print the output.

The state of our system is mutable. Our app could have public APIs that the bot can use. For example, modifying the log, the media content, and so on. After describing our interfaces and maybe our code, we could also tell the bot to _write JS_, and then evaluate it on the client.

The user can set their own API key to use newer or smarter models:

```sh
config set OPEN_AI_API_KEY <value>
config set OPEN_AI_MODEL <value>
```

We use the OpenAI API directly from the client. If we need a default API key and don't want it leaked, we can use a cloud service to proxy the request (keeping the API key secret there), and stay serverless.

## Misc

(Commented-out entries are either done or rejected.)

Consider if there's a danger of the browser tab being unloaded, which would disable the file watching, backups, data upload.

Analytics should ignore all rounds after the final one (number depends on difficulty).

When reading and decoding files:

* Try to detect is the file is just JSON, or also gzipped and base64-encoded.
* Perform the appropriate decoding.
* If decoding or parsing fails, assume that the file may be partially written, and retry after a second, a few times, up to a limit.

UI: have logs of operations. Maybe segregated. Each log may have info msgs and errors. (Ordering: new-to-old? Not sure.)

Add `log.verb` and a UI toggle for verbose logging.

Add log filters.

To reduce size, compress the logs (zip, gzip, whatever works).

Rename "run progress" to "game progress" everywhere.

Provide a way to set a run seed.

Various places in the UI that trigger errorful operations may display given errors as small links to the corresponding errors in the log. (By id and hash-href.)

Wild idea for later: integrate an LLM (e.g. OpenAI API) where we send it the code and what's happening. In case of errors, we can ask for arbitrary suggestions, maybe arbitrary code. The user could have a chat prompt with it for troubleshooting, do this, click that. Maybe suggestions for data analysis?

Make the pseudo-terminal font properly crisp. Compare to native terminal.

Viable commands:

* `help`
* `help <cmd>`
* `ps`
* `ls <dir>` (permission must be granted)
* `cat <file>` (permission must be granted)
* `...`

The notice "N older messages removed" should just be a regular message (but grey).

<!-- In the log, when logging something multi-line, align the lines. (Seems already done.) -->

In the log, timestamps waste too much space. Convert them to single-character indicators, with timestamp tooltips on hover.

<!-- Unfuck msg printing, use functions from `@mitranim/js/lang.mjs`. -->

Unfuck a lot of low-level stuff by using library functions.

<!-- Command `clear` should clear the log. -->

Preserve the output log in `sessionStorage` (primary) and/or `IndexedDB` (fallback). Each entry should be labeled with a type: "inf" or "err".
* DOM elements inside messages should be either excluded from this, or saved as text (`.textContent`).

---

Command history:

We have a dual command history: one local in `sessionStorage`, and one global in either `localStorage` or `IndexedDB`.

When executing a command, add it to _both_ histories (`try/catch` each).

When the app loads, it looks for the history in `sessionStorage`. If there is none, it falls back on the other storage.

---

<!-- Add the command `status` which displays the current status of the features supported by `init`, and also a short list of active processes. -->

---

<!-- The messages passed to `log` may include DOM elements. They should be included as-is without stringifying. -->

---

<!-- In the command `ps`, when listing active processes, for each process, include a small button with a cross that, when clicked, kills the process by calling `.deinit()` on the `Ctx` associated with that process. -->

<!-- Command `ps` should include `pid` for each process in the listing. -->

---

Command `kill` should take a process id (`pid`) and use `.deinit()`, similar to the above. It should also support command names; killing by name kills the first matching process, unless `-a` is passed, then it kills all matching by name. `kill` without arguments produces help for that command. `kill -a` without any other arguments kills all processes.

(Partially done: deinit is supported, `-a` is not.)

---

The default state of the media area should include the list of active processes, reactive and always up to date. This should be placed at the bottom of the area. The code for rendering this must be shared with the command `ps`.

---

In the actual commands, support cancelation via `sig.aborted` from the signal passed when starting the process.

---

For each command, before invoking, create an `AbortController` via `new a.Ctx()` (this is a subclass with support for Go-style context chaining), and pass its `.signal` to the command (the argument is called `sig`). This is intended for Go-style cancelation.

---

Maybe convert prompt textarea to input, so we don't have to think about newlines.

---

Unfuck the bot's code style.

---

Limit length of command history.

---

`help <cmd>` should show help for specific command.

---

Export our modules into global scope, under a single namespace (`tabularius`).

---

When printing a command's output synchronously, skip the time.

---

Refactor quotes into backticks. Automate with `eslint`. Can't use `dprint` or `deno fmt` (which uses `dprint`) because they don't support it.

---

<!-- Tooltips on floating buttons. -->

---

<!-- Unfuck floating button positioning, they shouldn't have hardcoded offsets. -->

---

<!-- Unfuck `ProcessButton`. -->

---

Pending guidelines for bots:
- HTML best practices: accumulate bot mistakes here, move there later:
  - Every `button` must have an explicit `type`.
- Generic:
  - After completing a task, dedup new code with existing code; look harder; dedup harder

---

<!-- In `PROCESS_LIST`, drop "started N ago". -->

---

Log: only scroll to bottom if already scrolled to bottom. Meaning, if scrolled up even by one pixel, don't scroll to bottom.

---

<!-- `kill`: instead of immediately removing a process from the list, give it a status "killing..." and remove it only when its promise completes. This requires us to store each proc's promise in the proc. -->

---

`runCommand` currently adds a history entry even when invoked programmatically. Gotcha? Useful? Unsure.

---

Less vertical spacing in `u.log`.

---

Consistently prefix command logging with current command name. Find places in the code where we currently don't, and fix. Note that the last returned string, or the last error thrown, is auto-prefixed by `runCommand`. Consider consolidating.

---

When round index is increased in `handleBackupScenario`, when we log "Created backup for new round", the next and prev rounds are logged the same. Expected behavior: correctly log the prev round. Avoid doing math.

---

<!-- Initial log width should be 2/3rd of the screen. -->

---

<!-- Since we store `.gd` data, backed up files should use the extension `.gd`. -->

---

An option to backup all save files, not just the progress file.

---

An option to view the contents of a `.gd` file.

---

An option to unpack a file, or a run, or all backups, from `.gd` to JSON.

---

An option to always unpack to JSON.

---

`logShow`: support error chains.

---

When generating monotonic ids, ensure they're ordered within the same millisecond, most likely by using an in-memory counter. Look into how Firebase generates its ids and learn from that. This also reduces the likelihood of collisions between ids generated by different instances of the app.

---

Replace random ids with fixed ordinals, pad to 6 digits, parse when reading. They're our local run and round ids. Upon insertion into DB, they'll be stored as `ord` and remain unique per player.

---

<!-- Dir traversal should be converted to a generic function like `ls`/`os.ReadDir`, and implemented as async generator. -->

---

Catching and logging errors seems to lose their stack traces, possibly due to multiple async steps. Debugging currently requires using the browser debugger to pause on exceptions. Would be nice to get at the actual traces.

---

FS errors such as `NotFoundError` can be hard to debug.

---

Support fetching additional modules, for plugin support. The addresses could be read from `localStorage` and set with a command. Could also be provided as URL query parameters.

(Partially done: via URL query params only.)