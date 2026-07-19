'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { API, CONFIG } from '../services/api';

interface Role {
  id: number;
  name: string;
  label?: string;
}

interface User {
  id: number;
  email: string;
  full_name: string;
  role?: Role;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: { email: string; password?: string }) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  getRoleLabel: () => string;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Initialiser la session depuis localStorage
    const savedToken = localStorage.getItem(CONFIG.TOKEN_KEY);
    const savedUser = localStorage.getItem(CONFIG.USER_KEY);

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (_) {
        // Ignorer l'erreur et vider la session
        localStorage.removeItem(CONFIG.USER_KEY);
        localStorage.removeItem(CONFIG.TOKEN_KEY);
      }
    }
    setLoading(false);

    // Écouter l'événement de déconnexion globale émis par api.ts en cas de 401
    const handleGlobalLogout = () => {
      setUser(null);
      setToken(null);
      router.push('/login');
    };

    window.addEventListener('auth_logout', handleGlobalLogout);
    return () => {
      window.removeEventListener('auth_logout', handleGlobalLogout);
    };
  }, [router]);

  // Protection des routes côté client
  useEffect(() => {
    if (loading) return;

    const publicRoutes = ['/', '/login', '/forgot-password'];
    const isPublic = publicRoutes.includes(pathname);

    if (!token && !isPublic) {
      router.push('/login');
    } else if (token && isPublic && pathname !== '/') {
      router.push('/dashboard');
    }
  }, [token, pathname, loading, router]);

  const login = async (credentials: { email: string; password?: string }) => {
    try {
      const res = await API.post('/auth/login', credentials);
      if (res.data && res.data.token) {
        const { token: jwtToken, user: userData, refreshToken } = res.data;
        
        localStorage.setItem(CONFIG.TOKEN_KEY, jwtToken);
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(userData));
        if (refreshToken) {
          localStorage.setItem(CONFIG.REFRESH_KEY, refreshToken);
        }

        setToken(jwtToken);
        setUser(userData);
        router.push('/dashboard');
      } else {
        throw new Error('Erreur de connexion');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Une erreur est survenue lors de la connexion.');
    }
  };

  const logout = () => {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    localStorage.removeItem(CONFIG.REFRESH_KEY);
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const updateUser = (updatedUser: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const merged = { ...prev, ...updatedUser };
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    const r = user.role?.name;
    return r === 'super_admin' || (r ? roles.includes(r) : false);
  };

  const getRoleLabel = () => {
    if (!user || !user.role) return 'Visiteur';
    return user.role.label || user.role.name;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        hasRole,
        getRoleLabel,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth doit être utilisé au sein d'un AuthProvider");
  }
  return context;
}
