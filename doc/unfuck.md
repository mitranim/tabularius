A lot of LLM-written code has a lot of potential for improvement. This file contains various notes for what typically needs changing.

---

CSS: bots spam margins. Drop that. Regex: `\bm\w?-\d+`. We prefer flex gaps.

---

Bots spam bold fonts all over the place. Search for `font-bold` and drop.

---

<!-- Bots spam CSS classes `overflow-auto`, `overflow-x-auto`, `overflow-y-auto`, which are default behaviors anyway. Drop that. -->

Seems that, when using Tailwind, explicit overflow styles are often needed.

---

Bots micromanage font sizes, despite explicit guidelines to not touch. Search via regex `\btext-\w{2}\b` and drop.

---

Bots micromanage element padding and margins in various directions, non-uniformly, despite explicit instructions to use uniform padding and avoid margins. And sometimes they're right about padding (X vs Y in particular), so be careful about this. Regexes:

`\bp\w-\d+\b`
`\bm\w?-\d+\b`

---
