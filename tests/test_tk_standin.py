"""The stand-in tkinter (tests/helpers/tk_standin.py) does what tkinter does, for the parts the meaning examples
use. The same checks run on both: the real tkinter where there's a screen to make a window on, and the stand-in
everywhere. Run: python -m unittest discover -s tests"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "helpers"))
import tk_standin  # noqa: E402

try:
    import tkinter as real_tk
    real_tk.Tk().destroy()
except Exception:   # (no tkinter, or no screen: CI)
    real_tk = None


def same_as_tkinter(test, tk):
    root = tk.Tk()
    try:
        clicks = []
        b = tk.Button(root, text="Add", command=lambda: clicks.append(1) or "done")
        b.pack(pady=5)
        test.assertEqual((b.cget("text"), b["text"], b.winfo_manager()), ("Add", "Add", "pack"))
        test.assertEqual(int(b.pack_info()["pady"]), 5)
        test.assertEqual((str(b.invoke()), clicks), ("done", [1]))   # a click runs the command
        with test.assertRaises(tk.TclError):
            tk.Label(root, text="x", command=print)   # a label has no command
        with test.assertRaises(tk.TclError):
            tk.Entry(root, command=print)   # an entry has no command
        test.assertEqual(str(tk.Entry(root, text="v").cget("textvariable")), "v")   # "text" is short for textvariable
        with test.assertRaises(tk.TclError):
            tk.Label(root).pack(row=1)   # packing has no rows
        e = tk.Entry(root, width=40)
        e.pack()
        e.insert(0, "hi")
        e.insert(tk.END, "!")
        test.assertEqual((e.get(), int(e.cget("width"))), ("hi!", 40))
        e.delete(0, tk.END)
        test.assertEqual(e.get(), "")
        lb = tk.Listbox(root)
        lb.pack()
        lb.insert(tk.END, "a")
        lb.insert(tk.END, "b")
        test.assertEqual((lb.get(0), lb.get(0, tk.END), lb.size()), ("a", ("a", "b"), 2))
        lb.delete(0)
        test.assertEqual(lb.get(0, tk.END), ("b",))
        test.assertEqual(root.winfo_children()[:1], [b])
        with test.assertRaises(tk.TclError):
            tk.Label(root, text="Name").grid(row=0, column=1)   # one window: packed or a grid, not both
        f = tk.Frame(root)
        f.place(x=10, y=20)
        test.assertEqual((int(f.place_info()["x"]), f.winfo_manager()), (10, "place"))
        g = tk.Frame(root)
        g.pack()
        n = tk.Label(g, text="Name")
        n.grid(row=0, column=1)
        test.assertEqual((int(n.grid_info()["row"]), int(n.grid_info()["column"])), (0, 1))
    finally:
        root.destroy()


class StandIn(unittest.TestCase):
    def test_does_what_tkinter_does(self):
        same_as_tkinter(self, tk_standin)

    @unittest.skipIf(real_tk is None, "no screen to make a window on")
    def test_the_checks_hold_for_the_real_tkinter(self):
        same_as_tkinter(self, real_tk)

    def test_put_in_place(self):
        kept = {k: sys.modules.get(k) for k in ("tkinter", "tkinter.messagebox")}
        try:
            tk_standin.put_in_place()
            import tkinter
            from tkinter import messagebox
            self.assertIs(tkinter.Button, tk_standin.Button)
            self.assertEqual(messagebox.askyesno("Sure?", "Really?"), True)
            self.assertEqual(messagebox.shown, [("askyesno", "Sure?", "Really?")])
        finally:
            for k, v in kept.items():
                if v is None:
                    sys.modules.pop(k, None)
                else:
                    sys.modules[k] = v


if __name__ == "__main__":
    unittest.main()
