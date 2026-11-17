import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanFace,
  FileSpreadsheet,
  Fingerprint,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  ScrollText,
  MapPin,
  Settings as SettingsIcon,
  Building2,
  ExternalLink,
  Bell,
  LogOut,
  Menu,
  X,
  Camera,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Banknote,
} from 'lucide-react';
import { KioskTerminalPage } from './pages/KioskTerminalPage';
import { AttendanceDashboard } from './pages/AttendanceDashboard';
import { FaceEnrollmentPage } from './pages/FaceEnrollmentPage';
import { AttendanceReportsPage } from './pages/AttendanceReportsPage';
import { AttendanceSettingsPage } from './pages/AttendanceSettingsPage';
import { ManualEntryPage } from './pages/ManualEntryPage';
import { LeaveApplyPage } from './pages/LeaveApplyPage';
import { PaymentEntryPage } from './pages/PaymentEntryPage';
import { MonthlyPayslipPage } from './pages/MonthlyPayslipPage';
import { LiveMapGeofencePage } from './pages/LiveMapGeofencePage';
import { useAuth } from '@/contexts/AuthContext';

export function AttendanceApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { company, attendanceEnabled, isSuperAdmin, profile, signOut } = useAuth();
  const companyName = (company as any)?.company_name || (company as any)?.name || 'Argus Technologies';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState([
    {
      id: '1',
      title: 'Biometric Camera Online',
      message: '128-d facial feature extraction pipeline active on Kiosk Terminal.',
      type: 'INFO',
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Geofence Active',
      message: 'Facility coordinates & 200m perimeter validation enforced.',
      type: 'INFO',
      is_read: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleMarkSingleRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  // Close notifications tray on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationsOpen]);

  // Fullscreen Kiosk Mode (no top bar / sidebar chrome)
  if (location.pathname === '/attendance/kiosk' || location.pathname === '/kiosk') {
    return <KioskTerminalPage />;
  }

  // If attendance is disabled for this company and user is not super admin
  if (!attendanceEnabled && !isSuperAdmin) {
    return (
      <div className="attendance-suite min-h-screen flex items-center justify-center bg-[#f8fbff] p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto mb-4 font-bold">
            <Camera className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">AI Attendance is Disabled</h2>
          <p className="mt-2 text-xs text-slate-600">
            Biometric Facial Recognition Attendance is not enabled for {companyName}. Please contact your administrator.
          </p>
          <div className="mt-5">
            <button
              onClick={() => window.location.assign('/dashboard')}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              Return to BI Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      name: 'Admin Dashboard',
      path: '/attendance/dashboard',
      altPaths: ['/attendance/admin', '/attendance'],
      icon: LayoutDashboard,
    },
    {
      name: 'Attendance Capture',
      path: '/attendance/kiosk',
      icon: ScanFace,
      external: true,
    },
    {
      name: 'Attendance Reports',
      path: '/attendance/reports',
      icon: FileSpreadsheet,
    },
    {
      name: 'Employee Directory',
      path: '/attendance/enroll',
      altPaths: ['/attendance/enrollment'],
      icon: Fingerprint,
    },
    {
      name: 'Manual Entry',
      path: '/attendance/manual',
      icon: CalendarCheck,
    },
    {
      name: 'Leave Apply',
      path: '/attendance/leaves',
      icon: CalendarDays,
    },
    {
      name: 'Payment & Advance',
      path: '/attendance/payments',
      icon: CreditCard,
    },
    {
      name: 'Monthly Payslip',
      path: '/attendance/payslip',
      icon: ScrollText,
    },
    {
      name: 'Live Map & Geofence',
      path: '/attendance/geofence',
      icon: MapPin,
    },
    {
      name: 'Shift & Policies',
      path: '/attendance/settings',
      icon: SettingsIcon,
    },
  ];

  return (
    <div className="attendance-suite min-h-screen bg-[#f8fbff] text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Desktop Left Sidebar */}
      <aside className="attendance-sidebar hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 z-30 h-screen sticky top-0 overflow-y-auto">
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-100 flex items-center px-5 gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center p-1.5 shadow-md shadow-blue-500/20 shrink-0 text-white font-black text-sm">
            <Camera className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black tracking-wider text-slate-900 uppercase truncate">
              ARGUS BI
            </div>
            <div className="text-[10px] tracking-tight text-blue-600 font-bold -mt-0.5 uppercase truncate">
              AI ATTENDANCE SUITE
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.altPaths && item.altPaths.includes(location.pathname));
            const Icon = item.icon;

            if (item.external) {
              return (
                <a
                  key={item.name}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span>{item.name}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 opacity-60" />
                </a>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer / Current Tenant */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Current Tenant
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
              {companyName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-800 truncate">{companyName}</div>
              <div className="text-[10px] text-slate-400 font-mono">Biometric Node #1</div>
            </div>
          </div>
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Return to BI Core</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 truncate">
              <span className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                {companyName}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                AI Suite v2.0
              </span>
            </div>
          </div>

          {/* Right Header Utilities: Notifications, Launch Kiosk, Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((o) => !o)}
                className={`p-2 rounded-xl transition-all cursor-pointer relative ${
                  notificationsOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-emerald-500 text-white font-mono text-[9px] font-bold shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkSingleRead(n.id)}
                        className={`p-3.5 text-xs transition-colors cursor-pointer flex items-start gap-3 ${
                          !n.is_read ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-0.5 bg-blue-100 text-blue-700">
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 truncate">{n.title}</span>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Role Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-bold text-slate-700 uppercase tracking-wider shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN ROLE'}</span>
            </div>

            {/* Launch Kiosk Button */}
            <a
              href="/attendance/kiosk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-all shrink-0 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Launch Kiosk</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </a>

            {/* Profile Avatar / Name */}
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="w-8 h-8 rounded-full ring-2 ring-blue-500/20 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {profile?.full_name ? profile.full_name.slice(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="text-left text-xs leading-tight">
                <div className="font-bold text-slate-900 truncate max-w-[110px]">
                  {profile?.full_name || 'Admin'}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {profile?.role || 'Super Admin'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 p-3 space-y-1 shadow-lg z-30">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${
                    isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-100">
              <a
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600"
              >
                <Building2 className="w-4 h-4" />
                <span>Return to BI Core</span>
              </a>
            </div>
          </div>
        )}

        {/* Routed Subsystem View */}
        <section className="attendance-main flex-1 w-full overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/attendance/dashboard" replace />} />
            <Route path="/attendance" element={<Navigate to="/attendance/dashboard" replace />} />
            <Route path="/attendance/dashboard" element={<AttendanceDashboard />} />
            <Route path="/attendance/admin" element={<AttendanceDashboard />} />
            <Route path="/dashboard" element={<AttendanceDashboard />} />
            <Route path="/attendance/enroll" element={<FaceEnrollmentPage />} />
            <Route path="/attendance/enrollment" element={<FaceEnrollmentPage />} />
            <Route path="/attendance/reports" element={<AttendanceReportsPage />} />
            <Route path="/attendance/manual" element={<ManualEntryPage />} />
            <Route path="/attendance/leaves" element={<LeaveApplyPage />} />
            <Route path="/attendance/payments" element={<PaymentEntryPage />} />
            <Route path="/attendance/payslip" element={<MonthlyPayslipPage />} />
            <Route path="/attendance/geofence" element={<LiveMapGeofencePage />} />
            <Route path="/attendance/settings" element={<AttendanceSettingsPage />} />
            <Route path="*" element={<Navigate to="/attendance/dashboard" replace />} />
          </Routes>
        </section>
      </div>
    </div>
  );
}
