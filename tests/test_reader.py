"""Tests for the Python reader.  Run: python3 -m unittest discover -s tests"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
import zipfile
import io

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "lang"))
import python_reader as R  # noqa: E402


def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()


def taskboard():
    names = json.loads(read("samples/taskboard/files.json"))["files"]
    return [{"name": "taskboard/" + n, "source": read("samples/taskboard/" + n)} for n in names]


class SingleFile(unittest.TestCase):
    def setUp(self):
        self.a = R.analyze_source("todo_app.py", read("samples/todo_app.py"))

    def test_sections(self):
        kinds = [s["kind"] for s in self.a["sections"]]
        self.assertEqual(kinds[:3], ["about", "imports", "settings"])
        self.assertEqual(kinds.count("route"), 3)
        self.assertIn("start", kinds)

    def test_flags(self):
        warnings = " ".join(w for s in self.a["sections"] for w in s["warnings"])
        for phrase in ("looks like a secret", "SQL injection", "fail silently", "debug=True"):
            self.assertIn(phrase, warnings)

    def test_gist(self):
        s = R.summarise(read("samples/todo_app.py"), 66, 70)
        self.assertTrue(s["ok"])
        self.assertIn("Counts how many items in `todos`", s["headline"])

    def test_nothing_selected(self):
        self.assertFalse(R.summarise(read("samples/todo_app.py"), 16, 16)["ok"])

    def test_compare(self):
        self.assertTrue(R.compare("x = 1\n", "x = 1  # hi\n")["same"])
        self.assertFalse(R.compare("x = 1\n", "x = 2\n")["same"])

    def test_compare_counts_docstrings(self):
        # __doc__ is used by help(), docopt, argparse and doctests: a lost or changed docstring is a different program
        self.assertFalse(R.compare('def f():\n    """Adds."""\n    return 1\n', "def f():\n    return 1\n")["same"])
        self.assertFalse(R.compare('"""Usage: a"""\n', '"""Usage: b"""\n')["same"])
        self.assertFalse(R.compare('class E(Exception):\n    """Missing."""\n', "class E(Exception):\n    pass\n")["same"])
        self.assertTrue(R.compare('def f():\n    """Adds."""\n', "def f():\n    '''Adds.'''\n")["same"])

    def test_deep_code_is_a_clean_error(self):
        deep = "x = " + " + ".join(["a"] * 3000) + "\n"
        res = json.loads(R.to_sentences_json(deep))
        self.assertFalse(res["ok"])
        self.assertIn("nested too deeply", res["error"])
        self.assertIn("nested too deeply", R.compare(deep, deep)["error"])
        self.assertFalse(json.loads(R.to_sentences_json("x = 1\0\n"))["ok"])


class Sentences(unittest.TestCase):
    def test_comments_become_notes(self):
        text = R.to_sentences("# set things up\nx = 1\nif x:\n    # say it\n    print(x)\n# the end\n")
        self.assertIn("note: set things up\nset x to 1", text)
        self.assertIn("    note: say it\n    show x", text)
        self.assertTrue(text.rstrip().endswith("note: the end"))

    def test_force_raw_keeps_exact_code(self):
        text = R.to_sentences("x = 1\ny = 2\n", {2})
        self.assertIn("set x to 1", text)
        self.assertIn("python: y = 2", text)

    def test_docstrings_are_kept(self):
        text = R.to_sentences('class NotFound(Exception):\n    """Raised when missing."""\n\n\ndef f():\n    """Line one.\n\n    Line two.\n    """\n    return 1\n')
        self.assertIn("define class NotFound based on Exception\n    description: Raised when missing.", text)
        self.assertIn("    description: Line one.\n    description:\n    description: Line two.\n    description:\n", text)
        self.assertNotIn("note: Line one", text)

    def test_add_and_remove_say_to_and_from_once(self):
        text = R.to_sentences('import random\nnames = []\nnames.append("Walk to the shop")\nnames.append(random.randint(1, 6))\nnames.remove(random.choice(names))\n')
        self.assertIn('add "Walk to the shop" to names', text)
        self.assertIn("python: names.append(random.randint(1, 6))", text)
        self.assertIn("python: names.remove(random.choice(names))", text)

    def test_command_line_reads_and_writes_utf8(self):
        with tempfile.TemporaryDirectory() as d:
            env = {k: v for k, v in os.environ.items() if not k.startswith("PYTHONIO") and k != "PYTHONUTF8"}
            for encoding in ("utf-8", "utf-8-sig"):   # with and without the byte-order mark Notepad adds
                path = os.path.join(d, encoding + ".py")
                with open(path, "w", encoding=encoding) as f:
                    f.write('print("héllo ✓ — ünïcode")\n')
                out = subprocess.run([sys.executable, os.path.join(ROOT, "lang", "python_reader.py"), "sentences", path],
                                     capture_output=True, env=env, check=True).stdout.decode("utf-8")
                self.assertIn('show "héllo ✓ — ünïcode"', out)
            piped = subprocess.run([sys.executable, os.path.join(ROOT, "lang", "python_reader.py"), "sentences-json"],
                                   input=json.dumps(['print("é ✓")\n'], ensure_ascii=False).encode("utf-8"),
                                   capture_output=True, env=env, check=True).stdout.decode("utf-8")
            self.assertIn('show "é ✓"', json.loads(piped)[0])

    def test_classes_errors_files(self):
        text = R.to_sentences(read("tests/corpus/bank_account.py"))
        for phrase in ("define class Account", "set self.balance to balance", "fail with ValueError:",
                       "if it fails with InsufficientFunds as e", "make a new Account with"):
            self.assertIn(phrase, text)
        self.assertIn("open the file DATA_FILE for writing as f", R.to_sentences(read("tests/corpus/inventory_cli.py")))


STYLE_SAMPLE = '''import os
import sys

import requests

from my_local_package import local_helper

CONFIG_CONSTANT = "production"


class DataProcessor:
    """Processes user information securely."""

    def __init__(self, user_id):
        self.user_id = user_id
        self._cache = {}  # Internal-use attribute


def fetch_system_status():
    """Retrieves current platform operating status."""
    return "Active"


if __name__ == "__main__":
    # Execution starts here when run from terminal
    status = fetch_system_status()
    print(f"System: {status}")
'''


class Style(unittest.TestCase):
    def test_tour_follows_the_file(self):
        cards = [(p["line"], p["card"]) for p in R.style_points(STYLE_SAMPLE)]
        self.assertEqual(cards, [
            (1, "imports"), (6, "from-import"), (8, "constant"), (11, "class"), (11, "indentation"), (12, "docstring"),
            (14, "def"), (14, "init"), (15, "self"), (16, "private"), (16, "dict"), (19, "snake-case"), (21, "return"),
            (24, "main-guard"), (27, "print"), (27, "f-string")])

    def test_every_place_and_clean_errors(self):
        every = R.style_points(STYLE_SAMPLE, every=True)
        self.assertEqual([p["line"] for p in every if p["card"] == "imports"], [1, 2, 4, 6])
        self.assertEqual([p["name"] for p in every if p["card"] == "self"], ["user_id", "_cache"])
        bad = json.loads(R.style_points_json("if x\n"))
        self.assertFalse(bad["ok"])
        self.assertIn("Line 1", bad["error"])

    def test_nested_habits(self):
        src = ("def ask(prompt='Age? ', *rest) -> int:\n    return int(input(prompt))\n"
               "for i, n in enumerate(nums):\n    if n is None or n in seen:\n        break\n"
               "try:\n    x = 1\nexcept:\n    pass\n")
        cards = {p["card"] for p in R.style_points(src)}
        self.assertTrue({"default-args", "star-args", "type-hints", "input-number", "enumerate", "is-none", "in-check", "break", "try", "bare-except"} <= cards)
        self.assertNotIn("input", cards)   # int(input(...)) is explained once, as asking for a number


class Project(unittest.TestCase):
    def setUp(self):
        self.p = R.analyze_project(taskboard())
        self.files = {f["path"]: f for f in self.p["files"]}

    def test_start_and_order(self):
        self.assertEqual(self.p["entries"], ["taskboard/app.py"])
        self.assertEqual(self.p["order"][0], "taskboard/app.py")

    def test_roles(self):
        roles = {p.split("/", 1)[1]: f["role"] for p, f in self.files.items()}
        self.assertEqual(roles["routes/tasks.py"], "routes")
        self.assertEqual(roles["models.py"], "models")
        self.assertEqual(roles["config.py"], "settings")
        self.assertEqual(roles["tests/test_text.py"], "tests")
        self.assertEqual(roles["routes/__init__.py"], "package")

    def test_links(self):
        self.assertIn(["taskboard/routes/tasks.py", "taskboard/db.py"], self.p["edges"])
        self.assertIn("taskboard/routes/tasks.py", self.files["taskboard/db.py"]["imported_by"])
        facts = " ".join(f for s in self.files["taskboard/db.py"]["analysis"]["sections"] for f in s["facts"])
        self.assertIn("Used in other files: [[taskboard/routes/tasks.py]]", facts)

    def test_missing_requirement(self):
        self.assertTrue(any("python-dotenv" in w for w in self.p["warnings"]))


class Import(unittest.TestCase):
    def test_keep_path(self):
        self.assertEqual(R.keep_path("a/b.py"), "py")
        self.assertEqual(R.keep_path("a/.venv/x.py"), None)
        self.assertEqual(R.keep_path("a/.env"), "secret")
        self.assertEqual(R.keep_path("a/requirements.txt"), "extra")
        self.assertEqual(R.keep_path("a/logo.png"), None)

    def test_zip_never_keeps_secret_contents(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("p/app.py", "print(1)\n")
            z.writestr("p/.env", "KEY=secret")
            z.writestr("p/node_modules/x.py", "x=1")
        files = {f["name"]: f["source"] for f in R.read_zip(buf.getvalue())}
        self.assertEqual(files, {"p/app.py": "print(1)\n", "p/.env": ""})


if __name__ == "__main__":
    unittest.main()
