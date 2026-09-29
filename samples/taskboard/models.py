from dataclasses import dataclass


@dataclass
class Task:
    id: int
    title: str
    done: bool
    owner: str

    def to_dict(self):
        return {"id": self.id, "title": self.title, "done": self.done, "owner": self.owner}

    @classmethod
    def from_row(cls, row):
        return cls(row["id"], row["title"], bool(row["done"]), row["owner"])
