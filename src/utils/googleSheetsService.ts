import type { AbsensiRecord, AnggotaRecord, PengaturanData, RecapResponse } from '../types.ts';
import { formatTanggalIndo, getTodayJakartaDate } from './period.ts';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabMeta {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabMeta[];
}

export class GoogleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function googleFetch<T>(url: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401) {
    throw new GoogleApiError(
      'Sesi Google Anda telah berakhir. Silakan klik "Sign in with Google" kembali.',
      401,
    );
  }

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    const errObj = json.error as { message?: string } | undefined;
    throw new GoogleApiError(
      errObj?.message || `Permintaan Google API gagal (${res.status})`,
      res.status,
    );
  }

  return json as T;
}

export async function listUserSpreadsheets(accessToken: string): Promise<DriveSpreadsheetFile[]> {
  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=30`;

  const data = await googleFetch<{ files?: DriveSpreadsheetFile[] }>(url, accessToken);
  return data.files || [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string,
): Promise<SpreadsheetMetadata> {
  const fields = encodeURIComponent('spreadsheetId,spreadsheetUrl,properties.title,sheets.properties');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=${fields}`;
  const data = await googleFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: {
      properties?: {
        sheetId: number;
        title: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }[];
  }>(url, accessToken);

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
    title: data.properties?.title || 'Spreadsheet Tanpa Judul',
    sheets: (data.sheets || [])
      .filter((s) => s.properties)
      .map((s) => ({
        sheetId: s.properties!.sheetId,
        title: s.properties!.title,
        rowCount: s.properties!.gridProperties?.rowCount,
        columnCount: s.properties!.gridProperties?.columnCount,
      })),
  };
}

export async function readSheetRange(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  range = 'A1:Z50',
): Promise<string[][]> {
  const fullRange = `'${sheetTitle.replace(/'/g, "''")}'!${range}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(fullRange)}`;
  const data = await googleFetch<{ values?: string[][] }>(url, accessToken);
  return data.values || [];
}

export async function createDatabaseSpreadsheet(
  accessToken: string,
  title = 'Database Absensi Security Al-Muhajirin',
): Promise<SpreadsheetMetadata> {
  const payload = {
    properties: {
      title,
      locale: 'id_ID',
      timeZone: 'Asia/Jakarta',
    },
    sheets: [
      { properties: { title: 'ANGGOTA', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'ABSENSI', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'PENGATURAN', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'USERS', gridProperties: { frozenRowCount: 1 } } },
    ],
  };

  const created = await googleFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: { properties?: { sheetId: number; title: string } }[];
  }>('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // Format header rows on the 4 sheets
  const formatRequests = (created.sheets || [])
    .filter((s) => s.properties)
    .map((s) => ({
      repeatCell: {
        range: {
          sheetId: s.properties!.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.043, green: 0.169, blue: 0.322 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    }));

  if (formatRequests.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(created.spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ requests: formatRequests }),
      },
    );
  }

  return getSpreadsheetMetadata(accessToken, created.spreadsheetId);
}

async function ensureSheetTabsExist(
  accessToken: string,
  spreadsheetId: string,
  requiredTitles: string[],
): Promise<SpreadsheetMetadata> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));
  const missing = requiredTitles.filter((t) => !existingTitles.has(t));

  if (missing.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missing.map((title) => ({
            addSheet: {
              properties: {
                title,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          })),
        }),
      },
    );
    return getSpreadsheetMetadata(accessToken, spreadsheetId);
  }

  return meta;
}

async function clearAndWriteSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  values: (string | number | boolean)[][],
): Promise<void> {
  const safeTitle = `'${sheetTitle.replace(/'/g, "''")}'`;
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(safeTitle)}:clear`,
    accessToken,
    { method: 'POST', body: JSON.stringify({}) },
  );

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${safeTitle}!A1`)}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    },
  );
}

export async function syncDatabaseToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  snapshot: {
    anggota: AnggotaRecord[];
    absensi: AbsensiRecord[];
    pengaturan: PengaturanData;
    users: { idUser: string; username: string; role: string; namaLengkap: string; updatedAt: string }[];
  },
): Promise<SpreadsheetMetadata> {
  const meta = await ensureSheetTabsExist(accessToken, spreadsheetId, [
    'ANGGOTA',
    'ABSENSI',
    'PENGATURAN',
    'USERS',
  ]);

  const anggotaRows: (string | boolean)[][] = [
    ['id_anggota', 'nama', 'status_aktif', 'created_at', 'updated_at'],
    ...snapshot.anggota.map((m) => [
      m.idAnggota,
      m.nama,
      m.statusAktif,
      m.createdAt,
      m.updatedAt,
    ]),
  ];

  const absensiRows: (string | boolean)[][] = [
    [
      'id_absensi',
      'tanggal',
      'id_anggota',
      'nama_anggota',
      'status_h',
      'status_b',
      'status_i',
      'status_s',
      'status_a',
      'status_l',
      'waktu_input',
      'waktu_perubahan',
    ],
    ...snapshot.absensi.map((r) => [
      r.idAbsensi,
      r.tanggal,
      r.idAnggota,
      r.namaAnggota,
      r.statusH,
      r.statusB,
      r.statusI,
      r.statusS,
      r.statusA,
      r.statusL,
      r.waktuInput,
      r.waktuPerubahan,
    ]),
  ];

  const pengaturanRows: string[][] = [
    ['kunci', 'nilai', 'updated_at'],
    ['namaInstansi', snapshot.pengaturan.namaInstansi, snapshot.pengaturan.updatedAt],
    ['namaUnit', snapshot.pengaturan.namaUnit, snapshot.pengaturan.updatedAt],
    ['namaPetugas', snapshot.pengaturan.namaPetugas, snapshot.pengaturan.updatedAt],
    ['jabatanPetugas', snapshot.pengaturan.jabatanPetugas, snapshot.pengaturan.updatedAt],
    ['namaPimpinan', snapshot.pengaturan.namaPimpinan, snapshot.pengaturan.updatedAt],
    ['jabatanPimpinan', snapshot.pengaturan.jabatanPimpinan, snapshot.pengaturan.updatedAt],
  ];

  const usersRows: string[][] = [
    ['id_user', 'username', 'role', 'nama_lengkap', 'updated_at'],
    ...snapshot.users.map((u) => [u.idUser, u.username, u.role, u.namaLengkap, u.updatedAt]),
  ];

  await clearAndWriteSheet(accessToken, spreadsheetId, 'ANGGOTA', anggotaRows);
  await clearAndWriteSheet(accessToken, spreadsheetId, 'ABSENSI', absensiRows);
  await clearAndWriteSheet(accessToken, spreadsheetId, 'PENGATURAN', pengaturanRows);
  await clearAndWriteSheet(accessToken, spreadsheetId, 'USERS', usersRows);

  return meta;
}

export async function exportRecapToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  recap: RecapResponse,
  pengaturan: PengaturanData,
): Promise<{ sheetTitle: string; spreadsheetUrl: string }> {
  const sheetTitle = `Rekap_${recap.period.periodKey}`;
  const meta = await ensureSheetTabsExist(accessToken, spreadsheetId, [sheetTitle]);

  const printDate = formatTanggalIndo(getTodayJakartaDate());
  const headerRow: (string | number)[] = [
    'No',
    'Nama Anggota',
    ...recap.period.dates.map((d) => d.day),
    'H',
    'B',
    'I',
    'S',
    'A',
    'L',
    'Total',
  ];

  const values: (string | number)[][] = [
    ['REKAP ABSENSI SECURITY AL-MUHAJIRIN'],
    [`${pengaturan.namaInstansi} — ${pengaturan.namaUnit}`],
    [`Periode: ${recap.period.label} | Dicetak: ${printDate}`],
    [],
    headerRow,
    ...recap.rows.map((member, idx) => [
      idx + 1,
      member.statusAktif ? member.nama : `${member.nama} (Nonaktif)`,
      ...recap.period.dates.map((d) => member.daily[d.date]?.code || '-'),
      member.totalH,
      member.totalB,
      member.totalI,
      member.totalS,
      member.totalA,
      member.totalL,
      member.totalKehadiran,
    ]),
    [
      '',
      'TOTAL KESELURUHAN',
      ...recap.period.dates.map(() => ''),
      recap.summary.totalH,
      recap.summary.totalB,
      recap.summary.totalI,
      recap.summary.totalS,
      recap.summary.totalA,
      recap.summary.totalL,
      recap.summary.totalKehadiran,
    ],
    [],
    ['Mengetahui,', '', '', '', '', '', '', `Dibuat pada ${printDate}`],
    [pengaturan.jabatanPimpinan, '', '', '', '', '', '', pengaturan.jabatanPetugas],
    [],
    [`( ${pengaturan.namaPimpinan} )`, '', '', '', '', '', '', `( ${pengaturan.namaPetugas} )`],
  ];

  await clearAndWriteSheet(accessToken, spreadsheetId, sheetTitle, values);

  return {
    sheetTitle,
    spreadsheetUrl: meta.spreadsheetUrl,
  };
}

function parseBoolCell(val: string | undefined): boolean {
  const s = String(val || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'ya' || s === 'v';
}

export async function readImportDataFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
): Promise<{
  title: string;
  anggota: { idAnggota?: string; nama: string; statusAktif: boolean }[];
  absensi: {
    tanggal: string;
    idAnggota?: string;
    namaAnggota?: string;
    statusH: boolean;
    statusB: boolean;
    statusI: boolean;
    statusS: boolean;
    statusA: boolean;
    statusL: boolean;
  }[];
}> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const sheetMap = new Map(meta.sheets.map((s) => [s.title.toUpperCase(), s.title]));

  const anggota: { idAnggota?: string; nama: string; statusAktif: boolean }[] = [];
  const absensi: {
    tanggal: string;
    idAnggota?: string;
    namaAnggota?: string;
    statusH: boolean;
    statusB: boolean;
    statusI: boolean;
    statusS: boolean;
    statusA: boolean;
    statusL: boolean;
  }[] = [];

  const anggotaSheetName = sheetMap.get('ANGGOTA');
  if (anggotaSheetName) {
    const rows = await readSheetRange(accessToken, spreadsheetId, anggotaSheetName, 'A2:E500');
    for (const r of rows) {
      const nama = (r[1] || '').trim();
      if (nama.length >= 2) {
        anggota.push({
          idAnggota: (r[0] || '').trim() || undefined,
          nama,
          statusAktif: r[2] === undefined ? true : parseBoolCell(r[2]),
        });
      }
    }
  }

  const absensiSheetName = sheetMap.get('ABSENSI');
  if (absensiSheetName) {
    const rows = await readSheetRange(accessToken, spreadsheetId, absensiSheetName, 'A2:L2000');
    for (const r of rows) {
      const tanggal = (r[1] || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) continue;
      absensi.push({
        tanggal,
        idAnggota: (r[2] || '').trim() || undefined,
        namaAnggota: (r[3] || '').trim() || undefined,
        statusH: parseBoolCell(r[4]),
        statusB: parseBoolCell(r[5]),
        statusI: parseBoolCell(r[6]),
        statusS: parseBoolCell(r[7]),
        statusA: parseBoolCell(r[8]),
        statusL: parseBoolCell(r[9]),
      });
    }
  }

  return {
    title: meta.title,
    anggota,
    absensi,
  };
}
