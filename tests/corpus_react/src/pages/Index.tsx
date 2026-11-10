import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoteForm } from "@/components/NoteForm";
import { NoteList } from "@/components/NoteList";
import { useAddNote, useDeleteNote, useNotes, useToggleNote } from "@/hooks/use-notes";
import { matchesFilter, noteStats } from "@/lib/utils";
import type { NoteFilter } from "@/types/note";

const Index = () => {
  const [filter, setFilter] = useState<NoteFilter>("all");
  const { data: notes = [], isLoading, error } = useNotes();
  const addNote = useAddNote();
  const toggleNote = useToggleNote();
  const deleteNote = useDeleteNote();

  const visible = useMemo(() => notes.filter((n) => matchesFilter(n, filter)), [notes, filter]);
  const stats = noteStats(notes);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-2xl font-bold">Notes</h1>
          <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground">
            About
          </Link>
        </div>
      </header>
      <main className="container max-w-3xl space-y-6 py-8">
        <NoteForm onSave={(input) => addNote.mutate(input)} saving={addNote.isPending} />
        <div className="flex items-center justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as NoteFilter)}>
            <TabsList>
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="open">Open ({stats.open})</TabsTrigger>
              <TabsTrigger value="done">Done ({stats.done})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {isLoading && <p className="text-muted-foreground">Loading notes…</p>}
        {error && <p className="text-destructive">Couldn't load your notes.</p>}
        <NoteList
          notes={visible}
          onToggle={(id, done) => toggleNote.mutate({ id, done })}
          onDelete={(id) => deleteNote.mutate(id)}
        />
      </main>
    </div>
  );
};

export default Index;
