"""IntuaCode reader: turns existing Python into sections, sentences and plain-English summaries.

Everything here is rules on top of Python's own parser (the `ast` module). No AI:
the same code always gives the same summary, and every statement in a summary
can be traced back to the lines it came from.

Main entry points (all return JSON-ready dicts):
    analyze(files)                  -> sections + summaries for each file
    summarise(source, start, end)   -> summary of the statements between two lines
    to_sentences(source)            -> the whole file as IntuaCode sentences (exact where possible)

Run this file directly:  python3 python_reader.py summary FILE | sentences FILE | project FOLDER
"""
import ast
import json
import re
import sys

# --------------------------------------------------------------------------
# What common libraries are for, in plain words
# --------------------------------------------------------------------------

LIBRARIES = {
    "random": "picks random values", "math": "does maths", "time": "deals with time and pauses",
    "datetime": "works with dates and times", "os": "works with files, folders and settings on the computer",
    "sys": "talks to the running Python program", "json": "reads and writes JSON data",
    "csv": "reads and writes spreadsheet-style CSV files", "re": "searches text using patterns",
    "requests": "talks to websites and web APIs over the internet", "urllib": "talks to the internet",
    "httpx": "talks to websites and web APIs over the internet", "aiohttp": "talks to the internet without waiting",
    "flask": "runs a web server", "fastapi": "runs a web API server", "django": "runs a web app",
    "uvicorn": "starts a web server", "sqlite3": "stores data in a database file",
    "sqlalchemy": "works with databases", "psycopg2": "talks to a PostgreSQL database",
    "pymongo": "talks to a MongoDB database", "redis": "talks to a Redis data store",
    "pandas": "works with tables of data", "numpy": "does fast maths on lots of numbers",
    "matplotlib": "draws charts", "seaborn": "draws charts", "plotly": "draws interactive charts",
    "tkinter": "shows desktop windows and buttons", "pygame": "makes games with graphics and sound",
    "openai": "calls an AI model", "anthropic": "calls an AI model", "dotenv": "loads secret settings from a .env file",
    "logging": "writes log messages", "subprocess": "runs other programs", "threading": "does several things at once",
    "asyncio": "runs tasks that wait without blocking", "pathlib": "works with file paths",
    "typing": "describes what kinds of values are expected (no effect when running)",
    "dataclasses": "makes simple classes that hold data", "collections": "provides extra list and dictionary types",
    "itertools": "provides tools for looping", "functools": "provides tools for functions",
    "argparse": "reads options typed on the command line", "smtplib": "sends email",
    "hashlib": "makes fingerprints (hashes) of data", "uuid": "makes unique IDs", "shutil": "copies, moves and deletes files",
    "glob": "finds files by name pattern", "pickle": "saves Python objects to files", "bs4": "reads web pages (HTML)",
    "selenium": "controls a web browser", "playwright": "controls a web browser", "PIL": "opens and edits images",
    "cv2": "works with images and video", "torch": "does machine learning", "tensorflow": "does machine learning",
    "sklearn": "does machine learning", "boto3": "talks to Amazon Web Services", "stripe": "takes payments",
    "discord": "runs a Discord bot", "telegram": "runs a Telegram bot", "streamlit": "makes a data web app",
    "pydantic": "checks that data has the right shape", "jwt": "makes and checks login tokens",
    "bcrypt": "scrambles passwords safely", "yaml": "reads and writes YAML settings files", "click": "builds command-line tools",
    "rich": "prints coloured text in the terminal", "tqdm": "shows progress bars", "schedule": "runs jobs on a timetable",
    "socket": "sends data over the network", "email": "builds email messages", "base64": "encodes data as text",
    "io": "treats text or bytes like files", "copy": "copies values", "string": "provides letters and digits",
    "statistics": "calculates averages and other statistics", "decimal": "does exact decimal maths",
    "enum": "defines fixed sets of named choices", "abc": "defines templates for classes", "contextlib": "helps with 'with' blocks",
    "traceback": "shows details of errors", "unittest": "tests code", "pytest": "tests code",
}

# Words the sentence translator swaps. A Python name that is one of these can't
# safely appear inside a sentence, so statements using it stay as raw Python.
SENTENCE_WORDS = {
    "is", "not", "and", "or", "plus", "minus", "times", "mod", "modulo", "yes", "no", "true", "false", "none",
    "nothing", "the", "squared", "cubed", "contains", "equals", "sorted", "rounded", "divided", "multiplied",
    "added", "joined", "followed", "empty", "item", "to", "of", "in", "as", "by", "from", "with",
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "twenty", "fifty", "hundred",
    # filler and step words the sentence reader leaves out or splits on
    "please", "kindly", "just", "simply", "basically", "really", "actually", "quickly", "then", "afterwards",
    "thanks", "do",
    # words of phrases that follow their value ("name trimmed", "line split at ","): a name like these could be read as one
    "trimmed", "split", "replaced", "starts", "ends", "taken",
}

MAX_STEPS = 16

# While a project is being read, these say what the current file can see from other files.
_XREF = {"names": {}, "modules": {}, "roots": set(), "path": ""}
_USES = []        # (from_path, to_path, name) found while reading
_PROJECT = {}     # path -> {"xref": ...} for summarising a highlight later


class Unwordable(Exception):
    """This expression can't be written as sentence words without changing its meaning."""


# --------------------------------------------------------------------------
# Expressions -> sentence words
# --------------------------------------------------------------------------

def q(s):
    """A Python string as a double-quoted sentence string."""
    if '"' in s or "\\" in s or "\n" in s or "{" in s or "}" in s:
        raise Unwordable()
    return '"' + s + '"'


def name_ok(n):
    return n.lower() not in SENTENCE_WORDS


_STR = re.compile(r"""[rRbBuUfF]{0,2}(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')""")
# Phrases the sentence translator would rewrite if they appeared in plain code.
_TRIGGERS = re.compile(
    r"\b(the|is|plus|minus|times|mod|modulo|otherwise|then|afterwards|squared|cubed|rounded|contains|equals|"
    r"divided by|multiplied by|added to|joined (?:with|to)|followed by|to the power of|length of|size of|sum of|total of|"
    r"how many|number of items|item \S+ (?:of|in|from)|first item|last item|pairs (?:of|in)|as (?:a )?(?:whole )?number|"
    r"as (?:a )?decimal|as text|in (?:capitals|capital letters|uppercase|upper case|lowercase|lower case|small letters)|"
    r"is (?:even|odd)|random (?:whole )?number|random (?:item|choice|one|pick|thing|decimal|fraction)|"
    r"(?:biggest|largest|highest|maximum|max|smallest|lowest|minimum|min) (?:of|in)|square root|absolute|sorted \S|"
    r"empty (?:list|text|dictionary|set)|wait for|yes|no|please|kindly|just|simply|basically|really|actually|quickly|"
    r"split (?:into|at)|joined by|replaced by|(?:starts?|ends?) with|all (?:letters|digits)|taken out of|"
    r"environment variable|file or folder|json (?:read|sent)|read as json|as (?:an? )?json|sorted (?:by|biggest)|"
    r"for (?:each|every|any)|(?:list|set|dictionary) of|"
    r"zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|fifty|hundred)\b", re.I)


def safe_code(e):
    """Can this expression sit, as plain Python, inside a sentence and come back unchanged?"""
    for n in ast.walk(e):
        if isinstance(n, ast.Name) and not name_ok(n.id):
            return False
        if isinstance(n, ast.Compare) and any(isinstance(o, (ast.Is, ast.IsNot)) for o in n.ops):
            return False
    text = ast.unparse(e)
    if "\n" in text or ";" in text:
        return False
    bare = _STR.sub("''", text)
    if '"' in bare:
        return False
    # in "double quotes", {…} fills in a value (and {{ }} are braces), so braces there aren't plain text
    if re.search(r'(?<![\w\'])"(?:[^"\\]|\\.)*[{}]', re.sub(r"(?<![\w\"])'(?:[^'\\]|\\.)*'", "''", text)):
        return False
    return not _TRIGGERS.search(bare)


def top_level_split(text):
    """Would the sentence translator split this at a comma or ' and '? (Outside brackets and quotes.)"""
    bare = _STR.sub("''", text)
    depth = 0
    for i, c in enumerate(bare):
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif depth == 0 and (c == "," or bare.startswith(" and ", i)):
            return True
    return False


def has_word(text, *words):
    """Does one of these words appear outside quotes? The sentence translator would split there."""
    bare = _STR.sub("''", text)
    return re.search(r"\s(?:%s)\s" % "|".join(words), bare, re.I) is not None


def string_lines(text):
    """Line numbers (from 1) that carry on a string started on an earlier line."""
    import io
    import tokenize
    inside, starts = set(), []
    try:
        for tok in tokenize.generate_tokens(io.StringIO(text).readline):
            if tok.type == tokenize.STRING and tok.end[0] > tok.start[0]:
                inside.update(range(tok.start[0] + 1, tok.end[0] + 1))
            elif tok.type == getattr(tokenize, "FSTRING_START", -1):
                starts.append(tok.start[0])
            elif tok.type == getattr(tokenize, "FSTRING_END", -1) and starts:
                inside.update(range(starts.pop() + 1, tok.end[0] + 1))
    except (tokenize.TokenError, SyntaxError):
        pass
    return inside


def code_lines(text, level):
    """Python code as python: lines. A line that carries on a multi-line string is kept exactly
    as it is after "python: ", because its spaces are part of the text."""
    pad = "    " * level
    inside = string_lines(text)
    out, here = [], pad
    for n, line in enumerate(text.split("\n"), 1):
        if n in inside:
            out.append(here + ("python: " + line if line else "python:"))
        elif line.strip():
            here = pad + "    " * ((len(line) - len(line.lstrip())) // 4)
            out.append(here + "python: " + (line.lstrip() if n + 1 in inside else line.strip()))
    return out


def described(node, level):
    """A docstring as description: lines that rebuild exactly the same text, or None if they can't.
    The lines under the first are written at the docstring's own indentation; an empty last line
    is the closing quotes on a line of their own."""
    c = node.value
    s = c.value
    if c.kind is not None or "\\" in s or '"""' in s or s.endswith('"') or re.search(r"[\t\r\f\v]", s):
        return None
    pad = "    " * level
    parts = s.split("\n")
    out = []
    for i, line in enumerate(parts):
        last = i == len(parts) - 1
        if i == 0:
            text = line
        elif last and line == pad:
            text = ""
        elif line == "" and not last:
            text = ""
        elif line.startswith(pad) and line[len(pad):]:
            text = line[len(pad):]
        else:
            return None
        if text != text.rstrip():
            return None
        out.append(pad + ("description: " + text if text else "description:"))
    return out


def one_operand(text):
    """Is this one operand for the sentence translator: a text, a number, a name or a bracketed group, then
    any .names, calls and indexes (a.b(c)[d]), with no space outside brackets?"""
    s = _STR.sub("''", text)
    n = len(s)

    def group(i):
        d = 0
        for j in range(i, n):
            if s[j] in "([{":
                d += 1
            elif s[j] in ")]}":
                d -= 1
                if d == 0:
                    return j + 1
        return -1
    m = re.match(r"''|-?\d+(?:\.\d+)?(?![\w.])|[A-Za-z_]\w*", s)
    if m:
        i = m.end()
    elif s[:1] in ("(", "[", "{"):
        i = group(0)
    else:
        return False
    while 0 < i < n:
        m = re.match(r"\.[A-Za-z_]\w*", s[i:])
        if m:
            i += m.end()
        elif s[i] in "([":
            i = group(i)
        else:
            return False
    return i == n


def and_list(items):
    """["a"] -> a; ["a", "b"] -> a and b; ["a", "b", "c"] -> a, b and c."""
    items = list(items)
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def dotted_name(e):
    """a / a.b / a.b.c -> the text, else None."""
    parts = []
    while isinstance(e, ast.Attribute):
        parts.append(e.attr)
        e = e.value
    if isinstance(e, ast.Name):
        return ".".join([e.id] + parts[::-1])
    return None


class Words:
    """Turns expressions into words. strict=True refuses anything that might not round-trip exactly;
    `expr` then falls back to plain Python inside the sentence when that is safe."""

    # what web frameworks and os keep as dictionaries: request.args.get(…) is a lookup, session.get(url) isn't
    DICT_ATTRS = re.compile(r"(?:^|\.)(?:args|form|headers|cookies|values|files|environ|json|data|params|query_params|config|settings|kwargs|options|meta|attrs)$")

    def __init__(self, strict, tools=(), lists=(), alias=None, modules=(), dicts=(), texts=(), imported=()):
        self.strict = strict
        self.tools = set(tools)
        self.lists = set(lists)
        self.alias = alias or {}          # name -> the module it comes from
        self.modules = set(modules)       # modules imported under their own name (import os), so phrases can use them
        self.dicts = set(dicts)           # names (and a.b) set to a dictionary somewhere in the file
        self.texts = set(texts)           # names set to text somewhere in the file (sep = ", ")
        self.imported = set(imported)     # names bound by import: a module's own tools (os.remove) aren't list tools

    def is_dict(self, e):
        d = dotted_name(e)
        return bool(d) and (d in self.dicts or (self.DICT_ATTRS.search(d) is not None and d.split(".")[0] not in self.imported) or d == "os.environ")

    def of_module(self, e):
        d = dotted_name(e)
        return bool(d) and d.split(".")[0] in self.imported and d != "os.environ"

    def sub(self, e):
        return self.w(e, False)

    def opd(self, e):
        """e as one operand of a phrase ("item K of D", "X trimmed"): its words when they are one operand, else
        its code when that is, else its words in brackets."""
        try:
            text = self.sub(e)
        except Unwordable:
            text = None
        if text is not None and one_operand(text):
            return text
        try:
            code_ = self.raw(e)
        except Unwordable:
            code_ = None
        # a phrase reads better than its code: (title split into words) joined by " "
        if code_ is not None and one_operand(code_) and (text is None or text == code_ or not self.strict):
            return code_
        if text is None or not self.strict:
            raise Unwordable()
        return f"({text})"

    def comp(self, e):
        """A comprehension's parts in words: (what, names, source, test)."""
        if len(e.generators) != 1:
            raise Unwordable()
        g = e.generators[0]
        if g.is_async or len(g.ifs) > 1:
            raise Unwordable()
        t = g.target
        names = [t.id] if isinstance(t, ast.Name) else \
            [x.id for x in t.elts] if isinstance(t, ast.Tuple) and t.elts and all(isinstance(x, ast.Name) for x in t.elts) else None
        if not names or not all(name_ok(x) for x in names):
            raise Unwordable()
        what = f"{self.sub(e.key)}: {self.sub(e.value)}" if isinstance(e, ast.DictComp) else self.sub(e.elt)
        source = self.sub(g.iter)
        test = self.sub(g.ifs[0]) if g.ifs else None
        # the parts can't hold another "for each" outside brackets, the source no "if" (Python needs brackets there too)
        for part in (what, source, test or ""):
            if re.search(r"\sfor (?:each|every|any)\s", _STR.sub("''", part)):
                raise Unwordable()
        if re.search(r"\sif\s", _STR.sub("''", source)) and not one_operand(source):
            raise Unwordable()
        return what, ", ".join(names), source, test

    def comprehension(self, e, top, lead="", kind="each"):
        what, names, source, test = self.comp(e)
        text = f"{lead}{what} for {kind} {names} in {source}" + (f" if {test}" if test else "")
        return text if top else f"({text})"

    def raw(self, e):
        if self.strict and not safe_code(e):
            raise Unwordable()
        return ast.unparse(e)

    def expr(self, e):
        try:
            return self.w(e)
        except Unwordable:
            return self.raw(e)

    def w(self, e, top=True):
        if isinstance(e, ast.Constant):
            v = e.value
            if v is True:
                return "yes"
            if v is False:
                return "no"
            if v is None:
                return "nothing"
            if isinstance(v, str):
                if '"' in v or "\\" in v or "\n" in v or "{" in v or "}" in v:
                    return self.raw(e)
                return '"' + v + '"'
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                if v < 0:
                    return self.raw(e)
                return repr(v)
            return self.raw(e)
        if isinstance(e, ast.Name):
            if not name_ok(e.id) and self.strict:
                raise Unwordable()
            return e.id
        if isinstance(e, ast.BinOp):
            ops = {ast.Add: "plus", ast.Sub: "minus", ast.Mult: "times", ast.Div: "divided by", ast.Mod: "mod"}
            if isinstance(e.op, ast.Pow) and isinstance(e.right, ast.Constant) and e.right.value == 2:
                return f"{self.wrap(e.left)} squared"
            if isinstance(e.op, ast.Pow):
                return f"{self.wrap(e.left)} to the power of {self.right(e.right)}"
            word = ops.get(type(e.op))
            if not word:
                return self.raw(e)
            left = self.w(e.left, False) if self._chain(e.left, e.op) else self.wrap(e.left)
            return f"{left} {word} {self.right(e.right)}"
        if isinstance(e, ast.UnaryOp):
            if isinstance(e.op, ast.Not):
                c = e.operand
                # "not x.startswith(p)" -> "x doesn't start with p"; "not os.path.exists(p)" -> "there is no file or folder at p"
                if isinstance(c, ast.Call) and not c.keywords and self.strict:
                    f, a = c.func, c.args
                    if dotted_name(f) == "os.path.exists" and "os" in self.modules and len(a) == 1:
                        return f"there is no file or folder at {self.opd(a[0])}"
                    if isinstance(f, ast.Attribute) and f.attr in ("startswith", "endswith") and len(a) == 1:
                        return f"{self.opd(f.value)} doesn't {f.attr[:-5]} with {self.opd(a[0])}"
                    if isinstance(f, ast.Attribute) and f.attr in self.ALL and not a:
                        return f"{self.opd(f.value)} is not all {self.ALL[f.attr]}"
                return f"not {self.tight(e.operand)}"
            return self.raw(e)
        if isinstance(e, ast.BoolOp):
            word = " and " if isinstance(e.op, ast.And) else " or "
            # "x is 1 or 2" is read as x == 1 or x == 2, so a bare value after a comparison stays code
            if self.strict and any(isinstance(b, ast.Constant) and isinstance(a, ast.Compare) for a, b in zip(e.values, e.values[1:])):
                raise Unwordable()
            return word.join(self.tight(v) for v in e.values)
        if isinstance(e, ast.Compare):
            if len(e.ops) != 1:
                return self.raw(e)
            op = type(e.ops[0])
            right = e.comparators[0]
            if op in (ast.Is, ast.IsNot):
                if isinstance(right, ast.Constant) and right.value is None:
                    return f"{self.wrap(e.left)} {'is' if op is ast.Is else 'is not'} nothing"
                raise Unwordable()
            words = {ast.Eq: "is", ast.NotEq: "is not", ast.Lt: "is less than", ast.Gt: "is more than",
                     ast.LtE: "is at most", ast.GtE: "is at least", ast.In: "is in", ast.NotIn: "is not in"}
            return f"{self.wrap(e.left)} {words[op]} {self.wrap(right)}"
        if isinstance(e, ast.IfExp):
            # comparisons, not, and, or all bind tighter than … if … else …, so they need no brackets there
            loose = lambda x: self.sub(x) if self.strict and isinstance(x, (ast.Compare, ast.BoolOp, ast.UnaryOp)) and not isinstance(x, ast.IfExp) else self.wrap(x)
            return f"{loose(e.body)} if {loose(e.test)} otherwise {loose(e.orelse)}"
        if isinstance(e, ast.Await):
            return f"wait for {self.expr(e.value)}"
        if isinstance(e, ast.Call):
            return self.call(e, top)
        if isinstance(e, ast.Subscript) and not isinstance(e.slice, ast.Slice):
            coll = self.simple(e.value)
            s = e.slice
            if isinstance(s, ast.Constant) and s.value == 0:
                return f"first item of {coll}"
            if isinstance(s, ast.UnaryOp) and isinstance(s.op, ast.USub) and isinstance(s.operand, ast.Constant) and s.operand.value == 1:
                return f"last item of {coll}"
            if isinstance(s, (ast.Constant, ast.Name)):
                return f"item {self.sub(s)} of {coll}"
            return self.raw(e)
        # lists, tuples and dictionaries written out: their values said the sentence way ("text", yes, nothing)
        if self.strict and isinstance(e, (ast.List, ast.Tuple, ast.Set, ast.Dict)):
            def item(x):
                if x is None or isinstance(x, ast.Starred):
                    raise Unwordable()
                try:
                    text = self.sub(x)
                    if one_operand(text):
                        return text
                except Unwordable:
                    pass
                text = self.raw(x)
                if not one_operand(text):
                    raise Unwordable()
                return text
            try:
                if isinstance(e, ast.Dict):
                    return "{" + ", ".join(f"{item(k)}: {item(v)}" for k, v in zip(e.keys, e.values)) + "}"
                parts = [item(x) for x in e.elts]
                if isinstance(e, ast.Set) and parts:
                    return "{" + ", ".join(parts) + "}"
                if isinstance(e, ast.Tuple) and len(parts) > 1:
                    return "(" + ", ".join(parts) + ")"
                if isinstance(e, ast.List):
                    return "[" + ", ".join(parts) + "]"
            except Unwordable:
                pass
            return self.raw(e)
        if self.strict and isinstance(e, ast.ListComp):
            return self.comprehension(e, top, "a list of ")
        if self.strict and isinstance(e, ast.SetComp):
            return self.comprehension(e, top, "a set of ")
        if self.strict and isinstance(e, ast.DictComp):
            return self.comprehension(e, top, "a dictionary of ")
        if self.strict and isinstance(e, ast.GeneratorExp):
            return self.comprehension(e, False)
        if isinstance(e, ast.JoinedStr):
            parts = []
            for v in e.values:
                if isinstance(v, ast.Constant):
                    if any(c in v.value for c in '"{}\n\\'):
                        return self.raw(e)
                    parts.append(v.value)
                elif isinstance(v, ast.FormattedValue):
                    if v.conversion != -1:
                        return self.raw(e)
                    inner = ast.unparse(v.value)
                    if self.strict and not re.fullmatch(r"[A-Za-z_]\w*", inner):
                        # {self.owner}, {attempt plus 1}: the value said in words, or as code when the words can't sit in text
                        try:
                            said = self.sub(v.value)
                        except Unwordable:
                            said = None
                        bad = re.compile(r'["{}:\n\\]|^\s|\s$')
                        if said is not None and not bad.search(said):
                            inner = said
                        elif bad.search(inner) or not safe_code(v.value):
                            return self.raw(e)
                    elif not re.fullmatch(r"[A-Za-z_]\w*", inner) or not name_ok(inner):
                        return self.raw(e)
                    spec = ""
                    if v.format_spec is not None:
                        fs = v.format_spec
                        if not (isinstance(fs, ast.JoinedStr) and all(isinstance(x, ast.Constant) for x in fs.values)):
                            return self.raw(e)
                        spec = ":" + "".join(x.value for x in fs.values)
                        if re.search(r'["{}\n\\\s]', spec):
                            return self.raw(e)
                    parts.append("{" + inner + spec + "}")
            return '"' + "".join(parts) + '"'
        return self.raw(e)

    def _chain(self, left, op):
        return isinstance(left, ast.BinOp) and type(left.op) is type(op) and type(op) in (ast.Add, ast.Mult)

    # Words that follow their value ("qty as text"). After "times" they would read as being about the whole
    # calculation ("price times qty as text"), so a value said that way stays as code on the right of one.
    POSTFIX = re.compile(r" (?:as (?:number|decimal|text|JSON text|a JSON reply)|in (?:capitals|lowercase)|rounded(?: to .*)?|"
                         r"trimmed|split into words|split at .*|joined by .*|replaced by .*|starts with .*|ends with .*|"
                         r"start with .*|end with .*|is (?:not )?all .*|read as JSON|sorted by .*|sorted biggest first)$")

    def right(self, e):
        text = self.wrap(e)
        if isinstance(e, ast.Call) and self.POSTFIX.search(text):
            return self.raw(e)
        return text

    def tight(self, e):
        """An operand of not / and / or: a comparison binds tighter than those, so it needs no brackets."""
        if self.strict and isinstance(e, ast.Compare):
            return self.sub(e)
        return self.wrap(e)

    def wrap(self, e):
        text = self.w(e, False)
        if isinstance(e, (ast.BinOp, ast.BoolOp, ast.Compare, ast.IfExp)):
            if self.strict:
                raise Unwordable()
            return f"({text})"
        return text

    def simple(self, e):
        if isinstance(e, ast.Name):
            return self.w(e)
        return self.raw(e)

    ALL = {"isalpha": "letters", "isdigit": "digits", "isalnum": "letters or digits"}

    def call(self, e, top=True):
        f = e.func
        fname = ast.unparse(f)
        args = e.args
        one = len(args) == 1
        if any(k.arg is None for k in e.keywords) or any(isinstance(a, ast.Starred) for a in args):
            return self.raw(e)
        kws = [k.arg for k in e.keywords]
        if self.strict and fname == "sorted" and one and kws in ([], ["key"], ["reverse"], ["key", "reverse"]):
            kw = {k.arg: k.value for k in e.keywords}
            rev = kw.get("reverse")
            if rev is not None and not (isinstance(rev, ast.Constant) and rev.value is True):
                return self.raw(e)
            what = self.opd(args[0])
            if "key" in kw:
                return f"{what} sorted by {self.opd(kw['key'])}" + (" biggest first" if rev is not None else "")
            return f"{what} sorted biggest first" if rev is not None else f"sorted {what}"
        if e.keywords:
            return self.raw(e)
        if fname == "len" and one:
            return f"length of {self.simple(args[0])}"
        if fname in ("int", "float", "str") and one and (isinstance(args[0], ast.Name) or self.strict):
            word = {"int": "number", "float": "decimal", "str": "text"}[fname]
            what = self.w(args[0]) if isinstance(args[0], ast.Name) else self.opd(args[0])
            return f"{what} as {word}"
        if fname == "sum" and one:
            return f"sum of {self.simple(args[0])}"
        if fname == "max" and one:
            return f"biggest in {self.simple(args[0])}"
        if fname == "min" and one:
            return f"smallest in {self.simple(args[0])}"
        if fname == "random.randint" and len(args) == 2 and all(isinstance(a, (ast.Constant, ast.Name)) for a in args):
            return f"random number from {self.w(args[0])} to {self.w(args[1])}"
        if fname == "random.randint" and len(args) == 2 and self.strict:
            return f"random number from {self.opd(args[0])} to {self.opd(args[1])}"
        if fname == "random.choice" and one:
            return f"random item from {self.simple(args[0])}"
        if fname == "math.sqrt" and one and isinstance(args[0], (ast.Constant, ast.Name)):
            return f"square root of {self.w(args[0])}"
        if isinstance(f, ast.Attribute) and not args and isinstance(f.value, ast.Name) and name_ok(f.value.id):
            if f.attr in ("upper", "lower"):
                return f"{self.w(f.value)} in {'capitals' if f.attr == 'upper' else 'lowercase'}"
            if f.attr == "items":
                return f"pairs of {self.w(f.value)}"
        if not self.strict:
            return self.raw(e)
        return self.more_calls(e, f, fname, args, top)

    def more_calls(self, e, f, fname, args, top):
        """Phrases for more of Python's and the libraries' own tools (strict reading only)."""
        n = len(args)
        if fname == "round" and n == 1:
            return f"{self.opd(args[0])} rounded"
        if fname == "round" and n == 2 and isinstance(args[1], ast.Constant) and type(args[1].value) is int and args[1].value >= 0:
            return f"{self.opd(args[0])} rounded to {args[1].value} place{'' if args[1].value == 1 else 's'}"
        if fname == "abs" and n == 1:
            return f"absolute value of {self.opd(args[0])}"
        if fname == "set" and n == 0:
            return "an empty set"
        if fname == "random.random" and n == 0 and "random" in self.modules:
            return "a random decimal"
        if fname in ("all", "any") and n == 1 and isinstance(args[0], ast.GeneratorExp):
            return self.comprehension(args[0], top, "", "every" if fname == "all" else "any")
        if fname == "os.getenv" and n in (1, 2) and "os" in self.modules:
            text = f"the environment variable {self.opd(args[0])}"
            return text + (f" or {self.opd(args[1])} if there isn't one" if n == 2 else "")
        if fname == "os.path.exists" and n == 1 and "os" in self.modules:
            return f"there is a file or folder at {self.opd(args[0])}"
        if fname == "json.load" and n == 1 and "json" in self.modules:
            return f"the JSON read from {self.opd(args[0])}"
        if fname == "json.loads" and n == 1 and "json" in self.modules:
            return f"{self.opd(args[0])} read as JSON"
        if fname == "json.dumps" and n == 1 and "json" in self.modules:
            return f"{self.opd(args[0])} as JSON text"
        if fname == "jsonify" and n == 1 and self.alias.get("jsonify") == "flask":
            return f"{self.opd(args[0])} as a JSON reply"
        if not isinstance(f, ast.Attribute) or self.of_module(f.value):
            return self.raw(e)
        what, m = f.value, f.attr
        if m == "get" and not self.is_dict(what):
            return self.raw(e)   # session.get(url) fetches a page; only a dictionary's get looks an item up
        if m == "join" and not ((isinstance(what, ast.Constant) and isinstance(what.value, str)) or dotted_name(what) in self.texts):
            return self.raw(e)   # thread.join(5) waits for a thread; text.join(items) joins
        if m == "get" and n in (1, 2):
            text = f"item {self.opd(args[0])} of {self.opd(what)}"
            return text + (f" or {self.opd(args[1])} if there isn't one" if n == 2 else " if there is one")
        if m == "pop" and n == 0:
            return f"the last item taken out of {self.opd(what)}"
        if m == "pop" and n == 1:
            return f"item {self.opd(args[0])} taken out of {self.opd(what)}"
        if m == "get_json" and n == 0:
            obj = self.opd(what)
            return f"the JSON sent with {'the request' if obj == 'request' else obj}"
        if m == "join" and n == 1:
            return f"{self.opd(args[0])} joined by {self.opd(what)}"
        if m == "strip" and n == 0:
            return f"{self.opd(what)} trimmed"
        if m == "split" and n == 0:
            return f"{self.opd(what)} split into words"
        if m == "split" and n == 1:
            return f"{self.opd(what)} split at {self.opd(args[0])}"
        if m == "replace" and n == 2:
            return f"{self.opd(what)} with {self.opd(args[0])} replaced by {self.opd(args[1])}"
        if m in ("startswith", "endswith") and n == 1:
            return f"{self.opd(what)} {m[:-4]} with {self.opd(args[0])}"
        if m in self.ALL and n == 0:
            return f"{self.opd(what)} is all {self.ALL[m]}"
        if m in ("upper", "lower") and n == 0:
            return f"{self.opd(what)} in {'capitals' if m == 'upper' else 'lowercase'}"
        if m == "items" and n == 0:
            return f"pairs of {self.opd(what)}"
        return self.raw(e)


# --------------------------------------------------------------------------
# Statements -> sentences
# --------------------------------------------------------------------------

HTTP_METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH"}


class Sentences:
    """Writes statements as IntuaCode sentences. Anything that can't be said exactly becomes a `python:` line."""

    def __init__(self, strict, tools=(), lists=(), known=(), comments=None, force_raw=(), classes=(), alias=None, modules=(), sets=(),
                 dicts=(), texts=(), imported=()):
        self.strict = strict
        self.classes = set(classes)
        self.alias = alias or {}
        self.modules = set(modules)
        self.sets = set(sets)   # names that hold a set (x = set()), so x.add(v) is "add v to the set x"
        self.words = Words(strict, tools, lists, self.alias, self.modules, dicts, texts, imported)
        self.tools = set(tools)
        self.lists = set(lists)
        self.known = set(tools) | set(known) | BUILTIN_CALLS
        self.comments = comments or {}
        self.force_raw = set(force_raw)
        self.last = 0

    def notes_before(self, line, level):
        """Full-line comments between the previous statement and this line, as notes."""
        out = []
        for ln in sorted(k for k in self.comments if self.last < k < line):
            out.append("    " * level + "note: " + self.comments[ln])
        if out:
            self.last = max(k for k in self.comments if self.last < k < line)
        return out

    def block(self, body, level):
        out = []
        for i, node in enumerate(body):
            out.extend(self.notes_before(start_line(node), level))
            if i == 0 and is_docstring(node):
                out.extend(self.docstring(node, level))
            else:
                out.extend(self.stmt(node, level))
            self.last = max(self.last, getattr(node, "end_lineno", node.lineno))
        return out

    def docstring(self, node, level):
        """Kept exactly: as description: lines, or as one python: line when those can't say it."""
        if level == 0 and node.lineno in self.force_raw:
            return self.raw_lines(node, level)
        return described(node, level) or self.raw_lines(node, level)

    def raw_lines(self, node, level):
        return code_lines(ast.unparse(node), level)

    def say(self, level, text):
        return ["    " * level + text]

    def stmt(self, n, level):
        if level == 0 and hasattr(n, "lineno") and (n.lineno in self.force_raw or start_line(n) in self.force_raw):
            return self.raw_lines(n, level)
        try:
            return self._stmt(n, level)
        except Unwordable:
            return self.raw_lines(n, level)

    # -- pieces ---------------------------------------------------------------
    def E(self, e):
        return self.words.expr(e)

    def arg(self, e):
        text = self.E(e)
        if top_level_split(text) or isinstance(e, (ast.BoolOp,)):
            raise Unwordable()
        return text

    def args(self, call):
        parts = [self.arg(a) for a in call.args]
        for k in call.keywords:
            if k.arg is None:
                raise Unwordable()
            parts.append(f"{k.arg}={self.arg(k.value)}")
        return and_list(parts) if parts else ""

    def target(self, t):
        """Something that can be set or increased: name, a.b, or item k of name (or of a.b)."""
        if isinstance(t, ast.Name):
            if not name_ok(t.id):
                raise Unwordable()
            return t.id
        d = dotted_name(t)
        if d and isinstance(t, ast.Attribute):
            return d
        coll = dotted_name(t.value) if isinstance(t, ast.Subscript) else None
        if coll and all(name_ok(p) for p in coll.split(".")) \
                and isinstance(t.slice, (ast.Constant, ast.Name)) and not isinstance(t.slice, ast.Slice):
            return f"item {self.words.w(t.slice)} of {coll}"
        raise Unwordable()

    def value(self, v, calls=True):
        """A value to store, in words: a phrase when one fits ("a random item from WORDS"), a call as
        "a new Flask with __name__" or "the result of get_db" (calls: only "set … to" reads those), else the value
        as it reads."""
        if self.strict and isinstance(v, ast.Call) and not isinstance(v.func, ast.Lambda):
            try:
                text = self.words.w(v)
                if text != ast.unparse(v):
                    return text
            except Unwordable:
                pass
            if calls:
                try:
                    return self.call_value(v)
                except Unwordable:
                    pass
        return self.E(v)

    def is_class(self, name):
        last = name.split(".")[-1]
        return name in self.classes or (re.match(r"_*[A-Z]", last) is not None and re.search(r"[a-z]", last) is not None)

    def call_value(self, v):
        name = self.callable_name(v.func)
        if name in BUILTIN_CALLS:   # list(…), dict(…), enumerate(…) read better as they are
            raise Unwordable()
        args = self.args(v)
        lead = "a new" if self.is_class(name) else "the result of"
        return f"{lead} {name}" + (f" with {args}" if args else "")

    def callable_name(self, f):
        """Only name calls the translator will accept: known tools, imports, builtins, or dotted names."""
        d = dotted_name(f)
        if d is None:
            raise Unwordable()
        if "." not in d and d not in self.known and self.strict:
            raise Unwordable()
        return d

    def decorator(self, d, level):
        if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr.upper() in HTTP_METHODS \
                and d.func.attr.islower() and dotted_name(d.func.value) and len(d.args) == 1 \
                and isinstance(d.args[0], ast.Constant) and isinstance(d.args[0].value, str) and '"' not in d.args[0].value:
            extra = ", ".join(f"{k.arg}={self.arg(k.value)}" for k in d.keywords if k.arg)
            if len(extra.split(", ")) != len(d.keywords) and d.keywords:
                raise Unwordable()
            return self.say(level, f'when {dotted_name(d.func.value)} handles {d.func.attr.upper()} at "{d.args[0].value}"' + (f" with {extra}" if extra else ""))
        if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr == "route" \
                and dotted_name(d.func.value) and len(d.args) == 1 and isinstance(d.args[0], ast.Constant) \
                and isinstance(d.args[0].value, str) and '"' not in d.args[0].value:
            kws = {k.arg: k.value for k in d.keywords}
            if set(kws) <= {"methods"}:
                methods = None
                if "methods" in kws:
                    m = kws["methods"]
                    if isinstance(m, ast.List) and m.elts and all(isinstance(x, ast.Constant) and x.value in HTTP_METHODS for x in m.elts):
                        methods = [x.value for x in m.elts]
                    else:
                        raise Unwordable()
                what = " and ".join(methods) if methods else "a request"
                return self.say(level, f'when {dotted_name(d.func.value)} gets {what} at "{d.args[0].value}"')
        return self.say(level, f"decorate with {self.E(d)}")

    # -- statements -----------------------------------------------------------
    def _stmt(self, n, level):
        E, S = self.E, self.say
        if isinstance(n, ast.Assign) and len(n.targets) == 1:
            t, v = n.targets[0], n.value
            if isinstance(t, ast.Name):
                if not name_ok(t.id):
                    raise Unwordable()
                ask = asked(v)
                if ask:
                    kind, prompt = ask
                    p = (" " + E(prompt)) if prompt is not None else ""
                    lead = {"text": "ask", "number": "ask for a number", "decimal": "ask for a decimal"}[kind]
                    return S(level, f"{lead}{p} and store in {t.id}")
                if isinstance(v, ast.Call) and not isinstance(v.func, ast.Lambda) and not self.strict:
                    try:
                        name = self.callable_name(v.func)
                        args = self.args(v)
                        return S(level, f"run {name}{' with ' + args if args else ''} and store in {t.id}")
                    except Unwordable:
                        pass
                if isinstance(v, ast.List) and self.strict and all(isinstance(x, (ast.Constant, ast.Name)) for x in v.elts):
                    self.lists.add(t.id)
                    self.words.lists.add(t.id)
                    if not v.elts:
                        return S(level, f"create empty list {t.id}")
                    return S(level, f"create list {t.id} with {', '.join(self.arg(x) for x in v.elts)}")
                if isinstance(v, ast.Dict) and not v.keys:
                    return S(level, f"create dictionary {t.id}")
                return S(level, f"set {t.id} to {self.value(v)}")
            # several names at once: count, sides = …
            if self.strict and isinstance(t, ast.Tuple) and len(t.elts) > 1 and all(isinstance(x, ast.Name) and name_ok(x.id) for x in t.elts):
                return S(level, f"set {', '.join(x.id for x in t.elts)} to {self.value(v)}")
            return S(level, f"set {self.target(t)} to {self.value(v)}")
        if isinstance(n, ast.AugAssign):
            verb = {ast.Add: "increase {t} by {v}", ast.Sub: "decrease {t} by {v}",
                    ast.Mult: "multiply {t} by {v}", ast.Div: "divide {t} by {v}"}.get(type(n.op))
            if not verb:
                raise Unwordable()
            value = E(n.value)
            if re.search(r"\sby\s", _STR.sub("''", value)):
                raise Unwordable()
            return S(level, verb.format(t=self.target(n.target), v=value))
        if isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name) and n.simple:
            value = "" if n.value is None else f" = {E(n.value)}"
            return S(level, f"field {n.target.id}: {self.words.raw(n.annotation)}{value}")
        if isinstance(n, ast.Global):
            return S(level, "use the shared " + ", ".join(n.names))
        if isinstance(n, ast.Delete) and len(n.targets) == 1:
            return S(level, "delete " + self.target(n.targets[0]))
        if isinstance(n, ast.Expr):
            if isinstance(n.value, ast.Call):
                return self.call_stmt(n.value, level)
            if isinstance(n.value, ast.Await) and isinstance(n.value.value, ast.Call):
                return S(level, f"wait for {self.words.raw(n.value.value)}")
            raise Unwordable()
        if isinstance(n, ast.If):
            if not n.orelse and isinstance(n.test, ast.Compare) and dotted(n.test) == "__name__ == '__main__'":
                return S(level, "if this file is run directly") + self.block(n.body, level + 1)
            out = S(level, f"if {E(n.test)}") + self.block(n.body, level + 1)
            orelse = n.orelse
            while orelse:
                if len(orelse) == 1 and isinstance(orelse[0], ast.If) and getattr(orelse[0], "_elif", False):
                    e = orelse[0]
                    out += S(level, f"otherwise if {E(e.test)}") + self.block(e.body, level + 1)
                    orelse = e.orelse
                else:
                    out += S(level, "otherwise") + self.block(orelse, level + 1)
                    break
            return out
        if isinstance(n, ast.For) and not n.orelse:
            it = n.iter
            names = [n.target.id] if isinstance(n.target, ast.Name) else \
                [x.id for x in n.target.elts] if isinstance(n.target, ast.Tuple) and all(isinstance(x, ast.Name) for x in n.target.elts) else None
            if not names or not all(name_ok(x) for x in names):
                return self.compound(n, level)
            v = names[0]
            if len(names) == 1 and isinstance(it, ast.Call) and ast.unparse(it.func) == "range" and not it.keywords:
                a = it.args
                if len(a) == 1:
                    head = f"repeat {E(a[0])} times" + ("" if v == "_" else f" counting with {v}")
                    return S(level, head) + self.block(n.body, level + 1)
                if len(a) == 2 and all(isinstance(x, ast.Constant) and isinstance(x.value, int) for x in a) and a[1].value > a[0].value:
                    return S(level, f"count {v} from {a[0].value} to {a[1].value - 1}") + self.block(n.body, level + 1)
                if not self.strict and len(a) == 2:
                    return S(level, f"count {v} from {E(a[0])} to {E(a[1])} minus 1") + self.block(n.body, level + 1)
                return self.compound(n, level)
            return S(level, f"for each {', '.join(names)} in {E(it)}") + self.block(n.body, level + 1)
        if isinstance(n, ast.While) and not n.orelse:
            if isinstance(n.test, ast.Constant) and n.test.value is True:
                return S(level, "repeat forever") + self.block(n.body, level + 1)
            return S(level, f"while {E(n.test)}") + self.block(n.body, level + 1)
        if isinstance(n, ast.Break):
            return S(level, "stop the loop")
        if isinstance(n, ast.Continue):
            return S(level, "skip to next")
        if isinstance(n, ast.Pass):
            return S(level, "do nothing")
        if isinstance(n, ast.Return):
            v = n.value
            # return a, b: two values, said with a comma ("give back a and b" would be asked about)
            if self.strict and isinstance(v, ast.Tuple) and len(v.elts) > 1 and not any(isinstance(x, ast.Starred) for x in v.elts):
                try:
                    return S(level, "give back " + ", ".join(self.arg(x) for x in v.elts))
                except Unwordable:
                    pass
            if isinstance(v, ast.BoolOp) and isinstance(v.op, ast.And) and not any(isinstance(x, (ast.Compare, ast.UnaryOp, ast.BoolOp)) for x in v.values):
                raise Unwordable()   # "give back total and count" is asked about: two values, or both true?
            return S(level, "give back" + (f" {self.value(v, calls=False)}" if v is not None else ""))
        if isinstance(n, ast.Raise):
            if n.cause is not None:
                raise Unwordable()
            if n.exc is None:
                return S(level, "fail again")
            d = dotted_name(n.exc)
            if d:
                return S(level, f"fail with {d}")
            if isinstance(n.exc, ast.Call) and dotted_name(n.exc.func) and (n.exc.args or n.exc.keywords):
                return S(level, f"fail with {dotted_name(n.exc.func)}: {self.args(n.exc)}")
            raise Unwordable()
        if isinstance(n, ast.Assert) and n.msg is None:
            return S(level, f"check that {E(n.test)}")
        if isinstance(n, ast.Try):
            out = S(level, "try") + self.block(n.body, level + 1)
            for h in n.handlers:
                kinds = h.type.elts if isinstance(h.type, ast.Tuple) else [h.type] if h.type is not None else []
                names = [dotted_name(k) for k in kinds]
                if not all(names):
                    raise Unwordable()
                head = "if it fails" + (" with " + " or ".join(names) if names else "") + (f" as {h.name}" if h.name else "")
                out += S(level, head) + self.block(h.body, level + 1)
            if n.orelse:
                out += S(level, "if nothing failed") + self.block(n.orelse, level + 1)
            if n.finalbody:
                out += S(level, "in any case") + self.block(n.finalbody, level + 1)
            return out
        if isinstance(n, (ast.With, ast.AsyncWith)) and len(n.items) == 1:
            item = n.items[0]
            var = item.optional_vars
            if var is not None and not isinstance(var, ast.Name):
                return self.compound(n, level)
            c = item.context_expr
            is_async = isinstance(n, ast.AsyncWith)
            if not is_async and var is not None and isinstance(c, ast.Call) and isinstance(c.func, ast.Name) and c.func.id == "open" \
                    and (not c.keywords or self.strict) and 1 <= len(c.args) <= 2 and all(k.arg for k in c.keywords):
                mode = c.args[1].value if len(c.args) == 2 and isinstance(c.args[1], ast.Constant) else None
                words = {None: "", "r": " for reading", "w": " for writing", "a": " for adding"}
                if len(c.args) == 1 or mode in ("r", "w", "a"):
                    path = self.arg(c.args[0])
                    extra = and_list([f"{k.arg}={self.arg(k.value)}" for k in c.keywords]) if c.keywords else ""
                    if not (has_word(path, "for", "with", "as") or has_word(extra, "as")):
                        return S(level, f"open the file {path}{words[mode]}{' with ' + extra if extra else ''} as {var.id}") + self.block(n.body, level + 1)
            return S(level, f"{'async ' if is_async else ''}using {E(c)}{' as ' + var.id if var is not None else ''}") + self.block(n.body, level + 1)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and simple_args(n) and not n.returns and name_ok(n.name):
            a = n.args
            names = [x.arg for x in a.args]
            if not all(name_ok(p) for p in names):
                raise Unwordable()
            defaults = [None] * (len(names) - len(a.defaults)) + list(a.defaults)
            params = []
            for x_, d in zip(a.args, defaults):
                # a type is read as code (Optional[bool], not "item bool of Optional")
                an = x_.annotation
                ann = "" if an is None else f": {self.words.raw(an) if self.strict and not isinstance(an, ast.Name) and safe_code(an) else self.arg(an)}"
                params.append(x_.arg + ann + ("" if d is None else (" = " if ann else "=") + self.arg(d)))
            out = []
            for d in n.decorator_list:
                out += self.decorator(d, level)
            # a class's __init__ (self first): what happens when a new object is made
            cls = getattr(self, "in_class", None)
            if self.strict and cls and n.name == "__init__" and isinstance(n, ast.FunctionDef) and not n.decorator_list \
                    and names and names[0] == "self" and a.args[0].annotation is None and len(defaults) == len(names) and defaults[0] is None:
                rest = params[1:]
                head = f"when a new {cls} is made" + (f" with {and_list(rest)}" if rest else "")
                return S(level, head) + self.block(n.body, level + 1)
            head = f"define {'async ' if isinstance(n, ast.AsyncFunctionDef) else ''}{n.name}" + (f" using {', '.join(params)}" if params else "")
            return out + S(level, head) + self.block(n.body, level + 1)
        if isinstance(n, ast.ClassDef) and not n.keywords:
            bases = [dotted_name(b) for b in n.bases]
            if not all(bases):
                return self.compound(n, level)
            out = []
            for d in n.decorator_list:
                out += self.decorator(d, level)
            outer, self.in_class = getattr(self, "in_class", None), n.name
            try:
                body = self.block(n.body, level + 1)
            finally:
                self.in_class = outer
            return out + S(level, f"define class {n.name}" + (f" based on {', '.join(bases)}" if bases else "")) + body
        if isinstance(n, (ast.Import, ast.ImportFrom)):
            return S(level, self.import_sentence(n))
        return self.compound(n, level)

    def import_sentence(self, n):
        """import os, sys -> bring in os and sys; from flask import Flask as F -> bring in Flask as F from flask;
        from math import * -> bring in everything from math; from . import views -> bring in views from this package."""
        def ok(name):
            return all(re.fullmatch(r"[A-Za-z_]\w*", p) and name_ok(p) for p in name.split("."))
        names = []
        for a in n.names:
            if a.name == "*" or not ok(a.name) or (a.asname and not ok(a.asname)):
                if a.name == "*" and isinstance(n, ast.ImportFrom) and len(n.names) == 1:
                    names.append("everything")
                    break
                raise Unwordable()
            if isinstance(n, ast.ImportFrom) and a.name.lower() == "everything":
                raise Unwordable()   # "everything" is what * is called
            names.append(a.name + (f" as {a.asname}" if a.asname else ""))
        if isinstance(n, ast.Import):
            return "bring in " + and_list(names)
        mod = "." * n.level + (n.module or "")
        if n.module and not ok(n.module):
            raise Unwordable()
        return f"bring in {and_list(names)} from {'this package' if mod == '.' else mod}"

    def call_stmt(self, c, level):
        S = self.say
        f = ast.unparse(c.func)
        kw = {k.arg: k.value for k in c.keywords}
        if f == "print":
            if any(isinstance(a, ast.Starred) for a in c.args):
                raise Unwordable()
            end = kw.pop("end", None)
            if kw or (end is not None and not (isinstance(end, ast.Constant) and end.value == " ")):
                raise Unwordable()
            if not c.args:
                if end is not None:
                    raise Unwordable()
                return S(level, "show a blank line")
            return S(level, "show " + " and ".join(self.arg(a) for a in c.args) + (" on the same line" if end is not None else ""))
        if not c.keywords:
            if f == "time.sleep" and len(c.args) == 1 and isinstance(c.args[0], ast.Constant) and isinstance(c.args[0].value, (int, float)):
                return S(level, f"wait {c.args[0].value} second{'' if c.args[0].value == 1 else 's'}")
            if f == "time.sleep" and len(c.args) == 1 and self.strict and "time" in self.modules:
                try:
                    secs = self.arg(c.args[0])
                    if not re.search(r"\bsec", _STR.sub("''", secs)) and not secs.startswith("for "):
                        return S(level, f"wait {secs} seconds")
                except Unwordable:
                    pass
            if f == "random.shuffle" and len(c.args) == 1 and isinstance(c.args[0], ast.Name):
                return S(level, f"shuffle {c.args[0].id}")
            if f == "sys.exit" and not c.args:
                return S(level, "stop the program")
            if f == "input" and len(c.args) <= 1:
                return S(level, "ask " + (self.E(c.args[0]) if c.args else '""'))
        if isinstance(c.func, ast.Attribute) and isinstance(c.func.value, ast.Name) and name_ok(c.func.value.id):
            obj, meth = c.func.value.id, c.func.attr
            is_list = obj in self.lists or not self.strict
            # "add … to …" and "remove … from …" split at the first of those words outside quotes
            if meth == "append" and len(c.args) == 1 and not c.keywords and is_list:
                item = self.arg(c.args[0])
                if not has_word(item, "to", "onto", "into"):
                    return S(level, f"add {item} to {obj}")
                if not self.strict:
                    raise Unwordable()
            if meth == "sort" and not c.args and is_list:
                rev = kw.get("reverse")
                if not c.keywords:
                    return S(level, f"sort {obj}")
                if list(kw) == ["reverse"] and isinstance(rev, ast.Constant) and rev.value is True:
                    return S(level, f"sort {obj} biggest first")
            if meth == "reverse" and not c.args and not c.keywords and is_list:
                return S(level, f"reverse {obj}")
            if meth == "remove" and len(c.args) == 1 and not c.keywords and is_list:
                item = self.arg(c.args[0])
                if not (has_word(item, "from") or re.match(r"(?:the\s+)?item\s", item, re.I)):   # "remove item 2 from x" removes by position
                    return S(level, f"remove {item} from {obj}")
                if not self.strict:
                    raise Unwordable()
        if self.strict:
            try:
                said = self.method_sentence(c)
            except Unwordable:
                said = None
            if said:
                return S(level, said)
        name = self.callable_name(c.func)
        args = self.args(c)
        if self.strict and self.is_class(name) and name not in BUILTIN_CALLS:
            return S(level, f"make a new {name}" + (f" with {args}" if args else ""))
        return S(level, f"run {name}" + (f" with {args}" if args else ""))

    def method_sentence(self, c):
        """Calls with sentences of their own: list and set tools, files, JSON, databases, window parts.
        None when there is none; Unwordable when the parts can't be said."""
        f, args, kws = c.func, c.args, c.keywords
        if any(k.arg is None for k in kws) or any(isinstance(a, ast.Starred) for a in args):
            return None
        kwtext = lambda ks: and_list([f"{k.arg}={self.arg(k.value)}" for k in ks]) if ks else ""
        name = dotted_name(f)
        if name == "json.dump" and len(args) == 2 and "json" in self.modules:
            v, into = self.arg(args[0]), self.words.opd(args[1])
            extra = kwtext(kws)
            return f"save {v} as JSON in {into}" + (f" with {extra}" if extra else "")
        # a window part made and placed in one go: tk.Button(root, text="Add", command=f).pack()
        if isinstance(f, ast.Attribute) and f.attr in ("pack", "grid", "place") and not args and isinstance(f.value, ast.Call):
            made = f.value
            cname = dotted_name(made.func)
            parent = dotted_name(made.args[0]) if len(made.args) == 1 else None
            if cname and parent and re.match(r"[A-Z]", cname.split(".")[-1]) and self.is_class(cname) and not any(k.arg is None for k in made.keywords) \
                    and all(name_ok(p) for p in parent.split(".")):
                self.callable_name(made.func)
                ks = list(made.keywords)
                saying = self.arg(ks.pop(0).value) if ks and ks[0].arg == "text" else None
                runs = self.arg(ks.pop(0).value) if ks and ks[0].arg == "command" else None
                if any(k.arg in ("text", "command") for k in ks):
                    raise Unwordable()
                extra, place = kwtext(ks), kwtext(kws)
                if (saying and has_word(saying, "to", "that", "with")) or (runs and has_word(runs, "with", "packed", "placed", "put")) \
                        or has_word(extra, "packed", "placed", "put"):
                    raise Unwordable()
                how = {"pack": ", packed" if kws else "", "grid": ", put in the grid", "place": ", placed"}[f.attr]
                return f"add a{'n' if cname[0] in 'AEIOU' else ''} {cname}" + (f" saying {saying}" if saying else "") + f" to {parent}" \
                    + (f" that runs {runs}" if runs else "") + (f" with {extra}" if extra else "") + how + (f" with {place}" if place else "")
        if not isinstance(f, ast.Attribute) or self.words.of_module(f.value):
            return None   # os.remove(path) deletes a file: a module's own tools aren't list tools
        m, n = f.attr, len(args)
        obj = self.words.opd(f.value)
        if re.search(r"\s", _STR.sub("''", obj)):
            return None
        plain = re.fullmatch(r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*", obj) is not None
        if kws and m not in ("sort",):
            return None
        if m == "append" and n == 1:
            item = self.arg(args[0])
            return None if has_word(item, "to", "onto", "into") else f"append {item} to {obj}"
        if m == "extend" and n == 1:
            items = self.arg(args[0])
            return None if has_word(items, "to") else f"add every item of {items} to {obj}"
        if m == "insert" and n == 2:
            at, item = self.arg(args[0]), self.arg(args[1])
            return None if has_word(item, "into", "in", "at") else f"insert {item} into {obj} at position {at}"
        if m == "remove" and n == 1:
            item = self.arg(args[0])
            if has_word(item, "out") or re.match(r"(?:the\s+)?(?:last\s+)?item\s", item, re.I):
                return None
            return f"take {item} out of {obj}"
        if m == "pop" and n == 0:
            return f"take the last item out of {obj}"
        if m == "pop" and n == 1:
            at = self.words.opd(args[0])
            return None if re.search(r"\s", at) else f"take item {at} out of {obj}"
        if m == "clear" and n == 0:
            return f"empty {obj}"
        if m == "reverse" and n == 0:
            return f"reverse {obj}"
        if m == "sort" and n == 0:
            kw = {k.arg: k.value for k in kws}
            if [k.arg for k in kws] not in ([], ["key"], ["reverse"], ["key", "reverse"]):
                return None
            rev = kw.get("reverse")
            if rev is not None and not (isinstance(rev, ast.Constant) and rev.value is True):
                return None
            by = f" by {self.words.opd(kw['key'])}" if "key" in kw else ""
            return f"sort {obj}{by}" + (" biggest first" if rev is not None else "")
        if m == "add" and n == 1 and obj in self.sets:
            item = self.arg(args[0])
            return None if has_word(item, "to") else f"add {item} to the set {obj}"
        if m == "write" and n == 1 and plain:
            text = self.arg(args[0])
            return None if has_word(text, "into") else f"write {text} into {obj}"
        if m == "commit" and n == 0 and plain:
            return f"save the changes to {obj}"
        if m == "execute" and 1 <= n <= 2 and plain and isinstance(args[0], (ast.Constant, ast.JoinedStr)) \
                and (isinstance(args[0], ast.JoinedStr) or isinstance(args[0].value, str)):
            sql = self.arg(args[0])
            if n == 1:
                return f"run the SQL {sql} on {obj}"
            p = args[1]
            if isinstance(p, ast.Tuple) and p.elts and not any(isinstance(x, ast.Starred) for x in p.elts):
                vals = [self.arg(x) for x in p.elts]
                return f"run the SQL {sql} on {obj} with the value{'s' if len(vals) > 1 else ''} {and_list(vals)}"
            pv = self.arg(p)
            return None if re.match(r"the\s+values?\b", pv, re.I) else f"run the SQL {sql} on {obj} with {pv}"
        return None

    def compound(self, n, level):
        pad = "    " * level
        py = lambda s, extra=0: pad + "    " * extra + "python: " + s
        if isinstance(n, ast.Try):
            out = [py("try:")] + self.block(n.body, level + 1)
            for h in n.handlers:
                head = "except" + (f" {ast.unparse(h.type)}" if h.type else "") + (f" as {h.name}" if h.name else "") + ":"
                out += [py(head)] + self.block(h.body, level + 1)
            if n.orelse:
                out += [py("else:")] + self.block(n.orelse, level + 1)
            if n.finalbody:
                out += [py("finally:")] + self.block(n.finalbody, level + 1)
            return out
        if isinstance(n, (ast.With, ast.AsyncWith)):
            kw = "async with" if isinstance(n, ast.AsyncWith) else "with"
            return [py(f"{kw} {', '.join(ast.unparse(i) for i in n.items)}:")] + self.block(n.body, level + 1)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            head = ast.unparse(n).splitlines()
            lines, i = [], 0
            while i < len(head) and head[i].startswith("@"):
                lines.append(py(head[i]))
                i += 1
            lines.append(py(head[i]))
            return lines + self.block(n.body, level + 1)
        if isinstance(n, (ast.For, ast.AsyncFor)) and not n.orelse:
            kw = "async for" if isinstance(n, ast.AsyncFor) else "for"
            return [py(f"{kw} {ast.unparse(n.target)} in {ast.unparse(n.iter)}:")] + self.block(n.body, level + 1)
        if isinstance(n, ast.While) and not n.orelse:
            return [py(f"while {ast.unparse(n.test)}:")] + self.block(n.body, level + 1)
        if isinstance(n, ast.If):
            out = [py(f"if {ast.unparse(n.test)}:")] + self.block(n.body, level + 1)
            if n.orelse:
                out += [py("else:")] + self.block(n.orelse, level + 1)
            return out
        return self.raw_lines(n, level)


BUILTIN_CALLS = {"print", "input", "len", "int", "float", "str", "bool", "list", "dict", "range", "sum", "min", "max", "abs",
                 "round", "sorted", "reversed", "enumerate", "zip", "type", "isinstance", "any", "all", "set", "tuple",
                 "map", "filter", "open", "super", "getattr", "setattr", "hasattr", "iter", "next", "repr", "format"}


def simple_args(fn):
    a = fn.args
    return not (a.posonlyargs or a.vararg or a.kwonlyargs or a.kwarg)


def is_docstring(n):
    return isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant) and isinstance(n.value.value, str)


def asked(v):
    """input(...) / int(input(...)) / float(input(...)) -> (kind, prompt)."""
    def inp(c):
        return isinstance(c, ast.Call) and isinstance(c.func, ast.Name) and c.func.id == "input" and not c.keywords and len(c.args) <= 1
    if inp(v):
        return "text", (v.args[0] if v.args else None)
    if isinstance(v, ast.Call) and isinstance(v.func, ast.Name) and v.func.id in ("int", "float") \
            and len(v.args) == 1 and not v.keywords and inp(v.args[0]):
        return ("number" if v.func.id == "int" else "decimal"), (v.args[0].args[0] if v.args[0].args else None)
    return None


def mark_elifs(tree, source_lines):
    """ast can't tell `elif` from `else: if`. Look at the source to find out."""
    for node in ast.walk(tree):
        if isinstance(node, ast.If) and len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If):
            child = node.orelse[0]
            line = source_lines[child.lineno - 1] if child.lineno - 1 < len(source_lines) else ""
            child._elif = line.lstrip().startswith("elif")


# --------------------------------------------------------------------------
# Facts about a group of statements
# --------------------------------------------------------------------------

def dotted(e):
    try:
        return ast.unparse(e)
    except Exception:
        return ""


def aliases(tree):
    """import numpy as np -> {'np': 'numpy'}"""
    out = {}
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            for a in n.names:
                out[(a.asname or a.name).split(".")[0]] = a.name.split(".")[0]
        elif isinstance(n, ast.ImportFrom) and n.module:
            for a in n.names:
                out[a.asname or a.name] = n.module.split(".")[0]
    return out


SECRET_NAME = re.compile(r"(api_?key|secret|token|password|passwd|pwd|private_?key|access_?key|webhook)", re.I)


class Facts:
    def __init__(self, nodes, alias, tools, source_lines):
        self.nodes = nodes
        self.alias = alias
        self.tools = tools
        self.lines = source_lines
        self.effects = []      # plain phrases, in order found
        self.libs = []
        self.calls_tools = []
        self.calls_other = []
        self.warnings = []
        self.handles = []
        self.raises = []
        self.changes_globals = []
        self.loops = 0
        self.decisions = 0
        self.returns = []
        self._walk()

    def add(self, lst, item):
        if item and item not in lst:
            lst.append(item)

    def _walk(self):
        for top in self.nodes:
            for n in ast.walk(top):
                self._node(n)

    def _node(self, n):
        if isinstance(n, (ast.For, ast.AsyncFor, ast.While)):
            self.loops += 1
            if isinstance(n, ast.While) and isinstance(n.test, ast.Constant) and n.test.value is True:
                if not any(isinstance(x, (ast.Break, ast.Return)) for x in ast.walk(n)):
                    self.add(self.warnings, "Has a loop that repeats forever with no way out (no break or return). That may be intended for servers and games.")
        elif isinstance(n, ast.If):
            self.decisions += 1
        elif isinstance(n, ast.Global):
            for g in n.names:
                self.add(self.changes_globals, g)
        elif isinstance(n, ast.Raise) and n.exc is not None:
            exc = n.exc.func if isinstance(n.exc, ast.Call) else n.exc
            self.add(self.raises, dotted(exc))
        elif isinstance(n, ast.Try):
            for h in n.handlers:
                self.add(self.handles, dotted(h.type) if h.type else "any error")
                if h.type is None or dotted(h.type) in ("Exception", "BaseException"):
                    if all(isinstance(b, ast.Pass) for b in h.body) or (len(h.body) == 1 and isinstance(h.body[0], (ast.Pass, ast.Continue))):
                        self.add(self.warnings, "Catches every error and ignores it, so problems can fail silently.")
        elif isinstance(n, ast.Return) and n.value is not None:
            self.returns.append(n.value)
        elif isinstance(n, (ast.Yield, ast.YieldFrom)):
            self.add(self.effects, "produces values one at a time (a generator)")
        elif isinstance(n, ast.Assign):
            for t in n.targets:
                if isinstance(t, ast.Name) and SECRET_NAME.search(t.id) and isinstance(n.value, ast.Constant) \
                        and isinstance(n.value.value, str) and len(n.value.value) >= 8:
                    self.add(self.warnings, f"`{t.id}` looks like a secret written straight into the code. Secrets are safer in environment variables or a .env file.")
        elif isinstance(n, ast.Call):
            self._call(n)

    def _call(self, n):
        name = dotted(n.func)
        root = name.split(".")[0]
        lib = self.alias.get(root)
        if lib and lib not in _XREF["roots"] and root not in _XREF["names"] and root not in _XREF["modules"]:
            self.add(self.libs, lib)
        xn, xm = _XREF["names"], _XREF["modules"]
        if isinstance(n.func, ast.Name) and n.func.id in xn:
            self.add(self.calls_other, f"[[{xn[n.func.id]}#{n.func.id}]]")
            _USES.append((_XREF["path"], xn[n.func.id], n.func.id))
        elif isinstance(n.func, ast.Attribute) and isinstance(n.func.value, ast.Name) and n.func.value.id in xn:
            self.add(self.calls_other, f"[[{xn[n.func.value.id]}#{n.func.value.id}]]")
            _USES.append((_XREF["path"], xn[n.func.value.id], n.func.value.id))
        elif isinstance(n.func, ast.Attribute) and isinstance(n.func.value, ast.Name) and n.func.value.id in xm:
            self.add(self.calls_other, f"[[{xm[n.func.value.id]}#{n.func.attr}]]")
            _USES.append((_XREF["path"], xm[n.func.value.id], n.func.attr))
        last = name.split(".")[-1]
        kw = {k.arg: k.value for k in n.keywords}
        if name == "print":
            self.add(self.effects, "shows text")
        elif name == "input":
            self.add(self.effects, "asks the person to type something")
        elif name == "open":
            mode = n.args[1] if len(n.args) > 1 else kw.get("mode")
            m = mode.value if isinstance(mode, ast.Constant) and isinstance(mode.value, str) else "r"
            self.add(self.effects, "writes to a file" if any(c in m for c in "wax") else "reads a file")
        elif lib in ("requests", "httpx", "urllib", "aiohttp") or name in ("fetch",):
            verb = {"get": "fetches data from", "post": "sends data to", "put": "sends data to", "delete": "deletes something on", "patch": "updates something on"}.get(last, "talks to")
            self.add(self.effects, f"{verb} the internet")
        elif last in ("execute", "executemany") or lib in ("sqlite3", "sqlalchemy", "psycopg2", "pymongo"):
            self.add(self.effects, "reads or changes a database")
            if last in ("execute", "executemany") and n.args and isinstance(n.args[0], (ast.JoinedStr, ast.BinOp)):
                self.add(self.warnings, "Builds a database query by joining text. If any of that text comes from users, this allows SQL injection; pass values separately instead.")
        elif name in ("os.getenv", "os.environ.get") or name.startswith("os.environ"):
            self.add(self.effects, "reads settings from the environment (often secrets like API keys)")
        elif lib == "subprocess" or name in ("os.system",):
            self.add(self.effects, "runs other programs")
            sh = kw.get("shell")
            if isinstance(sh, ast.Constant) and sh.value is True or name == "os.system":
                self.add(self.warnings, "Runs a shell command. If any part of it comes from users, they could run their own commands.")
        elif name in ("os.remove", "os.unlink", "shutil.rmtree", "os.rmdir") or name.endswith(".unlink"):
            self.add(self.effects, "deletes files or folders")
        elif name in ("eval", "exec"):
            self.add(self.warnings, f"Uses `{name}()`, which runs text as code. That is risky if the text comes from users.")
        elif lib == "random":
            self.add(self.effects, "uses randomness")
        elif name in ("time.sleep", "asyncio.sleep"):
            self.add(self.effects, "pauses")
        elif lib in ("openai", "anthropic"):
            self.add(self.effects, "calls an AI model")
        elif last in ("send_message", "sendmail", "send"):
            self.add(self.effects, "sends a message")
        elif last == "run" and root in ("app",) and isinstance(kw.get("debug"), ast.Constant) and kw["debug"].value is True:
            self.add(self.warnings, "Starts the web server with debug=True. Fine while building, unsafe on a public server.")
        if isinstance(n.func, ast.Name) and n.func.id in self.tools:
            self.add(self.calls_tools, n.func.id)
        if isinstance(n.func, ast.Attribute) and n.func.attr in ("route", "get", "post") and False:
            pass


def gists(nodes):
    """Recognise common patterns and say what they are for, e.g. counting or building a list."""
    out = []
    flat = list(nodes)
    for i, n in enumerate(flat):
        loop = n if isinstance(n, (ast.For, ast.While)) else None
        if not loop:
            continue
        target = dotted(loop.iter) if isinstance(loop, ast.For) else None
        # a value set just before the loop and changed inside it
        for prev in flat[:i][::-1][:3]:
            if not (isinstance(prev, ast.Assign) and len(prev.targets) == 1 and isinstance(prev.targets[0], ast.Name)):
                continue
            name = prev.targets[0].id
            start = prev.value
            for m in ast.walk(loop):
                if isinstance(m, ast.AugAssign) and isinstance(m.target, ast.Name) and m.target.id == name and isinstance(m.op, ast.Add):
                    cond = next((c for c in ast.walk(loop) if isinstance(c, ast.If) and any(x is m for x in ast.walk(c))), None)
                    what = f"each item in {code(target)}" if target else "each round"
                    if isinstance(m.value, ast.Constant) and m.value.value == 1:
                        if target and cond:
                            out.append(f"Counts how many items in {code(target)} pass the check {code(dotted(cond.test))}, keeping the count in {code(name)}.")
                        elif target:
                            out.append(f"Counts the items in {code(target)}, keeping the count in {code(name)}.")
                        else:
                            out.append(f"Counts rounds in {code(name)}.")
                    else:
                        out.append(f"Adds up {code(dotted(m.value))} for {what}, keeping the running total in {code(name)}.")
                    break
                if isinstance(m, ast.Call) and isinstance(m.func, ast.Attribute) and m.func.attr == "append" \
                        and dotted(m.func.value) == name and isinstance(start, ast.List) and not start.elts:
                    out.append(f"Builds a new list {code(name)}" + (f" from the items in {code(target)}" if target else "") + ".")
                    break
            else:
                continue
            break
        else:
            has_exit = any(isinstance(m, (ast.Break, ast.Return)) for m in ast.walk(loop))
            asks = any(isinstance(m, ast.Call) and dotted(m.func) == "input" for m in ast.walk(loop))
            if isinstance(loop, ast.While) and asks:
                out.append("Keeps asking the person until the answer is acceptable." if not (isinstance(loop.test, ast.Constant)) else
                           "Keeps asking the person for input until something tells it to stop.")
            elif isinstance(loop, ast.For) and has_exit and any(isinstance(m, ast.If) for m in ast.walk(loop)):
                out.append(f"Looks through {code(target)} for the first item that matches a check, and stops there.")
            elif isinstance(loop, ast.For):
                out.append(f"Does something with each item in {code(target)}.")
    return out


def plain_list(items, limit=6):
    items = list(items)
    if not items:
        return ""
    more = len(items) - limit
    items = items[:limit]
    text = items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]
    return text + (f" (and {more} more)" if more > 0 else "")


def code(s):
    return f"`{s}`"


def describe_value(e, alias):
    if isinstance(e, ast.Constant):
        if isinstance(e.value, str):
            s = e.value if len(e.value) <= 40 else e.value[:37] + "…"
            return f'the text "{s}"'
        if isinstance(e.value, bool):
            return "yes" if e.value else "no"
        if e.value is None:
            return "nothing"
        return f"the number {e.value}"
    if isinstance(e, ast.Name):
        return f"the value of {code(e.id)}"
    if isinstance(e, (ast.List, ast.ListComp)):
        return "a list"
    if isinstance(e, (ast.Dict, ast.DictComp)):
        return "a dictionary"
    if isinstance(e, ast.Tuple):
        return f"{len(e.elts)} values together"
    if isinstance(e, ast.JoinedStr):
        return "a piece of text built from values"
    if isinstance(e, ast.Compare) or isinstance(e, ast.BoolOp) or (isinstance(e, ast.UnaryOp) and isinstance(e.op, ast.Not)):
        return "yes or no (the result of a check)"
    if isinstance(e, ast.BinOp):
        return "the result of a calculation"
    if isinstance(e, ast.Call):
        return f"the result of {code(dotted(e.func))}"
    return "a value"


def lib_phrase(lib):
    what = LIBRARIES.get(lib)
    return f"{code(lib)} ({what})" if what else code(lib)


def steps_for(nodes, tools, lists, limit=MAX_STEPS):
    sent = Sentences(False, tools, lists)
    lines = []
    for n in nodes:
        lines.extend(sent.stmt(n, 0))
        if len(lines) > limit:
            break
    more = len(lines) > limit
    return lines[:limit], more


def comment_above(source_lines, lineno):
    """The block of # comments directly above a line, joined."""
    out = []
    i = lineno - 2
    while i >= 0 and source_lines[i].strip().startswith("#"):
        out.insert(0, source_lines[i].strip().lstrip("#").strip())
        i -= 1
    return " ".join(x for x in out if x and not set(x) <= set("-=*#~ "))


# --------------------------------------------------------------------------
# Sections
# --------------------------------------------------------------------------

def start_line(n):
    return min([n.lineno] + [d.lineno for d in getattr(n, "decorator_list", [])])


def is_setting(n):
    if isinstance(n, ast.AnnAssign):
        return isinstance(n.target, ast.Name) and n.value is not None and is_plain(n.value)
    if isinstance(n, ast.Assign):
        return all(isinstance(t, ast.Name) for t in n.targets) and is_plain(n.value)
    return False


def is_plain(v):
    """A value that is just data, not work: numbers, text, lists of those, or env lookups."""
    if isinstance(v, ast.Constant):
        return True
    if isinstance(v, (ast.List, ast.Tuple, ast.Set)):
        return all(is_plain(x) for x in v.elts)
    if isinstance(v, ast.Dict):
        return all(k is None or is_plain(k) for k in v.keys) and all(is_plain(x) for x in v.values)
    if isinstance(v, ast.UnaryOp):
        return is_plain(v.operand)
    if isinstance(v, ast.BinOp):
        return is_plain(v.left) and is_plain(v.right)
    if isinstance(v, ast.Call):
        name = dotted(v.func)
        return name in ("os.getenv", "os.environ.get", "Path", "pathlib.Path", "set", "list", "dict") and all(is_plain(a) for a in v.args)
    if isinstance(v, ast.Subscript) and dotted(v.value) == "os.environ":
        return True
    if isinstance(v, ast.Name):
        return v.id in ("True", "False", "None")
    return False


def is_main_guard(n):
    return isinstance(n, ast.If) and dotted(n.test).replace("'", '"') in ('__name__ == "__main__"', '"__main__" == __name__')


def route_obj(fn):
    """The object a route decorator hangs off (app, tasks_bp, router...)."""
    for d in fn.decorator_list:
        if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr in ("route", "get", "post", "put", "delete", "patch", "websocket"):
            return dotted(d.func.value)
    return None


def route_prefixes(trees):
    """Blueprint / router prefixes: register_blueprint(bp, url_prefix=...), include_router(r, prefix=...), Blueprint(..., url_prefix=...)."""
    out = {}
    for tree in trees:
        if tree is None:
            continue
        for n in ast.walk(tree):
            if isinstance(n, ast.Call):
                name = dotted(n.func)
                kw = {k.arg: k.value for k in n.keywords}
                pre = kw.get("url_prefix") or kw.get("prefix")
                if name.endswith(("register_blueprint", "include_router")) and n.args and isinstance(pre, ast.Constant):
                    out[dotted(n.args[0]).split(".")[-1]] = pre.value
            if isinstance(n, ast.Assign) and isinstance(n.value, ast.Call) and dotted(n.value.func).split(".")[-1] in ("Blueprint", "APIRouter"):
                kw = {k.arg: k.value for k in n.value.keywords}
                pre = kw.get("url_prefix") or kw.get("prefix")
                if isinstance(pre, ast.Constant):
                    for t in n.targets:
                        if isinstance(t, ast.Name):
                            out.setdefault(t.id, pre.value)
    return out


def route_of(fn):
    for d in fn.decorator_list:
        if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr in ("route", "get", "post", "put", "delete", "patch", "websocket"):
            path = d.args[0].value if d.args and isinstance(d.args[0], ast.Constant) else "?"
            methods = []
            if d.func.attr != "route":
                methods = [d.func.attr.upper()]
            for k in d.keywords:
                if k.arg == "methods" and isinstance(k.value, (ast.List, ast.Tuple)):
                    methods = [x.value for x in k.value.elts if isinstance(x, ast.Constant)]
            return path, methods or ["GET"]
    return None


def group_sections(tree):
    """Split a module's top-level statements into readable sections."""
    groups = []
    for n in tree.body:
        if is_docstring(n) and n is tree.body[0]:
            kind = "about"
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            kind = "imports"
        elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            kind = "route" if route_of(n) else "tool"
        elif isinstance(n, ast.ClassDef):
            kind = "class"
        elif is_main_guard(n):
            kind = "start"
        elif is_setting(n):
            kind = "settings"
        else:
            kind = "steps"
        single = kind in ("tool", "route", "class", "start", "about")
        if groups and groups[-1]["kind"] == kind and not single:
            groups[-1]["nodes"].append(n)
        else:
            groups.append({"kind": kind, "nodes": [n]})
    return groups


def section_span(nodes, source_lines):
    start = start_line(nodes[0])
    # include the comment block directly above
    i = start - 2
    while i >= 0 and source_lines[i].strip().startswith("#"):
        i -= 1
    start = i + 2
    end = max(getattr(n, "end_lineno", n.lineno) for n in nodes)
    return start, end


def summarise_nodes(kind, nodes, alias, tools, lists, source_lines):
    f = Facts(nodes, alias, tools, source_lines)
    title, headline, facts = "", "", []
    steps, more = [], False
    first = nodes[0]
    note = comment_above(source_lines, start_line(first))

    if kind == "about":
        title = "About this file"
        headline = first.value.value.strip().splitlines()[0] if first.value.value.strip() else "A description of the file."
        rest = " ".join(first.value.value.strip().splitlines()[1:]).strip()
        if rest:
            facts.append(rest[:400])
        return dict(title=title, headline=headline, facts=facts, warnings=[], steps=[], more=False)

    if kind == "imports":
        mods = []
        for n in nodes:
            if isinstance(n, ast.Import):
                mods += [a.name.split(".")[0] for a in n.names]
            elif n.module:
                mods.append(n.module.split(".")[0])
        seen = []
        for m in mods:
            if m not in seen:
                seen.append(m)
        title = "Toolkits used"
        headline = f"Brings in {len(seen)} toolkit{'s' if len(seen) != 1 else ''} that the rest of the file uses."
        facts = [lib_phrase(m) for m in seen]
        return dict(title=title, headline=headline, facts=facts, warnings=[], steps=[], more=False)

    if kind == "settings":
        names = []
        for n in nodes:
            t = n.target if isinstance(n, ast.AnnAssign) else n.targets[0]
            names.append(t.id if isinstance(t, ast.Name) else dotted(t))
        title = "Settings"
        headline = f"Sets {len(names)} starting value{'s' if len(names) != 1 else ''}: {plain_list([code(x) for x in names])}."
        for n in nodes[:8]:
            t = n.target if isinstance(n, ast.AnnAssign) else n.targets[0]
            facts.append(f"{code(dotted(t))} starts as {describe_value(n.value, alias)}")
        steps = []
    elif kind in ("tool", "route"):
        fn = first
        params = [a.arg for a in fn.args.args if a.arg not in ("self", "cls")]
        doc = ast.get_docstring(fn)
        route = route_of(fn)
        is_async = isinstance(fn, ast.AsyncFunctionDef)
        if route:
            path, methods = route
            title = f"Web route {'/'.join(methods)} {path}"
            headline = f"Handles {'/'.join(methods)} requests to {code(path)} on the web server, using the function {code(fn.name)}."
        else:
            title = f"Tool: {fn.name}"
            takes = f"takes {plain_list([code(p) for p in params])}" if params else "takes no inputs"
            headline = f"{code(fn.name)} is a reusable tool that {takes}."
        if doc:
            facts.append("The author describes it as: " + doc.strip().splitlines()[0])
        elif note:
            facts.append("The comment above it says: " + note)
        for g in gists([b for b in fn.body if not is_docstring(b)]):
            facts.append(g)
        rets = [r for r in f.returns]
        if rets:
            kinds = []
            for r in rets:
                d = describe_value(r, alias)
                if d not in kinds:
                    kinds.append(d)
            facts.append("It gives back " + (kinds[0] if len(kinds) == 1 else "one of: " + plain_list(kinds, 4)) + ".")
        elif not route:
            facts.append("It doesn't give anything back; it does its work through what it changes or shows.")
        if is_async:
            facts.append("It is `async`: it can wait (for the internet, for example) without freezing everything else.")
        steps = []
        body = [b for b in fn.body if not is_docstring(b)]
        steps, more = steps_for(body, tools, lists)
    elif kind == "class":
        cls = first
        methods = [b.name for b in cls.body if isinstance(b, (ast.FunctionDef, ast.AsyncFunctionDef))]
        attrs = []
        for b in cls.body:
            if isinstance(b, ast.FunctionDef) and b.name == "__init__":
                for s in ast.walk(b):
                    if isinstance(s, ast.Assign):
                        for t in s.targets:
                            if isinstance(t, ast.Attribute) and dotted(t.value) == "self" and t.attr not in attrs:
                                attrs.append(t.attr)
            if isinstance(b, ast.AnnAssign) and isinstance(b.target, ast.Name):
                attrs.append(b.target.id)
        bases = [dotted(b) for b in cls.bases]
        title = f"Class: {cls.name}"
        headline = f"{code(cls.name)} is a class: a blueprint for making objects that each keep their own values."
        if bases:
            facts.append(f"It builds on {plain_list([code(b) for b in bases])}.")
        doc = ast.get_docstring(cls)
        if doc:
            facts.append("The author describes it as: " + doc.strip().splitlines()[0])
        if attrs:
            facts.append(f"Each one keeps: {plain_list([code(a) for a in attrs], 8)}.")
        public = [m for m in methods if not m.startswith("__")]
        if public:
            facts.append(f"It can: {plain_list([code(m) for m in public], 8)}.")
        steps, more = [], False
    else:
        if kind == "start":
            title = "Starting point"
            headline = "Runs only when this file is started directly (not when another file imports it)."
            body = first.body
        else:
            title = "Main steps"
            headline = f"{len(nodes)} step{'s that run' if len(nodes) != 1 else ' that runs'} from top to bottom when the file starts."
            body = nodes
        if note:
            facts.append("The comment above says: " + note)
        steps, more = steps_for(body, tools, lists)

    # shared facts
    if f.effects:
        facts.append("Along the way it " + plain_list(f.effects) + ".")
    if f.libs:
        facts.append("Uses " + plain_list([lib_phrase(l) for l in f.libs]) + ".")
    if f.calls_tools:
        facts.append("Runs other tools in this file: " + plain_list([code(t) for t in f.calls_tools]) + ".")
    if f.calls_other:
        facts.append("Uses tools from other files: " + plain_list(f.calls_other) + ".")
    if f.changes_globals:
        facts.append("Changes shared values that live outside it: " + plain_list([code(g) for g in f.changes_globals]) + ".")
    if f.loops or f.decisions:
        bits = []
        if f.loops:
            bits.append(f"{f.loops} loop{'s' if f.loops != 1 else ''}")
        if f.decisions:
            bits.append(f"{f.decisions} decision{'s' if f.decisions != 1 else ''} (if)")
        facts.append("Contains " + " and ".join(bits) + ".")
    if f.handles:
        facts.append("Handles these errors instead of stopping: " + plain_list([code(h) if h != "any error" else h for h in f.handles]) + ".")
    if f.raises:
        facts.append("Can stop with these errors: " + plain_list([code(r) for r in f.raises]) + ".")
    length = max(getattr(n, "end_lineno", n.lineno) for n in nodes) - start_line(first) + 1
    warnings = list(f.warnings)
    if kind in ("tool", "route") and length > 60:
        warnings.append(f"This tool is {length} lines long. Long tools are hard to follow; it may be doing several jobs that could be split up.")
    for i in range(start_line(first) - 1, min(len(source_lines), start_line(first) - 1 + length)):
        m = re.search(r"#\s*(TODO|FIXME|HACK|XXX)\b:?\s*(.*)", source_lines[i])
        if m:
            warnings.append(f"Line {i + 1} has a {m.group(1)} note: {m.group(2).strip() or '(no details)'}")
    out = dict(title=title, headline=headline, facts=facts, warnings=warnings[:6], steps=steps, more=more,
               name=getattr(first, "name", None) if kind in ("tool", "route", "class") else None)
    if kind == "route":
        path, methods = route_of(first)
        out.update(route_path=path, methods=methods, route_obj=route_obj(first))
    return out


def file_context(tree):
    alias = aliases(tree)
    tools = [n.name for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    lists = [t.id for n in tree.body if isinstance(n, ast.Assign) and isinstance(n.value, ast.List)
             for t in n.targets if isinstance(t, ast.Name)]
    return alias, tools, lists


def overview(name, tree, groups, alias):
    counts = {}
    for g in groups:
        counts[g["kind"]] = counts.get(g["kind"], 0) + (len(g["nodes"]) if g["kind"] in ("tool", "route", "class") else 1)
    parts = []
    if counts.get("route"):
        parts.append(f"{counts['route']} web route{'s' if counts['route'] != 1 else ''}")
    if counts.get("tool"):
        parts.append(f"{counts['tool']} tool{'s' if counts['tool'] != 1 else ''} (functions)")
    if counts.get("class"):
        parts.append(f"{counts['class']} class{'es' if counts['class'] != 1 else ''}")
    libs = sorted(set(v for k, v in alias.items() if v not in _XREF["roots"] and k not in _XREF["names"] and k not in _XREF["modules"]))
    doc = ast.get_docstring(tree)
    kinds = {v for v in alias.values()}
    guess = None
    if kinds & {"flask", "fastapi", "django"}:
        guess = "a web server or web app"
    elif kinds & {"discord", "telegram"}:
        guess = "a chat bot"
    elif kinds & {"pygame"}:
        guess = "a game"
    elif kinds & {"tkinter"}:
        guess = "a desktop app with windows"
    elif kinds & {"streamlit"}:
        guess = "a data web app"
    elif kinds & {"pandas", "numpy", "matplotlib"}:
        guess = "a data-processing script"
    elif kinds & {"argparse", "click"}:
        guess = "a command-line tool"
    text = f"{name} " + (f"looks like {guess}. It " if guess else "")
    text += "contains " + (plain_list(parts) if parts else "top-level steps only") + "."
    if libs:
        text += " It uses " + plain_list([lib_phrase(l) for l in libs], 8) + "."
    if doc:
        text = doc.strip().splitlines()[0] + " " + text
    return text


def analyze_source(name, source):
    lines = source.splitlines()
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        return {"name": name, "ok": False, "error": f"Line {e.lineno}: {e.msg}", "sections": [], "overview": "",
                "lines": len(lines)}
    mark_elifs(tree, lines)
    alias, tools, lists = file_context(tree)
    groups = group_sections(tree)
    sections = []
    for i, g in enumerate(groups):
        start, end = section_span(g["nodes"], lines)
        s = summarise_nodes(g["kind"], g["nodes"], alias, tools, lists, lines)
        s.update(id=i, kind=g["kind"], start=start, end=end)
        sections.append(s)
    return {"name": name, "ok": True, "overview": overview(name, tree, groups, alias), "sections": sections,
            "lines": len(lines)}


def analyze(files):
    """files: list of {"name": ..., "source": ...}"""
    return [analyze_source(f["name"], f["source"]) for f in files]


def nodes_in_range(body, start, end):
    """Statements fully inside [start, end]; descends into blocks that are only partly selected."""
    out = []
    for n in body:
        s, e = start_line(n), getattr(n, "end_lineno", n.lineno)
        if s >= start and e <= end:
            out.append(n)
        elif s <= end and e >= start:
            for field in ("body", "orelse", "finalbody", "handlers"):
                sub = getattr(n, field, None)
                if isinstance(sub, list):
                    out.extend(nodes_in_range([x for x in sub if isinstance(x, ast.AST) and hasattr(x, "lineno")], start, end))
    return out


def summarise(source, start, end):
    lines = source.splitlines()
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        return {"ok": False, "error": f"The file can't be read as Python (line {e.lineno}: {e.msg})."}
    mark_elifs(tree, lines)
    alias, tools, lists = file_context(tree)
    nodes = nodes_in_range(tree.body, start, end)
    if not nodes:
        return {"ok": False, "error": "No complete statement is inside the highlighted lines. Highlight whole lines, or a whole block."}
    if len(nodes) == 1:
        n = nodes[0]
        kind = ("route" if route_of(n) else "tool") if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) else \
            "class" if isinstance(n, ast.ClassDef) else "imports" if isinstance(n, (ast.Import, ast.ImportFrom)) else \
            "settings" if is_setting(n) else "steps"
        s = summarise_nodes(kind, nodes, alias, tools, lists, lines)
    else:
        s = summarise_nodes("steps", nodes, alias, tools, lists, lines)
    first, last = start_line(nodes[0]), max(getattr(n, "end_lineno", n.lineno) for n in nodes)
    if s["title"] in ("Main steps",):
        s["title"] = f"Lines {first}–{last}"
        g = gists(nodes)
        s["headline"] = " ".join(g) if g else f"{len(nodes)} statement{'s' if len(nodes) != 1 else ''}, run in order from line {first}."
    s.update(ok=True, start=first, end=last)
    return s


def full_line_comments(source):
    """{line number: text} for comments that sit on a line of their own."""
    import io
    import tokenize
    out = {}
    try:
        for tok in tokenize.generate_tokens(io.StringIO(source).readline):
            if tok.type == tokenize.COMMENT and tok.line.strip().startswith("#"):
                text = tok.string.lstrip("#").strip()
                if text:
                    out[tok.start[0]] = text
    except (tokenize.TokenError, IndentationError, SyntaxError):
        pass
    return out


def to_sentences(source, force_raw=()):
    """The whole file as sentences. Exact where possible; everything else is kept as python: lines.
    Comments on their own line become notes. force_raw: top-level statement lines to keep as python:."""
    tree = ast.parse(source)
    lines = source.splitlines()
    mark_elifs(tree, lines)
    alias, tools, lists = file_context(tree)
    classes = {n.name for n in tree.body if isinstance(n, ast.ClassDef)}
    # modules imported under their own name anywhere in the file (import os, import json): phrases may use them,
    # because the writer then sees the import and adds none of its own
    modules = {a.name.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.Import)
               for a in n.names if (a.asname or a.name.split(".")[0]) == a.name.split(".")[0]}
    # what names hold, as far as their assignments show: sets, dictionaries and text
    assigns = [(dotted_name(t), n.value) for n in ast.walk(tree) if isinstance(n, ast.Assign) for t in n.targets if dotted_name(t)]
    calls = lambda v: dotted(v.func) if isinstance(v, ast.Call) else ""
    sets = {t for t, v in assigns if isinstance(v, (ast.Set, ast.SetComp)) or calls(v) == "set"}
    dicts = {t for t, v in assigns if isinstance(v, (ast.Dict, ast.DictComp)) or calls(v) in ("dict", "defaultdict", "Counter", "OrderedDict",
             "collections.defaultdict", "collections.Counter", "json.load", "json.loads", "vars")
             or re.search(r"\.(?:get_json|json)$", calls(v))}
    texts = {t for t, v in assigns if isinstance(v, (ast.Constant, ast.JoinedStr)) and isinstance(getattr(v, "value", ""), str)}
    imported = {(a.asname or a.name).split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names}
    sent = Sentences(True, tools, [], known=set(alias) | classes, comments=full_line_comments(source),
                     force_raw=force_raw, classes=classes, alias=alias, modules=modules, sets=sets, dicts=dicts, texts=texts, imported=imported)
    out = []
    for g in group_sections(tree):
        label = {"about": "About", "imports": "Toolkits", "settings": "Settings", "tool": "Tool", "route": "Web route",
                 "class": "Class", "start": "Starting point", "steps": "Main steps"}[g["kind"]]
        if out:
            out.append("")
        out.append(f"note: ── {label} ──")
        if g["kind"] == "about":
            out.extend(sent.docstring(g["nodes"][0], 0))
            sent.last = max(sent.last, g["nodes"][0].end_lineno)
        else:
            out.extend(sent.block(g["nodes"], 0))
    out.extend(sent.notes_before(len(lines) + 1, 0))
    return "\n".join(out) + "\n"


TOO_DEEP = "The code is nested too deeply to read (for example, a very long chain of + or brackets inside brackets)."


def compare(original, generated):
    """Do two sources make the same program? Lists the original lines where they differ.
    Comments don't count; docstrings do (Python keeps them as help text)."""
    try:
        try:
            a = ast.parse(original)
        except (SyntaxError, ValueError) as e:
            return {"same": False, "error": f"The original can't be read (line {getattr(e, 'lineno', None)})."}
        try:
            b = ast.parse(generated)
        except (SyntaxError, ValueError) as e:
            return {"same": False, "error": f"The generated Python can't be read (line {getattr(e, 'lineno', None)}: {getattr(e, 'msg', e)})."}
        if ast.dump(a) == ast.dump(b):
            return {"same": True, "differs": []}
        differs = []
        bd = [ast.dump(x) for x in b.body]
        for x in a.body:
            if ast.dump(x) not in bd:
                differs.append([start_line(x), getattr(x, "end_lineno", x.lineno)])
        return {"same": False, "differs": differs[:20]}
    except RecursionError:
        return {"same": False, "error": TOO_DEEP}
    except MemoryError:
        return {"same": False, "error": "The code is too big to compare."}


# --------------------------------------------------------------------------
# Whole projects: many files, how they connect, where to start
# --------------------------------------------------------------------------

SKIP_DIRS = {"venv", ".venv", "env", ".env", "node_modules", "__pycache__", ".git", "site-packages", "build", "dist",
             ".tox", ".mypy_cache", ".pytest_cache", ".idea", ".vscode", "egg-info"}
EXTRA_FILES = re.compile(r"(^|/)(readme(\.\w+)?|requirements[\w.-]*\.txt|pyproject\.toml|pipfile)$", re.I)
PIP_NAMES = {"PIL": "pillow", "cv2": "opencv-python", "sklearn": "scikit-learn", "yaml": "pyyaml", "bs4": "beautifulsoup4",
             "dotenv": "python-dotenv", "jwt": "pyjwt", "dateutil": "python-dateutil", "telegram": "python-telegram-bot",
             "discord": "discord.py", "psycopg2": "psycopg2-binary", "attr": "attrs", "magic": "python-magic"}
STDLIB = set(getattr(sys, "stdlib_module_names", ())) | {"__future__"}
ROLE_LABEL = {"entry": "Starting point", "routes": "Web routes", "models": "Data models", "settings": "Settings",
              "helpers": "Helpers", "script": "Script", "package": "Package marker", "tests": "Tests"}
ROLE_ORDER = ["entry", "settings", "models", "helpers", "routes", "script", "package", "tests"]
MODEL_BASES = re.compile(r"(^|\.)(Model|Base|BaseModel|SQLModel|Document|Schema|DeclarativeBase)$")


# --------------------------------------------------------------------------
# Style points: where a file shows one of Python's habits (for the tutor and the style tour)
# --------------------------------------------------------------------------

class _StyleFinder(ast.NodeVisitor):
    """Walks a file and notes each habit it shows. The card names match lang/tutor.js."""

    def __init__(self):
        self.found = []
        self.depth = 0          # inside a def or class
        self.parents = []       # the defs and classes around the current node
        self.skip = set()       # calls already explained by an outer call (input inside int(...))

    def add(self, card, node, name=""):
        self.found.append({"card": card, "line": node.lineno, "end": getattr(node, "end_lineno", None) or node.lineno, "name": name})

    def _doc(self, node):
        if node.body and is_docstring(node.body[0]):
            self.add("docstring", node.body[0])

    def _inside(self, node):
        self.depth += 1
        self.parents.append(node)
        self.generic_visit(node)
        self.parents.pop()
        self.depth -= 1

    def visit_Import(self, node):
        self.add("imports", node, node.names[0].name)
        if any(a.asname for a in node.names):
            self.add("import-as", node, next(a.asname for a in node.names if a.asname))

    def visit_ImportFrom(self, node):
        self.add("imports", node, node.module or "")
        self.add("from-import", node, node.module or "")

    def visit_Assign(self, node):
        for t in node.targets:
            if isinstance(t, ast.Name):
                if self.depth == 0 and re.fullmatch(r"[A-Z][A-Z0-9_]+", t.id):
                    self.add("constant", node, t.id)
                elif "_" in t.id.strip("_") and t.id == t.id.lower():
                    self.add("snake-case", node, t.id)
            elif isinstance(t, ast.Attribute) and isinstance(t.value, ast.Name) and t.value.id == "self" \
                    and t.attr.startswith("_") and not t.attr.startswith("__"):
                self.add("private", node, t.attr)
        if isinstance(node.value, ast.List):
            self.add("list", node)
        elif isinstance(node.value, ast.Dict):
            self.add("dict", node)
        self.generic_visit(node)

    def _function(self, node):
        self.add("def", node, node.name)
        if node.name == "__init__" and self.parents and isinstance(self.parents[-1], ast.ClassDef):
            self.add("init", node)
        elif node.name.startswith("_") and not node.name.startswith("__"):
            self.add("private", node, node.name)
        if "_" in node.name.strip("_") and node.name == node.name.lower() and not node.name.startswith("__"):
            self.add("snake-case", node, node.name)
        a = node.args
        if a.defaults or any(d is not None for d in a.kw_defaults):
            self.add("default-args", node, node.name)
        if a.vararg or a.kwarg:
            self.add("star-args", node, node.name)
        if node.returns or any(x.annotation for x in a.posonlyargs + a.args + a.kwonlyargs):
            self.add("type-hints", node, node.name)
        if node.decorator_list:
            self.add("decorator", node.decorator_list[0], node.name)
        if isinstance(node, ast.AsyncFunctionDef):
            self.add("async", node, node.name)
        self.add("indentation", node)
        self._doc(node)
        self._inside(node)

    visit_FunctionDef = visit_AsyncFunctionDef = _function

    def visit_ClassDef(self, node):
        self.add("class", node, node.name)
        if node.decorator_list:
            self.add("decorator", node.decorator_list[0], node.name)
        self.add("indentation", node)
        self._doc(node)
        self._inside(node)

    def visit_If(self, node):
        if is_main_guard(node):
            self.add("main-guard", node)
        else:
            self.add("if", node)
            self.add("indentation", node)
        self.generic_visit(node)

    def visit_For(self, node):
        it = node.iter
        called = it.func.id if isinstance(it, ast.Call) and isinstance(it.func, ast.Name) else ""
        self.add({"range": "range", "enumerate": "enumerate"}.get(called, "for-in"), node)
        self.add("indentation", node)
        self.generic_visit(node)

    visit_AsyncFor = visit_For

    def visit_While(self, node):
        self.add("while", node)
        self.add("indentation", node)
        self.generic_visit(node)

    def visit_With(self, node):
        if any(isinstance(i.context_expr, ast.Call) and isinstance(i.context_expr.func, ast.Name) and i.context_expr.func.id == "open" for i in node.items):
            self.add("with-open", node)
        self.add("indentation", node)
        self.generic_visit(node)

    visit_AsyncWith = visit_With

    def visit_Try(self, node):
        self.add("try", node)
        self.add("indentation", node)
        self.generic_visit(node)

    visit_TryStar = visit_Try

    def visit_ExceptHandler(self, node):
        if node.type is None:
            self.add("bare-except", node)
        self.generic_visit(node)

    def visit_Return(self, node):
        if node.value is not None:
            self.add("return", node)
        self.generic_visit(node)

    def visit_Break(self, node):
        self.add("break", node)

    def visit_Global(self, node):
        self.add("global", node, ", ".join(node.names))

    def visit_AugAssign(self, node):
        self.add("augmented", node)
        self.generic_visit(node)

    def visit_AnnAssign(self, node):
        self.add("type-hints", node)
        self.generic_visit(node)

    def visit_JoinedStr(self, node):
        self.add("f-string", node)
        self.generic_visit(node)

    def visit_ListComp(self, node):
        self.add("comprehension", node)
        self.generic_visit(node)

    visit_SetComp = visit_DictComp = visit_GeneratorExp = visit_ListComp

    def visit_Lambda(self, node):
        self.add("lambda", node)
        self.generic_visit(node)

    def visit_Await(self, node):
        self.add("async", node)
        self.generic_visit(node)

    def visit_Compare(self, node):
        if any(isinstance(o, (ast.Is, ast.IsNot)) for o in node.ops) and any(isinstance(c, ast.Constant) and c.value is None for c in node.comparators):
            self.add("is-none", node)
        if any(isinstance(o, (ast.In, ast.NotIn)) for o in node.ops):
            self.add("in-check", node)
        self.generic_visit(node)

    def visit_Call(self, node):
        f = node.func
        if id(node) not in self.skip:
            if isinstance(f, ast.Name):
                inner = node.args[0] if node.args else None
                if f.id in ("int", "float") and isinstance(inner, ast.Call) and isinstance(inner.func, ast.Name) and inner.func.id == "input":
                    self.add("input-number", node)
                    self.skip.add(id(inner))
                elif f.id == "input":
                    self.add("input", node)
                elif f.id == "print":
                    self.add("print", node)
            elif isinstance(f, ast.Attribute) and f.attr == "append":
                self.add("list", node)
        self.generic_visit(node)

    def visit_Attribute(self, node):
        if isinstance(node.value, ast.Name) and node.value.id == "self":
            self.add("self", node, node.attr)
        self.generic_visit(node)


def style_points(source, every=False):
    """Where a file shows one of Python's habits, in reading order: [{card, line, end, name}].
    `card` names a style card in lang/tutor.js. The first place for each card, or every place (every=True)."""
    tree = ast.parse(source)
    finder = _StyleFinder()
    if tree.body and is_docstring(tree.body[0]):
        finder.add("docstring", tree.body[0])
    finder.visit(tree)
    points = sorted(finder.found, key=lambda p: p["line"])   # stable: the order found within a line stays
    if every:
        return points
    seen, first = set(), []
    for p in points:
        if p["card"] not in seen:
            seen.add(p["card"])
            first.append(p)
    return first


def keep_path(path):
    """Which uploaded files are worth reading. Returns 'py', 'extra', 'secret' or None."""
    parts = path.replace("\\", "/").split("/")
    if any(p in SKIP_DIRS or p.endswith(".egg-info") for p in parts[:-1]):
        return None
    name = parts[-1]
    if name == ".env" or name.startswith(".env."):
        return "secret"
    if name.endswith(".py"):
        return "py"
    if re.search(r"\.(jsx?|mjs|cjs|tsx?|html?|css|cpp|cc|cxx|hpp|hh|h|ino)$", name, re.I):
        return "web"
    if name == "package.json":
        return "extra"
    if EXTRA_FILES.search(path):
        return "extra"
    return None


def module_of(path, root):
    p = path[:-3] if path.endswith(".py") else path
    parts = p.split("/")
    if root and parts[0] == root and len(parts) > 1:
        parts = parts[1:]
    if parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def common_root(paths):
    firsts = {p.split("/")[0] for p in paths}
    return firsts.pop() if len(firsts) == 1 and all("/" in p for p in paths) else ""


def declared_deps(extras):
    deps, found = set(), False
    for f in extras:
        n = f["name"].lower().split("/")[-1]
        if n.startswith("requirements") and n.endswith(".txt"):
            found = True
            for line in f["source"].splitlines():
                line = line.split("#")[0].strip()
                if line and not line.startswith("-"):
                    deps.add(re.split(r"[<>=!~\[; ]", line)[0].lower().replace("_", "-"))
        elif n in ("pyproject.toml", "pipfile"):
            found = True
            for m in re.finditer(r"[\"']([A-Za-z0-9_.-]+)\s*(?:[<>=!~\[;][^\"']*)?[\"']", f["source"]):
                deps.add(m.group(1).lower().replace("_", "-"))
            for m in re.finditer(r"^\s*([A-Za-z0-9_.-]+)\s*=", f["source"], re.M):
                deps.add(m.group(1).lower().replace("_", "-"))
    return deps, found


def readme_intro(extras):
    for f in extras:
        if f["name"].lower().split("/")[-1].startswith("readme"):
            paras = [p.strip() for p in re.split(r"\n\s*\n", f["source"]) if p.strip()]
            for p in paras:
                if not p.startswith(("#", "![", "[!", "<", "```", "---")):
                    text = re.sub(r"[`*_]", "", " ".join(p.split()))
                    return text[:300] + ("…" if len(text) > 300 else "")
    return ""


def resolve(target, modules, root):
    """A dotted import name -> the project file it points to, if any."""
    if not target:
        return None
    t = target[len(root) + 1:] if root and target.startswith(root + ".") else target
    if t in modules:
        return modules[t]
    hits = [p for m, p in modules.items() if m.endswith("." + t)]
    return hits[0] if len(hits) == 1 else None


def file_links(path, tree, modules, root, is_pkg):
    """What this file brings in from other project files."""
    names, mods, targets = {}, {}, set()
    here = module_of(path, root)
    for n in ast.walk(tree):
        if isinstance(n, ast.ImportFrom):
            if n.level:
                base = here.split(".") if here else []
                if not is_pkg:
                    base = base[:-1]
                base = base[:len(base) - (n.level - 1)] if n.level > 1 else base
                target = ".".join(base + ([n.module] if n.module else []))
            else:
                target = n.module
            for a in n.names:
                sub = resolve(f"{target}.{a.name}" if target else a.name, modules, root)
                if sub:
                    mods[a.asname or a.name] = sub
                    targets.add(sub)
                    continue
                dest = resolve(target, modules, root)
                if dest and a.name != "*":
                    names[a.asname or a.name] = dest
                    targets.add(dest)
                elif dest:
                    targets.add(dest)
        elif isinstance(n, ast.Import):
            for a in n.names:
                dest = resolve(a.name, modules, root)
                if dest:
                    mods[a.asname or a.name] = dest
                    targets.add(dest)
    targets.discard(path)
    return names, mods, targets


def role_of(path, tree, analysis, alias):
    name = path.split("/")[-1]
    kinds = [s["kind"] for s in analysis["sections"]]
    libs = set(alias.values())
    top_calls = {dotted(n.value.func) for n in tree.body if isinstance(n, ast.Expr) and isinstance(n.value, ast.Call)}
    if name.startswith("test_") or name.endswith("_test.py") or "/tests/" in "/" + path or (libs & {"pytest", "unittest"} and "test" in path):
        return "tests"
    if name == "__init__.py" and set(kinds) <= {"imports", "about", "settings"}:
        return "package"
    starts = "start" in kinds or any(c.endswith(("app.run", "uvicorn.run", "main")) for c in top_calls)
    if starts or (name in ("main.py", "app.py", "manage.py", "run.py", "__main__.py", "bot.py", "server.py") and "steps" in kinds):
        return "entry"
    if "route" in kinds:
        return "routes"
    for n in tree.body:
        if isinstance(n, ast.ClassDef) and any(MODEL_BASES.search(dotted(b)) for b in n.bases):
            return "models"
        if isinstance(n, ast.ClassDef) and any(dotted(d).endswith("dataclass") for d in n.decorator_list):
            return "models"
    if set(kinds) <= {"imports", "about", "settings"} or re.search(r"(config|settings|constants)", name):
        return "settings"
    if "tool" in kinds or "class" in kinds:
        return "helpers"
    return "script"


def one_line(role, analysis, tree):
    doc = ast.get_docstring(tree)
    secs = analysis["sections"]
    names = lambda k: [s["name"] for s in secs if s["kind"] == k and s.get("name")]
    if role == "routes":
        paths = [s["title"].replace("Web route ", "") for s in secs if s["kind"] == "route"]
        text = f"{len(paths)} web route{'s' if len(paths) != 1 else ''}: " + plain_list([code(p) for p in paths], 4)
    elif role == "models":
        text = "Data models: " + plain_list([code(n) for n in names("class")], 5)
    elif role == "helpers":
        items = names("tool") + names("class")
        text = "Tools: " + plain_list([code(n) for n in items], 5)
    elif role == "settings":
        count = sum(1 for n in tree.body if is_setting(n))
        text = f"{count} setting{'s' if count != 1 else ''}"
    elif role == "tests":
        count = len([n for n in names("tool") if n.startswith("test")])
        text = f"{count} test{'s' if count != 1 else ''}"
    elif role == "package":
        text = "Marks this folder as a package so other files can import from it"
    elif role == "entry":
        text = "Starts the program"
    else:
        text = f"{len(secs)} section{'s' if len(secs) != 1 else ''}"
    return (doc.strip().splitlines()[0] + " · " if doc and doc.strip() else "") + text


def guess_kind(libs):
    if libs & {"flask", "fastapi", "django"}:
        return "a web server or web app"
    if libs & {"discord", "telegram"}:
        return "a chat bot"
    if libs & {"pygame"}:
        return "a game"
    if libs & {"tkinter"}:
        return "a desktop app with windows"
    if libs & {"streamlit"}:
        return "a data web app"
    if libs & {"pandas", "numpy", "matplotlib"}:
        return "a data-processing project"
    if libs & {"argparse", "click"}:
        return "a command-line tool"
    return None


def analyze_project(files):
    """files: list of {"name": path, "source": text}. Python files are read; README/requirements give context."""
    global _XREF
    _USES.clear()
    _PROJECT.clear()
    py = [f for f in files if keep_path(f["name"]) == "py"]
    extras = [f for f in files if keep_path(f["name"]) == "extra"]
    secrets = [f["name"] for f in files if keep_path(f["name"]) == "secret"]
    root = common_root([f["name"] for f in py]) if len(py) > 1 else ""
    modules = {module_of(f["name"], root): f["name"] for f in py}
    roots = {m.split(".")[0] for m in modules if m} | ({root} if root else set())

    trees, results = {}, []
    for f in py:
        path = f["name"]
        try:
            tree = ast.parse(f["source"])
        except SyntaxError:
            tree = None
        trees[path] = tree
        names, mods, targets = file_links(path, tree, modules, root, path.endswith("__init__.py")) if tree else ({}, {}, set())
        _XREF = {"names": names, "modules": mods, "roots": roots, "path": path}
        _PROJECT[path] = {"xref": _XREF}
        a = analyze_source(path, f["source"])
        short = path[len(root) + 1:] if root and path.startswith(root + "/") else path
        a["overview"] = a.get("overview", "").replace(path, short, 1)
        alias = aliases(tree) if tree else {}
        role = role_of(path, tree, a, alias) if tree else "script"
        results.append({"path": path, "module": module_of(path, root), "role": role, "role_label": ROLE_LABEL[role],
                        "summary": one_line(role, a, tree) if tree else "Can't be read as Python: " + a.get("error", ""),
                        "imports": sorted(targets), "imported_by": [], "analysis": a,
                        "libs": sorted({v for k, v in alias.items() if v not in roots and k not in names and k not in mods}),
                        "lines": a["lines"]})
    _XREF = {"names": {}, "modules": {}, "roots": set(), "path": ""}

    # full web addresses for routes, including Blueprint / router prefixes
    prefixes = route_prefixes(trees.values())
    for r in results:
        for sec in r["analysis"].get("sections", []):
            if sec.get("route_path") is not None:
                pre = prefixes.get((sec.get("route_obj") or "").split(".")[-1], "")
                sec["full_path"] = ("/" + (pre.strip("/") + "/" + sec["route_path"].lstrip("/")).strip("/")).replace("//", "/") if pre else sec["route_path"]
                if pre:
                    sec["facts"].insert(0, f"Its full web address is {code(sec['full_path'])} (the {code(pre)} part comes from where it is registered).")
    by_path = {r["path"]: r for r in results}
    for r in results:
        for t in r["imports"]:
            if t in by_path and r["path"] not in by_path[t]["imported_by"]:
                by_path[t]["imported_by"].append(r["path"])
    # "Used in other files" on the tools themselves
    used = {}
    for src, dst, name in _USES:
        if src != dst:
            used.setdefault((dst, name), set()).add(src)
    for r in results:
        for s in r["analysis"].get("sections", []):
            users = used.get((r["path"], s.get("name")))
            if users:
                s["facts"].insert(1, "Used in other files: " + plain_list([f"[[{u}]]" for u in sorted(users)]) + ".")

    # where to start
    def entry_score(r):
        tree = trees[r["path"]]
        score = 0
        if r["role"] == "entry":
            score += 3
        if tree and any(is_main_guard(n) for n in tree.body):
            score += 3
        if r["path"].split("/")[-1] in ("main.py", "app.py", "manage.py", "run.py", "__main__.py"):
            score += 2
        if not r["imported_by"]:
            score += 1
        return score
    ranked = sorted([r for r in results if r["role"] not in ("tests", "package")], key=lambda r: -entry_score(r))
    entries = [r["path"] for r in ranked if entry_score(r) >= 4][:3] or ([ranked[0]["path"]] if ranked else [])
    order, seen, queue = [], set(), list(entries)
    while queue:
        p = queue.pop(0)
        if p in seen:
            continue
        seen.add(p)
        order.append(p)
        queue.extend(t for t in by_path[p]["imports"] if t not in seen)
    rest = sorted((r for r in results if r["path"] not in seen), key=lambda r: (ROLE_ORDER.index(r["role"]), r["path"]))
    order += [r["path"] for r in rest]
    # libraries and dependencies
    libs = {}
    for r in results:
        for l in r["libs"]:
            libs.setdefault(l, []).append(r["path"])
    third = sorted(l for l in libs if l not in STDLIB)
    declared, has_list = declared_deps(extras)
    project_warnings = []
    if secrets:
        project_warnings.append(f"The project includes {plain_list([code(s) for s in secrets])}, which usually holds passwords and keys. IntuaCode didn't read it. Make sure it is never shared or pushed to GitHub (add it to .gitignore).")
    if third and has_list:
        missing = [l for l in third if PIP_NAMES.get(l, l).lower().replace("_", "-") not in declared]
        if missing:
            project_warnings.append("These libraries are used but not listed in the requirements, so a fresh install would fail: "
                                    + plain_list([f"{code(l)} (install name {code(PIP_NAMES.get(l, l))})" for l in missing], 8) + ".")
    elif third:
        project_warnings.append("There's no requirements.txt, so nothing records which libraries to install: "
                                + plain_list([code(PIP_NAMES.get(l, l)) for l in third], 8) + ".")
    if not any(r["role"] == "tests" for r in results):
        project_warnings.append("There are no tests, so nothing checks that the code still works after a change.")
    for r in results:
        if not r["analysis"].get("ok"):
            project_warnings.append(f"[[{r['path']}]] can't be read as Python ({r['analysis'].get('error')}).")

    kind = guess_kind(set(libs))
    roles = {}
    for r in results:
        roles.setdefault(r["role"], []).append(r["path"])
    total_lines = sum(r["lines"] for r in results)
    name = root or (py[0]["name"].split("/")[0] if py and "/" in py[0]["name"] else "this project")
    text = f"{name} " + (f"looks like {kind}. It has " if kind else "has ") + f"{len(results)} Python file{'s' if len(results) != 1 else ''} ({total_lines} lines)."
    if entries:
        e = by_path[entries[0]]
        why = "it has the starting point" if e["role"] == "entry" else "nothing else uses it, so it is likely where things begin"
        text += f" Start reading at [[{entries[0]}]]: {why}."
    noun = {"settings": "settings file", "models": "data model file", "helpers": "helper file", "routes": "web route file",
            "script": "script", "tests": "test file"}
    counted = [f"{len(roles[k])} {noun[k]}{'s' if len(roles[k]) != 1 else ''}" for k in ROLE_ORDER if k in roles and k in noun]
    if counted:
        text += " It also has " + plain_list(counted, 7) + "."
    if third:
        text += " Outside libraries: " + plain_list([lib_phrase(l) for l in third], 8) + "."
    return {
        "ok": True, "name": name, "overview": text, "readme": readme_intro(extras), "entries": entries, "order": order,
        "files": results, "edges": [[r["path"], t] for r in results for t in r["imports"]],
        "libs": [{"name": l, "what": LIBRARIES.get(l, ""), "files": libs[l], "stdlib": l in STDLIB} for l in sorted(libs)],
        "declared": sorted(declared), "has_requirements": has_list, "secrets": secrets,
        "warnings": project_warnings, "extras": [f["name"] for f in extras],
    }


def read_zip(data):
    """A .zip of a project -> the files worth reading (text only, size-limited)."""
    import io
    import zipfile
    out = []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for info in z.infolist():
            if info.is_dir() or info.file_size > 600_000:
                continue
            kind = keep_path(info.filename)
            if not kind:
                continue
            if kind == "secret":
                out.append({"name": info.filename, "source": ""})
                continue
            try:
                out.append({"name": info.filename, "source": z.read(info).decode("utf-8").replace("\r\n", "\n")})
            except UnicodeDecodeError:
                continue
            if len(out) >= 400:
                break
    return out


# JSON wrappers for the browser
def analyze_project_json(files_json):
    return json.dumps(analyze_project(json.loads(files_json)))


def read_zip_json(data):
    return json.dumps(read_zip(bytes(data)))

def compare_json(original, generated):
    return json.dumps(compare(original, generated))


def analyze_json(files_json):
    return json.dumps(analyze(json.loads(files_json)))


def summarise_json(source, start, end, path=""):
    global _XREF
    _XREF = _PROJECT.get(path, {}).get("xref") or {"names": {}, "modules": {}, "roots": set(), "path": ""}
    try:
        return json.dumps(summarise(source, int(start), int(end)))
    finally:
        _XREF = {"names": {}, "modules": {}, "roots": set(), "path": ""}


def to_sentences_json(source, force_raw_json="[]"):
    try:
        return json.dumps({"ok": True, "text": to_sentences(source, set(json.loads(force_raw_json)))})
    except SyntaxError as e:   # also: null bytes in the code
        return json.dumps({"ok": False, "error": f"Line {e.lineno}: {e.msg}" if e.lineno else e.msg})
    except RecursionError:
        return json.dumps({"ok": False, "error": TOO_DEEP})
    except (ValueError, MemoryError) as e:
        return json.dumps({"ok": False, "error": f"The code can't be read: {e or 'it is too big'}."})


def style_points_json(source, every=False):
    try:
        return json.dumps({"ok": True, "points": style_points(source, bool(every))})
    except SyntaxError as e:
        return json.dumps({"ok": False, "error": f"Line {e.lineno}: {e.msg}" if e.lineno else e.msg})
    except RecursionError:
        return json.dumps({"ok": False, "error": TOO_DEEP})
    except (ValueError, MemoryError) as e:
        return json.dumps({"ok": False, "error": f"The code can't be read: {e or 'it is too big'}."})


def _read(path):
    with open(path, encoding="utf-8-sig") as f:   # -sig: a byte-order mark (Notepad adds one) isn't code
        return f.read()


def _cli(argv):
    """python3 python_reader.py summary FILE | sentences FILE | compare ORIGINAL GENERATED | project DIR"""
    import os
    # files, the terminal and piped JSON are UTF-8 everywhere (Windows would use its own code page)
    for stream in (sys.stdin, sys.stdout):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    cmd = argv[1] if len(argv) > 1 else "summary"
    if cmd == "sentences":
        print(to_sentences(_read(argv[2])), end="")
    elif cmd == "sentences-json":      # stdin: JSON list of sources -> JSON list of sentence texts
        print(json.dumps([to_sentences(src) for src in json.load(sys.stdin)]))
    elif cmd == "compare":
        print(json.dumps(compare(_read(argv[2]), _read(argv[3]))))
    elif cmd == "compare-json":        # stdin: JSON list of [original, generated] -> JSON list of results
        print(json.dumps([compare(a, b) for a, b in json.load(sys.stdin)]))
    elif cmd == "style":
        for p in style_points(_read(argv[2])):
            print(f"  line {p['line']:<4} {p['card']:<14} {p['name']}")
    elif cmd == "style-json":          # stdin: JSON list of sources -> JSON list of style_points_json results
        print(json.dumps([json.loads(style_points_json(src, True)) for src in json.load(sys.stdin)]))
    elif cmd == "project":
        files = []
        for base, dirs, names in os.walk(argv[2]):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for n in names:
                path = os.path.relpath(os.path.join(base, n), os.path.dirname(os.path.abspath(argv[2])))
                if keep_path(path):
                    if keep_path(path) == "secret":
                        files.append({"name": path, "source": ""})
                        continue
                    with open(os.path.join(base, n), encoding="utf-8-sig", errors="replace") as f:
                        files.append({"name": path, "source": f.read()})
        p = analyze_project(files)
        print(p["overview"].replace("[[", "").replace("]]", ""))
        for w in p["warnings"]:
            print("  !", w.replace("[[", "").replace("]]", ""))
        for path in p["order"]:
            f = next(x for x in p["files"] if x["path"] == path)
            print(f"  {path:40} {f['role_label']:15} {f['summary'][:70]}")
    else:
        path = argv[2] if cmd == "summary" else argv[1]
        src = _read(path)
        for sec in analyze_source(path, src)["sections"]:
            print(f"\n[{sec['kind']}] {sec['title']}  (lines {sec['start']}-{sec['end']})")
            print("  " + sec["headline"])
            for fact in sec["facts"]:
                print("   -", fact)
            for w in sec["warnings"]:
                print("   !", w)
            for st in sec["steps"]:
                print("     |", st)


if __name__ == "__main__":
    _cli(sys.argv)
