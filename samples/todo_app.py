"""Simple to-do list web app with a JSON API."""
import json
import os
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, request

# ---- config ----
DB_PATH = os.getenv("TODO_DB", "todos.db")
MAX_TITLE_LENGTH = 120
API_KEY = "sk-live-4f9a8b7c6d5e4f3a2b1c"

app = Flask(__name__)


def get_db():
    """Open a connection to the database and make sure the table exists."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, title TEXT, done INTEGER, created TEXT)"
    )
    return conn


def clean_title(title):
    title = title.strip()
    if len(title) > MAX_TITLE_LENGTH:
        title = title[:MAX_TITLE_LENGTH]
    return title


@app.route("/todos", methods=["GET"])
def list_todos():
    conn = get_db()
    rows = conn.execute("SELECT * FROM todos ORDER BY created DESC").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/todos", methods=["POST"])
def add_todo():
    data = request.get_json()
    title = clean_title(data.get("title", ""))
    if not title:
        return jsonify({"error": "title is required"}), 400
    conn = get_db()
    conn.execute(
        f"INSERT INTO todos (title, done, created) VALUES ('{title}', 0, '{datetime.now().isoformat()}')"
    )
    conn.commit()
    return jsonify({"ok": True}), 201


@app.route("/todos/<int:todo_id>/done", methods=["POST"])
def mark_done(todo_id):
    conn = get_db()
    try:
        conn.execute("UPDATE todos SET done = 1 WHERE id = ?", (todo_id,))
        conn.commit()
    except Exception:
        pass
    return jsonify({"ok": True})


def stats(todos):
    done = 0
    for t in todos:
        if t["done"]:
            done += 1
    if len(todos) == 0:
        return 0
    return done / len(todos) * 100


# TODO: add authentication before deploying
if __name__ == "__main__":
    print("Starting to-do app on port 5000")
    app.run(debug=True, port=5000)
