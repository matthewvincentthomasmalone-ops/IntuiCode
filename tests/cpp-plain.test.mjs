// C++ and Arduino said in plain words: text with values in it, a tool's result, items of a list, values as
// another kind, F(), decimal places, the writer's own helpers, and class members one by one. Each form is
// checked both ways: the code reads as the sentence, exactly, and the sentence writes that code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConverter } from './helpers/engine.mjs';

const { convert, CPP } = await loadConverter();
const plain = (x) => JSON.parse(JSON.stringify(x));
const write = (kind, text) => CPP.compileCppProject({ kind, sections: [{ id: 'x', file: kind === 'arduino' ? 'sketch' : 'program', text }] }).results.x;

/* [what, kind, code, sentences it must be said with (each a whole line, indentation aside), exact lines kept] */
const READ = [
  ['Arduino text with values in it', 'arduino',
    'int blinks = 0;\nfloat t = 21.5;\nString status = "ok";\nvoid setup() {\n  Serial.begin(9600);\n}\nvoid loop() {\n  Serial.println(String("Blinks so far: ") + blinks);\n  Serial.println("Temp: " + String(t));\n  Serial.println(String(t) + " C");\n  Serial.println(String("Avg: ") + t + " C, " + blinks + " blinks");\n  Serial.println("Status: " + status);\n  Serial.println(String("{braces} ") + blinks);\n  String msg = "T=" + String(t) + " C";\n}\n',
    ['show "Blinks so far: {blinks}"', 'show "Temp: {t as text}"', 'show "{t} C"', 'show "Avg: {t} C, {blinks} blinks"', 'show "Status: " plus status', 'show "{{braces}} {blinks}"', 'set msg to "T={t as text} C"']],
  ['Arduino text kept in flash, decimal places, hexadecimal, a screen', 'arduino',
    '#include <LiquidCrystal.h>\nLiquidCrystal lcd(12, 11, 5, 4, 3, 2);\nfloat t = 0;\nint code = 255;\nvoid setup() {\n  Serial.begin(9600);\n  lcd.begin(16, 2);\n  Serial.println(F("Ready"));\n  lcd.print(F("Hi"));\n}\nvoid loop() {\n  Serial.println(t, 2);\n  Serial.print("Code: ");\n  Serial.println(code, HEX);\n  lcd.print(t, 1);\n  Serial.println(code, BIN);\n}\n',
    ['show "Ready" kept in flash', 'show "Hi" kept in flash on lcd', 'show t with 2 decimal places', 'show "Code: " followed by code in hexadecimal', 'show t with 1 decimal place on lcd', 'show code in binary']],
  ['Arduino text as a number, its length', 'arduino',
    'String s = "12";\nvoid setup() {\n  int v = s.toInt();\n  float f = s.toFloat();\n  int len = s.length();\n}\nvoid loop() {\n}\n',
    ['set v to s as a whole number', 'set float f to s as a decimal', 'set whole number len to length of s']],
  ['a tool\'s result, alone and in a calculation; items of a list', 'cpp',
    '#include <iostream>\n#include <vector>\nint add(int a, int b) {\n    return a + b;\n}\nbool ready() {\n    return true;\n}\nint main() {\n    int sum = add(2, 3);\n    std::cout << add(sum, 1) << std::endl;\n    if (!ready()) {\n        std::cout << "not yet" << std::endl;\n    }\n    sum += add(1, 1) * 2;\n    std::vector<int> xs = {1, 2, 3};\n    std::cout << xs[1] << std::endl;\n    xs[2] = xs[0];\n    std::cout << "Sum: " << sum << ", twice: " << add(sum, sum) << std::endl;\n    return 0;\n}\n',
    ['set whole number sum to the result of add with 2, 3', 'show the result of add with sum, 1', 'if not the result of ready', 'increase sum by (the result of add with 1, 1) times 2',
      'show item 1 of xs', 'set item 2 of xs to item 0 of xs', 'show "Sum: " followed by sum followed by ", twice: " followed by the result of add with sum, sum']],
  ['values as another kind, and text joined to text', 'cpp',
    '#include <iostream>\n#include <string>\nint main() {\n    int total = 7;\n    int n = 2;\n    double avg = static_cast<double>(total) / n;\n    int whole = static_cast<int>(avg);\n    std::string s = "42";\n    int k = std::stoi(s);\n    std::string label = "Total: " + std::to_string(total);\n    std::string name = "Ada";\n    std::string hi = "Hi " + name;\n    return 0;\n}\n',
    ['set decimal avg to total as a decimal divided by n', 'set whole number whole to avg as a whole number', 'set k to s as a whole number', 'set label to "Total: " plus total as text', 'set hi to "Hi " plus name']],
  ['a class member that can\'t be said stays code; a tool that only looks', 'cpp',
    '#include <iostream>\nclass Counter {\npublic:\n    explicit Counter(int start) : count_(start) {}\n    int count() const {\n        return count_;\n    }\n    void add() {\n        count_++;\n    }\nprivate:\n    int count_;\n};\nint main() {\n    Counter c(1);\n    c.add();\n    std::cout << c.count() << std::endl;\n    return 0;\n}\n',
    ['define class Counter', 'c++: explicit Counter(int start) : count_(start) {}', 'define count giving back a whole number, without changing the object', 'increase count_', 'the rest is private', 'field count_: whole number', 'run c.add', 'show the result of c.count'], 1],
  ['a class tool given an object of the file\'s own class', 'cpp',
    '#include <iostream>\nclass Box {\npublic:\n    int size = 1;\n};\nvoid grow(Box& b, const Box& by) {\n    b.size += by.size;\n}\nint main() {\n    Box a;\n    Box b;\n    grow(a, b);\n    return 0;\n}\n',
    ['define grow using the caller\'s Box b, read-only Box by giving back nothing', 'run grow with a, b']],
];

READ.forEach(([what, kind, code, lines, kept = 0]) => {
  test(`said in plain words, and back exactly: ${what}`, () => {
    const r = convert(kind, code);
    assert.equal(r.exact, true, `${r.reason}\n${r.text}`);
    assert.equal(r.kept, kept, r.text);
    const said = r.text.split('\n').map(l => l.trim());
    for (const l of lines) assert.ok(said.includes(l), `"${l}" isn't one of the sentences:\n${r.text}`);
    assert.deepEqual(plain(write(kind, r.text).info.flatMap(i => i.errs)), [], r.text);
  });
});

test('the writer\'s own helpers come back from the sentences that use them', () => {
  const text = 'set secret to random number from 1 to 50\nset guesses to 3\nshow "You took {guesses} tries."';
  const made = write('cpp', text);
  assert.match(made.text, /int random_number\(int low, int high\)/);
  assert.match(made.text, /std::cout << text\("You took ", guesses, " tries\."\) << std::endl;/);
  const r = convert('cpp', made.text);
  assert.equal(r.exact, true, r.reason);
  assert.equal(r.kept, 0, r.text);
  assert.match(r.text, /^set secret to random number from 1 to 50\nset guesses to 3\nshow "You took \{guesses\} tries\."$/m);
  // a helper nothing uses, or one somewhere else, stays as it is
  const alone = convert('cpp', '#include <iostream>\n#include <random>\nint random_number(int low, int high) {\n    static std::mt19937 generator(std::random_device{}());\n    return std::uniform_int_distribution<int>(low, high)(generator);\n}\nint main() {\n    std::cout << "hi" << std::endl;\n    return 0;\n}\n');
  assert.equal(alone.exact, true, alone.reason);
  assert.match(alone.text, /^above main: int random_number\(int low, int high\) \{$/m);
  const later = convert('cpp', '#include <iostream>\n#include <random>\nint twice(int x) {\n    return x * 2;\n}\nint random_number(int low, int high) {\n    static std::mt19937 generator(std::random_device{}());\n    return std::uniform_int_distribution<int>(low, high)(generator);\n}\nint main() {\n    int r = random_number(1, 6);\n    std::cout << twice(r) << std::endl;\n    return 0;\n}\n');
  assert.equal(later.exact, true, later.reason);
  assert.match(later.text, /^set r to the result of random_number with 1, 6$/m);
});

/* [what, kind, sentences, the code they make, problems (errors, then warnings)] — written by hand */
const WRITE = [
  ['text then a value made into text joins as it is', 'arduino', 'set t to 2.5\nwhen the board starts\n    start the serial monitor at 9600\n    show "Temp: {t as text}"\n    show "Temp: {t}"', /Serial\.println\("Temp: " \+ String\(t\)\);\n    Serial\.println\(String\("Temp: "\) \+ t\);/],
  ['text joined to text needs nothing more', 'arduino', 'set name to "Ada"\nwhen the board starts\n    show "Hi " plus name\n    show "Hi " plus 3', /Serial\.println\("Hi " \+ name\);\n    Serial\.println\(String\("Hi "\) \+ 3\);/],
  ['C++ text joined to a number made into text', 'cpp', 'set score to 3\nshow "Score: " plus score as text', /std::cout << "Score: " \+ std::to_string\(score\) << std::endl;/],
  ['a tool\'s result, as the whole value and in brackets', 'cpp', 'define f using whole number a, whole number b giving back a whole number\n    give back a plus b\nset x to the result of f with 1, 2\nset y to (the result of f with 1, 2) times (the result of f with x, 3)\nshow the result of f with x, y',
    /auto x = f\(1, 2\);\n    auto y = f\(1, 2\) \* f\(x, 3\);\n    std::cout << f\(x, y\) << std::endl;/],
  ['text kept in flash, decimal places, hexadecimal', 'arduino', 'set t to 2.5\nset n to 9\nwhen the board starts\n    start the serial monitor at 9600\n    show "Ready" kept in flash\n    show t with 1 decimal place\n    show "n: " followed by n in hexadecimal on the same line',
    /Serial\.println\(F\("Ready"\)\);\n    Serial\.println\(t, 1\);\n    Serial\.print\("n: "\); Serial\.print\(n, HEX\);/],
  ['a class\'s tool that only looks', 'cpp', 'define class Box\n    field size: whole number = 1\n    define area giving back a whole number, without changing the object\n        give back size times size', /    int area\(\) const \{\n        return size \* size;\n    \}/],
  ['"… with …" inside a calculation needs brackets', 'cpp', 'define f using whole number a giving back a whole number\n    give back a\nset y to 2 plus the result of f with 1', /./, ['"the result of … with …" only works as the whole value. Store the result in a name first, then use the name.']],
  ['a tool that isn\'t defined: an error, or a warning when other files are included', 'cpp', 'set z to the result of nope', /./, ['There\'s no tool called `nope`. Make one with "define nope using …".']],
  ['… and a warning when other files are included', 'cpp', 'include "tools.h"\nset z to the result of nope with 3\nrun other with 1', /auto z = nope\(3\);\n    other\(1\);/, [], ['`nope` isn\'t defined here, so it must come from an included file.', '`other` isn\'t defined here, so it must come from an included file.']],
  ['only a class\'s tools change nothing', 'cpp', 'define g giving back nothing, without changing the object\n    show 1', /./, ['"without changing the object" is for a class\'s own tools.']],
  ['decimal places on a whole number', 'arduino', 'set n to 5\nwhen the board starts\n    start the serial monitor at 9600\n    show n with 2 decimal places', /Serial\.println\(n, 2\);/, [], ['`n` is a whole number: for one, the 2 would be the base to show it in (2 is binary), not decimal places.']],
  ['"the caller\'s" in a list of inputs', 'cpp', 'define class Box\n    field size: whole number = 1\ndefine grow using the caller\'s Box b, read-only Box by giving back nothing\n    increase b.size by by.size', /void grow\(Box& b, const Box& by\) \{/],
];
WRITE.forEach(([what, kind, text, re, errs = [], warns]) => {
  test(`sentences -> ${kind === 'arduino' ? 'Arduino' : 'C++'}: ${what}`, () => {
    const r = write(kind, text);
    assert.deepEqual(plain(r.info.flatMap(i => i.errs)), errs, r.text);
    if (warns) assert.deepEqual(plain(r.info.flatMap(i => i.warns)), warns, r.text);
    assert.match(r.text, re);
  });
});
