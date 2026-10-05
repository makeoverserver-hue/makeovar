import { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Pencil, Trash2, Activity, AlertTriangle } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, Pagination, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal, ConfirmDialog } from '../components/Modal';
import { formatDate, formatNumber, getInitials } from '../utils/format';

const TREATMENTS = [
  { value: 'HAIR_REMOVAL', label: 'إزالة الشعر' },
  { value: 'TATTOO_REMOVAL', label: 'إزالة الوشم' },
  { value: 'PIGMENTATION', label: 'معالجة التصبغات' },
  { value: 'VASCULAR', label: 'معالجة الأوعية' },
  { value: 'SKIN_TIGHTENING', label: 'شد البشرة' },
  { value: 'ACNE', label: 'علاج حب الشباب' },
  { value: 'OTHER', label: 'أخرى' },
];
const SKIN_TYPES = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const TLabel = (v) => TREATMENTS.find((t) => t.value === v)?.label || v;

export default function Laser() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [treatmentType, setTreatmentType] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [stats, setStats] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [patients, setPatients] = useState([]);
  const [devices, setDevices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const { showToast } = useToast();

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: meta.limit };
      if (search) params.search = search;
      if (treatmentType) params.treatmentType = treatmentType;
      const { data } = await api.get('/laser', { params });
      setSessions(data.data);
      setMeta((prev) => ({ ...prev, ...data.meta }));
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
    finally { setLoading(false); }
  }, [page, search, treatmentType]);

  const fetchStats = useCallback(() => {
    api.get('/laser/stats').then(({ data }) => setStats(data.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    api.get('/patients', { params: { limit: 100 } }).then(({ data }) => setPatients(data.data)).catch(() => {});
    api.get('/devices').then(({ data }) => setDevices(data.data)).catch(() => {});
    api.get('/users', { params: { role: 'DOCTOR' } }).then(({ data }) => setDoctors(data.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await api.put(`/laser/${form.id}`, form);
        showToast('تم تحديث جلسة الليزر', 'success');
      } else {
        await api.post('/laser', form);
        showToast('تم تسجيل جلسة الليزر', 'success');
      }
      setShowModal(false);
      setForm({});
      fetchSessions();
      fetchStats();
    } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/laser/${confirmDelete.id}`); showToast('تم حذف الجلسة', 'success'); setConfirmDelete(null); fetchSessions(); fetchStats(); } catch (e) { showToast(getErrorMessage(e), 'error'); }
  };

  const update = (f) => (e) => setForm((p) => ({
    ...p,
    [f]: ['wavelengthNm', 'spotSizeMm', 'energyJcm2', 'pulseWidthMs', 'repetitionHZ', 'startPulseCounter', 'endPulseCounter'].includes(f) ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
  }));
  const fmtNum = (v) => v ?? '—';

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'جلسات الليزر', value: formatNumber(stats.totalSessions), color: 'text-purple-600' },
            { label: 'إجمالي النبضات', value: formatNumber(stats.totalPulses), color: 'text-blue-600' },
            { label: 'أنواع المعالجات', value: stats.byType.length, color: 'text-green-600' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg bg-gray-50 ${s.color}`}><Zap className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-bold text-gray-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Activity className="w-6 h-6 text-purple-600" /> وحدة الليزر</h1>
          <p className="text-gray-500 text-sm mt-1">{meta.total} جلسة ليزر</p>
        </div>
        <button className="btn-primary" onClick={() => { const d = devices[0]; setForm({ treatmentType: 'HAIR_REMOVAL', startPulseCounter: d ? d.currentPulseCounter ?? 0 : '' }); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> جلسة ليزر
        </button>
      </div>

      {!loading && sessions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="بحث بمريض..." className="w-full sm:w-64" />
          <div className="w-48">
            <Select value={treatmentType} onChange={(e) => { setPage(1); setTreatmentType(e.target.value); }} options={TREATMENTS} placeholder="كل المعالجات" />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : sessions.length === 0 ? <EmptyState message="لا توجد جلسات ليزر بعد" icon={Zap} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">#</th>
                    <th className="table-header">المريض</th>
                    <th className="table-header">المعالجة</th>
                    <th className="table-header">الجهاز</th>
                    <th className="table-header">المنطقة</th>
                    <th className="table-header">النبضات</th>
                    <th className="table-header">التاريخ</th>
                    <th className="table-header">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="table-cell text-xs text-gray-400 font-mono">{s.runningNo}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-bold">{getInitials(s.patient.fullName)}</div>
                          <div>
                            <span className="font-semibold text-gray-800">{s.patient.fullName}</span>
                            <div className="text-[10px] text-gray-400">{s.skinType ? `بشرة ${s.skinType}` : '| '}{s.doctor?.fullName || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell"><span className="badge bg-purple-50 text-purple-700">{TLabel(s.treatmentType)}</span></td>
                      <td className="table-cell text-sm text-gray-600">{s.device?.name || '—'}</td>
                      <td className="table-cell text-sm text-gray-600">{s.bodyArea || '—'}</td>
                      <td className="table-cell">
                        {s.usedPulses != null ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-700"><Zap className="w-3.5 h-3.5" /> {formatNumber(s.usedPulses)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell">{formatDate(s.sessionDate)}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          <button className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg" onClick={() => { setForm(s); setShowModal(true); }}><Pencil className="w-4 h-4" /></button>
                          <button className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => setConfirmDelete(s)}><Trash2 className="w-4 h-4" /></button>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={form.id ? `جلسة ليزر #${form.runningNo}` : 'جلسة ليزر جديدة'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-2 md:col-span-3">
              <label className="label">المريض *</label>
              <select className="input" value={form.patientId || ''} onChange={update('patientId')} required>
                <option value="">اختر المريض</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">نوع المعالجة</label>
              <select className="input" value={form.treatmentType || 'HAIR_REMOVAL'} onChange={update('treatmentType')}>
                {TREATMENTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">نوع البشرة (Fitzpatrick)</label>
              <select className="input" value={form.skinType || ''} onChange={update('skinType')}>
                <option value="">—</option>
                {SKIN_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الجهاز</label>
              <select className="input" value={form.deviceId || ''} onChange={update('deviceId')}>
                <option value="">بدون</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name} (عدّاد: {d.currentPulseCounter ?? 0})</option>)}
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
              <label className="label">التاريخ</label>
              <input className="input" type="datetime-local" value={form.sessionDate ? new Date(form.sessionDate).toISOString().slice(0, 16) : ''} onChange={(e) => setForm((p) => ({ ...p, sessionDate: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            </div>
            <div className="flex items-end"><span className="badge bg-purple-50 text-purple-700 w-full justify-center">جلسة # {form.runningNo || 'تلقائي'}</span></div>

            <div className="col-span-2 md:col-span-3 border-t border-gray-100 pt-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">المنطقة والبروتوكول</p>
            </div>
            <div>
              <label className="label">المنطقة</label>
              <input className="input" value={form.bodyArea || ''} onChange={update('bodyArea')} placeholder="مثال: الساق بالكامل" />
            </div>
            <div>
              <label className="label">موقع العلاج</label>
              <input className="input" value={form.treatmentSite || ''} onChange={update('treatmentSite')} />
            </div>
            <div>
              <label className="label">البروتوكول قبل الليزر</label>
              <input className="input" value={form.preLaserProtocol || ''} onChange={update('preLaserProtocol')} placeholder="تخدير، حلاقة..." />
            </div>
            <div>
              <label className="label">الاستجابة قبل الليزر</label>
              <input className="input" value={form.preLaserResponse || ''} onChange={update('preLaserResponse')} />
            </div>
            <div>
              <label className="label">مستوى المعالجة</label>
              <input className="input" value={form.treatmentLevel || ''} onChange={update('treatmentLevel')} placeholder="مستوى 3" />
            </div>

            <div className="col-span-2 md:col-span-3 border-t border-gray-100 pt-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">بارامترات الجهاز</p>
            </div>
            <div>
              <label className="label">الطول الموجي (nm)</label>
              <input className="input" type="number" value={form.wavelengthNm ?? ''} onChange={update('wavelengthNm')} placeholder="808" />
            </div>
            <div>
              <label className="label">حجم البقعة (mm)</label>
              <input className="input" type="number" value={form.spotSizeMm ?? ''} onChange={update('spotSizeMm')} placeholder="12" />
            </div>
            <div>
              <label className="label">الطاقة (J/cm²)</label>
              <input className="input" type="number" value={form.energyJcm2 ?? ''} onChange={update('energyJcm2')} placeholder="25" />
            </div>
            <div>
              <label className="label">عرض النبضة (ms)</label>
              <input className="input" type="number" value={form.pulseWidthMs ?? ''} onChange={update('pulseWidthMs')} placeholder="15" />
            </div>
            <div>
              <label className="label">التردد (Hz)</label>
              <input className="input" type="number" value={form.repetitionHZ ?? ''} onChange={update('repetitionHZ')} placeholder="2" />
            </div>

            <div className="col-span-2 md:col-span-3 border-t border-gray-100 pt-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">عداد النبضات</p>
            </div>
            <div>
              <label className="label">عداد البداية</label>
              <input className="input" type="number" value={form.startPulseCounter ?? ''} onChange={update('startPulseCounter')} />
            </div>
            <div>
              <label className="label">عداد النهاية</label>
              <input className="input" type="number" value={form.endPulseCounter ?? ''} onChange={update('endPulseCounter')} />
            </div>
            <div className="flex items-end">
              <span className="badge bg-blue-50 text-blue-700 w-full justify-center">
                {form.startPulseCounter !== '' && form.endPulseCounter !== '' && Number(form.endPulseCounter) >= Number(form.startPulseCounter)
                  ? `النبضات: ${Number(form.endPulseCounter) - Number(form.startPulseCounter)}` : 'النبضات = النهاية − البداية'}
              </span>
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="label">حالة الجلسة</label>
              <select className="input" value={form.status || 'COMPLETED'} onChange={update('status')}>
                {['COMPLETED', 'SCHEDULED', 'IN_PROGRESS', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="label">الملاحظات</label>
              <textarea className="input" rows="2" value={form.notes || ''} onChange={update('notes')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary"><Zap className="w-4 h-4" /> حفظ</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} message={`حذف جلسة الليزر #${confirmDelete?.runningNo}؟`} />
    </div>
  );
}