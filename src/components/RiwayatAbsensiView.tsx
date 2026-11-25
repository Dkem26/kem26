import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit3,
  History,
  Loader2,
  User,
} from 'lucide-react';
import type { AbsensiRecord, AnggotaRecord, AttendanceStatusInput } from '../types.ts';
import { api } from '../utils/api.ts';
import {
  buildPeriodInfo,
  formatDateTimeIndo,
  formatTanggalIndo,
  getAttendanceCode,
  getAttendancePoints,
  getPeriodKeyFromDate,
  getTodayJakartaDate,
  shiftPeriodKey,
} from '../utils/period.ts';
import { getCodeCellClasses } from '../utils/codeStyles.ts';
import { EditSingleAbsensiModal } from './EditSingleAbsensiModal.tsx';

interface RiwayatAbsensiViewProps {
  token: string;
  onDataUpdated: () => void;
}

export function RiwayatAbsensiView({ token, onDataUpdated }: RiwayatAbsensiViewProps) {
  const [periodKey, setPeriodKey] = useState(() => getPeriodKeyFromDate(getTodayJakartaDate()));
  const [usePeriodFilter, setUsePeriodFilter] = useState(true);
  const [tanggalFilter, setTanggalFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');

  const [records, setRecords] = useState<AbsensiRecord[]>([]);
  const [anggota, setAnggota] = useState<AnggotaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editRec, setEditRec] = useState<AbsensiRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getHistory(token, {
        periodKey: usePeriodFilter && !tanggalFilter ? periodKey : undefined,
        tanggal: tanggalFilter || undefined,
        idAnggota: memberFilter || undefined,
      });
      setRecords(res.records);
      setAnggota(res.anggota);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat absensi.');
    } finally {
      setLoading(false);
    }
  }, [token, usePeriodFilter, periodKey, tanggalFilter, memberFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleSaveEdit(tanggal: string, entry: AttendanceStatusInput) {
    setSavingEdit(true);
    try {
      await api.saveSingleAbsensi(token, tanggal, entry);
      setEditRec(null);
      await loadHistory();
      onDataUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui catatan absensi.');
    } finally {
      setSavingEdit(false);
    }
  }

  const periodInfo = buildPeriodInfo(periodKey);

  // Summary of currently filtered records
  const totalH = records.filter((r) => r.statusH).length;
  const totalB = records.filter((r) => r.statusB).length;
  const totalI = records.filter((r) => r.statusI).length;
  const totalS = records.filter((r) => r.statusS).length;
  const totalA = records.filter((r) => r.statusA).length;
  const totalL = records.filter((r) => r.statusL).length;
  const totalPoin = totalH + totalB;

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Audit Log & Koreksi Data Absensi Tersimpan
              </p>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[#0B2B52]">
                Riwayat Absensi Anggota
              </h2>
            </div>

            {/* Period Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTanggalFilter('');
                  setUsePeriodFilter(true);
                  setPeriodKey((k) => shiftPeriodKey(k, -1));
                }}
                className="min-h-10 inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Periode Sebelumnya</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTanggalFilter('');
                  setUsePeriodFilter((prev) => !prev);
                }}
                className={`min-h-10 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  usePeriodFilter && !tanggalFilter
                    ? 'bg-[#0B2B52] border-[#0B2B52] text-white'
                    : 'bg-white/85 border-slate-300 text-slate-700'
                }`}
              >
                {usePeriodFilter && !tanggalFilter ? periodInfo.shortLabel : 'Semua Periode'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTanggalFilter('');
                  setUsePeriodFilter(true);
                  setPeriodKey((k) => shiftPeriodKey(k, 1));
                }}
                className="min-h-10 inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
              >
                <span>Periode Berikutnya</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t border-slate-200/80">
            {/* Specific Date Filter */}
            <div>
              <label htmlFor="filter-date" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Filter Tanggal Spesifik
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 min-h-10">
                  <Calendar className="h-4 w-4 text-[#1565C0] shrink-0" />
                  <input
                    id="filter-date"
                    type="date"
                    value={tanggalFilter}
                    onChange={(e) => setTanggalFilter(e.target.value)}
                    className="w-full bg-transparent text-sm font-mono-tabular text-slate-900 focus:outline-none"
                  />
                </div>
                {tanggalFilter && (
                  <button
                    type="button"
                    onClick={() => setTanggalFilter('')}
                    className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Member Filter */}
            <div>
              <label htmlFor="filter-member" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Riwayat Per Anggota
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 min-h-10">
                <User className="h-4 w-4 text-[#1565C0] shrink-0" />
                <select
                  id="filter-member"
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-900 focus:outline-none"
                >
                  <option value="">Semua Anggota (Aktif & Nonaktif)</option>
                  {anggota.map((m) => (
                    <option key={m.idAnggota} value={m.idAnggota}>
                      {m.nama} {!m.statusAktif ? '(Nonaktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Stats Summary */}
            <div className="rounded-xl border border-slate-200 bg-white/75 px-4 py-2.5 flex flex-col justify-center">
              <p className="text-xs font-semibold text-slate-600">
                Ringkasan Hasil ({records.length} catatan)
              </p>
              <p className="mt-0.5 font-mono-tabular text-xs sm:text-sm font-bold text-[#0B2B52]">
                H:{totalH} · B:{totalB} · I:{totalI} · S:{totalS} · A:{totalA} · L:{totalL} · Poin:{totalPoin}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/95 px-5 py-3.5 text-sm font-medium text-rose-900">
          {error}
        </div>
      )}

      {/* History Table */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-[#1565C0]" />
            <span>Memuat riwayat absensi...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <History className="h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Belum ada data riwayat absensi untuk filter yang dipilih
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Coba ubah periode atau tanggal filter untuk melihat catatan lainnya.
            </p>
          </div>
        ) : (
          <div className="ocean-scroll overflow-x-auto rounded-xl border border-slate-200/90 bg-white/95">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-100/95 text-xs font-semibold text-slate-700 border-b border-slate-200">
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Nama Anggota</th>
                  <th className="px-4 py-3 text-center">Kode</th>
                  <th className="px-4 py-3 text-center">Poin</th>
                  <th className="px-4 py-3 hidden md:table-cell">ID Absensi</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Waktu Input</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Perubahan Terakhir</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {records.map((rec) => {
                  const code = getAttendanceCode(rec);
                  const points = getAttendancePoints(rec);
                  return (
                    <tr key={rec.idAbsensi} className="hover:bg-sky-50/40 transition-colors">
                      <td className="px-4 py-3 font-mono-tabular text-xs sm:text-sm font-medium text-slate-800 whitespace-nowrap">
                        {formatTanggalIndo(rec.tanggal)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {rec.namaAnggota}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex min-w-12 justify-center rounded-lg px-2 py-1 text-xs font-mono-tabular ${getCodeCellClasses(code)}`}>
                          {code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono-tabular font-bold text-[#0B2B52]">
                        {points}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-slate-500 hidden md:table-cell">
                        {rec.idAbsensi}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-slate-500 hidden lg:table-cell">
                        {formatDateTimeIndo(rec.waktuInput)}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-slate-500 hidden lg:table-cell">
                        {formatDateTimeIndo(rec.waktuPerubahan)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditRec(rec)}
                          className="min-h-9 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B2B52] hover:bg-slate-100 transition-colors whitespace-nowrap"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editRec && (
        <EditSingleAbsensiModal
          open={Boolean(editRec)}
          tanggal={editRec.tanggal}
          idAnggota={editRec.idAnggota}
          namaAnggota={editRec.namaAnggota}
          initialStatus={{
            idAnggota: editRec.idAnggota,
            statusH: editRec.statusH,
            statusB: editRec.statusB,
            statusI: editRec.statusI,
            statusS: editRec.statusS,
            statusA: editRec.statusA,
            statusL: editRec.statusL,
          }}
          saving={savingEdit}
          onSave={handleSaveEdit}
          onClose={() => setEditRec(null)}
        />
      )}
    </div>
  );
}
