import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Filter, Eye, Pencil, Upload } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, Pagination, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal } from '../components/Modal';
import ImportModal from '../components/ImportModal';
import { formatDate, getInitials, getStatusColor, getStatusLabel } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const GENDERS = [
  { value: 'MALE', label: 'ذكر' },
  { value: 'FEMALE', label: 'أنثى' },
];

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: meta.limit };
      if (search) params.search = search;
      if (gender) params.gender = gender;
      const { data } = await api.get('/patients', { params });
      setPatients(data.data);
      setMeta(data.meta);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, gender]);

  useEffect(() => {
    fetchPatients();
  }, [page, search, gender]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (form.id) {
        await api.put(`/patients/${form.id}`, form);
        showToast('تم تحديث بيانات المريض', 'success');
      } else {
        await api.post('/patients', form);
        showToast('تم إضافة المريض بنجاح', 'success');
      }
      setShowModal(false);
      setForm({});
      fetchPatients();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: field === 'weightKg' || field === 'heightCm' ? (value ? parseFloat(value) : null) : value }));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المرضى</h1>
          <p className="text-gray-500 text-sm mt-1">{meta.total} مريض</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setShowImport(true)}><Upload className="w-4 h-4" /> استيراد</button>
          <button className="btn-primary" onClick={() => { setForm({}); setShowModal(true); }}>
            <UserPlus className="w-4 h-4" />
            إضافة مريض
          </button>
        </div>
      </div>
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} type="patients" onImported={fetchPatients} />

      <div className="flex flex-wrap gap-3 items-center">
        <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="بحث بالاسم أو الهاتف..." className="w-full sm:w-72" />
        <div className="w-40">
          <Select
            value={gender}
            onChange={(e) => { setPage(1); setGender(e.target.value); }}
            options={GENDERS}
            placeholder="كل الجنسيات"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : patients.length === 0 ? (
          <EmptyState message="لا يوجد مرضى" icon={Users} action={
            <button className="btn-primary text-sm" onClick={() => setShowModal(true)}><UserPlus className="w-4 h-4" /> إضافة مريض</button>
          } />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">المريض</th>
                    <th className="table-header">الهاتف</th>
                    <th className="table-header">الجنس</th>
                    <th className="table-header">العمر</th>
                    <th className="table-header">تاريخ التسجيل</th>
                    <th className="table-header">الحالة</th>
                    <th className="table-header">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {patients.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">
                            {getInitials(p.fullName)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800">{p.fullName}</div>
                            <div className="text-xs text-gray-400">{p.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell" dir="ltr">{p.phone}</td>
                      <td className="table-cell">{p.gender === 'MALE' ? 'ذكر' : p.gender === 'FEMALE' ? 'أنثى' : '—'}</td>
                      <td className="table-cell">{p.age || '—'}</td>
                      <td className="table-cell">{formatDate(p.createdAt)}</td>
                      <td className="table-cell">
                        <span className={`badge ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {p.isActive ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg" onClick={() => navigate(`/patients/${p.id}`)}>
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg" onClick={() => { setForm(p); setShowModal(true); }}>
                            <Pencil className="w-4 h-4" />
                          </button>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={form.id ? 'تعديل مريض' : 'إضافة مريض'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">الاسم الكامل *</label>
              <input className="input" value={form.fullName || ''} onChange={updateField('fullName')} required placeholder="اسم المريض" />
            </div>
            <div>
              <label className="label">الهاتف *</label>
              <input className="input" value={form.phone || ''} onChange={updateField('phone')} required placeholder="05xxxxxxxx" dir="ltr" />
            </div>
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input className="input" type="email" value={form.email || ''} onChange={updateField('email')} placeholder="email@example.com" dir="ltr" />
            </div>
            <div>
              <label className="label">الجنس</label>
              <Select value={form.gender || ''} onChange={updateField('gender')} options={GENDERS} placeholder="اختر الجنس" />
            </div>
            <div>
              <label className="label">تاريخ الميلاد</label>
              <input className="input" type="date" value={form.dateOfBirth ? form.dateOfBirth.split('T')[0] : ''} onChange={updateField('dateOfBirth')} />
            </div>
            <div>
              <label className="label">فصيلة الدم</label>
              <input className="input" value={form.bloodType || ''} onChange={updateField('bloodType')} />
            </div>
            <div>
              <label className="label">الطول (سم)</label>
              <input className="input" type="number" value={form.heightCm || ''} onChange={updateField('heightCm')} />
            </div>
            <div>
              <label className="label">الوزن (كجم)</label>
              <input className="input" type="number" value={form.weightKg || ''} onChange={updateField('weightKg')} />
            </div>
            <div>
              <label className="label">مصدر المريض</label>
              <input className="input" value={form.source || ''} onChange={updateField('source')} placeholder="زائر، إحالة، تواصل اجتماعي..." />
            </div>
            <div>
              <label className="label">جهة الإحالة</label>
              <input className="input" value={form.referralSource || ''} onChange={updateField('referralSource')} />
            </div>
            <div className="md:col-span-2">
              <label className="label">العنوان</label>
              <input className="input" value={form.address || ''} onChange={updateField('address')} />
            </div>
            <div className="md:col-span-2">
              <label className="label">الحساسية</label>
              <input className="input" value={form.allergies || ''} onChange={updateField('allergies')} />
            </div>
            <div className="md:col-span-2">
              <label className="label">الأمراض المزمنة</label>
              <textarea className="input" rows="2" value={form.chronicDiseases || ''} onChange={updateField('chronicDiseases')} />
            </div>
            <div className="md:col-span-2">
              <label className="label">ملاحظات</label>
              <textarea className="input" rows="2" value={form.notes || ''} onChange={updateField('notes')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
