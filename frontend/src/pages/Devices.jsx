import { useState, useEffect, useCallback } from 'react';
import { Cpu, Plus, Pencil, Trash2, Wrench, Settings2 } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal, ConfirmDialog } from '../components/Modal';
import { formatDate, getStatusColor, getStatusLabel } from '../utils/format';

const STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER'];

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [form, setForm] = useState({});
  const [settingsForm, setSettingsForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (type) params.type = type;
      if (search) params.search = search;
      const { data } = await api.get('/devices', { params });
      setDevices(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [type, search]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const types = [...new Set(devices.map(d => d.type).filter(Boolean))];

  const update = (f) => (e) => setForm((prev) => ({ ...prev, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (form.id) {
        await api.put(`/devices/${form.id}`, form);
        showToast('تم تحديث الجهاز', 'success');
      } else {
        await api.post('/devices', form);
        showToast('تمت إضافة الجهاز', 'success');
      }
      setShowModal(false);
      setForm({});
      fetchDevices();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/devices/${confirmDelete.id}`);
      showToast('تم حذف الجهاز', 'success');
      setConfirmDelete(null);
      fetchDevices();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const openSettings = (device) => {
    setCurrentDevice(device);
    let parsed = {};
    try { parsed = JSON.parse(device.settings || '{}'); } catch (e) {}
    setSettingsForm(parsed);
    setShowSettingsModal(true);
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/devices/${currentDevice.id}`, { settings: settingsForm });
      showToast('تم حفظ إعدادات الجهاز', 'success');
      setShowSettingsModal(false);
      fetchDevices();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const recordMaintenance = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/devices/${currentDevice.id}/maintenance`, currentDevice);
      showToast('تم تسجيل الصيانة', 'success');
      setShowMaintenanceModal(false);
      fetchDevices();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">أجهزة العيادة</h1>
          <p className="text-gray-500 text-sm mt-1">{devices.length} جهاز</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({}); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> إضافة جهاز
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث..." className="w-full sm:w-64" />
        <div className="w-44">
          <Select value={type} onChange={(e) => setType(e.target.value)} options={types} placeholder="كل الأنواع" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full"><LoadingSpinner /></div> : devices.length === 0 ? <div className="col-span-full"><EmptyState message="لا توجد أجهزة" icon={Cpu} /></div> : devices.map((d) => (
          <div key={d.id} className="bg-white rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{d.name}</h3>
                  <p className="text-xs text-gray-400">{d.manufacturer || ''} {d.model ? `- ${d.model}` : ''}</p>
                </div>
              </div>
              <span className={`badge ${getStatusColor(d.status)}`}>{getStatusLabel(d.status)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4">
              <div><span className="text-gray-400">النوع:</span> {d.type}</div>
              <div><span className="text-gray-400">الرقم التسلسلي:</span> {d.serialNumber || '—'}</div>
              {d.currentPulseCounter !== null && d.currentPulseCounter !== undefined && (
                <div><span className="text-gray-400">عدّاد النبضات:</span> <span className="font-semibold text-gray-700">{d.currentPulseCounter.toLocaleString('ar-EG')}</span></div>
              )}
              {d.totalPulseUsage > 0 && (
                <div><span className="text-gray-400">إجمالي الاستخدام:</span> <span className="font-semibold text-gray-700">{d.totalPulseUsage.toLocaleString('ar-EG')}</span></div>
              )}
              {d.nextMaintenanceDate && <div className="col-span-2"><span className="text-gray-400">الصيانة القادمة:</span> {formatDate(d.nextMaintenanceDate)}</div>}
            </div>

            <div className="flex gap-2">
              <button className="flex-1 btn-secondary py-1.5 text-xs" onClick={() => openSettings(d)}><Settings2 className="w-3.5 h-3.5" /> الإعدادات</button>
              <button className="flex-1 btn-secondary py-1.5 text-xs" onClick={() => { setCurrentDevice(d); setShowMaintenanceModal(true); }}><Wrench className="w-3.5 h-3.5" /> صيانة</button>
              <button className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg" onClick={() => { setForm(d); setShowModal(true); }}><Pencil className="w-4 h-4" /></button>
              <button className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg" onClick={() => setConfirmDelete(d)}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Device form modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={form.id ? 'تعديل جهاز' : 'إضافة جهاز'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الاسم *</label>
              <input className="input" value={form.name || ''} onChange={update('name')} required />
            </div>
            <div>
              <label className="label">النوع *</label>
              <input className="input" value={form.type || ''} onChange={update('type')} placeholder="laser, vivace, onda..." required />
            </div>
            <div>
              <label className="label">الصانع</label>
              <input className="input" value={form.manufacturer || ''} onChange={update('manufacturer')} />
            </div>
            <div>
              <label className="label">الطراز</label>
              <input className="input" value={form.model || ''} onChange={update('model')} />
            </div>
            <div>
              <label className="label">الرقم التسلسلي</label>
              <input className="input" value={form.serialNumber || ''} onChange={update('serialNumber')} />
            </div>
            <div>
              <label className="label">عدّاد النبضات الحالي</label>
              <input className="input" type="number" min="0" value={form.currentPulseCounter ?? ''} onChange={update('currentPulseCounter')} />
            </div>
            <div>
              <label className="label">إجمالي نبضات الاستخدام</label>
              <input className="input" type="number" min="0" value={form.totalPulseUsage ?? ''} onChange={update('totalPulseUsage')} />
            </div>
            <div>
              <label className="label">الغرفة/الموقع</label>
              <input className="input" value={form.room || ''} onChange={update('room')} placeholder="غرفة الليزر 1" />
            </div>
            <div>
              <label className="label">الحالة</label>
              <select className="input" value={form.status || 'AVAILABLE'} onChange={update('status')}>
                {STATUSES.map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">تاريخ الشراء</label>
              <input className="input" type="date" value={form.purchaseDate ? form.purchaseDate.split('T')[0] : ''} onChange={update('purchaseDate')} />
            </div>
            <div>
              <label className="label">الضمان حتى</label>
              <input className="input" type="date" value={form.warrantyUntil ? form.warrantyUntil.split('T')[0] : ''} onChange={update('warrantyUntil')} />
            </div>
            <div>
              <label className="label">آخر صيانة</label>
              <input className="input" type="date" value={form.lastMaintenanceDate ? form.lastMaintenanceDate.split('T')[0] : ''} onChange={update('lastMaintenanceDate')} />
            </div>
            <div>
              <label className="label">الصيانة القادمة</label>
              <input className="input" type="date" value={form.nextMaintenanceDate ? form.nextMaintenanceDate.split('T')[0] : ''} onChange={update('nextMaintenanceDate')} />
            </div>
            <div className="col-span-2">
              <label className="label">ملاحظات</label>
              <textarea className="input" rows="2" value={form.notes || ''} onChange={update('notes')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? '...' : 'حفظ'}</button>
          </div>
        </form>
      </Modal>

      {/* Settings modal - fully configurable from admin */}
      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title={`إعدادات جهاز: ${currentDevice?.name}`} size="lg">
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <strong>ملاحظة:</strong> هذه الإعدادات قابلة للتعديل من هنا ولا يتم افتراض أي بروتوكولات علاجية أو معايير طبية. تُستخدم كما يتم ضبطها بواسطة العيادة.
        </div>
        <form onSubmit={saveSettings} className="space-y-4">
          <div className="space-y-3">
            {Object.entries(settingsForm).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <input
                  className="input flex-1 font-mono text-xs"
                  value={key}
                  onChange={() => {}} // key rename not supported inline
                  readOnly
                />
                :
                <input
                  className="input flex-1"
                  value={typeof value === 'object' ? JSON.stringify(value) : String(value || '')}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
                <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => {
                  const newForm = { ...settingsForm };
                  delete newForm[key];
                  setSettingsForm(newForm);
                }}>×</button>
              </div>
            ))}
            {Object.keys(settingsForm).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-3">لا توجد إعدادات مخصصة بعد</p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <input className="input flex-1" placeholder="اسم الإعداد الجديد" id="newKey" />
            <button type="button" className="btn-secondary" onClick={(e) => {
              const keyInput = document.getElementById('newKey');
              const key = keyInput.value.trim();
              if (key) { setSettingsForm((prev) => ({ ...prev, [key]: '' })); keyInput.value = ''; }
            }}>إضافة إعداد</button>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setShowSettingsModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حفظ الإعدادات</button>
          </div>
        </form>
      </Modal>

      {/* Maintenance modal */}
      <Modal isOpen={showMaintenanceModal} onClose={() => setShowMaintenanceModal(false)} title={`صيانة: ${currentDevice?.name}`} size="sm">
        <form onSubmit={recordMaintenance} className="space-y-4">
          <div>
            <label className="label">تاريخ آخر صيانة</label>
            <input className="input" type="date" value={currentDevice?.lastMaintenanceDate ? currentDevice.lastMaintenanceDate.split('T')[0] : ''} onChange={(e) => setCurrentDevice({ ...currentDevice, lastMaintenanceDate: e.target.value })} />
          </div>
          <div>
            <label className="label">موعد الصيانة القادمة</label>
            <input className="input" type="date" value={currentDevice?.nextMaintenanceDate ? currentDevice.nextMaintenanceDate.split('T')[0] : ''} onChange={(e) => setCurrentDevice({ ...currentDevice, nextMaintenanceDate: e.target.value })} />
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <textarea className="input" rows="2" onChange={(e) => setCurrentDevice({ ...currentDevice, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowMaintenanceModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">تسجيل الصيانة</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} message={`هل أنت متأكد من حذف ${confirmDelete?.name}؟`} />
    </div>
  );
}
