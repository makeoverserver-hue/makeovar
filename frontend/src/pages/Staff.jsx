import { useState, useEffect, useCallback } from 'react';
import { Users2, Plus, Pencil, Wallet, TrendingUp } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal } from '../components/Modal';
import { formatDate, formatCurrency, getInitials } from '../utils/format';
import { ROLE_LABELS } from '../context/AuthContext';

const ROLES = ['RECEPTIONIST', 'DOCTOR', 'NURSE', 'TECHNICIAN', 'MANAGER', 'ADMIN'];

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('staff');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({});
  const { showToast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search };
      if (role) params.role = role;
      const [staffRes, commRes] = await Promise.all([
        api.get('/users', { params }),
        api.get('/users/commissions'),
      ]);
      setStaff(staffRes.data.data);
      setCommissions(commRes.data.data.commissions);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, role]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await api.put(`/users/${form.id}`, form);
        showToast('تم تحديث البيانات', 'success');
      } else {
        await api.post('/users', form);
        showToast('تمت إضافة الموظف', 'success');
      }
      setShowModal(false);
      setForm({});
      fetchAll();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const update = (f) => (e) => setForm((prev) => ({ ...prev, [f]: f === 'commissionRate' || f === 'salary' ? parseFloat(e.target.value) : e.target.value }));

  const pendingTotal = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الموظفين والعمولات</h1>
          <p className="text-gray-500 text-sm mt-1">{staff.length} موظف</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({}); setShowModal(true); }}><Plus className="w-4 h-4" /> إضافة موظف</button>
      </div>

      <div className="flex border-b border-gray-200 gap-1">
        {[
          { id: 'staff', label: `الموظفين (${staff.length})` },
          { id: 'commissions', label: `العمولات (${commissions.length}) • ${formatCurrency(pendingTotal)} معلقة` },
        ].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${activeTab === t.id ? 'text-primary-600 border-primary-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'staff' && (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث..." className="w-full sm:w-64" />
            <div className="w-44"><Select value={role} onChange={(e) => setRole(e.target.value)} options={ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] }))} placeholder="كل الأدوار" /></div>
          </div>
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            {loading ? <LoadingSpinner /> : staff.length === 0 ? <EmptyState message="لا يوجد موظفين" icon={Users2} /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">الموظف</th>
                      <th className="table-header">الدور</th>
                      <th className="table-header">الهاتف</th>
                      <th className="table-header">نسبة العمولة</th>
                      <th className="table-header">الراتب</th>
                      <th className="table-header">الحالة</th>
                      <th className="table-header">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staff.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">{getInitials(u.fullName)}</div>
                            <div>
                              <span className="font-semibold text-gray-800">{u.fullName}</span>
                              <div className="text-xs text-gray-400">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell"><span className="badge bg-blue-50 text-blue-700">{ROLE_LABELS[u.role] || u.role}</span></td>
                        <td className="table-cell" dir="ltr">{u.phone || '—'}</td>
                        <td className="table-cell">{u.commissionRate || 0}%</td>
                        <td className="table-cell">{formatCurrency(u.salary || 0)}</td>
                        <td className="table-cell"><span className={`badge ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{u.isActive ? 'نشط' : 'غير نشط'}</span></td>
                        <td className="table-cell">
                          <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg" onClick={() => { setForm(u); setShowModal(true); }}><Pencil className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'commissions' && (
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          {commissions.length === 0 ? <EmptyState message="لا توجد عمولات" icon={Wallet} /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">الموظف</th>
                    <th className="table-header">الأساس</th>
                    <th className="table-header">النسبة</th>
                    <th className="table-header">المبلغ</th>
                    <th className="table-header">الحالة</th>
                    <th className="table-header">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="table-cell font-semibold text-gray-800">{c.user?.fullName}</td>
                      <td className="table-cell">{formatCurrency(c.amountBasis)}</td>
                      <td className="table-cell">{c.rate}%</td>
                      <td className="table-cell font-semibold text-green-600">{formatCurrency(c.amount)}</td>
                      <td className="table-cell"><span className={`badge ${c.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{c.status === 'paid' ? 'مدفوعة' : 'معلقة'}</span></td>
                      <td className="table-cell">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={form.id ? 'تعديل موظف' : 'إضافة موظف'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الاسم *</label>
              <input className="input" value={form.fullName || ''} onChange={update('fullName')} required />
            </div>
            <div>
              <label className="label">الدور *</label>
              <select className="input" value={form.role || 'RECEPTIONIST'} onChange={update('role')} required disabled={form.id}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">البريد الإلكتروني *{form.id && ' (ثابت)'}</label>
              <input className="input" type="email" value={form.email || ''} onChange={update('email')} required disabled={!!form.id} dir="ltr" />
            </div>
            {!form.id && (
              <div>
                <label className="label">كلمة المرور *</label>
                <input className="input" type="password" value={form.password || ''} onChange={update('password')} required minLength={6} />
              </div>
            )}
            <div>
              <label className="label">الهاتف</label>
              <input className="input" value={form.phone || ''} onChange={update('phone')} dir="ltr" />
            </div>
            <div>
              <label className="label">نسبة العمولة %</label>
              <input className="input" type="number" value={form.commissionRate ?? 0} onChange={update('commissionRate')} />
            </div>
            <div>
              <label className="label">الراتب</label>
              <input className="input" type="number" value={form.salary ?? 0} onChange={update('salary')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حفظ</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
