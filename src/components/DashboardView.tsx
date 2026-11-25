import React from 'react';
import {
  CalendarCheck2,
  CalendarRange,
  ClipboardEdit,
  FileSpreadsheet,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import type { DashboardResponse } from '../utils/api.ts';
import { formatTanggalIndo } from '../utils/period.ts';

interface DashboardViewProps {
  data: DashboardResponse | null;
  loading: boolean;
  onNavigate: (page: 'input' | 'rekap' | 'riwayat' | 'anggota') => void;
}

export function DashboardView({ data, loading, onNavigate }: DashboardViewProps) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-2xl p-6 animate-pulse">
          <div className="h-6 w-64 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-96 rounded bg-slate-200/80" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5 animate-pulse">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="mt-3 h-8 w-12 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Anggota Aktif',
      value: data.totalAnggotaAktif,
      sub: `${data.totalSemuaAnggota} total terdaftar`,
      icon: Users,
      accent: 'text-[#0B2B52] bg-slate-100',
    },
    {
      label: 'Hadir Hari Ini',
      value: data.hadirHariIni,
      sub: 'Kode H (1 poin)',
      icon: UserCheck,
      accent: 'text-emerald-700 bg-emerald-50',
    },
    {
      label: 'Badal Hari Ini',
      value: data.badalHariIni,
      sub: 'Kode B (1 poin)',
      icon: CalendarCheck2,
      accent: 'text-sky-700 bg-sky-50',
    },
    {
      label: 'Izin',
      value: data.izinHariIni,
      sub: 'Hari ini (Kode I)',
      icon: UserMinus,
      accent: 'text-amber-700 bg-amber-50',
    },
    {
      label: 'Sakit',
      value: data.sakitHariIni,
      sub: 'Hari ini (Kode S)',
      icon: Stethoscope,
      accent: 'text-orange-700 bg-orange-50',
    },
    {
      label: 'Alpa',
      value: data.alpaHariIni,
      sub: 'Hari ini (Kode A)',
      icon: ShieldAlert,
      accent: 'text-rose-700 bg-rose-50',
    },
  ];

  const { recap } = data;
  const maxPoints = Math.max(
    1,
    ...recap.rows.map((r) => r.totalKehadiran),
  );
  const totalDistItems =
    recap.summary.totalH +
    recap.summary.totalB +
    recap.summary.totalI +
    recap.summary.totalS +
    recap.summary.totalA +
    recap.summary.totalL;

  return (
    <div className="space-y-6">
      {/* Header Banner + Quick Actions */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>Hari Ini: {formatTanggalIndo(data.today)}</span>
              <span aria-hidden="true">·</span>
              <span>Periode Aktif 26–25</span>
            </div>
            <h2 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-[#0B2B52]">
              {recap.period.label}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {data.belumDiabsen > 0
                ? `${data.belumDiabsen} dari ${data.totalAnggotaAktif} anggota aktif belum diinput absensinya hari ini.`
                : `Seluruh ${data.totalAnggotaAktif} anggota aktif telah tercatat absensinya hari ini.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('input')}
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2B52] to-[#1565C0] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 transition-all whitespace-nowrap shrink-0"
            >
              <ClipboardEdit className="h-4 w-4" />
              <span>Input Absensi</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('rekap')}
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white/85 px-5 py-2.5 text-sm font-semibold text-[#0B2B52] hover:bg-white transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Rekap Absensi</span>
            </button>
          </div>
        </div>
      </section>

      {/* 6 KPI Cards */}
      <section aria-label="Ringkasan statistik hari ini" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600">{card.label}</span>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="font-mono-tabular text-2xl sm:text-3xl font-bold text-[#0B2B52]">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Period Summary & Chart Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Chart: Kehadiran per Anggota Periode Aktif */}
        <div className="xl:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#0B2B52]">
                Grafik Statistik Kehadiran Periode Aktif
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Perbandingan akumulasi poin Hadir (H) dan Badal (B) per anggota · Total = H + B
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#0B2B52]" /> Hadir (H)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#0284C7]" /> Badal (B)
              </span>
            </div>
          </div>

          {recap.rows.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-slate-700">Belum ada data anggota aktif</p>
              <button
                type="button"
                onClick={() => onNavigate('anggota')}
                className="mt-3 rounded-xl bg-[#0B2B52] px-4 py-2 text-xs font-semibold text-white"
              >
                Kelola Anggota
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4 flex-1">
              {recap.rows.map((member) => {
                const hPct = (member.totalH / maxPoints) * 100;
                const bPct = (member.totalB / maxPoints) * 100;
                return (
                  <div key={member.idAnggota} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-semibold text-slate-800 truncate">
                        {member.nama}
                        {!member.statusAktif && (
                          <span className="ml-2 text-xs font-normal text-slate-500">(Nonaktif)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-3 font-mono-tabular text-xs shrink-0">
                        <span className="text-emerald-700">H:{member.totalH}</span>
                        <span className="text-sky-700">B:{member.totalB}</span>
                        <span className="font-bold text-[#0B2B52]">Total: {member.totalKehadiran}</span>
                      </div>
                    </div>
                    <div className="h-4 w-full rounded-lg bg-slate-200/75 overflow-hidden flex">
                      {member.totalH > 0 && (
                        <div
                          style={{ width: `${hPct}%` }}
                          className="h-full bg-gradient-to-r from-[#0B2B52] to-[#1565C0] transition-all duration-300"
                          title={`Hadir: ${member.totalH}`}
                        />
                      )}
                      {member.totalB > 0 && (
                        <div
                          style={{ width: `${bPct}%` }}
                          className="h-full bg-gradient-to-r from-[#0284C7] to-[#38BDF8] transition-all duration-300"
                          title={`Badal: ${member.totalB}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {totalDistItems === 0 && (
                <div className="mt-4 rounded-xl border border-slate-200/80 bg-white/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs sm:text-sm text-slate-600">
                    Belum ada catatan absensi pada periode {recap.period.label}.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('input')}
                    className="rounded-lg bg-[#0B2B52] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1565C0] transition-colors whitespace-nowrap shrink-0"
                  >
                    Mulai Input Absensi
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="xl:col-span-5 glass-panel rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B2B52]">
                  Ringkasan Kehadiran Periode
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  {data.activeDaysRecorded} hari terisi dari {recap.period.dates.length} hari periode
                </p>
              </div>
              <CalendarRange className="h-5 w-5 text-[#1565C0] shrink-0" />
            </div>

            <div className="mt-5 rounded-xl bg-gradient-to-br from-[#0B2B52] to-[#14539A] p-5 text-white shadow-md">
              <p className="text-xs font-medium text-sky-200">Akumulasi Total Kehadiran (H + B)</p>
              <p className="mt-1 font-mono-tabular text-3xl sm:text-4xl font-bold">
                {recap.summary.totalKehadiran}
              </p>
              <p className="mt-1.5 text-xs text-sky-100/90">
                Terdiri dari {recap.summary.totalH} Hadir dan {recap.summary.totalB} Badal
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { code: 'H', label: 'Hadir', val: recap.summary.totalH, cls: 'text-emerald-800 bg-emerald-50/90 border-emerald-200' },
                { code: 'B', label: 'Badal', val: recap.summary.totalB, cls: 'text-sky-800 bg-sky-50/90 border-sky-200' },
                { code: 'I', label: 'Izin', val: recap.summary.totalI, cls: 'text-amber-800 bg-amber-50/90 border-amber-200' },
                { code: 'S', label: 'Sakit', val: recap.summary.totalS, cls: 'text-orange-800 bg-orange-50/90 border-orange-200' },
                { code: 'A', label: 'Alpa', val: recap.summary.totalA, cls: 'text-rose-800 bg-rose-50/90 border-rose-200' },
                { code: 'L', label: 'Libur', val: recap.summary.totalL, cls: 'text-slate-700 bg-slate-100/90 border-slate-200' },
              ].map((item) => (
                <div key={item.code} className={`rounded-xl border p-3 ${item.cls}`}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{item.label}</span>
                    <span className="font-mono-tabular">{item.code}</span>
                  </div>
                  <p className="mt-1.5 font-mono-tabular text-xl font-bold">{item.val}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
            <span>Aturan hitung: H+B pada 1 tanggal = 2 poin</span>
            <button
              type="button"
              onClick={() => onNavigate('riwayat')}
              className="font-semibold text-[#1565C0] hover:underline whitespace-nowrap shrink-0"
            >
              Lihat Riwayat →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
