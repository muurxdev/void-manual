import React from 'react';
import { ScreenPanel } from './Panels';

export type LegalKind = 'terms' | 'privacy';

const DOCS: Record<LegalKind, { title: string; sections: { h: string; p: string[] }[] }> = {
  terms: {
    title: 'Termos de uso',
    sections: [
      {
        h: 'O que é o Void',
        p: ['O Void é um manual vivo para máquinas: você pergunta por texto ou voz e ele responde com base nos manuais incluídos e nos arquivos que você enviar.'],
      },
      {
        h: 'Use com cuidado',
        p: [
          'As respostas servem de orientação e podem conter erros. Antes de agir, confira valores de torque, folgas e procedimentos no manual do fabricante.',
          'Trabalhe com as proteções e ferramentas adequadas. O Void não substitui um profissional habilitado nem se responsabiliza por danos causados por seguir uma resposta sem conferência.',
        ],
      },
      {
        h: 'Planos e cobrança',
        p: [
          'Existe um plano grátis, com limite diário de perguntas, e planos pagos com mais recursos. A cobrança é mensal ou anual, e você pode cancelar quando quiser; o acesso continua até o fim do período já pago.',
          'Os valores e limites de cada plano aparecem na tela Planos e podem mudar, com aviso prévio.',
        ],
      },
      {
        h: 'Seus arquivos',
        p: ['Você só deve enviar arquivos que tem o direito de usar. Os arquivos ficam disponíveis só para a sua conta.'],
      },
    ],
  },
  privacy: {
    title: 'Política de privacidade',
    sections: [
      {
        h: 'Que dados usamos',
        p: ['Nome, e-mail, perfil da oficina, conversas, arquivos enviados e o uso do dia (para os limites do plano). Hoje esses dados ficam guardados no seu aparelho.'],
      },
      {
        h: 'Para que usamos',
        p: ['Para responder às suas perguntas, guardar o seu histórico, aplicar os limites do plano e melhorar o app. Não vendemos seus dados.'],
      },
      {
        h: 'Com quem compartilhamos',
        p: ['Quando a conta online existir, parte dos dados passará por serviços que fazem o Void funcionar: hospedagem e banco de dados, inteligência artificial para gerar respostas e pagamento. Eles só recebem o necessário para a tarefa.'],
      },
      {
        h: 'Seus direitos',
        p: ['Você pode ver, exportar e apagar seus dados a qualquer momento em Configurações → Seus dados. Também pode pedir correção ou exclusão da conta pelo contato abaixo.'],
      },
      { h: 'Contato', p: ['[e-mail de contato a definir]'] },
    ],
  },
};

/** Textos legais. São RASCUNHOS: revisar com um advogado antes de lançar a cobrança. */
export const LegalPanel: React.FC<{ kind: LegalKind; onClose: () => void }> = ({ kind, onClose }) => {
  const d = DOCS[kind];
  return (
    <ScreenPanel page title={d.title} subtitle="Rascunho, sujeito a revisão" onClose={onClose}>
      <div className="space-y-5 pb-4">
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className="mb-1.5 text-[15px] font-medium">{s.h}</h2>
            {s.p.map((t) => (
              <p key={t} className="mb-2 text-[14px] leading-relaxed text-sub">
                {t}
              </p>
            ))}
          </section>
        ))}
      </div>
    </ScreenPanel>
  );
};
