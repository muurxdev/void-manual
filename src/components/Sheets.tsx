import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Check, Sun, Moon, Monitor, LogOut, Volume2, Search, X, Download, Info, Camera, Pin, PinOff, Pencil, Gem, Ruler, FileText, ShieldCheck, Mic as MicIcon } from 'lucide-react';
import type { Conversation, WorkshopProfile } from '../data/types';
import type { ThemeChoice } from '../data/theme';
import { getVoices, loadPrefs, savePrefs, speakText, pickVoice, type VoicePrefs, type SpeakHandle } from '../data/tts';
import { ScreenPanel } from './Panels';
import { useFeedback } from './Feedback';
import { LegalPanel, type LegalKind } from './LegalPanel';
import { Group, Row, Toggle, Segmented } from './Rows';

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
  planName?: string;
  onPlans?: () => void;
  stats?: { conversations: number; files: number; questions: number };
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

export const ProfilePanel: React.FC<ProfileProps> = ({ email, profile, onSave, onClose, onSignOut, planName, onPlans, stats }) => {
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

  return (
    <ScreenPanel title="Perfil" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <button type="button" onClick={() => photoRef.current?.click()} aria-label="Trocar foto" className="press relative h-24 w-24 shrink-0">
          <span className="glass-ink flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-display font-semibold">
            {f.photo ? <img src={f.photo} alt="" className="h-full w-full object-cover" /> : f.mechanic.slice(0, 1).toUpperCase() || '?'}
          </span>
          <span className="glass loop-border absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full">
            <Camera className="h-4 w-4" />
          </span>
        </button>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        <h2 className="mt-3 max-w-full truncate text-title font-medium">{f.mechanic || 'Seu nome'}</h2>
        <p className="max-w-full truncate text-small text-sub">{email || f.name}</p>
        {f.photo && (
          <button type="button" onClick={() => setF({ ...f, photo: undefined })} className="mt-1 min-h-9 text-caption text-sub underline underline-offset-4">
            Remover foto
          </button>
        )}
      </div>

      {stats && (
        <div className="card mt-5 grid grid-cols-3 divide-x divide-hair py-3 text-center">
          {[
            ['Conversas', stats.conversations],
            ['Arquivos', stats.files],
            ['Perguntas hoje', stats.questions],
          ].map(([n, v]) => (
            <div key={n as string}>
              <p className="text-heading font-semibold">{v}</p>
              <p className="text-caption text-sub">{n}</p>
            </div>
          ))}
        </div>
      )}

      {onPlans && (
        <Group title="Assinatura">
          <Row icon={<Gem className="h-4 w-4" />} label={'Plano ' + (planName ?? 'Grátis')} hint="Limites, preços e pagamento" onClick={onPlans} />
        </Group>
      )}

      <form onSubmit={submit} className="pb-2">
        <Group title="Dados" className="!mt-6">
          <label className="block px-3.5 py-2.5">
            <span className="block text-caption text-mute">Seu nome</span>
            <input value={f.mechanic} onChange={(e) => setF({ ...f, mechanic: e.target.value })} className="mt-0.5 w-full bg-transparent text-body font-medium focus:outline-none" />
          </label>
          <label className="block px-3.5 py-2.5">
            <span className="block text-caption text-mute">Nome da oficina</span>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-0.5 w-full bg-transparent text-body font-medium focus:outline-none" />
          </label>
          <div className="px-3.5 py-2.5">
            <span className="block text-caption text-mute">Máquinas que você atende</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {tags.map((m) => (
                <span key={m} className="flex min-h-10 items-center gap-0.5 rounded-full bg-fill pl-3.5 pr-1 text-small">
                  {m}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== m))} aria-label={`Remover ${m}`} className="flex h-10 w-10 items-center justify-center rounded-full text-mute">
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
                className="min-h-10 min-w-[110px] flex-1 bg-transparent text-body focus:outline-none"
              />
            </div>
          </div>
        </Group>
        <button type="submit" disabled={!dirty} className="glass-ink loop-border press mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full text-body font-medium disabled:opacity-45">
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
        <Group>
          <Row danger icon={<LogOut className="h-4 w-4" />} label="Sair da conta" onClick={askSignOut} />
        </Group>
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
  const [legal, setLegal] = useState<LegalKind | null>(null);
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

  return (
    <>
      <ScreenPanel title="Configurações" subtitle="Tema, voz e unidades" onClose={onClose}>
        <form onSubmit={submit} className="pb-2">
          <Group title="Aparência">
            <div className="p-3">
              <Segmented label="Tema" value={theme} onChange={onTheme} options={themes} />
            </div>
          </Group>

          <Group title="Voz do Void">
            <Row icon={<MicIcon className="h-4 w-4" />} label="Responder em voz alta" hint="Lê a resposta depois de pensar" right={<Toggle on={prefs.enabled} onChange={(v) => updatePrefs({ enabled: v })} label="Responder em voz alta" />} />
            <label className="block px-3.5 py-2.5">
              <span className="block text-caption text-mute">Voz</span>
              <select value={prefs.voiceURI} onChange={(e) => updatePrefs({ voiceURI: e.target.value })} className="mt-0.5 min-h-10 w-full bg-transparent text-body font-medium focus:outline-none">
                <option value="">Automática{auto ? ` · ${auto.name}` : ''}</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                  </option>
                ))}
              </select>
              {voices.length === 0 && <span className="block text-caption text-mute">Este aparelho não tem voz em português instalada; o texto aparece no ritmo da fala.</span>}
            </label>
            <label className="block px-3.5 py-2.5">
              <span className="flex justify-between text-caption text-mute">
                Velocidade <span className="font-mono text-ink">{prefs.rate.toFixed(1)}x</span>
              </span>
              <input type="range" min={0.8} max={1.3} step={0.1} value={prefs.rate} onChange={(e) => updatePrefs({ rate: Number(e.target.value) })} className="mt-1 h-8 w-full accent-[rgb(var(--ink))]" />
            </label>
            <Row icon={<Volume2 className="h-4 w-4" />} label="Ouvir exemplo" onClick={preview} />
          </Group>

          <Group title="Unidades padrão" footer="Tema e voz mudam na hora. As unidades só valem depois de salvar.">
            {UNIT_GROUPS.map((g) => (
              <div key={g.key} className="px-3.5 py-3">
                <span className="mb-2 flex items-center gap-2 text-caption text-mute">
                  <Ruler className="h-3.5 w-3.5" /> {g.label}
                </span>
                <Segmented
                  label={g.label}
                  value={units[g.key]}
                  options={g.options.map((o) => ({ id: o, label: o }))}
                  onChange={(o) => {
                    const next = { ...units, [g.key]: o };
                    setUnits(next);
                    setF({ ...f, units: joinUnits(next) });
                  }}
                />
              </div>
            ))}
          </Group>
          <button type="submit" disabled={!dirty} className="glass-ink loop-border press mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full text-body font-medium disabled:opacity-45">
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

          <Group title="Seus dados">
            <Row icon={<Download className="h-4 w-4" />} label="Exportar conversas e perfil" hint="Baixa um arquivo com seus dados" onClick={exportData} />
            <Row danger icon={<Trash2 className="h-4 w-4" />} label="Apagar dados deste aparelho" hint="Não dá para desfazer" onClick={wipe} />
          </Group>

          <Group title="Sobre">
            <Row icon={<FileText className="h-4 w-4" />} label="Termos de uso" onClick={() => setLegal('terms')} />
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Política de privacidade" onClick={() => setLegal('privacy')} />
            <Row icon={<Info className="h-4 w-4" />} label="Versão" value={new Date(__BUILD__).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} />
          </Group>
          <p className="mt-3 px-1 text-caption text-mute">Seus dados ficam guardados só neste aparelho.</p>
        </form>
      </ScreenPanel>
      {legal && <LegalPanel kind={legal} onClose={() => setLegal(null)} />}
    </>
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
          className="min-w-0 flex-1 bg-transparent py-3 text-body text-ink placeholder:text-mute focus:outline-none"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Limpar busca" className="flex h-9 w-9 items-center justify-center rounded-full text-mute">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {list.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-body font-medium">{q ? 'Nada encontrado' : 'Nenhuma conversa ainda'}</p>
          <p className="mt-1 text-small text-mute">{q ? 'Tente outra palavra.' : 'Pergunte algo no chat ou por voz e ela aparece aqui.'}</p>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label} className="mb-5">
          <h2 className="mb-2 px-1 text-caption font-medium uppercase tracking-wide text-mute">{g.label}</h2>
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
                      <span className="block truncate text-body">{c.title}</span>
                      <span className="block text-caption text-mute">
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
