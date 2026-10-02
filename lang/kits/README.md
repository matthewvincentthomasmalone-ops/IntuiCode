# Kit packs

Each file here adds questions, kits and components to the project builder's library, in the same plain-text
format as `lang/builder.js` (described at the top of that file):

```js
(window.IntuiKitPacks = window.IntuiKitPacks || []).push(
`kit: …`,
`component: …`,
);
```

Add a new file as a `<script>` in `index.html`, before `lang/builder.js` (the tests find every file here on
their own).

## ‹Blanks› in hallway steps

A hallway step leaves the key parts for the learner to write. Each part is a ‹blank› in its sentences, and
the step says what goes there with one `blank:` line per ‹blank›, among its head lines (before `== …`):

```
blank: ‹ticks to wait before the next step› | a calculation | Start from 1 tick and add a share of `MARCH_EVERY`: all of it when every invader is left, none when they're all gone. `length of invaders` is how many are left; `INVADER_ROWS * INVADER_COLUMNS` is how many there were. Use `//` to keep it a whole number. | 1 + MARCH_EVERY * length of invaders // (INVADER_ROWS * INVADER_COLUMNS)
```

`‹label› | kind | how to work it out | an answer that works`. When the cursor is on the ‹blank›, the help
under the windows shows all of it, with the answer hidden behind **Show an example** so the learner can try
first. The tests fill every ‹blank› with its answer and check the project builds and works.

- **The ‹label›** says *what* goes there, in a few words: ‹ticks to wait before the next step›,
  ‹the shot is above the top›, ‹how far it falls each frame›. Never the answer, never code, no
  "description: answer", no "…". About 45 characters at most. It's what the learner sees in the sentence.
- **The kind** is one of: `a number` · `a calculation` · `a test (true or false)` · `text in quotes` ·
  `a name` · `a list` · `a colour` · `a CSS value` · `a line of code`.
- **How to work it out**: one to three plain sentences. Which values to use (names in backticks: `` `speed` ``)
  and how they combine, or what the numbers mean, without writing the whole answer out. Not patronising: no
  "simply", "just", "easy", no exclamation marks. (The packs are JavaScript template literals, so a backtick
  is written `` \` `` there, and `${` never appears.)
- **An answer that works**, exactly as the learner would type it in place of the ‹label›, marks and all.
  It's checked by the tests, so it has to be right.
- Every ‹blank› has a `blank:` line, and every `blank:` line is about a ‹blank› in the step's sentences.
