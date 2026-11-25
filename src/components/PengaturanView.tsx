import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  FileText,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react';
import type { PengaturanData } from '../types.ts';
import { api } from '../utils/api.ts';
import { GAS_FILES } from '../utils/gasTemplates.ts';

interface PengaturanViewProps {
  token: string;
  username: string;
  pengaturan: PengaturanData;
  onPengaturanUpdated: (next: PengaturanData) => void;
}

export function PengaturanView({
  token,
  username,
  pengaturan,
  onPengaturanUpdated,
}: PengaturanViewProps) {
  const [activeTab, setActiveTab] = useState<'umum' | 'gas' | 'panduan'>('umum');

  // Report settings state
  const [formCfg, setFormCfg] = useState<PengaturanData>(pengaturan);
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgFeedback, setCfgFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [passFeedback, setPassFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // GAS viewer state
  const [selectedGasIdx, setSelectedGasIdx] = useState(0);
  const [copiedFilename, setCopiedFilename] = useState<string | null>(null);

  async function handleSaveReportConfig(e: React.FormEvent) {
    e.preventDefault();
    setCfgFeedback(null);
    setSavingCfg(true);
    try {
      const res = await api.updatePengaturan(token, formCfg);
      onPengaturanUpdated(res.pengaturan);
      setFormCfg(res.pengaturan);
      setCfgFeedback({ type: 'success', text: 'Pengaturan kop dan tanda tangan laporan berhasil disimpan.' });
    } catch (err) {
      setCfgFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan laporan.',
      });
    } finally {
      setSavingCfg(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassFeedback(null);
    if (newPassword.length < 6) {
      setPassFeedback({ type: 'error', text: 'Password baru minimal 6 karakter.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassFeedback({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' });
      return;
    }
    setSavingPass(true);
    try {
      await api.changePassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPassFeedback({ type: 'success', text: 'Password admin berhasil diperbarui.' });
    } catch (err) {
      setPassFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengganti password.',
      });
    } finally {
      setSavingPass(false);
    }
  }

  async function handleCopyGas(filename: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFilename(filename);
      setTimeout(() => setCopiedFilename(null), 2000);
    } catch {
      // Fallback
    }
  }

  function handleDownloadGas(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const activeGasFile = GAS_FILES[selectedGasIdx];

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Admin Aktif: {username} · Konfigurasi Sistem & Paket Google Apps Script
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[#0B2B52]">
              Pengaturan & Deployment Google Apps Script
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 border border-slate-200 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('umum')}
              className={`min-h-10 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'umum' ? 'bg-white text-[#0B2B52] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>Akun & Laporan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gas')}
              className={`min-h-10 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'gas' ? 'bg-white text-[#0B2B52] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="h-4 w-4" />
              <span>Kode Google Apps Script</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('panduan')}
              className={`min-h-10 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'panduan' ? 'bg-white text-[#0B2B52] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Panduan Instalasi</span>
            </button>
          </div>
        </div>
      </section>

      {activeTab === 'umum' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Change Password */}
          <section className="glass-panel rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5 border-b border-slate-200/80 pb-4">
              <ShieldCheck className="h-5 w-5 text-[#1565C0]" />
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B2B52]">Ganti Password Admin</h3>
                <p className="text-xs text-slate-600">Password dienkripsi aman menggunakan salt & scrypt di server.</p>
              </div>
            </div>

            {passFeedback && (
              <div
                role="status"
                className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
                  passFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}
              >
                {passFeedback.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
              <div>
                <label htmlFor="cur-pass" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password Saat Ini
                </label>
                <input
                  id="cur-pass"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full min-h-11 rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565C0] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="new-pass" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password Baru (Minimal 6 Karakter)
                </label>
                <input
                  id="new-pass"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full min-h-11 rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565C0] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="conf-pass" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Konfirmasi Password Baru
                </label>
                <input
                  id="conf-pass"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full min-h-11 rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565C0] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingPass}
                className="min-h-11 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2B52] to-[#1565C0] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-60"
              >
                {savingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Perbarui Password</span>
              </button>
            </form>
          </section>

          {/* Report Signature Settings */}
          <section className="glass-panel rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5 border-b border-slate-200/80 pb-4">
              <FileText className="h-5 w-5 text-[#1565C0]" />
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B2B52]">Kop & Tanda Tangan Laporan</h3>
                <p className="text-xs text-slate-600">Digunakan otomatis pada ekspor Excel (.xlsx) dan PDF (.pdf).</p>
              </div>
            </div>

            {cfgFeedback && (
              <div
                role="status"
                className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
                  cfgFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}
              >
                {cfgFeedback.text}
              </div>
            )}

            <form onSubmit={handleSaveReportConfig} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cfg-instansi" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Instansi / Pesantren
                  </label>
                  <input
                    id="cfg-instansi"
                    type="text"
                    value={formCfg.namaInstansi}
                    onChange={(e) => setFormCfg({ ...formCfg, namaInstansi: e.target.value })}
                    className="w-full min-h-10 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cfg-unit" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Unit / Divisi
                  </label>
                  <input
                    id="cfg-unit"
                    type="text"
                    value={formCfg.namaUnit}
                    onChange={(e) => setFormCfg({ ...formCfg, namaUnit: e.target.value })}
                    className="w-full min-h-10 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cfg-petugas" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Petugas (TTD Kanan)
                  </label>
                  <input
                    id="cfg-petugas"
                    type="text"
                    value={formCfg.namaPetugas}
                    onChange={(e) => setFormCfg({ ...formCfg, namaPetugas: e.target.value })}
                    className="w-full min-h-10 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cfg-jab-petugas" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Jabatan Petugas
                  </label>
                  <input
                    id="cfg-jab-petugas"
                    type="text"
                    value={formCfg.jabatanPetugas}
                    onChange={(e) => setFormCfg({ ...formCfg, jabatanPetugas: e.target.value })}
                    className="w-full min-h-10 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cfg-pimpinan" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Pimpinan (TTD Kiri)
                  </label>
                  <input
                    id="cfg-pimpinan"
                    type="text"
                    value={formCfg.namaPimpinan}
                    onChange={(e) => setFormCfg({ ...formCfg, namaPimpinan: e.target.value })}
                    className="w-full min-h-10 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cfg-jab-pimpinan" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Jabatan Pimpinan
                  </label>
                  <input
                    id="cfg-jab-pimpinan"
                    type="text"
                    value={formCfg.jabatanPimpinan}
                    onChange={(e) => setFormCfg({ ...formCfg, jabatanPimpinan: e.target.value })}
                    className="w-full min-h-10 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCfg}
                className="min-h-11 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2B52] to-[#1565C0] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-60"
              >
                {savingCfg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Simpan Pengaturan Laporan</span>
              </button>
            </form>
          </section>
        </div>
      )}

      {activeTab === 'gas' && (
        <section className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <h3 className="text-lg font-bold text-[#0B2B52]">
                Paket Kode Google Apps Script Siap Pasang
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Salin atau unduh ke-4 file di bawah ini ke editor Google Apps Script (Extensions → Apps Script).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {GAS_FILES.map((file, idx) => (
                <button
                  key={file.filename}
                  type="button"
                  onClick={() => setSelectedGasIdx(idx)}
                  className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-mono-tabular font-semibold transition-colors ${
                    selectedGasIdx === idx
                      ? 'bg-[#0B2B52] text-white shadow-sm'
                      : 'bg-white/80 border border-slate-300 text-slate-700 hover:bg-white'
                  }`}
                >
                  {file.filename}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs sm:text-sm text-slate-700">
              <strong className="text-[#0B2B52]">{activeGasFile.filename}</strong> ({activeGasFile.gasType}) —{' '}
              {activeGasFile.description}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopyGas(activeGasFile.filename, activeGasFile.content)}
                className="min-h-9 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                {copiedFilename === activeGasFile.filename ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadGas(activeGasFile.filename, activeGasFile.content)}
                className="min-h-9 inline-flex items-center gap-1.5 rounded-lg bg-[#0B2B52] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh File</span>
              </button>
            </div>
          </div>

          <pre className="ocean-scroll max-h-[520px] overflow-auto rounded-xl bg-[#041428] p-4 text-xs text-sky-100 font-mono-tabular leading-relaxed border border-white/15">
            <code>{activeGasFile.content}</code>
          </pre>
        </section>
      )}

      {activeTab === 'panduan' && (
        <section className="glass-panel rounded-2xl p-5 sm:p-6 space-y-6 text-sm text-slate-700 leading-relaxed">
          <div>
            <h3 className="text-lg font-bold text-[#0B2B52]">
              Panduan Instalasi, Database Spreadsheet, & Deployment Web App
            </h3>
            <p className="mt-1 text-slate-600">
              Ikuti 4 langkah berikut untuk memasang aplikasi ini di akun Google Anda menggunakan Google Apps Script dan Google Spreadsheet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-5 space-y-2">
              <h4 className="font-bold text-[#0B2B52]">1. Pembuatan Spreadsheet Database</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm">
                <li>Buka Google Drive dan buat Google Spreadsheet baru dengan nama <strong>Database Absensi Security Al-Muhajirin</strong>.</li>
                <li>Anda <strong>tidak perlu</strong> membuat kolom atau sheet secara manual — backend <code className="font-mono-tabular">Code.gs</code> otomatis membuat 4 sheet: <strong>USERS</strong>, <strong>ANGGOTA</strong> (beserta 5 anggota awal: Sutrio, Fathur, Fikri, Idris, Rizki), <strong>ABSENSI</strong>, dan <strong>PENGATURAN</strong>.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/80 p-5 space-y-2">
              <h4 className="font-bold text-[#0B2B52]">2. Pemasangan Kode Google Apps Script</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm">
                <li>Di dalam Spreadsheet tersebut, klik menu <strong>Extensions → Apps Script</strong>.</li>
                <li>Tempel isi file <code className="font-mono-tabular">Code.gs</code> pada tab Kode Google Apps Script ke editor <code className="font-mono-tabular">Code.gs</code>.</li>
                <li>Klik ikon <strong>+ (Add a file) → HTML</strong> dan buat 3 file persis bernama: <code className="font-mono-tabular">Index</code>, <code className="font-mono-tabular">Styles</code>, dan <code className="font-mono-tabular">Script</code> (tanpa ekstensi .html ganda).</li>
                <li>Tempel masing-masing isi kodenya lalu tekan <strong>Ctrl+S / Save</strong>.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/80 p-5 space-y-2">
              <h4 className="font-bold text-[#0B2B52]">3. Deployment Web App</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm">
                <li>Klik tombol <strong>Deploy → New deployment</strong> di kanan atas editor Apps Script.</li>
                <li>Pilih jenis <strong>Web app</strong>.</li>
                <li>Atur <em>Execute as</em>: <strong>Me (akun pembuat)</strong> dan <em>Who has access</em>: <strong>Anyone</strong> (karena aplikasi memiliki login admin internal sendiri, bukan login Gmail).</li>
                <li>Klik <strong>Deploy</strong>, berikan izin akses Spreadsheet/Drive saat diminta pertama kali, lalu salin URL Web App untuk dibuka di HP, tablet, maupun komputer.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/80 p-5 space-y-2">
              <h4 className="font-bold text-[#0B2B52]">4. Cara Penggunaan Harian</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm">
                <li>Saat pertama dibuka, aktifkan username & password admin pada layar aktivasi awal.</li>
                <li>Masuk ke menu <strong>Input Absensi</strong>, pilih tanggal (periode otomatis 26–25), centang/pilih <strong>H</strong> dan <strong>B</strong> bersamaan bila anggota Hadir + Badal (dihitung 2 kehadiran), lalu konfirmasi simpan.</li>
                <li>Buka <strong>Rekap Absensi</strong> untuk melihat tabel tanggal 26–25 beserta total H, B, I, S, A, L, dan Total Kehadiran, lalu klik <strong>DOWNLOAD EXCEL (.xlsx)</strong> atau <strong>DOWNLOAD PDF (.pdf)</strong>.</li>
              </ol>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
