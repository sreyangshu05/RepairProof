import { create } from 'zustand';
import { UserRole } from '@repairproof/shared';
import { apiGet, apiPost, setApiAccessToken } from '../lib/api';
import { setActiveLocale, type Locale } from '../i18n/catalog';

function applyProfileLocale(locale?: string) {
  if (locale !== 'en-IN' && locale !== 'bn-BD' && locale !== 'hi-IN') return;
  setActiveLocale(locale as Locale);
  try {
    window.localStorage.setItem('repairproof.locale', locale);
    window.dispatchEvent(new CustomEvent('repairproof:locale', { detail: locale }));
  } catch {
    // The in-memory catalog still uses the profile locale in this tab.
  }
}

interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  locale?: Locale;
  shop?: {
    id: string;
    name: string;
    logoUrl?: string | null;
  } | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  acceptSession: (response: { user: User; token: string | null }) => void;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await apiPost<
        { user: User; token: string | null },
        { email: string; password: string }
      >('/auth/login', { email, password });
      if (!response.token)
        throw new Error(
          'The authentication provider did not create a session. Try again or contact your administrator.',
        );
      setApiAccessToken(response.token);
      applyProfileLocale(response.user.locale);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  acceptSession: (response) => {
    if (!response.token)
      throw new Error(
        'The authentication provider did not create a session. Check your email confirmation settings.',
      );
    setApiAccessToken(response.token);
    applyProfileLocale(response.user.locale);
    set({ user: response.user, token: response.token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    setApiAccessToken(null);
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const profile = await apiGet<{
        userId: string;
        email: string;
        displayName: string;
        role: UserRole;
        locale?: Locale;
        shop?: User['shop'];
      }>('/auth/me');
      set({
        user: {
          id: profile.userId,
          email: profile.email,
          displayName: profile.displayName,
          role: profile.role,
          shop: profile.shop,
        },
        isAuthenticated: true,
        token,
        isLoading: false,
      });
      applyProfileLocale(profile.locale);
    } catch {
      setApiAccessToken(null);
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
