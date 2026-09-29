"""Command-line inventory manager that stores items in a JSON file."""
import argparse
import json
import os

DATA_FILE = "inventory.json"
LOW_STOCK = 5


def load_items():
    # Start with an empty inventory if the file doesn't exist yet
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE) as f:
        return json.load(f)


def save_items(items):
    with open(DATA_FILE, "w") as f:
        json.dump(items, f, indent=2)


def add_item(items, name, count):
    if name in items:
        items[name] += count
    else:
        items[name] = count
    return items


def remove_item(items, name, count):
    if name not in items:
        print(f"No such item: {name}")
        return items
    items[name] = max(0, items[name] - count)
    return items


def report(items):
    total = 0
    for name, count in sorted(items.items()):
        flag = " (low!)" if count < LOW_STOCK else ""
        print(f"{name:20} {count:5}{flag}")
        total += count
    print("Total items:", total)
    low = [name for name, count in items.items() if count < LOW_STOCK]
    return low


def main():
    parser = argparse.ArgumentParser(description="Manage inventory")
    parser.add_argument("action", choices=["add", "remove", "report"])
    parser.add_argument("name", nargs="?")
    parser.add_argument("count", nargs="?", type=int, default=1)
    args = parser.parse_args()
    items = load_items()
    if args.action == "add":
        items = add_item(items, args.name, args.count)
    elif args.action == "remove":
        items = remove_item(items, args.name, args.count)
    else:
        low = report(items)
        if low:
            print("Reorder soon:", ", ".join(low))
    save_items(items)


if __name__ == "__main__":
    main()
