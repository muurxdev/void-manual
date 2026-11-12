import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Check, Sun, Moon, Monitor, LogOut, Volume2, Search, X, Download, Info, Camera, Pin, PinOff, Pencil } from 'lucide-react';
import type { Conversation, WorkshopProfile } from '../data/types';
import type { ThemeChoice } from '../data/theme';
import { getVoices, loadPrefs, savePrefs, speakText, pickVoice, type VoicePrefs, type SpeakHandle } from '../data/tts';
import { ScreenPanel } from './Panels';
import { useFeedback } from './Feedback';

const UNIT_GROUPS = [
  { key: 'torque', label: 'Torque', options: ['Nm', 'kgf·m', 'lb·ft'] },
  { key: 'pressao', label: 'Pressão', options: ['bar', 'PSI', 'kPa'] },
  { key: 'folga', label: 'Folga e medidas', options: ['mm', 'pol'] },
] as const;
type UnitKey = (typeof UNIT_GROUPS)[number]['key'];
const UNIT_LABEL: Record<UnitKey, string> = { torque: 'Torque', pressao: 'Pressão', folga: 'Folga' };

function parseUnits(s: string): Record<UnitKey, string> {
  const out = { torque: 'Nm', pressao: 'bar', folga: 'mm' } as Record<UnitKey, string>;
  for (const g of UNIT_GROUPS) {
    const m = s.match(new RegExp(UNIT_LABEL[g.key] + ':\\s*([^·]+)'));
    const hit = m && g.options.find((o) => m[1].includes(o));
    if (hit) out[g.key] = hit;
  }
  return out;
}
const joinUnits = (u: Record<UnitKey, string>) => `Torque: ${u.torque} · Pressão: ${u.pressao} · Folga: ${u.folga}`;

/* ---------------- Perfil: só quem é você e o botão Sair ---------------- */
interface ProfileProps {
  profile: WorkshopProfile;
  onSave: (p: WorkshopProfile) => void;
  onClose: () => void;
  onSignOut: () => void;
  email?: string;
}

const toThumb = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const n = 256;
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const ctx = c.getContext('2d')!;
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, n, n);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('imagem inválida'));
    img.src = url;
  });

export const ProfilePanel: React.FC<ProfileProps> = ({ email, profile, onSave, onClose, onSignOut }) => {
  const [f, setF] = useState<WorkshopProfile>(profile);
  const [saved, setSaved] = useState(false);
  const [tag, setTag] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const fb = useFeedback();
  const dirty = JSON.stringify(f) !== JSON.stringify(profile);
  const tags = f.models.split(',').map((x) => x.trim()).filter(Boolean);
  const setTags = (list: string[]) => setF({ ...f, models: list.join(', ') });
  const addTag = () => {
    const v = tag.trim().replace(/,$/, '');
    if (v && !tags.some((x) => x.toLowerCase() === v.toLowerCase())) setTags([...tags, v]);
    setTag('');
  };
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setF({ ...f, photo: await toThumb(file) });
    } catch {
      fb.toast('Não consegui ler essa imagem', 'error');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await fb.confirm({ title: 'Salvar seu perfil?', message: 'Seu nome, sua oficina e as máquinas que você atende serão atualizados.', confirmLabel: 'Salvar' });
    if (!ok) return;
    onSave(f);
    setSaved(true);
    window.dispatchEvent(new Event('void-close-panel'));
    fb.toast('Alterações salvas com sucesso');
  };
  const askSignOut = async () => {
    const ok = await fb.confirm({ title: 'Sair da conta?', message: 'Você vai precisar entrar de novo para usar o Void.', confirmLabel: 'Sair', danger: true });
    if (ok) onSignOut();
  };

  const row = (label: string, key: keyof WorkshopProfile) => (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[12px] text-mute">{label}</span>
      <input value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className="field" />
    </label>
  );

  return (
    <ScreenPanel title="Perfil" onClose={onClose}>
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => photoRef.current?.click()} aria-label="Trocar foto" className="press relative h-16 w-16 shrink-0">
          <span className="glass-ink flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-[24px] font-semibold">
            {f.photo ? <img src={f.photo} alt="" className="h-full w-full object-cover" /> : f.mechanic.slice(0, 1).toUpperCase() || '?'}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-hair bg-paper">
            <Camera className="h-3.5 w-3.5" />
          </span>
        </button>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-medium">{f.mechanic || 'Seu nome'}</p>
          <p className="truncate text-[13px] text-mute">{email || f.name}</p>
          {f.photo && (
            <button type="button" onClick={() => setF({ ...f, photo: undefined })} className="mt-0.5 min-h-8 text-[12px] text-sub underline underline-offset-4">
              Remover foto
            </button>
          )}
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3 pb-2">
        {row('Seu nome', 'mechanic')}
        {row('Nome da oficina', 'name')}
        <div>
          <span className="mb-1.5 block px-1 text-[12px] text-mute">Máquinas que você atende</span>
          <div className="field flex flex-wrap items-center gap-2 !py-2.5">
            {tags.map((m) => (
              <span key={m} className="flex min-h-11 items-center gap-0.5 rounded-full bg-fill pl-4 pr-1 text-[13px]">
                {m}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== m))} aria-label={`Remover ${m}`} className="flex h-11 w-11 items-center justify-center rounded-full text-mute">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            <input
              value={tag}
              onChange={(e) => (e.target.value.endsWith(',') ? (setTag(e.target.value), addTag()) : setTag(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder={tags.length ? 'Adicionar…' : 'Moto, carro, trator…'}
              className="min-h-11 min-w-[110px] flex-1 bg-transparent py-1 text-[14px] focus:outline-none"
            />
          </div>
        </div>
        <button type="submit" disabled={!dirty} className="glass-ink press flex h-[54px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium disabled:opacity-45">
          {saved && !dirty ? (
            <>
              <Check className="h-4 w-4" /> Salvo
            </>
          ) : dirty ? (
            'Salvar alterações'
          ) : (
            'Nenhuma alteração'
          )}
        </button>
        <button type="button" onClick={askSignOut} className="press mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-medium text-red-500">
          <LogOut className="h-4 w-4" /> Sair da conta
        </button>
      </form>
    </ScreenPanel>
  );
};

/* ---------------- Configurações: tema, voz, unidades e servidor ---------------- */
interface SettingsProps {
  profile: WorkshopProfile;
  theme: ThemeChoice;
  onTheme: (t: ThemeChoice) => void;
  onSave: (p: WorkshopProfile) => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsProps> = ({ profile, theme, onTheme, onSave, onClose }) => {
  const [f, setF] = useState<WorkshopProfile>(profile);
  const [prefs, setPrefs] = useState<VoicePrefs>(loadPrefs);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saved, setSaved] = useState(false);
  const dirty = f.units !== profile.units;
  const [units, setUnits] = useState(() => parseUnits(profile.units));
  const fb = useFeedback();
  const demo = useRef<SpeakHandle | null>(null);

  const exportData = () => {
    const data: Record<string, unknown> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (k.startsWith('void_web_') && k !== 'void_web_accounts' && k !== 'void_web_session') data[k] = JSON.parse(localStorage.getItem(k) || 'null');
      }
    } catch {
      /* ignora chaves ilegíveis */
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'void-meus-dados.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    fb.toast('Dados exportados');
  };
  const wipe = async () => {
    const ok = await fb.confirm({
      title: 'Apagar os dados deste aparelho?',
      message: 'Conversas, perfil, arquivos da biblioteca e preferências serão apagados. Sua conta continua. Não dá para desfazer.',
      confirmLabel: 'Apagar tudo',
      danger: true,
    });
    if (!ok) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('void_web_') && k !== 'void_web_accounts' && k !== 'void_web_session')
        .forEach((k) => localStorage.removeItem(k));
      indexedDB.deleteDatabase('void-library');
    } catch {
      /* sem storage */
    }
    fb.toast('Dados apagados', 'info');
    window.setTimeout(() => window.location.reload(), 900);
  };

  useEffect(() => {
    getVoices().then(setVoices);
    return () => demo.current?.cancel();
  }, []);

  const updatePrefs = (next: Partial<VoicePrefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    savePrefs(merged);
  };

  const auto = pickVoice(voices, { ...prefs, voiceURI: '' });

  const preview = () => {
    demo.current?.cancel();
    demo.current = speakText('Oi, eu sou o Void. Pode perguntar sobre qualquer máquina.', {
      prefs: { ...prefs, enabled: true },
      onProgress: () => undefined,
      onEnd: () => undefined,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await fb.confirm({ title: 'Salvar as configurações?', message: 'As unidades padrão e a voz do Void serão atualizadas.', confirmLabel: 'Salvar' });
    if (!ok) return;
    onSave(f);
    setSaved(true);
    window.dispatchEvent(new Event('void-close-panel'));
    fb.toast('Alterações salvas com sucesso');
  };

  const themes: { id: ThemeChoice; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Claro', icon: <Sun className="h-4 w-4" /> },
    { id: 'dark', label: 'Escuro', icon: <Moon className="h-4 w-4" /> },
    { id: 'system', label: 'Sistema', icon: <Monitor className="h-4 w-4" /> },
  ];

  const label = 'mb-1.5 block px-1 text-[12px] text-mute';

  return (
    <ScreenPanel title="Configurações" subtitle="Tema, voz e unidades" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 pb-2">
        <div>
          <span className={label}>Tema</span>
          <div role="radiogroup" aria-label="Tema" className="glass grid grid-cols-3 gap-1 rounded-2xl p-1">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => onTheme(t.id)}
                className={`press flex items-center justify-center gap-1.5 rounded-xl min-h-11 text-[13px] font-medium transition-colors ${
                  theme === t.id ? 'bg-ink text-paper' : 'text-ink/70'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>Voz do Void</span>
          <div className="card space-y-3 p-3.5">
            <label className="flex items-center justify-between gap-3 text-[14px]">
              Responder em voz alta
              <input type="checkbox" checked={prefs.enabled} onChange={(e) => updatePrefs({ enabled: e.target.checked })} className="h-6 w-6 accent-[rgb(var(--ink))]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-mute">Voz</span>
              <select value={prefs.voiceURI} onChange={(e) => updatePrefs({ voiceURI: e.target.value })} className="field min-h-11 !py-2.5">
                <option value="">Automática{auto ? ` · ${auto.name}` : ''}</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                  </option>
                ))}
              </select>
              {voices.length === 0 && <span className="mt-1 block text-[12px] text-mute">Este aparelho não tem voz em português instalada; o texto aparece no ritmo da fala.</span>}
            </label>
            <label className="block">
              <span className="mb-1 flex justify-between text-[12px] text-mute">
                Velocidade <span className="font-mono">{prefs.rate.toFixed(1)}x</span>
              </span>
              <input type="range" min={0.8} max={1.3} step={0.1} value={prefs.rate} onChange={(e) => updatePrefs({ rate: Number(e.target.value) })} className="h-8 w-full accent-[rgb(var(--ink))]" />
            </label>
            <button type="button" onClick={preview} className="press flex min-h-11 items-center gap-2 rounded-full border border-hair px-4 text-[13px] font-medium">
              <Volume2 className="h-4 w-4" /> Ouvir exemplo
            </button>
          </div>
        </div>

        <div>
          <span className={label}>Unidades padrão</span>
          <div className="card space-y-3 p-3.5">
            {UNIT_GROUPS.map((g) => (
              <div key={g.key}>
                <span className="mb-1.5 block text-[12px] text-mute">{g.label}</span>
                <div role="radiogroup" aria-label={g.label} className="flex flex-wrap gap-2">
                  {g.options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={units[g.key] === o}
                      onClick={() => {
                        const next = { ...units, [g.key]: o };
                        setUnits(next);
                        setF({ ...f, units: joinUnits(next) });
                      }}
                      className={`press min-h-11 rounded-full px-4 text-[13px] font-medium ${units[g.key] === o ? 'bg-ink text-paper' : 'border border-hair'}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>


        <p className="px-1 text-[12px] text-mute">Tema e voz mudam na hora. As unidades só valem depois de salvar.</p>
        <button type="submit" disabled={!dirty} className="glass-ink press flex h-[54px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium disabled:opacity-45">
          {saved && !dirty ? (
            <>
              <Check className="h-4 w-4" /> Salvo
            </>
          ) : dirty ? (
            'Salvar unidades'
          ) : (
            'Nenhuma alteração nas unidades'
          )}
        </button>

        <div>
          <span className={label}>Seus dados</span>
          <div className="card divide-y divide-hair p-1">
            <button type="button" onClick={exportData} className="press flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-[14px]">
              <Download className="h-4 w-4" /> Exportar minhas conversas e perfil
            </button>
            <button type="button" onClick={wipe} className="press flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-[14px] text-red-500">
              <Trash2 className="h-4 w-4" /> Apagar os dados deste aparelho
            </button>
          </div>
        </div>

        <div>
          <span className={label}>Sobre</span>
          <div className="card flex items-start gap-3 p-3.5 text-[13px] leading-snug text-sub">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
            <p>
              Void · manual vivo para qualquer máquina. Seus dados ficam guardados só neste aparelho. Dica: segure o microfone da tela de voz para falar, ou toque uma vez para deixar ligado.
            </p>
          </div>
        </div>
      </form>
    </ScreenPanel>
  );
};

/* ---------------- Histórico ---------------- */
interface HistoryProps {
  conversations: Conversation[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Conversation | undefined;
  onRestore: (c: Conversation) => void;
  onUpdate: (id: string, patch: { title?: string; pinned?: boolean }) => void;
}

export const HistorySheet: React.FC<HistoryProps> = ({ conversations, onClose, onOpen, onDelete, onRestore, onUpdate }) => {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const list = conversations
    .filter((c) => c.messages.length > 0)
    .filter((c) => !q.trim() || norm(c.title + ' ' + c.messages.map((m) => m.content).join(' ')).includes(norm(q.trim())));
  const groups = (() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const day = 86400000;
    const defs = [
      { label: 'Hoje', min: start.getTime() },
      { label: 'Ontem', min: start.getTime() - day },
      { label: 'Últimos 7 dias', min: start.getTime() - 7 * day },
      { label: 'Antes', min: -Infinity },
    ];
    const pinned = list.filter((c) => c.pinned);
    const rest = list.filter((c) => !c.pinned);
    const out = defs
      .map((d, i) => ({ label: d.label, items: rest.filter((c) => c.updatedAt >= d.min && (i === 0 || c.updatedAt < defs[i - 1].min)) }))
      .filter((g) => g.items.length);
    return pinned.length ? [{ label: 'Fixadas', items: pinned }, ...out] : out;
  })();
  const fb = useFeedback();
  const ask = async (c: Conversation) => {
    const ok = await fb.confirm({ title: 'Apagar esta conversa?', message: `"${c.title}" será apagada. Você terá alguns segundos para desfazer.`, confirmLabel: 'Apagar', danger: true });
    if (!ok) return;
    const gone = onDelete(c.id);
    fb.toast('Conversa apagada', 'info', {
      action: gone ? { label: 'Desfazer', onClick: () => { onRestore(gone); fb.toast('Conversa de volta'); } } : undefined,
    });
  };
  return (
    <ScreenPanel title="Conversas" subtitle={`${list.length} no histórico`} onClose={onClose}>
      <label className="sr-only" htmlFor="hist-q">
        Buscar conversas
      </label>
      <div className="glass mb-4 flex items-center gap-2 rounded-full px-4">
        <Search className="h-4 w-4 shrink-0 text-mute" />
        <input
          id="hist-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nas conversas"
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-ink placeholder:text-mute focus:outline-none"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Limpar busca" className="flex h-9 w-9 items-center justify-center rounded-full text-mute">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {list.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-[15px] font-medium">{q ? 'Nada encontrado' : 'Nenhuma conversa ainda'}</p>
          <p className="mt-1 text-[13px] text-mute">{q ? 'Tente outra palavra.' : 'Pergunte algo no chat ou por voz e ela aparece aqui.'}</p>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label} className="mb-5">
          <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide text-mute">{g.label}</h2>
          <ul className="space-y-2">
            {g.items.map((c, i) => (
              <li key={c.id} style={{ ['--i' as string]: Math.min(i, 8) }} className="card anim-fade-up flex items-center gap-1 p-1.5 pl-4">
                {editing === c.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = draft.trim();
                      if (v) {
                        onUpdate(c.id, { title: v });
                        fb.toast('Conversa renomeada');
                      }
                      setEditing(null);
                    }}
                  >
                    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} aria-label="Novo nome" className="field !py-2 min-w-0 flex-1" />
                    <button type="submit" aria-label="Salvar nome" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                      <Check className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setEditing(null)} aria-label="Cancelar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute">
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <button onClick={() => onOpen(c.id)} className="min-w-0 flex-1 py-2.5 text-left">
                      <span className="block truncate text-[14px]">{c.title}</span>
                      <span className="block text-[12px] text-mute">
                        {new Date(c.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {c.messages.length} mensagens
                      </span>
                    </button>
                    <button data-nodrag onClick={() => { onUpdate(c.id, { pinned: !c.pinned }); fb.toast(c.pinned ? 'Conversa desafixada' : 'Conversa fixada', 'info'); }} aria-label={c.pinned ? 'Desafixar' : 'Fixar'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute active:bg-fill">
                      {c.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                    <button data-nodrag onClick={() => { setDraft(c.title); setEditing(c.id); }} aria-label={`Renomear ${c.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute active:bg-fill">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button data-nodrag onClick={() => ask(c)} aria-label={`Apagar ${c.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute active:bg-fill active:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ScreenPanel>
  );
};
