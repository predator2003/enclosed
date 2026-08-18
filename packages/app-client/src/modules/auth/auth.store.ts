import { makePersisted } from '@solid-primitives/storage';
import { createRoot, createSignal } from 'solid-js';
import { createHook } from '../shared/hooks/hooks';
import { isAccessTokenExpired } from './auth.models';

export const authStore = createRoot(() => {
  const [getAccessToken, setAccessTokenValue] = makePersisted(createSignal<string | null>(null), { name: 'enclosed_access_token', storage: localStorage });
  const onAuthChangeHook = createHook<{ isAuthenticated: boolean }>();
  // The redirect URL carries the note's URL fragment, which contains the note's
  // decryption key. It is kept in sessionStorage (tab-scoped, not written to the
  // profile on disk like localStorage) and cleared as soon as it has been used.
  const [getRedirectUrl, setRedirectUrlValue] = makePersisted(createSignal<string | null>(null), { name: 'enclosed_redirect_url', storage: sessionStorage });

  const clearRedirectUrl = () => setRedirectUrlValue(null);

  // Older versions persisted the same value (including the key) in localStorage,
  // where it survived indefinitely; drop any leftover copy.
  localStorage.removeItem('enclosed_redirect_url');

  const getIsAuthenticated = () => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      return false;
    }

    const isExpired = isAccessTokenExpired({ accessToken });

    return !isExpired;
  };

  const setAccessToken = async ({ accessToken }: { accessToken: string }) => {
    setAccessTokenValue(accessToken);
    await onAuthChangeHook.trigger({ isAuthenticated: true });
  };

  const clearAccessToken = async () => {
    setAccessTokenValue(null);
    await onAuthChangeHook.trigger({ isAuthenticated: false });
  };

  return {
    setAccessToken,
    getAccessToken,
    clearAccessToken,
    getIsAuthenticated,
    getRedirectUrl,
    setRedirectUrl: setRedirectUrlValue,
    clearRedirectUrl,

    async logout() {
      await clearAccessToken();
      window.location.href = '/login';
    },

    onAuthChange: onAuthChangeHook.on,
  };
});
