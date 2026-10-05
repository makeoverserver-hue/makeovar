import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, CheckCircle, Circle } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal } from '../components/Modal';
import { formatDate, getStatusColor, getStatusLabel, getInitials } from '../utils/format';

export default function TreatmentPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', items: [] });
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const { showToast } = useToast();

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.patientId = search;
      if (status) params.status = status;
      const { data } = await api.get('/plans', { params });
      setPlans(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);
  useEffect(() => {
    api.get('/patients', { params: { limit: 100 } }).then(({ data }) => setPatients(data.data)).catch(() => {});
    api.get('/services').then(({ data }) => setServices(data.data)).catch(() => {});
  }, []);

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { serviceId: '', sessionsTotal: 1, intervalDays: 7 }] }));
  const updateItem = (idx, field, value) => setForm((prev) => {
    const items = [...prev.items];
    items[idx] = { ...items[idx], [field]: value };
    return { ...prev, items };
  });
  const removeItem = (idx) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/plans', {
        ...form,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : new Date().toISOString(),
      });
      showToast('تم إنشاء خطة العلاج', 'success');
      setShowModal(false);
      setForm({ title: '', items: [] });
      fetchPlans();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const updatePlanStatus = async (id, newStatus) => {
    try {
      await api.put(`/plans/${id}`, { status: newStatus });
      showToast('تم تحديث حالة الخطة', 'success');
      fetchPlans();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">خطط العلاج</h1>
          <p className="text-gray-500 text-sm mt-1">{plans.length} خطة</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> خطة جديدة
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث..." />
        <div className="w-44">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} options={['active', 'completed', 'cancelled'].map(s => ({ value: s, label: getStatusLabel(s) }))} placeholder="كل الحالات" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full"><LoadingSpinner /></div> : plans.length === 0 ? <div className="col-span-full"><EmptyState message="لا توجد خطط علاج" icon={FileText} /></div> : plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-xl shadow-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-primary-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{plan.title}</h3>
                  <p className="text-xs text-gray-400">{plan.patient.fullName}</p>
                </div>
              </div>
              <span className={`badge ${getStatusColor(plan.status.toUpperCase())}`}>{getStatusLabel(plan.status)}</span>
            </div>

            <div className="space-y-2 mb-3">
              {plan.items.map((item) => {
                const progress = item.sessionsTotal > 0 ? (item.sessionsDone / item.sessionsTotal) * 100 : 0;
                return (
                  <div key={item.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{item.service.name}</span>
                      <span className="text-gray-400">{item.sessionsDone}/{item.sessionsTotal} جلسة</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">{formatDate(plan.startDate)}</span>
              {plan.status === 'active' && (
                <button className="btn-secondary py-1 px-2 text-xs" onClick={() => updatePlanStatus(plan.id, 'completed')}>
                  <CheckCircle className="w-3.5 h-3.5" /> إكمال
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="خطة علاج جديدة" size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">المريض *</label>
              <select className="input" value={form.patientId || ''} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
                <option value="">اختر المريض</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">عنوان الخطة *</label>
              <input className="input" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="label">تاريخ البداية</label>
              <input className="input" type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">تاريخ النهاية</label>
              <input className="input" type="date" value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">وصف الخطة</label>
              <textarea className="input" rows="2" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">الخدمات والجلسات</h4>
              <button type="button" className="btn-secondary py-1 px-2 text-xs" onClick={addItem}><Plus className="w-3.5 h-3.5" /> إضافة خدمة</button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <select className="input" value={item.serviceId} onChange={(e) => updateItem(idx, 'serviceId', e.target.value)} required>
                      <option value="">الخدمة</option>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input className="input" type="number" placeholder="جلسات" value={item.sessionsTotal} onChange={(e) => updateItem(idx, 'sessionsTotal', parseInt(e.target.value))} />
                  </div>
                  <div className="col-span-2">
                    <input className="input" type="number" placeholder="أيام" value={item.intervalDays} onChange={(e) => updateItem(idx, 'intervalDays', parseInt(e.target.value))} />
                  </div>
                  <div className="col-span-3">
                    <input className="input" type="number" placeholder="السعر (اختياري)" value={item.price || ''} onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value))} />
                  </div>
                  <div className="col-span-1">
                    <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => removeItem(idx)}>×</button>
                  </div>
                </div>
              ))}
              {form.items.length === 0 && <p className="text-sm text-gray-400 text-center py-3">أضف خدمات الخطة</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حفظ الخطة</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
