import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserX,
  Search,
  Filter,
  RefreshCw,
  Camera,
  UserPlus,
  FileSpreadsheet,
  Settings,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Edit3,
} from 'lucide-react';
import { attendanceApi, AttendanceRosterResponse, AttendanceRosterItem } from '../api';
import { AttendanceBadge } from '../components/AttendanceBadge';
import { useAuth } from '@/contexts/AuthContext';

export function AttendanceDashboard() {
  const { company } = useAuth();
  const companyId = company?.id || '';

  const [rosterData, setRosterData] = useState<AttendanceRosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Manual Override Modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<AttendanceRosterItem | null>(null);
  const [overrideHours, setOverrideHours] = useState('8.0');
  const [overrideStatus, setOverrideStatus] = useState('PRESENT');
  const [overrideReason, setOverrideReason] = useState('Authorized supervisor adjustment');
  const [overrideSaving, setOverrideSaving] = useState(false);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await attendanceApi.getRoster(selectedDate, companyId);
      setRosterData(res);
    } catch (err: any) {
      console.error('Failed to load attendance roster:', err);
      setError(err.message || 'Could not load today attendance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [selectedDate, companyId]);

  const filteredRoster = useMemo(() => {
    if (!rosterData?.roster) return [];
    return rosterData.roster.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.employee_code.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q);

      if (!matchQuery) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'CLOCKED_IN') return item.is_currently_in;
      return item.status === statusFilter;
    });
  }, [rosterData, searchQuery, statusFilter]);

  const handleOpenOverride = (item: AttendanceRosterItem) => {
    setOverrideTarget(item);
    setOverrideHours(String(item.total_hours || 8.0));
    setOverrideStatus(item.status === 'ABSENT' ? 'PRESENT' : item.status);
    setOverrideModalOpen(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideTarget) return;

    try {
      setOverrideSaving(true);
      await attendanceApi.manualOverride({
        company_id: companyId,
        employee_id: overrideTarget.employee_id,
        log_date: selectedDate,
        hours: parseFloat(overrideHours) || 8.0,
        status: overrideStatus,
        reason: overrideReason,
      });
      setOverrideModalOpen(false);
      fetchRoster();
    } catch (err: any) {
      alert('Override failed: ' + (err.message || String(err)));
    } finally {
      setOverrideSaving(false);
    }
  };

  const metrics = rosterData?.metrics || {
    total_staff: 0,
    present: 0,
    late: 0,
    half_day: 0,
    absent: 0,
    currently_clocked_in: 0,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Face Attendance Dashboard</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time biometric attendance monitoring, roster status, and shift management for {(company as any)?.company_name || (company as any)?.name || 'Argus'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />

          <button
            onClick={fetchRoster}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
          </button>

          <a
            href="/attendance/kiosk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm shadow-slate-900/10"
          >
            <Camera className="w-4 h-4 text-orange-400" />
            Launch Kiosk Mode
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <a
            href="/attendance/enroll"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-sm shadow-orange-500/20"
          >
            <UserPlus className="w-4 h-4" />
            Enroll Face
          </a>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Staff</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">{metrics.total_staff}</div>
          <div className="text-[10px] text-slate-400 mt-1">Active workforce</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Present</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{metrics.present}</div>
          <div className="text-[10px] text-emerald-600 mt-1">On-time arrivals</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Late</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{metrics.late}</div>
          <div className="text-[10px] text-amber-600 mt-1">Grace exceeded</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-orange-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-orange-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Half Day</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-orange-700 mt-2">{metrics.half_day}</div>
          <div className="text-[10px] text-orange-600 mt-1">&lt; 4.5 hours</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-rose-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Absent</span>
            <UserX className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">{metrics.absent}</div>
          <div className="text-[10px] text-rose-600 mt-1">No punches recorded</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-blue-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Clocked In</span>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">{metrics.currently_clocked_in}</div>
          <div className="text-[10px] text-blue-600 mt-1">Inside facility now</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee, code, department…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'All Staff' },
            { id: 'PRESENT', label: 'Present' },
            { id: 'LATE', label: 'Late' },
            { id: 'HALF_DAY', label: 'Half Day' },
            { id: 'ABSENT', label: 'Absent' },
            { id: 'CLOCKED_IN', label: 'In Building' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">Check-Out</th>
                <th className="py-3 px-4">Hours</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">AI Score</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-orange-500" />
                    Loading biometric attendance records…
                  </td>
                </tr>
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No matching attendance records found for this date.
                  </td>
                </tr>
              ) : (
                filteredRoster.map((item) => (
                  <tr key={item.employee_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                          {item.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.employee_code}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      <div className="font-medium">{item.department}</div>
                      <div className="text-[10px] text-slate-400">{item.designation}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{item.shift}</td>

                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {item.check_in_time || '—'}
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {item.check_out_time || '—'}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {item.total_hours > 0 ? `${item.total_hours} hrs` : '0.0 hrs'}
                    </td>

                    <td className="py-3 px-4">
                      <AttendanceBadge status={item.status} />
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500">
                      {item.confidence_score ? `${Math.round(item.confidence_score * 100)}%` : '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenOverride(item)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-3 h-3 text-orange-500" />
                        Override
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Override Modal */}
      {overrideModalOpen && overrideTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1">Supervisor Attendance Override</h3>
            <p className="text-xs text-slate-500 mb-4">
              Manually adjust punch duration and status for {overrideTarget.name} ({overrideTarget.employee_code}).
            </p>

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Log Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  disabled
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={overrideHours}
                    onChange={(e) => setOverrideHours(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="LATE">Late Arrival</option>
                    <option value="HALF_DAY">Half Day</option>
                    <option value="OVERTIME">Overtime</option>
                    <option value="ON_LEAVE">On Leave</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supervisor Justification</label>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. On-site client deployment permission authorized"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSaving}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-sm shadow-orange-500/20"
                >
                  {overrideSaving ? 'Saving…' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
