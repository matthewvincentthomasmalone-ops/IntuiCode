from flask import Blueprint, jsonify, request

from db import find_tasks, get_db
from models import Task
from services import notify
from utils.text import clean_title

tasks_bp = Blueprint("tasks", __name__)


@tasks_bp.route("/tasks", methods=["GET"])
def list_tasks():
    owner = request.args.get("owner", "")
    tasks = [Task.from_row(r) for r in find_tasks(owner)]
    return jsonify([t.to_dict() for t in tasks])


@tasks_bp.route("/tasks", methods=["POST"])
def add_task():
    data = request.get_json()
    title = clean_title(data.get("title", ""))
    if not title:
        return jsonify({"error": "title is required"}), 400
    conn = get_db()
    conn.execute("INSERT INTO tasks (title, owner) VALUES (?, ?)", (title, data.get("owner", "")))
    conn.commit()
    return jsonify({"ok": True}), 201


@tasks_bp.route("/tasks/<int:task_id>/done", methods=["POST"])
def complete_task(task_id):
    conn = get_db()
    conn.execute("UPDATE tasks SET done = 1 WHERE id = ?", (task_id,))
    conn.commit()
    notify.send_slack(f"Task {task_id} is done")
    return jsonify({"ok": True})
