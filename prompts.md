<!--

This file is a log of various prompts passed to LLMs such as Claude Code.
The log is not comprehensive; many executed prompts are missing from it.

-->

------

<!-- In `main.mjs`, we want the following features.

Load a Firebase config from `js/firebase.json`.

Import Firebase libraries, by using native JS imports, from `https://www.gstatic.com/firebasejs`. We want libraries for Firebase Authentication and Firestore.

Add buttons for:

* Firebase: login: anonymous.
* Firebase: login: Google.
* Firebase: logout. -->

------

<!-- We're developing a SPA. We want to render our UI by directly manipulating DOM elements. We want shortcuts for creating and updating them. We want to write markup as nested function calls, without any external templates, without any string templating, and without JSX. Our app is stateful and dynamic, UI will frequently update. We want a convenient way to maintain state and redraw any given UI component in response to changes. However, we do not want any VDOM; we want to operate on DOM elements directly. We're willing to consider external libraries, but they must be small, with a simple API. Suggest the possible approaches and tools. -->

------

Our browser app is going to operate on files in the local filesystem. We want persistent access to specific files and directories, which, once granted, we retain. Thus, it appears we will use the File System API.

In `main.mjs`, we will show instructions and buttons for granting FS access for two locations:

* Location: run progress file. Typical location: `C:\Users\<user>\AppData\LocalLow\Parallel-45\tower-dominion\SaveFiles\Progress.gd`.
* Location: output directory for backups / run history. Suggested location: `C:\Users\<user>\Documents\tower-dominion`.

The instructions explain (very briefly) what these locations are for, the suggest paths, and have a button to prompt for access.

Once access is granted, we will look at the existing files, and list them in the UI.

------

We want persistent FS access. After obtaining handles, we need to store them between sessions.

------

After gaining access to both handles (progress file and history dir) and storing them in IndexedDB, and after reloading the app, only the progress file is available. Both handles do exist in the DB. In `verifyPermission`, for the progress file, `handle.queryPermission` returns `"granted"`. But for the history dir, it returns `"prompt"`, and calling `handle.requestPermission` produces the following error:

```
Error verifying permission: SecurityError: Failed to execute 'requestPermission' on 'FileSystemHandle': User activation is required to request permissions.
```

------

The file `fs.mjs` has a lot of repeating code, particularly in the functions that operate on file handles for progress file and history dir. Deduplicate.

------

Make the following changes to the code in `./js/`:

All logging must be done via the element `log` in `util.mjs`. Errors must be logged with `log.err`; other messages with `log.inf`.

`log` must be displayed in the UI, taking up the right side of the screen. Messages are arranged vertically.

Messages are ordered new-to-old. New messages are prepended. Max message count is 1024; when reaching the limit, we remove older messages, and increment a counter of removed messages, displaying that count under the oldest message.

------

Make it possible to drag an edge of the log element, making it wider or narrower. When dragging stops, store last width into session storage. On initial render, use the last stored value if available.

------

In `log`, make max width 90%.

------

In `log`, deduplicate the id of the resize indicator.

------

Deduplicate mouse and touch related code.

------

Dedup `onMouseDown` and `onTouchStart`.

------

In `log`, deduplicate the id of the resize indicator.

------

In `log`, when creating new elements, use the function `E` instead of `document.createElement`. See `./js/main.mjs` for examples.

------

In `log`, instead of storing the property `this.width`, always get the current width from the DOM.

------

In `log`, instead of storing messages in an array, treat the `messagesContainer` as the only source of truth where messages are stored. Use its `.childElementCount`. Instead of calling `this.render()`, move the initial rendering to `.connectedCallback`. It must be performed only once.

------

Avoid having to modify any other elements (such as `main-content`) when changing the width of `log`.

------

In `log`, create elements with `E` instead of lower-level DOM APIs.

------

In `./js/util.mjs`, in `log`, use the native drag-related features of the DOM API, instead of mouse and touch events.

------

Make the following changes to `./js/util.mjs` → `log`.

We want the element to be resizable by dragging its left edge. That's already implemented. But, instead of using mouse and touch events, we want to use the drag features of the DOM API (attribute `draggable` and associated events). Make the resulting resize-related code as concise and simple as possible.

------

We're making a web UI. One element fills the right side, and is resizable by dragging the left edge. We want to implement dragging by using the native `draggable` attribute, but it causes the edge to be draggable in all directions. How to restrict it to only horizontal drag?

------

In `twind`, we would prefer to keep the original class names instead of obfuscating them.

------

<!-- In our Tailwind styles (via Twind), in the names of classes such as `p-4`, we would prefer if numbers always corresponded to `rem`, not to pixels, and not to some abstract units. Is that possible? -->

(Give up. Default scaling is 1 unit = `0.25rem`, which is fine.)

------

We're writing a web app. The `body` has two children, which must be columns, one left, one right. One of the columns is resizable, by dragging an edge. Our JS calculates the new width percentage and is able to update any style property of the element. We want to ensure that the visual width of the resized column reliably matches the percentage we calculate. We do not want to modify any properties of any elements other than the resized one. Suggest how to style the three elements. Prefer minimalistic solutions. Avoid modifying any element's `position`. Prioritize reliability.

---

In the suggested solution, the resizable element's `flex` property causes it to expand the parent's width, exceeding viewport width and causing horizontal scrolling. Prefer solutions where the resizable element respects its parent's width, while still taking priority over the other element.

---

Also consider how to prevent the resizable from increasing the parent's width when it's resized to such a narrow width, that its own content (text, etc.) tries to increase the width.

------

<!-- Unfuck the log resizing. Example: grab handle, move, wrong percentage is calculated. Might need to use the DOM values as the basis after all. -->

(Done.)

------

Update `./js/main.mjs` and `./js/fb.mjs` to prefer flex gap over `space-*`. Prefer 1rem as the unit of spacing.

------

In `main.mjs`, when we have access to the progress file, we periodically (each 10s) check the file's timestamp, and log it.

Notes:

* Interval is started via `u.interval`, and stopped via the returned function.
* When the file is not available, the interval must be stopped.
* When the file is available, the interval must be started.
* When, while checking the file, the file is missing, we log that, but don't stop the interval.
* When, while checking the file, we don't have permissions, we log the error, store the permission error in the UI state, and stop the interval.

------

In `./js/fs.mjs`, add styling to `BtnRequestPermission`.

------

In `./js/main.mjs`, add `[disabled]` styling to the buttons for picking a file or directory.

------

In `./js/main.mjs`, in `RunProgressFile` and `RunHistoryDir`, use `task.wip` to disable buttons while tasks are running, and use `info.action` to display the action currently performed by a task.

------

Unfuck date formatting.

------

## Terminal

<!-- (This wasn't sent to a bot. See a simpler msg below.) -->

SUDDEN PIVOT. We're doing a terminal emulator.

Option 1. Multiple terminal tabs with their own logs.
Option 2. One shared log, and a list of currently running commands you can stop.

Use the current log which displays arbitrary msgs, with errors in the red.

Concept: media: a command can display arbitrary media, taking over part of the right side of the screen, like in various LLM chat apps.
* We should have a place in the code for commands to hook in, to display media. A simple semi-placeholder implementation would be nice.

User guidance:
* Placeholder in the prompt. Can be dynamic, recommending the next relevant command.
* List of commands you can click.
* One floater above the prompt recommending the next essential command:
  * Pick progress file.
    * Or fix permissions.
  * Pick history dir.
    * Or fix permissions.
  * Analyze latest run.
  * And so on.
* Clicking the floater pastes and executes the command.

In the list of running commands, finished commands disappear immediately unless the list is hovered. When it's hovered, finished commands gray out, and only disappear on unhover. This is done to prevent accidentally killing the wrong command.

Command history, stored in `localStorage` or `IndexedDB`.

Prompt placeholder could be `type "?" or "help" for help`. It could also be the next recommended command.

Each entry in the log should bear the name of the command responsible for it (if possible). The name should appear in brackets between the time and the message.
* Command names could be assigned to functions: `someFunc.name = someString`.

Some commands may be singletons: you can only launch one instance of that command. Attempting to launch another produces an error message.

<!-- The core of each command is an async function. When launching a command, we wrap it in `./js/util.mjs`/`LogTask` to track its lifetime. -->

For every command: show the current action it's taking.

------

Consider the instructions in `claude.md`. Consider existing UI code in various `./js` files. Update `./js/main.mjs` (and any other files as needed) to render the layout we need for our app, with mock-up examples.

------

Currently, the log has a resize handle on the left. This is an artifact of an older UI. Change it to the right, between the log and the media panel. Update the position of the handle, any relevant styles, and the calculations of pointer coordinates on pointermove.

------

Make the following changes to `./js/util.mjs`>`log`. Instead of prepending messages, append them. When messages exceed the maximum limit and we trim them, we should remove them from the start, not from the end. The notice about N older messages removed should appear above the other messages, not below.

------

Make the following changes to `./js/util.mjs`>`log`. In messages, try to display/preserve whitespace as-is. For example, newlines should be displayed as newlines, spacing should be preserved, etc. Long text should wrap. We prefer breaks between words, but when a word is longer than an entire line, it should break too.

------

In `main.mjs`, `commandHistory` should be from older to newer. Push instead of unshifting. Reverse the order of iteration when browsing the history.

------

In `main.mjs`, when the next received command is identical to the latest in history, avoid pushing it into history.

------

In log, each message currently has a linebreak between time and content. This was added by a recent change. Eliminate that linebreak.

------

In `main.mjs`, split `processCommand` by moving each command to its own function. Every function that implements a command should be named like this: `cmdHelp`, `cmdPs`, and so on.

------

In `main.mjs`, create a data structure to hold the list of known commands with their names and functions to invoke. Use it in both `cmdHelp` and `processCommand`, instead of hardcoding commands in both.

------

Convert `COMMANDS` to an array, to ensure consistent iteration order.

------

Convert `COMMANDS` to an instance of `Map`, to ensure both consistent iteration order (JS maps are ordered), and easy and efficient lookup.

------

Pressing the button `/` should focus the prompt textarea. The placeholder in the prompt should mention this fact.

------

In the keydown listener for `/`, change how we detect if we're in an input field, like this: `!!a.findAncestor(eve.target, isInputField)`. Define the function `isInputField` separately. It takes one argument, an element, and returns `true` if the element is an input-like.

------

In the prompt textarea, use `onfocus` and `onblur` to update the placeholder. When the textarea is unfocused, the placeholder mentions pressing `/` to focus. When focused, it does not.

------

In the prompt textarea's placeholder, mention `help`.

------

The prompt textarea, when focused, should have a nice outline or border to indicate the focus.

------

In `./js/main.mjs`, in `CommandPrompt`, the nesting is far too deep. Move callbacks to the root level (below the function), then break them down into smaller ones.

------

In `./js/main.mjs`, review `PromptInput..historyPrev` and `PromptInput..historyNext`, and implement them.

------

`claude.md`:

Use `./doc/principles.md` for core principles and guidelines. It's very important to follow them!

Use `./doc/patterns.md` for specific coding patterns.

Use `./doc/app.md` for app overview and architecture.

Then:

`claude.md` has been updated with new guidelines. Review code in `./js/`. Think about how it could be aligned with our core principles and guidelines, and ensure it does.

------

Refactor `./js/main.mjs`>`ProcessList`, which is currently unused, to actually show a list of currently running processes, and actually use this function.

Allocation:
- Convert to a static singleton, similar to other element singletons in the file.

Appearance:
- Vertical ordering.
- Most minimal styling possible.

Placement:
- Bottom of default media panel children.

------

Add the command `init` (`cmdInit`) whose intent is to initialize the features of our app which require user actions. It goes through steps. Each feature is idempotent: if it's already properly initialized, we skip that step.

Mock-out two steps, with empty functions. There may be more in the future; make the code easily extensible.

Add the command `status` (`cmdStatus`) which displays the current status of the features supported by `init`, and also a list of active processes. (Extract the latter from `cmdPs` as a small shared function.)

------

In `cmdInit`, move steps to root scope and dedup with `FEATURES`.

------

<!-- Access to files: both progress file and history dir involve using the browser File System API. Our FS-related code will be in `./js/fs.mjs`. Build the code from small bricks, do not duplicate similar code. -->

------

In `./js/fs.mjs`, implement `statusProgressFile` and `statusHistoryDir`.

------

In `./js/fs.mjs`, we initialize file handles for progress file and history dir. Currently this is done only when the user inputs the `init` command, because browsers allow us to use `.requestPermission` only on user actions (such as submitting a prompt in an input). We want to load the handles from IndexedDB, and check permissions, on app initialization. When permissions are not granted, we should notify the user, telling them to use `init`.

------

Deduplicate with existing code as much as possible.

------

In `./js/fs.mjs`, we're going to watch the progress file for changes, and make backups into the history directory.

When both handles are available (for ANY reason; check existing places where we update handles), we're going to idempotently start the new command `watch` (defined below) via `os.runCommand`. If already running, we don't start it.

The `watch` command:
- Runs in a loop.
- Every 10 seconds, checks the progress file (first check is not delayed).
  - Before accessing the file, query permission.
  - If permission is not granted, throw an error telling the user to run "init" to grant permission. Don't worry about logging: command errors are automatically logged.
- If file is present:
  - Check its timestamp. If the timestamp is unchanged from the previous iteration, skip this iteration (sleep again).
  - Read the content.
  - Decode as base64, then un-gzip, then decode as JSON (the file content was created by encoding data as JSON, then gzipping, then encoding as base64).
    - If any decoding step fails, assume the file may be partially written, and reduce the next sleep interval to 1 second.
    - If decoding fails 3 times in a row, throw a descriptive error. This stops the command.
  - After successful decoding, access the field `.RoundIndex` in the resulting data and log it.

Add the `watch` command to `os.COMMANDS`.

Define small functions (and constants if needed) instead of hardcoding everything inline.

Avoid nested conditionals. Prefer early returns.

Be very terse.

------

In `./js/main.mjs`, add a command `deinit` (following after `init`), which:
- Stops all running processes.
- Calls new functions from `./js/fs.mjs`:
  - `deinitProgressFile`: delete handle from DB and forget it
  - `deinitHistoryDir`: delete handle from DB and forget it

------

In `./js/fs.mjs`, change how we make backups.

Goals:
- One backup per round per run.
- No redundant backups.
- In the history dir: one sub-dir per run. Place all backups for that run there (1 per round).
- Run ids: auto-generated via `util.mjs`>`rid`.
- Backup file name = round index + `.json`.

Details:
- When the watch command starts:
  - Check permissions for history dir and crash (by throwing) if not granted.
    - Dedup with existing code as much as possible.
  - Inspect history dir.
  - Get names of sub-dirs.
  - Sort names alphabetically (default JS sorting).
  - Get last one via `a.last`.
  - If not exists: return from this sub-procedure.
  - Store its name to a variable. This is the latest run id.
  - Inspect its files.
  - Get file names.
  - Sort alphabetically (default JS sorting).
  - Get last one via `a.last`.
  - Get base name without extension via `mitranim/js/path.mjs`>`posix.name(name)`.
  - Parse via `a.intOpt`, store to a variable.
  - Now we have the latest round index (or nil).
  - Inspect file timestamp, store to variable.
  - Parse file as JSON, get `?.RoundIndex`, store to variable.
  - No error handling here. Crashing is fine. Error will be auto-logged.
- When checking source file:
  - Type-check, must be a number (`a.reqFin(file.lastModified)`).
  - Compare with prev timestamp.
  - If prev timestamp >= next timestamp, then skip this iteration.
  - Update prev timestamp to next.
  - Compare round index. Both prev and next round indexes are either finite numbers (`a.onlyFin`) or nil (`a.onlyFin` returns nil for non-finite-numbers). This means 4 possible states: nil+nil, nil+num, num+nil, num+num.
    - If next is nil: skip this iteration.
    - If prev = next: overwrite prev with next.
    - If prev < next: backup to a new file in the target directory for that run. Round index is file name. Pad the file name by zeroes up to length 4 to ensure predictable sorting.
    - If prev > next:
      - New run detected.
      - Generate new run id (`rid` function).
      - Create new run dir.
      - Write next backup to new run dir (name according to round index).
    - Otherwise: throw an internal error / unreachable / programmer error.

Define small reusable utility functions (and constants) instead of hardcoding inline.

Be terse.

Consider the project's goals. Don't hesitate to offer suggestions for improvement!

------

Consider if the new code is lacking signal handling (cancelation support).

------

For each run directory, we want: name = id. No prefix.

------

When we have permissions for the output directory (history dir) but it's then deleted by the user, can we re-create it?

------

Dedup the new code as much as possible. Look for duplicates. Look harder. Dedup harder.

------

`ensureHistoryDirExists` doesn't do anything useful. We want less code above all. Drop code that does nothing.

------

In `./js/fs.mjs`, make the following changes to file decoding:
- We have multiple valid ways of decoding (currently 2).
- Way 0: try JSON decoding. Tried only if the file content (trimmed) begins with `{` or `[`.
- Way 1: current decoding (base64 then gzip).

------

Make improvements in `./js/fs.mjs`:
- `cmdWatch`: we think it's too large. Split into smaller functions, passing only what they need.
- `createBackup` currently doesn't have access to some variables (due to refactoring). We want to fix that.
- `createBackup`: we think it's too large. Split into smaller functions, passing only what they need.
- Look for other huge functions. We think around 30 lines is the limit. Split into smaller functions, passing only what they need.
- When splitting functions, prioritize:
  - Not needing to pass mutable state.
  - Not needing multiple return values.
  - No return values, or a single return value, is preferred.

------

Review `./js/fs.mjs`. Look for duplicated code, repeating patterns. Deduplicate.

------

Move the checks from `maybeStartWatch` into `cmdWatch` and drop `maybeStartWatch`.

------

We've changed our mind. Revert the last change. Instead, `cmdWatch` should quit early if another watch proc is running (move just that one check from `maybeStartWatch` to it).

------

We seem to combine `u.reqSig` with `u.race` a lot. Replace `u.race` with a specialized function that embeds `u.reqSig`. Propose multiple short names for it, and pick the best one. Drop `u.reqSig` checks from functions that use `u.race`.

------

`./js/fs.mjs`: `cmdWatch`: when the round index is increased (for example, from 25 to 26), we expect a new backup, but currently nothing happens. Consider why and fix.

------

Read the instruction files. Consider `app.md`>`Backups`. Currently when a round increase is detected, a backup is not created. Consider possible causes and fixes.

------

The source file exists, the output directory is empty, permissions are granted, the watch command detects increases in the round index, and backups are still not created.

------

On round increase, a backup does get successfully created for that run. However, on round decrease, the system reports "Processed file but no backup created (no changes detected)", which is incorrect. The intended behavior is that on round decrease, if the new round is non-nil, we should switch to a new run.

------

Consider if the code is too verbose. Look for duplications. Look for redundancies. Look for code that simply does nothing useful.

------
