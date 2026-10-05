import { useState, useEffect, useCallback } from 'react';
import { Receipt, Plus, Banknote, CalendarClock, FileDown, Printer } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, Pagination, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal } from '../components/Modal';
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, getInitials } from '../utils/format';

const METHODS = [
  { value: 'CASH', label: 'نقدي' },
  { value: 'CARD', label: 'بطاقة' },
  { value: 'BANK_TRANSFER', label: 'تحويل بنكي' },
  { value: 'ONLINE', label: 'أونلاين' },
  { value: 'OTHER', label: 'أخرى' },
];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [showModal, setShowModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showInstModal, setShowInstModal] = useState(false);
  const [form, setForm] = useState({ items: [] });
  const [payForm, setPayForm] = useState({});
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [instForm, setInstForm] = useState({ count: 4 });
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const { showToast } = useToast();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: meta.limit };
      if (search) params.search = search;
      if (status) params.status = status;
      const { data } = await api.get('/invoices', { params });
      setInvoices(data.data);
      setMeta(data.meta);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => {
    api.get('/patients', { params: { limit: 100 } }).then(({ data }) => setPatients(data.data)).catch(() => {});
    api.get('/services').then(({ data }) => setServices(data.data)).catch(() => {});
  }, []);

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unitPrice: 0 }] }));
  const updateItem = (idx, field, value) => setForm((prev) => {
    const items = [...prev.items];
    items[idx] = { ...items[idx], [field]: field === 'quantity' || field === 'unitPrice' ? parseFloat(value) : value };
    return { ...prev, items };
  });
  const removeItem = (idx) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const calculateTotals = () => {
    const subtotal = form.items.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);
    const discount = form.discount || 0;
    const taxRate = form.taxRate || 0;
    const tax = subtotal * (taxRate / 100);
    return { subtotal, total: subtotal - discount + tax };
  };
  const { subtotal, total } = calculateTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/invoices', form);
      showToast('تم إنشاء الفاتورة', 'success');
      setShowModal(false);
      setForm({ items: [] });
      fetchInvoices();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/invoices/${currentInvoice.id}/payments`, payForm);
      showToast('تم تسجيل الدفعة', 'success');
      setShowPayModal(false);
      setPayForm({});
      fetchInvoices();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const openInstallments = async (inv) => {
    setCurrentInvoice(inv);
    setShowInstModal(true);
    setInstForm({ count: 4 });
    try {
      const { data } = await api.get(`/invoices/${inv.id}/installments`);
      setInstallments(data.data);
    } catch (e) { setInstallments([]); }
  };

  const createInstallmentPlan = async (e) => {
    e.preventDefault();
    const count = parseInt(instForm.count) || 2;
    const each = Math.round((currentInvoice.dueAmount / count) * 100) / 100;
    const plan = Array.from({ length: count }, (_, i) => ({
      amount: i === count - 1 ? Math.round((currentInvoice.dueAmount - each * (count - 1)) * 100) / 100 : each,
      dueDate: new Date(Date.now() + (i + 1) * 30 * 86400000).toISOString().slice(0, 10),
    }));
    try {
      await api.post(`/invoices/${currentInvoice.id}/installments`, { installments: plan });
      showToast('تم إنشاء خطة الأقساط', 'success');
      const { data } = await api.get(`/invoices/${currentInvoice.id}/installments`);
      setInstallments(data.data);
    } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };

  const payInstallment = async (inst) => {
    try {
      await api.post(`/invoices/${currentInvoice.id}/installments/${inst.id}/pay`, {});
      showToast('تم سداد القسط', 'success');
      const { data } = await api.get(`/invoices/${currentInvoice.id}/installments`);
      setInstallments(data.data);
      fetchInvoices();
      setCurrentInvoice((c) => ({ ...c, paidAmount: c.paidAmount + inst.amount, dueAmount: c.dueAmount - inst.amount, status: c.dueAmount - inst.amount <= 0 ? 'PAID' : 'PARTIALLY_PAID' }));
    } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };

  const exportCsv = async (name) => {
    try {
      const { data } = await api.get(name, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
  };

  const printInvoice = () => {
    if (!currentInvoice) return;
    const w = window.open('', '_blank', 'width=420,height=600');
    w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>فاتورة</title><style>
      body{font-family:Arial,sans-serif;padding:24px;max-width:380px;margin:auto;color:#111}
      h1{text-align:center;font-size:20px;margin-bottom:2px}
      .sub{text-align:center;color:#666;font-size:12px}
      .hr{border:none;border-top:1px dashed #999;margin:14px 0}
      .row{display:flex;justify-content:space-between;margin:4px 0;font-size:13px}
      table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px;text-align:right}
      .total{font-size:15px;font-weight:bold}
      .footer{text-align:center;color:#888;font-size:11px;margin-top:16px}
    </style></head><body>
      <h1>عيادة التجميل والليزر</h1>
      <p class="sub">فاتورة ضريبية مبسطة</p>
      <hr class="hr">
      <div class="row"><span>رقم الفاتورة</span><b>${currentInvoice.invoiceNumber}</b></div>
      <div class="row"><span>التاريخ</span><span>${formatDate(currentInvoice.createdAt)}</span></div>
      <div class="row"><span>المريض</span><span>${currentInvoice.patient?.fullName || ''}</span></div>
      <table><thead><tr><th>البيان</th><th>الكمية</th><th>المبلغ</th></tr></thead><tbody>
      ${(currentInvoice.items || []).map((it) => `<tr><td>${it.description || ''}</td><td>${it.quantity || 1}</td><td>${formatCurrency(it.unitPrice)}</td></tr>`).join('')}
      </tbody></table>
      <div class="row"><span>الإجمالي</span><b>${formatCurrency(currentInvoice.total)}</b></div>
      <div class="row"><span>المدفوع</span><span>${formatCurrency(currentInvoice.paidAmount)}</span></div>
      <div class="row"><span>المتبقي</span><b>${formatCurrency(currentInvoice.dueAmount)}</b></div>
      <hr class="hr">
      <p class="footer">شكرًا لتعاملكم معنا</p>
    </body></html>`);
    w.document.close();
    const t = setTimeout(() => { w.print(); w.close(); }, 400);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الفواتير</h1>
          <p className="text-gray-500 text-sm mt-1">{meta.total} فاتورة</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportCsv('invoices.csv')}><FileDown className="w-4 h-4" /> تصدير</button>
          <button className="btn-primary" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> فاتورة جديدة</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="بحث..." className="w-full sm:w-64" />
        <div className="w-44">
          <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={['PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED'].map(s => ({ value: s, label: getStatusLabel(s) }))} placeholder="كل الحالات" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : invoices.length === 0 ? <EmptyState message="لا توجد فواتير" icon={Receipt} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">رقم الفاتورة</th>
                    <th className="table-header">المريض</th>
                    <th className="table-header">التاريخ</th>
                    <th className="table-header">الإجمالي</th>
                    <th className="table-header">المدفوع</th>
                    <th className="table-header">الحالة</th>
                    <th className="table-header">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="table-cell font-mono text-xs font-semibold text-gray-800">{inv.invoiceNumber}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">{getInitials(inv.patient.fullName)}</div>
                          <div>
                            <span className="font-semibold text-gray-800">{inv.patient.fullName}</span>
                            <div className="text-xs text-gray-400">{inv.items.length} بند</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">{formatDate(inv.createdAt)}</td>
                      <td className="table-cell font-semibold">{formatCurrency(inv.total)}</td>
                      <td className="table-cell text-green-600">{formatCurrency(inv.paidAmount)}</td>
                      <td className="table-cell"><span className={`badge ${getStatusColor(inv.status)}`}>{getStatusLabel(inv.status)}</span></td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          {(inv.status === 'PENDING' || inv.status === 'PARTIALLY_PAID') && (
                            <>
                              <button className="btn-primary py-1 px-2 text-xs" onClick={() => { setCurrentInvoice(inv); setShowPayModal(true); }}>
                                <Banknote className="w-3.5 h-3.5" /> دفعة
                              </button>
                              <button className="btn-secondary py-1 px-2 text-xs" title="أقساط" onClick={() => openInstallments(inv)}>
                                <CalendarClock className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="طباعة" onClick={() => { setCurrentInvoice(inv); printInvoice(); }}>
                            <Printer className="w-4 h-4" />
                          </button>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="فاتورة جديدة" size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">المريض *</label>
              <select className="input" value={form.patientId || ''} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
                <option value="">اختر المريض</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الدكتور</label>
              <select className="input" value={form.doctorId || ''} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                <option value="">بدون</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-800">بنود الفاتورة</h4>
              <button type="button" className="btn-secondary py-1 px-2 text-xs" onClick={addItem}>+ إضافة بند</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input className="input" placeholder="الوصف" value={item.description || ''} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <input className="input" type="number" placeholder="الكمية" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <input className="input" type="number" placeholder="السعر" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} />
                  </div>
                  <div className="col-span-2 text-sm font-semibold text-gray-700">
                    {(item.unitPrice || 0) * (item.quantity || 0)}
                  </div>
                  <div className="col-span-1">
                    <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => removeItem(idx)}>×</button>
                  </div>
                </div>
              ))}
              {form.items.length === 0 && <p className="text-sm text-gray-400 text-center py-3">أضف بنود للفاتورة</p>}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 pt-3 border-t border-gray-100">
            <div>
              <label className="label">الخصم</label>
              <input className="input" type="number" value={form.discount || 0} onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">نسبة الضريبة %</label>
              <input className="input" type="number" value={form.taxRate || 0} onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">المجموع الفرعي</label>
              <div className="input bg-gray-50">{formatCurrency(subtotal)}</div>
            </div>
            <div>
              <label className="label">الإجمالي</label>
              <div className="input bg-primary-50 font-bold text-primary-700">{formatCurrency(total)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">إنشاء الفاتورة</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title={`دفعة: ${currentInvoice?.invoiceNumber}`} size="sm">
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex justify-between"><span className="text-gray-500">الإجمالي</span><span className="font-bold">{formatCurrency(currentInvoice?.total)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-gray-500">المتبقي</span><span className="font-bold text-red-600">{formatCurrency(currentInvoice?.dueAmount)}</span></div>
          </div>
          <div>
            <label className="label">المبلغ *</label>
            <input className="input" type="number" value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) })} required max={currentInvoice?.dueAmount} />
          </div>
          <div>
            <label className="label">طريقة الدفع</label>
            <select className="input" value={payForm.method || 'CASH'} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <input className="input" value={payForm.notes || ''} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowPayModal(false)}>إلغاء</button>
            <button type="submit" className="btn-primary">تسجيل الدفعة</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showInstModal} onClose={() => setShowInstModal(false)} title={`الأقساط: ${currentInvoice?.invoiceNumber}`} size="md">
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex justify-between"><span className="text-gray-500">الإجمالي</span><span className="font-bold">{formatCurrency(currentInvoice?.total)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-gray-500">المتبقي</span><span className="font-bold text-red-600">{formatCurrency(currentInvoice?.dueAmount)}</span></div>
          </div>

          {installments.length === 0 ? (
            <form onSubmit={createInstallmentPlan} className="space-y-4">
              <p className="text-sm text-gray-500">أنشئ خطة أقساط شهرية للفاتورة الحالية.</p>
              <div>
                <label className="label">عدد الأقساط</label>
                <input className="input" type="number" min="1" value={instForm.count} onChange={(e) => setInstForm({ ...instForm, count: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" className="btn-secondary" onClick={() => setShowInstModal(false)}>إلغاء</button>
                <button type="submit" className="btn-primary"><CalendarClock className="w-4 h-4" /> إنشاء خطة</button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              {installments.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-800">{formatCurrency(inst.amount)}</p>
                    <p className="text-xs text-gray-400">استحقاق {formatDate(inst.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${inst.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {inst.status === 'PAID' ? 'مدفوع' : 'معلق'}
                    </span>
                    {inst.status !== 'PAID' && (
                      <button className="btn-primary py-1 px-2 text-xs" onClick={() => payInstallment(inst)}><Banknote className="w-3.5 h-3.5" /> سداد</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
