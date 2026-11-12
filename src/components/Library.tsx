import React, { useEffect, useMemo, useState } from 'react';
import { Check, FileAudio, FileSpreadsheet, FileText, FileType2, Image as ImageIcon, Info, Search, Trash2, UploadCloud, AlertCircle, ArrowUpDown, X } from 'lucide-react';
import type { FileKind, LibraryRecord, Manual } from '../data/types';
import { KIND_LABEL, MAX_FILES_PER_BATCH, MAX_FILE_MB, analyze } from '../data/library';
import type { UploadState } from '../data/useLibrary';
import { ScreenPanel } from './Panels';
import { FileViewer, type ViewItem } from './FileViewer';
import { useFeedback } from './Feedback';
import { UploadDialog } from './UploadDialog';

interface LibraryProps {
  items: LibraryRecord[];
  included: Manual[];
  uploads: UploadState[];
  /** modo escolha: toca num item para usá-lo como contexto do chat */
  onPick?: (rec: { id: string; title: string }) => void;
  onFiles: (f: FileList | File[]) => string[];
  onRemove: (id: string) => () => void;
  onClose: () => void;
}

const ICON: Record<FileKind, React.ReactNode> = {
  pdf: <FileType2 className="h-4 w-4" />,
  doc: <FileText className="h-4 w-4" />,
  sheet: <FileSpreadsheet className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  audio: <FileAudio className="h-4 w-4" />,
  text: <FileText className="h-4 w-4" />,
  other: <FileText className="h-4 w-4" />,
};

const FILTERS: { id: 'all' | FileKind; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'pdf', label: 'PDF' },
  { id: 'doc', label: 'Documentos' },
  { id: 'sheet', label: 'Planilhas' },
  { id: 'image', label: 'Imagens' },
  { id: 'audio', label: 'Áudio' },
  { id: 'text', label: 'Texto' },
];

const STAGES = [
  { id: 'enviando', label: 'Enviando' },
  { id: 'lendo', label: 'Lendo' },
  { id: 'entendendo', label: 'Entendendo' },
  { id: 'organizando', label: 'Organizando' },
] as const;

const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

export const LibrarySheet: React.FC<LibraryProps> = ({ items, included, uploads, onPick, onFiles, onRemove, onClose }) => {
  const [filter, setFilter] = useState<'all' | FileKind>('all');
  const [topic, setTopic] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'name' | 'size'>('recent');
  const [info, setInfo] = useState(false);
  const [drag, setDrag] = useState(false);
  const [viewing, setViewing] = useState<ViewItem | null>(null);
  const fb = useFeedback();
  const askRemove = async (id: string, title: string) => {
    const ok = await fb.confirm({ title: 'Remover este arquivo?', message: `"${title}" será removido deste aparelho. Você terá alguns segundos para desfazer.`, confirmLabel: 'Remover', danger: true });
    if (!ok) return;
    const undo = onRemove(id);
    fb.toast('Arquivo removido', 'info', { action: { label: 'Desfazer', onClick: () => { undo(); fb.toast('Arquivo de volta'); } } });
  };
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dropped, setDropped] = useState<File[]>([]);
  useEffect(() => {
    const pick = () => setUploadOpen(true);
    window.addEventListener('void-pick-file', pick);
    return () => window.removeEventListener('void-pick-file', pick);
  }, []);

  const all = useMemo(
    () => [
      ...items.map((r) => ({ ...r, builtin: false })),
      ...included.map((m) => ({
        id: m.id,
        title: m.title,
        kind: 'text' as FileKind,
        size: m.text.length,
        mime: 'text/plain',
        topics: analyze(m.text, m.title, 'text'),
        text: m.text,
        thumb: undefined,
        note: undefined,
        createdAt: m.updatedAt ?? 0,
        builtin: true,
      })),
    ],
    [items, included]
  );

  const topics = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of all) for (const t of r.topics) count.set(t, (count.get(t) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [all]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const r of all) c[r.kind] = (c[r.kind] || 0) + 1;
    return c;
  }, [all]);

  const list = all.filter(
    (r) =>
      (filter === 'all' || r.kind === filter) &&
      (!topic || r.topics.includes(topic)) &&
      (!q || r.title.toLowerCase().includes(q.toLowerCase()) || r.topics.some((t) => t.toLowerCase().includes(q.toLowerCase())))
  );

  const sorted = [...list].sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title, 'pt-BR') : sort === 'size' ? b.size - a.size : b.createdAt - a.createdAt));
  const SORT_LABEL = { recent: 'Mais recentes', name: 'Nome (A–Z)', size: 'Maiores' } as const;
  const nextSort = () => setSort(sort === 'recent' ? 'name' : sort === 'name' ? 'size' : 'recent');

  const infoButton = (
    <button
      data-nodrag
      onClick={() => setInfo((v) => !v)}
      aria-label="Como enviar arquivos"
      aria-expanded={info}
      className={`icon-btn glass shrink-0 transition-colors ${info ? '!bg-ink !text-paper' : ''}`}
    >
      <Info className="h-4 w-4" />
    </button>
  );

  return (
    <>
    <ScreenPanel
      showBack
      title="Biblioteca"
      subtitle={`${all.length} itens · ${topics.length} tópicos`}
      headerExtra={infoButton}
      onClose={onClose}
    >
      {/* explicação (!) */}
      <div className={`grid transition-all duration-500 ${info ? 'mb-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} style={{ transitionTimingFunction: 'var(--sheet-ease)' }}>
        <div className="overflow-hidden">
          <div className="card space-y-2 p-4 text-[13px] leading-relaxed">
            <p className="font-medium text-ink">Envie o que você tiver</p>
            <p className="text-sub">
              Até <b className="text-ink">{MAX_FILE_MB} MB por arquivo</b> e {MAX_FILES_PER_BATCH} por vez. Aceitamos PDF, Word (.docx), Excel (.xlsx), CSV, texto, imagens e áudio.
            </p>
            <p className="text-sub">O Void lê o conteúdo, entende e separa por tópicos para responder usando os seus arquivos. Tudo fica guardado neste aparelho.</p>
          </div>
        </div>
      </div>

      {/* progresso */}
      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {uploads.map((u) => {
            const idx = STAGES.findIndex((s) => s.id === u.stage);
            const done = u.stage === 'pronto';
            const err = u.stage === 'erro';
            return (
              <li key={u.id} className="card anim-fade-up p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill">
                    {done ? <Check className="anim-pop h-4 w-4" /> : err ? <AlertCircle className="h-4 w-4 text-red-500" /> : ICON[u.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{u.name}</p>
                    <p className="truncate text-[12px] text-mute">
                      {err ? u.error : done ? 'Pronto' : `${STAGES[Math.max(0, idx)].label}… ${u.note ?? ''}`}
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-mute">{fmtSize(u.size)}</span>
                </div>
                {!err && (
                  <div className="mt-3">
                    <div className="h-1 overflow-hidden rounded-full bg-fill">
                      <div
                        className="h-full origin-left rounded-full bg-ink transition-transform duration-300"
                        style={{ transform: `scaleX(${done ? 1 : (Math.max(0, idx) + u.pct / 100) / STAGES.length})` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[12px] text-mute">
                      {STAGES.map((s, i) => (
                        <span key={s.id} className={i <= idx || done ? 'text-ink' : ''}>
                          {s.label}
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

      {/* busca e envio */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na biblioteca" className="field pl-10 pr-11" aria-label="Buscar na biblioteca" />
          {q && (
            <button onClick={() => setQ('')} aria-label="Limpar busca" className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-mute">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {items.length > 0 && !onPick && (
          <button onClick={() => setUploadOpen(true)} aria-label="Adicionar arquivos" className="glass-ink press flex h-12 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-medium">
            <UploadCloud className="h-4 w-4" /> Enviar
          </button>
        )}
      </div>

      {items.length === 0 && !onPick && <div className="mt-3">
      <button
        type="button"
        onClick={() => setUploadOpen(true)}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) {
            setDropped(Array.from(e.dataTransfer.files));
            setUploadOpen(true);
          }
        }}
        className={`press flex w-full items-center gap-3 rounded-[20px] border border-dashed p-4 text-left transition-colors ${
          drag ? 'border-ink bg-ink/5' : 'border-ink/25 hover:border-ink/50'
        }`}
      >
        <span className="glass-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
          <UploadCloud className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-medium">Adicionar arquivos</span>
          <span className="block text-[12px] text-mute">PDF, Word, Excel, imagem, áudio e mais</span>
        </span>
      </button>

      </div>}

      <div data-nodrag className="-mx-[22px] mt-3 flex gap-2 overflow-x-auto px-[22px] pb-1">
        <button onClick={nextSort} aria-label={`Ordenar: ${SORT_LABEL[sort]}. Toque para trocar`} className="press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-fill px-3.5 text-[13px]">
          <ArrowUpDown className="h-3.5 w-3.5" /> {SORT_LABEL[sort]}
        </button>
        {FILTERS.filter((f) => f.id === 'all' || counts[f.id]).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`press min-h-11 shrink-0 rounded-full px-3.5 text-[13px] transition-colors ${filter === f.id ? 'bg-ink text-paper' : 'border border-hair text-ink/70'}`}
          >
            {f.label} <span className="font-mono text-[12px] opacity-60">{counts[f.id] || 0}</span>
          </button>
        ))}
      </div>

      {topics.length > 0 && (
        <div data-nodrag className="-mx-[22px] mt-2 flex gap-2 overflow-x-auto px-[22px] pb-1">
          {topics.map(([t, n]) => (
            <button
              key={t}
              onClick={() => setTopic(topic === t ? '' : t)}
              className={`press min-h-11 shrink-0 rounded-full px-3.5 text-[12px] transition-colors ${topic === t ? 'bg-ink text-paper' : 'bg-fill text-sub'}`}
            >
              {t} · {n}
            </button>
          ))}
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {list.length === 0 && <li className="py-10 text-center text-[13px] text-mute">{all.length ? 'Nada com esse filtro.' : 'Sua biblioteca está vazia. Envie o primeiro arquivo.'}</li>}
        {sorted.map((r, i) => (
          <li key={r.id} style={{ ['--i' as string]: Math.min(i, 8) }} className="card anim-fade-up flex items-center gap-3 p-3">
            <button
              onClick={() => (onPick ? onPick({ id: r.id, title: r.title }) : setViewing(r))}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-fill">
                {r.thumb ? <img src={r.thumb} alt="" className="h-full w-full object-cover" /> : ICON[r.kind]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium leading-tight">{r.title}</span>
                <span className="mt-0.5 block truncate text-[12px] text-mute">
                  {KIND_LABEL[r.kind]} · {r.builtin ? 'incluído no Void' : `${fmtSize(r.size)} · ${fmtDate(r.createdAt)}`}
                </span>
                <span className="mt-1.5 flex gap-1 overflow-hidden">
                  {r.topics.slice(0, 3).map((t) => (
                    <span key={t} className="shrink-0 rounded-full bg-fill px-2 py-0.5 text-[12px] text-sub">
                      {t}
                    </span>
                  ))}
                </span>
                {r.note && <span className="mt-1 block truncate text-[12px] text-mute">{r.note}</span>}
              </span>
            </button>
            {onPick ? (
              <span className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12px] font-medium text-paper">Usar</span>
            ) : (
              !r.builtin && (
                <button data-nodrag onClick={() => askRemove(r.id, r.title)} aria-label={`Remover ${r.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute active:bg-fill active:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              )
            )}
          </li>
        ))}
      </ul>
    </ScreenPanel>
    {viewing && <FileViewer item={viewing} onClose={() => setViewing(null)} />}
    {uploadOpen && (
      <UploadDialog
        initial={dropped}
        uploads={uploads}
        onSend={onFiles}
        onClose={() => {
          setUploadOpen(false);
          setDropped([]);
        }}
      />
    )}
    </>
  );
};
