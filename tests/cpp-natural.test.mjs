// C++ and Arduino sentences as people naturally type them: what C++ can't take as written becomes the form it
// needs, with a note saying what it became, or an error that says what to write. Never code that looks fine and
// doesn't build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConverter, loadWebReader } from './helpers/engine.mjs';

const { convert, CPP } = await loadConverter();
const W = await loadWebReader();
const plain = (x) => JSON.parse(JSON.stringify(x));
const write = (kind, text) => CPP.compileCppProject({ kind, sections: [{ id: 'x', file: kind === 'arduino' ? 'sketch' : 'program', text }] }).results.x;
const errs = (r) => plain(r.info.flatMap(i => i.errs));
const warns = (r) => plain(r.info.flatMap(i => i.warns));
const notes = (r) => plain(r.info.flatMap(i => i.notes));
const parses = (r) => assert.ok(W.analyzeCpp('check.cpp', r.text, { fileOf: () => null, localFns: new Set() }).ok, r.text);

/* [what, kind, sentences, code it must hold (each a regex), errors, a note it must have] */
const CASES = [
  // 1. C++'s own words
  ['a C++ word as a name', 'cpp', 'set new to 3', [], ['"new" is one of C++\'s own words, so it can\'t be a name. Try "my new" or "new value".']],
  ['… in every place a name is made', 'cpp', 'make a list of whole numbers called template with 1, 2\ncount delete from 1 to 3\n    show delete\ndefine switch using a\n    give back a\nconstant int is 4\nlet class stand for 3', [],
    ['"template" is one of C++\'s own words, so it can\'t be a name. Try "my template" or "template value".', '"delete" is one of C++\'s own words, so it can\'t be a name. Try "my delete" or "delete value".',
      '"switch" is one of C++\'s own words, so it can\'t be a name. Try "my switch" or "switch value".', '"int" is one of C++\'s own words, so it can\'t be a name. Try "my int" or "int value".',
      '"class" is one of C++\'s own words, so it can\'t be a name. Try "my class" or "class value".']],
  ['… and the suggestion works', 'cpp', 'set my new to 3\nset new value to 4\nshow my new plus new value', [/int myNew = 3;/, /int newValue = 4;/, /std::cout << myNew \+ newValue << std::endl;/]],
  ['a tool can\'t be called main', 'cpp', 'define main\n    show 1', [], ['"main" is where every C++ program starts, so a tool can\'t be called main. The steps at the left edge are main\'s steps.']],
  ['a name that would hide the translator\'s text helper', 'cpp', 'set text to "hi"\nset n to 3\nshow "n is {n}"', [],
    ['`text` is also the translator\'s helper for text with {…} in it, which this program uses, so a name text would hide it. Try "my text" or another name.']],
  ['… is fine when the helper isn\'t used', 'cpp', 'set text to "hi"\nshow text', [/std::string text = "hi";/]],
  // 2. Arduino's own names
  ['Arduino\'s own names', 'arduino', 'set HIGH to 3\nset A0 to 5\nset LED_BUILTIN to 1', [],
    ['"HIGH" is one of Arduino\'s own names, so it can\'t be a name here. Try "my high" or "high value".', '"A0" is one of Arduino\'s own names, so it can\'t be a name here. Try "my a0" or "a0 value".',
      '"LED_BUILTIN" is one of Arduino\'s own names, so it can\'t be a name here. Try "my led builtin" or "led builtin value".']],
  ['Arduino\'s own tools as names', 'arduino', 'set delay to 3\nset millis to 4\nset max to 100', [],
    ['"delay" is one of Arduino\'s own tools, so it can\'t be a name here. Try "my delay" or "delay value".', '"millis" is one of Arduino\'s own tools, so it can\'t be a name here. Try "my millis" or "millis value".',
      '"max" is one of Arduino\'s own tools, so it can\'t be a name here. Try "my max" or "max value".']],
  ['the sketch\'s own parts as tools', 'arduino', 'define loop\n    wait 1 second\ndefine setup\n    wait 1 second', [],
    ['"loop" is the sketch\'s own "over and over" part: write that instead of "define loop".', '"setup" is the sketch\'s own "when the board starts" part: write that instead of "define setup".']],
  ['… they are only Arduino\'s in a sketch', 'cpp', 'set delay to 3\nset HIGH to 4', [/int delay = 3;/, /int HIGH = 4;/]],
  // 3. thousands
  ['1,000 is 1000', 'cpp', 'set total to 1,000\nset big to 1,000,000\nif total is more than 1,500\n    show total', [/int total = 1000;/, /int big = 1000000;/, /if \(total > 1500\) \{/], [], 'C++ numbers have no commas, so 1,000 is written 1000.'],
  ['a list keeps its commas, and asks when a number could be two', 'cpp', 'make a list of whole numbers called xs with 1,2,3\nmake a list of whole numbers called ys with 100,200,300\nmake a list of whole numbers called zs with 1,500\nmake a list of whole numbers called ws with 1,000, $2,500',
    [/std::vector<int> xs = \{1, 2, 3\};/, /std::vector<int> ws = \{1000, 2500\};/],
    ['"100,200,300" could be one number (100200300) or 3 (100, 200, 300). Write 100200300 for one, or put a space after each comma for 3.', '"1,500" could be one number (1500) or 2 (1, 500). Write 1500 for one, or put a space after each comma for 2.']],
  ['a value with a comma that is no number', 'cpp', 'set x to 1,2\nset price to 2,50', [],
    ['"1,2" isn\'t one number in C++. For a decimal, write 1.2 (C++ uses a point); for two numbers, make a list.', '"2,50" isn\'t one number in C++. For a decimal, write 2.50 (C++ uses a point); for two numbers, make a list.']],
  ['1_000 is 1000', 'cpp', 'set million to 1_000_000', [/int million = 1000000;/], [], 'C++ numbers have no _, so 1_000_000 is written 1000000.'],
  // 4. money and percentages
  ['money', 'cpp', 'set price to $5\nset euro to €5\nset pound to £5.50\nset big to -$1,000', [/int price = 5;/, /int euro = 5;/, /double pound = 5\.50;/, /int big = -1000;/], [], 'C++ numbers have no currency sign, so $5 is written 5. (Text like "$5" shows it.)'],
  ['percentages', 'cpp', 'set rate to 50%\nset tax to 12.5%\nset all to 100%\nset tiny to 0.5%\nshow 7%', [/double rate = 0\.5;/, /double tax = 0\.125;/, /double all = 1\.0;/, /double tiny = 0\.005;/, /std::cout << 0\.07 << std::endl;/], [],
    'In C++, % is the remainder after dividing, so 50% is written 0.5. (Text like "50%" shows the sign.)'],
  ['a percentage of something', 'cpp', 'set price to 80\nset tip to 15% of price\nset tip2 to (15% of price) plus 2\nset tip3 to 15% of (price plus 2)', [/double tip = 0\.15 \* price;/, /double tip2 = \(0\.15 \* price\) \+ 2;/, /double tip3 = 0\.15 \* \(price \+ 2\);/]],
  ['… that could mean two things', 'cpp', 'set price to 80\nset tip to 15% of price plus 2', [], ['"15% of price plus 2" could mean two things. Put brackets round the part you mean: (15% of price) plus 2, or 15% of (price plus 2).']],
  ['a value made bigger or smaller by a percentage of itself', 'cpp', 'set price to 80\nincrease price by 10%\ndecrease price by 25%', [/double price = 80;/, /price \*= 1\.1;/, /price \*= 0\.75;/], [], 'Increase by 10% is by 10% of price itself, so it is multiplied by 1.1.'],
  ['plus a percentage: of what?', 'cpp', 'set price to 80\nset total to price plus 10%', [], ['"plus 10%" could mean plus 0.1, or plus 10% of the value before it. Say which: "plus 0.1", or "plus 10% of price".']],
  ['% between numbers is still the remainder', 'cpp', 'set n to 7\nshow n % 2\nset r to 10%3', [/std::cout << n % 2 << std::endl;/, /auto r = 10%3;/]],
  // 5. curly quotes
  ['curly quotes are quotes', 'cpp', 'show “Hello there”', [/std::cout << "Hello there" << std::endl;/], [], 'Curly quote marks (“ ” ‘ ’) are written as straight ones (" \') in C++.'],
  ['… an apostrophe in a word stays, and so does anything in straight quotes', 'cpp', 'show “It’s here”\nshow "It’s “here”"', [/std::cout << "It’s here" << std::endl;/, /std::cout << "It’s “here”" << std::endl;/]],
  ['… an apostrophe in a sentence word works', 'cpp', 'set n to 3\nif n isn’t 4\n    show n', [/if \(n != 4\) \{/]],
  ['… and so are curly quotes inside them', 'cpp', 'show “It’s “here””\nshow “a” and “b”', [/std::cout << "It’s “here”" << std::endl;/, /std::cout << "a" << " " << "b" << std::endl;/]],
  ['… a straight quote inside curly quotes is part of the text', 'cpp', 'show “He said "hi" to me”', [/std::cout << "He said \\"hi\\" to me" << std::endl;/], [], 'A " inside text is written \\" in C++, so the text doesn\'t end there.'],
  ['… single curly quotes: one character, or text', 'cpp', 'show ‘a’\nshow ‘Hello there’', [/std::cout << 'a' << std::endl;/, /std::cout << "Hello there" << std::endl;/]],
  ['text in single quotes is text', 'cpp', 'show \'Hello\'\nshow \'{x}\'\nset c to \'b\'', [/std::cout << "Hello" << std::endl;/, /std::cout << "\{x\}" << std::endl;/, /char c = 'b';/], [], 'C++ text goes in double quotes (single quotes hold one character), so \'Hello\' is written "Hello".'],
  ['a quote mark inside straight-quoted text', 'cpp', 'show "He said "hi" to me"', [], ['This text has a " inside it, which would end the text there. Write \\" for each " that is part of the text: "He said \\"hi\\" to me".']],
  ['text with no end', 'cpp', 'show "Hello', [], ['This text has no closing quote mark (").']],
  // 6. names of several words
  ['a name of two words, in C++', 'cpp', 'set total price to 5\nincrease total price by 2\nif the total price is more than 3\n    show "Total: {total price}"\nshow "total price"',
    [/int totalPrice = 5;/, /totalPrice \+= 2;/, /if \(totalPrice > 3\) \{/, /text\("Total: ", totalPrice\)/, /std::cout << "total price" << std::endl;/], [], 'C++ names can\'t have spaces, so "total price" is written `totalPrice`.'],
  ['… in a sketch, everywhere a pin is named', 'arduino', 'set led pin to 13\nwhen the board starts\n    make pin led pin an output\nover and over\n    turn pin led pin on\n    wait 1 second\n    turn led pin off',
    [/^int ledPin = 13;$/m, /pinMode\(ledPin, OUTPUT\);/, /digitalWrite\(ledPin, HIGH\);/, /digitalWrite\(ledPin, LOW\);/]],
  ['… with a kind said first', 'arduino', 'set unsigned long last blink time to 0\nconstant button pin is 2\nover and over\n    if at least 500 milliseconds have passed since last blink time\n        set last blink time to time since start\n    read pin button pin and store it in button state',
    [/^unsigned long lastBlinkTime = 0;$/m, /^const int buttonPin = 2;$/m, /if \(millis\(\) - lastBlinkTime >= 500\) \{/, /lastBlinkTime = millis\(\);/, /int buttonState = digitalRead\(buttonPin\);/]],
  ['… lists, loops, tools and their inputs', 'cpp', 'make a list of whole numbers called high scores with 1, 2\nfor each high score in high scores\n    show high score\ncount step number from 1 to 3\n    show step number\ndefine add tax using decimal unit price, tax rate giving back a decimal\n    give back unit price times (1 plus tax rate)\nrun add tax with 2.5, 0.1 and store in final price\nask "Name? " and store in user name',
    [/std::vector<int> highScores = \{1, 2\};/, /for \(const auto& highScore : highScores\) \{/, /for \(int stepNumber = 1; stepNumber <= 3; stepNumber\+\+\) \{/, /double addTax\(double unitPrice, auto taxRate\) \{/, /return unitPrice \* \(1 \+ taxRate\);/, /auto finalPrice = addTax\(2\.5, 0\.1\);/, /std::string userName;/]],
  ['… and class fields', 'cpp', 'define class Item\n    field unit price: decimal\n    has whole number item count starting at 0\n    define total giving back a decimal\n        give back unit price times item count', [/double unitPrice;/, /int itemCount = 0;/, /return unitPrice \* itemCount;/]],
  ['… a hyphen joins words too', 'cpp', 'set high-score to 3\nshow high-score', [/int highScore = 3;/, /std::cout << highScore << std::endl;/]],
  ['… a sentence\'s own words, where it starts, stay', 'cpp', 'set count down to 10\ncount down from 3 to 1\n    show n\nshow count down', [/int countDown = 10;/, /for \(int n = 3; n >= 1; n--\) \{/, /std::cout << countDown << std::endl;/]],
  ['"the", "a" and "an" before a name are left out', 'cpp', 'set the total to 5\nset a counter to 1\nincrease the counter by 2', [/int total = 5;/, /int counter = 1;/, /counter \+= 2;/]],
  ['a name with a sentence word in it: write it as one word', 'cpp', 'set number of tries to 3', [], ['"number of tries" can\'t be a name: sentences read "of" as a word of their own. Write it as one word, like numberOfTries.']],
  ['… or one that starts like a phrase', 'cpp', 'set random number to 5', [], ['"random number" can\'t be a name: it starts like "random number …". Write it as one word, like randomNumber.']],
  ['a class\'s name is one word', 'cpp', 'define class shopping cart', [], ['A class\'s name is one word: write ShoppingCart.']],
  // 7. more, found by probing
  ['two values in a row', 'cpp', 'set price to 5 dollars', [], ['"5 dollars" is a number and a word in a row, which C++ can\'t take. Write the number alone (5), or put the words in quotes to show them.']],
  ['… a name of two words that was never set', 'arduino', 'set led to 13\nwhen the board starts\n    make led pin an output', [],
    ['"led pin" is two values in a row, which C++ can\'t take. If it is one name, set it first ("set led pin to …"); for the pin led, say "pin led". For two values, put "and" or "followed by" between them.']],
  ['a kind said, and a value of another kind', 'cpp', 'set text size to 2', [], ['This says `size` holds text, but 2 is a whole number. If "text size" is one name, write textSize.']],
  ['a number with a 0 in front isn\'t octal', 'cpp', 'set code to 010\nset pin to 007', [/int code = 10;/, /int pin = 7;/], [], 'C++ reads a whole number that starts with 0 as octal (010 would be 8), so 010 is written 10.'],
  ['hexadecimal, binary and 1e3 are numbers of their kind', 'cpp', 'set mask to 0x1F\nset bits to 0b101\nset big to 1e3', [/int mask = 0x1F;/, /int bits = 0b101;/, /double big = 1e3;/]],
  ['a whole number too big for an Uno\'s int is a long', 'arduino', 'set big to 100000\nset small to 100\nset huge to 3000000000', [/^long big = 100000;$/m, /^int small = 100;$/m, /^unsigned long huge = 3000000000;$/m]],
  ['number words', 'cpp', 'repeat five times\n    show 1', [], ['C++ sentences take numbers as digits: write 5 for "five".']],
  ['× ÷ ≤ ≥ ≠ −', 'cpp', 'set area to 3 × 4\nset half to area ÷ 2\nset cold to −3\nif area ≥ 10\n    show area', [/auto area = 3 \* 4;/, /half = area \/ 2;/, /int cold = -3;/, /if \(area >= 10\) \{/], [], '× is written `*` in C++.'],
  ['a board\'s label D13 is pin 13', 'arduino', 'make a Servo called arm\nwhen the board starts\n    make pin D13 an output\n    attach arm to pin D9', [/pinMode\(13, OUTPUT\);/, /arm\.attach\(9\);/]],
  ['high and low in a sketch are HIGH and LOW', 'arduino', 'set button state to LOW\nover and over\n    if button state is high\n        set button state to low', [/if \(buttonState == HIGH\) \{/, /buttonState = LOW;/]],
  ['waiting, said many ways', 'arduino', 'set n to 40\nover and over\n    wait 500 ms\n    wait 250ms\n    wait half a second\n    wait 1.5 seconds\n    wait 2 minutes\n    wait n seconds\n    wait n plus 1 seconds\n    wait a second',
    [/delay\(500\);\n    delay\(250\);\n    delay\(500\);\n    delay\(1500\);\n    delay\(120000\);\n    delay\(n \* 1000UL\);\n    delay\(\(n \+ 1\) \* 1000UL\);\n    delay\(1000\);/], [], '"half a second" is 500 milliseconds.'],
  ['… how long?', 'arduino', 'over and over\n    wait 2', [], ['Say how long: "wait 2 milliseconds" or "wait 2 seconds".']],
  ['a C++ program waits too', 'cpp', 'wait 2 seconds\nwait 500 milliseconds\nset t to 1.5\nwait t seconds',
    [/#include <chrono>\n#include <thread>/, /std::this_thread::sleep_for\(std::chrono::milliseconds\(2000\)\);/, /std::this_thread::sleep_for\(std::chrono::milliseconds\(500\)\);/, /std::this_thread::sleep_for\(std::chrono::duration<double>\(t\)\);/]],
];

CASES.forEach(([what, kind, text, codes, errors = [], noteText]) => {
  test(`as people type it, ${kind === 'arduino' ? 'Arduino' : 'C++'}: ${what}`, () => {
    const r = write(kind, text);
    assert.deepEqual(errs(r), errors, r.text);
    for (const re of codes) assert.match(r.text, re);
    if (noteText) assert.ok(notes(r).includes(noteText), `no note "${noteText}":\n${notes(r).join('\n')}`);
    if (!errors.length) {
      assert.deepEqual(warns(r).filter(w => /hasn't been set/.test(w)), [], r.text);
      if (kind === 'cpp') parses(r);
    }
  });
});

test('as people type it: none of this changes what the reader says, and its own names come back as they are', () => {
  const r = convert('arduino', 'const int ledPin = 13;\nunsigned long lastBlink = 0;\nint total = 1000;\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\nvoid loop() {\n  if (millis() - lastBlink >= 500) {\n    lastBlink = millis();\n    digitalWrite(ledPin, HIGH);\n  }\n  delay(n * 1000);\n}\n');
  assert.equal(r.exact, true, r.reason);
  assert.match(r.text, /^constant ledPin is 13$/m);
  // code that C++ reads differently from the sentence (010 is octal) is kept as code, exactly
  const oct = convert('cpp', '#include <iostream>\nint main() {\n    int mode = 0755;\n    std::cout << mode << std::endl;\n    return 0;\n}\n');
  assert.equal(oct.exact, true, oct.reason);
  assert.match(oct.text, /^c\+\+: int mode = 0755;$/m);
});

test('as people type it: a C++ program\'s wait reads back as a sentence', () => {
  const r = convert('cpp', '#include <iostream>\n#include <chrono>\n#include <thread>\nint main() {\n    int pause = 200;\n    std::this_thread::sleep_for(std::chrono::milliseconds(500));\n    std::this_thread::sleep_for(std::chrono::milliseconds(pause));\n    return 0;\n}\n');
  assert.equal(r.exact, true, r.reason);
  assert.equal(r.kept, 0, r.text);
  assert.match(r.text, /^wait 500 milliseconds\nwait pause milliseconds$/m);
});
