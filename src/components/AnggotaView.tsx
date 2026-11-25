import React, { useCallback, useEffect, useState } from 'react';
import {
  Edit3,
  Loader2,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import type { AnggotaRecord } from '../types.ts';
import { api } from '../utils/api.ts';
import { formatDateTimeIndo } from '../utils/period.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

interface AnggotaViewProps {
  token: string;
  onDataUpdated: () => void;
}

export function AnggotaView({ token, onDataUpdated }: AnggotaViewProps) {
  const [anggota, setAnggota] = useState<AnggotaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const [editingMember, setEditingMember] = useState<AnggotaRecord | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<AnggotaRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAnggota(token);
      setAnggota(res.anggota);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar anggota.',
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      setFeedback({ type: 'error', text: 'Nama anggota minimal 2 karakter.' });
      return;
    }
    setSubmittingAdd(true);
    try {
      await api.createAnggota(token, trimmed);
      setNewName('');
      setFeedback({ type: 'success', text: `Anggota "${trimmed}" berhasil ditambahkan.` });
      await loadMembers();
      onDataUpdated();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menambahkan anggota.',
      });
    } finally {
      setSubmittingAdd(false);
    }
  }

  async function handleConfirmEditName() {
    if (!editingMember) return;
    const trimmed = editNameValue.trim();
    if (trimmed.length < 2) {
      setFeedback({ type: 'error', text: 'Nama anggota minimal 2 karakter.' });
      return;
    }
    setSavingEdit(true);
    try {
      await api.updateAnggota(token, editingMember.idAnggota, trimmed);
      setEditingMember(null);
      setFeedback({ type: 'success', text: `Nama anggota diperbarui menjadi "${trimmed}".` });
      await loadMembers();
      onDataUpdated();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengubah nama anggota.',
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmToggle() {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const nextStatus = !toggleTarget.statusAktif;
      await api.toggleAnggotaStatus(token, toggleTarget.idAnggota, nextStatus);
      setFeedback({
        type: 'success',
        text: nextStatus
          ? `Anggota "${toggleTarget.nama}" diaktifkan kembali.`
          : `Anggota "${toggleTarget.nama}" dinonaktifkan. Seluruh riwayat absensinya tetap tersimpan.`,
      });
      setToggleTarget(null);
      await loadMembers();
      onDataUpdated();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memperbarui status anggota.',
      });
    } finally {
      setToggling(false);
    }
  }

  const filtered = anggota.filter((m) => {
    if (filterStatus === 'active' && !m.statusAktif) return false;
    if (filterStatus === 'inactive' && m.statusAktif) return false;
    if (search.trim() && !m.nama.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const activeCount = anggota.filter((m) => m.statusAktif).length;
  const inactiveCount = anggota.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header & Add Member Form */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {activeCount} Anggota Aktif · {inactiveCount} Nonaktif · Riwayat Absensi Terjaga
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[#0B2B52]">
              Pengelolaan Data Anggota Security
            </h2>
          </div>

          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama anggota baru..."
              aria-label="Nama anggota baru"
              className="min-h-11 sm:w-64 rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1565C0] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/20"
            />
            <button
              type="submit"
              disabled={submittingAdd}
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2B52] to-[#1565C0] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 transition-all disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {submittingAdd ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              <span>Tambah Anggota</span>
            </button>
          </form>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl px-5 py-3.5 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50/95 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50/95 border border-rose-200 text-rose-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Table Section */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100/90 p-1 w-fit border border-slate-200">
            {[
              { key: 'all' as const, label: `Semua (${anggota.length})` },
              { key: 'active' as const, label: `Aktif (${activeCount})` },
              { key: 'inactive' as const, label: `Nonaktif (${inactiveCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterStatus === tab.key
                    ? 'bg-white text-[#0B2B52] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama anggota..."
              aria-label="Cari nama anggota"
              className="min-h-10 w-full sm:w-64 rounded-xl border border-slate-300 bg-white/90 pl-9 pr-3.5 py-1.5 text-sm text-slate-900 focus:border-[#1565C0] focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-[#1565C0]" />
            <span>Memuat data anggota...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-600">
            Tidak ada anggota yang cocok dengan filter saat ini.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/90 bg-white/90">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-100/90 text-xs font-semibold text-slate-700 border-b border-slate-200">
                  <th className="px-4 py-3">ID Anggota</th>
                  <th className="px-4 py-3">Nama Anggota</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 hidden md:table-cell">Terakhir Diperbarui</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {filtered.map((m) => (
                  <tr key={m.idAnggota} className="hover:bg-sky-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-[#0B2B52]">
                      {m.idAnggota}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{m.nama}</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span className={m.statusAktif ? 'text-emerald-700' : 'text-slate-500'}>
                        {m.statusAktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono-tabular hidden md:table-cell">
                      {formatDateTimeIndo(m.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMember(m);
                            setEditNameValue(m.nama);
                          }}
                          className="min-h-9 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit Nama</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setToggleTarget(m)}
                          className={`min-h-9 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            m.statusAktif
                              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {m.statusAktif ? (
                            <>
                              <UserX className="h-3.5 w-3.5" />
                              <span>Nonaktifkan</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>Aktifkan Kembali</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Name Modal */}
      <ConfirmModal
        open={Boolean(editingMember)}
        title="Edit Nama Anggota"
        description={
          editingMember
            ? `Ubah nama anggota untuk ID ${editingMember.idAnggota}. Riwayat absensi akan ikut menyesuaikan nama terbaru.`
            : ''
        }
        confirmLabel="Simpan Perubahan"
        loading={savingEdit}
        onConfirm={handleConfirmEditName}
        onCancel={() => setEditingMember(null)}
      >
        <div>
          <label htmlFor="edit-member-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Nama Lengkap Anggota
          </label>
          <input
            id="edit-member-name"
            type="text"
            value={editNameValue}
            onChange={(e) => setEditNameValue(e.target.value)}
            className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565C0] focus:outline-none"
          />
        </div>
      </ConfirmModal>

      {/* Toggle Status Modal */}
      <ConfirmModal
        open={Boolean(toggleTarget)}
        title={toggleTarget?.statusAktif ? 'Nonaktifkan Anggota?' : 'Aktifkan Kembali Anggota?'}
        description={
          toggleTarget?.statusAktif
            ? `Anggota "${toggleTarget.nama}" tidak akan muncul pada halaman Input Absensi Harian, namun seluruh riwayat absensinya tetap tersimpan aman.`
            : `Anggota "${toggleTarget?.nama}" akan kembali aktif dan muncul pada halaman Input Absensi Harian.`
        }
        confirmLabel={toggleTarget?.statusAktif ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan Kembali'}
        variant={toggleTarget?.statusAktif ? 'danger' : 'primary'}
        loading={toggling}
        onConfirm={handleConfirmToggle}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  );
}
