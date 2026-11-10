// The shape of a note, as the notes table in Supabase stores it.
export interface Note {
  id: string;
  title: string;
  content: string | null;
  done: boolean;
  pinned: boolean;
  created_at: string;
  tags?: string[];
}

export interface NoteInput {
  title: string;
  content?: string;
  tags?: string[];
}

export type NoteFilter = "all" | "open" | "done";

export type SortOrder = "newest" | "oldest";

export interface NoteStats {
  total: number;
  done: number;
  open: number;
}
