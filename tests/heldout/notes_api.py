from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()
notes = {}
next_id = 1


class Note(BaseModel):
    title: str
    body: str = ""
    pinned: bool = False


@app.get("/notes")
def list_notes(pinned: Optional[bool] = None):
    if pinned is None:
        return list(notes.values())
    return [n for n in notes.values() if n["pinned"] == pinned]


@app.post("/notes", status_code=201)
def create_note(note: Note):
    global next_id
    record = note.dict()
    record["id"] = next_id
    notes[next_id] = record
    next_id += 1
    return record


@app.delete("/notes/{note_id}")
def delete_note(note_id: int):
    if note_id not in notes:
        raise HTTPException(status_code=404, detail="Note not found")
    del notes[note_id]
    return {"deleted": note_id}
