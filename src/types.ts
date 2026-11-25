export interface UserRecord {
  idUser: string;
  username: string;
  passwordHash: string;
  role: 'ADMIN';
  namaLengkap: string;
  updatedAt: string;
}

export interface AnggotaRecord {
  idAnggota: string;
  nama: string;
  statusAktif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AbsensiRecord {
  idAbsensi: string;
  tanggal: string; // YYYY-MM-DD
  idAnggota: string;
  namaAnggota: string;
  statusH: boolean;
  statusB: boolean;
  statusI: boolean;
  statusS: boolean;
  statusA: boolean;
  statusL: boolean;
  waktuInput: string;
  waktuPerubahan: string;
}

export interface PengaturanData {
  namaInstansi: string;
  namaUnit: string;
  namaPetugas: string;
  jabatanPetugas: string;
  namaPimpinan: string;
  jabatanPimpinan: string;
  spreadsheetId?: string;
  updatedAt: string;
}

export interface AttendanceStatusInput {
  idAnggota: string;
  statusH: boolean;
  statusB: boolean;
  statusI: boolean;
  statusS: boolean;
  statusA: boolean;
  statusL: boolean;
}

export interface PeriodInfo {
  periodKey: string; // End YYYY-MM, e.g. "2026-11"
  startDate: string; // YYYY-MM-DD (26th)
  endDate: string;   // YYYY-MM-DD (25th)
  label: string;     // e.g. "26 Oktober 2026 – 25 November 2026"
  shortLabel: string;
  dates: {
    date: string;    // YYYY-MM-DD
    day: number;     // 26..31, 1..25
    month: number;   // 1..12
    year: number;
    dayName: string; // Sen, Sel, ...
  }[];
}

export interface MemberRecapRow {
  idAnggota: string;
  nama: string;
  statusAktif: boolean;
  daily: Record<string, {
    code: string;
    points: number;
    record: AbsensiRecord | null;
  }>;
  totalH: number;
  totalB: number;
  totalI: number;
  totalS: number;
  totalA: number;
  totalL: number;
  totalKehadiran: number; // totalH + totalB
}

export interface RecapResponse {
  period: PeriodInfo;
  rows: MemberRecapRow[];
  summary: {
    totalH: number;
    totalB: number;
    totalI: number;
    totalS: number;
    totalA: number;
    totalL: number;
    totalKehadiran: number;
  };
}

export interface AuthSession {
  token: string;
  username: string;
  namaLengkap: string;
  expiresAt: string;
}
