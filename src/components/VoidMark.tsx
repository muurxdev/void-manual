import React, { useId } from 'react';

/**
 * Marca do Void: um buraco negro visto de lado. O vazio no centro, o anel de fótons em volta
 * e o disco de acreção cruzando na frente (o lado de trás some atrás do anel). Usa a cor do texto.
 */
export const markBody = (id: string, fill: string) => `<defs>
<mask id="${id}k" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84"><rect x="-10" y="-10" width="84" height="84" fill="#fff"/><path d="M4.1 32A27.9 4.5 0 0 0 59.9 32" fill="none" stroke="#000" stroke-width="6.4"/></mask>
<mask id="${id}b" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84"><rect x="-10" y="-10" width="84" height="84" fill="#fff"/><path d="M13.3 32A18.7 18.7 0 0 1 50.7 32Z" fill="#000"/></mask></defs>
<g transform="rotate(-14 32 32)" fill="${fill}">
<path mask="url(#${id}k)" fill-rule="evenodd" d="M32 14.8a17.2 17.2 0 1 0 0 34.4a17.2 17.2 0 1 0 0-34.4ZM32 19.6a12.4 12.4 0 1 1 0 24.8a12.4 12.4 0 1 1 0-24.8Z"/>
<path mask="url(#${id}b)" fill-rule="evenodd" d="M3 32a29 5.6 0 1 0 58 0a29 5.6 0 1 0-58 0ZM5.3 32a26.7 3.4 0 1 0 53.4 0a26.7 3.4 0 1 0-53.4 0Z"/></g>`;

export const VoidMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className }) => {
  const id = 'vm' + useId().replace(/[^a-z0-9]/gi, '');
  return <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Void" dangerouslySetInnerHTML={{ __html: markBody(id, 'currentColor') }} />;
};
