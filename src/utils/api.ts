import type {
  AbsensiRecord,
  AnggotaRecord,
  AttendanceStatusInput,
  AuthSession,
  PengaturanData,
  RecapResponse,
} from '../types.ts';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : `Terjadi kesalahan server (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export interface AuthStatusResponse {
  setupRequired: boolean;
  authenticated: boolean;
  user: {
    username: string;
    namaLengkap: string;
    expiresAt: string;
  } | null;
}

export interface DashboardResponse {
  today: string;
  totalAnggotaAktif: number;
  totalSemuaAnggota: number;
  hadirHariIni: number;
  badalHariIni: number;
  izinHariIni: number;
  sakitHariIni: number;
  alpaHariIni: number;
  liburHariIni: number;
  belumDiabsen: number;
  activeDaysRecorded: number;
  recap: RecapResponse;
}

export const api = {
  authStatus: (token?: string | null) =>
    request<AuthStatusResponse>('/api/auth/status', {}, token),

  authSetup: (payload: { username: string; password: string; namaLengkap?: string }) =>
    request<{ session: AuthSession }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  authLogin: (payload: { username: string; password: string }) =>
    request<{ session: AuthSession }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  authLogout: (token: string) =>
    request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }, token),

  changePassword: (
    token: string,
    payload: { currentPassword: string; newPassword: string },
  ) =>
    request<{ success: boolean }>(
      '/api/auth/change-password',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  getDashboard: (token: string, date?: string) =>
    request<DashboardResponse>(
      `/api/dashboard${date ? `?date=${encodeURIComponent(date)}` : ''}`,
      {},
      token,
    ),

  getAnggota: (token: string) =>
    request<{ anggota: AnggotaRecord[] }>('/api/anggota', {}, token),

  createAnggota: (token: string, nama: string) =>
    request<{ anggota: AnggotaRecord }>(
      '/api/anggota',
      { method: 'POST', body: JSON.stringify({ nama }) },
      token,
    ),

  updateAnggota: (token: string, id: string, nama: string) =>
    request<{ anggota: AnggotaRecord }>(
      `/api/anggota/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify({ nama }) },
      token,
    ),

  toggleAnggotaStatus: (token: string, id: string, statusAktif: boolean) =>
    request<{ anggota: AnggotaRecord }>(
      `/api/anggota/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: JSON.stringify({ statusAktif }) },
      token,
    ),

  getAbsensiByDate: (token: string, tanggal: string) =>
    request<{
      tanggal: string;
      period: RecapResponse['period'];
      activeMembers: AnggotaRecord[];
      records: AbsensiRecord[];
    }>(`/api/absensi/by-date?tanggal=${encodeURIComponent(tanggal)}`, {}, token),

  saveAbsensiBatch: (
    token: string,
    tanggal: string,
    entries: AttendanceStatusInput[],
  ) =>
    request<{
      tanggal: string;
      saved: AbsensiRecord[];
      updatedCount: number;
      createdCount: number;
    }>(
      '/api/absensi/batch',
      { method: 'POST', body: JSON.stringify({ tanggal, entries }) },
      token,
    ),

  saveSingleAbsensi: (
    token: string,
    tanggal: string,
    entry: AttendanceStatusInput,
  ) =>
    request<{
      tanggal: string;
      saved: AbsensiRecord[];
    }>(
      '/api/absensi/single',
      { method: 'PUT', body: JSON.stringify({ tanggal, entry }) },
      token,
    ),

  getRecap: (token: string, periodKey: string) =>
    request<RecapResponse>(
      `/api/absensi/recap?periodKey=${encodeURIComponent(periodKey)}`,
      {},
      token,
    ),

  getHistory: (
    token: string,
    filters: { periodKey?: string; tanggal?: string; idAnggota?: string },
  ) => {
    const params = new URLSearchParams();
    if (filters.periodKey) params.set('periodKey', filters.periodKey);
    if (filters.tanggal) params.set('tanggal', filters.tanggal);
    if (filters.idAnggota) params.set('idAnggota', filters.idAnggota);
    return request<{ records: AbsensiRecord[]; anggota: AnggotaRecord[] }>(
      `/api/absensi/history?${params.toString()}`,
      {},
      token,
    );
  },

  getPengaturan: (token: string) =>
    request<{ pengaturan: PengaturanData }>('/api/pengaturan', {}, token),

  updatePengaturan: (token: string, payload: Partial<PengaturanData>) =>
    request<{ pengaturan: PengaturanData }>(
      '/api/pengaturan',
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    ),
};
