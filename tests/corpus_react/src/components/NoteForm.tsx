import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { NoteInput } from "@/types/note";

interface NoteFormProps {
  onSave: (input: NoteInput) => void;
  saving?: boolean;
}

export function NoteForm({ onSave, saving = false }: NoteFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Give the note a title", variant: "destructive" });
      return;
    }
    onSave({ title: title.trim(), content });
    setTitle("");
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="What's on your mind?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">Details</Label>
        <Textarea
          id="content"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Add note"}
      </Button>
    </form>
  );
}
