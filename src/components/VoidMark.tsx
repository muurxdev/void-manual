import React from 'react';

/** Marca do Void: um V geométrico cujo vazio interno é uma porca sextavada. Usa a cor do texto. */
export const VoidMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Void" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M4 6h16l12 29L44 6h16L40 58H24L4 6Zm28 22.5 7 4v8l-7 4-7-4v-8l7-4Zm0 5.2-2.6 1.5v3l2.6 1.5 2.6-1.5v-3L32 33.7Z"
    />
  </svg>
);
