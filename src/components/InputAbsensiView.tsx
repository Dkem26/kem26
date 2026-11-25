import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCheck, CheckCircle2, Loader2, Save, Users } from 'lucide-react';
import type { AnggotaRecord, AttendanceStatusInput, PeriodInfo } from '../types.ts';
import { api } from '../utils/api.ts';
import {
  formatTanggalIndo,
  getAttendanceCode,
  getAttendancePoints,
  getTodayJakartaDate,
} from '../utils/period.ts';
import { getCodeCellClasses } from '../utils/codeStyles.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

interface InputAbsensiViewProps {
  token: string;
  initialDate?: string;
  onSavedSuccess: () => void;
}

const OTHER_CODES = [
  { key: 'statusI' as const, code: 'I', label: 'Izin', activeCls: 'bg-amber-500 text-white border-amber-600 shadow-sm' },
  { key: 'statusS' as const, code: 'S', label: 'Sakit', activeCls: 'bg-orange-500 text-white border-orange-600 shadow-sm' },
  { key: 'statusA' as const, code: 'A', label: 'Alpa', activeCls: 'bg-rose-600 text-white border-rose-700 shadow-sm' },
  { key: 'statusL' as const, code: 'L', label: 'Libur', activeCls: 'bg-slate-600 text-white border-slate-700 shadow-sm' },
];

export function InputAbsensiView({ token, initialDate, onSavedSuccess }: InputAbsensiViewProps) {
  const [tanggal, setTanggal] = useState(initialDate || getTodayJakartaDate());
  const [period, setPeriod] = useState<PeriodInfo | null>(null);
  const [members, setMembers] = useState<AnggotaRecord[]>([]);
  const [entries, setEntries] = useState<Record<string, AttendanceStatusInput>>({});
  const [isExistingDate, setIsExistingDate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialDate) {
      setTanggal(initialDate);
    }
  }, [initialDate]);

  const loadDateData = useCallback(async (targetDate: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.getAbsensiByDate(token, targetDate);
      setPeriod(res.period);
      setMembers(res.activeMembers);
      setIsExistingDate(res.records.length > 0);

      const recMap = new Map(res.records.map((r) => [r.idAnggota, r]));
      const nextEntries: Record<string, AttendanceStatusInput> = {};

      for (const m of res.activeMembers) {
        const rec = recMap.get(m.idAnggota);
        nextEntries[m.idAnggota] = {
          idAnggota: m.idAnggota,
          statusH: rec ? rec.statusH : false,
          statusB: rec ? rec.statusB : false,
          statusI: rec ? rec.statusI : false,
          statusS: rec ? rec.statusS : false,
          statusA: rec ? rec.statusA : false,
          statusL: rec ? rec.statusL : false,
        };
      }
      setEntries(nextEntries);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat data absensi tanggal ini.',
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDateData(tanggal);
  }, [tanggal, loadDateData]);

  function toggleHB(idAnggota: string, field: 'statusH' | 'statusB') {
    setEntries((prev) => {
      const cur = prev[idAnggota] || {
        idAnggota,
        statusH: false,
        statusB: false,
        statusI: false,
        statusS: false,
        statusA: false,
        statusL: false,
      };
      return {
        ...prev,
        [idAnggota]: {
          ...cur,
          [field]: !cur[field],
          statusI: false,
          statusS: false,
          statusA: false,
          statusL: false,
        },
      };
    });
  }

  function selectOther(idAnggota: string, field: 'statusI' | 'statusS' | 'statusA' | 'statusL') {
    setEntries((prev) => {
      const cur = prev[idAnggota] || {
        idAnggota,
        statusH: false,
        statusB: false,
        statusI: false,
        statusS: false,
        statusA: false,
        statusL: false,
      };
      const willActivate = !cur[field];
      return {
        ...prev,
        [idAnggota]: {
          idAnggota,
          statusH: false,
          statusB: false,
          statusI: field === 'statusI' ? willActivate : false,
          statusS: field === 'statusS' ? willActivate : false,
          statusA: field === 'statusA' ? willActivate : false,
          statusL: field === 'statusL' ? willActivate : false,
        },
      };
    });
  }

  function markAllHadir() {
    setEntries((prev) => {
      const next = { ...prev };
      for (const m of members) {
        const cur = next[m.idAnggota];
        const hasAny =
          cur &&
          (cur.statusH || cur.statusB || cur.statusI || cur.statusS || cur.statusA || cur.statusL);
        if (!hasAny) {
          next[m.idAnggota] = {
            idAnggota: m.idAnggota,
            statusH: true,
            statusB: false,
            statusI: false,
            statusS: false,
            statusA: false,
            statusL: false,
          };
        }
      }
      return next;
    });
  }

  function handleOpenConfirm() {
    setFeedback(null);
    const filled = Object.values(entries).filter(
      (e) => e.statusH || e.statusB || e.statusI || e.statusS || e.statusA || e.statusL,
    );
    if (filled.length === 0) {
      setFeedback({
        type: 'error',
        text: 'Pilih minimal satu status absensi anggota sebelum menyimpan.',
      });
      return;
    }
    setConfirmOpen(true);
  }

  async function handleConfirmSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = Object.values(entries);
      await api.saveAbsensiBatch(token, tanggal, payload);
      setConfirmOpen(false);
      setIsExistingDate(true);
      setFeedback({
        type: 'success',
        text: `Absensi tanggal ${formatTanggalIndo(tanggal)} berhasil disimpan tanpa duplikasi.`,
      });
      onSavedSuccess();
      await loadDateData(tanggal);
    } catch (err) {
      setConfirmOpen(false);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan data absensi.',
      });
    } finally {
      setSaving(false);
    }
  }

  // Summary preview for confirmation & live header
  const entryList = members.map((m) => ({
    member: m,
    entry: entries[m.idAnggota],
    code: getAttendanceCode(entries[m.idAnggota]),
    points: getAttendancePoints(entries[m.idAnggota]),
  }));

  const countHB = entryList.filter((x) => x.code === 'H+B').length;
  const countH = entryList.filter((x) => x.entry?.statusH).length;
  const countB = entryList.filter((x) => x.entry?.statusB).length;
  const totalPoints = entryList.reduce((acc, x) => acc + x.points, 0);

  return (
    <div className="space-y-6">
      {/* Top Controls Card */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>{isExistingDate ? 'Mode Edit Data Tersimpan' : 'Input Data Baru'}</span>
              {period && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Periode {period.label}</span>
                </>
              )}
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[#0B2B52]">
              Input Absensi Harian Security
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Pilih kode H dan B secara bersamaan apabila anggota bertugas Hadir sekaligus Badal (dihitung 2 kehadiran).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <label htmlFor="absensi-date" className="sr-only">Pilih Tanggal Absensi</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 min-h-11">
                <Calendar className="h-4 w-4 text-[#1565C0] shrink-0" />
                <input
                  id="absensi-date"
                  type="date"
                  value={tanggal}
                  onChange={(e) => {
                    if (e.target.value) setTanggal(e.target.value);
                  }}
                  className="bg-transparent text-sm font-semibold text-slate-900 font-mono-tabular focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTanggal(getTodayJakartaDate())}
              className="min-h-11 rounded-xl border border-slate-300 bg-white/80 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-white transition-colors whitespace-nowrap shrink-0"
            >
              Hari Ini
            </button>
          </div>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl px-5 py-3.5 text-sm font-medium flex items-center gap-2.5 shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50/95 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50/95 border border-rose-200 text-rose-900'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Attendance List */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Users className="h-4 w-4 text-[#1565C0]" />
            <span className="font-semibold">{members.length} Anggota Aktif</span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className="font-mono-tabular text-xs sm:text-sm text-slate-600">
              Total Poin Tanggal Ini: <strong className="text-[#0B2B52]">{totalPoints}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={markAllHadir}
            disabled={loading || members.length === 0}
            className="min-h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/90 px-3.5 py-2 text-xs font-semibold text-[#0B2B52] hover:bg-sky-100 transition-colors whitespace-nowrap shrink-0"
          >
            <CheckCheck className="h-4 w-4" />
            <span>Isi Kosong dengan Hadir (H)</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-[#1565C0]" />
            <span>Memuat daftar anggota...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-600">
            Tidak ada anggota aktif. Aktifkan anggota melalui menu Data Anggota.
          </div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {entryList.map(({ member, entry, code, points }, index) => {
              const cur = entry || {
                idAnggota: member.idAnggota,
                statusH: false,
                statusB: false,
                statusI: false,
                statusS: false,
                statusA: false,
                statusL: false,
              };

              return (
                <div
                  key={member.idAnggota}
                  className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
                  <div className="flex items-center justify-between lg:justify-start gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono-tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B2B52]/10 text-xs font-bold text-[#0B2B52]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{member.nama}</p>
                        <p className="text-xs text-slate-500 font-mono-tabular">
                          {member.idAnggota} · {points} poin kehadiran
                        </p>
                      </div>
                    </div>

                    <div className="lg:hidden">
                      <span className={`inline-flex min-w-12 justify-center rounded-lg px-2.5 py-1 text-xs font-mono-tabular ${getCodeCellClasses(code)}`}>
                        {code}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Simultaneous H & B toggles */}
                    <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/90 p-1 border border-slate-200/90">
                      <button
                        type="button"
                        onClick={() => toggleHB(member.idAnggota, 'statusH')}
                        aria-pressed={cur.statusH}
                        className={`min-h-10 min-w-14 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                          cur.statusH
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-emerald-50'
                        }`}
                      >
                        H · Hadir
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleHB(member.idAnggota, 'statusB')}
                        aria-pressed={cur.statusB}
                        className={`min-h-10 min-w-14 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                          cur.statusB
                            ? 'bg-[#0284C7] text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-sky-50'
                        }`}
                      >
                        B · Badal
                      </button>
                    </div>

                    {/* Mutually exclusive I, S, A, L */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {OTHER_CODES.map((opt) => {
                        const active = cur[opt.key];
                        return (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => selectOther(member.idAnggota, opt.key)}
                            aria-pressed={active}
                            className={`min-h-10 rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                              active
                                ? opt.activeCls
                                : 'border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {opt.code} · {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="hidden lg:flex items-center justify-end min-w-16">
                      <span className={`inline-flex min-w-12 justify-center rounded-lg px-2.5 py-1.5 text-xs font-mono-tabular ${getCodeCellClasses(code)}`}>
                        {code}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-xs sm:text-sm text-slate-600">
            Ringkasan sementara:{' '}
            <span className="font-mono-tabular font-semibold text-slate-800">
              H: {countH} · B: {countB} · H+B: {countHB} · Total Poin: {totalPoints}
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenConfirm}
            disabled={loading || saving || members.length === 0}
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2B52] to-[#1565C0] px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 transition-all disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Save className="h-4 w-4" />
            <span>{isExistingDate ? 'Simpan Perubahan Absensi' : 'Simpan Absensi'}</span>
          </button>
        </div>
      </section>

      <ConfirmModal
        open={confirmOpen}
        title="Konfirmasi Simpan Absensi"
        description={`Pastikan data absensi untuk tanggal ${formatTanggalIndo(tanggal)} sudah benar sebelum disimpan ke database.`}
        confirmLabel="Ya, Simpan Absensi"
        loading={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
      >
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white/75 divide-y divide-slate-200/80">
          {entryList.map(({ member, code, points }) => (
            <div key={member.idAnggota} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
              <span className="font-medium text-slate-800">{member.nama}</span>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-slate-500 font-mono-tabular">{points} poin</span>
                <span className={`inline-flex min-w-11 justify-center rounded-md px-2 py-0.5 text-xs font-mono-tabular ${getCodeCellClasses(code)}`}>
                  {code}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ConfirmModal>
    </div>
  );
}
