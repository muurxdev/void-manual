import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, FileText, Minus, Plus, Search, X } from 'lucide-react';
import type { FileKind } from '../data/types';
import { KIND_LABEL, getBlob } from '../data/library';

export interface ViewItem {
  id: string;
  title: string;
  kind: FileKind;
  size: number;
  mime: string;
  topics: string[];
  text: string;
  thumb?: string;
  note?: string;
  builtin: boolean;
}

const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Tela de visualização de um arquivo da Biblioteca: original (quando dá) e texto lido. */
export const FileViewer: React.FC<{ item: ViewItem; onClose: () => void }> = ({ item, onClose }) => {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [tab, setTab] = useState<'orig' | 'text'>('orig');
  const [leaving, setLeaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [find, setFind] = useState('');
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob]);

  useEffect(() => {
    let live = true;
    if (!item.builtin) getBlob(item.id).then((b) => live && setBlob(b));
    return () => {
      live = false;
    };
  }, [item.id, item.builtin]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

  const { highlighted, hits } = useMemo(() => {
    const q = find.trim();
    if (!q) return { highlighted: item.text as React.ReactNode, hits: 0 };
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\  const hasOriginal =');
    const parts = item.text.split(new RegExp('(' + esc + ')', 'gi'));
    let n = 0;
    const out = parts.map((part, i) =>
      i % 2 === 1 ? (
        (n++, <mark key={i} className="rounded bg-ink px-0.5 text-paper">{part}</mark>)
      ) : (
        part
      )
    );
    return { highlighted: out as React.ReactNode, hits: n };
  }, [find, item.text]);

  const hasOriginal = !!url && (item.kind === 'image' || item.kind === 'pdf' || item.kind === 'audio');
  const showOrig = hasOriginal && tab === 'orig';

  const close = () => {
    setLeaving(true);
    window.setTimeout(onClose, 260);
  };

  const download = () => {
    const a = document.createElement('a');
    if (url) {
      a.href = url;
      a.download = item.title;
    } else {
      a.href = URL.createObjectURL(new Blob([item.text], { type: 'text/plain' }));
      a.download = item.title.replace(/\.[a-z0-9]+$/i, '') + '.txt';
    }
    a.click();
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col bg-paper ${leaving ? 'anim-slide-out' : 'anim-fade-up'}`}
      style={{ transition: 'transform 260ms var(--sheet-ease), opacity 260ms', transform: leaving ? 'translateY(24px)' : undefined, opacity: leaving ? 0 : 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      <header className="safe-top flex items-center gap-3 px-4 pb-3">
        <button onClick={close} aria-label="Voltar" className="icon-btn glass shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-medium leading-tight">{item.title}</h2>
          <p className="truncate text-[12px] text-mute">
            {KIND_LABEL[item.kind]} · {item.builtin ? 'incluído no Void' : fmtSize(item.size)}
          </p>
        </div>
        <button onClick={download} aria-label="Baixar" className="icon-btn glass shrink-0">
          <Download className="h-4 w-4" />
        </button>
      </header>

      {hasOriginal && (
        <div className="px-4 pb-3">
          <div className="glass inline-flex rounded-full p-1 text-[13px]">
            {(['orig', 'text'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`min-h-10 rounded-full px-4 transition-colors ${tab === t ? 'bg-ink text-paper' : 'text-sub'}`}>
                {t === 'orig' ? 'Original' : 'Texto lido'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="scroll-smooth-area min-h-0 flex-1 px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        {item.topics.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {item.topics.map((t) => (
              <span key={t} className="rounded-full bg-fill px-2.5 py-1 text-[12px] text-sub">
                {t}
              </span>
            ))}
          </div>
        )}

        {showOrig && item.kind === 'image' && (
          <div>
            <div className="mb-2 flex items-center justify-end gap-1">
              <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} aria-label="Diminuir" disabled={zoom <= 1} className="icon-btn glass disabled:opacity-40">
                <Minus className="h-4 w-4" />
              </button>
              <button onClick={() => setZoom(1)} className="min-h-11 min-w-12 rounded-full px-2 font-mono text-[12px] text-sub" aria-label="Zoom 100%">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(1)))} aria-label="Aumentar" disabled={zoom >= 4} className="icon-btn glass disabled:opacity-40">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div data-nodrag className="max-h-[68dvh] overflow-auto rounded-2xl" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
              <img
                src={url}
                alt={item.title}
                onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
                className="mx-auto block max-w-none rounded-2xl object-contain transition-[width] duration-300"
                style={{ width: `${zoom * 100}%` }}
              />
            </div>
          </div>
        )}
        {showOrig && item.kind === 'audio' && (
          <div className="card p-4">
            <audio src={url} controls className="w-full" />
          </div>
        )}
        {showOrig && item.kind === 'pdf' && (
          <div className="space-y-3">
            <iframe src={url} title={item.title} className="h-[68dvh] w-full rounded-2xl border border-hair bg-white" />
            <a href={url} target="_blank" rel="noreferrer" className="glass press flex h-11 items-center justify-center gap-2 rounded-full text-[14px]">
              <ExternalLink className="h-4 w-4" /> Abrir em tela cheia
            </a>
          </div>
        )}

        {!showOrig && (
          <article className="card p-4">
            {item.text.trim() && (
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
                <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Buscar no texto" aria-label="Buscar no texto" className="field pl-10 pr-24" />
                {find && (
                  <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
                    <span className="font-mono text-[12px] text-mute">{hits} {hits === 1 ? 'achado' : 'achados'}</span>
                    <button onClick={() => setFind('')} aria-label="Limpar busca" className="flex h-10 w-10 items-center justify-center rounded-full text-mute">
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
            )}
            {item.text.trim() ? (
              <p className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-ink">{highlighted}</p>
            ) : (
              <p className="flex items-center gap-2 text-[13px] text-mute">
                <FileText className="h-4 w-4" /> Nenhum texto foi lido deste arquivo.
              </p>
            )}
          </article>
        )}
        {item.note && <p className="mt-3 px-1 text-[12px] text-mute">{item.note}</p>}
      </div>
    </div>
  );
};
