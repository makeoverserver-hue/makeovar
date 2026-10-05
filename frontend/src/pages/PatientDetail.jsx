import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Phone, Mail, MapPin, CalendarDays, Plus, FileText, Camera,
  ClipboardList, Receipt, Stethoscope, Pencil,
} from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { LoadingSpinner, EmptyState } from '../components/common';
import { Modal } from '../components/Modal';
import { formatDate, formatCurrency, getInitials, getStatusColor, getStatusLabel } from '../utils/format';

const tabs = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'records', label: 'الملف الطبي' },
  { id: 'appointments', label: 'المواعيد' },
  { id: 'sessions', label: 'جلسات العلاج' },
  { id: 'invoices', label: 'الفواتير' },
  { id: 'photos', label: 'الصور' },
  { id: 'consents', label: 'موافقات' },
];

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false);
  const [recordForm, setRecordForm] = useState({});
  const [apptForm, setApptForm] = useState({});
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchPatient = async () => {
    try {
      const { data } = await api.get(`/patients/${id}`);
      setPatient(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatient();
    api.get('/services').then(({ data }) => setServices(data.data)).catch(() => {});
    api.get('/users', { params: { role: 'DOCTOR' } }).then(({ data }) => setDoctors(data.data)).catch(() => {});
  }, [id]);

  const submitRecord = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/patients/${id}/records`, recordForm);
      showToast('تمت إضافة السجل الطبي', 'success');
      setShowRecordModal(false);
      setRecordForm({});
      fetchPatient();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const submitAppointment = async (e) => {
    e.preventDefault();
    try {
      const startTime = new Date(`${apptForm.date}T${apptForm.time || '10:00'}`);
      const duration = parseInt(apptForm.duration) || 30;
      const endTime = new Date(startTime.getTime() + duration * 60000);
      await api.post('/appointments', {
        ...apptForm,
        patientId: id,
        startTime,
        endTime,
        date: startTime,
        duration,
      });
      showToast('تمت إضافة الموعد', 'success');
      setShowApptModal(false);
      setApptForm({});
      fetchPatient();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  if (loading) return <LoadingSpinner full />;
  if (!patient) return <EmptyState message="المريض غير موجود" />;

  const infoCard = (label, value, Icon) => (
    <div className="flex items-center gap-3">
      {Icon && <Icon className="w-4 h-4 text-gray-400 shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm font-medium text-gray-800 truncate">{value || '—'}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button className="btn-secondary" onClick={() => navigate('/patients')}>
          <ArrowRight className="w-4 h-4" /> العودة
        </button>
      </div>

      {/* Patient info card */}
      <div className="bg-white rounded-xl shadow-card p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xl font-bold">
            {getInitials(patient.fullName)}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{patient.fullName}</h1>
            <div className="text-sm text-gray-500 mt-0.5">{patient.branch?.name}</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {infoCard('الهاتف', patient.phone, Phone)}
              {infoCard('البريد', patient.email, Mail)}
              {infoCard('العنوان', patient.address, MapPin)}
              {infoCard('تاريخ التسجيل', formatDate(patient.createdAt), CalendarDays)}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-sm" onClick={() => setShowApptModal(true)}>
              <Plus className="w-4 h-4" /> موعد
            </button>
            <button className="btn-primary text-sm" onClick={() => setShowRecordModal(true)}>
              <Plus className="w-4 h-4" /> سجل طبي
            </button>
          </div>
        </div>

        {/* Medical info */}
        <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-400">الجنس: </span>{patient.gender === 'MALE' ? 'ذكر' : patient.gender === 'FEMALE' ? 'أنثى' : '—'}</div>
          <div><span className="text-gray-400">العمر: </span>{patient.age || '—'}</div>
          <div><span className="text-gray-400">فصيلة الدم: </span>{patient.bloodType || '—'}</div>
          <div><span className="text-gray-400">الوزن: </span>{patient.weightKg ? `${patient.weightKg} كجم` : '—'}</div>
          {patient.allergies && <div className="col-span-2"><span className="text-gray-400">الحساسية: </span><span className="text-red-600">{patient.allergies}</span></div>}
          {patient.chronicDiseases && <div className="col-span-2"><span className="text-gray-400">أمراض مزمنة: </span>{patient.chronicDiseases}</div>}
        </div>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'المواعيد', value: patient._count?.appointments || 0 },
          { label: 'الفاتورة', value: patient._count?.invoices || 0 },
          { label: 'جلسات', value: patient._count?.sessions || 0 },
          { label: 'خطط علاج', value: patient._count?.treatmentPlans || 0 },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-card p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id ? 'text-primary-600 border-primary-600' : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-gray-400" /> الحالة الصحية</h3>
                <p className="text-gray-600">{patient.medicalHistory || 'لا توجد معلومات طبية إضافية'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">طوارئ</h3>
                <p className="text-gray-600">{patient.emergencyContact || '—'} {patient.emergencyPhone ? `(${patient.emergencyPhone})` : ''}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">ملاحظات</h3>
                <p className="text-gray-600">{patient.notes || '—'}</p>
              </div>
            </div>
          )}

          {activeTab === 'records' && (
            <div className="space-y-4">
              <button className="btn-primary text-sm" onClick={() => setShowRecordModal(true)}><Plus className="w-4 h-4" /> إضافة سجل</button>
              {patient.medicalRecords.length === 0 ? <EmptyState message="لا توجد سجلات طبية" icon={FileText} /> : (
                <div className="space-y-3">
                  {patient.medicalRecords.map((r) => (
                    <div key={r.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-800">{r.title}</span>
                        <span className="text-xs text-gray-400">{formatDate(r.createdAt)} • {r.createdBy?.fullName}</span>
                      </div>
                      {r.diagnosis && <p className="text-sm text-gray-600 mb-1"><strong>التشخيص:</strong> {r.diagnosis}</p>}
                      {r.description && <p className="text-sm text-gray-600 mb-1">{r.description}</p>}
                      {r.prescription && <p className="text-sm text-gray-600"><strong>وصفة:</strong> {r.prescription}</p>}
                      {r.notes && <p className="text-sm text-gray-500 mt-2">{r.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="space-y-3">
              <button className="btn-primary text-sm" onClick={() => setShowApptModal(true)}><Plus className="w-4 h-4" /> موعد جديد</button>
              {patient.appointments.filter(a => !a.deletedAt).length === 0 ? <EmptyState message="لا توجد مواعيد" icon={CalendarDays} /> : (
                <div className="divide-y divide-gray-50">
                  {patient.appointments.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 py-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold">{formatDate(a.date).split(' ')[0]}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{a.service?.name || a.type}</p>
                        <p className="text-xs text-gray-400">{a.doctor?.fullName}</p>
                      </div>
                      <span className={`badge ${getStatusColor(a.status)}`}>{getStatusLabel(a.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div>
              <button className="btn-primary text-sm mb-4" onClick={() => navigate(`/sessions?patient=${id}`)}><Stethoscope className="w-4 h-4" /> عرض الجلسات</button>
              {(!patient.sessions || patient.sessions.length === 0) ? <EmptyState message="لا توجد جلسات علاج" icon={Stethoscope} /> : (
                <div className="divide-y divide-gray-50">
                  {patient.sessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-4 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{s.service?.name}</p>
                        <p className="text-xs text-gray-400">{formatDate(s.scheduledDate)}</p>
                      </div>
                      <span className={`badge ${getStatusColor(s.status)}`}>{getStatusLabel(s.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div>
              {patient.invoices.length === 0 ? <EmptyState message="لا توجد فواتير" icon={Receipt} /> : (
                <div className="divide-y divide-gray-50">
                  {patient.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-4 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{inv.invoiceNumber}</p>
                        <p className="text-xs text-gray-400">{formatDate(inv.createdAt)}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{formatCurrency(inv.total)}</span>
                      <span className={`badge ${getStatusColor(inv.status)}`}>{getStatusLabel(inv.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {!patient.photos || patient.photos.length === 0 ? <div className="col-span-full"><EmptyState message="لا توجد صور" icon={Camera} /></div> : patient.photos.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={`/uploads/${photo.filePath.split('uploads/')[1] || photo.filePath}`} alt={photo.description || 'صورة'} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'consents' && (
            <div className="space-y-3">
              {!patient.consents || patient.consents.length === 0 ? <EmptyState message="لا توجد نماذج موافقة" icon={ClipboardList} /> : patient.consents.map((c) => (
                <div key={c.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{c.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(c.signedAt) || 'غير موقعة'}</p>
                  </div>
                  <span className={`badge ${c.isSigned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {c.isSigned ? 'موقعة' : 'غير موقعة'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Medical record modal */}
      <Modal isOpen={showRecordModal} onClose={() => setShowRecordModal(false)} title="إضافة سجل طبي" size="lg">
        <form onSubmit={submitRecord} className="space-y-4">
          <div>
            <label className="label">العنوان *</label>
            <input className="input" value={recordForm.title || ''} onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })} required />
          </div>
          <div>
            <label className="label">التشخيص</label>
            <textarea className="input" rows="2" value={recordForm.diagnosis || ''} onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })} />
          </div>
          <div>
            <label className="label">الوصف</label>
            <textarea className="input" rows="3" value={recordForm.description || ''} onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })} />
          </div>
          <div>
            <label className="label">الوصفة الطبية</label>
            <textarea className="input" rows="2" value={recordForm.prescription || ''} onChange={(e) => setRecordForm({ ...recordForm, prescription: e.target.value })} />
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <textarea className="input" rows="2" value={recordForm.notes || ''} onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowRecordModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حفظ</button>
          </div>
        </form>
      </Modal>

      {/* Appointment modal */}
      <Modal isOpen={showApptModal} onClose={() => setShowApptModal(false)} title="حجز موعد" size="lg">
        <form onSubmit={submitAppointment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">الطبيب *</label>
              <select className="input" value={apptForm.doctorId || ''} onChange={(e) => setApptForm({ ...apptForm, doctorId: e.target.value })} required>
                <option value="">اختر الطبيب</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الخدمة</label>
              <select className="input" value={apptForm.serviceId || ''} onChange={(e) => setApptForm({ ...apptForm, serviceId: e.target.value })}>
                <option value="">بدون خدمة</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">التاريخ *</label>
              <input className="input" type="date" value={apptForm.date || ''} onChange={(e) => setApptForm({ ...apptForm, date: e.target.value })} required />
            </div>
            <div>
              <label className="label">الوقت *</label>
              <input className="input" type="time" value={apptForm.time || '10:00'} onChange={(e) => setApptForm({ ...apptForm, time: e.target.value })} required />
            </div>
            <div>
              <label className="label">المدة (دقيقة)</label>
              <input className="input" type="number" value={apptForm.duration || 30} onChange={(e) => setApptForm({ ...apptForm, duration: e.target.value })} />
            </div>
            <div>
              <label className="label">النوع</label>
              <select className="input" value={apptForm.type || 'CONSULTATION'} onChange={(e) => setApptForm({ ...apptForm, type: e.target.value })}>
                <option value="CONSULTATION">استشارة</option>
                <option value="TREATMENT">علاج</option>
                <option value="FOLLOW_UP">متابعة</option>
                <option value="OTHER">أخرى</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">ملاحظات</label>
              <textarea className="input" rows="2" value={apptForm.notes || ''} onChange={(e) => setApptForm({ ...apptForm, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowApptModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حجز الموعد</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
