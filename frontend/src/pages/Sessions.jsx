import { useState, useEffect, useCallback } from 'react';
import { Stethoscope, Plus, CheckCircle, Zap } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, Pagination, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal } from '../components/Modal';
import { formatDate, getStatusColor, getStatusLabel, getInitials } from '../utils/format';

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({});
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [plans, setPlans] = useState([]);
  const [devices, setDevices] = useState([]);
  const [completeModal, setCompleteModal] = useState(null);
  const [endCounter, setEndCounter] = useState('');
  const [completing, setCompleting] = useState(false);
  const { showToast } = useToast();

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: meta.limit };
      if (search) params.search = search;
      if (status) params.status = status;
      const { data } = await api.get('/sessions', { params });
      setSessions(data.data);
      setMeta(data.meta);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    api.get('/patients', { params: { limit: 100 } }).then(({ data }) => setPatients(data.data)).catch(() => {});
    api.get('/services').then(({ data }) => setServices(data.data)).catch(() => {});
    api.get('/users', { params: { role: 'DOCTOR' } }).then(({ data }) => setDoctors(data.data)).catch(() => {});
    api.get('/plans').then(({ data }) => setPlans(data.data)).catch(() => {});
    api.get('/devices').then(({ data }) => setDevices(data.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        scheduledDate: form.scheduledDate ? new Date(form.scheduledDate + 'T10:00:00').toISOString() : undefined,
        startPulseCounter: form.startPulseCounter ? Number(form.startPulseCounter) : undefined,
      };
      await api.post('/sessions', payload);
      showToast('تم إنشاء الجلسة', 'success');
      setShowModal(false);
      setForm({});
      fetchSessions();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const submitComplete = async (e) => {
    e.preventDefault();
    setCompleting(true);
    try {
      const payload = { endPulseCounter: endCounter !== '' ? Number(endCounter) : undefined };
      if (completeModal.deviceId) payload.deviceId = completeModal.deviceId;
      await api.patch(`/sessions/${completeModal.id}/complete`, payload);
      showToast('تم إكمال الجلسة', 'success');
      setCompleteModal(null);
      setEndCounter('');
      fetchSessions();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setCompleting(false);
    }
  };

  const update = (f) => (e) => setForm((prev) => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">جلسات العلاج</h1>
          <p className="text-gray-500 text-sm mt-1">{meta.total} جلسة</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({}); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> جلسة جديدة
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="بحث عن مريض..." className="w-full sm:w-64" />
        <div className="w-44">
          <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={['SCHEDULED', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS'].map(s => ({ value: s, label: getStatusLabel(s) }))} placeholder="كل الحالات" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : sessions.length === 0 ? <EmptyState message="لا توجد جلسات" icon={Stethoscope} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">المريض</th>
                    <th className="table-header">الخدمة</th>
                    <th className="table-header">الطبيب</th>
                    <th className="table-header">الجلسة</th>
                    <th className="table-header">النبضات</th>
                    <th className="table-header">التاريخ</th>
                    <th className="table-header">الحالة</th>
                    <th className="table-header">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">{getInitials(s.patient.fullName)}</div>
                          <span className="font-semibold text-gray-800">{s.patient.fullName}</span>
                        </div>
                      </td>
                      <td className="table-cell">{s.service.name}</td>
                      <td className="table-cell">{s.doctor?.fullName || '—'}</td>
                      <td className="table-cell">{s.sessionNumber || '—'}{s.totalSessions ? `/${s.totalSessions}` : ''}</td>
                      <td className="table-cell">
                        {s.usedPulses != null && s.usedPulses !== '' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-purple-700">
                            <Zap className="w-3.5 h-3.5" /> {s.usedPulses.toLocaleString('ar-EG')} نبضة
                            {s.startPulseCounter != null && s.endPulseCounter != null && (
                              <span className="text-[10px] text-gray-400 font-normal">({s.startPulseCounter} ← {s.endPulseCounter})</span>
                            )}
                          </span>
                        ) : s.startPulseCounter != null && s.endPulseCounter != null ? (
                          <span className="text-gray-500">{s.startPulseCounter} ← {s.endPulseCounter}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="table-cell">{formatDate(s.scheduledDate)}</td>
                      <td className="table-cell"><span className={`badge ${getStatusColor(s.status)}`}>{getStatusLabel(s.status)}</span></td>
                      <td className="table-cell">
                        {s.status === 'SCHEDULED' && <button className="btn-primary py-1 px-2 text-xs" onClick={() => { setCompleteModal(s); setEndCounter(s.endPulseCounter != null ? String(s.endPulseCounter) : ''); }}><CheckCircle className="w-3.5 h-3.5" /> إكمال</button>}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="جلسة علاج جديدة" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">المريض *</label>
              <select className="input" value={form.patientId || ''} onChange={update('patientId')} required>
                <option value="">اختر المريض</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الخدمة *</label>
              <select className="input" value={form.serviceId || ''} onChange={update('serviceId')} required>
                <option value="">اختر الخدمة</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الطبيب</label>
              <select className="input" value={form.doctorId || ''} onChange={update('doctorId')}>
                <option value="">بدون</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">خطة العلاج</label>
              <select className="input" value={form.treatmentPlanId || ''} onChange={update('treatmentPlanId')}>
                <option value="">بدون</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">جهاز الليزر</label>
              <select className="input" value={form.deviceId || ''} onChange={update('deviceId')}>
                <option value="">بدون</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name} (عدّاد: {d.currentPulseCounter ?? 0})</option>)}
              </select>
            </div>
            <div>
              <label className="label">عداد البداية (نبضة)</label>
              <input className="input" type="number" min="0" placeholder="عدّاد الجهاز قبل الجلسة" value={form.startPulseCounter || ''} onChange={update('startPulseCounter')} />
            </div>
            <div>
              <label className="label">رقم الجلسة</label>
              <input className="input" type="number" value={form.sessionNumber || 1} onChange={update('sessionNumber')} />
            </div>
            <div>
              <label className="label">إجمالي الجلسات</label>
              <input className="input" type="number" value={form.totalSessions || ''} onChange={update('totalSessions')} />
            </div>
            <div>
              <label className="label">التاريخ</label>
              <input className="input" type="date" value={form.scheduledDate || ''} onChange={update('scheduledDate')} />
            </div>
            <div>
              <label className="label">المنطقة المعالجة</label>
              <input className="input" value={form.areaTreated || ''} onChange={update('areaTreated')} />
            </div>
            <div className="col-span-2">
              <label className="label">ملاحظات</label>
              <textarea className="input" rows="2" value={form.notes || ''} onChange={update('notes')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حفظ</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!completeModal} onClose={() => setCompleteModal(null)} title="إكمال جلسة علاج" size="md">
        {completeModal && (
          <form onSubmit={submitComplete} className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-800">{completeModal.patient.fullName}</p>
              <p className="mt-1">{completeModal.service.name}{completeModal.sessionNumber ? ` • جلسة ${completeModal.sessionNumber}` : ''}</p>
              {completeModal.startPulseCounter != null && (
                <p className="mt-1 inline-flex items-center gap-1 text-purple-700"><Zap className="w-3.5 h-3.5" /> عداد البداية: {completeModal.startPulseCounter}</p>
              )}
            </div>
            <div>
              <label className="label">جهاز الليزر</label>
              <select className="input" value={completeModal.deviceId || ''} onChange={(e) => setCompleteModal({ ...completeModal, deviceId: e.target.value })}>
                <option value="">بدون</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name} (عدّاد: {d.currentPulseCounter ?? 0})</option>)}
              </select>
            </div>
            <div>
              <label className="label">عداد النهاية (نبضة)</label>
              <input
                className="input" type="number" min="0"
                placeholder={completeModal.startPulseCounter != null ? `أكبر من أو يساوي ${completeModal.startPulseCounter}` : 'عدّاد الجهاز بعد الجلسة'}
                value={endCounter}
                onChange={(e) => setEndCounter(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                {completeModal.startPulseCounter != null && endCounter !== '' && Number(endCounter) >= completeModal.startPulseCounter
                  ? `النبضات المستخدمة: ${Number(endCounter) - completeModal.startPulseCounter}`
                  : 'النبضات المستخدمة = النهاية − البداية'}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" className="btn-secondary" onClick={() => setCompleteModal(null)}>إلغاء</button>
              <button type="submit" className="btn-primary" disabled={completing}>
                <CheckCircle className="w-4 h-4" /> {completing ? '...' : 'إكمال الجلسة'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
