import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export function SearchInput({ value, onChange, placeholder = 'بحث...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <Search className="h-4 w-4 text-gray-400" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pr-10"
      />
    </div>
  );
}

export function Pagination({ page, totalPages, onPageChange, total, limit }) {
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 gap-4">
      <div className="text-xs text-gray-500">
        عرض <span className="font-medium text-gray-700">{from}</span> إلى{' '}
        <span className="font-medium text-gray-700">{to}</span> من أصل{' '}
        <span className="font-medium text-gray-700">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="px-3 py-1 text-sm font-medium text-gray-700">
          {page} / {totalPages || 1}
        </span>
        <button
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function LoadingSpinner({ full = false }) {
  const content = (
    <div className="flex items-center justify-center gap-2 text-gray-500 py-8">
      <div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">جاري التحميل...</span>
    </div>
  );
  if (full) {
    return <div className="flex items-center justify-center min-h-[60vh]">{content}</div>;
  }
  return content;
}

export function EmptyState({ message = 'لا توجد بيانات', icon: Icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon className="w-12 h-12 text-gray-300 mb-3" />}
      <p className="text-gray-500 text-sm mb-4">{message}</p>
      {action}
    </div>
  );
}

export function Badge({ status }) {
  return null;
}

export function Select({ options, value, onChange, label, name, placeholder = 'اختر...', className = '' }) {
  return (
    <div>
      {label && <label className="label" htmlFor={name}>{label}</label>}
      <select
        id={name}
        name={name}
        value={value || ''}
        onChange={onChange}
        className={`input ${className}`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => {
          if (typeof opt === 'string') {
            return <option key={opt} value={opt}>{opt}</option>;
          }
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
