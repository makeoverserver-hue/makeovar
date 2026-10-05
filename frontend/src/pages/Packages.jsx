import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Trash2, Tag, ShoppingCart } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { LoadingSpinner, EmptyState } from '../components/common';
import { Modal } from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/format';

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [form, setForm] = useState({ items: [] });
  const [sellform, setSellForm] = useState({});
  const [currentPackage, setCurrentPackage] = useState(null);
  const [services, setServices] = useState([]);
  const [patients, setPatients] = useState([]);
  const { showToast } = useToast();

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.get('/packages'),
        api.get('/packages/sales', { params: { limit: 15 } }).catch(() => ({ data: { data: [] } })),
      ]);
      setPackages(p.data.data);
      setSales(s.data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
    api.get('/services').then(({ data }) => setServices(data.data)).catch(() => {});
    api.get('/patients', { params: { limit: 100 } }).then(({ data }) => setPatients(data.data)).catch(() => {});
  }, []);

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { serviceId: '', quantity: 1 }] }));
  const updateItem = (idx, field, value) => setForm((prev) => {
    const items = [...prev.items];
    items[idx] = { ...items[idx], [field]: value };
    return { ...prev, items };
  });
  const removeItem = (idx) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/packages', form);
      showToast('تم إنشاء الباقة', 'success');
      setShowModal(false);
      setForm({ items: [] });
      fetchPackages();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const sellPackage = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/packages/${currentPackage.id}/sell`, sellform);
      showToast('تم بيع الباقة', 'success');
      setShowSellModal(false);
      setSellForm({});
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الباقات</h1>
          <p className="text-gray-500 text-sm mt-1">{packages.length} باقة</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> باقة جديدة</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full"><LoadingSpinner /></div> : packages.length === 0 ? <div className="col-span-full"><EmptyState message="لا توجد باقات" icon={Package} /></div> : packages.map((pkg) => (
          <div key={pkg.id} className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  <h3 className="font-bold">{pkg.name}</h3>
                </div>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{pkg.items.length} خدمات</span>
              </div>
              <div className="text-2xl font-bold">{formatCurrency(pkg.price)}</div>
              {pkg.discount > 0 && <div className="text-xs mt-1 text-green-200">خصم {formatCurrency(pkg.discount)}</div>}
            </div>
            <div className="p-5">
              <div className="flex gap-3 mb-3 text-xs text-gray-500">
                {pkg.sessionCount > 0 && <span className="px-2 py-1 bg-gray-50 rounded-full">{pkg.sessionCount} جلسات</span>}
                {pkg.durationDays > 0 && <span className="px-2 py-1 bg-gray-50 rounded-full">{pkg.durationDays} يوم</span>}
              </div>
              <div className="space-y-2 mb-4">
                {pkg.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.service?.name}</span>
                    <span className="text-gray-400 flex items-center gap-1"><Tag className="w-3 h-3" /> ×{item.quantity}</span>
                  </div>
                ))}
              </div>
              <button className="btn-primary w-full" onClick={() => { setCurrentPackage(pkg); setShowSellModal(true); }}>بيع الباقة</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create package modal */}
      {/* Recent package sales */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-gray-400" />
          <h2 className="font-bold text-gray-900">آخر مبيعات الباقات</h2>
        </div>
        {sales.length === 0 ? <EmptyState message="لا توجد مبيعات بعد" icon={ShoppingCart} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">المريض</th>
                  <th className="table-header">الباقة</th>
                  <th className="table-header">السعر</th>
                  <th className="table-header">الجلسات</th>
                  <th className="table-header">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="table-cell font-semibold text-gray-800">{s.patient.fullName}</td>
                    <td className="table-cell">{s.package.name}</td>
                    <td className="table-cell">{formatCurrency(s.price)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {s.sessionsUsed}/{s.sessionsTotal}
                        </span>
                        {s.expiresAt && new Date(s.expiresAt) < new Date() && <span className="badge bg-red-100 text-red-700">منتهية</span>}
                      </div>
                    </td>
                    <td className="table-cell">{formatDate(s.soldAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="باقة جديدة" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">اسم الباقة *</label>
              <input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">السعر *</label>
              <input className="input" type="number" value={form.price || ''} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} required />
            </div>
            <div className="col-span-2">
              <label className="label">الوصف</label>
              <textarea className="input" rows="2" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">عدد الجلسات</label>
              <input className="input" type="number" value={form.sessionCount || ''} onChange={(e) => setForm({ ...form, sessionCount: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="label">مدة الصلاحية (أيام)</label>
              <input className="input" type="number" value={form.durationDays || ''} onChange={(e) => setForm({ ...form, durationDays: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="label">الخصم (ريال)</label>
              <input className="input" type="number" value={form.discount || ''} onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) })} />
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">الخدمات المضمنة</h4>
              <button type="button" className="btn-secondary py-1 px-2 text-xs" onClick={addItem}>+ إضافة خدمة</button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <select className="input" value={item.serviceId} onChange={(e) => updateItem(idx, 'serviceId', e.target.value)} required>
                      <option value="">الخدمة</option>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input className="input" type="number" placeholder="الكمية" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value))} />
                  </div>
                  <div className="col-span-2">
                    <input className="input" type="number" placeholder="السعر" value={item.price || ''} onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value))} />
                  </div>
                  <div className="col-span-1">
                    <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => removeItem(idx)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">حفظ</button>
          </div>
        </form>
      </Modal>

      {/* Sell package modal */}
      <Modal isOpen={showSellModal} onClose={() => setShowSellModal(false)} title={`بيع: ${currentPackage?.name}`} size="sm">
        <form onSubmit={sellPackage} className="space-y-4">
          <div>
            <label className="label">المريض *</label>
            <select className="input" value={sellform.patientId || ''} onChange={(e) => setSellForm({ ...sellform, patientId: e.target.value })} required>
              <option value="">اختر المريض</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">الكمية</label>
            <input className="input" type="number" value={sellform.quantity || 1} onChange={(e) => setSellForm({ ...sellform, quantity: parseInt(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowSellModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">تأكيد البيع</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
