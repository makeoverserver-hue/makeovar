import { useState, useEffect, useCallback } from 'react';
import { History, Eye } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { Pagination, LoadingSpinner, EmptyState } from '../components/common';
import { Modal } from '../components/Modal';
import { formatDateTime, getInitials } from '../utils/format';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, limit: 30 });
  const [selected, setSelected] = useState(null);
  const { showToast } = useToast();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/system/audit-logs', { params: { page, limit: meta.limit } });
      setLogs(data.data);
      setMeta(data.meta);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const parseDetails = (details) => {
    if (!details) return null;
    try { return JSON.parse(details); } catch { return details; }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">سجل التدقيق</h1>
        <p className="text-gray-500 text-sm mt-1">تتبع جميع العمليات في النظام</p>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? <LoadingSpinner /> : logs.length === 0 ? <EmptyState message="لا توجد سجلات" icon={History} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">الوقت</th>
                    <th className="table-header">المستخدم</th>
                    <th className="table-header">الإجراء</th>
                    <th className="table-header">الكيان</th>
                    <th className="table-header">IP</th>
                    <th className="table-header">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="table-cell text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-[10px] font-bold">{getInitials(log.user?.fullName)}</div>
                          <span className="font-semibold text-gray-800">{log.user?.fullName || 'النظام'}</span>
                        </div>
                      </td>
                      <td className="table-cell"><span className="badge bg-blue-50 text-blue-700 font-mono text-[10px]">{log.action}</span></td>
                      <td className="table-cell text-xs text-gray-500">{log.entityType || '—'}</td>
                      <td className="table-cell text-xs text-gray-400" dir="ltr">{log.ip || '—'}</td>
                      <td className="table-cell">
                        {log.details && (
                          <button className="btn-secondary py-1 px-2 text-xs" onClick={() => setSelected(log)}><Eye className="w-3 h-3" /> عرض</button>
                        )}
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

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="تفاصيل السجل" size="md">
        {selected && (
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-400">الإجراء: </span><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{selected.action}</code></div>
            <div><span className="text-gray-400">المستخدم: </span>{selected.user?.fullName || 'النظام'}</div>
            <div><span className="text-gray-400">الكيان: </span>{selected.entityType} / {selected.entityId || '—'}</div>
            <div><span className="text-gray-400">الوقت: </span>{formatDateTime(selected.createdAt)}</div>
            {selected.details && (
              <div>
                <div className="text-gray-400 mb-1">التفاصيل:</div>
                <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">{typeof parseDetails(selected.details) === 'string' ? parseDetails(selected.details) : JSON.stringify(parseDetails(selected.details), null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
