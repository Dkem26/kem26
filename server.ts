import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  changeAdminPassword,
  getSessionFromHeader,
  isSetupRequired,
  loginAdmin,
  requireAuth,
  revokeSession,
  setupInitialAdmin,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  generateUniqueId,
  loadDb,
  saveDb,
  upsertAttendanceEntries,
} from './server/db.ts';
import {
  buildPeriodInfo,
  getAttendanceCode,
  getAttendancePoints,
  getPeriodKeyFromDate,
  getTodayJakartaDate,
  isValidDateStr,
} from './src/utils/period.ts';
import type { AttendanceStatusInput, MemberRecapRow, RecapResponse } from './src/types.ts';

dotenv.config();

const PORT = 3000;

function computeRecap(periodKey: string): RecapResponse {
  const db = loadDb();
  const period = buildPeriodInfo(periodKey);
  const dateSet = new Set(period.dates.map((d) => d.date));

  const periodRecords = db.absensi.filter((r) => dateSet.has(r.tanggal));
  const recordByMemberDate = new Map<string, typeof periodRecords[number]>();
  for (const rec of periodRecords) {
    recordByMemberDate.set(`${rec.idAnggota}__${rec.tanggal}`, rec);
  }

  // Include all active members + any inactive members who have records in this period
  const memberIdsWithRecords = new Set(periodRecords.map((r) => r.idAnggota));
  const relevantMembers = db.anggota.filter(
    (m) => m.statusAktif || memberIdsWithRecords.has(m.idAnggota),
  );

  const summary = {
    totalH: 0,
    totalB: 0,
    totalI: 0,
    totalS: 0,
    totalA: 0,
    totalL: 0,
    totalKehadiran: 0,
  };

  const rows: MemberRecapRow[] = relevantMembers.map((member) => {
    const daily: MemberRecapRow['daily'] = {};
    let totalH = 0;
    let totalB = 0;
    let totalI = 0;
    let totalS = 0;
    let totalA = 0;
    let totalL = 0;

    for (const d of period.dates) {
      const rec = recordByMemberDate.get(`${member.idAnggota}__${d.date}`) || null;
      const code = getAttendanceCode(rec);
      const points = getAttendancePoints(rec);
      daily[d.date] = { code, points, record: rec };

      if (rec) {
        if (rec.statusH) totalH += 1;
        if (rec.statusB) totalB += 1;
        if (rec.statusI) totalI += 1;
        if (rec.statusS) totalS += 1;
        if (rec.statusA) totalA += 1;
        if (rec.statusL) totalL += 1;
      }
    }

    const totalKehadiran = totalH + totalB;
    summary.totalH += totalH;
    summary.totalB += totalB;
    summary.totalI += totalI;
    summary.totalS += totalS;
    summary.totalA += totalA;
    summary.totalL += totalL;
    summary.totalKehadiran += totalKehadiran;

    return {
      idAnggota: member.idAnggota,
      nama: member.nama,
      statusAktif: member.statusAktif,
      daily,
      totalH,
      totalB,
      totalI,
      totalS,
      totalA,
      totalL,
      totalKehadiran,
    };
  });

  return { period, rows, summary };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Initialize DB on startup so the 5 initial members exist immediately
  loadDb();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth routes
  app.get('/api/auth/status', (req, res) => {
    const session = getSessionFromHeader(req.headers.authorization);
    res.json({
      setupRequired: isSetupRequired(),
      authenticated: Boolean(session),
      user: session
        ? {
            username: session.username,
            namaLengkap: session.namaLengkap,
            expiresAt: new Date(session.expiresAt).toISOString(),
          }
        : null,
    });
  });

  app.post('/api/auth/setup', (req, res) => {
    try {
      const { username, password, namaLengkap } = req.body || {};
      if (typeof username !== 'string' || typeof password !== 'string') {
        res.status(400).json({ error: 'Username dan password harus diisi.' });
        return;
      }
      const session = setupInitialAdmin(
        username,
        password,
        typeof namaLengkap === 'string' ? namaLengkap : undefined,
      );
      res.status(201).json({ session });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal membuat akun admin.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (typeof username !== 'string' || typeof password !== 'string') {
        res.status(400).json({ error: 'Username dan password wajib diisi.' });
        return;
      }
      const session = loginAdmin(username, password);
      res.json({ session });
    } catch (err) {
      res.status(401).json({ error: err instanceof Error ? err.message : 'Login gagal.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    revokeSession(req.headers.authorization);
    res.json({ success: true });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
        res.status(400).json({ error: 'Password saat ini dan password baru wajib diisi.' });
        return;
      }
      changeAdminPassword(req.sessionUser!.idUser, currentPassword, newPassword);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal mengganti password.' });
    }
  });

  // Dashboard endpoint
  app.get('/api/dashboard', requireAuth, (req, res) => {
    const db = loadDb();
    const today =
      typeof req.query.date === 'string' && isValidDateStr(req.query.date)
        ? req.query.date
        : getTodayJakartaDate();

    const activeMembers = db.anggota.filter((a) => a.statusAktif);
    const activeIds = new Set(activeMembers.map((a) => a.idAnggota));
    const todayRecords = db.absensi.filter((r) => r.tanggal === today);

    let hadirHariIni = 0;
    let badalHariIni = 0;
    let izinHariIni = 0;
    let sakitHariIni = 0;
    let alpaHariIni = 0;
    let liburHariIni = 0;
    const recordedTodayIds = new Set<string>();

    for (const rec of todayRecords) {
      recordedTodayIds.add(rec.idAnggota);
      if (rec.statusH) hadirHariIni += 1;
      if (rec.statusB) badalHariIni += 1;
      if (rec.statusI) izinHariIni += 1;
      if (rec.statusS) sakitHariIni += 1;
      if (rec.statusA) alpaHariIni += 1;
      if (rec.statusL) liburHariIni += 1;
    }

    const belumDiabsen = activeMembers.filter((m) => !recordedTodayIds.has(m.idAnggota)).length;
    const periodKey = getPeriodKeyFromDate(today);
    const recap = computeRecap(periodKey);

    const activeDaysRecorded = new Set(
      db.absensi
        .filter((r) => r.tanggal >= recap.period.startDate && r.tanggal <= recap.period.endDate)
        .map((r) => r.tanggal),
    ).size;

    res.json({
      today,
      totalAnggotaAktif: activeIds.size,
      totalSemuaAnggota: db.anggota.length,
      hadirHariIni,
      badalHariIni,
      izinHariIni,
      sakitHariIni,
      alpaHariIni,
      liburHariIni,
      belumDiabsen,
      activeDaysRecorded,
      recap,
    });
  });

  // Anggota routes
  app.get('/api/anggota', requireAuth, (_req, res) => {
    const db = loadDb();
    res.json({ anggota: db.anggota });
  });

  app.post('/api/anggota', requireAuth, (req, res) => {
    const nama = typeof req.body?.nama === 'string' ? req.body.nama.trim() : '';
    if (nama.length < 2 || nama.length > 80) {
      res.status(400).json({ error: 'Nama anggota harus 2–80 karakter.' });
      return;
    }

    const db = loadDb();
    const duplicate = db.anggota.find(
      (a) => a.nama.toLowerCase() === nama.toLowerCase(),
    );
    if (duplicate) {
      res.status(409).json({ error: `Anggota dengan nama "${nama}" sudah terdaftar.` });
      return;
    }

    const now = new Date().toISOString();
    const created = {
      idAnggota: generateUniqueId('ANG'),
      nama,
      statusAktif: true,
      createdAt: now,
      updatedAt: now,
    };
    db.anggota.push(created);
    saveDb(db);
    res.status(201).json({ anggota: created });
  });

  app.put('/api/anggota/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    const nama = typeof req.body?.nama === 'string' ? req.body.nama.trim() : '';
    if (nama.length < 2 || nama.length > 80) {
      res.status(400).json({ error: 'Nama anggota harus 2–80 karakter.' });
      return;
    }

    const db = loadDb();
    const idx = db.anggota.findIndex((a) => a.idAnggota === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Anggota tidak ditemukan.' });
      return;
    }

    const duplicate = db.anggota.find(
      (a) => a.idAnggota !== id && a.nama.toLowerCase() === nama.toLowerCase(),
    );
    if (duplicate) {
      res.status(409).json({ error: `Nama "${nama}" sudah digunakan anggota lain.` });
      return;
    }

    const now = new Date().toISOString();
    db.anggota[idx] = {
      ...db.anggota[idx],
      nama,
      updatedAt: now,
    };

    // Keep denormalized namaAnggota consistent in historical ABSENSI rows
    db.absensi = db.absensi.map((r) =>
      r.idAnggota === id ? { ...r, namaAnggota: nama } : r,
    );

    saveDb(db);
    res.json({ anggota: db.anggota[idx] });
  });

  app.patch('/api/anggota/:id/status', requireAuth, (req, res) => {
    const id = req.params.id;
    if (typeof req.body?.statusAktif !== 'boolean') {
      res.status(400).json({ error: 'Status aktif harus berupa boolean.' });
      return;
    }

    const db = loadDb();
    const idx = db.anggota.findIndex((a) => a.idAnggota === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Anggota tidak ditemukan.' });
      return;
    }

    db.anggota[idx] = {
      ...db.anggota[idx],
      statusAktif: req.body.statusAktif,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    res.json({ anggota: db.anggota[idx] });
  });

  // Absensi routes
  app.get('/api/absensi/by-date', requireAuth, (req, res) => {
    const tanggal = typeof req.query.tanggal === 'string' ? req.query.tanggal : getTodayJakartaDate();
    if (!isValidDateStr(tanggal)) {
      res.status(400).json({ error: 'Format tanggal tidak valid (gunakan YYYY-MM-DD).' });
      return;
    }

    const db = loadDb();
    const period = buildPeriodInfo(getPeriodKeyFromDate(tanggal));
    const records = db.absensi.filter((r) => r.tanggal === tanggal);
    const activeMembers = db.anggota.filter((a) => a.statusAktif);

    res.json({
      tanggal,
      period,
      activeMembers,
      records,
    });
  });

  app.post('/api/absensi/batch', requireAuth, (req, res) => {
    const tanggal = typeof req.body?.tanggal === 'string' ? req.body.tanggal : '';
    const entries = Array.isArray(req.body?.entries) ? (req.body.entries as AttendanceStatusInput[]) : null;

    if (!isValidDateStr(tanggal)) {
      res.status(400).json({ error: 'Tanggal tidak valid.' });
      return;
    }
    if (!entries || entries.length === 0) {
      res.status(400).json({ error: 'Data absensi tidak boleh kosong.' });
      return;
    }

    const result = upsertAttendanceEntries(tanggal, entries);
    res.json({
      tanggal,
      ...result,
    });
  });

  app.put('/api/absensi/single', requireAuth, (req, res) => {
    const tanggal = typeof req.body?.tanggal === 'string' ? req.body.tanggal : '';
    const entry = req.body?.entry as AttendanceStatusInput | undefined;
    if (!isValidDateStr(tanggal) || !entry || typeof entry.idAnggota !== 'string') {
      res.status(400).json({ error: 'Data perubahan absensi tidak valid.' });
      return;
    }

    const result = upsertAttendanceEntries(tanggal, [entry]);
    res.json({ tanggal, ...result });
  });

  app.get('/api/absensi/recap', requireAuth, (req, res) => {
    const periodKey =
      typeof req.query.periodKey === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodKey)
        ? req.query.periodKey
        : getPeriodKeyFromDate(getTodayJakartaDate());
    res.json(computeRecap(periodKey));
  });

  app.get('/api/absensi/history', requireAuth, (req, res) => {
    const db = loadDb();
    const periodKey =
      typeof req.query.periodKey === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodKey)
        ? req.query.periodKey
        : '';
    const tanggal =
      typeof req.query.tanggal === 'string' && isValidDateStr(req.query.tanggal)
        ? req.query.tanggal
        : '';
    const idAnggota =
      typeof req.query.idAnggota === 'string' ? req.query.idAnggota.trim() : '';

    let records = [...db.absensi];

    if (periodKey) {
      const period = buildPeriodInfo(periodKey);
      records = records.filter(
        (r) => r.tanggal >= period.startDate && r.tanggal <= period.endDate,
      );
    }

    if (tanggal) {
      records = records.filter((r) => r.tanggal === tanggal);
    }

    if (idAnggota) {
      records = records.filter((r) => r.idAnggota === idAnggota);
    }

    records.sort((a, b) => {
      if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
      return a.namaAnggota.localeCompare(b.namaAnggota);
    });

    res.json({
      records,
      anggota: db.anggota,
    });
  });

  // Pengaturan routes
  app.get('/api/pengaturan', requireAuth, (_req, res) => {
    const db = loadDb();
    res.json({ pengaturan: db.pengaturan });
  });

  app.put('/api/pengaturan', requireAuth, (req, res) => {
    const db = loadDb();
    const body = req.body || {};
    const clean = (val: unknown, fallback: string) =>
      typeof val === 'string' && val.trim().length > 0 ? val.trim().slice(0, 120) : fallback;

    db.pengaturan = {
      namaInstansi: clean(body.namaInstansi, db.pengaturan.namaInstansi),
      namaUnit: clean(body.namaUnit, db.pengaturan.namaUnit),
      namaPetugas: clean(body.namaPetugas, db.pengaturan.namaPetugas),
      jabatanPetugas: clean(body.jabatanPetugas, db.pengaturan.jabatanPetugas),
      namaPimpinan: clean(body.namaPimpinan, db.pengaturan.namaPimpinan),
      jabatanPimpinan: clean(body.jabatanPimpinan, db.pengaturan.jabatanPimpinan),
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    res.json({ pengaturan: db.pengaturan });
  });

  // Serve frontend
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Absensi Security Al-Muhajirin berjalan di http://0.0.0.0:${PORT}`);
  });
}

startServer();
