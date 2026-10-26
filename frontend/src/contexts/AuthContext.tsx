import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, type LoginInput, type RegisterInput } from '../api/auth.api';
import type { User } from '../types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setToken(null);
      navigate('/login', { replace: true });
    }
    window.addEventListener('lms:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('lms:unauthorized', handleUnauthorized);
  }, [navigate]);

  async function login(input: LoginInput) {
    const result = await authApi.login(input);
    setUser(result.user);
    setToken(result.token);
  }

  async function register(input: RegisterInput) {
    await authApi.register(input);
  }

  function logout() {
    setUser(null);
    setToken(null);
  }

  const value = useMemo(
    () => ({ user, token, login, register, logout }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
