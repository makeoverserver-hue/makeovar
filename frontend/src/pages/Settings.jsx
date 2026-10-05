import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Save, Building2, Bell, Wallet, Clock, Database, Download, Upload } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { LoadingSpinner, EmptyState } from '../components/common';
import { formatCurrency } from '../utils/format';

const GROUPS = [
  { id: 'clinic', label: 'بيانات العيادة', icon: Building2 },
  { id: 'scheduling', label: 'المواعيد', icon: Clock },
  { id: 'billing', label: 'الفواتير', icon: Wallet },
  { id: 'device', label: 'الأجهزة', icon: SettingsIcon },
  { id: 'inventory', label: 'المخزون', icon: Building2 },
  { id: 'notification', label: 'الإشعارات', icon: Bell },
  { id: 'general', label: 'عام', icon: SettingsIcon },
  { id: 'backup', label: 'النسخ الاحتياطي', icon: Database },
];

function BackupsTab() {
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [file, setFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const { showToast } = useToast();

  const fetchBackups = useCallback(async () => {
    try {
      const { data } = await api.get('/system/backups');
      setList(data.data.backups);
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
  }, []);

  useEffect(() => { fetchBackups(); }, []);
  useEffect(() => {
    const t = setInterval(fetchBackups, 15000);
    return () => clearInterval(t);
  }, [fetchBackups]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/system/backups');
      showToast(`تم إنشاء النسخة (${(data.data.size / 1024).toFixed(0)}KB)`, 'success');
      fetchBackups();
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
    finally { setCreating(false); }
  };

  const download = async (name) => {
    try {
      const { data } = await api.get(`/system/backups/${name}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
  };

  const restore = async (e) => {
    e.preventDefault();
    if (!file) { showToast('اختر ملف نسخة', 'error'); return; }
    setRestoring(true);
    const fd = new FormData();
    fd.append('backup', file);
    try {
      await api.post('/system/backups/restore', fd);
      showToast('تم الاستعادة، سيعاد تشغيل الخادم خلال ثوانٍ', 'success');
      setTimeout(() => { window.location.reload(); }, 4000);
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
    finally { setRestoring(false); }
  };

  const fmtSize = (b) => (b / 1024).toFixed(1) + ' KB';

  return (
    <div className="bg-white rounded-xl shadow-card p-6">
      <h2 className="font-bold text-gray-900 mb-4">النسخ الاحتياطي والاستعادة</h2>
      <div className="flex flex-wrap gap-3 mb-6">
        <button className="btn-primary" onClick={createBackup} disabled={creating}>
          <Database className="w-4 h-4" /> {creating ? 'جارٍ الإنشاء...' : 'نسخ احتياطي الآن'}
        </button>
      </div>

      <form onSubmit={restore} className="mb-6 p-4 bg-amber-50/60 border border-amber-100 rounded-xl">
        <p className="text-sm font-semibold text-amber-800 mb-2">استعادة نسخة احتياطية</p>
        <p className="text-xs text-amber-700 mb-3">تحذير: الاستعادة تستبدل قاعدة البيانات الحالية بالنسخة المرفوعة.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input" type="file" accept=".db" onChange={(e) => setFile(e.target.files[0])} />
          <button className="btn-primary" type="submit" disabled={restoring}><Upload className="w-4 h-4" /> {restoring ? 'جارٍ الاستعادة...' : 'استعادة'}</button>
        </div>
      </form>

      <h3 className="text-sm font-semibold text-gray-700 mb-2">النسخ المتاحة ({list.length})</h3>
      {list.length === 0 ? (
        <EmptyState message="لا توجد نسخ احتياطية بعد" icon={Database} />
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <div key={b.name} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
              <div>
                <p className="text-sm font-mono text-gray-800">{b.name}</p>
                <p className="text-xs text-gray-400">{fmtSize(b.size)} • {new Date(b.createdAt).toLocaleString('ar-EG')}</p>
              </div>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => download(b.name)}><Download className="w-3.5 h-3.5" /> تنزيل</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [thisGroup, setThisGroup] = useState('clinic');
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [values, setValues] = useState({});
  const [clinic, setClinic] = useState(null);
  const { showToast } = useToast();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings');
      const raw = data.data.raw || [];
      setSettings(raw);
      if (!activeGroup && raw.length) {
        setActiveGroup(raw[0].group);
      }
      const valMap = {};
      raw.forEach((s) => {
        try { valMap[s.key] = JSON.parse(s.value); } catch { valMap[s.key] = s.value; }
      });
      setValues(valMap);
      const clinicRes = await api.get('/settings/clinic');
      setClinic(clinicRes.data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, []);

  const saveSetting = async (key) => {
    try {
      await api.put(`/settings/${key}`, { value: values[key] });
      showToast('تم حفظ الإعداد', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const availableGroups = [...new Set(settings.map(s => s.group))];
  const groupSettings = settings.filter(s => s.group === (activeGroup || 'clinic'));

  const updateValue = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-500 text-sm mt-1">إعدادات النظام والعيادة</p>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Groups sidebar */}
          <div className="md:w-48 shrink-0 flex md:flex-col gap-1 overflow-x-auto">
            {availableGroups.map((g) => {
              const grp = GROUPS.find(x => x.id === g) || { label: g, icon: SettingsIcon };
              return (
                <button key={g} onClick={() => setActiveGroup(g)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap ${activeGroup === g ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <grp.icon className="w-4 h-4" /> {grp.label}
                </button>
              );
            })}
          </div>

          {/* Settings content */}
          <div className="flex-1 space-y-4">
            {activeGroup === 'backup' && <BackupsTab />}

            {activeGroup === 'clinic' && clinic && (
              <div className="bg-white rounded-xl shadow-card p-6">
                <h2 className="font-bold text-gray-900 mb-4">بيانات العيادة</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">اسم العيادة</label>
                    <input className="input" value={clinic.name || ''} onChange={(e) => setClinic({ ...clinic, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">العملة</label>
                    <input className="input" value={clinic.currency || ''} onChange={(e) => setClinic({ ...clinic, currency: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">الهاتف</label>
                    <input className="input" value={clinic.phone || ''} onChange={(e) => setClinic({ ...clinic, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">البريد</label>
                    <input className="input" value={clinic.email || ''} onChange={(e) => setClinic({ ...clinic, email: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">العنوان</label>
                    <input className="input" value={clinic.address || ''} onChange={(e) => setClinic({ ...clinic, address: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">المنطقة الزمنية</label>
                    <input className="input" value={clinic.timezone || ''} onChange={(e) => setClinic({ ...clinic, timezone: e.target.value })} dir="ltr" />
                  </div>
                </div>
                <div className="mt-4">
                  <button className="btn-primary" onClick={async () => {
                    await api.put('/settings/clinic', clinic).then(() => showToast('تم حفظ بيانات العيادة', 'success')).catch((e) => showToast(getErrorMessage(e), 'error'));
                  }}><Save className="w-4 h-4" /> حفظ بيانات العيادة</button>
                </div>
              </div>
            )}

            {groupSettings.length === 0 ? (
              <EmptyState message="لا توجد إعدادات في هذه المجموعة" icon={SettingsIcon} />
            ) : (
              <div className="bg-white rounded-xl shadow-card p-6">
                <h2 className="font-bold text-gray-900 mb-4">{GROUPS.find(g => g.id === activeGroup)?.label || activeGroup}</h2>
                <div className="space-y-4">
                  {groupSettings.map((s) => (
                    <div key={s.id} className="flex flex-col md:flex-row md:items-center gap-3 pb-4 border-b border-gray-50 last:border-0">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{s.key}</div>
                        <div className="text-xs text-gray-400">{s.group} / {s.category || '-'}</div>
                      </div>
                      <input
                        className="input md:w-64"
                        value={typeof values[s.key] === 'boolean' ? (values[s.key] ? 'true' : 'false') : (values[s.key] ?? '')}
                        onChange={(e) => updateValue(s.key, e.target.value)}
                      />
                      <button className="btn-secondary py-2 px-3 text-xs whitespace-nowrap" onClick={() => saveSetting(s.key)}><Save className="w-3.5 h-3.5" /> حفظ</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
