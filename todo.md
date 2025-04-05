## Setup

<!-- (Done) Serve with GitHub Pages. If build/deploy is necessary, use GitHub Actions. -->

Firebase: maybe DB-side aggregations for clients, for analytics.

Snapshots include user ID, from Firebase authentication.

Snapshots include run ID (auto-generate it). Also consider a local run index, for easier ordering, and a run timestamp, which equals to the timestamp of the first round.

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

<!-- Add `log.verb` and a UI toggle for verbose logging. -->

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

<!-- In the log, timestamps waste too much space. Convert them to single-character indicators, with timestamp tooltips on hover. -->

<!-- Or: each log entry has a prefix, like `[watch]` or `>`, and the prefix is hoverable, showing a timestamp. -->

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

Log width: store in both `sessionStorage` and `localStorage`, like `LOG_VERBOSE`.

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

Unfuck the bot's code style.

---

<!-- Limit length of command history. -->

---

<!-- `help <cmd>` should show help for specific command. But only if we can be bothered to define detailed help for each command. May eventually. -->

---

<!-- Export our modules into global scope, under a single namespace (`tabularius`). -->

---

<!-- When printing a command's output synchronously, skip the log timestamp. -->

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

`runCmd` currently adds a history entry even when invoked programmatically. Gotcha? Useful? Unsure.

---

<!-- Less vertical spacing in `u.log`. -->

---

Consistently prefix command logging with current command name. Find places in the code where we currently don't, and fix. Note that the last returned string, or the last error thrown, is auto-prefixed by `runCmd`. Consider consolidating.

---

When round index is increased in `handleBackupScenario`, when we log "Created backup for new round", the next and prev rounds are logged the same. Expected behavior: correctly log the prev round. Avoid doing math.

---

<!-- Initial log width should be 2/3rd of the screen. -->

---

<!-- Since we store `.gd` data, backed up files should use the extension `.gd`. -->

---

An option to backup all save files, not just the progress file.

---

An option to view the decoded contents of a `.gd` file.

An option to copy the decoded contents to the clipboard.

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

---

<!-- Display app version in UI, for easier error reporting/debugging. -->

Added (hardcoded), TODO auto-increment.

---

Charts.

Considered many bot suggestions, tried d3, `@observablehq/plot` (which is d3-based), `uplot`. Settled on `uplot`: _much_ smaller, way fewer files, advertizes better performance.

TODO:
- Finish styling.
- Add `analyze` command.
  - Implement reading run data.
  - Settle on one schema already.
- Integrate with media panel.

---

Polyfill for customized built-in elements: https://github.com/ungap/custom-elements.

---

When the File System API is not available, give the users a descriptive error.

---

<!-- `Plotter` should use `ResizeObserver` on its parent, instead of a `resize` event listener. -->

---

After we settle down with our usage of `uplot`, it might be pertinent to comment in various issues related to dark mode, and provide code samples of how we support dark/light modes, with dynamic detection and switching:

https://github.com/leeoniya/uPlot/issues?q=dark%20

---

Plot/analyze: totals; should be shown on labels instead of `--` placeholders when nothing is hovered.

---

Plot: order series by total value. When hovering an X point, reorder the legend labels by the value in that current X.

---

Plot: totals should be calculated only for the currently _visible_ ranges in the chart, when zoomed in.

---

Plot auto-updating. First from local data, then from Firebase. Demos:

https://leeoniya.github.io/uPlot/demos/stream-data.html
https://leeoniya.github.io/uPlot/demos/pixel-align.html
https://leeoniya.github.io/uPlot/demos/sine-stream.html

The file watcher needs to send new data to the plot.

---

Plot: button to toggle all series.

---

Plot: when the cursor is near many near-overlapping data points (within a certain proximity threshold), we should group them up, and include all in a tooltip.

---

Plot: compact the numbers by using `k`/`m` suffixes, like in the game proper. (Do that on the labels _and_ in the tooltip.)

---

Media: always show processes under custom media, such as plots.

---

Plot: when grouping multiple sources, such as buildings or weapons, into one series, indicate the count of grouped entries in the label. Might be WONTFIX because the count _changes_ between rounds.

---

Plot: when analyzing building damage, exclude series where every value is zero or missing.

---

Plot: consider if even in damage per round charts, it's not useful to have a chart where values just go up as the rounds progress. Perhaps we should normalize the values per round in such a way that comparisons between rounds are meaningful.

---

<!-- Consistently prefer lowercase msgs in log, errors, etc. -->

---

Option to analyze latest run without having to type its ID.

---

Ship with mock data and render a chart right away, for demonstration.

---

Media pane: support adding any number of custom contents, which can be closed separately. Maybe vertically as blocks with close buttons, maybe as tabs. If using tabs, the tab headers should be grid-like, reflowing (maybe `position: float`).

---

Building damages need to use `.ChildLiveStats` to include troop damage, similar to what the game UI does.

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

Consider supporting non-string run and round indexes. For example, run `000000` should be considered same as `0` locally.

Consider supporting relative run and round indexes. For example, a user's first run fetched from cloud storage should be indexed as `0`, and so on.

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

A command for viewing stats super zoomed-in, for a particular round > building > child / weapon.

A media UI for showing building, child, weapon stats in a nice format. Flattening the data and printing JSON is an okay start, but we can do better.

---

A media UI for showing a breakdown of the latest round and the run so far. (The stat screen that the players constantly ask for.)

---

<!-- Identify empty rounds with no run. Do not backup. -->

---

The `show` command should print the object to the browser console, so the user can browse it. Instruct the user about the console.

---

In the terminal, differentiate user inputs from other log entries. Maybe by their prefix.

---

Live updates of a given analysis. Maybe an analysis sticks around and is stateful. There may be multiple live at once. As long as the procs are running, they may receive updates. Alternatively, instead of running procs, they may simply be found in `MEDIA`. The latter probably makes more sense in JS technical terms, but treating them as procs and tying the lifetime of their medias to the lifetimes of the processes makes management simpler. And we can reuse the proc UI for the media management.

Update: tying media elements to procs makes no sense in the DOM API. Just give them their own "close" buttons.

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

Damage plot: add a series with total damage, hidden by default.

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