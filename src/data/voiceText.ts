/** Resumo falável de uma resposta em markdown: sem títulos, checklists nem notas; mantém o trecho técnico. */
export function voiceSummary(md: string, max = 420): string {
  const out: string[] = [];
  let code = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) {
      code = !code;
      continue;
    }
    if (!code) {
      if (/^#{1,6}\s/.test(line) || /^-\s*\[/.test(line) || line.startsWith('> ')) continue;
    }
    const t = line.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
    if (!t || (!code && /:$/.test(t))) continue; // pula frases de abertura como "seguem as orientações:"
    out.push(t);
  }
  let text = out.join(' ');
  if (text.length > max) {
    const cut = text.slice(0, max);
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
    text = stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '…';
  }
  return text || 'Não encontrei isso nos manuais. Quer adicionar um manual sobre essa máquina?';
}
