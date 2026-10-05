import { useState, useEffect, useCallback, useMemo } from 'react';
import { Camera, Upload, Trash2, ArrowLeftRight } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useToast } from '../components/Toast';
import { SearchInput, LoadingSpinner, EmptyState, Select } from '../components/common';
import { Modal } from '../components/Modal';
import { formatDate, getInitials } from '../utils/format';

const PHOTO_TYPES = [
  { value: 'BEFORE', label: 'قبل' },
  { value: 'AFTER', label: 'بعد' },
  { value: 'PROGRESS', label: 'تقدم' },
];

function CompareModal({ candidates, onClose }) {
  const [patientId, setPatientId] = useState(candidates[0]?.patient.id || '');
  const [pos, setPos] = useState(50);

  const group = candidates.find((c) => c.patient.id === patientId) || candidates[0];
  const pair = useMemo(() => {
    if (!group) return null;
    const cats = [...new Set(group.before.map((b) => b.category).filter(Boolean))];
    const afterMatched = group.after.find((a) => cats.includes(a.category));
    const beforeMatched = group.before.find((b) => b.category === afterMatched?.category);
    return {
      before: beforeMatched || group.before[0],
      after: afterMatched || group.after[0],
    };
  }, [group]);

  if (!group || !pair) return null;
  const photoUrl = (photo) => `/uploads/${photo.filePath.split('uploads/')[1] || photo.filePath}`;

  return (
    <Modal isOpen onClose={onClose} title="مقارنة قبل / بعد" size="lg">
      <div className="space-y-4">
        {candidates.length > 1 && (
          <div>
            <label className="label">المريض</label>
            <select className="input" value={group.patient.id} onChange={(e) => setPatientId(e.target.value)}>
              {candidates.map((c) => <option key={c.patient.id} value={c.patient.id}>{c.patient.fullName}</option>)}
            </select>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800">قبل</p>
            <p className="text-xs text-gray-400 mt-1">{pair.before.category || 'بدون فئة'} • {formatDate(pair.before.createdAt)}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">بعد</p>
            <p className="text-xs text-gray-400 mt-1">{pair.after.category || 'بدون فئة'} • {formatDate(pair.after.createdAt)}</p>
          </div>
        </div>
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden select-none" dir="ltr">
          <img src={photoUrl(pair.after)} alt="بعد" className="absolute inset-0 w-full h-full object-cover" />
          <img src={photoUrl(pair.before)} alt="قبل" className="absolute inset-0 w-full h-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10" style={{ left: `${pos}%` }} />
          <div className="absolute top-2 left-2 badge bg-black/60 text-white z-10">قبل</div>
          <div className="absolute top-2 right-2 badge bg-black/60 text-white z-10">بعد</div>
          <input
            type="range" min={0} max={100} value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
            aria-label="شريط المقارنة"
          />
        </div>
        <p className="text-xs text-gray-400 text-center">اسحب فوق الصورة لتحريك خط المقارنة</p>
      </div>
    </Modal>
  );
}

export default function Photos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photoType, setPhotoType] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [uploadForm, setUploadForm] = useState({});
  const [patients, setPatients] = useState([]);
  const [file, setFile] = useState(null);
  const { showToast } = useToast();

  const compareCandidates = useMemo(() => {
    const map = {};
    photos.forEach((ph) => {
      if (!map[ph.patientId]) map[ph.patientId] = { patient: ph.patient, before: [], after: [] };
      if (ph.photoType === 'BEFORE') map[ph.patientId].before.push(ph);
      if (ph.photoType === 'AFTER') map[ph.patientId].after.push(ph);
    });
    return Object.values(map).filter((g) => g.before.length > 0 && g.after.length > 0);
  }, [photos]);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (photoType) params.photoType = photoType;
      const { data } = await api.get('/system/photos', { params });
      setPhotos(data.data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [photoType]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);
  useEffect(() => {
    api.get('/patients', { params: { limit: 100 } }).then(({ data }) => setPatients(data.data)).catch(() => {});
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !uploadForm.patientId) {
      showToast('اختر مريض وصورة', 'error');
      return;
    }
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('patientId', uploadForm.patientId);
    fd.append('photoType', uploadForm.photoType || 'BEFORE');
    if (uploadForm.category) fd.append('category', uploadForm.category);
    if (uploadForm.description) fd.append('description', uploadForm.description);
    try {
      await api.post('/patients/photos', fd);
      showToast('تم رفع الصورة', 'success');
      setShowUpload(false);
      setUploadForm({});
      setFile(null);
      fetchPhotos();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const deletePhoto = async (id) => {
    try {
      await api.delete(`/patients/photos/${id}`);
      showToast('تم حذف الصورة', 'success');
      fetchPhotos();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const getPhotoUrl = (photo) => {
    const path = photo.filePath.split('uploads/')[1] || photo.filePath;
    return `/uploads/${path}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الصور قبل / بعد</h1>
          <p className="text-gray-500 text-sm mt-1">{photos.length} صورة</p>
        </div>
        <button className="btn-secondary" disabled={compareCandidates.length === 0} onClick={() => setShowCompare(true)}>
          <ArrowLeftRight className="w-4 h-4" /> قارن قبل/بعد
        </button>
        <button className="btn-primary" onClick={() => setShowUpload(true)}><Upload className="w-4 h-4" /> رفع صورة</button>
      </div>

      {compareCandidates.length > 0 && (
        <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-primary-700">
            {compareCandidates.length} مريض لديهم صور قبل وبعد — جاهزون للمقارنة
          </p>
          <button className="btn-secondary btn-sm" onClick={() => setShowCompare(true)}>فتح المقارنة</button>
        </div>
      )}

      <div className="w-44">
        <Select value={photoType} onChange={(e) => setPhotoType(e.target.value)} options={PHOTO_TYPES} placeholder="كل الأنواع" />
      </div>

      {loading ? <LoadingSpinner /> : photos.length === 0 ? <EmptyState message="لا توجد صور" icon={Camera} /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="bg-white rounded-xl shadow-card overflow-hidden group">
              <div className="aspect-[4/3] bg-gray-100 relative">
                <img src={getPhotoUrl(photo)} alt={photo.description || 'صورة'} className="w-full h-full object-cover" />
                <span className="absolute top-2 right-2 badge bg-white/90 shadow">
                  {PHOTO_TYPES.find(t => t.value === photo.photoType)?.label || photo.photoType}
                </span>
                <button onClick={() => deletePhoto(photo.id)} className="absolute top-2 left-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-[10px] font-bold">{getInitials(photo.patient.fullName)}</span>
                  {photo.patient.fullName}
                </p>
                <p className="text-xs text-gray-400 mt-1">{photo.description} • {formatDate(photo.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="رفع صورة" size="md">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="label">المريض *</label>
            <select className="input" value={uploadForm.patientId || ''} onChange={(e) => setUploadForm({ ...uploadForm, patientId: e.target.value })} required>
              <option value="">اختر المريض</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">النوع</label>
            <select className="input" value={uploadForm.photoType || 'BEFORE'} onChange={(e) => setUploadForm({ ...uploadForm, photoType: e.target.value })}>
              {PHOTO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">المنطقة / الفئة</label>
            <input className="input" placeholder="مثال: الوجه، الجسم" value={uploadForm.category || ''} onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })} />
          </div>
          <div>
            <label className="label">الوصف</label>
            <input className="input" value={uploadForm.description || ''} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} />
          </div>
          <div>
            <label className="label">الصورة *</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} required />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowUpload(false)}>إلغاء</button>
            <button type="submit" className="btn-primary"><Upload className="w-4 h-4" /> رفع</button>
          </div>
        </form>
      </Modal>

      {showCompare && compareCandidates.length > 0 && (
        <CompareModal candidates={compareCandidates} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}
