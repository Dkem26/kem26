import React, { useCallback, useEffect, useState } from 'react';
import {
  ClipboardEdit,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { AuthSession, PengaturanData } from './types.ts';
import { api, type DashboardResponse } from './utils/api.ts';
import { LoginView } from './components/LoginView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { InputAbsensiView } from './components/InputAbsensiView.tsx';
import { RekapAbsensiView } from './components/RekapAbsensiView.tsx';
import { AnggotaView } from './components/AnggotaView.tsx';
import { RiwayatAbsensiView } from './components/RiwayatAbsensiView.tsx';
import { PengaturanView } from './components/PengaturanView.tsx';

type NavPage = 'dashboard' | 'input' | 'rekap' | 'anggota' | 'riwayat' | 'pengaturan';

const NAV_ITEMS: { id: NavPage; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Beranda', icon: LayoutDashboard },
  { id: 'input', label: 'Input Absensi', shortLabel: 'Input', icon: ClipboardEdit },
  { id: 'rekap', label: 'Rekap Absensi', shortLabel: 'Rekap', icon: FileSpreadsheet },
  { id: 'anggota', label: 'Data Anggota', shortLabel: 'Anggota', icon: Users },
  { id: 'riwayat', label: 'Riwayat Absensi', shortLabel: 'Riwayat', icon: History },
  { id: 'pengaturan', label: 'Pengaturan', shortLabel: 'Setelan', icon: Settings },
];

const DEFAULT_PENGATURAN: PengaturanData = {
  namaInstansi: 'Pondok Pesantren Al-Muhajirin',
  namaUnit: 'Divisi Keamanan / Security Al-Muhajirin',
  namaPetugas: 'Koordinator Security',
  jabatanPetugas: 'Petugas / Koordinator Security',
  namaPimpinan: 'Pimpinan Pondok Pesantren',
  jabatanPimpinan: 'Pimpinan Al-Muhajirin',
  updatedAt: '',
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [pengaturan, setPengaturan] = useState<PengaturanData>(DEFAULT_PENGATURAN);

  useEffect(() => {
    let mounted = true;
    async function initAuthStatus() {
      try {
        const res = await api.authStatus(null);
        if (mounted) {
          setSetupRequired(res.setupRequired);
        }
      } catch {
        // Ignore transient init errors
      } finally {
        if (mounted) setBooting(false);
      }
    }
    initAuthStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshCoreData = useCallback(async (token: string) => {
    setLoadingDashboard(true);
    try {
      const [dashRes, cfgRes] = await Promise.all([
        api.getDashboard(token),
        api.getPengaturan(token),
      ]);
      setDashboardData(dashRes);
      setPengaturan(cfgRes.pengaturan);
    } catch {
      // Handled per view if token expires
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    if (session?.token) {
      refreshCoreData(session.token);
    }
  }, [session?.token, refreshCoreData]);

  async function handleLogout() {
    if (session?.token) {
      try {
        await api.authLogout(session.token);
      } catch {
        // Proceed with client state clear
      }
    }
    setSession(null);
    setDashboardData(null);
    setActivePage('dashboard');
    setMobileDrawerOpen(false);
    try {
      const res = await api.authStatus(null);
      setSetupRequired(res.setupRequired);
    } catch {
      setSetupRequired(false);
    }
  }

  function handleNavigate(page: NavPage) {
    setActivePage(page);
    setMobileDrawerOpen(false);
    if (page === 'dashboard' && session?.token) {
      refreshCoreData(session.token);
    }
  }

  if (booting) {
    return (
      <div className="ocean-canvas min-h-screen flex items-center justify-center text-white">
        <div className="flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
          <span className="text-sm font-medium">Memuat Aplikasi Security Al-Muhajirin...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginView
        setupRequired={setupRequired}
        onAuthenticated={(newSession) => {
          setSetupRequired(false);
          setSession(newSession);
        }}
      />
    );
  }

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  return (
    <div className="ocean-canvas min-h-screen flex flex-col lg:flex-row text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 glass-ocean-sidebar text-white z-30">
        <div className="p-5 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-[#1565C0] text-white shadow-md ring-1 ring-white/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-white truncate">
                Security Al-Muhajirin
              </p>
              <p className="text-xs text-sky-200/80 truncate">Administrasi Absensi</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Menu utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full min-h-11 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-white/18 text-white shadow-sm ring-1 ring-white/25'
                    : 'text-slate-200/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-sky-300' : 'text-slate-300'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/15 space-y-3">
          <div className="rounded-xl bg-white/8 border border-white/10 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-white truncate">{session.namaLengkap}</p>
            <p className="text-[11px] text-sky-200/80 font-mono-tabular truncate">@{session.username}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-10 flex items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/25 transition-colors whitespace-nowrap"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="lg:hidden sticky top-0 z-30 glass-ocean-bar text-white px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-[#1565C0]">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight truncate whitespace-nowrap">
            Security Al-Muhajirin
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Buka menu navigasi"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile Slide-out Drawer */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#041226]/70 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] glass-ocean-sidebar text-white flex flex-col h-full p-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/15">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-sky-300" />
                <span className="font-bold text-sm">Menu Administrasi</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Tutup menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full min-h-11 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                      active ? 'bg-white/20 text-white' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-sky-300" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-white/15">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-11 flex items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-2.5 text-sm font-semibold text-rose-100"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar Sesi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 pb-20 lg:pb-8">
        <div className="mx-auto max-w-[1380px] p-4 sm:p-6 lg:p-8">
          {/* Desktop Context Top Bar */}
          <div className="hidden lg:flex items-center justify-between gap-8 mb-6 text-white">
            <div className="flex items-center gap-2 text-sm text-sky-100/90">
              <span>Pondok Pesantren Al-Muhajirin</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-white">{activeNavMeta.label}</span>
            </div>
            <div className="text-xs text-sky-100/80 font-mono-tabular">
              {pengaturan.namaUnit}
            </div>
          </div>

          {activePage === 'dashboard' && (
            <DashboardView
              data={dashboardData}
              loading={loadingDashboard}
              onNavigate={(p) => handleNavigate(p)}
            />
          )}

          {activePage === 'input' && (
            <InputAbsensiView
              token={session.token}
              onSavedSuccess={() => refreshCoreData(session.token)}
            />
          )}

          {activePage === 'rekap' && (
            <RekapAbsensiView
              token={session.token}
              pengaturan={pengaturan}
              onDataUpdated={() => refreshCoreData(session.token)}
            />
          )}

          {activePage === 'anggota' && (
            <AnggotaView
              token={session.token}
              onDataUpdated={() => refreshCoreData(session.token)}
            />
          )}

          {activePage === 'riwayat' && (
            <RiwayatAbsensiView
              token={session.token}
              onDataUpdated={() => refreshCoreData(session.token)}
            />
          )}

          {activePage === 'pengaturan' && (
            <PengaturanView
              token={session.token}
              username={session.username}
              pengaturan={pengaturan}
              onPengaturanUpdated={(next) => setPengaturan(next)}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi cepat"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-bottom-nav px-1 py-1.5 grid grid-cols-5 gap-1"
      >
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`min-h-11 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium transition-colors ${
                active ? 'bg-white/18 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-sky-300' : 'text-slate-300'}`} />
              <span className="truncate max-w-full">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
