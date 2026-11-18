import { create } from 'zustand';
import { Profile, UserRole } from '@repairproof/shared';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
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
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: 'dev-tech-1',
    email: 'technician@repairproof.dev',
    displayName: 'Master Technician',
    role: UserRole.TECHNICIAN,
    shop: {
      id: 'default-shop',
      name: 'Apex Device Diagnostics & Lab',
      logoUrl: null,
    },
  },
  token: localStorage.getItem('rp_auth_token') || 'dev-technician-token',
  isLoading: false,
  isAuthenticated: true,

  login: async (email: string, password = 'password123') => {
    set({ isLoading: true });
    try {
      const response: any = await api.post('/auth/login', { email, password });
      localStorage.setItem('rp_auth_token', response.token);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      // Fallback dev login
      const devUser = {
        id: 'dev-tech-1',
        email,
        displayName: 'Master Technician',
        role: UserRole.TECHNICIAN,
        shop: {
          id: 'default-shop',
          name: 'Apex Device Diagnostics & Lab',
        },
      };
      localStorage.setItem('rp_auth_token', 'dev-technician-token');
      set({
        user: devUser,
        token: 'dev-technician-token',
        isAuthenticated: true,
        isLoading: false,
      });
    }
  },

  logout: () => {
    localStorage.removeItem('rp_auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const profile: any = await api.get('/auth/me');
      set({
        user: {
          id: profile.userId,
          email: profile.email,
          displayName: profile.displayName,
          role: profile.role,
          shop: profile.shop,
        },
        isAuthenticated: true,
      });
    } catch {
      // Keep dev user if offline/dev
    }
  },
}));
