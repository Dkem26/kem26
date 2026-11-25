import React, { useEffect, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import type { AttendanceStatusInput } from '../types.ts';
import { formatTanggalIndo, getAttendanceCode, getAttendancePoints } from '../utils/period.ts';
import { getCodeCellClasses } from '../utils/codeStyles.ts';

interface EditSingleAbsensiModalProps {
  open: boolean;
  tanggal: string;
  idAnggota: string;
  namaAnggota: string;
  initialStatus: AttendanceStatusInput;
  saving: boolean;
  onSave: (tanggal: string, entry: AttendanceStatusInput) => Promise<void>;
  onClose: () => void;
}

export function EditSingleAbsensiModal({
  open,
  tanggal,
  idAnggota,
  namaAnggota,
  initialStatus,
  saving,
  onSave,
  onClose,
}: EditSingleAbsensiModalProps) {
  const [status, setStatus] = useState<AttendanceStatusInput>(initialStatus);
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
    setConfirmStep(false);
  }, [initialStatus, open]);

  if (!open) return null;

  const code = getAttendanceCode(status);
  const points = getAttendancePoints(status);

  function toggleHB(field: 'statusH' | 'statusB') {
    setConfirmStep(false);
    setStatus((prev) => ({
      ...prev,
      [field]: !prev[field],
      statusI: false,
      statusS: false,
      statusA: false,
      statusL: false,
    }));
  }

  function selectOther(field: 'statusI' | 'statusS' | 'statusA' | 'statusL') {
    setConfirmStep(false);
    setStatus((prev) => {
      const nextVal = !prev[field];
      return {
        ...prev,
        statusH: false,
        statusB: false,
        statusI: field === 'statusI' ? nextVal : false,
        statusS: field === 'statusS' ? nextVal : false,
        statusA: field === 'statusA' ? nextVal : false,
        statusL: field === 'statusL' ? nextVal : false,
      };
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#041226]/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 text-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {formatTanggalIndo(tanggal)} · {idAnggota}
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#0B2B52]">
              Edit Absensi: {namaAnggota}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup dialog"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Kehadiran (H dan B dapat dipilih bersamaan)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => toggleHB('statusH')}
                className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                  status.statusH
                    ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50'
                }`}
              >
                H · Hadir
              </button>
              <button
                type="button"
                onClick={() => toggleHB('statusB')}
                className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                  status.statusB
                    ? 'bg-[#0284C7] border-sky-700 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-sky-50'
                }`}
              >
                B · Badal
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Keterangan Lainnya (Pilihan Tunggal)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'statusI' as const, label: 'I · Izin', active: 'bg-amber-500 border-amber-600 text-white' },
                { key: 'statusS' as const, label: 'S · Sakit', active: 'bg-orange-500 border-orange-600 text-white' },
                { key: 'statusA' as const, label: 'A · Alpa', active: 'bg-rose-600 border-rose-700 text-white' },
                { key: 'statusL' as const, label: 'L · Libur', active: 'bg-slate-600 border-slate-700 text-white' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectOther(item.key)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                    status[item.key]
                      ? item.active
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/75 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Status Terpilih</p>
              <p className="text-sm font-semibold text-slate-800 font-mono-tabular">
                {points} poin kehadiran
              </p>
            </div>
            <span className={`inline-flex min-w-14 justify-center rounded-lg px-3 py-1.5 text-sm font-mono-tabular ${getCodeCellClasses(code)}`}>
              {code}
            </span>
          </div>

          {confirmStep && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs sm:text-sm text-[#0B2B52]">
              Konfirmasi perubahan absensi <strong>{namaAnggota}</strong> pada{' '}
              <strong>{formatTanggalIndo(tanggal)}</strong> menjadi <strong>{code}</strong>?
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-10 rounded-xl border border-slate-300 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Batal
          </button>
          {!confirmStep ? (
            <button
              type="button"
              onClick={() => setConfirmStep(true)}
              className="min-h-10 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2B52] to-[#1565C0] px-5 py-2 text-sm font-semibold text-white shadow-md hover:brightness-110"
            >
              <Save className="h-4 w-4" />
              <span>Lanjut Simpan</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => onSave(tanggal, status)}
              className="min-h-10 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{saving ? 'Menyimpan...' : 'Ya, Konfirmasi Simpan'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
