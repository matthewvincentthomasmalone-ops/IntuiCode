"""Keep track of stock in a small shop and warn when items run low."""
import csv
import sys
from dataclasses import dataclass, field

LOW_STOCK = 5
PRICES_FILE = "prices.csv"


@dataclass
class Item:
    name: str
    price: float
    count: int = 0
    tags: list = field(default_factory=list)

    def value(self):
        return self.price * self.count

    def is_low(self):
        return self.count < LOW_STOCK


def load_items(path):
    """Read items from a CSV file with name, price and count columns."""
    items = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            items.append(Item(row["name"], float(row["price"]), int(row["count"])))
    return items


def restock(items, name, amount):
    for item in items:
        if item.name == name:
            item.count += amount
            return item
    raise KeyError(name)


def report(items):
    total = 0
    for item in items:
        total += item.value()
        if item.is_low():
            print(f"Low: {item.name} ({item.count} left)")
    print(f"Stock is worth {total:.2f}")
    return total


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else PRICES_FILE
    stock = load_items(path)
    # TODO: read restock orders from a second file
    restock(stock, "tea", 10)
    report(stock)
