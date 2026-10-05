import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Pencil, MapPin, Phone, Users2 } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { LoadingSpinner, EmptyState } from '../components/common';
import { Modal } from '../components/Modal';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({});
  const { showToast } = useToast();

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/branches');
      setBranches(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBranches(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await api.put(`/branches/${form.id}`, form);
        showToast('تم تحديث الفرع', 'success');
      } else {
        await api.post('/branches', form);
        showToast('تمت إضافة الفرع', 'success');
      }
      setShowModal(false);
      setForm({});
      fetchBranches();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const update = (f) => (e) => setForm((prev) => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الفروع</h1>
          <p className="text-gray-500 text-sm mt-1">{branches.length} فرع</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({}); setShowModal(true); }}><Plus className="w-4 h-4" /> فرع جديد</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full"><LoadingSpinner /></div> : branches.length === 0 ? <div className="col-span-full"><EmptyState message="لا توجد فروع" icon={Building2} /></div> : branches.map((b) => (
          <div key={b.id} className="bg-white rounded-xl shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-primary-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{b.name}</h3>
                  <span className={`badge ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{b.isActive ? 'نشط' : 'غير نشط'}</span>
                </div>
              </div>
              <button className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg" onClick={() => { setForm(b); setShowModal(true); }}><Pencil className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              {b.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> {b.address}</div>}
              {b.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> <span dir="ltr">{b.phone}</span></div>}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100 text-center">
              <div><div className="font-bold text-gray-900">{b._count?.patients || 0}</div><div className="text-[10px] text-gray-400">مرضى</div></div>
              <div><div className="font-bold text-gray-900">{b._count?.appointments || 0}</div><div className="text-[10px] text-gray-400">مواعيد</div></div>
              <div><div className="font-bold text-gray-900">{b._count?.devices || 0}</div><div className="text-[10px] text-gray-400">أجهزة</div></div>
              <div><div className="font-bold text-gray-900">{b._count?.users || 0}</div><div className="text-[10px] text-gray-400">موظفين</div></div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={form.id ? 'تعديل فرع' : 'فرع جديد'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">الاسم *</label>
              <input className="input" value={form.name || ''} onChange={update('name')} required />
            </div>
            <div>
              <label className="label">الهاتف</label>
              <input className="input" value={form.phone || ''} onChange={update('phone')} dir="ltr" />
            </div>
            <div className="md:col-span-2">
              <label className="label">العنوان</label>
              <input className="input" value={form.address || ''} onChange={update('address')} />
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
