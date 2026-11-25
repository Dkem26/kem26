import type { AbsensiRecord, AttendanceStatusInput, PeriodInfo } from '../types.ts';

const BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const BULAN_SINGKAT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getTodayJakartaDate(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

export function isValidDateStr(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function getPeriodKeyFromDate(dateStr: string): string {
  const safeDate = isValidDateStr(dateStr) ? dateStr : getTodayJakartaDate();
  const [y, m, d] = safeDate.split('-').map(Number);
  if (d >= 26) {
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    return `${nextYear}-${pad2(nextMonth)}`;
  }
  return `${y}-${pad2(m)}`;
}

export function shiftPeriodKey(periodKey: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) {
    return getPeriodKeyFromDate(getTodayJakartaDate());
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const dt = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}

export function buildPeriodInfo(periodKey: string): PeriodInfo {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  const fallback = getPeriodKeyFromDate(getTodayJakartaDate());
  const [, yStr, mStr] = match || /^(\d{4})-(\d{2})$/.exec(fallback)!;
  const endYear = Number(yStr);
  const endMonth = Number(mStr); // 1..12

  const startMonth = endMonth === 1 ? 12 : endMonth - 1;
  const startYear = endMonth === 1 ? endYear - 1 : endYear;

  const startDate = `${startYear}-${pad2(startMonth)}-26`;
  const endDate = `${endYear}-${pad2(endMonth)}-25`;

  const label = `26 ${BULAN_ID[startMonth - 1]} ${startYear} – 25 ${BULAN_ID[endMonth - 1]} ${endYear}`;
  const shortLabel = `26 ${BULAN_SINGKAT[startMonth - 1]} – 25 ${BULAN_SINGKAT[endMonth - 1]} ${endYear}`;

  const dates: PeriodInfo['dates'] = [];
  let cursor = Date.UTC(startYear, startMonth - 1, 26);
  const endMs = Date.UTC(endYear, endMonth - 1, 25);

  while (cursor <= endMs) {
    const dt = new Date(cursor);
    const yr = dt.getUTCFullYear();
    const mo = dt.getUTCMonth() + 1;
    const dy = dt.getUTCDate();
    const dayOfWeek = dt.getUTCDay();
    dates.push({
      date: `${yr}-${pad2(mo)}-${pad2(dy)}`,
      day: dy,
      month: mo,
      year: yr,
      dayName: HARI_SINGKAT[dayOfWeek],
    });
    cursor += 86400000;
  }

  return {
    periodKey: `${endYear}-${pad2(endMonth)}`,
    startDate,
    endDate,
    label,
    shortLabel,
    dates,
  };
}

export function formatTanggalIndo(dateStr: string): string {
  if (!isValidDateStr(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${BULAN_ID[m - 1]} ${y}`;
}

export function formatDateTimeIndo(isoStr: string): string {
  if (!isoStr) return '-';
  const dt = new Date(isoStr);
  if (Number.isNaN(dt.getTime())) return isoStr;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export function getAttendanceCode(
  entry: Pick<
    AbsensiRecord | AttendanceStatusInput,
    'statusH' | 'statusB' | 'statusI' | 'statusS' | 'statusA' | 'statusL'
  > | null | undefined,
): string {
  if (!entry) return '-';
  if (entry.statusH && entry.statusB) return 'H+B';
  if (entry.statusH) return 'H';
  if (entry.statusB) return 'B';
  if (entry.statusI) return 'I';
  if (entry.statusS) return 'S';
  if (entry.statusA) return 'A';
  if (entry.statusL) return 'L';
  return '-';
}

export function getAttendancePoints(
  entry: Pick<
    AbsensiRecord | AttendanceStatusInput,
    'statusH' | 'statusB'
  > | null | undefined,
): number {
  if (!entry) return 0;
  return (entry.statusH ? 1 : 0) + (entry.statusB ? 1 : 0);
}

export function normalizeStatusFlags(input: AttendanceStatusInput): AttendanceStatusInput {
  const h = Boolean(input.statusH);
  const b = Boolean(input.statusB);
  const i = Boolean(input.statusI);
  const s = Boolean(input.statusS);
  const a = Boolean(input.statusA);
  const l = Boolean(input.statusL);

  if (h || b) {
    return {
      idAnggota: input.idAnggota,
      statusH: h,
      statusB: b,
      statusI: false,
      statusS: false,
      statusA: false,
      statusL: false,
    };
  }

  // Only one of I, S, A, L can be active
  if (i) return { idAnggota: input.idAnggota, statusH: false, statusB: false, statusI: true, statusS: false, statusA: false, statusL: false };
  if (s) return { idAnggota: input.idAnggota, statusH: false, statusB: false, statusI: false, statusS: true, statusA: false, statusL: false };
  if (a) return { idAnggota: input.idAnggota, statusH: false, statusB: false, statusI: false, statusS: false, statusA: true, statusL: false };
  if (l) return { idAnggota: input.idAnggota, statusH: false, statusB: false, statusI: false, statusS: false, statusA: false, statusL: true };

  return {
    idAnggota: input.idAnggota,
    statusH: false,
    statusB: false,
    statusI: false,
    statusS: false,
    statusA: false,
    statusL: false,
  };
}
