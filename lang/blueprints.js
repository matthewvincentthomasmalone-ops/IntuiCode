/* IntuiCode — blueprints.
 *
 * A blueprint is a short story with blanks. Filling the blanks writes sentences
 * into the project's folders; the sentences then become code. So an idea goes
 * idea (story) -> sentences -> Python, and every step stays visible and editable.
 *
 * Blueprints are plain text, so anyone can edit them or write their own:
 *
 *   title: Countdown
 *   kind: snippet                      project | snippet
 *   layout: script                     projects only: script | structured
 *   about: One line shown in the list.
 *   story:
 *   Count down from [start: 10] to [stop at: 1], then show [finish: "Lift off!"].
 *   == here                            sections: settings, tools, main (projects) or here (snippets)
 *   count n from [start] to [stop at]
 *       show n
 *   [if finish]
 *   show [finish]
 *   [end]
 *
 * Blanks:
 *   [name: default]        a blank with a starting value
 *   [name: a | b | c]      a choice
 *   [name: "text"]         a text blank; the person types words, quotes are added for them
 *   [name]                 use a blank's value (anywhere, including other sections)
 * Optional parts:
 *   [if name] … [end]              only when the blank isn't empty (or "no")
 *   [if name = value] … [end]      only when a choice equals a value
 *   [if not name] … [end]
 */
(function () {
  'use strict';

  const BUILT_IN = [
`title: C++ guessing game
kind: project
layout: cpp
about: The number guessing game, in C++.
story:
The computer picks a number from [low: 1] to [high: 50]. The player guesses until they get it,
and the game [hints: says higher or lower | only says wrong].
== program
set secret to random number from [low] to [high]
set guesses to 0
show "Guess my number from [low] to [high]"
repeat forever
    ask for a number "Your guess: " and store in guess
    increase guesses by 1
    if guess is secret
        show "Correct! It took you {guesses} guesses."
        stop the loop
[if hints = says higher or lower]
    otherwise if guess is less than secret
        show "Higher"
    otherwise
        show "Lower"
[end]
[if hints = only says wrong]
    otherwise
        show "Wrong, try again"
[end]
`,
`title: Landing page
kind: project
layout: website
about: A one-page website with a header, a menu and a button.
story:
A page for [name: "Sunny Bakery"] with the tagline [tagline: "Fresh bread every morning"].
Its main colour is [colour: #d9822b].
The big button says [button: "See the menu"] and [action: scrolls to the menu | shows a message].
== structure
page title is [name]
add a header in group top
    add a big heading [name]
    add a paragraph [tagline]
    add a button called cta saying [button]
add a section called menu
    add a heading "Menu"
    add a list called items
        add a list item "Sourdough loaf"
        add a list item "Cinnamon bun"
        add a list item "Baguette"
add a footer
    add a paragraph "Made with IntuiCode"
== styling
shared colour brand is [colour]
style the page: font Inter, space around 0, background #fffaf3, text colour #2b2118
style group top: background the colour brand, text colour white, space inside 48 24, centre the text
style cta: background white, text colour the colour brand, no border, rounded corners 999, space inside 12 24, text size 18, bold, hand cursor
when cta is hovered: background #ffe9d2
style menu: at most 640 wide, centred, space inside 24
on screens narrower than 600:
    style group top: space inside 24 16
== mechanics
when cta is clicked
[if action = scrolls to the menu]
    scroll to menu
[end]
[if action = shows a message]
    show a message "Thanks for visiting!"
[end]
`,
`title: To-do list page
kind: project
layout: website
about: Type tasks into a box and they appear in a list.
story:
A to-do page called [title: "My to-dos"] where you type a task and press Add.
New tasks [keep: are remembered by the browser | disappear when the page reloads].
== structure
page title is [title]
add a main area called board
    add a big heading [title]
    add a form called new-task
        add a text box called task with hint "What needs doing?"
        add a button called add saying "Add"
    add a list called tasks
    add a paragraph called count "Nothing to do yet"
== styling
style the page: font Inter, background #f4f6fb, text colour #1d2433, space around 0
style board: at most 560 wide, centred, space inside 32 16
style new-task: in a row, gap 8
style task: width 100%, space inside 10, rounded corners 6, border 1 #c9d1e0
create group primary: background #3867d6, text colour white, no border, rounded corners 6, space inside 10 18, hand cursor
add belongs to group primary
style tasks: space inside 0
style count: text colour #6b7385
== mechanics
create list items
[if keep = are remembered by the browser]
when the page has loaded
    load "items" from the browser and store in saved
    if saved is not nothing
        set items to saved
        for each item in items
            add item to the list tasks
        set the text of count to "{length of items} to do"
[end]
when new-task is sent
    get the text of task and store in title
    if title is empty text
        show a message "Type a task first"
    otherwise
        add title to items
        add title to the list tasks
        clear task
        set the text of count to "{length of items} to do"
[if keep = are remembered by the browser]
        save items in the browser as "items"
[end]
`,
`title: Number guessing game
kind: project
layout: structured
about: The computer picks a number and the player guesses it.
story:
The computer secretly picks a number between [low: 1] and [high: 20].
The player gets [tries: 5] guesses.
After a wrong guess, the game [hint: gives a hint | just says no].
When the player wins, it shows [win message: "You got it!"]
== settings
note: Values the whole game uses. Change them to change the game.
set lowest to [low]
set highest to [high]
set max guesses to [tries]
== tools
[if hint = gives a hint]
note: Compares a guess with the secret number.
define hint using guess, secret
    if guess is less than secret
        give back "Too low!"
    otherwise
        give back "Too high!"
[end]
[if hint = just says no]
note: No tools needed for this version.
[end]
== main
set secret to random number from lowest to highest
set guesses left to max guesses
show "I'm thinking of a number from {lowest} to {highest}."

while guesses left is more than 0
    ask for a number "Your guess: " and store in guess
    if guess is secret
        show [win message]
        stop the loop
    otherwise
        decrease guesses left by 1
[if hint = gives a hint]
        run hint with guess, secret and store in message
        show message and "Guesses left:" and guesses left
[end]
[if hint = just says no]
        show "No. Guesses left:" and guesses left
[end]

if guesses left is 0
    show "Out of guesses. It was" and secret
`,
`title: Quiz
kind: project
layout: structured
about: Random maths questions with a score at the end.
story:
Ask [questions: 5] [kind: times-table | adding] questions using numbers from [smallest: 2] to [biggest: 12].
Give a point for each right answer, then show the score.
When an answer is wrong, [feedback: show the right answer | just move on].
== settings
set questions to [questions]
set smallest to [smallest]
set biggest to [biggest]
== tools
define correct answer using a, b
[if kind = times-table]
    give back a times b
[end]
[if kind = adding]
    give back a plus b
[end]
== main
set score to 0
repeat questions times
    set a to random number from smallest to biggest
    set b to random number from smallest to biggest
    run correct answer with a, b and store in right
[if kind = times-table]
    ask for a number "What is {a} x {b}? " and store in answer
[end]
[if kind = adding]
    ask for a number "What is {a} + {b}? " and store in answer
[end]
    if answer is right
        show "Correct!"
        increase score by 1
[if feedback = show the right answer]
    otherwise
        show "Not quite, it's" and right
[end]

show "You scored {score} out of {questions}."
`,
`title: Terminal to-do list
kind: project
layout: structured
about: A to-do list you use by typing commands.
story:
A to-do list that starts with [starting tasks: "buy milk", "call Sam"].
It keeps offering add and list until the person types [stop word: "quit"].
When the list is empty it says [empty message: "Nothing to do!"]
== settings
create list todos with [starting tasks]
set stop word to [stop word]
== tools
define show tasks using items
    if length of items is 0
        show [empty message]
    for each task in items
        show "-" and task
== main
repeat forever
    ask "Type add, list or {stop word}: " and store in choice
    if choice is stop word
        stop the loop
    otherwise if choice is "add"
        ask "What needs doing? " and store in task
        add task to todos
    otherwise if choice is "list"
        run show tasks with todos
    otherwise
        show "I don't know the command" and choice
show "Bye!"
`,
`title: Shopping list
kind: project
layout: script
about: Build a list, sort it, and go through it.
story:
Start a shopping list with [items: "apples", "bread"], then add [extra: "milk"].
[sorted: Sort it | Keep it in the order written].
Show each item [style: in capitals | as written].
== main
create list basket with [items]
add [extra] to basket
[if sorted = Sort it]
sort basket
[end]

show "You have" and length of basket and "things to buy:"
for each thing in basket
[if style = in capitals]
    show "-" and thing in capitals
[end]
[if style = as written]
    show "-" and thing
[end]
`,
`title: Empty structured program
kind: project
layout: structured
about: Settings, Tools and Main program, ready for your own sentences.
story:
A program called [project name: my-program] with its folders ready.
== settings
note: Starting values go here, e.g. set player name to "Sam"
== tools
note: Reusable tools go here, e.g. define greet using name
== main
note: Your program starts here. Press Run to try it.
`,
`title: Empty script
kind: project
layout: script
about: One Main program file. Good for short experiments.
story:
A short script that greets someone by name and says [greeting: "Hello"].
== main
set greeting to [greeting]
ask "What's your name? " and store in name
show "{greeting}, {name}!"
`,
`title: Ask until the answer is valid
kind: snippet
about: Keeps asking until a number is in range.
story:
Ask for a number between [min: 1] and [max: 10] and keep asking until it is in range.
Keep the answer in [name: choice].
== here
ask for a number "Pick a number from [min] to [max]: " and store in [name]
while [name] is less than [min] or [name] is more than [max]
    ask for a number "Try again, from [min] to [max]: " and store in [name]
`,
`title: Menu loop
kind: snippet
about: Offer choices until the person types a stop word.
story:
Offer the choices [choices: "play", "help"] and keep asking until the person types [stop: "quit"].
== here
create list menu with [choices]
repeat forever
    ask "Choose one ({menu}) or [stop]: " and store in pick
    if pick is [stop]
        stop the loop
    otherwise if pick is in menu
        show "You chose" and pick
    otherwise
        show "That isn't on the menu."
`,
`title: Add up numbers
kind: snippet
about: Ask for several numbers, then show the total or the average.
story:
Ask for [count: 5] numbers, then show the [result: total | average].
== here
set total to 0
repeat [count] times
    ask for a decimal "Number: " and store in n
    increase total by n
[if result = total]
show "Total:" and total
[end]
[if result = average]
show "Average:" and total divided by [count]
[end]
`,
`title: Countdown
kind: snippet
about: Count down, then show a message.
story:
Count down from [start: 10] to [stop at: 1], waiting [pause: 1] second between numbers, then show [finish: "Lift off!"]
== here
count n from [start] to [stop at]
    show n
    wait [pause] seconds
[if finish]
show [finish]
[end]
`,
`title: New tool
kind: snippet
about: The skeleton of a reusable tool.
story:
Make a tool called [tool name: double] that takes [inputs: n] and gives back [answer: n times 2].
== here
define [tool name] using [inputs]
    give back [answer]
`,
`title: Random pick
kind: snippet
about: Pick something at random from a list.
story:
Pick a random [thing: colour] from [options: "red", "green", "blue"] and show it.
== here
create list [thing] choices with [options]
set picked [thing] to random item from [thing] choices
show "Picked:" and picked [thing]
`,
  ];

  const FIELD = /\[(?!if\b|end\b|not\b)([A-Za-z][\w ]*?)(?:\s*:\s*([^\]]*))?\]/g;

  const TOKEN = new RegExp(FIELD.source + '|"(?:[^"\\\\]|\\\\.)*"', 'g');

  function parse(text) {
    const errors = [];
    const lines = text.replace(/\r/g, '').split('\n');
    const meta = { title: '', kind: 'project', layout: 'script', about: '' };
    let i = 0;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (/^story\s*:/i.test(l)) { i++; break; }
      const m = l.match(/^(title|kind|layout|about)\s*:\s*(.*)$/i);
      if (m) meta[m[1].toLowerCase()] = m[2].trim();
      else if (l.trim()) errors.push(`Line ${i + 1}: expected "title:", "kind:", "layout:", "about:" or "story:".`);
    }
    const story = [];
    for (; i < lines.length && !/^==\s*\w/.test(lines[i]); i++) story.push(lines[i]);
    const sections = {};
    let cur = null;
    for (; i < lines.length; i++) {
      const m = lines[i].match(/^==\s*(\w+)\s*$/);
      if (m) { cur = m[1].toLowerCase(); sections[cur] = []; continue; }
      if (cur) sections[cur].push(lines[i]);
    }
    for (const k of Object.keys(sections)) {
      while (sections[k].length && !sections[k][sections[k].length - 1].trim()) sections[k].pop();
      sections[k] = sections[k].join('\n');
    }
    meta.kind = /snippet/i.test(meta.kind) ? 'snippet' : 'project';
    meta.layout = /c\+\+|cpp/i.test(meta.layout) ? 'cpp' : /web|site/i.test(meta.layout) ? 'website' : /struct/i.test(meta.layout) ? 'structured' : 'script';
    if (!meta.title) errors.push('Add a "title:" line.');
    if (!Object.keys(sections).length) errors.push('Add at least one section, e.g. "== main" (or "== here" for a snippet).');
    const allowed = meta.kind === 'snippet' ? ['here'] : meta.layout === 'cpp' ? ['program'] : meta.layout === 'website' ? ['structure', 'styling', 'mechanics'] : meta.layout === 'structured' ? ['settings', 'tools', 'main'] : ['main'];
    for (const k of Object.keys(sections)) if (!allowed.includes(k)) errors.push(`"== ${k}" isn't a section for this kind of blueprint. Use: ${allowed.map(a => '== ' + a).join(', ')}.`);

    // Blanks, in order of first appearance (story first).
    const fields = new Map();
    const scan = (src) => {
      for (const m of src.matchAll(FIELD)) {
        const name = m[1].trim().toLowerCase();
        if (m[2] === undefined) { if (!fields.has(name)) fields.set(name, null); continue; }
        const def = m[2].trim();
        const choices = def.includes('|') ? def.split('|').map(s => s.trim()).filter(Boolean) : null;
        const text = !choices && /^"[^"]*"$/.test(def);
        fields.set(name, { name, choices, text, value: choices ? choices[0] : text ? def.slice(1, -1) : def });
      }
    };
    const reserved = [...(story.join('\n') + Object.values(sections).join('\n')).matchAll(/\[(if|end|not)\s*:/gi)];
    for (const r of reserved) errors.push(`"${r[1]}" is a reserved word in blueprints, so it can't name a blank. Try another name.`);
    scan(story.join('\n'));
    Object.values(sections).forEach(scan);
    for (const [name, f] of fields) {
      if (!f) { errors.push(`The blank [${name}] is used but never given a starting value. Write it once as [${name}: something].`); fields.delete(name); }
    }
    return { ...meta, story: story.join('\n').trim(), sections, fields: [...fields.values()], errors, source: text };
  }

  function valueOf(f, values) {
    const v = values && values[f.name] !== undefined ? values[f.name] : f.value;
    if (f.text) return '"' + String(v).replace(/"/g, "'") + '"';
    return String(v);
  }

  function truthy(v) {
    const t = String(v).trim().replace(/^"|"$/g, '');
    return !!t && !/^(no|none|off|false|0)$/i.test(t);
  }

  function fill(bp, values) {
    const byName = new Map(bp.fields.map(f => [f.name, f]));
    const val = (name) => { const f = byName.get(name.trim().toLowerCase()); return f ? valueOf(f, values) : ''; };
    const raw = (name) => { const f = byName.get(name.trim().toLowerCase()); return f ? String(values && values[f.name] !== undefined ? values[f.name] : f.value) : ''; };
    const out = {};
    for (const [sec, text] of Object.entries(bp.sections)) {
      const keep = [];
      const stack = [];
      for (const line of text.split('\n')) {
        const cond = line.trim().match(/^\[if\s+(not\s+)?([A-Za-z][\w ]*?)(?:\s*=\s*([^\]]*))?\]$/i);
        if (cond) {
          const v = raw(cond[2]);
          let ok = cond[3] !== undefined ? v.trim().toLowerCase() === cond[3].trim().toLowerCase() : truthy(v);
          if (cond[1]) ok = !ok;
          stack.push(ok);
          continue;
        }
        if (/^\s*\[end\]\s*$/i.test(line)) { stack.pop(); continue; }
        // Inside quoted text a blank goes in as-is; elsewhere text blanks get their quotes.
        if (stack.every(Boolean)) keep.push(line.replace(TOKEN, (m, name) => m[0] === '[' ? val(name) : m.replace(FIELD, (mm, n2) => raw(n2))));
      }
      out[sec] = keep.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }
    return out;
  }

  /* Turn an existing project into a blueprint source (no blanks yet: the person adds them). */
  function fromProject(project, title) {
    const layout = project.sections.length > 1 ? 'structured' : 'script';
    let src = `title: ${title}\nkind: project\nlayout: ${layout}\nabout: Made from the project ${project.name}.\nstory:\n${title}. Put [blanks: like this] in this story, then use [blanks] in the sentences below.\n`;
    for (const s of project.sections) src += `== ${s.file}\n${s.text.replace(/\s+$/, '')}\n`;
    return src;
  }

  window.IntuiBlueprints = { BUILT_IN, parse, fill, fromProject };
})();
