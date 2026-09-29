import requests

from config import SLACK_WEBHOOK


def send_slack(message):
    """Post a message to the team Slack channel."""
    try:
        requests.post(SLACK_WEBHOOK, json={"text": message})
    except Exception:
        pass
