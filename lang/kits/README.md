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
their own). Answers for the ‹blanks› of its hallway steps, used by the tests, go in
`tests/kit-answers/<pack>.json` as `{ "‹the blank›": "an answer" }`.
