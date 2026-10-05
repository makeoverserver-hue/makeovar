import { useState, useEffect, useCallback } from 'react';
import { Banknote, Plus, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, Pagination, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal, ConfirmDialog } from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/format';

const CATEGORIES = ['مستلزمات', 'رواتب', 'إيجار', 'فواتير وخدمات', 'تسويق', 'صيانة', 'أخرى'];
const METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'OTHER'];
const METHOD_LABELS = { CASH: 'نقدي', CARD: 'بطاقة', BANK_TRANSFER: 'تحويل', ONLINE: 'أونلاين', OTHER: 'أخرى' };

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, limit: 20, categories: [] });
  const [stats, setStats] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { showToast } = useToast();

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: meta.limit };
      if (search) params.search = search;
      if (category) params.category = category;
      const { data } = await api.get('/expenses', { params });
      setExpenses(data.data);
      setMeta((prev) => ({ ...prev, ...data.meta }));
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
    finally { setLoading(false); }
  }, [page, search, category]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { api.get('/expenses/stats').then(({ data }) => setStats(data.data)).catch(() => {}); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await api.put(`/expenses/${form.id}`, form);
        showToast('تم تحديث المصروف', 'success');
      } else {
        await api.post('/expenses', form);
        showToast('تم تسجيل المصروف', 'success');
      }
      setShowModal(false);
      setForm({});
      fetchExpenses();
      api.get('/expenses/stats').then(({ data }) => setStats(data.data));
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/expenses/${confirmDelete.id}`); showToast('تم حذف المصروف', 'success'); setConfirmDelete(null); fetchExpenses(); } catch (e) { showToast(getErrorMessage(e), 'error'); }
  };

  const update = (f) => (e) => setForm((p) => ({ ...p, [f]: f === 'amount' ? parseFloat(e.target.value) || 0 : e.target.value }));
  const exportCsv = async () => { try { const { data } = await api.get('/exports/expenses.csv', { responseType: 'blob' }); const u = URL.createObjectURL(new Blob([data])); const a = document.createElement('a'); a.href = u; a.download = 'expenses.csv'; a.click(); URL.revokeObjectURL(u); } catch (e) { showToast(getErrorMessage(e), 'error'); } };

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الإيرادات', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-green-600' },
            { label: 'إجمالي المصروفات', value: formatCurrency(stats.totalExpenses), icon: TrendingDown, color: 'text-red-600' },
            { label: 'صافي الربح/الخسارة', value: formatCurrency(stats.net), icon: DollarSign, color: stats.net >= 0 ? 'text-green-600' : 'text-red-600' },
            { label: 'عدد المصروفات', value: stats.expensesCount, icon: Banknote, color: 'text-blue-600' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg bg-gray-50 ${s.color}`}><s.icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-bold text-gray-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المصروفات</h1>
          <p className="text-gray-500 text-sm mt-1">{meta.total} مصروف</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportCsv}>تصدير Excel</button>
          <button className="btn-primary" onClick={() => { setForm({}); setShowModal(true); }}><Plus className="w-4 h-4" /> مصروف جديد</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="بحث..." className="w-full sm:w-64" />
        <div className="w-44">
          <Select value={category} onChange={(e) => { setPage(1); setCategory(e.target.value); }} options={CATEGORIES} placeholder="كل التصنيفات" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : expenses.length === 0 ? <EmptyState message="لا توجد مصروفات" icon={Banknote} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">التصنيف</th>
                    <th className="table-header">الوصف</th>
                    <th className="table-header">المبلغ</th>
                    <th className="table-header">التاريخ</th>
                    <th className="table-header">طريقة الدفع</th>
                    <th className="table-header">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="table-cell"><span className="badge bg-red-50 text-red-700">{e.category}</span></td>
                      <td className="table-cell text-gray-600">{e.description || '—'}</td>
                      <td className="table-cell font-semibold text-red-700">{formatCurrency(e.amount)}</td>
                      <td className="table-cell">{formatDate(e.date)}</td>
                      <td className="table-cell text-sm text-gray-500">{METHOD_LABELS[e.paymentMethod] || e.paymentMethod}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg" onClick={() => { setForm(e); setShowModal(true); }}><Pencil className="w-4 h-4" /></button>
                          <button className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => setConfirmDelete(e)}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} total={meta.total} limit={meta.limit} />
          </>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={form.id ? 'تعديل مصروف' : 'مصروف جديد'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">التصنيف *</label>
              <select className="input" value={form.category || 'مستلزمات'} onChange={update('category')} required>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">المبلغ *</label>
              <input className="input" type="number" step="0.01" value={form.amount || ''} onChange={update('amount')} required />
            </div>
            <div>
              <label className="label">التاريخ</label>
              <input className="input" type="datetime-local" value={form.date ? new Date(form.date).toISOString().slice(0, 16) : ''} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            </div>
            <div>
              <label className="label">طريقة الدفع</label>
              <select className="input" value={form.paymentMethod || 'CASH'} onChange={update('paymentMethod')}>
                {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">الوصف</label>
              <input className="input" value={form.description || ''} onChange={update('description')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حفظ</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} message={`هل أنت متأكد من حذف مصروف "${confirmDelete?.description || confirmDelete?.category}"؟`} />
    </div>
  );
}