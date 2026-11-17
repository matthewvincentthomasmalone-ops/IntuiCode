"""A stand-in for requests, so the Python writer's words for web replies run without the internet.

Nothing is sent anywhere. An example says what each address answers (requests.REPLIES[url] = a value, sent back
as JSON, or a Response it makes itself), and what was asked is noted (requests.SENT: (method, url, json)). For
the parts the words use, it does what requests does:
- requests.get(url, params=…, timeout=…), requests.post(url, json=…, data=…, timeout=…)
- a Response: status_code (200, or 404 for an address with no reply), ok, text, json(), raise_for_status()
- raise_for_status() stops with requests.HTTPError (also requests.exceptions.HTTPError) for 400 or more,
  saying the status and the address, as requests does.
"""
import json
import sys
import types


class RequestException(IOError):
    pass


class HTTPError(RequestException):
    def __init__(self, *args, response=None):
        super().__init__(*args)
        self.response = response


class Response:
    def __init__(self, status_code=200, body=None, url=""):
        self.status_code, self.url = status_code, url
        self.text = body if isinstance(body, str) else ("" if body is None else json.dumps(body))

    @property
    def ok(self):
        return self.status_code < 400

    def json(self):
        return json.loads(self.text)

    def raise_for_status(self):
        if self.status_code >= 400:
            kind = "Client" if self.status_code < 500 else "Server"
            raise HTTPError(f"{self.status_code} {kind} Error for url: {self.url}", response=self)


REPLIES, SENT = {}, []


def _answer(method, url, payload):
    SENT.append((method, url, payload))
    said = REPLIES.get(url)
    if isinstance(said, Response):
        return said
    return Response(404, "Not Found", url) if url not in REPLIES else Response(200, said, url)


def get(url, params=None, timeout=None, headers=None):
    return _answer("GET", url, None)


def post(url, json=None, data=None, timeout=None, headers=None):
    return _answer("POST", url, json if json is not None else data)


def put_in_place():
    """Makes `import requests` find this. (Each run starts with no replies and nothing sent.)"""
    me = sys.modules[__name__]
    module = types.ModuleType("requests")
    for name in ("get", "post", "Response", "HTTPError", "RequestException", "REPLIES", "SENT"):
        setattr(module, name, getattr(me, name))
    module.exceptions = types.SimpleNamespace(HTTPError=HTTPError, RequestException=RequestException)
    sys.modules["requests"] = module
