// Remembers accounts the user has previously logged in with, so the login page
// can suggest them. Only non-sensitive fields are stored (email + display name).
// Passwords are never stored here — browser password managers handle that via
// the autoComplete attributes on the form.

export interface SavedAccount {
  email: string;
  name: string;
  lastUsed: number;
}

const STORAGE_KEY = 'sanket_saved_accounts';
const MAX_ACCOUNTS = 5;

export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.email === 'string')
      .map((a) => ({
        email: String(a.email),
        name: typeof a.name === 'string' && a.name ? a.name : a.email,
        lastUsed: Number(a.lastUsed) || 0,
      }))
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_ACCOUNTS);
  } catch {
    return [];
  }
}

export function rememberAccount(email: string, name?: string): void {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const existing = getSavedAccounts().filter((a) => a.email !== normalized);
  const next: SavedAccount[] = [
    { email: normalized, name: name?.trim() || normalized, lastUsed: Date.now() },
    ...existing,
  ].slice(0, MAX_ACCOUNTS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — suggestions are a nicety, so fail silently.
  }
}

export function forgetAccount(email: string): SavedAccount[] {
  const normalized = email.trim().toLowerCase();
  const next = getSavedAccounts().filter((a) => a.email !== normalized);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function initials(nameOrEmail: string): string {
  const source = (nameOrEmail || '').trim();
  if (!source) return '?';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return source[0].toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
