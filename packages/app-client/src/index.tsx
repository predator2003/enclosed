/* @refresh reload */

import { ColorModeProvider, ColorModeScript, createLocalStorageManager } from '@kobalte/core/color-mode';
import { Router } from '@solidjs/router';
import { render, Suspense } from 'solid-js/web';
import { I18nProvider } from './modules/i18n/i18n.provider';
import { NoteContextProvider } from './modules/notes/notes.context';
import { Toaster } from './modules/ui/components/sonner';
import { getRoutes } from './routes';
import '@unocss/reset/tailwind.css';
// Self-hosted brand font (no external font CDN, keeps the CSP on 'self').
// Weights match actual usage: 300 (font-light), 400/500/600/700 (body, medium,
// semibold, bold).
import '@fontsource/mulish/300.css';
import '@fontsource/mulish/400.css';
import '@fontsource/mulish/500.css';
import '@fontsource/mulish/600.css';
import '@fontsource/mulish/700.css';
import 'virtual:uno.css';
import './app.css';

render(
  () => {
    const initialColorMode = 'system';
    const colorModeStorageKey = 'enclosed_color_mode';
    const localStorageManager = createLocalStorageManager(colorModeStorageKey);

    return (
      <Router
        children={getRoutes()}
        root={props => (
          <Suspense>
            <I18nProvider>
              <NoteContextProvider>
                <ColorModeScript storageType={localStorageManager.type} storageKey={colorModeStorageKey} initialColorMode={initialColorMode} />
                <ColorModeProvider
                  initialColorMode={initialColorMode}
                  storageManager={localStorageManager}
                >
                  <div class="min-h-screen font-sans text-sm font-400">{props.children}</div>
                  <Toaster />

                </ColorModeProvider>
              </NoteContextProvider>
            </I18nProvider>
          </Suspense>
        )}
      />
    );
  },
  document.getElementById('root')!,
);
