/**
 * Contas locais deste aparelho (sem servidor). A senha nunca é guardada em texto:
 * guardamos um hash PBKDF2 com sal. Serve para separar usuários e dar a tela de entrada/saída.
 */
export interface Account {
  email: string;
  name: string;
  salt: string;
  hash: string;
}

const ACCOUNTS = 'void_web_accounts';
const SESSION = 'void_web_session';

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password: string, salt: string): Promise<string> {
  if (crypto.subtle) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 150000 }, key, 256);
    return toHex(bits);
  }
  // endereços http fora de localhost não têm crypto.subtle: usa um hash simples só para não guardar a senha pura
  let h = 2166136261;
  for (const c of salt + password) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}

function readAccounts(): Account[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS) || '[]');
  } catch {
    return [];
  }
}

export const hasAccounts = () => readAccounts().length > 0;

export function getSession(): Account | null {
  try {
    const email = localStorage.getItem(SESSION) || sessionStorage.getItem(SESSION);
    return readAccounts().find((a) => a.email === email) ?? null;
  } catch {
    return null;
  }
}

function startSession(email: string, remember: boolean) {
  try {
    localStorage.removeItem(SESSION);
    sessionStorage.removeItem(SESSION);
    (remember ? localStorage : sessionStorage).setItem(SESSION, email);
  } catch {
    /* sem storage */
  }
}

export async function signUp(name: string, email: string, password: string): Promise<Account> {
  const mail = email.trim().toLowerCase();
  const accounts = readAccounts();
  if (accounts.some((a) => a.email === mail)) throw new Error('Este e-mail já tem conta. Toque em Entrar.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const account: Account = { email: mail, name: name.trim(), salt, hash: await hashPassword(password, salt) };
  localStorage.setItem(ACCOUNTS, JSON.stringify([...accounts, account]));
  startSession(mail, true);
  return account;
}

export async function signIn(email: string, password: string, remember: boolean): Promise<Account> {
  const mail = email.trim().toLowerCase();
  const account = readAccounts().find((a) => a.email === mail);
  if (!account || (await hashPassword(password, account.salt)) !== account.hash) {
    throw new Error('E-mail ou senha incorretos.');
  }
  startSession(mail, remember);
  return account;
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION);
    sessionStorage.removeItem(SESSION);
  } catch {
    /* sem storage */
  }
}

/** Redefine a senha de uma conta deste aparelho (as contas ficam só aqui, não há e-mail de recuperação). */
export async function resetPassword(email: string, password: string): Promise<Account> {
  const mail = email.trim().toLowerCase();
  const accounts = readAccounts();
  const i = accounts.findIndex((x) => x.email === mail);
  if (i < 0) throw new Error('Não achei conta com este e-mail neste aparelho.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const next: Account = { ...accounts[i], salt, hash: await hashPassword(password, salt) };
  accounts[i] = next;
  localStorage.setItem(ACCOUNTS, JSON.stringify(accounts));
  startSession(mail, true);
  return next;
}

/** 0 a 4: tamanho, mistura de maiúsculas/minúsculas, números e símbolos. */
export function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return pw ? Math.max(1, s) : 0;
}
