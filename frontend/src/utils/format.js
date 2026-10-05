export const formatDate = (date, opts = {}) => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', ...opts });
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d)) return '—';
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
};

export const formatCurrency = (amount, currency = 'SAR') => {
  const value = Number(amount || 0);
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatNumber = (num) => {
  return new Intl.NumberFormat('ar-EG').format(Number(num || 0));
};

export const getStatusColor = (status) => {
  const map = {
    ACTIVE: 'bg-green-100 text-green-700',
    INACTIVE: 'bg-gray-100 text-gray-600',
    SUSPENDED: 'bg-red-100 text-red-700',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    CONFIRMED: 'bg-indigo-100 text-indigo-700',
    CHECKED_IN: 'bg-teal-100 text-teal-700',
    IN_PROGRESS: 'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    NO_SHOW: 'bg-gray-100 text-gray-600',
    PAID: 'bg-green-100 text-green-700',
    PENDING: 'bg-amber-100 text-amber-700',
    PARTIALLY_PAID: 'bg-orange-100 text-orange-700',
    DRAFT: 'bg-gray-100 text-gray-600',
    REFUNDED: 'bg-purple-100 text-purple-700',
    AVAILABLE: 'bg-green-100 text-green-700',
    IN_USE: 'bg-blue-100 text-blue-700',
    MAINTENANCE: 'bg-amber-100 text-amber-700',
    OUT_OF_ORDER: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

export const getStatusLabel = (status) => {
  const map = {
    ACTIVE: 'نشط',
    INACTIVE: 'غير نشط',
    SUSPENDED: 'موقوف',
    SCHEDULED: 'مجدول',
    CONFIRMED: 'مؤكد',
    CHECKED_IN: 'تم الحضور',
    IN_PROGRESS: 'قيد التنفيذ',
    COMPLETED: 'مكتمل',
    CANCELLED: 'ملغي',
    NO_SHOW: 'لم يحضر',
    PAID: 'مدفوع',
    PENDING: 'قيد الانتظار',
    PARTIALLY_PAID: 'مدفوع جزئياً',
    DRAFT: 'مسودة',
    REFUNDED: 'مسترجع',
    AVAILABLE: 'متاح',
    IN_USE: 'قيد الاستخدام',
    MAINTENANCE: 'صيانة',
    OUT_OF_ORDER: 'معطل',
    active: 'نشط',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    onhold: 'معلق',
  };
  return map[status] || status;
};

export const getInitials = (name) => {
  if (!name) return '؟';
  return name.trim().split(' ').slice(0, 2).map((n) => n[0]).join('');
};

export const toLocalDateStr = (date) => {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d)) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const getPaymentMethodLabel = (method) => {
  const map = {
    CASH: 'نقداً',
    CARD: 'بطاقة',
    BANK_TRANSFER: 'تحويل بنكي',
    ONLINE: 'أونلاين',
    OTHER: 'أخرى',
  };
  return map[method] || method;
};
