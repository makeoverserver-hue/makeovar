import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, PenLine } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal } from '../components/Modal';
import { formatDate, getInitials } from '../utils/format';

export default function Consents() {
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [form, setForm] = useState({});
  const [signForm, setSignForm] = useState({});
  const [current, setCurrent] = useState(null);
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  const fetchConsents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (patientId) params.patientId = patientId;
      const { data } = await api.get('/system/consents', { params });
      setConsents(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { fetchConsents(); }, [fetchConsents]);
  useEffect(() => {
    api.get('/patients', { params: { limit: 100 } }).then(({ data }) => setPatients(data.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/system/consents', form);
      showToast('تم إنشاء نموذج الموافقة', 'success');
      setShowModal(false);
      setForm({});
      fetchConsents();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const signConsent = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('signedBy', signForm.signedBy || '');
      if (signForm.signature) fd.append('signature', signForm.signature);
      
      const payload = { signedBy: signForm.signedBy || 'توقيع إلكتروني' };
      if (signForm.signature) payload.signaturePath = signForm.signature.name;
      
      await api.patch(`/system/consents/${current.id}/sign`, payload);
      showToast('تم توقيع النموذج', 'success');
      setShowSignModal(false);
      setSignForm({});
      fetchConsents();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">نماذج الموافقة</h1>
          <p className="text-gray-500 text-sm mt-1">{consents.length} نموذج</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> نموذج جديد</button>
      </div>

      <div className="w-56">
        <Select value={patientId} onChange={(e) => setPatientId(e.target.value)} options={patients.map(p => ({ value: p.id, label: p.fullName }))} placeholder="كل المرضى" />
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : consents.length === 0 ? <EmptyState message="لا توجد نماذج موافقة" icon={ClipboardList} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">المريض</th>
                    <th className="table-header">العنوان</th>
                    <th className="table-header">أنشئ بواسطة</th>
                    <th className="table-header">التاريخ</th>
                    <th className="table-header">الحالة</th>
                    <th className="table-header">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consents.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">{getInitials(c.patient.fullName)}</div>
                          <span className="font-semibold text-gray-800">{c.patient.fullName}</span>
                        </div>
                      </td>
                      <td className="table-cell">{c.title}</td>
                      <td className="table-cell">{c.createdBy?.fullName}</td>
                      <td className="table-cell">{formatDate(c.createdAt)}</td>
                      <td className="table-cell">
                        <span className={`badge ${c.isSigned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {c.isSigned ? 'موقعة' : 'غير موقعة'}
                        </span>
                      </td>
                      <td className="table-cell">
                        {!c.isSigned && (
                          <button className="btn-primary py-1 px-2 text-xs" onClick={() => { setCurrent(c); setShowSignModal(true); }}>
                            <PenLine className="w-3.5 h-3.5" /> توقيع
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="نموذج موافقة جديد" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">المريض *</label>
            <select className="input" value={form.patientId || ''} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
              <option value="">اختر المريض</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">العنوان *</label>
            <input className="input" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="label">محتوى النموذج *</label>
            <textarea className="input" rows="6" value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حفظ</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showSignModal} onClose={() => setShowSignModal(false)} title={`توقيع: ${current?.title}`} size="sm">
        <form onSubmit={signConsent} className="space-y-4">
          <div>
            <label className="label">اسم الموقّع *</label>
            <input className="input" value={signForm.signedBy || ''} onChange={(e) => setSignForm({ ...signForm, signedBy: e.target.value })} required />
          </div>
          <p className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg" dir="rtl">{current?.content}</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowSignModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">توقيع</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
