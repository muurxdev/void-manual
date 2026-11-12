import type { FileKind, LibraryRecord, Manual } from './types';

/* ---------------- limites ---------------- */
export const MAX_FILE_MB = 50;
export const MAX_FILES_PER_BATCH = 10;
const MAX_TEXT = 150_000; // caracteres guardados por arquivo para consulta

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF',
  doc: 'Documento',
  sheet: 'Planilha',
  image: 'Imagem',
  audio: 'Áudio',
  text: 'Texto',
  other: 'Arquivo',
};

export function kindOf(file: File): FileKind {
  const n = file.name.toLowerCase();
  const t = file.type;
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|oga|opus|aac|flac|webm)$/.test(n)) return 'audio';
  if (/\.(docx?|odt|rtf)$/.test(n) || t.includes('wordprocessingml') || t === 'application/msword') return 'doc';
  if (/\.(xlsx|xls|ods)$/.test(n) || t.includes('spreadsheetml') || t === 'application/vnd.ms-excel') return 'sheet';
  if (/\.(txt|md|csv|tsv|json|log|html?|xml)$/.test(n) || t.startsWith('text/')) return 'text';
  return 'other';
}

/* ---------------- armazenamento (IndexedDB) ---------------- */
const DB = 'void-library';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('items', { keyPath: 'id' });
      req.result.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const wrap = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

export async function listRecords(): Promise<LibraryRecord[]> {
  try {
    const db = await openDb();
    const all = await wrap(db.transaction('items').objectStore('items').getAll());
    return (all as LibraryRecord[]).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

async function saveRecord(rec: LibraryRecord, blob: Blob) {
  const db = await openDb();
  const tx = db.transaction(['items', 'blobs'], 'readwrite');
  tx.objectStore('items').put(rec);
  tx.objectStore('blobs').put(blob, rec.id);
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function removeRecord(id: string) {
  const db = await openDb();
  const tx = db.transaction(['items', 'blobs'], 'readwrite');
  tx.objectStore('items').delete(id);
  tx.objectStore('blobs').delete(id);
  await new Promise<void>((res) => (tx.oncomplete = () => res()));
}

export const toManual = (r: LibraryRecord): Manual => ({
  id: r.id,
  title: r.title,
  text: r.text || r.title,
  aliases: [r.title, ...r.topics],
  updatedAt: r.createdAt,
});

/* ---------------- entender e separar por tópicos ---------------- */
const DOMAIN: { topic: string; re: RegExp }[] = [
  { topic: 'Motor', re: /\b(motor|cilindro|pist[aã]o|v[aá]lvula|virabrequim|cabe[cç]ote|biela|comando)\b/gi },
  { topic: 'Elétrica', re: /\b(el[eé]tric[ao]|bateria|fus[ií]vel|chicote|rel[eé]|ignição|ignicao|alternador|vela)\b/gi },
  { topic: 'Injeção', re: /\b(inje[cç][aã]o|combust[ií]vel|bomba de|bico|tps|sensor map|carburador)\b/gi },
  { topic: 'Torque e folgas', re: /\b(torque|folga|aperto|kgf|n\.?m)\b/gi },
  { topic: 'Códigos de falha', re: /\b(c[oó]digo|falha|diagn[oó]stic|obd|dtc|p0\d{3}|piscada)\b/gi },
  { topic: 'Freios', re: /\b(freio|pastilha|abs|disco de freio|pin[çc]a)\b/gi },
  { topic: 'Suspensão', re: /\b(suspens[aã]o|amortecedor|garfo|mola|balan[cç]a)\b/gi },
  { topic: 'Transmissão', re: /\b(transmiss[aã]o|embreagem|c[aâ]mbio|corrente|rela[cç][aã]o|diferencial)\b/gi },
  { topic: 'Hidráulica', re: /\b(hidr[aá]ulic[ao]|press[aã]o hidr|cilindro hidr|v[aá]lvula de al[ií]vio)\b/gi },
  { topic: 'Lubrificação', re: /\b([oó]leo|lubrifica[cç]|filtro)\b/gi },
  { topic: 'Arrefecimento', re: /\b(arrefec|radiador|l[ií]quido de arref|ventoinha)\b/gi },
  { topic: 'Pneus e rodas', re: /\b(pneu|roda|calibragem|aro)\b/gi },
  { topic: 'Manutenção', re: /\b(manuten[cç][aã]o|revis[aã]o|inspe[cç][aã]o|periodicidade)\b/gi },
];
const BRANDS = /\b(honda|yamaha|suzuki|kawasaki|bmw|ducati|triumph|fiat|volkswagen|chevrolet|ford|toyota|renault|hyundai|john deere|case ih|new holland|massey ferguson|valtra|scania|volvo|mercedes)\b/i;
const STOP = new Set(
  'para com uma que dos das nos nas por mais como mas foi são ser tem não sua seu ele ela isso esse essa este esta entre sobre também quando onde pode deve cada todo toda após antes até sem ser ter and the for with from that this'.split(' ')
);

export function analyze(text: string, title: string, kind: FileKind): string[] {
  const topics: string[] = [];
  const hay = `${title}\n${text}`;
  const brand = hay.match(BRANDS);
  if (brand) topics.push(brand[0].replace(/\b\w/g, (c) => c.toUpperCase()));

  const scored = DOMAIN.map((d) => ({ t: d.topic, n: (hay.match(d.re) || []).length })).filter((d) => d.n >= 2);
  scored.sort((a, b) => b.n - a.n);
  topics.push(...scored.slice(0, 4).map((d) => d.t));

  if (topics.length < 2 && text) {
    const freq = new Map<string, number>();
    for (const w of text.toLowerCase().match(/[a-zçãõáéíóúâêô]{5,}/g) || []) {
      if (!STOP.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
    }
    [...freq.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([w]) => topics.push(w.charAt(0).toUpperCase() + w.slice(1)));
  }
  if (!topics.length) topics.push(text ? 'Geral' : kind === 'image' ? 'Imagem sem texto' : 'Sem texto lido');
  return [...new Set(topics)].slice(0, 5);
}

/* ---------------- leitura por tipo ---------------- */
export type Stage = 'enviando' | 'lendo' | 'entendendo' | 'organizando' | 'pronto';
type Report = (stage: Stage, pct: number, note?: string) => void;

function readBuffer(file: File, report: Report): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onprogress = (e) => e.lengthComputable && report('enviando', Math.round((e.loaded / e.total) * 100));
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

async function readPdf(buf: ArrayBuffer, report: Report): Promise<{ text: string; note?: string }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const pages = Math.min(doc.numPages, 400);
  let out = '';
  for (let i = 1; i <= pages && out.length < MAX_TEXT; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
    report('lendo', Math.round((i / pages) * 100), `Página ${i} de ${pages}`);
  }
  const text = out.trim();
  return { text, note: text ? undefined : 'PDF digitalizado (só imagens): sem texto para ler.' };
}

async function readDocx(buf: ArrayBuffer): Promise<{ text: string; note?: string }> {
  const mammoth = await import('mammoth');
  const r = await mammoth.extractRawText({ arrayBuffer: buf });
  return { text: r.value.trim() };
}

async function readSheet(file: File): Promise<{ text: string; note?: string }> {
  const mod = await import('read-excel-file/browser');
  const sheets = await mod.default(file);
  const out = sheets
    .map((s: { sheet: string; data: unknown[][] }) => `# ${s.sheet}\n` + s.data.map((row) => row.map((c) => (c ?? '')).join(' | ')).join('\n'))
    .join('\n\n');
  return { text: out.trim() };
}

async function thumbOf(file: File): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(file);
    const s = 240 / Math.max(bmp.width, bmp.height);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * Math.min(1, s)));
    c.height = Math.max(1, Math.round(bmp.height * Math.min(1, s)));
    c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.7);
  } catch {
    return undefined;
  }
}

async function readImage(file: File, report: Report): Promise<{ text: string; thumb?: string; note?: string }> {
  const thumb = await thumbOf(file);
  try {
    const { createWorker } = await import('tesseract.js');
    report('lendo', 15, 'Reconhecendo texto na imagem');
    const worker = await createWorker('por', 1, {
      logger: (m: { progress?: number }) => m.progress != null && report('lendo', 15 + Math.round(m.progress * 85)),
    });
    const { data } = await worker.recognize(file);
    await worker.terminate();
    return { text: data.text.trim(), thumb, note: data.text.trim() ? undefined : 'Nenhum texto reconhecido na imagem.' };
  } catch {
    return { text: '', thumb, note: 'Não consegui reconhecer texto (precisa de internet na primeira vez).' };
  }
}

async function readAudio(file: File, report: Report): Promise<{ text: string; note?: string }> {
  try {
    report('lendo', 5, 'Preparando o áudio');
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    await ctx.close();
    const seconds = Math.min(decoded.duration, 600);
    const off = new OfflineAudioContext(1, Math.ceil(seconds * 16000), 16000);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const pcm = (await off.startRendering()).getChannelData(0);

    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    report('lendo', 15, 'Carregando o reconhecimento de fala (só na primeira vez)');
    const asr = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
      progress_callback: (p) => {
        const pr = (p as { progress?: number }).progress;
        if (pr != null) report('lendo', 15 + Math.round(pr * 0.5));
      },
    });
    report('lendo', 70, 'Transcrevendo');
    const result = (await asr(pcm, { language: 'portuguese', task: 'transcribe', chunk_length_s: 30 })) as { text: string } | { text: string }[];
    const text = (Array.isArray(result) ? result[0].text : result.text).trim();
    return { text, note: decoded.duration > 600 ? 'Transcrevi só os primeiros 10 minutos.' : undefined };
  } catch {
    return { text: '', note: 'Não consegui transcrever este áudio agora.' };
  }
}

async function readText(buf: ArrayBuffer, name: string): Promise<{ text: string }> {
  let text = new TextDecoder('utf-8').decode(buf);
  if (/\.html?$/i.test(name) || /\.xml$/i.test(name)) text = text.replace(/<[^>]+>/g, ' ');
  return { text: text.replace(/\s+\n/g, '\n').trim() };
}

/** Evita que um arquivo problemático trave a fila. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => (window.clearTimeout(t), resolve(v)),
      (e) => (window.clearTimeout(t), reject(e))
    );
  });
}

/* ---------------- pipeline completo ---------------- */
export async function ingest(file: File, report: Report): Promise<LibraryRecord> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Maior que ${MAX_FILE_MB} MB`);
  const kind = kindOf(file);
  if (kind === 'other') throw new Error('Tipo de arquivo não suportado');

  report('enviando', 0);
  const buf = await readBuffer(file, report);

  report('lendo', 0);
  let text = '';
  let thumb: string | undefined;
  let note: string | undefined;
  try {
    if (kind === 'pdf') ({ text, note } = await withTimeout(readPdf(buf, report), 60000));
    else if (kind === 'doc') {
      if (/\.docx$/i.test(file.name)) ({ text, note } = await readDocx(buf));
      else note = 'Formato antigo: salve como .docx para eu ler o texto.';
    } else if (kind === 'sheet') {
      if (/\.xlsx$/i.test(file.name)) ({ text, note } = await readSheet(file));
      else note = 'Formato antigo: salve como .xlsx para eu ler a planilha.';
    } else if (kind === 'image') ({ text, thumb, note } = await readImage(file, report));
    else if (kind === 'audio') ({ text, note } = await withTimeout(readAudio(file, report), 600000));
    else ({ text } = await readText(buf, file.name));
  } catch {
    note = 'Não consegui ler o conteúdo deste arquivo.';
  }
  report('lendo', 100);

  report('entendendo', 40, 'Separando por tópicos');
  const clipped = text.slice(0, MAX_TEXT);
  const topics = analyze(clipped, file.name, kind);
  report('entendendo', 100);

  report('organizando', 60);
  const rec: LibraryRecord = {
    id: 'lib-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: file.name.replace(/\.[^.]+$/, ''),
    kind,
    size: file.size,
    mime: file.type,
    topics,
    text: clipped,
    thumb,
    note,
    createdAt: Date.now(),
  };
  await saveRecord(rec, file);
  report('pronto', 100);
  return rec;
}

/** Arquivo original guardado no aparelho (para visualizar ou baixar). */
export async function getBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    const b = await wrap(db.transaction('blobs').objectStore('blobs').get(id));
    return (b as Blob) ?? null;
  } catch {
    return null;
  }
}
