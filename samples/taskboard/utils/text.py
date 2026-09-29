from config import MAX_TITLE


def clean_title(title):
    title = " ".join(title.split())
    if len(title) > MAX_TITLE:
        title = title[:MAX_TITLE]
    return title


def slugify(text):
    words = []
    for w in text.lower().split():
        if w.isalnum():
            words.append(w)
    return "-".join(words)
