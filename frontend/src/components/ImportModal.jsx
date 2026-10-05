import { useState, useRef } from 'react';
import { FileDown, Upload, X, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from './Toast';
import { LoadingSpinner } from './common';
import { Modal } from './Modal';

export default function ImportModal({ isOpen, onClose, type, onImported }) {
  // type: 'services' | 'patients' | 'inventory'
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const { showToast } = useToast();

  const labels = {
    services: { title: 'استيراد الخدمات', fileLabel: 'ملف الخدمات', singular: 'خدمة' },
    patients: { title: 'استيراد المرضى', fileLabel: 'ملف المرضى', singular: 'مريض' },
    inventory: { title: 'استيراد المنتجات', fileLabel: 'ملف المنتجات', singular: 'منتج' },
  }[type];

  const downloadTemplate = async () => {
    try {
      const res = await api.get(`/import/templates/${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-import-template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
  };

  const handleUpload = async () => {
    if (!file) { showToast('اختر ملف أولاً', 'error'); return; }
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/import/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data.data);
      showToast(data.message, 'success');
      if (onImported) onImported();
    } catch (e) { showToast(getErrorMessage(e), 'error'); }
    finally { setUploading(false); }
  };

  const close = () => { setFile(null); setResult(null); setUploading(false); fileRef.current && (fileRef.current.value = ''); onClose(); };

  return (
    <Modal isOpen={isOpen} onClose={close} title={labels.title} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">استيراد بالجملة من ملف Excel (.xlsx). حمّل القالب أولاً لتعبئته ثم ارفعه.</p>

        <div className="flex gap-3">
          <button type="button" onClick={downloadTemplate} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <FileDown className="w-4 h-4" /> تحميل القالب
          </button>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-green-400 transition"
          onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">{file ? file.name : 'اضغط لاختيار ملف Excel'}</p>
          <p className="text-xs text-gray-400 mt-1">xlsx / xls / csv — بحد أقصى 10MB</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        {result && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> تم استيراد <b>{result.created}</b> {labels.singular}
              {result.skipped > 0 && <span className="text-gray-500">— تخطّى {result.skipped} (مكرر/غير صالح)</span>}
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto bg-white rounded border border-red-100 p-2 space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-1 text-xs text-red-700">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> <span>{e}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={close}><X className="w-4 h-4" /> إغلاق</button>
          <button type="button" className="btn-primary" onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? <LoadingSpinner full /> : <><Upload className="w-4 h-4" /> استيراد</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}