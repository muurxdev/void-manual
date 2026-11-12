import React from 'react';

/**
 * Mapa de deslocamento da lente: vermelho = X, verde = Y. Centro neutro (128),
 * bordas empurram a amostra para dentro, curvando o fundo como vidro espesso.
 */
const MAP =
  "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none'>" +
  "<defs>" +
  "<linearGradient id='r' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#ff0000'/><stop offset='.17' stop-color='#800000'/><stop offset='.83' stop-color='#800000'/><stop offset='1' stop-color='#000'/></linearGradient>" +
  "<linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#00ff00'/><stop offset='.17' stop-color='#008000'/><stop offset='.83' stop-color='#008000'/><stop offset='1' stop-color='#000'/></linearGradient>" +
  "</defs>" +
  "<rect width='100' height='100' fill='#000'/>" +
  "<rect width='100' height='100' fill='url(#r)'/>" +
  "<rect width='100' height='100' fill='url(#g)' style='mix-blend-mode:screen'/>" +
  "</svg>";

const HREF = `data:image/svg+xml;utf8,${encodeURIComponent(MAP)}`;

/** Definições SVG do Liquid Glass. Montar uma única vez na raiz do app. */
export const GlassDefs: React.FC = () => (
  <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', pointerEvents: 'none' }}>
    <defs>
      <filter id="lg-lens" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={HREF} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="22" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>
);
