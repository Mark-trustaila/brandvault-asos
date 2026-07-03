'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Note } from '../types/trademark';
import { bvFetch } from '../lib/client/acting-company';

/**
 * Notes for a trademark, backed by the API (was localStorage).
 *
 * Same interface as before — { notes, addNote, deleteNote } — so DetailPanel is
 * unchanged. Author/date now come from the server (the note's User + createdAt)
 * rather than being hardcoded.
 */
export const useNotes = (trademarkId: string) => {
  const [notes, setNotes] = useState<Note[]>([]);

  const refresh = useCallback(() => {
    if (!trademarkId) return;
    bvFetch(`/api/trademarks/${trademarkId}/notes`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setNotes)
      .catch(() => {});
  }, [trademarkId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addNote = useCallback(
    (text: string, link?: string, html?: string) => {
      if (!trademarkId) return;
      bvFetch(`/api/trademarks/${trademarkId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, link, html }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((note: Note | null) => {
          if (note) setNotes((prev) => [note, ...prev]);
        })
        .catch(() => {});
    },
    [trademarkId]
  );

  const deleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId)); // optimistic
    bvFetch(`/api/notes/${noteId}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  return { notes, addNote, deleteNote };
};
