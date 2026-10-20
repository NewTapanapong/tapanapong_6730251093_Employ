import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { api, AuthUser } from './api';

const TOKEN_KEY = 'hr-manager-token';
const USER_KEY = 'hr-manager-user';
type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readToken() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function saveToken(value: string | null) {
  if (Platform.OS === 'web') {
    if (value) globalThis.localStorage?.setItem(TOKEN_KEY, value);
    else globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function readUser(): Promise<AuthUser | null> {
  const stored = Platform.OS === 'web' ? globalThis.localStorage?.getItem(USER_KEY) : await SecureStore.getItemAsync(USER_KEY);
  if (!stored) return null;
  try {
    const user = JSON.parse(stored) as AuthUser;
    return typeof user.id === 'number' && typeof user.username === 'string' && ['admin', 'user'].includes(user.role) ? user : null;
  } catch {
    return null;
  }
}

async function saveUser(user: AuthUser | null) {
  const value = user ? JSON.stringify(user) : null;
  if (Platform.OS === 'web') {
    if (value) globalThis.localStorage?.setItem(USER_KEY, value);
    else globalThis.localStorage?.removeItem(USER_KEY);
    return;
  }
  if (value) await SecureStore.setItemAsync(USER_KEY, value);
  else await SecureStore.deleteItemAsync(USER_KEY);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([readToken(), readUser()]).then(([storedToken, storedUser]) => {
      setToken(storedToken);
      setUser(storedUser);
    }).catch(() => {
      setToken(null);
      setUser(null);
    }).finally(() => setReady(true));
  }, []);

  const login = async (identifier: string, password: string) => {
    const result = await api.login(identifier, password);
    await saveToken(result.token);
    await saveUser(result.user);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  };

  const logout = async () => {
    await Promise.all([saveToken(null), saveUser(null)]);
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ token, user, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}