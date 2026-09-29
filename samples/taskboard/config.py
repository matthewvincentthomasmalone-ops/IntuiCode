"""Settings for TaskBoard."""
import os

from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
DATABASE = os.getenv("TASKBOARD_DB", "tasks.db")
SLACK_WEBHOOK = "https://hooks.slack.com/services/T0000/B0000/XXXXXXXXXXXX"
MAX_TITLE = 100
