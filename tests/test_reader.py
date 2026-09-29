"""Tests for the Python reader.  Run: python3 -m unittest discover -s tests"""
import json
import os
import sys
import unittest
import zipfile
import io

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "lang"))
import python_reader as R  # noqa: E402


def read(p):
    return open(os.path.join(ROOT, p)).read()


def taskboard():
    base = os.path.join(ROOT, "samples/taskboard")
    names = json.load(open(os.path.join(base, "files.json")))["files"]
    return [{"name": "taskboard/" + n, "source": open(os.path.join(base, n)).read()} for n in names]


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

    def test_classes_errors_files(self):
        text = R.to_sentences(read("tests/corpus/bank_account.py"))
        for phrase in ("define class Account", "set self.balance to balance", "fail with ValueError:",
                       "if it fails with InsufficientFunds as e", "make a new Account with"):
            self.assertIn(phrase, text)
        self.assertIn("open the file DATA_FILE for writing as f", R.to_sentences(read("tests/corpus/inventory_cli.py")))


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
