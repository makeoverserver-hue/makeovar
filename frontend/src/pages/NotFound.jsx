import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200">404</h1>
        <p className="text-xl font-semibold text-gray-700 mt-2">الصفحة غير موجودة</p>
        <p className="text-gray-500 mt-1">عذراً، الصفحة التي تبحث عنها غير متوفرة</p>
        <Link to="/dashboard" className="btn-primary inline-flex mt-6">العودة للوحة التحكم</Link>
      </div>
    </div>
  );
}
