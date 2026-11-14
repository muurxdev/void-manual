import React from 'react';

/**
 * Marca do Void (v2): um buraco negro visto de lado, como a luz se curva em volta dele.
 * O vazio no meio, o anel de fótons, o arco do disco dobrado por cima e por baixo,
 * e o disco de acreção cruzando reto. Usa a cor do texto.
 */
export const markBody = (_id: string, color: string) => `<g fill="none" stroke="${color}" stroke-linecap="round">
<circle cx="32" cy="32" r="10.5" stroke-width="2.6"/>
<path d="M14.6 32A17.4 17.4 0 0 1 49.4 32" stroke-width="2.6"/>
<path d="M21 40.2A13.2 13.2 0 0 0 43 40.2" stroke-width="2" opacity=".7"/>
<path d="M4 32H60" stroke-width="2.6"/></g>`;

export const VoidMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Void" dangerouslySetInnerHTML={{ __html: markBody('vm', 'currentColor') }} />
);
