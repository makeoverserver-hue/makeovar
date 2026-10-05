import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, Clock, Check, X, UserCheck } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, Pagination, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal } from '../components/Modal';
import { formatDate, formatTime, getStatusColor, getStatusLabel, getInitials, toLocalDateStr } from '../utils/format';

const today = new Date();
const todayStr = toLocalDateStr(today);
const weekLater = new Date(today);
weekLater.setDate(weekLater.getDate() + 7);

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(toLocalDateStr(weekLater));
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({});
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const STATUSES = [
    'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
  ];

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: meta.limit };
      if (search) params.search = search;
      if (status) params.status = status;
      if (dateFrom) params.startDate = new Date(dateFrom + 'T00:00:00').toISOString();
      if (dateTo) params.endDate = new Date(dateTo + 'T23:59:59').toISOString();
      const { data } = await api.get('/appointments', { params });
      setAppointments(data.data);
      setMeta(data.meta);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, dateFrom, dateTo]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    api.get('/patients', { params: { limit: 100 } }).then(({ data }) => setPatients(data.data)).catch(() => {});
    api.get('/users', { params: { role: 'DOCTOR' } }).then(({ data }) => setDoctors(data.data)).catch(() => {});
    api.get('/services').then(({ data }) => setServices(data.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) {
      showToast('اختر تاريخ الموعد', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const startTime = new Date(`${form.date}T${form.time || '10:00'}`);
      const duration = parseInt(form.duration) || 30;
      const endTime = new Date(startTime.getTime() + duration * 60000);
      await api.post('/appointments', {
        ...form,
        startTime,
        endTime,
        date: startTime,
        duration,
      });
      showToast('تم إنشاء الموعد', 'success');
      setShowModal(false);
      setForm({});
      fetchAppointments();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (id, newStatus) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status: newStatus });
      showToast('تم تحديث حالة الموعد', 'success');
      fetchAppointments();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const updateField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المواعيد</h1>
          <p className="text-gray-500 text-sm mt-1">{meta.total} موعد</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({ date: todayStr, time: '10:00', duration: 30, type: 'CONSULTATION' }); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> موعد جديد
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="بحث باسم المريض..." className="w-full sm:w-64" />
        <div className="w-44">
          <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={STATUSES.map(s => ({ value: s, label: getStatusLabel(s) }))} placeholder="كل الحالات" />
        </div>
        <div>
          <label className="label">من</label>
          <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">إلى</label>
          <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : appointments.length === 0 ? (
          <EmptyState message="لا توجد مواعيد" icon={CalendarDays} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">التاريخ</th>
                    <th className="table-header">المريض</th>
                    <th className="table-header">الطبيب</th>
                    <th className="table-header">الخدمة</th>
                    <th className="table-header">الحالة</th>
                    <th className="table-header">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="table-cell whitespace-nowrap">
                        <div className="font-medium">{formatDate(a.date)}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(a.startTime)} - {formatTime(a.endTime)}</div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">{getInitials(a.patient.fullName)}</div>
                          <div>
                            <div className="font-semibold text-gray-800">{a.patient.fullName}</div>
                            <div className="text-xs text-gray-400" dir="ltr">{a.patient.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">{a.doctor?.fullName}</td>
                      <td className="table-cell">{a.service?.name || '—'}</td>
                      <td className="table-cell"><span className={`badge ${getStatusColor(a.status)}`}>{getStatusLabel(a.status)}</span></td>
                      <td className="table-cell">
                        <div className="flex gap-1 items-center">
                          {a.status === 'SCHEDULED' && (
                            <>
                              <button title="تأكيد" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" onClick={() => changeStatus(a.id, 'CONFIRMED')}><Check className="w-4 h-4" /></button>
                              <button title="ملغي" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => changeStatus(a.id, 'CANCELLED')}><X className="w-4 h-4" /></button>
                            </>
                          )}
                          {(a.status === 'CONFIRMED' || a.status === 'SCHEDULED') && (
                            <button title="حضور" className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg" onClick={() => changeStatus(a.id, 'CHECKED_IN')}><UserCheck className="w-4 h-4" /></button>
                          )}
                          {a.status === 'CHECKED_IN' && (
                            <button title="إكمال" className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg" onClick={() => changeStatus(a.id, 'COMPLETED')}><Check className="w-4 h-4" /></button>
                          )}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="موعد جديد" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">المريض *</label>
              <select className="input" value={form.patientId || ''} onChange={updateField('patientId')} required>
                <option value="">اختر المريض</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} - {p.phone}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الطبيب *</label>
              <select className="input" value={form.doctorId || ''} onChange={updateField('doctorId')} required>
                <option value="">اختر الطبيب</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الخدمة</label>
              <select className="input" value={form.serviceId || ''} onChange={updateField('serviceId')}>
                <option value="">بدون خدمة</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} - {s.price}</option>)}
              </select>
            </div>
            <div>
              <label className="label">النوع</label>
              <select className="input" value={form.type || 'CONSULTATION'} onChange={updateField('type')}>
                <option value="CONSULTATION">استشارة</option>
                <option value="TREATMENT">علاج</option>
                <option value="FOLLOW_UP">متابعة</option>
                <option value="OTHER">أخرى</option>
              </select>
            </div>
            <div>
              <label className="label">التاريخ *</label>
              <input className="input" type="date" value={form.date || todayStr} onChange={updateField('date')} required />
            </div>
            <div>
              <label className="label">الوقت *</label>
              <input className="input" type="time" value={form.time || '10:00'} onChange={updateField('time')} required />
            </div>
            <div>
              <label className="label">المدة (دقيقة)</label>
              <input className="input" type="number" value={form.duration || 30} onChange={updateField('duration')} />
            </div>
            <div>
              <label className="label">ملاحظات</label>
              <input className="input" value={form.notes || ''} onChange={updateField('notes')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? '...' : 'حفظ'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
