import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  Loader2,
  LogOut,
  RefreshCw,
  Table2,
} from 'lucide-react';
import { api } from '../utils/api.ts';
import {
  googleSignIn,
  googleSignOut,
  initGoogleAuth,
} from '../utils/googleWorkspaceAuth.ts';
import {
  createDatabaseSpreadsheet,
  getSpreadsheetMetadata,
  listUserSpreadsheets,
  readImportDataFromSpreadsheet,
  readSheetRange,
  syncDatabaseToSpreadsheet,
  type DriveSpreadsheetFile,
  type SpreadsheetMetadata,
} from '../utils/googleSheetsService.ts';
import { GoogleSignInButton } from './GoogleSignInButton.tsx';
import { ConfirmModal } from './ConfirmModal.tsx';

interface GoogleSheetsPanelProps {
  appToken: string;
  selectedSpreadsheetId: string;
  onSelectSpreadsheetId: (id: string) => void;
  onDataImported: () => void;
}

type PendingAction =
  | { type: 'create'; title: string }
  | {
      type: 'sync_push';
      spreadsheetId: string;
      spreadsheetTitle: string;
      anggotaCount: number;
      absensiCount: number;
      snapshot: Awaited<ReturnType<typeof api.getSyncSnapshot>>;
    }
  | {
      type: 'sync_pull';
      spreadsheetId: string;
      spreadsheetTitle: string;
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
    };

export function GoogleSheetsPanel({
  appToken,
  selectedSpreadsheetId,
  onSelectSpreadsheetId,
  onDataImported,
}: GoogleSheetsPanelProps) {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [files, setFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [manualIdInput, setManualIdInput] = useState(selectedSpreadsheetId);
  const [newSheetTitle, setNewSheetTitle] = useState('Database Absensi Security Al-Muhajirin');

  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [activeTabPreview, setActiveTabPreview] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [preparingAction, setPreparingAction] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setManualIdInput(selectedSpreadsheetId);
  }, [selectedSpreadsheetId]);

  useEffect(() => {
    const unsub = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      },
    );
    return () => unsub();
  }, []);

  const refreshDriveFiles = useCallback(async (token: string) => {
    setLoadingFiles(true);
    setFeedback(null);
    try {
      const list = await listUserSpreadsheets(token);
      setFiles(list);
      if (!selectedSpreadsheetId && list.length > 0) {
        onSelectSpreadsheetId(list[0].id);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar Google Sheets dari Drive.',
      });
    } finally {
      setLoadingFiles(false);
    }
  }, [selectedSpreadsheetId, onSelectSpreadsheetId]);

  const loadMetadata = useCallback(async (token: string, spreadsheetId: string) => {
    if (!spreadsheetId) {
      setMetadata(null);
      setPreviewRows([]);
      return;
    }
    setLoadingPreview(true);
    try {
      const meta = await getSpreadsheetMetadata(token, spreadsheetId);
      setMetadata(meta);
      if (meta.sheets.length > 0) {
        const defaultTab = meta.sheets[0].title;
        setActiveTabPreview(defaultTab);
        const rows = await readSheetRange(token, spreadsheetId, defaultTab, 'A1:L15');
        setPreviewRows(rows);
      } else {
        setActiveTabPreview('');
        setPreviewRows([]);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal membaca metadata spreadsheet.',
      });
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (googleToken) {
      refreshDriveFiles(googleToken);
    }
  }, [googleToken, refreshDriveFiles]);

  useEffect(() => {
    if (googleToken && selectedSpreadsheetId) {
      loadMetadata(googleToken, selectedSpreadsheetId);
    }
  }, [googleToken, selectedSpreadsheetId, loadMetadata]);

  async function handleGoogleLogin() {
    setSigningIn(true);
    setFeedback(null);
    try {
      const res = await googleSignIn();
      setGoogleUser(res.user);
      setGoogleToken(res.accessToken);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Login Google gagal atau dibatalkan.',
      });
    } finally {
      setSigningIn(false);
    }
  }

  async function handleGoogleLogout() {
    await googleSignOut();
    setGoogleUser(null);
    setGoogleToken(null);
    setFiles([]);
    setMetadata(null);
    setPreviewRows([]);
  }

  async function handleSwitchPreviewTab(tabTitle: string) {
    if (!googleToken || !selectedSpreadsheetId) return;
    setActiveTabPreview(tabTitle);
    setLoadingPreview(true);
    try {
      const rows = await readSheetRange(googleToken, selectedSpreadsheetId, tabTitle, 'A1:L15');
      setPreviewRows(rows);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal membaca isi tab.',
      });
    } finally {
      setLoadingPreview(false);
    }
  }

  async function applyManualSpreadsheetId(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const trimmed = manualIdInput.trim();
    const urlMatch = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
    const extractedId = urlMatch ? urlMatch[1] : trimmed;
    if (!/^[a-zA-Z0-9-_]{10,120}$/.test(extractedId)) {
      setFeedback({
        type: 'error',
        text: 'Format Spreadsheet ID atau URL Google Sheets tidak valid.',
      });
      return;
    }
    onSelectSpreadsheetId(extractedId);
    setManualIdInput(extractedId);
    try {
      await api.updatePengaturan(appToken, { spreadsheetId: extractedId });
      setFeedback({
        type: 'success',
        text: `Spreadsheet ID "${extractedId}" tersimpan dan aktif.`,
      });
    } catch {
      // Tetap aktif di sesi ini
    }
  }

  async function preparePushSync() {
    if (!googleToken || !selectedSpreadsheetId) return;
    setPreparingAction(true);
    setFeedback(null);
    try {
      const snapshot = await api.getSyncSnapshot(appToken);
      setPendingAction({
        type: 'sync_push',
        spreadsheetId: selectedSpreadsheetId,
        spreadsheetTitle: metadata?.title || selectedSpreadsheetId,
        anggotaCount: snapshot.anggota.length,
        absensiCount: snapshot.absensi.length,
        snapshot,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyiapkan data sinkronisasi.',
      });
    } finally {
      setPreparingAction(false);
    }
  }

  async function preparePullImport() {
    if (!googleToken || !selectedSpreadsheetId) return;
    setPreparingAction(true);
    setFeedback(null);
    try {
      const parsed = await readImportDataFromSpreadsheet(googleToken, selectedSpreadsheetId);
      setPendingAction({
        type: 'sync_pull',
        spreadsheetId: selectedSpreadsheetId,
        spreadsheetTitle: parsed.title,
        anggota: parsed.anggota,
        absensi: parsed.absensi,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal membaca data dari Google Sheets.',
      });
    } finally {
      setPreparingAction(false);
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction || !googleToken) return;
    setExecutingAction(true);
    setFeedback(null);

    try {
      if (pendingAction.type === 'create') {
        const created = await createDatabaseSpreadsheet(googleToken, pendingAction.title);
        const snapshot = await api.getSyncSnapshot(appToken);
        await syncDatabaseToSpreadsheet(googleToken, created.spreadsheetId, snapshot);
        onSelectSpreadsheetId(created.spreadsheetId);
        await refreshDriveFiles(googleToken);
        await loadMetadata(googleToken, created.spreadsheetId);
        setFeedback({
          type: 'success',
          text: `Spreadsheet "${created.title}" berhasil dibuat beserta 4 sheet (ANGGOTA, ABSENSI, PENGATURAN, USERS) dan data awal telah disinkronkan.`,
        });
      } else if (pendingAction.type === 'sync_push') {
        await syncDatabaseToSpreadsheet(
          googleToken,
          pendingAction.spreadsheetId,
          pendingAction.snapshot,
        );
        await loadMetadata(googleToken, pendingAction.spreadsheetId);
        setFeedback({
          type: 'success',
          text: `Berhasil menyinkronkan ${pendingAction.anggotaCount} anggota dan ${pendingAction.absensiCount} catatan absensi ke "${pendingAction.spreadsheetTitle}".`,
        });
      } else if (pendingAction.type === 'sync_pull') {
        const res = await api.importFromSheets(appToken, {
          anggota: pendingAction.anggota,
          absensi: pendingAction.absensi,
        });
        onDataImported();
        setFeedback({
          type: 'success',
          text: `Berhasil mengimpor ${res.importedMembers} anggota baru dan ${res.importedAttendance} catatan absensi dari "${pendingAction.spreadsheetTitle}".`,
        });
      }
      setPendingAction(null);
    } catch (err) {
      setPendingAction(null);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Operasi Google Sheets gagal dijalankan.',
      });
    } finally {
      setExecutingAction(false);
    }
  }

  if (!googleToken) {
    return (
      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="max-w-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0B2B52]">
                Hubungkan Google Sheets & Google Drive
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Buat database Google Spreadsheet otomatis, sinkronkan anggota & absensi dua arah, serta kirim tab rekap periode langsung ke Google Sheets Anda.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/85 px-4 py-3 text-xs sm:text-sm text-[#0B2B52]">
            <p className="font-semibold">Spreadsheet ID Terpasang</p>
            <p className="mt-1 font-mono-tabular break-all text-slate-700">
              {selectedSpreadsheetId || 'Belum dipilih'}
            </p>
          </div>

          {feedback && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {feedback.text}
            </div>
          )}

          <div className="pt-2">
            <GoogleSignInButton onClick={handleGoogleLogin} loading={signingIn} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Google Account + Actions */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Akun Google Terhubung · {googleUser?.email || 'Google Workspace'}
            </p>
            <h3 className="mt-0.5 text-lg font-bold text-[#0B2B52]">
              Integrasi Database Google Sheets
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refreshDriveFiles(googleToken)}
              disabled={loadingFiles}
              className="min-h-10 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white/85 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
              <span>Muat Ulang Drive</span>
            </button>
            <button
              type="button"
              onClick={handleGoogleLogout}
              className="min-h-10 inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Putuskan Google</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Select or Enter Spreadsheet ID */}
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 space-y-3">
            <form onSubmit={applyManualSpreadsheetId} className="space-y-2">
              <label htmlFor="manual-spreadsheet-id" className="block text-xs font-bold text-[#0B2B52]">
                Spreadsheet ID atau Link Google Sheets
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="manual-spreadsheet-id"
                  type="text"
                  value={manualIdInput}
                  onChange={(e) => setManualIdInput(e.target.value)}
                  placeholder="Tempel ID atau URL Google Sheets..."
                  className="flex-1 min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-mono-tabular text-slate-900"
                />
                <button
                  type="submit"
                  className="min-h-11 rounded-xl border border-[#0B2B52] bg-[#0B2B52]/10 px-4 py-2 text-xs font-semibold text-[#0B2B52] hover:bg-[#0B2B52]/15 whitespace-nowrap shrink-0"
                >
                  Pakai ID Ini
                </button>
              </div>
            </form>

            <div>
              <label htmlFor="select-spreadsheet" className="block text-xs font-semibold text-slate-600 mb-1">
                Atau Pilih dari Daftar Drive ({files.length} ditemukan)
              </label>
              <select
                id="select-spreadsheet"
                value={files.some((f) => f.id === selectedSpreadsheetId) ? selectedSpreadsheetId : ''}
                onChange={async (e) => {
                  const id = e.target.value;
                  onSelectSpreadsheetId(id);
                  if (id) {
                    try {
                      await api.updatePengaturan(appToken, { spreadsheetId: id });
                    } catch {
                      // ignore
                    }
                  }
                }}
                className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">
                  {selectedSpreadsheetId && !files.some((f) => f.id === selectedSpreadsheetId)
                    ? `Menggunakan ID: ${selectedSpreadsheetId}`
                    : `-- Pilih Spreadsheet (${files.length} ditemukan) --`}
                </option>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={!selectedSpreadsheetId || preparingAction}
                onClick={preparePushSync}
                className="min-h-10 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2B52] to-[#1565C0] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
              >
                {preparingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4" />}
                <span>Kirim Data ke Sheets</span>
              </button>

              <button
                type="button"
                disabled={!selectedSpreadsheetId || preparingAction}
                onClick={preparePullImport}
                className="min-h-10 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#0B2B52] hover:bg-slate-100 disabled:opacity-50"
              >
                <ArrowDownToLine className="h-4 w-4" />
                <span>Impor dari Sheets</span>
              </button>

              {metadata?.spreadsheetUrl && (
                <a
                  href={metadata.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-10 inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Buka Spreadsheet</span>
                </a>
              )}
            </div>
          </div>

          {/* Create New Database Spreadsheet */}
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 space-y-3">
            <label htmlFor="new-spreadsheet-title" className="block text-xs font-bold text-[#0B2B52]">
              Atau Buat Spreadsheet Database Baru Otomatis
            </label>
            <input
              id="new-spreadsheet-title"
              type="text"
              value={newSheetTitle}
              onChange={(e) => setNewSheetTitle(e.target.value)}
              placeholder="Database Absensi Security Al-Muhajirin"
              className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={() =>
                setPendingAction({
                  type: 'create',
                  title: newSheetTitle.trim() || 'Database Absensi Security Al-Muhajirin',
                })
              }
              className="min-h-10 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
            >
              <FilePlus2 className="h-4 w-4" />
              <span>Buat Spreadsheet Baru & Isi Data</span>
            </button>
          </div>
        </div>
      </section>

      {/* Live Preview of Selected Spreadsheet Tabs */}
      {metadata && (
        <section className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-[#1565C0]" />
              <div>
                <h4 className="text-base font-bold text-[#0B2B52]">
                  Pratinjau Isi: {metadata.title}
                </h4>
                <p className="text-xs text-slate-500">
                  {metadata.sheets.length} tab tersedia · Menampilkan hingga 15 baris pertama
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {metadata.sheets.map((s) => (
                <button
                  key={s.sheetId}
                  type="button"
                  onClick={() => handleSwitchPreviewTab(s.title)}
                  className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-mono-tabular font-semibold transition-colors ${
                    activeTabPreview === s.title
                      ? 'bg-[#0B2B52] text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {loadingPreview ? (
            <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-[#1565C0]" />
              <span>Memuat pratinjau tab {activeTabPreview}...</span>
            </div>
          ) : previewRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 rounded-xl border border-slate-200 bg-white/60">
              Tab "{activeTabPreview}" masih kosong. Klik "Kirim Data ke Sheets" untuk mengisi data.
            </div>
          ) : (
            <div className="ocean-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white/95">
              <table className="w-full text-left text-xs">
                <tbody>
                  {previewRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx === 0 ? 'bg-[#0B2B52] text-white font-semibold' : 'border-t border-slate-200'}
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 whitespace-nowrap font-mono-tabular">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Mandatory Explicit Confirmation Modal for Mutating Google Sheets */}
      <ConfirmModal
        open={Boolean(pendingAction)}
        title={
          pendingAction?.type === 'create'
            ? 'Konfirmasi Buat Spreadsheet Baru'
            : pendingAction?.type === 'sync_push'
              ? 'Konfirmasi Tulis Data ke Google Sheets'
              : 'Konfirmasi Impor Data dari Google Sheets'
        }
        description={
          pendingAction?.type === 'create'
            ? `Aplikasi akan membuat Google Spreadsheet baru bernama "${pendingAction.title}" di Google Drive Anda beserta sheet ANGGOTA, ABSENSI, PENGATURAN, dan USERS, lalu mengisinya dengan data saat ini.`
            : pendingAction?.type === 'sync_push'
              ? `Tab ANGGOTA, ABSENSI, PENGATURAN, dan USERS pada spreadsheet "${pendingAction.spreadsheetTitle}" akan diperbarui dengan ${pendingAction.anggotaCount} anggota dan ${pendingAction.absensiCount} catatan absensi. Data lama di keempat tab tersebut akan digantikan oleh versi terbaru aplikasi.`
              : pendingAction?.type === 'sync_pull'
                ? `Aplikasi akan mengimpor ${pendingAction.anggota.length} baris anggota dan ${pendingAction.absensi.length} baris absensi dari spreadsheet "${pendingAction.spreadsheetTitle}" ke database aplikasi.`
                : ''
        }
        confirmLabel={
          pendingAction?.type === 'create'
            ? 'Ya, Buat & Sinkronkan'
            : pendingAction?.type === 'sync_push'
              ? 'Ya, Kirim ke Google Sheets'
              : 'Ya, Impor Sekarang'
        }
        loading={executingAction}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
