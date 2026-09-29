"""Entry point for the TaskBoard API."""
from flask import Flask

from config import SECRET_KEY
from db import init_db
from routes.tasks import tasks_bp


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY
    app.register_blueprint(tasks_bp, url_prefix="/api")
    init_db()
    return app


if __name__ == "__main__":
    app = create_app()
    print("TaskBoard running on http://localhost:5000")
    app.run(debug=True, port=5000)
