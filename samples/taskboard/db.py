"""Database helpers."""
import sqlite3

from config import DATABASE


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT, done INTEGER DEFAULT 0, owner TEXT)"
    )
    conn.commit()


def find_tasks(owner):
    conn = get_db()
    rows = conn.execute(f"SELECT * FROM tasks WHERE owner = '{owner}'").fetchall()
    return [dict(r) for r in rows]
