import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Note, NoteFilter, NoteStats } from "@/types/note";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function matchesFilter(note: Note, filter: NoteFilter): boolean {
  if (filter === "all") {
    return true;
  }
  return filter === "done" ? note.done : !note.done;
}

export function noteStats(notes: Note[]): NoteStats {
  const done = notes.filter((n) => n.done).length;
  return { total: notes.length, done, open: notes.length - done };
}

export function preview(text: string | null, max: number = 80): string {
  if (!text) {
    return "";
  }
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export const sortNewestFirst = (a: Note, b: Note) => b.created_at.localeCompare(a.created_at);
