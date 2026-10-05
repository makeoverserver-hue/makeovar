import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, CalendarRange, BarChart3, Wallet, Receipt, TrendingUp, TrendingDown, Users, AlertCircle } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { LoadingSpinner, EmptyState } from '../components/common';
import { formatCurrency, formatNumber, formatDate } from '../utils/format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, PieChart, Pie,
} from 'recharts';

const TABS = [
  { id: 'daily', label: 'يومي', icon: CalendarDays },
  { id: 'monthly', label: 'شهري', icon: CalendarRange },
  { id: 'yearly', label: 'سنوي', icon: BarChart3 },
  { id: 'cashflow', label: 'التدفق النقدي', icon: Wallet },
  { id: 'ar', label: 'المستحقات', icon: Receipt },
  { id: 'installments', label: 'الأقساط', icon: CalendarRange },
  { id: 'commissions', label: 'العمولات', icon: TrendingUp },
];

const METHOD_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

function StatCard({ label, value, color = 'text-gray-800', icon: Icon, sub }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg bg-gray-50 ${color}`}>{Icon && <Icon className="w-5 h-5" />}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-800 truncate">{value}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function NetBadge({ net }) {
  const positive = net >= 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
      {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {formatCurrency(net)}
    </span>
  );
}

export default function Accounting() {
  const [tab, setTab] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [startYear, setStartYear] = useState(new Date().getFullYear() - 2);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { showToast } = useToast();

  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [yearly, setYearly] = useState(null);
  const [cashflow, setCashflow] = useState(null);
  const [ar, setAr] = useState(null);
  const [installments, setInstallments] = useState(null);
  const [commissions, setCommissions] = useState(null);

  const load = useCallback(async (y) => {
    setLoading(true);
    try {
      const [d, m, yy, cf, a, ins, cm] = await Promise.all([
        api.get('/accounting/pnl/daily', { params: { date } }).then(r => r.data.data),
        api.get('/accounting/pnl/monthly', { params: { year: y } }).then(r => r.data.data),
        api.get('/accounting/pnl/yearly', { params: { startYear: y - 2, endYear: y } }).then(r => r.data.data),
        api.get('/accounting/cash-flow', { params: { period: 'year' } }).then(r => r.data.data),
        api.get('/accounting/ar-aging', { params: {} }).then(r => r.data.data),
        api.get('/accounting/installments', { params: {} }).then(r => r.data.data),
        api.get('/accounting/commissions', { params: {} }).then(r => r.data.data),
      ]);
      setDaily(d); setMonthly(m); setYearly(yy); setCashflow(cf); setAr(a); setInstallments(ins); setCommissions(cm);
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(year); }, [load, year]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Wallet className="w-6 h-6 text-green-600" /> المنظومة الحسابية</h1>
          <p className="text-gray-500 text-sm mt-1">تقارير الإيرادات اليومية والشهرية والسنوية والمستحقات</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={tab === 'monthly' || tab === 'cashflow' ? String(year) : ''} onChange={(e) => setYear(Number(e.target.value))} disabled={tab !== 'monthly' && tab !== 'cashflow'}>
            {[year - 2, year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {tab === 'daily' && (
            <input className="input w-auto" type="date" value={date} onChange={(e) => { setDate(e.target.value); }} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition border-b-2 ${tab === t.id ? 'border-green-600 text-green-700 bg-green-50' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-5">
          {/* ── DAILY ── */}
          {tab === 'daily' && daily && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="إيرادات اليوم" value={formatCurrency(daily.totals.revenue)} color="text-green-600" icon={TrendingUp} />
                <StatCard label="مصروفات اليوم" value={formatCurrency(daily.totals.expenses)} color="text-red-600" icon={TrendingDown} />
                <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-gray-50 text-blue-600"><Receipt className="w-5 h-5" /></div>
                  <div><p className="text-xs text-gray-500">صافي اليوم</p><NetBadge net={daily.totals.net} /></div>
                </div>
                <StatCard label="عمليات الدفع" value={formatNumber(daily.payments.length)} color="text-purple-600" icon={Users} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-card p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">الإيرادات حسب طريقة الدفع</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={daily.revenueByMethod} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
                          {daily.revenueByMethod.map((_, i) => <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-card overflow-hidden">
                  <h3 className="font-semibold text-gray-800 p-4 border-b">مدفوعات اليوم</h3>
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0"><tr><th className="table-header">المريض</th><th className="table-header">ف</th><th className="table-header">المبلغ</th><th className="table-header">طريقة</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {daily.payments.map(p => <tr key={p.id} className="hover:bg-gray-50"><td className="table-cell">{p.patient}</td><td className="table-cell text-xs text-gray-400 font-mono">{p.invoiceNo}</td><td className="table-cell font-semibold text-green-700">{formatCurrency(p.amount)}</td><td className="table-cell text-xs">{p.methodLabel}</td></tr>)}
                        {daily.payments.length === 0 && <tr><td className="table-cell text-center text-gray-400" colSpan="4">لا مدفوعات</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-card overflow-hidden">
                <h3 className="font-semibold text-gray-800 p-4 border-b">مصروفات اليوم</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr><th className="table-header">التصنيف</th><th className="table-header">الوصف</th><th className="table-header">المبلغ</th><th className="table-header">طريقة</th><th className="table-header">الفرع</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {daily.expenses.map(e => <tr key={e.id}><td className="table-cell">{e.category}</td><td className="table-cell text-sm text-gray-600">{e.description || '—'}</td><td className="table-cell font-semibold text-red-600">{formatCurrency(e.amount)}</td><td className="table-cell text-xs">{e.paymentMethod}</td><td className="table-cell text-sm text-gray-600">{e.branch}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── MONTHLY ── */}
          {tab === 'monthly' && monthly && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="إيرادات السنة" value={formatCurrency(monthly.totals.revenue)} color="text-green-600" icon={TrendingUp} />
                <StatCard label="مصروفات السنة" value={formatCurrency(monthly.totals.expenses)} color="text-red-600" icon={TrendingDown} />
                <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3"><div className="p-2.5 rounded-lg bg-gray-50 text-blue-600"><Wallet className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">صافي {year}</p><NetBadge net={monthly.totals.net} /></div></div>
                <StatCard label="أشهر بربح" value={formatNumber(monthly.months.filter(m => m.net >= 0).length)} color="text-purple-600" icon={BarChart3} />
              </div>
              <div className="bg-white rounded-xl shadow-card p-4">
                <h3 className="font-semibold text-gray-800 mb-3">الإيرادات مقابل المصروفات — شهرياً {year}</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly.months} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" name="الإيرادات" fill="#10b981" />
                      <Bar dataKey="expenses" name="المصروفات" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr><th className="table-header">الشهر</th><th className="table-header">الإيرادات</th><th className="table-header">المصروفات</th><th className="table-header">الصافي</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthly.months.map(m => <tr key={m.month} className="hover:bg-gray-50"><td className="table-cell font-medium">{m.label}</td><td className="table-cell text-green-700">{formatCurrency(m.revenue)}</td><td className="table-cell text-red-600">{formatCurrency(m.expenses)}</td><td className="table-cell"><NetBadge net={m.net} /></td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── YEARLY ── */}
          {tab === 'yearly' && yearly && (
            <>
              <div className="bg-white rounded-xl shadow-card p-4">
                <h3 className="font-semibold text-gray-800 mb-3">إيرادات ومصروفات سنوية</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearly.years} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" name="الإيرادات" fill="#10b981" />
                      <Bar dataKey="expenses" name="المصروفات" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {yearly.years.map(y => (
                  <div key={y.year} className="bg-white rounded-xl shadow-card p-4 space-y-2">
                    <h3 className="font-bold text-gray-800">{y.year}</h3>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">الإيرادات</span><span className="text-green-700 font-semibold">{formatCurrency(y.revenue)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">المصروفات</span><span className="text-red-600 font-semibold">{formatCurrency(y.expenses)}</span></div>
                    <div className="flex justify-between text-sm border-t pt-2"><span className="text-gray-500">الصافي</span><NetBadge net={y.net} /></div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── CASHFLOW ── */}
          {tab === 'cashflow' && cashflow && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="تدفقات داخلة" value={formatCurrency(cashflow.totals.inflows)} color="text-green-600" icon={TrendingUp} />
                <StatCard label="تدفقات خارجة" value={formatCurrency(cashflow.totals.outflows)} color="text-red-600" icon={TrendingDown} />
                <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3"><div className="p-2.5 rounded-lg bg-gray-50 text-blue-600"><Wallet className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">صافي التدفق</p><NetBadge net={cashflow.totals.net} /></div></div>
              </div>
              <div className="bg-white rounded-xl shadow-card p-4">
                <h3 className="font-semibold text-gray-800 mb-3">التدفق النقدي الشهري</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashflow.monthly} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="inflows" name="داخل" fill="#10b981" />
                      <Bar dataKey="outflows" name="خارج" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* ── AR / RECEIVABLES (المستحقات) ── */}
          {tab === 'ar' && ar && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="إجمالي المستحقات" value={formatCurrency(ar.totals.outstanding)} color="text-amber-600" icon={AlertCircle} sub={`${formatNumber(ar.totals.invoiceCount)} فاتورة غير مسددة`} />
                {ar.brackets.filter(b => b.amount > 0).map(b => (
                  <StatCard key={b.label} label={b.label} value={formatCurrency(b.amount)} color="text-red-600" icon={Receipt} sub={`${b.count} فاتورة`} />
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-card p-4">
                <h3 className="font-semibold text-gray-800 mb-3">توزيع المستحقات حسب تاريخ الاستحقاق</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ar.brackets} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="amount" name="المستحق" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {ar.brackets.map(bracket => bracket.items.length > 0 && (
                <div key={bracket.label} className="bg-white rounded-xl shadow-card overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{bracket.label}</h3>
                    <span className="text-sm font-bold text-amber-700">{formatCurrency(bracket.amount)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50"><tr><th className="table-header">المريض</th><th className="table-header">الجوال</th><th className="table-header">الفترة</th><th className="table-header">الإجمالي</th><th className="table-header">المدفوع</th><th className="table-header">المتبقي</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {bracket.items.map(it => <tr key={it.id} className="hover:bg-gray-50"><td className="table-cell font-medium">{it.patient.fullName}</td><td className="table-cell text-sm text-gray-600" dir="ltr">{it.patient.phone || '—'}</td><td className="table-cell text-sm text-gray-500">{it.ageDays} يوم</td><td className="table-cell">{formatCurrency(it.total)}</td><td className="table-cell text-green-700">{formatCurrency(it.paidAmount)}</td><td className="table-cell font-semibold text-red-600">{formatCurrency(it.dueAmount)}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {ar.brackets.every(b => b.items.length === 0) && <EmptyState message="لا توجد مستحقات — كل الفواتير مسددة" icon={Receipt} />}
            </>
          )}

          {/* ── INSTALLMENTS (الأقساط) ── */}
          {tab === 'installments' && installments && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="أقساط معلّقة" value={formatCurrency(installments.totals.pending)} color="text-amber-600" icon={CalendarRange} sub={`${installments.totals.count} قسط`} />
                <StatCard label="أقساط متأخرة" value={formatCurrency(installments.totals.overdue)} color="text-red-600" icon={AlertCircle} />
                <StatCard label="أقساط قادمة" value={formatCurrency(installments.totals.upcoming)} color="text-green-600" icon={CalendarDays} />
                <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3"><div className="p-2.5 rounded-lg bg-gray-50 text-blue-600"><Receipt className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">التزامات الفواتير</p><p className="text-lg font-bold text-gray-800">{formatCurrency(installments.totals.pending)}</p></div></div>
              </div>

              {installments.overdue.length > 0 && (
                <div className="bg-white rounded-xl shadow-card overflow-hidden">
                  <h3 className="font-semibold text-red-700 p-4 border-b">أقساط متأخرة المستحق</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50"><tr><th className="table-header">المريض</th><th className="table-header">فاتورة</th><th className="table-header">المبلغ</th><th className="table-header">المستحق</th><th className="table-header">تأخر (يوم)</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {installments.overdue.map(i => <tr key={i.id} className="hover:bg-gray-50"><td className="table-cell font-medium">{i.patient}</td><td className="table-cell text-xs text-gray-500 font-mono">{i.invoiceNumber}</td><td className="table-cell font-semibold text-red-600">{formatCurrency(i.amount)}</td><td className="table-cell">{formatDate(i.dueDate)}</td><td className="table-cell text-red-600 font-semibold">{Math.abs(i.daysRemaining)}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-card overflow-hidden">
                <h3 className="font-semibold text-gray-800 p-4 border-b">الأقساط القادمة</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr><th className="table-header">المريض</th><th className="table-header">فاتورة</th><th className="table-header">المبلغ</th><th className="table-header">المستحق</th><th className="table-header">متبقي (يوم)</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {installments.upcoming.map(i => <tr key={i.id} className="hover:bg-gray-50"><td className="table-cell font-medium">{i.patient}</td><td className="table-cell text-xs text-gray-500 font-mono">{i.invoiceNumber}</td><td className="table-cell font-semibold text-gray-800">{formatCurrency(i.amount)}</td><td className="table-cell">{formatDate(i.dueDate)}</td><td className="table-cell text-amber-600 font-semibold">{i.daysRemaining}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── COMMISSIONS (العمولات) ── */}
          {tab === 'commissions' && commissions && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="إجمالي العمولات المعلقة" value={formatCurrency(commissions.totals.owed)} color="text-purple-600" icon={TrendingUp} sub={`${commissions.totals.recordCount} سجل`} />
                <StatCard label="عدد الأطباء" value={formatNumber(commissions.byDoctor.length)} color="text-blue-600" icon={Users} />
                <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3"><div className="p-2.5 rounded-lg bg-gray-50 text-amber-600"><Receipt className="w-5 h-5" /></div><div><p className="text-xs text-gray-500">مستحقات الأطباء</p><p className="text-lg font-bold text-gray-800">{formatCurrency(commissions.totals.owed)}</p></div></div>
              </div>
              {commissions.byDoctor.length === 0 ? (
                <EmptyState message="لا توجد عمولات معلّقة" icon={Users} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {commissions.byDoctor.map(d => (
                    <div key={d.doctor.id} className="bg-white rounded-xl shadow-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-800">{d.doctor.fullName}</span>
                        <span className="font-bold text-purple-700">{formatCurrency(d.totalOwed)}</span>
                      </div>
                      <div className="text-xs text-gray-400 mb-3">{d.recordCount} عملية معلّقة</div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {d.records.map(rec => (
                          <div key={rec.id} className="flex justify-between text-sm border-t border-gray-50 pt-1">
                            <span className="text-gray-500">{formatDate(rec.createdAt)} — أساس {formatCurrency(rec.amountBasis)} × {formatNumber(rec.rate)}%</span>
                            <span className="font-medium">{formatCurrency(rec.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}