// The pairs of rules that read the same sentence today, and why the first (the one that wins) is right. Each is
// "winner ⟂ other", or "* ⟂ other" for every rule that wins over that one. tests/collisions.test.mjs fails on a
// pair not listed here (look at it: if the winner is wrong, the rules clash), and on one listed that no longer
// happens (take it out). Checked on 2026-11-17: none clash; every pair is a narrower wording tried first.

export const KNOWN_PYTHON = {
  // "when …" starts an if too ("when n is 0" is if n == 0): these are "when"s of their own, tried first
  '* ⟂ if x': 'a sentence of its own that starts with "when" or "if" (a route, "when a new … is made", "if it fails", "if nothing failed", "if this file is run directly"), tried before the plain if',
  // a narrower wording of the same thing, or a more particular thing said with the same words
  '* ⟂ run the tool x with y and store it in z': 'a sentence of its own that starts like "run x" or "use x" ("use the math module", "use the shared count", "do nothing", "run the SQL …"), tried before running a tool',
  '* ⟂ add x to the end of y': '"add each item of …", "add … to the set …" and a window part ("add a tk.Button …") are additions of their own, tried before adding to a list',
  'take the last item out of x ⟂ take x out of y': 'the last item, said as such, before taking a value out',
  'take item x out of y ⟂ take x out of y': 'an item by its place, before taking a value out',
  'sort x by y backwards ⟂ sort x backwards': 'sorting by something, before sorting as it is',
  'define a class x based on y ⟂ define async called x using y': 'a class, before a tool called "class …"',
  'make a new x with y and store it in z ⟂ make a new x with y': 'the same, with where to keep it, tried first',
  'show nothing ⟂ show x on the same line': '"show a blank line" is a blank line, not the value "a blank line"',
  'write x into y ⟂ show x on the same line': 'writing into a file, before "write" as a word for show',
  'save x as JSON in y with z ⟂ remember x as y': 'saving as JSON in a file, before keeping a value under a name',
  'ask for a whole number x and store it in y as a whole number ⟂ ask x': 'asking and keeping the answer, before asking alone',
  'wait for x y ⟂ wait for x seconds': 'a wait in any unit ("3 seconds", "2 minutes"), before the one in seconds alone',
};

export const KNOWN_JS = {
  // the last resort: it only says why a name can't be one ("set number of lives to 3"), so every "set" matches it
  "* ⟂ set … to … (a name that can't be one)": 'the last resort, tried after every other "set …" and "constant …": it only explains why words can\'t be a name',
  // a narrower wording of the same thing, tried first
  '* ⟂ set … of … to …': 'a part of an element said by its own words (the text, the groups, the HTML), before a value\'s part',
  'constant … is a tool ⟂ constant … is …': 'a tool kept under a name, before a value',
  'if it fails ⟂ if …': '"if it fails" catches an error, before the plain if',
  'show a message … ⟂ show …': 'a message box, before showing in the console',
  'clear the drawing area … ⟂ clear …': 'clearing a drawing area, before emptying a list',
  'when the key … is pressed ⟂ when … is clicked': 'a key, before an element\'s event',
  'when a key is pressed ⟂ when … is clicked': 'any key, before an element\'s event',
  'when the screen is tapped ⟂ when … is tapped': 'the whole screen, before an element',
};

/* Each pair found that no entry above names, and each entry that names no pair found. */
export function unexplained(found, known) {
  const names = (k) => (k.startsWith('* ⟂ ') ? (p) => p.endsWith(k.slice(1)) : (p) => p === k);
  const keys = Object.keys(known);
  return {
    newPairs: [...found.keys()].filter(p => !keys.some(k => names(k)(p))),
    stale: keys.filter(k => ![...found.keys()].some(p => names(k)(p))),
  };
}
