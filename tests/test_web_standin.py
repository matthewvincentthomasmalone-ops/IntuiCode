"""The stand-in Flask and FastAPI (tests/helpers/web_standin.py) do what Flask and FastAPI do, for the parts the
meaning examples use. Run: python -m unittest discover -s tests"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "helpers"))
import web_standin  # noqa: E402

web_standin.put_in_place()
from flask import Flask, jsonify, request  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


class FlaskStandIn(unittest.TestCase):
    def test_a_route_with_no_methods_answers_get_and_head_only(self):
        app = Flask(__name__)
        app.route("/")(lambda: "hi")
        c = app.test_client()
        self.assertEqual((c.get("/").status_code, c.get("/").text), (200, "hi"))
        self.assertEqual(c.head("/").status_code, 200)
        self.assertEqual(c.post("/").status_code, 405)
        self.assertEqual(c.get("/nowhere").status_code, 404)

    def test_what_a_route_gives_back(self):
        app = Flask(__name__)
        app.get("/d")(lambda: {"a": 1})
        app.get("/t")(lambda: ("made", 201))
        app.get("/n")(lambda: 5)
        app.get("/j")(lambda: jsonify([1, 2]))
        c = app.test_client()
        self.assertEqual((c.get("/d").get_json(), c.get("/d").is_json), ({"a": 1}, True))
        self.assertEqual((c.get("/t").status_code, c.get("/t").text), (201, "made"))
        self.assertEqual(c.get("/n").status_code, 500)   # a number isn't a reply
        self.assertIsInstance(app.last_error, TypeError)
        self.assertEqual(c.get("/j").get_json(), [1, 2])

    def test_path_parts_and_the_request(self):
        app = Flask(__name__)
        app.route("/n/<int:k>")(lambda k: str(k + 1))
        app.post("/echo")(lambda: jsonify(request.get_json()))
        app.get("/q")(lambda: request.args.get("x", "none"))
        c = app.test_client()
        self.assertEqual(c.get("/n/4").text, "5")
        self.assertEqual(c.get("/n/four").status_code, 404)
        self.assertEqual(c.post("/echo", json={"a": [1]}).get_json(), {"a": [1]})
        self.assertEqual(c.post("/echo").status_code, 415)   # no JSON sent
        self.assertEqual((c.get("/q?x=7").text, c.get("/q").text), ("7", "none"))

    def test_outside_a_request_and_fastapi_options(self):
        with self.assertRaises(RuntimeError):
            jsonify(1)
        with self.assertRaises(RuntimeError):
            request.get_json()
        with self.assertRaises(TypeError):
            Flask(__name__).post("/x", status_code=201)


class FastAPIStandIn(unittest.TestCase):
    def test_routes_reply_in_json_with_their_status(self):
        app = FastAPI()

        @app.post("/items", status_code=201)
        def make(name):
            return {"made": name}

        @app.get("/items/{k}")
        def item(k: int):
            return k * 2

        c = TestClient(app)
        r = c.post("/items?name=pen")
        self.assertEqual((r.status_code, r.json()), (201, {"made": "pen"}))
        self.assertEqual(c.get("/items/4").json(), 8)
        self.assertEqual(c.get("/items").status_code, 405)
        self.assertEqual(c.delete("/items/4").status_code, 405)


if __name__ == "__main__":
    unittest.main()
