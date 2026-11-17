"""A stand-in for Flask and FastAPI, so the Python writer's words for web routes can be run without either.

It isn't a server: nothing listens on a port. An app keeps its routes, and its test client sends a request
straight to the route that matches, as Flask's and FastAPI's own test clients do. What it does is what those
do for the parts the words use (tests/helpers/meaning.mjs puts it in place for each example):

- Flask: `@app.route(path, methods=[…])` (GET when no methods are given), `@app.get` / `.post` … (Flask 2),
  `<name>` and `<int:name>` in the path, `jsonify`, `request` (`get_json()`, `json`, `args`, `method`,
  `form`), a route giving back text, a dict or list (sent as JSON), a reply, or (reply, status).
  `jsonify` and `request` outside a request stop with RuntimeError, as Flask's do. A route that gives back
  anything else (a number, nothing), or stops with an error, is answered 500. `status_code=` on a route is
  FastAPI's: Flask stops with TypeError.
- FastAPI: `@app.get(path, status_code=…)` …, `{name}` in the path, turned into the type the tool's
  parameter is marked with; other parameters come from the query; whatever the tool gives back is sent as JSON.
  `TestClient(app)` from `fastapi.testclient`.
- Either way: a path no route has is 404, a route asked with a method it doesn't take is 405.
"""
import json
import re
import sys
import types
import inspect

_current = []   # the request being handled, innermost last


def _now():
    if not _current:
        raise RuntimeError("Working outside of request context.")
    return _current[-1]


class Response:
    def __init__(self, body="", status=200, mimetype="text/html"):
        self.data = body.encode("utf-8") if isinstance(body, str) else body
        self.status_code = status
        self.mimetype = mimetype

    def get_data(self, as_text=False):
        return self.data.decode("utf-8") if as_text else self.data

    @property
    def text(self):
        return self.get_data(as_text=True)

    def get_json(self):
        return json.loads(self.data) if self.mimetype == "application/json" else None

    @property
    def is_json(self):
        return self.mimetype == "application/json"

    def json(self):   # (FastAPI's TestClient calls it; Flask's has get_json)
        return json.loads(self.data)


def jsonify(*args, **kw):
    if not _current:
        raise RuntimeError("Working outside of application context.")
    value = kw if kw else (args[0] if len(args) == 1 else list(args))
    return Response(json.dumps(value), 200, "application/json")


class _Request:
    def __init__(self, method, path, body, args, form):
        self.method, self.path, self._body, self.args, self.form = method, path, body, args, form

    def get_json(self, silent=False):
        if self._body is None:
            if silent:
                return None
            raise _Abort(415)   # (Flask 2.3: no JSON sent is "Unsupported Media Type")
        return json.loads(self._body)

    @property
    def json(self):
        return self.get_json()


class _RequestProxy:
    """`request`: whichever request is being handled now."""
    def __getattr__(self, name):
        return getattr(_now(), name)


class _Abort(Exception):
    def __init__(self, status):
        self.status = status


FLASK_OPTIONS = {"endpoint", "defaults", "subdomain", "strict_slashes", "redirect_to", "alias", "host", "websocket", "provide_automatic_options"}

CONVERT = {"int": (r"-?\d+", int), "float": (r"-?\d+(?:\.\d+)?", float), "path": (r".+", str), "string": (r"[^/]+", str)}


class _App:
    style = "flask"

    def __init__(self, *a, **kw):
        self.routes = []   # (method set, regex, names → convert, tool, status)

    def _pattern(self, path):
        names, out, pos = {}, "", 0
        holes = re.compile(r"<(?:(\w+):)?(\w+)>") if self.style == "flask" else re.compile(r"\{(\w+)()\}")
        for m in holes.finditer(path):
            out += re.escape(path[pos:m.start()])
            if self.style == "flask":
                kind, name = m.group(1) or "string", m.group(2)
            else:
                kind, name = "string", m.group(1)
            out += f"(?P<{name}>{CONVERT[kind][0]})"
            names[name] = CONVERT[kind][1]
            pos = m.end()
        return re.compile("^" + out + re.escape(path[pos:]) + "$"), names

    def route(self, path, methods=None, status_code=200, **kw):
        if self.style == "flask":
            # (Flask's routes take Werkzeug's rule options; status_code= is FastAPI's, and Flask stops on it)
            odd = set(kw) - FLASK_OPTIONS | ({"status_code"} if status_code != 200 else set())
            if odd:
                raise TypeError(f"__init__() got an unexpected keyword argument '{sorted(odd)[0]}'")
        def add(tool):
            rx, names = self._pattern(path)
            allowed = {m.upper() for m in (methods or ["GET"])}
            if self.style == "flask" and "GET" in allowed:
                allowed.add("HEAD")   # (Flask answers HEAD wherever it answers GET)
            self.routes.append((allowed, rx, names, tool, status_code))
            return tool
        return add

    def get(self, path, **kw):
        return self.route(path, methods=["GET"], **kw)

    def post(self, path, **kw):
        return self.route(path, methods=["POST"], **kw)

    def put(self, path, **kw):
        return self.route(path, methods=["PUT"], **kw)

    def delete(self, path, **kw):
        return self.route(path, methods=["DELETE"], **kw)

    def patch(self, path, **kw):
        return self.route(path, methods=["PATCH"], **kw)

    def _reply(self, given, status):
        if isinstance(given, Response):
            return given
        if isinstance(given, tuple):
            r = self._reply(given[0], status)
            r.status_code = given[1]
            return r
        if self.style == "fastapi" or isinstance(given, (dict, list)):
            return Response(json.dumps(given), status, "application/json")
        if isinstance(given, (str, bytes)):
            return Response(given, status)
        # (Flask takes text, a dict or list, a reply or a tuple; a number, or nothing, stops the route)
        raise TypeError(f"The view function did not return a valid response. The return type must be a string, dict, list, tuple with headers or status, Response instance, or WSGI callable, but it was a {type(given).__name__}.")

    def handle(self, method, path, body=None, args=None, form=None):
        path, _, query = path.partition("?")
        args = dict(args or {})
        for pair in filter(None, query.split("&")):
            k, _, v = pair.partition("=")
            args[k] = v
        found = [(r, r[1].match(path)) for r in self.routes]
        found = [(r, m) for r, m in found if m]
        if not found:
            return Response("Not Found", 404)
        for (methods, rx, names, tool, status), m in found:
            if method in methods:
                break
        else:
            return Response("Method Not Allowed", 405)
        kw = {k: names[k](v) for k, v in m.groupdict().items()}
        if self.style == "fastapi":
            sig = inspect.signature(tool)
            for name, p in sig.parameters.items():
                if name in kw:
                    if p.annotation in (int, float, str):
                        kw[name] = p.annotation(kw[name])
                elif p.annotation in (dict, list) and body is not None:
                    kw[name] = json.loads(body)
                elif name in args:
                    kw[name] = p.annotation(args[name]) if p.annotation in (int, float, str) else args[name]
        _current.append(_Request(method, path, body, args, dict(form or {})))
        try:
            return self._reply(tool(**kw), status)
        except _Abort as a:
            return Response("", a.status)
        except Exception as e:
            if self.style == "fastapi":
                raise   # (FastAPI's TestClient raises what the route raised)
            self.last_error = e   # (Flask answers 500, and logs it; this keeps it to look at)
            return Response("Internal Server Error", 500)
        finally:
            _current.pop()

    def test_client(self):
        return _Client(self)


class _Client:
    def __init__(self, app):
        self.app = app

    def _send(self, method, path, json_=None, query_string=None, data=None):
        body = None if json_ is None else json.dumps(json_)
        return self.app.handle(method, path, body, query_string, data)

    def get(self, path, json=None, query_string=None, params=None):
        return self._send("GET", path, json, query_string or params)

    def head(self, path, query_string=None, params=None):
        r = self._send("HEAD", path, None, query_string or params)
        r.data = b""   # (HEAD gets the status and headers, not the body)
        return r

    def post(self, path, json=None, query_string=None, data=None, params=None):
        return self._send("POST", path, json, query_string or params, data)

    def put(self, path, json=None, query_string=None, params=None):
        return self._send("PUT", path, json, query_string or params)

    def patch(self, path, json=None, query_string=None, params=None):
        return self._send("PATCH", path, json, query_string or params)

    def delete(self, path, json=None, query_string=None, params=None):
        return self._send("DELETE", path, json, query_string or params)


class Flask(_App):
    style = "flask"


class FastAPI(_App):
    style = "fastapi"


def put_in_place():
    """Makes `import flask`, `from fastapi import FastAPI` and `from fastapi.testclient import TestClient` find these."""
    flask = types.ModuleType("flask")
    flask.Flask, flask.jsonify, flask.request, flask.Response = Flask, jsonify, _RequestProxy(), Response
    fastapi = types.ModuleType("fastapi")
    fastapi.FastAPI = FastAPI
    testclient = types.ModuleType("fastapi.testclient")
    testclient.TestClient = _Client
    fastapi.testclient = testclient
    sys.modules.update({"flask": flask, "fastapi": fastapi, "fastapi.testclient": testclient})
