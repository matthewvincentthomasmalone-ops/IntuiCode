import { supabase } from "@/integrations/supabase/client";
import type { Note, NoteInput } from "@/types/note";

export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Note[];
}

export async function addNote(input: NoteInput): Promise<Note> {
  const { data, error } = await supabase.from("notes").insert(input).select().single();
  if (error) throw error;
  return data as Note;
}

export async function toggleNote(id: string, done: boolean) {
  const { error } = await supabase.from("notes").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}
