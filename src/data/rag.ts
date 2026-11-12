import type { Citation, Manual } from './types';
import catalogData from './catalog.json';

const bundledCatalog: Manual[] = catalogData as Manual[];

const stopWords = new Set(
  'acho alguma alguns antes apos aqui com como contexto contra das depois desde dos ela ele em entre era essa esse esta este foi isso isto mais meu minha nao nos nossa onde para pela pelo pode qual quando que sao sem ser seu sua tem ter tentei uma voce vezes erro problema'.split(' ')
);

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function keywords(text: string): Set<string> {
  return new Set(normalize(text).split(/[^a-z0-9-]+/).filter(word => word.length > 2 && !stopWords.has(word)));
}

export function searchManuals(question: string, manuals: Manual[] = [], limit = 4): Citation[] {
  const allManuals = [...bundledCatalog, ...manuals];
  const terms = [...keywords(question)];
  if (!terms.length) return [];

  const compact = (text: string) => normalize(text).replace(/([a-z])\s*(\d)/g, '$1$2').replace(/[^a-z0-9]+/g, ' ').trim();
  const normalized = ' ' + compact(question) + ' ';

  const results: { score: number; title: string; line: number; text: string }[] = [];

  for (const manual of allManuals) {
    const alias = manual.aliases?.find(value => normalized.includes(' ' + compact(value) + ' '));
    const lines = manual.text.split(/\r?\n/);

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const words = keywords(trimmed);
      let score = terms.filter(t => words.has(t)).length;
      if (alias) score += 2;

      if (score >= 1) {
        results.push({
          score,
          title: manual.title,
          line: index + 1,
          text: trimmed,
        });
      }
    });
  }

  const seen = new Set<string>();
  return results
    .sort((a, b) => b.score - a.score)
    .filter(r => {
      const k = normalize(r.text).replace(/s+/g, ' ');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit)
    .map(({ title, line, text }) => ({ title, line, text }));
}

export function generateLocalAnswer(prompt: string, manuals: Manual[] = []): { text: string; citations: Citation[]; analysis: string } {
  const citations = searchManuals(prompt, manuals);

  let text = '';
  const count = citations.length;
  const analysis = count
    ? `Cruzamento RAG concluído: ${count} ${count === 1 ? 'referência técnica encontrada' : 'referências técnicas encontradas'} no catálogo ativo.`
    : 'Nenhuma referência direta encontrada no catálogo. Análise heurística de bancada aplicada.';

  if (count > 0) {
    text = `### Diagnóstico & Especificações de Bancada\n\n`;
    text += `Com base nos manuais de serviço e fichas técnicas indexados no **Void**, seguem as orientações para o procedimento solicitado:\n\n`;

    citations.forEach(cit => {
      text += `> **${cit.title}** (Ref. linha ${cit.line})\n`;
      text += `\`\`\`text\n${cit.text}\n\`\`\`\n\n`;
    });

    text += `#### Checklist de Verificação na Bancada:\n`;
    text += `- [ ] Conferir aperto com torquímetro calibrado conforme os valores acima.\n`;
    text += `- [ ] Efetuar a medição de folgas com motor totalmente frio (abaixo de 35°C).\n`;
    text += `- [ ] Inspecionar conectores e chicote contra oxidação ou mau contato.\n`;
  } else {
    text = `### Orientação de Investigação Inicial\n\n`;
    text += `Não localizei uma ficha exata para o termo informado nas fontes locais. Para uma busca precisa, tente informar:\n`;
    text += `- **Modelo e cilindrada** (ex: *Titan 160*, *Lander 250*, *MT-07*, *CB 500F*).\n`;
    text += `- **Código de falha** (ex: *P0300*, *P0201*, *8 piscadas MIL*).\n`;
    text += `- **Componente mecânico** (ex: *torque cabeçote*, *folga válvulas*, *pressão da bomba*).\n`;
  }

  return { text, citations, analysis };
}
