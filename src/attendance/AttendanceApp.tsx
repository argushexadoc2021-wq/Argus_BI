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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center mx-auto mb-4 font-bold">
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
    <div className="min-h-screen bg-[#f8fbff] text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 z-30 h-screen sticky top-0 overflow-y-auto">
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-100 flex items-center px-5 gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center p-1.5 shadow-md shadow-orange-500/20 shrink-0 text-white font-black text-sm">
            <Camera className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black tracking-wider text-slate-900 uppercase truncate">
              ARGUS BI
            </div>
            <div className="text-[10px] tracking-tight text-orange-600 font-bold -mt-0.5 uppercase truncate">
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
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-orange-50 hover:text-orange-700 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
                    <span>{item.name}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-orange-600 opacity-60" />
                </a>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-orange-50 text-orange-700 font-bold border-l-4 border-orange-600 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-orange-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Sidebar Action: Back to BI */}
        <div className="p-3 border-t border-slate-100">
          <a
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
          >
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Return to BI Core</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between gap-3">
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
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 shrink-0">
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
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-3 z-50 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">Biometric Alerts</span>
                    <span className="text-[10px] text-emerald-600 font-bold">Real-time</span>
                  </div>
                  <div className="py-3 space-y-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-800">Camera Terminal Ready</p>
                        <p className="text-[10px] text-slate-500">128-d inference engine initialized.</p>
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-800">Geofence Active</p>
                        <p className="text-[10px] text-slate-500">Facility perimeter coordinates verified.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Launch Kiosk Button */}
            <a
              href="/attendance/kiosk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-sm shadow-orange-500/20 transition-all shrink-0 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Launch Kiosk</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </a>

            {/* Profile Avatar / Name */}
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
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
                    isActive ? 'bg-orange-50 text-orange-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
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
        <main className="flex-1 w-full overflow-y-auto">
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
        </main>
      </div>
    </div>
  );
}
