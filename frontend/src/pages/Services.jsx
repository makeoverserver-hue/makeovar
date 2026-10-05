import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Plus, Pencil, Trash2, Upload } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal, ConfirmDialog } from '../components/Modal';
import ImportModal from '../components/ImportModal';
import { formatCurrency } from '../utils/format';

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const { data } = await api.get('/services', { params });
      setServices(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const categories = [...new Set(services.map(s => s.category).filter(Boolean))];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (form.id) {
        await api.put(`/services/${form.id}`, form);
        showToast('تم تحديث الخدمة', 'success');
      } else {
        await api.post('/services', form);
        showToast('تمت إضافة الخدمة', 'success');
      }
      setShowModal(false);
      setForm({});
      fetchServices();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/services/${confirmDelete.id}`);
      showToast('تم حذف الخدمة', 'success');
      setConfirmDelete(null);
      fetchServices();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const update = (f) => (e) => setForm((prev) => ({ ...prev, [f]: f === 'price' || f === 'cost' || f === 'durationMin' ? (e.target.value ? parseFloat(e.target.value) : 0) : e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الخدمات</h1>
          <p className="text-gray-500 text-sm mt-1">{services.length} خدمة</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> استيراد
          </button>
          <button className="btn-primary" onClick={() => { setForm({}); setShowModal(true); }}>
            <Plus className="w-4 h-4" /> إضافة خدمة
          </button>
        </div>
      </div>

      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} type="services" onImported={fetchServices} />

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث..." className="w-full sm:w-64" />
        <div className="w-44">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} options={categories} placeholder="كل التصنيفات" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : services.length === 0 ? <EmptyState message="لا توجد خدمات" icon={Sparkles} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">الاسم</th>
                  <th className="table-header">الاسم الإنجليزي</th>
                  <th className="table-header">التصنيف</th>
                  <th className="table-header">السعر</th>
                  <th className="table-header">التكلفة</th>
                  <th className="table-header">المدة</th>
                  <th className="table-header">الحالة</th>
                  <th className="table-header">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="table-cell font-semibold text-gray-800">{s.name}</td>
                    <td className="table-cell text-gray-500">{s.nameEn || '—'}</td>
                    <td className="table-cell"><span className="badge bg-purple-50 text-purple-700">{s.category || 'عام'}</span></td>
                    <td className="table-cell font-semibold">{formatCurrency(s.price)}</td>
                    <td className="table-cell text-gray-500">{formatCurrency(s.cost || 0)}</td>
                    <td className="table-cell">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-700">{s.durationMin} دقيقة</span>
                        {(s.sessionsCount > 1 || s.requiresConsent || s.requiresMedicalAssessment || s.room) && (
                          <div className="flex flex-wrap gap-1">
                            {s.sessionsCount > 1 && <span className="badge bg-purple-50 text-purple-700">{s.sessionsCount} جلسات</span>}
                            {s.requiresConsent && <span className="badge bg-amber-50 text-amber-700">موافقة</span>}
                            {s.requiresMedicalAssessment && <span className="badge bg-blue-50 text-blue-700">تقييم طبي</span>}
                            {s.room && <span className="badge bg-gray-100 text-gray-600">{s.room}</span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell"><span className={`badge ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.isActive ? 'نشطة' : 'متوقفة'}</span></td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg" onClick={() => { setForm(s); setShowModal(true); }}><Pencil className="w-4 h-4" /></button>
                        <button className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => setConfirmDelete(s)}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={form.id ? 'تعديل خدمة' : 'إضافة خدمة'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">الاسم *</label>
              <input className="input" value={form.name || ''} onChange={update('name')} required />
            </div>
            <div>
              <label className="label">الاسم الإنجليزي</label>
              <input className="input" value={form.nameEn || ''} onChange={update('nameEn')} dir="ltr" />
            </div>
            <div>
              <label className="label">التصنيف</label>
              <input className="input" value={form.category || ''} onChange={update('category')} placeholder="laser, vivace, onda..." />
            </div>
            <div>
              <label className="label">السعر *</label>
              <input className="input" type="number" value={form.price || ''} onChange={update('price')} required />
            </div>
            <div>
              <label className="label">التكلفة</label>
              <input className="input" type="number" value={form.cost || 0} onChange={update('cost')} />
            </div>
            <div>
              <label className="label">المدة (دقيقة)</label>
              <input className="input" type="number" value={form.durationMin || 30} onChange={update('durationMin')} />
            </div>
            <div>
              <label className="label">عدد الجلسات</label>
              <input className="input" type="number" min="1" value={form.sessionsCount || 1} onChange={update('sessionsCount')} />
            </div>
            <div>
              <label className="label">الغرفة</label>
              <input className="input" value={form.room || ''} onChange={update('room')} placeholder="غرفة الليزر 1" />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="accent-primary-600" checked={!!form.requiresConsent} onChange={(e) => setForm((p) => ({ ...p, requiresConsent: e.target.checked }))} />
                يتطلب نموذج موافقة
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="accent-primary-600" checked={!!form.requiresMedicalAssessment} onChange={(e) => setForm((p) => ({ ...p, requiresMedicalAssessment: e.target.checked }))} />
                يتطلب تقييم طبي مسبق
              </label>
            </div>
            <div className="col-span-2">
              <label className="label">الوصف</label>
              <textarea className="input" rows="2" value={form.description || ''} onChange={update('description')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? '...' : 'حفظ'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} message={`هل أنت متأكد من حذف ${confirmDelete?.name}؟`} />
    </div>
  );
}
