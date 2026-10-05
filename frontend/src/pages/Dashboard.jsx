import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CalendarDays, Receipt, Activity, TrendingUp, AlertTriangle,
  Package2, ArrowLeft, Clock, Cpu, PhoneCall, CheckCircle2,
} from 'lucide-react';
import api from '../services/api';
import { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { LoadingSpinner, EmptyState } from '../components/common';
import { formatCurrency, formatTime, getStatusColor, getStatusLabel, formatDate } from '../utils/format';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [followups, setFollowups] = useState({ list: [], stats: null });
  const [expenseStats, setExpenseStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const navigate = useNavigate();

useEffect(() => {
      const fetchStats = async () => {
        try {
          const [dash, fu, exp] = await Promise.all([
            api.get('/reports/dashboard'),
            api.get('/follow-ups/stats'),
            api.get('/expenses/stats'),
          ]);
          setStats(dash.data.data);
          setFollowups((prev) => ({ ...prev, stats: fu.data.data }));
          setExpenseStats(exp.data.data);
          try {
            const { data: list } = await api.get('/follow-ups', { params: { limit: 6, status: 'PENDING' } });
            setFollowups((prev) => ({ ...prev, list: list.data }));
          } catch (e) { /* list optional */ }
        } catch (error) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setLoading(false);
        }
      };
      fetchStats();
    }, []);

  if (loading) return <LoadingSpinner full />;
  if (!stats) return <EmptyState message="لا توجد بيانات" />;

  const counters = stats.counters;

  const cards = [
    { label: 'إجمالي المرضى', value: counters.totalPatients, icon: Users, color: 'from-primary-500 to-primary-700', sub: `+${counters.newPatientsThisMonth} هذا الشهر` },
    { label: 'مواعيد اليوم', value: counters.todayAppointments, icon: CalendarDays, color: 'from-blue-500 to-blue-700', sub: `${counters.upcomingAppointments} موعد قادم` },
    { label: 'إيرادات اليوم', value: formatCurrency(counters.revenueToday), icon: Receipt, color: 'from-green-500 to-green-700', sub: `${formatCurrency(counters.revenueMonth)} هذا الشهر` },
    { label: 'فواتير معلقة', value: counters.pendingInvoices, icon: AlertTriangle, color: 'from-amber-500 to-amber-700', sub: `${counters.totalInvoices} فاتورة` },
    { label: expenseStats && expenseStats.net < 0 ? 'خسارة الشهر' : 'صافي الشهر', value: expenseStats ? formatCurrency(expenseStats.net) : '—', icon: TrendingUp, color: expenseStats && expenseStats.net < 0 ? 'from-red-500 to-red-700' : 'from-purple-500 to-purple-700', sub: expenseStats ? `${formatCurrency(expenseStats.totalExpenses)} مصروفات` : '' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-gray-500 text-sm mt-1">نظرة عامة على عمليات العيادة</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-900">إيرادات الأسبوع</h2>
              <p className="text-xs text-gray-400">آخر 7 أيام</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="font-semibold">{formatCurrency(counters.revenueMonth)}</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenueWeek}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#db2777" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#db2777" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="revenue" stroke="#db2777" fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device status */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-900">حالة الأجهزة</h2>
              <p className="text-xs text-gray-400">الأجهزة الفعالة: {counters.activeDevices}</p>
            </div>
            <Cpu className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {Object.entries(stats.deviceByStatus || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className={`badge ${getStatusColor(status)}`}>{getStatusLabel(status)}</span>
                <span className="font-bold text-gray-800">{count}</span>
              </div>
            ))}
            {Object.keys(stats.deviceByStatus || {}).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">لا توجد أجهزة</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming appointments */}
      <div className="bg-white rounded-xl shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">المواعيد القادمة</h2>
          <button onClick={() => navigate('/appointments')} className="text-primary-600 text-sm font-medium hover:text-primary-700 inline-flex items-center gap-1">
            عرض الكل <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        {stats.recentAppointments.length === 0 ? (
          <EmptyState message="لا توجد مواعيد قادمة" icon={CalendarDays} />
        ) : (
          <div className="divide-y divide-gray-50">
            {stats.recentAppointments.map((appt) => (
              <div key={appt.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/patients/${appt.patient.id}`)}>
                <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">
                  {appt.patient.fullName?.split(' ').slice(0, 2).map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{appt.patient.fullName}</p>
                  <p className="text-xs text-gray-400">{appt.doctor?.fullName} • {formatDate(appt.date)}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(appt.startTime)}
                </div>
                <span className={`badge ${getStatusColor(appt.status)}`}>{getStatusLabel(appt.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today follow-ups */}
      <div className="bg-white rounded-xl shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">
            متابعات اليوم
            <span className="ms-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
              <PhoneCall className="w-3 h-3" />
              {followups.stats?.today || 0} اليوم
            </span>
          </h2>
          <button onClick={() => navigate('/follow-ups')} className="text-primary-600 text-sm font-medium hover:text-primary-700 inline-flex items-center gap-1">
            عرض الكل <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        {followups.list.length === 0 ? (
          <EmptyState message="لا توجد متابعات قيد الانتظار" icon={CheckCircle2} />
        ) : (
          <div className="divide-y divide-gray-50">
            {followups.list.map((f) => (
              <div key={f.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/patients/${f.patient.id}`)}>
                <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                  {f.patient.fullName?.split(' ').slice(0, 2).map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{f.patient.fullName}</p>
                  <p className="text-xs text-gray-400">{f.assignedTo?.fullName || 'غير محدد'} • {formatDate(f.date)}</p>
                </div>
                {f.type && <span className="badge bg-indigo-100 text-indigo-700">{f.type}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
