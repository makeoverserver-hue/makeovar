import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, CalendarDays, Package2, Users2, FileDown } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { LoadingSpinner, EmptyState } from '../components/common';
import { formatCurrency, formatDate, formatTime, getStatusColor, getStatusLabel, toLocalDateStr, getPaymentMethodLabel } from '../utils/format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#db2777', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('revenue');
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(null);
  const [treatment, setTreatment] = useState(null);
  const { showToast } = useToast();
  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const todayStr = toLocalDateStr(today);

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports/revenue', { params: { startDate: monthStart, endDate: todayStr } });
      setRevenue(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTreatment = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports/treatment', { params: { startDate: monthStart, endDate: todayStr } });
      setTreatment(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'revenue') fetchRevenue();
    if (activeTab === 'treatment') fetchTreatment();
  }, [activeTab]);

  const tabs = [
    { id: 'revenue', label: 'الإيرادات', icon: TrendingUp },
    { id: 'treatment', label: 'العلاجات', icon: BarChart3 },
    { id: 'inventory', label: 'المخزون', icon: Package2 },
  ];

  const exportActive = async () => {
    const map = { revenue: 'revenue.csv', treatment: 'sessions.csv', inventory: 'inventory.csv' };
    const name = map[activeTab];
    if (!name) return;
    try {
      const params = activeTab === 'revenue' || activeTab === 'treatment' ? { startDate: monthStart, endDate: todayStr } : {};
      const { data } = await api.get(`/exports/${name}`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير</h1>
          <p className="text-gray-500 text-sm mt-1">من {formatDate(monthStart)} إلى {formatDate(todayStr)}</p>
        </div>
        <button className="btn-secondary" onClick={exportActive}><FileDown className="w-4 h-4" /> تصدير</button>
      </div>

      <div className="flex border-b border-gray-200 gap-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 ${activeTab === t.id ? 'text-primary-600 border-primary-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'revenue' && (
        <>
          {loading ? <LoadingSpinner /> : !revenue ? <EmptyState message="لا توجد بيانات" /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'إجمالي الإيرادات', value: formatCurrency(revenue.totals.amount), color: 'text-green-600' },
                  { label: 'عدد الدفعات', value: revenue.totals.count, color: 'text-blue-600' },
                  { label: 'عدد العمليات', value: revenue.invoices?.count ?? revenue.byMethod.reduce((s, m) => s + m._count, 0), color: 'text-primary-600' },
                  { label: 'قيمة الفواتير', value: formatCurrency(revenue.invoices?.billed ?? 0), color: 'text-amber-600' },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl shadow-card p-5">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-sm text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {revenue.byMethod.length > 0 && (
                <div className="bg-white rounded-xl shadow-card p-6">
                  <h2 className="font-bold text-gray-900 mb-4">توزيع طرق الدفع</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={revenue.byMethod} dataKey="_sum.amount" nameKey="method" cx="50%" cy="50%" outerRadius={80} label>
                          {revenue.byMethod.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(name) => `طريقة: ${name}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">سجل الدفعات</h2>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="table-header">التاريخ</th>
                        <th className="table-header">المريض</th>
                        <th className="table-header">المبلغ</th>
                        <th className="table-header">الطريقة</th>
                        <th className="table-header">استلم بواسطة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {revenue.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="table-cell">{formatDate(p.createdAt)}</td>
                          <td className="table-cell font-semibold text-gray-800">{p.invoice?.patient?.fullName}</td>
                          <td className="table-cell font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                          <td className="table-cell">{getPaymentMethodLabel(p.method)}</td>
                          <td className="table-cell">{p.receivedBy?.fullName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'treatment' && (
        <>
          {loading ? <LoadingSpinner /> : !treatment ? <EmptyState message="لا توجد بيانات" /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'إجمالي الجلسات', value: treatment.totalSessions },
                  { label: 'الجلسات المكتملة', value: treatment.completedSessions },
                  { label: 'عدد الخدمات', value: treatment.byService.length },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl shadow-card p-5">
                    <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                    <div className="text-sm text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {treatment.byService.length > 0 && (
                <div className="bg-white rounded-xl shadow-card p-6">
                  <h2 className="font-bold text-gray-900 mb-4">الجلسات حسب الخدمة</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={treatment.byService}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#db2777" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">تفاصيل الجلسات</h2>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="table-header">المريض</th>
                        <th className="table-header">الخدمة</th>
                        <th className="table-header">الطبيب</th>
                        <th className="table-header">التاريخ</th>
                        <th className="table-header">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {treatment.sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="table-cell font-semibold text-gray-800">{s.patient.fullName}</td>
                          <td className="table-cell">{s.service?.name}</td>
                          <td className="table-cell">{s.doctor?.fullName || '—'}</td>
                          <td className="table-cell">{formatDate(s.completedDate || s.scheduledDate)}</td>
                          <td className="table-cell"><span className={`badge ${getStatusColor(s.status)}`}>{getStatusLabel(s.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'inventory' && (
        <ReportInventoryReport />
      )}
    </div>
  );
}

function ReportInventoryReport() {
  const [data, setData] = useState(null);
  const { showToast } = useToast();
  useEffect(() => {
    api.get('/reports/inventory').then(({ data: d }) => setData(d.data)).catch((e) => showToast(getErrorMessage(e), 'error'));
  }, []);
  if (!data) return <LoadingSpinner />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي العناصر', value: data.totalItems },
          { label: 'قيمة المخزون', value: formatCurrency(data.totalValue) },
          { label: 'منخفض', value: data.lowStockCount },
          { label: 'نفد', value: data.outOfStockCount },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-card p-5">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-card p-6">
        <h2 className="font-bold text-gray-900 mb-4">آخر الحركات</h2>
        <div className="space-y-2">
          {data.recentMovements.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
              <div>
                <span className="font-semibold text-gray-800">{m.item?.name}</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className={`badge ${m.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.type === 'in' ? 'إدخال' : 'إخراج'}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{m.quantity}</span>
                <span className="text-gray-400 text-xs">{formatDate(m.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
