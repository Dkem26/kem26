import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import type { AttendanceStatusInput, PengaturanData, RecapResponse } from '../types.ts';
import { api } from '../utils/api.ts';
import { getPeriodKeyFromDate, getTodayJakartaDate, shiftPeriodKey } from '../utils/period.ts';
import { CODE_LEGEND, getCodeCellClasses } from '../utils/codeStyles.ts';
import { exportRecapToExcel, exportRecapToPdf } from '../utils/exportReports.ts';
import { EditSingleAbsensiModal } from './EditSingleAbsensiModal.tsx';

interface RekapAbsensiViewProps {
  token: string;
  pengaturan: PengaturanData;
  onDataUpdated: () => void;
}

export function RekapAbsensiView({ token, pengaturan, onDataUpdated }: RekapAbsensiViewProps) {
  const [periodKey, setPeriodKey] = useState(() => getPeriodKeyFromDate(getTodayJakartaDate()));
  const [recap, setRecap] = useState<RecapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingType, setExportingType] = useState<'excel' | 'pdf' | null>(null);
  const [error, setError] = useState('');

  const [editTarget, setEditTarget] = useState<{
    tanggal: string;
    idAnggota: string;
    namaAnggota: string;
    initialStatus: AttendanceStatusInput;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadRecap = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getRecap(token, key);
      setRecap(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat rekap absensi.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRecap(periodKey);
  }, [periodKey, loadRecap]);

  async function handleExportExcel() {
    if (!recap) return;
    setExportingType('excel');
    try {
      await exportRecapToExcel(recap, pengaturan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat file Excel.');
    } finally {
      setExportingType(null);
    }
  }

  function handleExportPdf() {
    if (!recap) return;
    setExportingType('pdf');
    try {
      exportRecapToPdf(recap, pengaturan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat file PDF.');
    } finally {
      setExportingType(null);
    }
  }

  async function handleSaveSingleEdit(tanggal: string, entry: AttendanceStatusInput) {
    setSavingEdit(true);
    try {
      await api.saveSingleAbsensi(token, tanggal, entry);
      setEditTarget(null);
      await loadRecap(periodKey);
      onDataUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui absensi.');
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Period Selector & Export Controls */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Periode Absensi Otomatis Tanggal 26 – 25 · Rumus Total = H + B
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[#0B2B52]">
              Rekap Absensi Security Al-Muhajirin
            </h2>
            {recap && (
              <p className="mt-1 text-sm font-medium text-[#1565C0]">
                {recap.period.label}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Period Switcher */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white/85 p-1">
              <button
                type="button"
                onClick={() => setPeriodKey((k) => shiftPeriodKey(k, -1))}
                className="min-h-9 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriodKey(getPeriodKeyFromDate(getTodayJakartaDate()))}
                className="min-h-9 rounded-lg bg-[#0B2B52]/10 px-3 py-1.5 text-xs font-semibold text-[#0B2B52] hover:bg-[#0B2B52]/15 transition-colors whitespace-nowrap"
              >
                Periode Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriodKey((k) => shiftPeriodKey(k, 1))}
                className="min-h-9 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                <span>Berikutnya</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Export Buttons */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || !recap || exportingType !== null}
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {exportingType === 'excel' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              <span>DOWNLOAD EXCEL (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || !recap || exportingType !== null}
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2B52] to-[#1565C0] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md hover:brightness-110 transition-all disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {exportingType === 'pdf' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span>DOWNLOAD PDF (.pdf)</span>
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/95 px-5 py-3.5 text-sm font-medium text-rose-900">
          {error}
        </div>
      )}

      {/* Matrix Table */}
      <section className="glass-panel rounded-2xl p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Keterangan Kode:</span>
            {CODE_LEGEND.map((item) => (
              <span key={item.code} className="inline-flex items-center gap-1.5">
                <span className={`inline-block rounded px-1.5 py-0.5 font-mono-tabular text-[11px] font-semibold ${item.cls}`}>
                  {item.code}
                </span>
                <span>{item.label}</span>
              </span>
            ))}
          </div>
          <span className="text-xs text-slate-500">
            Klik sel tanggal untuk mengubah absensi
          </span>
        </div>

        {loading || !recap ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-[#1565C0]" />
            <span>Menghitung matriks rekap periode...</span>
          </div>
        ) : (
          <div className="ocean-scroll overflow-x-auto rounded-xl border border-slate-200/90 bg-white/95">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#0B2B52] text-white">
                  <th className="sticky left-0 z-20 bg-[#0B2B52] px-3 py-2.5 text-left font-semibold border-r border-white/15 min-w-36 sm:min-w-44">
                    Nama Anggota
                  </th>
                  {recap.period.dates.map((d) => (
                    <th
                      key={d.date}
                      title={`${d.dayName}, ${d.date}`}
                      className="px-1.5 py-2 text-center font-mono-tabular font-semibold border-r border-white/10 min-w-10"
                    >
                      <div className="text-[10px] font-normal text-sky-200 leading-none mb-0.5">
                        {d.dayName}
                      </div>
                      <div>{d.day}</div>
                    </th>
                  ))}
                  <th className="bg-[#113A6D] px-2.5 py-2 text-center font-mono-tabular font-semibold border-r border-white/15 min-w-10">H</th>
                  <th className="bg-[#113A6D] px-2.5 py-2 text-center font-mono-tabular font-semibold border-r border-white/15 min-w-10">B</th>
                  <th className="bg-[#113A6D] px-2.5 py-2 text-center font-mono-tabular font-semibold border-r border-white/15 min-w-10">I</th>
                  <th className="bg-[#113A6D] px-2.5 py-2 text-center font-mono-tabular font-semibold border-r border-white/15 min-w-10">S</th>
                  <th className="bg-[#113A6D] px-2.5 py-2 text-center font-mono-tabular font-semibold border-r border-white/15 min-w-10">A</th>
                  <th className="bg-[#113A6D] px-2.5 py-2 text-center font-mono-tabular font-semibold border-r border-white/15 min-w-10">L</th>
                  <th className="sticky right-0 z-20 bg-[#1565C0] px-3 py-2 text-center font-mono-tabular font-bold min-w-14">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recap.rows.map((row) => (
                  <tr key={row.idAnggota} className="hover:bg-sky-50/50 transition-colors">
                    <td className="sticky left-0 z-10 bg-white/95 px-3 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      {row.nama}
                      {!row.statusAktif && (
                        <span className="ml-1.5 text-[11px] font-normal text-slate-500">(Nonaktif)</span>
                      )}
                    </td>
                    {recap.period.dates.map((d) => {
                      const cell = row.daily[d.date];
                      const code = cell?.code || '-';
                      return (
                        <td
                          key={d.date}
                          className="p-1 text-center border-r border-slate-100"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const rec = cell?.record;
                              setEditTarget({
                                tanggal: d.date,
                                idAnggota: row.idAnggota,
                                namaAnggota: row.nama,
                                initialStatus: {
                                  idAnggota: row.idAnggota,
                                  statusH: rec ? rec.statusH : false,
                                  statusB: rec ? rec.statusB : false,
                                  statusI: rec ? rec.statusI : false,
                                  statusS: rec ? rec.statusS : false,
                                  statusA: rec ? rec.statusA : false,
                                  statusL: rec ? rec.statusL : false,
                                },
                              });
                            }}
                            title={`Edit ${row.nama} (${d.date})`}
                            className={`w-full min-w-9 min-h-8 rounded-md px-1 py-1 text-[11px] font-mono-tabular transition-transform hover:scale-105 ${getCodeCellClasses(code)}`}
                          >
                            {code}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center font-mono-tabular font-semibold text-emerald-800 bg-emerald-50/40 border-r border-slate-200">
                      {row.totalH}
                    </td>
                    <td className="px-2 py-2 text-center font-mono-tabular font-semibold text-sky-800 bg-sky-50/40 border-r border-slate-200">
                      {row.totalB}
                    </td>
                    <td className="px-2 py-2 text-center font-mono-tabular font-semibold text-amber-800 bg-amber-50/30 border-r border-slate-200">
                      {row.totalI}
                    </td>
                    <td className="px-2 py-2 text-center font-mono-tabular font-semibold text-orange-800 bg-orange-50/30 border-r border-slate-200">
                      {row.totalS}
                    </td>
                    <td className="px-2 py-2 text-center font-mono-tabular font-semibold text-rose-800 bg-rose-50/30 border-r border-slate-200">
                      {row.totalA}
                    </td>
                    <td className="px-2 py-2 text-center font-mono-tabular font-semibold text-slate-700 bg-slate-50/60 border-r border-slate-200">
                      {row.totalL}
                    </td>
                    <td className="sticky right-0 z-10 bg-sky-100/95 px-3 py-2 text-center font-mono-tabular font-bold text-[#0B2B52] border-l border-sky-200">
                      {row.totalKehadiran}
                    </td>
                  </tr>
                ))}

                {/* Totals row */}
                <tr className="bg-slate-100/95 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td
                    colSpan={1 + recap.period.dates.length}
                    className="px-3 py-2.5 text-right text-xs uppercase tracking-wide text-slate-700 border-r border-slate-200"
                  >
                    Total Keseluruhan Periode
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono-tabular text-emerald-900 border-r border-slate-200">
                    {recap.summary.totalH}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono-tabular text-sky-900 border-r border-slate-200">
                    {recap.summary.totalB}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono-tabular text-amber-900 border-r border-slate-200">
                    {recap.summary.totalI}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono-tabular text-orange-900 border-r border-slate-200">
                    {recap.summary.totalS}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono-tabular text-rose-900 border-r border-slate-200">
                    {recap.summary.totalA}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono-tabular text-slate-800 border-r border-slate-200">
                    {recap.summary.totalL}
                  </td>
                  <td className="sticky right-0 z-10 bg-[#0B2B52] px-3 py-2.5 text-center font-mono-tabular text-white">
                    {recap.summary.totalKehadiran}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5 text-[#1565C0]" />
            <span>File Excel (.xlsx) dapat diedit dan PDF (.pdf) otomatis berformat A4 Landscape lengkap dengan kolom tanda tangan.</span>
          </div>
        </div>
      </section>

      {editTarget && (
        <EditSingleAbsensiModal
          open={Boolean(editTarget)}
          tanggal={editTarget.tanggal}
          idAnggota={editTarget.idAnggota}
          namaAnggota={editTarget.namaAnggota}
          initialStatus={editTarget.initialStatus}
          saving={savingEdit}
          onSave={handleSaveSingleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
