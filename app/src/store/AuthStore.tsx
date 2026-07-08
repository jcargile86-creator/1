import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const ACCOUNTS_KEY = 'inspectpro/auth/accounts';
const SESSION_KEY = 'inspectpro/auth/session';

export interface Account {
  id: string;
  /** Login handle, stored lowercased. */
  username: string;
  /** Inspector name shown on reports and auto-filled into claims. */
  displayName: string;
  contact?: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
  isDev?: boolean;
}

/** Public view of an account — never exposes the password hash. */
export type CurrentUser = Omit<Account, 'salt' | 'passwordHash'>;

/** Seeded so the app is testable out of the box. */
const DEV_USERNAME = 'dev';
const DEV_PASSWORD = 'inspect';

interface AuthShape {
  loading: boolean;
  currentUser: CurrentUser | null;
  /** Sign in; resolves to an error string, or null on success. */
  signIn: (username: string, password: string) => Promise<string | null>;
  /** Create an account and sign in; resolves to an error string or null. */
  signUp: (username: string, password: string, displayName: string, contact?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthShape | null>(null);

async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

function publicView(a: Account): CurrentUser {
  const { salt, passwordHash, ...rest } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

async function loadAccounts(): Promise<Account[]> {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  return raw ? (JSON.parse(raw) as Account[]) : [];
}

async function saveAccounts(accounts: Account[]): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

/** Ensure the built-in dev/test account exists. */
async function ensureDevAccount(accounts: Account[]): Promise<Account[]> {
  if (accounts.some((a) => a.username === DEV_USERNAME)) return accounts;
  const salt = Crypto.randomUUID();
  const dev: Account = {
    id: 'dev-account',
    username: DEV_USERNAME,
    displayName: 'Dev Inspector',
    contact: 'dev@inspectpro.app',
    salt,
    passwordHash: await hashPassword(DEV_PASSWORD, salt),
    createdAt: new Date().toISOString(),
    isDev: true,
  };
  const next = [...accounts, dev];
  await saveAccounts(next);
  return next;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const accounts = await ensureDevAccount(await loadAccounts());
        const sessionId = await AsyncStorage.getItem(SESSION_KEY);
        const acct = sessionId ? accounts.find((a) => a.id === sessionId) : undefined;
        if (acct) setCurrentUser(publicView(acct));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (username: string, password: string): Promise<string | null> => {
    const handle = username.trim().toLowerCase();
    if (!handle || !password) return 'Enter a username and password.';
    const accounts = await ensureDevAccount(await loadAccounts());
    const acct = accounts.find((a) => a.username === handle);
    if (!acct) return 'No account with that username.';
    const hash = await hashPassword(password, acct.salt);
    if (hash !== acct.passwordHash) return 'Incorrect password.';
    await AsyncStorage.setItem(SESSION_KEY, acct.id);
    setCurrentUser(publicView(acct));
    return null;
  }, []);

  const signUp = useCallback(
    async (username: string, password: string, displayName: string, contact?: string): Promise<string | null> => {
      const handle = username.trim().toLowerCase();
      if (!handle) return 'Choose a username.';
      if (password.length < 4) return 'Password must be at least 4 characters.';
      if (!displayName.trim()) return 'Enter your name (shown on reports).';
      const accounts = await ensureDevAccount(await loadAccounts());
      if (accounts.some((a) => a.username === handle)) return 'That username is taken.';
      const salt = Crypto.randomUUID();
      const acct: Account = {
        id: Crypto.randomUUID(),
        username: handle,
        displayName: displayName.trim(),
        contact: contact?.trim() || undefined,
        salt,
        passwordHash: await hashPassword(password, salt),
        createdAt: new Date().toISOString(),
      };
      await saveAccounts([...accounts, acct]);
      await AsyncStorage.setItem(SESSION_KEY, acct.id);
      setCurrentUser(publicView(acct));
      return null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }, []);

  const value = useMemo(
    () => ({ loading, currentUser, signIn, signUp, signOut }),
    [loading, currentUser, signIn, signUp, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthShape {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const DEV_CREDENTIALS = { username: DEV_USERNAME, password: DEV_PASSWORD };
