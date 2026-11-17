"""A stand-in for tkinter, so the Python writer's words for window parts can be run where there's no screen (CI).

It draws nothing. A window keeps its parts; each part keeps what it was made with, and how it was placed. What it
does is what tkinter does for the parts the words use (tests/test_tk_standin.py checks it against the real
tkinter wherever there's a screen):

- Tk, Frame, Button, Label, Entry, Listbox, Text, Checkbutton: made with their parent and options. An option the
  part doesn't have stops with TclError (a Label has no command), as tkinter does.
- `cget(name)` and `part[name]`, `configure(...)`, `winfo_children()`, `destroy()`.
- `pack`, `grid`, `place`, and `winfo_manager()`, `pack_info()`, `grid_info()`, `place_info()` with what was given.
- A Button's `invoke()` runs its command, as a click does, and gives back what the command gave.
- Entry: `insert`, `get`, `delete`; Listbox: `insert`, `get`, `delete`, `size`; END; StringVar, IntVar.
- messagebox: showinfo, showwarning, showerror, askyesno (answers yes), noted in `messagebox.shown`.
- `mainloop()` gives back at once: there are no events to wait for.
"""
import sys
import types

END = "end"


class TclError(Exception):
    pass


COMMON = {"bg", "background", "fg", "foreground", "font", "relief", "bd", "borderwidth", "cursor", "width",
          "height", "highlightthickness", "highlightbackground", "highlightcolor", "takefocus"}
TEXTY = {"text", "textvariable", "anchor", "justify", "padx", "pady", "image", "compound", "wraplength", "state",
         "activebackground", "activeforeground", "underline", "disabledforeground"}
OPTIONS = {
    "Tk": {"bg", "background", "width", "height", "cursor", "relief", "bd", "borderwidth", "padx", "pady"},
    "Frame": {"bg", "background", "width", "height", "relief", "bd", "borderwidth", "padx", "pady", "cursor",
              "highlightthickness", "highlightbackground", "highlightcolor", "takefocus"},
    "Label": COMMON | TEXTY,
    "Button": COMMON | TEXTY | {"command", "default", "overrelief", "repeatdelay", "repeatinterval"},
    "Checkbutton": COMMON | TEXTY | {"command", "variable", "onvalue", "offvalue", "selectcolor", "indicatoron"},
    "Entry": COMMON | {"textvariable", "justify", "state", "show", "exportselection", "insertbackground",
                       "selectbackground", "selectforeground", "readonlybackground", "disabledbackground"},
    "Listbox": COMMON | {"selectmode", "exportselection", "listvariable", "activestyle", "selectbackground",
                         "selectforeground", "state", "justify"},
    "Text": COMMON | {"wrap", "padx", "pady", "state", "insertbackground", "selectbackground", "undo", "spacing1"},
}
PLACES = {"pack": {"side", "fill", "expand", "padx", "pady", "ipadx", "ipady", "anchor", "before", "after", "in_"},
          "grid": {"row", "column", "rowspan", "columnspan", "sticky", "padx", "pady", "ipadx", "ipady", "in_"},
          "place": {"x", "y", "relx", "rely", "width", "height", "relwidth", "relheight", "anchor", "bordermode", "in_"}}


class Misc:
    kind = "Misc"

    def __init__(self, master=None, cnf=None, **kw):
        self.master, self.children_, self.manager, self.placed = master, [], "", {}
        self.options = {}
        self.configure(**{**(cnf or {}), **kw})
        if master is not None:
            master.children_.append(self)

    def _option(self, k):
        # (Tk takes the start of an option's name when only one option starts so: an Entry's "text" is its
        # "textvariable")
        known = OPTIONS[self.kind]
        if k in known:
            return k
        starting = [o for o in known if o.startswith(k)]
        if len(starting) == 1:
            return starting[0]
        raise TclError(f'unknown option "-{k}"')

    def configure(self, cnf=None, **kw):
        for k, v in {**(cnf or {}), **kw}.items():
            self.options[self._option(k)] = v

    config = configure

    def cget(self, key):
        return self.options.get(self._option(key), "")

    __getitem__ = cget

    def __setitem__(self, key, value):
        self.configure(**{key: value})

    def winfo_children(self):
        return list(self.children_)

    def destroy(self):
        if self.master is not None and self in self.master.children_:
            self.master.children_.remove(self)

    def _place(self, how, kw):
        for k in kw:
            if k not in PLACES[how]:
                raise TclError(f'bad option "-{k}"')
        # (one window's parts are packed or put in its grid, not both: tkinter stops)
        other = {"pack": "grid", "grid": "pack"}.get(how)
        if other and self.master is not None and any(p.manager == other for p in self.master.children_ if p is not self):
            raise TclError(f"cannot use geometry manager {how} inside . which already has slaves managed by {other}")
        self.manager, self.placed = how, dict(kw)

    def pack(self, cnf=None, **kw):
        self._place("pack", {**(cnf or {}), **kw})

    def grid(self, cnf=None, **kw):
        self._place("grid", {**(cnf or {}), **kw})

    def place(self, cnf=None, **kw):
        self._place("place", {**(cnf or {}), **kw})

    def winfo_manager(self):
        return self.manager

    def _info(self, how):
        if self.manager != how:
            raise TclError(f'window "{self}" isn\'t {how}ed')
        return dict(self.placed)

    def pack_info(self):
        return self._info("pack")

    def grid_info(self):
        return self._info("grid")

    def place_info(self):
        return self._info("place")


class Tk(Misc):
    kind = "Tk"

    def __init__(self, *a, **kw):
        super().__init__(None)
        self.title_ = "tk"

    def title(self, text=None):
        if text is None:
            return self.title_
        self.title_ = text

    def geometry(self, spec=None):
        return None

    def mainloop(self, n=0):
        return None


def _part(name, extra=None):
    cls = type(name, (Misc,), {"kind": name, **(extra or {})})
    return cls


def _invoke(self):
    command = self.options.get("command")
    return command() if command else ""


def _items_init(self, master=None, cnf=None, **kw):
    Misc.__init__(self, master, cnf, **kw)
    self.items = []


def _index(self, i):
    return len(self.items) if i == END else int(i)


def _insert(self, index, *values):
    at = _index(self, index)
    if self.kind == "Entry":
        text = "".join(self.items)
        self.items = list(text[:at] + "".join(str(v) for v in values) + text[at:])
    else:
        self.items[at:at] = [str(v) for v in values]


def _get(self, first=None, last=None):
    if self.kind == "Entry":
        return "".join(self.items)
    if last is None:
        return self.items[_index(self, first)]
    return tuple(self.items[_index(self, first):_index(self, last) + 1])


def _delete(self, first, last=None):
    a = _index(self, first)
    b = (a + 1 if last is None else _index(self, last) + (0 if self.kind == "Entry" else 1))
    del self.items[a:b]


Frame, Label = _part("Frame"), _part("Label")
Button = _part("Button", {"invoke": _invoke})
Checkbutton = _part("Checkbutton", {"invoke": _invoke})
Entry = _part("Entry", {"__init__": _items_init, "insert": _insert, "get": _get, "delete": _delete})
Listbox = _part("Listbox", {"__init__": _items_init, "insert": _insert, "get": _get, "delete": _delete,
                            "size": lambda self: len(self.items)})
Text = _part("Text")


class Variable:
    default = ""

    def __init__(self, master=None, value=None, name=None):
        self.value = self.default if value is None else value

    def get(self):
        return self.value

    def set(self, value):
        self.value = value


class StringVar(Variable):
    default = ""


class IntVar(Variable):
    default = 0


def put_in_place():
    """Makes `import tkinter as tk` and `from tkinter import messagebox` find these."""
    tk = types.ModuleType("tkinter")
    for name in ("Tk", "Frame", "Label", "Button", "Checkbutton", "Entry", "Listbox", "Text", "StringVar", "IntVar",
                 "TclError", "END", "Misc"):
        setattr(tk, name, globals()[name])
    messagebox = types.ModuleType("tkinter.messagebox")
    messagebox.shown = []

    def note(kind, answer=None):
        def show(title=None, message=None, **kw):
            messagebox.shown.append((kind, title, message))
            return answer if answer is not None else "ok"
        return show
    messagebox.showinfo, messagebox.showwarning, messagebox.showerror = note("info"), note("warning"), note("error")
    messagebox.askyesno = note("askyesno", True)
    tk.messagebox = messagebox
    sys.modules.update({"tkinter": tk, "tkinter.messagebox": messagebox})
