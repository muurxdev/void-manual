import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileKind, LibraryRecord } from './types';
import { ingest, kindOf, listRecords, removeRecord, MAX_FILES_PER_BATCH, MAX_FILE_MB, type Stage } from './library';

export interface UploadState {
  id: string;
  name: string;
  size: number;
  kind: FileKind;
  stage: Stage | 'erro';
  pct: number;
  note?: string;
  error?: string;
}

/** Biblioteca: lista, envia (um arquivo por vez, para poupar memória) e remove. */
export function useLibrary() {
  const [items, setItems] = useState<LibraryRecord[]>([]);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const queue = useRef<{ id: string; file: File }[]>([]);
  const running = useRef(false);

  useEffect(() => {
    listRecords().then(setItems);
  }, []);

  const patch = (id: string, p: Partial<UploadState>) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const { id, file } = queue.current.shift()!;
      try {
        const rec = await ingest(file, (stage, pct, note) => patch(id, { stage, pct, note }));
        setItems((prev) => [rec, ...prev]);
        patch(id, { stage: 'pronto', pct: 100, note: rec.note });
        window.setTimeout(() => setUploads((u) => u.filter((x) => x.id !== id)), 1600);
      } catch (e) {
        patch(id, { stage: 'erro', error: e instanceof Error ? e.message : 'Falhou' });
        window.setTimeout(() => setUploads((u) => u.filter((x) => x.id !== id)), 4000);
      }
    }
    running.current = false;
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]): string[] => {
      const list = Array.from(files).slice(0, MAX_FILES_PER_BATCH);
      const entries: UploadState[] = list.map((f) => ({
        id: 'up-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: f.name,
        size: f.size,
        kind: kindOf(f),
        stage: 'enviando',
        pct: 0,
      }));
      setUploads((u) => [...entries, ...u]);
      entries.forEach((e, i) => queue.current.push({ id: e.id, file: list[i] }));
      void pump();
      return entries.map((e) => e.id);
    },
    [pump]
  );

  const pending = useRef<Record<string, number>>({});
  const stash = useRef<Record<string, LibraryRecord>>({});

  /** Some da lista agora e só apaga de verdade depois de alguns segundos; devolve a função que desfaz. */
  const remove = useCallback(
    (id: string): (() => void) => {
      const rec = items.find((x) => x.id === id);
      if (rec) stash.current[id] = rec;
      setItems((prev) => prev.filter((x) => x.id !== id));
      pending.current[id] = window.setTimeout(() => {
        delete pending.current[id];
        delete stash.current[id];
        void removeRecord(id);
      }, 6500);
      return () => {
        window.clearTimeout(pending.current[id]);
        delete pending.current[id];
        const back = stash.current[id];
        delete stash.current[id];
        if (back) setItems((prev) => (prev.some((x) => x.id === id) ? prev : [back, ...prev].sort((a, b) => b.createdAt - a.createdAt)));
      };
    },
    [items]
  );

  return { items, uploads, addFiles, remove, limits: { files: MAX_FILES_PER_BATCH, mb: MAX_FILE_MB } };
}
