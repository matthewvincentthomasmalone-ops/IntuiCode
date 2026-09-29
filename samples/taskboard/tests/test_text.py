from utils.text import clean_title, slugify


def test_clean_title_trims_spaces():
    assert clean_title("  buy   milk ") == "buy milk"


def test_slugify():
    assert slugify("Hello World") == "hello-world"
