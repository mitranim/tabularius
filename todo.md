(Commented-out entries are either done or rejected.)

## Setup

<!-- (Done) Serve with GitHub Pages. If build/deploy is necessary, use GitHub Actions. -->

<!-- Firebase: maybe DB-side aggregations for clients, for analytics. -->

<!-- Snapshots include user ID, from Firebase authentication. -->

<!-- Snapshots include run ID (auto-generate it). Also consider a local run index, for easier ordering, and a run timestamp, which equals to the timestamp of the first round. -->

In case of defeat, last snapshot indicates defeat.

<!-- (Done) The app asks for permissions for the save directory (or just progress file), and for the run history directory. The app watches the progress file by periodically checking timestamps. On changes, it also checks the round index or run ID. On changes, it cleans up the data and stores it in the run history directory. -->

<!-- The app lets you view run history, per round, per run. -->

The app may provide an option to roll back the save.

<!-- Detect multiple concurrent instances of the app, only one should deal with files. -->

## Data

### Upload

- [x] For now, it's going to be manual. We add a command `upload`.
- [x] It first ensures we're authed.
- [x] It takes either `/`, or `<run_id>`, or `<run_id>/<round_id>`.
- [x] It walks the resulting dirs, uploading rounds one by one.
- [x] To display progress in the terminal, it adds one reactive element and continuously updates it, to avoid spam. Something like:
- [x] Automatically derive our star schema server-side.
- [x] Automatic cloud uploads when authed.
  - [x] Use a mutex to ensure only one tab and one process does the uploading, like in `watch`.
  - [x] New rounds detected by `watch` should trigger upload.

```
uploading run A of N (id <id>)...

uploading round B of M (id <id>)...
```

```
uploaded A of B runs, see error below
```

```
uploaded A of B runs, skipped C (already uploaded)
```

When entering root:
- [x] Walk runs dirs in order.

When entering a run:
- [x] Use its dir name as run id.
- [x] Walk progress files in order.

After reading a progress file:
- [x] Check if it already has a Firestore id. If true, skip it.
- [x] Bash together an id, like we already do, but the user id now comes from FB.
  - [x] `<user.uid>_<run_dir>_<round_index>`
- [x] Ensure that the document has:
  - [x] The current FB user id.
  - [x] The current run id (local dir name). Rename the field; `runId` implies uniqueness, we need another name.
  - [x] The id that we just made. (Unless FB adds it as a field automatically.)
  - [x] All fields we add are namespaced by prefixing with `tabularius_` to avoid collisions with the game's field names, and for clarity.
- [x] Idempotently put the document under that id.
  - [x] This ensures that each round is uploaded only once per user+run.
  - [x] How does this interact with rollbacks and forks? Our `watch` command treats rolled-back rounds as new runs, and creates _incomplete_ backups of those new runs, starting at the round just after the fork. For the purpose of global analytics, that's probably not wrong. For the user, this also lets them tell apart the branches. The only inconvenience is being unable to view an entire branch.
- [x] Add the cloud document id to the file's data, and write it to disk, with the proper encoding.

Also: consider uploading runs concurrently.

<!-- ### Cleanup

We store snapshots without cleanup, because any changes might break the game in case of rollbacks.

We cleanup either before analyzing the data, or before uploading to Firebase. Rollbacks are supported only from local files, not from Firebase.

Cleanup: drop zero values. Recursively: empty children, empty parents.

Maybe before uploading to Firebase, remove stuff not useful for analytics, like unlocks.

Upgrades: convert to the `ABA`-style format.

Convert long field names to shortened ones for smaller sizes. Choose well, because we're stuck with them. Semi-abbreviated field names are fine. -->

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

<!-- We want many options for filtering, grouping, aggregating.

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

We support arbitrary filtering, grouping, aggregation via CLI args, for both local and cloud data:

```sh
plot -c
plot -c userId=current
plot -c run=123 run=234
plot -c run=123 userId=current
plot run=123
plot run=latest
plot run=123 run=latest
plot run=123 -m=dmg
plot run=123 -m=eff
plot -x=roundNum -y=dmgDone -z=buiTypeUpg
plot -x=roundNum -y=dmgOver -z=buiTypeUpg
plot -x=roundNum -y=dmgEff -z=buiTypeUpg -a=avg
``` -->

<!-- Should be possible to specify arbitrary stat types and scopes. But their full names are long. Probably end up with some aliases for commonly used fields, like `dmg` means `statType = dmg && statScope = round`. -->

Should add a command to show an arbitrary fact, to view what's possible. Maybe several example facts, with different stuff. Could be hardcoded in the schema file.

Should be possible to specify one filter and then multiple other options, for multiple plots. We would end up querying data only once, and aggregating for multiple plots in parallel, from the same data. Not relevant for small data sets, useful for large ones, especially in the cloud.

<!-- Consider using Firestore's `getAggregateFromServer`. It supports multiple aggregates over one query, but only returns one aggregate for each. Not as good / convenient / performant as rolling our own aggregating cloud function, but might be faster to get started with. But hundreds of requests per plot is probably not viable. -->

<!-- ### Flatting

* [x] Considering flatting the data to a much flatter, simpler format. Various considerations:
  * Could be a list of atomic facts (datoms).
  * Could be an event log (similar to the above).
  * Probably want to pre-compute some aggregates for later ease.

Went with a star schema. No pre-computed aggregates (yet). -->

## Forks

We detect rollbacks. Rollbacks fork the history of a run.

Maybe something like:

* current branch has index 0
* when adding a round, check if there is already that round in the current run
* if true, get that round and all higher rounds, assign them index + 1, and stash them in a folder with the current run ID and the index + 1
* in the cloud data, update those rounds, assigning them index + 1
* when querying all data, we include old branches
* when querying a specific run, include only rounds with index 0

Could even not bother with indexing, and just set a boolean `isOutdated = true`.

<!-- ## Permissions

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

Should use the FB Local Emulator Suite for development: https://firebase.google.com/docs/emulator-suite

Also see https://firebase.google.com/docs/rules/simulator for testing security rules. -->

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

<!-- The user can set their own API key to use newer or smarter models:

```sh
config set OPEN_AI_API_KEY <value>
config set OPEN_AI_MODEL <value>
```

We use the OpenAI API directly from the client. If we need a default API key and don't want it leaked, we can use a cloud service to proxy the request (keeping the API key secret there), and stay serverless. -->

Correction to the above: we'll simply use FB GenKit or VertexAI.

## Misc

Consider if there's a danger of the browser tab being unloaded, which would disable the file watching, backups, data upload.

Analytics should ignore all rounds after the final one (number depends on difficulty).

When reading and decoding files:

* Try to detect is the file is just JSON, or also gzipped and base64-encoded.
* Perform the appropriate decoding.
* If decoding or parsing fails, assume that the file may be partially written, and retry after a second, a few times, up to a limit.

UI: have logs of operations. Maybe segregated. Each log may have info msgs and errors. (Ordering: new-to-old? Not sure.)

<!-- Add `log.verb` and a UI toggle for verbose logging. -->

Add log filters.

To reduce size, compress the logs (zip, gzip, whatever works).

Rename "run progress" to "game progress" everywhere.

Provide a way to set a run seed.

Various places in the UI that trigger errorful operations may display given errors as small links to the corresponding errors in the log. (By id and hash-href.)

Wild idea for later: integrate an LLM (e.g. OpenAI API) where we send it the code and what's happening. In case of errors, we can ask for arbitrary suggestions, maybe arbitrary code. The user could have a chat prompt with it for troubleshooting, do this, click that. Maybe suggestions for data analysis?

Make the pseudo-terminal font properly crisp. Compare to native terminal.

<!-- Viable commands:

* `help`
* `help <cmd>`
* `ps`
* `ls <dir>` (permission must be granted)
* `cat <file>` (permission must be granted)
* `...` -->

<!-- The notice "N older messages removed" should just be a regular message (but grey). -->

<!-- In the log, when logging something multi-line, align the lines. (Seems already done.) -->

<!-- In the log, timestamps waste too much space. Convert them to single-character indicators, with timestamp tooltips on hover. -->

<!-- Or: each log entry has a prefix, like `[watch]` or `>`, and the prefix is hoverable, showing a timestamp. -->

<!-- Unfuck msg printing, use functions from `@mitranim/js/lang.mjs`. -->

<!-- Unfuck a lot of low-level stuff by using library functions. -->

<!-- Command `clear` should clear the log. -->

Preserve the output log in `sessionStorage` (primary) and/or `IndexedDB` (fallback). Each entry should be labeled with a type: "info" or "err".
* DOM elements inside messages should be either excluded from this, or saved as text (`.textContent`).

---

<!-- Command history:

We have a dual command history: one local in `sessionStorage`, and one global in either `localStorage` or `IndexedDB`.

When executing a command, add it to _both_ histories (`try/catch` each).

When the app loads, it looks for the history in `sessionStorage`. If there is none, it falls back on the other storage. -->

---

<!-- Log width: store in both `sessionStorage` and `localStorage`, like `LOG_VERBOSE`. -->

---

<!-- Add the command `status` which displays the current status of the features supported by `init`, and also a short list of active processes. -->

---

<!-- The messages passed to `log` may include DOM elements. They should be included as-is without stringifying. -->

---

<!-- In the command `ps`, when listing active processes, for each process, include a small button with a cross that, when clicked, kills the process by calling `.deinit()` on the `Ctx` associated with that process. -->

<!-- Command `ps` should include `pid` for each process in the listing. -->

---

<!-- Command `kill` should take a process id (`pid`) and use `.deinit()`, similar to the above. It should also support command names; killing by name kills the first matching process, unless `-a` is passed, then it kills all matching by name. `kill` without arguments produces help for that command. `kill -a` without any other arguments kills all processes. -->

---

<!-- The default state of the media area should include the list of active processes, reactive and always up to date. This should be placed at the bottom of the area. The code for rendering this must be shared with the command `ps`. -->

---

<!-- In the actual commands, support cancelation via `sig.aborted` from the signal passed when starting the process. -->

---

<!-- For each command, before invoking, create an `AbortController` via `new a.Ctx()` (this is a subclass with support for Go-style context chaining), and pass its `.signal` to the command (the argument is called `sig`). This is intended for Go-style cancelation. -->

---

<!-- Maybe convert prompt textarea to input, so we don't have to think about newlines. -->

---

<!-- Unfuck the bot's code style. -->

---

<!-- Limit length of command history. -->

---

<!-- `help <cmd>` should show help for specific command. But only if we can be bothered to define detailed help for each command. May eventually. -->

---

<!-- Export our modules into global scope, under a single namespace (`tabularius`). -->

---

<!-- When printing a command's output synchronously, skip the log timestamp. -->

---

<!-- Refactor quotes into backticks. -->

Automate with `eslint`. Can't use `dprint` or `deno fmt` (which uses `dprint`) because they don't support it.

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

<!-- `runCmd` currently adds a history entry even when invoked programmatically. Gotcha? Useful? Unsure. -->

---

<!-- Less vertical spacing in `u.log`. -->

---

Consistently prefix command logging with current command name. Find places in the code where we currently don't, and fix. Note that the last returned string, or the last error thrown, is auto-prefixed by `runCmd`. Consider consolidating.

---

<!-- When round index is increased in `handleBackupScenario`, when we log "Created backup for new round", the next and prev rounds are logged the same. Expected behavior: correctly log the prev round. Avoid doing math. -->

---

<!-- Initial log width should be 2/3rd of the screen. -->

---

<!-- Since we store `.gd` data, backed up files should use the extension `.gd`. -->

---

An option to backup all save files, not just the progress file.

---

<!-- An option to view the decoded contents of a `.gd` file. -->

<!-- An option to copy the decoded contents to the clipboard. -->

---

<!-- An option to unpack a file, or a run, or all backups, from `.gd` to JSON.

(Partially implemented as a specialized `decode` command. Needs to be more flexible.) -->

---

<!-- An option to unpack the source progress file to a JSON file on disk. -->

<!-- (Partially done, but not quite: the `decode` command can show a specific backup file, but not the source progress file.) -->

An option to overwrite the source progress file with the content of the given output JSON file (after manual editing, for example).

We could also store a global var, user could edit it in the browser console, then we can store that var to a file.

---

<!-- `decode` should have run and round modes. If a run is specified, decode the whole run. If a round in a run is specified, decode only that round. -->

---

<!-- Consolidate `show`, `decode`, `show_saves` into one command. It should also support run numbers, similar to `plot`. -->

---

<!-- Consolidate `ls` and `cls`, with a flag that switches between local and cloud sources, similar to `plot`. -->

---

<!-- Consolidate `status` and `ps`. -->

---

`logElem` / `logShow`: support error chains.

---

<!-- When generating monotonic ids, ensure they're ordered within the same millisecond, most likely by using an in-memory counter. Look into how Firebase generates its ids and learn from that. This also reduces the likelihood of collisions between ids generated by different instances of the app. -->

---

<!-- Replace random ids with fixed ordinals, pad to 6 digits, parse when reading. They're our local run and round ids. Upon insertion into DB, they'll be stored as `ord` and remain unique per player. -->

---

<!-- Dir traversal should be converted to a generic function like `ls`/`os.ReadDir`, and implemented as async generator. -->

---

<!-- Catching and logging errors seems to lose their stack traces, possibly due to multiple async steps. Debugging currently requires using the browser debugger to pause on exceptions. Would be nice to get at the actual traces. -->

---

<!-- FS errors such as `NotFoundError` can be hard to debug. -->

---

Support fetching additional modules, for plugin support. The addresses could be read from `localStorage` and set with a command. Could also be provided as URL query parameters.

(Partially done: via URL query params only.)

---

<!-- Display app version in UI, for easier error reporting/debugging. -->

Added (hardcoded), TODO auto-increment.

---

<!-- Charts.

Considered many bot suggestions, tried d3, `@observablehq/plot` (which is d3-based), `uplot`. Settled on `uplot`: _much_ smaller, way fewer files, advertizes better performance.

TODO:
- Finish styling.
- Add `analyze` command.
  - Implement reading run data.
  - Settle on one schema already.
- Integrate with media panel. -->

---

<!-- Polyfill for customized built-in elements: https://github.com/ungap/custom-elements. -->

---

<!-- When the File System API is not available, give the users a descriptive error. -->

---

<!-- `Plotter` should use `ResizeObserver` on its parent, instead of a `resize` event listener. -->

---

After we settle down with our usage of `uplot`, it might be pertinent to comment in various issues related to dark mode, and provide code samples of how we support dark/light modes, with dynamic detection and switching:

https://github.com/leeoniya/uPlot/issues?q=dark%20

---

<!-- Plot/analyze: totals; should be shown on labels instead of `--` placeholders when nothing is hovered. -->

---

<!-- Plot: order series by total value. When hovering an X point, reorder the legend labels by the value in that current X. -->

---

Plot: when zoomed-in, totals should be calculated only for the currently _visible_ ranges in the chart.

---

Plot auto-updating. First from local data, then from cloud data. Demos:

https://leeoniya.github.io/uPlot/demos/stream-data.html
https://leeoniya.github.io/uPlot/demos/pixel-align.html
https://leeoniya.github.io/uPlot/demos/sine-stream.html

The file watcher needs to send new data to the plot.

* [x] Local.
* [ ] Cloud.

---

Plot: button to toggle all series.

---

Plot: when the cursor is near many near-overlapping data points (within a certain proximity threshold), we should group them up, and include all in a tooltip.

---

Plot: when grouping multiple sources, such as buildings or weapons, into one series, indicate the count of grouped entries in the label. Might be WONTFIX because the count _changes_ between rounds.

---

<!-- Plot: compact the numbers by using `k`/`m` suffixes, like in the game proper. (Do that on the labels _and_ in the tooltip.) -->

---

<!-- Media: always show processes under custom media, such as plots. -->

---

<!-- Plot: when analyzing building damage, exclude series where every value is zero or missing. -->

---

Plot: consider if even in damage per round charts, it's not useful to have a chart where values just go up as the rounds progress. Perhaps we should normalize the values per round in such a way that comparisons between rounds are meaningful.

---

<!-- Consistently prefer lowercase msgs in log, errors, etc. -->

Should probably revert this. When logging large chunks of text, using proper sentences would make it easier to tell where sentences begin and end. Lowercase without trailing dot is only good for errors, to make error messages composable.

---

<!-- Option to analyze latest run without having to type its ID. -->

(Done via the `latest` alias.)

---

<!-- Ship with mock data and render a chart right away, for demonstration. -->

---

<!-- Media pane: support adding any number of custom contents, which can be closed separately. Maybe vertically as blocks with close buttons, maybe as tabs. If using tabs, the tab headers should be grid-like, reflowing (maybe `position: float`). -->

---

<!-- Building damages need to use `.ChildLiveStats` to include troop damage, similar to what the game UI does. -->

---

Support importing arbitrary local plugin scripts like so:
- Get access to plugin dir (probably separate command).
- The auto-import feature (currently only via URL query params) looks for matching files in plugin dir, reads them, then imports via `Blob`, which is the modern equivalent of eval, but as a module.

```js
import(URL.createObjectURL(new Blob(src, {type: `application/javascript`})))
```

Specifics:
- Create new command `init_plugins` which picks a directory for JS plugin files.
  - Has its own dir handle; may need new code very similar for conf/load/init/deinit code for the run history dir. The handles may overlap, but generally they won't, so we don't care.
- When loading URL-query-imported modules on start, we also look in the plugin dir, if initialized.

Sample code:

```js
import(URL.createObjectURL(new Blob([`
import * as fs from 'tabularius/fs.mjs'
console.log(fs)
`], {type: `application/javascript`})))
```

---

<!-- Consider supporting non-string run and round indexes. For example, run `000000` should be considered same as `0` locally. -->

<!-- Consider supporting relative run and round indexes. For example, a user's first run fetched from cloud storage should be indexed as `0`, and so on. -->

---

When analyze one run, or group by commander: show commander name (add to code file, rename it). When analyze one faction, or group by faction: show faction name.

Where to show: probably on a combined stat screen (not a plot) which we're yet to implement.

---

Save editing features. Load a particular file (by default the progress file, but may select a backup). Show various editable stats. Edit, then store the file back.

---

`copy` to load into clipboard. `paste` or Ctrl+V in prompt to paste. `store` to write to progress file.

---

`store <path>` to overwrite progress file with content of `<path>`.

---

A way to "stick" a run id, round id, building id for subsequent commands. Persist to storage.

---

A media UI for showing building, child, weapon stats in a nice format. Flattening the data and printing JSON is an okay start, but we can do better.

Viable stats:
- Damage this round.
- Damage this run.
- Various weapon stats (damage, RoF, AoE, and more).

A way of viewing stats super zoomed-in, for a particular round > building > child / weapon.

---

A media UI for showing a breakdown of the latest round and the run so far. (The stat screen that the players constantly ask for.)

Simple approach: a table from almost the same dataset we use for charts. Columns are rounds, rows are series, values are values. But, each cell has two values: per round, and per run accumulated so far (up to that round). There's a toggle for which value is prioritized (round or run_acc); the table is sorted by the priority value, and it's put on top in each cell. Maybe round and run_acc are differentiated by color, and there's a color legend nearby.

Above the table: user id (hidden for now), run id, faction, commander, round count.

Also: total damage would be nice.

Also: we could include even more stats per cell.

So in a general case, every cell is an entity with fields. Our data is N-dimensional.

Near the table, there could be a list of fields, one of them always selected, that's what shows up per cell.

Maybe the weapon stats mentioned above also go here. Needs plenty of filters.

---

<!-- Identify empty rounds with no run. Do not backup. -->

---

<!-- The `show` command should print the object to the browser console, so the user can browse it. Instruct the user about the console. -->

---

In the terminal, differentiate user inputs from other log entries. Maybe by their prefix.

---

<!-- Live updates of a given analysis. Maybe an analysis sticks around and is stateful. There may be multiple live at once. As long as the procs are running, they may receive updates. Alternatively, instead of running procs, they may simply be found in `MEDIA`. The latter probably makes more sense in JS technical terms, but treating them as procs and tying the lifetime of their medias to the lifetimes of the processes makes management simpler. And we can reuse the proc UI for the media management.

Update: tying media elements to procs makes no sense in the DOM API. Just give them their own "close" buttons. -->

---

Live plot updates. Ideas:
- [x] Each tab allocates a `Dat` singleton (`DAT`). All rounds go there. It's also an `EventTarget`.
- [x] We add functions `datLoadRun` and `datLoadRound`, where the latter is idempotent.
- [x] After updating `DAT`, we dispatch an event on it, detailing the changes.
  - Currently only on new round, which should be enough for plotters.
- [x] The watcher broadcasts FS updates to all tabs.
- [x] In each tab, `dat.mjs` has a static event listener on its broadcast channel, which updates `DAT` when a new round is broadcast.
- [x] We only need to load data from FS when starting analysis, and we do that idempotently for rounds.
- [x] On FS events, `DAT` updates are always incremental and in-memory, even between tabs. (Always +round.)
- [x] The watch event includes:
  - [x] New round as-is.
  - [x] What's the latest run.
  - [x] Did the latest run change.
  - [x] What's the latest round id and index (maybe include in round data).
- [x] Plotters always use `DAT` as their source.
- [x] Plotters always subscribe to `DAT` to detect changes in their particular data.
  - [x] Subscribe in `.connectedCallback`.
  - [x] Unsubscribe in `.disconnectedCallback`.
- [x] On an update for its particular data, a plotter rebuilds its plot series and data from `DAT`.
- [x] Runs have aliases. The most relevant one is `latest`, which always corresponds to the latest run id.
- [x] A plotter may be given a run id. When the run id is `latest`, a plotter remembers the specific id used last time, and compares it with the new latest on `DAT` updates.
- [x] Plotters don't rebuild the plot when there's no change in the exact run and rounds they used last time.

---

<!-- The `watch` command gotta use the Web Locks API for mutual exclusion (one backup process, not multiple concurrent backup processes).

At the start, it logs an attempt to acquire the lock (via `u.log.verb`) and proceeds to attempt. When lock acquired: if the time spent was more than 1s, it logs the fact of lock acquisition with the time elapsed (via `u.log.info`); then follows up with its regular functionality.

Lock mode: `exclusive`.

Pass the abort signal to the lock request. -->

---

<!-- The `watch` command gotta use the Web Locks API for mutual exclusion (one backup process, not multiple concurrent backup processes), and the `BroadcastChannel` API to notify about changes. All processes listening for changes do so on the broadcast channel, even within the same browser tab. -->

---

Share the `watch` logging between all tabs, but make it clear that only one backup was made, or that another tab made it.

---

<!-- Damage plot: add a series with total damage, hidden by default. -->

---

Prettify for launch:
- Some better way to tell visitors about the features, a visual presentation if possible.
- GitHub and Discord icons.
- More prominent title.
- Denser terminal output, less verbosity, consider smaller font.
- Try for fewer commands and shorter help.
- GitHub repo readme: better description, add screenshots.

---

<!-- Mission Control mine damage seems to be missing from damage charts. Copy that run and fix it. -->

---

<!-- The cost efficiency plots seem unnaturally similar to the damage plots. Gotta check. If not reproduced in local data, copy recent runs from Windows PC. -->

---

<!-- A command to decode an entire run as JSON:
- Usage: `decode <run_id>`.
- Mkdir `decoded_<run_id>`.
- For every progress file in `<run_id>`:
  - Read and decode if needed.
  - Write as `.json` (same base name) to `decoded_<run_id>`. -->

---

<!-- `ls`/`cmdLs`: show file count and progress file count / round count in dirs. -->

---

When defeated, we should backup the last round (which is "expired"). Currently we don't. And also, make sure we backup the last round on victory, when not using endless.

Upon inspection, it seems like after being defeated and clicking "back", the save file has `.RoundIndex === 0`, `.MarkAsExpired === false`, and no building data.

---

<!-- Add a command to decode and show the progress file itself. Could be a mode of `show`. -->

<!-- Add a command that decodes and shows _all_ files in the save dir. Could be a mode of `show`. Could pick that directory on demand without storing the handle. Maybe instead of picking the progress file, we pick the whole save dir. Maybe we pick the whole save dir, but also have an option to pick a specific progress file. The `init` command could have flags or subcommands. -->

<!-- (Added `show_saves`.) -->

The various FS-walking commands, such as `ls`, should let you choose between the save folder and the history dir. How?

---

Support multiple CLI commands in one line. We may consider shell-style `&&` and `&`, with corresponding behaviors.

---

<!-- The alias "latest" (should rename to "last") should work for both runs and rounds, in all commands. It should be viable to type `show last` or `show last/last` and have it work. -->

---

Add a command to list, get, and set all our settings in `sessionStorage` and `localStorage`.

---

Consider logging even less by default.

---

<!-- Prompt input: Ctrl+L or Cmd+K should clear. (Consistent with common precedent.) -->

---

<!-- When adding the user prompt to the log, it should briefly flash to indicate where to start reading. Other messages added to the log should not flash. -->

---

The `analyze` command (now `plot`) should support specifying multiple runs, run ranges, filters, or simply grabbing everything.

---

<!-- `datAddRound` should have either a smaller equivalent or a mode, where it only creates facts and doesn't bother with dimensions, for local analysis (since we just use facts now). -->

---

<!-- Add an FS function that takes an arbitrary path, walks all round files, and yields only _facts_, with the proper user, run, round ids embedded in them. This is done by: generalizing `datLoadRun`/`datLoadRound` to support an arbitrary path (via a higher-level function); then returning all facts from `DAT`. Ah, it seems like we don't need a generator function here, we just need a more general version of `datLoad*` that loads all rounds from any path including root. -->

---

When plotting over all cloud data, we should have an option to limit to only the latest game version, and an option to limit by date. It's useful to be able to prefer recent data over old data (outdata, if you will). When no other filter is provided, this should probably be the default. Limiting the data recency also prevents this from getting slower with time and data.

---

<!-- Drop command `test`, just use a query parameter. -->

---

More interactive logging, particularly for chains of operations. Examples:

* [x] `help` -> every command name is a clickable button.
* [x] Any command help -> every example is a clickable button.
* [x] Similar for other commands, wherever possible.
* [ ] `plot` -> help includes `plot ps` -> clickable -> list of run ids which are clickable and thus plottable (either local or remote, depending on `-s`).

---

<!-- When logging a user command to the terminal, it should be a reactive element tracking the command status. -->

---

<!-- The `userId` filter should support something like "me" or "current", similar to the magic "latest" for runs. -->

---

Top right: collapse text into icons: Steam (add TD link), Discord, Github.

---

Make plot titles human-readable.

---

<!-- Consolidate initialization and status (FS and auth). -->

---

<!-- Support special identifier `latest` in more commands. Add this to their help, as a button.
* [x] `show`
* [x] `decode`
* [x] `upload` -->

---

<!-- Make all "status" commands fully reactive: `status`, `ps`. Requires moving file handles to `FileConf` and making it observable. -->

---

<!-- Properly handle dirs with spaces in their names, by forbidding spaces. -->

---

<!-- Disable automatic Firestore indexing for round snapshots. -->

---

Keyboard hotkeys for activating visible clickables in the log. For example, holding Alt might enumerate them and show numbers; pressing a number activates the corresponding clickable.

---

Have something clickable somewhere which is always displayed which runs `help`, so you can never be without help. Maybe on the left side of the prompt. (Some kinda "home" or "help" emoji maybe.)

---

In `plot` help, unusable / useless parameters should be shown but disabled (greyed out). For example, when not logged in, current user filter; when cloud is unavailable, cloud-related stuff; when FS unavailable, local-only stuff.

---

<!-- When running `plot -c userId=current`, if not authed, try to auth. -->

(Printed an error with the `auth` command mentioned.)

---

<!-- In `plot` help, explain how to logical OR. -->

---

<!-- `plot` without args should print help. -->

---

<!-- In `plot`, filter by current user by default; `user=all` should be opt-in. When not authed, select one user (how?). -->

<!-- Same for runs: filter by latest run by default; providing any `run=` or `runId=` overrides that; special `run=all` suppresses the default without adding an actual filter. -->

---

<!-- In `plot`, maybe `-y` should be repeatable, as "or". Maybe it makes no sense. -->

---

<!-- In help for various commands, prioritize "append to prompt" buttons over "run cmd" buttons. -->

---

<!-- `plot`: use `-c` instead of `-s=cloud` for cloud data source. -->

---

Implement an easy rollback option.

---

<!-- Make a rundown of features, with screenshots. Use it for the readme and for announcements. -->

---

Make a YouTube video guide. Maybe get Claude Code to analyze the app and write a script for the video.

---

<!-- Since `ls` requires args now, update all cases of "tip: use `ls` to browse local runs" (or similar) to use `ls /`. -->

---

<!-- Some convenient way to report issues and suggest improvements. -->

---

<!-- When auto-uploading a new round created by `watch`, log the fact of upload. Currently the incremental upload is completely silent, which is inconsistent with `watch` logging. -->

---

<!-- Better instructions in `init`. By default, it should print help (with explanations and suggested file paths). Progress file and history dir should be flags. Use two `os.BtnCmd` to init them separately. -->

---

<!-- Command `upload` should use `handleAtPathMagic`. -->

---

Consider how to auto-update cloud-based plots.

---

<!-- `schema.mjs`:

Dispence with `statScope`. Requires a migration.

Include more fields into `facts`, retroactively. Requires a migration.

* `diff`
* `hero`
* `frontierLevel` -->

<!-- Include our own `tabularius_createdAt` into `roundSnaps`. Requires a migration, derive it from `updatedAt`. -->

<!-- Migration may consider changing `tabularius_derivedSchemaVersion` in rounds, and should set it in other collections. -->

---

<!-- When not authed, `watch` should not print auth warnings for `upload`. -->

---

When the very first round backup is made by `watch`, switch from default example plot to latest run plot.

---

<!-- Filtering by `buiType` and `buiTypeUpg`: user needs to know codes. Maybe add to `show`. Or, better idea: support the human-readable ones, remap them internally to codes. -->

---

`plot`: more presets.

TODO learn the lesson: we tried having defaults on various plot agg parameters, in the name of convenience and efficiency, and then we ended up with covariance between defaults and various options that disable various defaults, and the complexity blew up in our face. Not only was it hard to maintain across the codebase, since we have multiple querying implementations that had to support the defaults, but more importantly, it would be harder for the users to intuit how that stuff even works. Moral of the story: never use defaults, always use full presets; every feature is off by default, in every system, every time.

---

`plot`: filters should support `< <= >= >` for numeric ranges, such as `roundNum`, `runNum`, maybe `statValue`.

---

<!-- `plot`: log the execution time of `plotAgg`, or find if the time is already logged in Google Cloud logs. -->

---

<!-- `plotAgg`: if execution is slow or if function latency is always high, we might be able to reduce it by caching plot datas, storing them as documents in their own collection. We can generate a canonical key from the input parameters. When requesting data from a client, we build that key and `Promise.race` two things: querying for an existing plot data document, and calling `plotAgg`. In `plotAgg`, we also try to use an existing doc, falling back on aggregating and then storing the resulting data (asynchronously).

Measure first. Get the execution times. Try querying facts from the client and compare. -->

---

`plot`: support `latest` for rounds, like for runs.

---

`plot`: support bar charts to allow non-numeric X or Y.

* https://leeoniya.github.io/uPlot/demos/bars-grouped-stacked.html
* https://leeoniya.github.io/uPlot/demos/multi-bars.html

---

The command `show` needs to support cloud sources.

---

`plot`: provide more detailed help on possible values of various filters. Should be collapsed by default.
- [ ] `buiType`
- [ ] `buiTypeUpg`
- [ ] `entType`
- [ ] `chiType`
- [ ] `statType`
- [ ] `hero`

---

<!-- `plot`: forbid plotting building and child facts together. -->

---

`plot`: when plotting child facts, include their types into labels.

---

<!-- Replace Firestore with a DB actually suitable for aggregation and analytics. -->

Done.

---

An option to have plots side-by-side.

---

`plot`: when `run_id` or `round_id` is specified, disregard `user_id` instead of filtering by current user.

Note: we're migrating to a new system where `run_id` and `round_id` are ephemeral, and only exist in client data. The server might end up with special cases for them, decomposing them into composite keys. It needs to observe the same rule.

---

`index.html`: more metadata for previews and search indexing.

---

`plot`: truncate long series labels. Ideally, only the user id component is truncated with an ellipsis; other components of a label are kept.

---

`plot`: consider _not_ sorting labels on cursor hover / series selection.

---

`plot`: when rendering a plot, show additional metadata such as:
- Set of unique `user_id` in the facts.
- Set of unique `run_id` in the facts.
- Set of unique `round_id` in the facts.

---

Bundle and minify for production.

---

Change the color scheme (both light and dark) to what I use in ST.

---

Verify that the `BUI_COSTS` are accurate.

---

`plot.mjs`: more diverse distribution of `FG_COLORS`.

---

Goal: migrate from Firebase (Auth, Firestore, Cloud Functions) to our own Deno server with a local DuckDB, using a locally-mounted volume for persistence, deployed on `fly.io`.

* [x] Store uploaded rounds and derived facts.
  * [x] Rounds are stored as files, structured as: `<user_id>/<run_num>/<round_num>.json.gz`.
  * [x] Facts are stored in DuckDB.
    * [x] Schema definition.
    * [x] Endpoint that derives and stores.
  * [x] API endpoint for round upload.
    * [x] Validate round structure.
    * [x] Derive facts.
    * [x] Store round file.
    * [x] Store derived facts.
    * [x] Ensure either atomicity / transactionality of storing both, or the ability to recover data consistency if the app is shut down between the writes.
* [x] Endpoint for querying.
  * Maybe take a plot args string, combine parsing and validating into one.
* [x] `validPlotAggOpt`: keep `agg`, add `aggFun`.
* [x] Reorg JS files:
  * `shared`
  * `server`
  * `client`
* [x] Server: read / migrate from data dir on startup and schema change.
  * [x] No schema change: nothing to do.
  * [x] Schema missing or changed: drop DB and re-create from data dir.
  * [x] Make data dir path configurable.
  * [x] Make DB file path configurable.
  * [x] Verify behavior with persistent DB file path (in data dir).
* [x] API integration:
  * [x] Client calls the correct API URLs in development.
  * [x] Client calls the correct API URLs in production.
* [x] Authentication:
  * [x] Before committing to the strategy below, ask bots for review and suggestions.
  * [x] Probably something like asymmetric public/private key.
  * [x] The `auth` command requests a passphrase or password.
  * [x] When requesting:
    * [x] Change the prompt input to `type=password` and changes its visual appearance.
    * [x] Change the placeholder to something like: "type a passphrase or press Esc to cancel".
      * [x] Esc is a global-once event listener, dismissed either when invoked, or on prompt submit.
      * [x] Either way reverts the input to the normal state.
  * [x] On password / passphrase submit:
    * [x] Don't submit if empty.
    * [x] Don't submit if has leading / trailing space (print a message).
    * [x] Request confirmation once.
    * [x] Derive crypto seed.
    * [x] Generate private and public key.
    * [x] Store both.
  * [x] The private key is a byte sequence, derived deterministically from the passphrase via a cryptographically secure hashing algorithm (or hashing-like, there are variations).
  * [x] The public key is a reasonably short string, derived from the private key. It's the user id.
  * [x] When making requests that need authentication, send the public key and a signature as headers. The server verifies that they match.
  * ~~[x] Maybe the `auth` command has different "register" and "login" modes, where the "register" mode asks the server if the resulting user id already exists.~~
    * ~~[x] The server would have to store a list of known user ids. A JSON file with a list of strings would do. Alternatively, query `facts` in DB.~~
  * [x] Make new auth status reactive, like `AuthStatus` in `client/fb.mjs`. Create a similar reactive component. In `cmdStatus`, simply `new` that component; move the markup into it.
  * [x] In `cmdAuthHelp`, display auth status reactively via `AuthStatus`, similar to how it was in `client/fb.mjs`.
  * [x] In `PromptInput`, replace `.isPasswordMode` with `this.type === 'password'` to avoid redundancy.
  * [x] Merge `logout` into `auth`. Make `login` and `logout` two modes / subcommands of the `auth` command, similar to how it was in `client/fb.mjs`.
  * [x] The `auth` command should instruct the user to write down their passphrase/password, and to let the browser's password manager store it.
  * [x] Review and cleanup `auth.mjs` and `ui.mjs`.
  * [x] Update `task.md` to reflect the current task progress.
* [x] `auth`: when already authed, indicate that, and mention `auth logout`.
* [x] `auth`: forbid more than one space in a row.
* [x] Whenever we're authed and have the history dir inited, run `upload /`.
* [x] `cmdLs` needs to support browsing cloud runs.
  * [x] Backend API.
  * [x] Client uses new backend API.
* [x] Port other missing features from `fb.mjs`.
* [x] Before messing with downloaded round data, verify that decoding and encoding is still reversible in Deno, like in browsers. Also verify if we can just store gzip without base64, if that's reversible.
* [x] Count upgrade prices (hardcoded dict) into building sell prices.
  * [x] Define various upgrade prices in `game_const.mjs`.
  * [x] Use them to calculate and store modified `sell_price` in `schema.mjs`.
* [ ] Deployment. Once the Deno server and DB is done:
    * ~~[x] Try Oracle again.~~
    * [x] Redo `fly.io` from scratch.
  * [x] `html.mjs`:
    * [x] `if (import.meta.main) await makeHtml()`.
    * [x] In development, generates `index.html` on the fly.
    * [x] Un-hardcode `index.html`.
  * [x] `srv.mjs`:
    * [x] Serve from `$(TAR)`.
    * [x] Set caching headers in production.
  * [x] Bundle and minify for production.
    * [x] Make: `build: build_html build_script`.
    * [x] `build_html: $(DENO_RUN) server/html.mjs`.
    * [x] `build_script: esbuild <flags> client/main.mjs -o $(TAR)/main.mjs`.
      * [x] Use Deno-oriented `esbuild` plugin for URL imports.
    * [x] Server: in production mode, serve from `$(TAR)`, falling back on local files.
    * [x] `fly.toml`: run `make build` during build.
    * ~~[x] GH Pages: add a YAML workflow, reconfigure to serve from that folder.~~
  * [x] Give up on client build, revert those changes. Not worth it.
  * [x] Get `flyctl` so we don't have to bother with their GUI (and a bot can use it).
  * [x] Make sure our `fly.io` machine has DuckDB dylibs. Might have to write a dockerfile. (Handled by `@duckdb/node-api`.)
  * [x] Configure `fly.io` to run our Deno server as the entry point.
  * [x] Configure our Deno server to set file caching headers in production.
  * [x] We stick with GitHub Pages as the primary means of serving the app, making only the necessary requests to `fly.io`, to avoid keeping the machine alive.
  * [x] Make sure `fly.io` is configured to use exactly one machine with exactly one persistent volume.
  * [x] Deploy to `fly.io`.
  * [x] Migrate old data, by re-uploading from client code. Requires only client changes, no need to migrate data from Firebase.
    * [x] When checking files for upload, detect if the file is outdated, as in, it uses a Firebase user id instead of the new one. Should probably introduce something similar to schema versioning there as well.
      * [x] If so, re-upload with the new user id, and rewrite the user id inside the file with the new one.
      * Didn't bother to detect user id format; used versioning.
    * [x] Really petty: rewrite `tabularius_camelCase` fields in rounds into `tabularius_snake_case` (delete the old ones).
* [x] Drop Go code (probably `git rm`).
* [x] Drop all Firebase stuff from the repo.
* [x] For development purposes, make the live server a separate process; when restarting the server, signal to the client when to reload _after_ the server is running.
* [x] Rename the various encoding/decoding functions. Claude _really_ doesn't like the current naming.
* [x] Cleanup various redundant wrapper functions added by Claude.
* [x] Update all sample data to use new `tabularius_` fields.
* [x] Freeze all new dependencies.
  * [x] `tweetnacl`
  * [x] `npm:@duckdb/node-api`
  * [x] `npm:@duckdb/node-bindings`
  * [x] DuckDB itself, if needed. (Apparently the bindings library does that.)
* [x] Deploy.
* [x] Some easy way to view app logs on `fly.io`, preferably in realtime `tail -f` style.
* [x] Merge this into `todo.md`. Split the incomplete entries into their own.

---

Use a bot to update `docs/` due to above.

---

`plot`: truncate long series labels (user ids) for display purposes.

---

`watch`: not reliable enough, needs to retry local files harder.

---

<!-- In various Discord posts referencing our app, update the links, to use the newer plot parameters. -->

---

<!-- If calling API endpoints on `fly.io` involves preflight requests, configure a custom subdomain to avoid that.

https://fly.io/docs/networking/custom-domain/ -->

---

Change progress file handle to saves dir handle (`init -s`).

Still load the old progress file handle and use it and show in status, but call it "legacy mode" and recommend `init -s`.

`show` for `saves` requires `init -s` and doesn't need a picker every time.

`ls /` now lists contents of _both_ `saves` and `history`; those are special names which can be used as the first element of a path to list just that dir.

`ls -c /` now lists user dirs; `ls -c current` lists the current user's runs.

---

* [x] Prevent accidental merging of runs, when the same "user" uploads rounds from multiple machines, where run nums overlap.
  * [x] For each run: `run_id = user_id + run_num + run_ms` where `run_ms` is the timestamp of the first round in the run.
  * [x] `apiPlotAgg`: `qLatestRunId`: use `run_ms`.
  * [x] `srv.mjs`: on startup, migrate user run dirs:
    * [x] For each run dir: read first round file, get `.LastUpdated`, set `tabularius_run_ms`, update every other round in that dir, then rename dir, appending timestamp.
    * [x] Make it semi-lazy: for each user, check last run and round, and exit that user if they're compliant. Otherwise migrate from the first.
    * [x] Only needs to be done once. We'll simply disable it after the first deploy.
  * [x] `apiUploadRound`:
    * [x] Validate schema version match; on mismatch, suggest updating the client by reloading the page.
    * [x] Validate that `run_ms` is present and use it.
  * [x] `watch`:
    * [x] When creating new run dir, append `run_ms` to name.
  * [x] `main.mjs`: on startup, if FS inited, before running `watch`, run a function which migrates the existing run history dirs similar to the server-side migration.
    * [x] The process is lazy: it starts by checking the _last_ run dir, and the _last_ round file. If both are compliant with new schema, then exit. If not, migrate from the _first_ run dir and round file.
    * [x] The browser FS API doesn't seem to provide a way to rename a dir. We might have to recursively copy into a new dir, then remove the old dir.
      * Use `try/finally` to delete incomplete new dir if there's a failure in the middle.
  * [x] `schema.mjs`: increment data schema version, causing server-side DB rebuild.

---

Various `plot` enhancements.

* [ ] When waiting for plot agg data (either cloud or local), indicate that in the media.
  * The sample plot placeholder has a method to increment or decrement the count of pending plots; when count > 0, it says "plot loading" or something like that. `cmdPlot` uses `try/finally` to modify the count.
* [x] `plot_link` generates a link.
  * [x] By default, orders multiple plots, with various presets, for the same filter, which is the current user's latest cloud run (but with fixed `run_num` or `run_id`).
  * ~~[ ] Takes arbitrary plot options as overrides.~~
  * ~~[ ] An override on `user_id` cancels the default `user_id=current`.~~
  * ~~[ ] An override on `run_id` or `run_num` cancels the default `run_id=latest`.~~
  * [x] Copy link to clipboard.
  * [x] Print to log, something like: `plot URL <url> copied to clipboard` where the link is clickable (tarblan) with an indicator that it's external.
* [ ] Cloud-based plots should have a shareable link somewhere.
* [ ] `watch`:
  * [ ] Print run plot link when run ends.
    * [ ] Detection 1: when new run begins.
    * [ ] Detection 2: when run reaches last wave for that difficulty.
    * [ ] Avoid duplication.
* [ ] `plot`:
  * [ ] Show various info about the found data (only when data is found):
    * Which `user_id`, `run_id`, `run_num` were found. Maybe more.
    * [ ] Print in terminal.
    * [ ] Maybe show in plot (under, or in title).
    * [ ] Consider making this optional (a toggle).
    * [ ] Server: support in `apiPlotAgg`. Make it optional.
    * [ ] Client: support in various places where we build and query `dat`.
* [ ] `main.mjs`: be less insistent on printing help at the start, to avoid crowding the terminal when a plot is fetched on startup.

---

Cost calculation: add currency conversion rates. 1 Recon = 2 Supply. 1 Tech = ??? Supply.

---

Consider supporting `-h` and `--help` flags in all commands. Some users may be likely to try those.

---

Find out where the game stores its "foes in current run" information.

---

Client: bundle for production.

Bundling is a pain, but it avoids another pain: our modules other than `client/main.mjs` tend to be cached by browsers, which often causes them to be not properly updated on deployments.

Alternatively, get around that with `sw.mjs`.

---

`make`: replace useless `deno lint` (fails to detect missing variable definitions) with `eslint`.

---