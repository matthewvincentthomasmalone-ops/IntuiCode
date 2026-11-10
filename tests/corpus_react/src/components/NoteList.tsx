import { NoteCard } from "@/components/NoteCard";
import type { Note } from "@/types/note";

interface NoteListProps {
  notes: Note[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

export function NoteList({ notes, onToggle, onDelete }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <p>No notes yet.</p>
        <p className="text-sm">Add one above to get started.</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {notes.map((note) => (
        <li key={note.id}>
          <NoteCard note={note} onToggle={onToggle} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}
