import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { formatDate, preview } from "@/lib/utils";
import type { Note } from "@/types/note";

interface NoteCardProps {
  note: Note;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

export function NoteCard({ note, onToggle, onDelete }: NoteCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <Checkbox checked={note.done} onCheckedChange={() => onToggle(note.id, !note.done)} />
        <CardTitle className={note.done ? "text-muted-foreground line-through" : ""}>
          {note.title}
        </CardTitle>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => onDelete(note.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{preview(note.content)}</p>
        <div className="mt-3 flex items-center gap-2">
          {note.pinned && <Badge>Pinned</Badge>}
          <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
