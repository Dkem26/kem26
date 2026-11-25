import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AbsensiRecord,
  AnggotaRecord,
  AttendanceStatusInput,
  PengaturanData,
  UserRecord,
} from '../src/types.ts';
import { normalizeStatusFlags } from '../src/utils/period.ts';

export interface DatabaseSchema {
  users: UserRecord[];
  anggota: AnggotaRecord[];
  absensi: AbsensiRecord[];
  pengaturan: PengaturanData;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

const INITIAL_MEMBERS = ['Sutrio', 'Fathur', 'Fikri', 'Idris', 'Rizki'];

function createDefaultDatabase(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    users: [],
    anggota: INITIAL_MEMBERS.map((nama, idx) => ({
      idAnggota: `ANG-${String(idx + 1).padStart(3, '0')}`,
      nama,
      statusAktif: true,
      createdAt: now,
      updatedAt: now,
    })),
    absensi: [],
    pengaturan: {
      namaInstansi: 'Pondok Pesantren Al-Muhajirin',
      namaUnit: 'Divisi Keamanan / Security Al-Muhajirin',
      namaPetugas: 'Koordinator Security',
      jabatanPetugas: 'Petugas / Koordinator Security',
      namaPimpinan: 'Pimpinan Pondok Pesantren',
      jabatanPimpinan: 'Pimpinan Al-Muhajirin',
      updatedAt: now,
    },
  };
}

let cachedDb: DatabaseSchema | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadDb(): DatabaseSchema {
  if (cachedDb) {
    return cachedDb;
  }
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initial = createDefaultDatabase();
    saveDb(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    const fallback = createDefaultDatabase();
    cachedDb = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      anggota:
        Array.isArray(parsed.anggota) && parsed.anggota.length > 0
          ? parsed.anggota
          : fallback.anggota,
      absensi: Array.isArray(parsed.absensi) ? parsed.absensi : [],
      pengaturan: parsed.pengaturan
        ? { ...fallback.pengaturan, ...parsed.pengaturan }
        : fallback.pengaturan,
    };
    return cachedDb;
  } catch {
    const initial = createDefaultDatabase();
    saveDb(initial);
    return initial;
  }
}

export function saveDb(db: DatabaseSchema): void {
  ensureDataDir();
  const tmpFile = `${DB_FILE}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
  cachedDb = db;
}

export function generateUniqueId(prefix: string): string {
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export function upsertAttendanceEntries(
  tanggal: string,
  entries: AttendanceStatusInput[],
): { saved: AbsensiRecord[]; updatedCount: number; createdCount: number } {
  const db = loadDb();
  const now = new Date().toISOString();
  const memberMap = new Map(db.anggota.map((a) => [a.idAnggota, a]));

  let updatedCount = 0;
  let createdCount = 0;
  const saved: AbsensiRecord[] = [];

  for (const rawEntry of entries) {
    const member = memberMap.get(rawEntry.idAnggota);
    if (!member) {
      continue;
    }

    const normalized = normalizeStatusFlags(rawEntry);
    const hasAnyStatus =
      normalized.statusH ||
      normalized.statusB ||
      normalized.statusI ||
      normalized.statusS ||
      normalized.statusA ||
      normalized.statusL;

    const existingIndex = db.absensi.findIndex(
      (item) => item.tanggal === tanggal && item.idAnggota === member.idAnggota,
    );

    if (!hasAnyStatus) {
      if (existingIndex !== -1) {
        db.absensi.splice(existingIndex, 1);
      }
      continue;
    }

    if (existingIndex !== -1) {
      const existing = db.absensi[existingIndex];
      const updated: AbsensiRecord = {
        ...existing,
        namaAnggota: member.nama,
        statusH: normalized.statusH,
        statusB: normalized.statusB,
        statusI: normalized.statusI,
        statusS: normalized.statusS,
        statusA: normalized.statusA,
        statusL: normalized.statusL,
        waktuPerubahan: now,
      };
      db.absensi[existingIndex] = updated;
      saved.push(updated);
      updatedCount += 1;
    } else {
      const created: AbsensiRecord = {
        idAbsensi: generateUniqueId('ABS'),
        tanggal,
        idAnggota: member.idAnggota,
        namaAnggota: member.nama,
        statusH: normalized.statusH,
        statusB: normalized.statusB,
        statusI: normalized.statusI,
        statusS: normalized.statusS,
        statusA: normalized.statusA,
        statusL: normalized.statusL,
        waktuInput: now,
        waktuPerubahan: now,
      };
      db.absensi.push(created);
      saved.push(created);
      createdCount += 1;
    }
  }

  saveDb(db);
  return { saved, updatedCount, createdCount };
}
