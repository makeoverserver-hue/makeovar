import { useState, useEffect, useCallback } from 'react';
import { Package2, Plus, Pencil, Trash2, ArrowDownCircle, AlertTriangle, CalendarX, Upload } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal, ConfirmDialog } from '../components/Modal';
import ImportModal from '../components/ImportModal';
import { formatDate, formatCurrency } from '../utils/format';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ total: 0, lowStock: 0, expired: 0, nearExpiry: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({});
  const [adjustForm, setAdjustForm] = useState({});
  const [current, setCurrent] = useState(null);
  const { showToast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, category };
      const [inv, st] = await Promise.all([
        api.get('/inventory', { params }),
        api.get('/inventory/stock-status').catch(() => ({ data: { data: {} } })),
      ]);
      setItems(inv.data.data);
      setStatus(st.data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await api.put(`/inventory/${form.id}`, form);
        showToast('تم تحديث العنصر', 'success');
      } else {
        await api.post('/inventory', form);
        showToast('تمت إضافة العنصر', 'success');
      }
      setShowModal(false);
      setForm({});
      fetchItems();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/inventory/${current.id}/adjust`, adjustForm);
      showToast('تم تعديل المخزون', 'success');
      setShowAdjustModal(false);
      setAdjustForm({});
      fetchItems();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/inventory/${confirmDelete.id}`);
      showToast('تم حذف العنصر', 'success');
      setConfirmDelete(null);
      fetchItems();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const update = (f) => (e) => setForm((prev) => ({ ...prev, [f]: ['quantity', 'minQuantity', 'unitPrice', 'purchasePrice'].includes(f) ? parseFloat(e.target.value) : e.target.value }));

  const lowStockCount = items.filter(i => i.isLowStock).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المخزون</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} عنصر{lowStockCount > 0 && ` • ${lowStockCount} منخفض`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setShowImport(true)}><Upload className="w-4 h-4" /> استيراد</button>
          <button className="btn-primary" onClick={() => { setForm({}); setShowModal(true); }}><Plus className="w-4 h-4" /> عنصر جديد</button>
        </div>
      </div>
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} type="inventory" onImported={fetchItems} />

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث..." className="w-full sm:w-64" />
        <div className="w-44"><Select value={category} onChange={(e) => setCategory(e.target.value)} options={categories} placeholder="كل التصنيفات" /></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Package2 className="w-5 h-5" /></div>
          <div><div className="text-xl font-bold text-gray-900">{status.total}</div><div className="text-xs text-gray-500">إجمالي العناصر</div></div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
          <div><div className="text-xl font-bold text-gray-900">{status.lowStock}</div><div className="text-xs text-gray-500">منخفض</div></div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><CalendarX className="w-5 h-5" /></div>
          <div><div className="text-xl font-bold text-gray-900">{status.expired}</div><div className="text-xs text-gray-500">منتهي الصلاحية</div></div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
          <div><div className="text-xl font-bold text-gray-900">{status.nearExpiry}</div><div className="text-xs text-gray-500">قريب الانتهاء</div></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : items.length === 0 ? <EmptyState message="لا توجد عناصر في المخزون" icon={Package2} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">العنصر</th>
                  <th className="table-header">التصنيف</th>
                  <th className="table-header">الكمية</th>
                  <th className="table-header">الحد الأدنى</th>
                  <th className="table-header">سعر البيع</th>
                  <th className="table-header">القيمة</th>
                  <th className="table-header">الحالة</th>
                  <th className="table-header">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className={item.isLowStock ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                    <td className="table-cell">
                      <div className="font-semibold text-gray-800">{item.name}</div>
                      <div className="text-xs text-gray-400" dir="ltr">{item.sku || ''}</div>
                    </td>
                    <td className="table-cell"><span className="badge bg-purple-50 text-purple-700">{item.category || 'عام'}</span></td>
                    <td className="table-cell font-bold">{item.quantity}</td>
                    <td className="table-cell text-gray-500">{item.minQuantity}</td>
                    <td className="table-cell">{formatCurrency(item.unitPrice)}</td>
                    <td className="table-cell">{formatCurrency(item.stockValue)}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {item.isLowStock && (
                          <span className="badge bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" /> منخفض</span>
                        )}
                        {item.expiryStatus === 'EXPIRED' && (
                          <span className="badge bg-red-100 text-red-700"><CalendarX className="w-3 h-3 mr-1" /> منتهي</span>
                        )}
                        {item.expiryStatus === 'NEAR_EXPIRY' && (
                          <span className="badge bg-amber-100 text-amber-700">وشك الانتهاء</span>
                        )}
                        {!item.isLowStock && item.expiryStatus === 'OK' && (
                          <span className="badge bg-green-100 text-green-700">متوفر</span>
                        )}
                        {item.expiryDate && (item.expiryStatus === 'EXPIRED' || item.expiryStatus === 'NEAR_EXPIRY') && (
                          <span className="text-[10px] text-gray-400">{formatDate(item.expiryDate)}</span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg" title="تعديل المخزون" onClick={() => { setCurrent(item); setAdjustForm({}); setShowAdjustModal(true); }}>
                          <ArrowDownCircle className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg" onClick={() => { setForm(item); setShowModal(true); }}><Pencil className="w-4 h-4" /></button>
                        <button className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => setConfirmDelete(item)}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={form.id ? 'تعديل عنصر' : 'عنصر جديد'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الاسم *</label>
              <input className="input" value={form.name || ''} onChange={update('name')} required />
            </div>
            <div>
              <label className="label">التصنيف</label>
              <input className="input" value={form.category || ''} onChange={update('category')} placeholder="مستهلك، معدات..." />
            </div>
            <div>
              <label className="label">SKU</label>
              <input className="input" value={form.sku || ''} onChange={update('sku')} dir="ltr" />
            </div>
            <div>
              <label className="label">المورد</label>
              <input className="input" value={form.supplier || ''} onChange={update('supplier')} />
            </div>
            <div>
              <label className="label">الكمية</label>
              <input className="input" type="number" value={form.quantity ?? 0} onChange={update('quantity')} />
            </div>
            <div>
              <label className="label">الحد الأدنى</label>
              <input className="input" type="number" value={form.minQuantity ?? 0} onChange={update('minQuantity')} />
            </div>
            <div>
              <label className="label">سعر البيع</label>
              <input className="input" type="number" value={form.unitPrice ?? 0} onChange={update('unitPrice')} />
            </div>
            <div>
              <label className="label">سعر الشراء</label>
              <input className="input" type="number" value={form.purchasePrice ?? 0} onChange={update('purchasePrice')} />
            </div>
            <div>
              <label className="label">تاريخ الانتهاء</label>
              <input className="input" type="date" value={form.expiryDate ? form.expiryDate.split('T')[0] : ''} onChange={update('expiryDate')} />
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

      <Modal isOpen={showAdjustModal} onClose={() => setShowAdjustModal(false)} title={`تعديل المخزون: ${current?.name}`} size="sm">
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">الكمية الحالية: <strong>{current?.quantity}</strong></div>
          <div>
            <label className="label">التغيير (+/-)</label>
            <input className="input" type="number" value={adjustForm.quantity || ''} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) })} required placeholder="مثال: 5 أو -3" />
          </div>
          <div>
            <label className="label">السبب</label>
            <input className="input" value={adjustForm.reason || ''} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowAdjustModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">تعديل</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} message={`هل أنت متأكد من حذف ${confirmDelete?.name}؟`} />
    </div>
  );
}
