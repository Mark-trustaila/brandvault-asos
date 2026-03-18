'use client';
import { useState, useCallback } from 'react';
import type { Note } from '../types/trademark';

const NOTES_KEY = 'brandvault_notes';

const loadAllNotes = (): Record<string, Note[]> => {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch { return {}; }
};

const saveAllNotes = (notes: Record<string, Note[]>) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const useNotes = (trademarkId: string) => {
  const [notes, setNotes] = useState<Note[]>(() => loadAllNotes()[trademarkId] || []);

  const addNote = useCallback((text: string, link?: string, html?: string) => {
    const all = loadAllNotes();
    const newNote: Note = {
      id: Date.now().toString(36),
      text, html: html || null, link: link || null,
      author: 'MK', authorFull: 'Mark Kingsley-Williams',
      date: new Date().toISOString()
    };
    const updated = [newNote, ...(all[trademarkId] || [])];
    all[trademarkId] = updated;
    saveAllNotes(all);
    setNotes(updated);
  }, [trademarkId]);

  const deleteNote = useCallback((noteId: string) => {
    const all = loadAllNotes();
    const updated = (all[trademarkId] || []).filter(n => n.id !== noteId);
    all[trademarkId] = updated;
    saveAllNotes(all);
    setNotes(updated);
  }, [trademarkId]);

  return { notes, addNote, deleteNote };
};
