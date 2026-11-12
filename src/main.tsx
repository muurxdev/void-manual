import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './index.css'
import App from './App.tsx'
import { FeedbackProvider } from './components/Feedback'
import { ErrorBoundary, OfflineBanner } from './components/Boundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <FeedbackProvider>
        <App />
        <OfflineBanner />
      </FeedbackProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// uso offline: só no app publicado
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).catch(() => {});
  });
}

// versão nova publicada: ao voltar para o app, confere e recarrega sozinho (sem ficar preso na tela antiga)
if (import.meta.env.PROD) {
  const mine = Array.from(document.scripts).map((s) => s.src.match(/assets\/index-[^/]+\.js/)?.[0]).find(Boolean);
  const check = async () => {
    try {
      const html = await (await fetch(import.meta.env.BASE_URL + '?_=' + Date.now(), { cache: 'no-store' })).text();
      const now = html.match(/assets\/index-[^"']+\.js/)?.[0];
      if (mine && now && now !== mine) location.reload();
    } catch {
      /* sem internet: segue */
    }
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  window.setTimeout(check, 4000);
}
