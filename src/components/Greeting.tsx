import React, { useMemo } from 'react';

const salutation = (h: number) => (h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');

/** Saudação com o nome do usuário: palavras entram em cascata e o nome recebe um brilho que passa uma vez. */
export const Greeting: React.FC<{ name: string; line2?: string }> = ({ name, line2 = 'O que vamos diagnosticar hoje?' }) => {
  const sal = useMemo(() => salutation(new Date().getHours()), []);
  const first = name.trim().split(' ')[0] || 'mecânico';
  const words2 = line2.split(' ');
  let w = 0;

  return (
    <h1
      aria-label={`${sal}, ${first}. ${line2}`}
      className="text-[clamp(28px,4.2vw+14px,52px)] font-medium leading-[1.18] tracking-[-0.02em]"
    >
      <span aria-hidden="true" className="block text-sub">
        <span className="word" style={{ ['--w' as string]: w++ }}>
          {sal},
        </span>{' '}
        <span className="word" style={{ ['--w' as string]: w++ }}>
          <span className="name-sweep">{first}</span>
        </span>
      </span>
      <span aria-hidden="true" className="mt-1 block text-ink">
        {words2.map((word, i) => (
          <React.Fragment key={i}>
            <span className="word" style={{ ['--w' as string]: w++ }}>
              {word}
            </span>{' '}
          </React.Fragment>
        ))}
      </span>
    </h1>
  );
};
