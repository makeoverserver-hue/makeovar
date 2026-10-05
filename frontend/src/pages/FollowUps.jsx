import { useState, useEffect, useCallback } from 'react';
import { PhoneCall, CheckCircle2, Clock, CalendarClock, Plus, PenLine, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal } from '../components/Modal';
import { formatNumber, formatDate, getInitials, getStatusColor, getStatusLabel } from '../utils/format';

const TYPE_LABELS = { CALL: 'اتصال', WHATSAPP: 'واتساب', VISIT: 'زيارة', EMAIL: 'بريد', OTHER: 'أخرى' };
const STATUS_OPTS = [
  { value: '', label: 'كل الحالات' },
  { value: 'PENDING', label: 'قيد الانتظار' },
  { value: 'CONTACTED', label: 'تم التواصل' },
  { value: 'BOOKED', label: 'تم الحجز' },
  { value: 'NO_RESPONSE', label: 'لا يوجد رد' },
  { value: 'COMPLETED', label: 'مكتمل' },
  { value: 'CANCELLED', label: 'ملغي' },
];
const TYPE_OPTS = [
  { value: '', label: 'كل الأنواع' },
  { value: 'CALL', label: 'اتصال' },
  { value: 'WHATSAPP', label: 'واتساب' },
  { value: 'VISIT', label: 'زيارة' },
  { value: 'EMAIL', label: 'بريد' },
  { value: 'OTHER', label: 'أخرى' },
];

export default function FollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [stats, setStats] = useState({ today: 0, overdue: 0, upcoming: 0, completed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [fType, setFType] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [form, setForm] = useState({});
  const [completeForm, setCompleteForm] = useState({});
  const [current, setCurrent] = useState(null);
  const { showToast } = useToast();

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (fType) params.type = fType;
      if (patientId) params.patientId = patientId;
      const { data } = await api.get('/follow-ups', { params });
      setFollowUps(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [status, fType, patientId]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/follow-ups/stats');
      setStats(data.data);
    } catch (error) { /* stats are best-effort */ }
  }, []);

  useEffect(() => { fetchFollowUps(); fetchStats(); }, [fetchFollowUps, fetchStats]);
  useEffect(() => {
    api.get('/patients', { params: { limit: 100 } }).then(({ data }) => setPatients(data.data)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/follow-ups', form);
      showToast('تم إنشاء المتابعة', 'success');
      setShowModal(false);
      setForm({});
      fetchFollowUps(); fetchStats();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/follow-ups/${current.id}`, { ...completeForm, status: 'COMPLETED' });
      showToast('تم إكمال المتابعة', 'success');
      setShowComplete(false);
      setCompleteForm({});
      fetchFollowUps(); fetchStats();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذه المتابعة؟')) return;
    try {
      await api.delete(`/follow-ups/${id}`);
      showToast('تم حذف المتابعة', 'success');
      fetchFollowUps(); fetchStats();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const statCards = [
    { key: 'today', label: 'اليوم', value: stats.today, icon: CalendarClock, color: 'bg-blue-50 text-blue-600' },
    { key: 'overdue', label: 'متأخرة', value: stats.overdue, icon: Clock, color: 'bg-red-50 text-red-600' },
    { key: 'upcoming', label: 'قادمة', value: stats.upcoming, icon: PhoneCall, color: 'bg-indigo-50 text-indigo-600' },
    { key: 'pending', label: 'قيد الانتظار', value: stats.pending, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { key: 'completed', label: 'مكتملة', value: stats.completed, icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">متابعة المرضى</h1>
          <p className="text-gray-500 text-sm mt-1">{formatNumber(followUps.length)} متابعة</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> متابعة جديدة</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <div key={s.key} className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(s.value)}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-52"><Select value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTS} /></div>
        <div className="w-44"><Select value={fType} onChange={(e) => setFType(e.target.value)} options={TYPE_OPTS} /></div>
        <div className="w-56"><Select value={patientId} onChange={(e) => setPatientId(e.target.value)} options={patients.map(p => ({ value: p.id, label: p.fullName }))} placeholder="كل المرضى" /></div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : followUps.length === 0 ? <EmptyState message="لا توجد متابعات" icon={CalendarClock} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">المريض</th>
                  <th className="table-header">النوع</th>
                  <th className="table-header">التاريخ</th>
                  <th className="table-header">المسؤول</th>
                  <th className="table-header">الحالة</th>
                  <th className="table-header">ملاحظات</th>
                  <th className="table-header">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {followUps.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">{getInitials(f.patient.fullName)}</div>
                        <div>
                          <span className="font-semibold text-gray-800">{f.patient.fullName}</span>
                          {f.patient.phone && <div className="text-xs text-gray-400" dir="ltr">{f.patient.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">{TYPE_LABELS[f.type] || f.type}</td>
                    <td className="table-cell">{formatDate(f.date)}</td>
                    <td className="table-cell">{f.assignedTo?.fullName || '—'}</td>
                    <td className="table-cell"><span className={`badge ${getStatusColor(f.status)}`}>{getStatusLabel(f.status)}</span></td>
                    <td className="table-cell text-sm text-gray-500 max-w-[200px] truncate">{f.notes || '—'}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        {f.status !== 'COMPLETED' && f.status !== 'CANCELLED' && (
                          <button className="btn-primary py-1 px-2 text-xs" onClick={() => { setCurrent(f); setCompleteForm({ }); setShowComplete(true); }}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> إكمال
                          </button>
                        )}
                        <button className="btn-secondary py-1 px-2 text-xs" onClick={() => handleDelete(f.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="متابعة جديدة" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">المريض *</label>
              <select className="input" value={form.patientId || ''} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
                <option value="">اختر المريض</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">النوع *</label>
              <select className="input" value={form.type || 'CALL'} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPE_OPTS.filter(t => t.value).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">التاريخ *</label>
              <input type="date" className="input" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className="label">الحالة</label>
              <select className="input" value={form.status || 'PENDING'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTS.filter(s => s.value).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <textarea className="input" rows="3" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حفظ</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showComplete} onClose={() => setShowComplete(false)} title={`إكمال متابعة: ${current?.patient?.fullName}`} size="sm">
        <form onSubmit={handleComplete} className="space-y-4">
          <div>
            <label className="label">النتيجة</label>
            <textarea className="input" rows="3" value={completeForm.result || ''} onChange={(e) => setCompleteForm({ ...completeForm, result: e.target.value })} placeholder="نتيجة التواصل... (تم الحجز، سيتصل لاحقاً...)" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowComplete(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">إكمال</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}