import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { generateUniqueId, loadDb, saveDb } from './db.ts';
import type { UserRecord } from '../src/types.ts';

interface SessionEntry {
  token: string;
  idUser: string;
  username: string;
  namaLengkap: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map<string, SessionEntry>();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function constantTimeStringMatch(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function getEnvPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

export function isSetupRequired(): boolean {
  if (getEnvPasscode().length > 0) {
    return false;
  }
  const db = loadDb();
  return db.users.length === 0;
}

export function createSession(user: Pick<UserRecord, 'idUser' | 'username' | 'namaLengkap'>): {
  token: string;
  username: string;
  namaLengkap: string;
  expiresAt: string;
} {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  sessions.set(token, {
    token,
    idUser: user.idUser,
    username: user.username,
    namaLengkap: user.namaLengkap,
    expiresAt: expiresAtMs,
  });
  return {
    token,
    username: user.username,
    namaLengkap: user.namaLengkap,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function getSessionFromHeader(authHeader?: string): SessionEntry | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const entry = sessions.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return entry;
}

export function revokeSession(authHeader?: string): void {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return;
  const token = authHeader.slice(7).trim();
  if (token) {
    sessions.delete(token);
  }
}

export function setupInitialAdmin(usernameRaw: string, password: string, namaLengkapRaw?: string) {
  if (!isSetupRequired()) {
    throw new Error('Akun admin sudah diaktifkan sebelumnya.');
  }
  const username = usernameRaw.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error('Username harus 3–32 karakter (huruf kecil, angka, titik, atau garis bawah).');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('Password minimal 6 karakter.');
  }

  const db = loadDb();
  const now = new Date().toISOString();
  const adminUser: UserRecord = {
    idUser: generateUniqueId('USR'),
    username,
    passwordHash: hashPassword(password),
    role: 'ADMIN',
    namaLengkap: (namaLengkapRaw || 'Admin Security Al-Muhajirin').trim(),
    updatedAt: now,
  };
  db.users.push(adminUser);
  saveDb(db);
  return createSession(adminUser);
}

export function loginAdmin(usernameRaw: string, password: string) {
  const username = (usernameRaw || '').trim().toLowerCase();
  if (!username || !password) {
    throw new Error('Username dan password wajib diisi.');
  }

  const envPasscode = getEnvPasscode();
  const db = loadDb();
  const matchedUser = db.users.find((u) => u.username.toLowerCase() === username);

  // If ADMIN_PASSCODE env var is set, allow matching against configured admin username (or 'admin' if DB empty)
  if (envPasscode.length > 0) {
    const expectedUsername = matchedUser ? matchedUser.username.toLowerCase() : 'admin';
    if (username === expectedUsername && constantTimeStringMatch(password, envPasscode)) {
      return createSession(
        matchedUser || {
          idUser: 'USR-ENV-ADMIN',
          username: 'admin',
          namaLengkap: 'Admin Security Al-Muhajirin',
        },
      );
    }
  }

  if (!matchedUser || !verifyPasswordHash(password, matchedUser.passwordHash)) {
    throw new Error('Username atau password tidak sesuai.');
  }

  return createSession(matchedUser);
}

export function changeAdminPassword(
  idUser: string,
  currentPassword: string,
  newPassword: string,
): void {
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }
  if (getEnvPasscode().length > 0 && idUser === 'USR-ENV-ADMIN') {
    throw new Error('Password dikelola melalui variabel lingkungan ADMIN_PASSCODE.');
  }

  const db = loadDb();
  const idx = db.users.findIndex((u) => u.idUser === idUser);
  if (idx === -1) {
    throw new Error('Akun admin tidak ditemukan.');
  }
  const user = db.users[idx];
  if (!verifyPasswordHash(currentPassword, user.passwordHash)) {
    throw new Error('Password saat ini tidak sesuai.');
  }

  db.users[idx] = {
    ...user,
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  };
  saveDb(db);
}

export interface AuthenticatedRequest extends Request {
  sessionUser?: SessionEntry;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const session = getSessionFromHeader(req.headers.authorization);
  if (!session) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
    return;
  }
  req.sessionUser = session;
  next();
}
