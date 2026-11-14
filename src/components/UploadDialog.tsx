import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, FileAudio, FileSpreadsheet, FileText, FileType2, Image as ImageIcon, Plus, UploadCloud, X } from 'lucide-react';
import type { FileKind } from '../data/types';
import { KIND_LABEL, MAX_FILES_PER_BATCH, MAX_FILE_MB, kindOf } from '../data/library';
import type { UploadState } from '../data/useLibrary';
import { useFeedback } from './Feedback';

const ICON: Record<FileKind, React.ReactNode> = {
  pdf: <FileType2 className="h-5 w-5" />,
  doc: <FileText className="h-5 w-5" />,
  sheet: <FileSpreadsheet className="h-5 w-5" />,
  image: <ImageIcon className="h-5 w-5" />,
  audio: <FileAudio className="h-5 w-5" />,
  text: <FileText className="h-5 w-5" />,
  other: <FileText className="h-5 w-5" />,
};

const STAGES = [
  { id: 'enviando', label: 'Enviando' },
  { id: 'lendo', label: 'Lendo' },
  { id: 'entendendo', label: 'Entendendo' },
  { id: 'organizando', label: 'Organizando' },
] as const;

const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const extOf = (n: string) => (n.includes('.') ? n.split('.').pop()!.toUpperCase().slice(0, 5) : '');

interface Row {
  key: string;
  file: File;
  kind: FileKind;
  problem?: string;
  uploadId?: string;
}

const check = (f: File): string | undefined => {
  if (f.size > MAX_FILE_MB * 1048576) return `Passa de ${MAX_FILE_MB} MB`;
  if (kindOf(f) === 'other') return 'Tipo não suportado';
  if (f.size === 0) return 'Arquivo vazio';
  return undefined;
};

interface Props {
  /** arquivos já escolhidos (ex.: soltos na tela) ao abrir */
  initial?: File[];
  uploads: UploadState[];
  onSend: (files: File[]) => string[];
  onClose: () => void;
}

/** Popup de envio: escolha, lista com os dados de cada arquivo, e progresso por etapa ao enviar. */
export const UploadDialog: React.FC<Props> = ({ initial = [], uploads, onSend, onClose }) => {
  const fb = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [drag, setDrag] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const seen = useRef<Record<string, UploadState>>({});

  const add = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    setRows((prev) => {
      const have = new Set(prev.map((r) => r.file.name + r.file.size));
      const next = files
        .filter((f) => !have.has(f.name + f.size))
        .map((f) => ({ key: 'r' + Math.random().toString(36).slice(2, 8), file: f, kind: kindOf(f), problem: check(f) }));
      if (next.length < files.length) fb.toast('Arquivo repetido ignorado', 'info');
      return [...prev, ...next];
    });
  };

  useEffect(() => {
    if (initial.length) add(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    setLeaving(true);
    window.setTimeout(onClose, 240);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  // estado de cada arquivo enviado: some da lista de envios quando termina, então guardamos o último visto
  for (const u of uploads) seen.current[u.id] = u;
  const stateOf = (r: Row): { phase: 'staged' | 'sending' | 'done' | 'error'; pct: number; stage: number; note?: string; error?: string } => {
    if (!r.uploadId) return { phase: 'staged', pct: 0, stage: -1 };
    const u = uploads.find((x) => x.id === r.uploadId);
    const last = u ?? seen.current[r.uploadId];
    if (!u) return last?.stage === 'erro' ? { phase: 'error', pct: 0, stage: 0, error: last.error } : { phase: 'done', pct: 1, stage: 3 };
    if (u.stage === 'erro') return { phase: 'error', pct: 0, stage: 0, error: u.error };
    if (u.stage === 'pronto') return { phase: 'done', pct: 1, stage: 3, note: u.note };
    const idx = Math.max(0, STAGES.findIndex((s) => s.id === u.stage));
    return { phase: 'sending', pct: (idx + u.pct / 100) / STAGES.length, stage: idx, note: u.note };
  };

  const states = rows.map(stateOf);
  const staged = rows.filter((r, i) => states[i].phase === 'staged' && !r.problem);
  const sent = rows.filter((_, i) => states[i].phase !== 'staged');
  const sentStates = states.filter((s) => s.phase !== 'staged');
  const sending = sentStates.some((s) => s.phase === 'sending');
  const stagedSize = useMemo(() => staged.reduce((n, r) => n + r.file.size, 0), [staged]);
  const overall = sentStates.length ? sentStates.reduce((n, s) => n + (s.phase === 'error' ? 1 : s.pct), 0) / sentStates.length : 0;
  const doneCount = sentStates.filter((s) => s.phase === 'done').length;
  const allDone = sent.length > 0 && !sending && staged.length === 0;

  const send = () => {
    const batch = staged.slice(0, MAX_FILES_PER_BATCH);
    if (!batch.length) return;
    const ids = onSend(batch.map((r) => r.file));
    setRows((prev) => prev.map((r) => {
      const i = batch.findIndex((b) => b.key === r.key);
      return i >= 0 ? { ...r, uploadId: ids[i] } : r;
    }));
  };

  const remove = (key: string) => setRows((p) => p.filter((r) => r.key !== key));
  const problems = rows.filter((r) => r.problem).length;
  const over = staged.length > MAX_FILES_PER_BATCH;
  const sendCount = Math.min(staged.length, MAX_FILES_PER_BATCH);
  const sendSize = staged.slice(0, MAX_FILES_PER_BATCH).reduce((n, r) => n + r.file.size, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Enviar arquivos">
      <div onClick={close} className={`absolute inset-0 bg-black/45 ${leaving ? 'anim-scrim-out' : 'anim-scrim'}`} />
      <div className={`relative flex max-h-[88dvh] border border-hair bg-paper shadow-2xl w-full max-w-[520px] flex-col rounded-t-[30px] pb-[max(env(safe-area-inset-bottom),16px)] sm:rounded-[30px] ${leaving ? 'anim-sheet-out' : 'anim-sheet-in'}`}>
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="text-title font-medium tracking-tight">Enviar arquivos</h2>
            <p className="mt-0.5 text-small text-sub">
              Até {MAX_FILE_MB} MB cada · {MAX_FILES_PER_BATCH} por vez · PDF, Word, Excel, CSV, texto, imagem e áudio
            </p>
          </div>
          <button onClick={close} aria-label={sending ? 'Continuar em segundo plano' : 'Fechar'} className="icon-btn glass -mr-1 shrink-0 loop-border">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scroll-smooth-area min-h-0 flex-1 px-5">
          <input ref={input} type="file" multiple className="hidden" onChange={(e) => e.target.files && (add(e.target.files), (e.target.value = ''))} />

          {/* escolher */}
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              add(e.dataTransfer.files);
            }}
            className={`press flex w-full items-center gap-3 rounded-[22px] border border-dashed p-4 text-left transition-colors ${drag ? 'border-ink bg-ink/5' : 'border-ink/25'}`}
          >
            <span className="glass-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full">{rows.length ? <Plus className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}</span>
            <span className="min-w-0">
              <span className="block text-body font-medium">{rows.length ? 'Adicionar mais arquivos' : 'Escolher arquivos'}</span>
              <span className="block text-caption text-mute">Toque aqui ou solte os arquivos</span>
            </span>
          </button>

          {/* progresso geral */}
          {sent.length > 0 && (
            <div className="mt-4" aria-live="polite">
              <div className="mb-1.5 flex items-baseline justify-between text-small">
                <span className="font-medium">{allDone ? 'Envio concluído' : 'Enviando'}</span>
                <span className="font-mono text-caption text-sub">
                  {doneCount} de {sent.length} · {Math.round(overall * 100)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(overall * 100)}>
                <div className="h-full origin-left rounded-full bg-ink transition-transform duration-300" style={{ transform: `scaleX(${overall})` }} />
              </div>
            </div>
          )}

          {/* lista */}
          {rows.length > 0 && (
            <ul className="mt-4 space-y-2 pb-2">
              {rows.map((r, i) => {
                const s = states[i];
                return (
                  <li key={r.key} className="card anim-fade-up p-3">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${s.phase === 'done' ? 'bg-ink text-paper' : s.phase === 'error' || r.problem ? 'bg-red-500/15 text-red-500' : 'bg-fill'}`}>
                        {s.phase === 'done' ? <Check className="anim-pop h-5 w-5 stroke-[3]" /> : s.phase === 'error' || r.problem ? <AlertCircle className="h-5 w-5" /> : ICON[r.kind]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-medium">{r.file.name}</p>
                        <p className="truncate text-caption text-mute">
                          {KIND_LABEL[r.kind]} · {fmtSize(r.file.size)}
                          {extOf(r.file.name) ? ` · .${extOf(r.file.name).toLowerCase()}` : ''}
                        </p>
                        <p className={`truncate text-caption ${r.problem || s.phase === 'error' ? 'text-red-500' : 'text-sub'}`}>
                          {r.problem ?? (s.phase === 'staged' ? 'Pronto para enviar' : s.phase === 'error' ? s.error ?? 'Falhou' : s.phase === 'done' ? s.note ?? 'Pronto' : `${STAGES[s.stage].label}… ${s.note ?? ''}`)}
                        </p>
                      </div>
                      {s.phase === 'staged' && (
                        <button onClick={() => remove(r.key)} aria-label={`Tirar ${r.file.name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute active:bg-fill">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      {s.phase === 'sending' && <span className="font-mono text-caption text-sub">{Math.round(s.pct * 100)}%</span>}
                    </div>
                    {s.phase === 'sending' && (
                      <div className="mt-3">
                        <div className="h-1 overflow-hidden rounded-full bg-fill">
                          <div className="h-full origin-left rounded-full bg-ink transition-transform duration-300" style={{ transform: `scaleX(${s.pct})` }} />
                        </div>
                        <div className="mt-1.5 flex justify-between text-caption text-mute">
                          {STAGES.map((st, k) => (
                            <span key={st.id} className={k <= s.stage ? 'text-ink' : ''}>
                              {st.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {problems > 0 && <p className="pb-2 text-caption text-mute">{problems} {problems === 1 ? 'arquivo não pode' : 'arquivos não podem'} ser enviado(s). Tire da lista para continuar.</p>}
          {over && <p className="pb-2 text-caption text-mute">Vão {MAX_FILES_PER_BATCH} agora; os outros ficam na fila para o próximo envio.</p>}
        </div>

        {/* ação principal, com o dado dentro */}
        <div className="px-5 pt-3">
          {allDone ? (
            <button onClick={close} className="glass-ink press h-[54px] w-full rounded-full text-body font-medium loop-border">
              Concluir
            </button>
          ) : (
            <button onClick={send} disabled={staged.length === 0} className="glass-ink press h-[54px] w-full rounded-full text-body font-medium disabled:opacity-45 loop-border">
              {staged.length
                ? `Enviar ${sendCount} ${sendCount === 1 ? 'arquivo' : 'arquivos'} · ${fmtSize(sendSize)}`
                : sending
                  ? `Enviando… ${Math.round(overall * 100)}%`
                  : rows.length
                    ? 'Nada válido para enviar'
                    : 'Escolha arquivos para enviar'}
            </button>
          )}
          {stagedSize > 0 && staged.length > MAX_FILES_PER_BATCH && <span className="sr-only">Total na fila {fmtSize(stagedSize)}</span>}
        </div>
      </div>
    </div>
  );
};
