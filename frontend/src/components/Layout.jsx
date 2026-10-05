import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, Sparkles, Cpu, Stethoscope, FileText,
  Package, Camera, ClipboardList, Receipt, Package2, Users2, BarChart3,
  Bell, Settings, Building2, History, LogOut, Menu, X, HeartPulse, PhoneCall, Wallet, CheckCheck, Zap,
} from 'lucide-react';
import { useAuth, ROLE_LABELS } from '../context/AuthContext';
import { getInitials, formatDate } from '../utils/format';
import api from '../services/api';

const navSections = [
  {
    title: 'الرئيسية',
    items: [
      { to: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    ],
  },
  {
    title: 'المرضى',
    items: [
      { to: '/patients', label: 'المرضى', icon: Users },
      { to: '/appointments', label: 'المواعيد', icon: CalendarDays },
      { to: '/follow-ups', label: 'متابعة المرضى', icon: PhoneCall },
    ],
  },
  {
    title: 'العلاج',
    items: [
      { to: '/services', label: 'الخدمات', icon: Sparkles },
      { to: '/devices', label: 'الأجهزة', icon: Cpu },
      { to: '/sessions', label: 'جلسات العلاج', icon: Stethoscope },
      { to: '/treatment-plans', label: 'خطط العلاج', icon: FileText },
      { to: '/packages', label: 'الباقات', icon: Package },
    ],
  },
  {
    title: 'الليزر',
    items: [
      { to: '/laser', label: 'وحدة الليزر', icon: Zap },
    ],
  },
  {
    title: 'الملفات',
    items: [
      { to: '/photos', label: 'الصور قبل/بعد', icon: Camera },
      { to: '/consents', label: 'نماذج الموافقة', icon: ClipboardList },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { to: '/invoices', label: 'الفواتير', icon: Receipt },
      { to: '/inventory', label: 'المخزون', icon: Package2 },
      { to: '/expenses', label: 'المصروفات', icon: Wallet },
      { to: '/staff', label: 'الموظفين والعمولات', icon: Users2 },
      { to: '/reports', label: 'التقارير', icon: BarChart3 },
      { to: '/accounting', label: 'المحاسبة', icon: Wallet },
    ],
  },
  {
    title: 'النظام',
    items: [
      { to: '/branches', label: 'الفروع', icon: Building2 },
      { to: '/audit-logs', label: 'سجل التدقيق', icon: History },
      { to: '/settings', label: 'الإعدادات', icon: Settings },
    ],
  },
];

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <HeartPulse className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-sm">عيادة التجميل</div>
          <div className="text-white/50 text-xs">نظام الإدارة المتكامل</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const load = () => api.get('/settings/notifications').then(({ data }) => {
      setList(data.data.notifications);
      setUnread(data.data.unreadCount);
    }).catch(() => {});
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAll = async () => {
    try { await api.patch('/settings/notifications/read-all'); setUnread(0); setList((l) => l.map((n) => ({ ...n, isRead: true }))); } catch (e) {}
  };
  const markOne = async (id) => {
    try { await api.patch(`/settings/notifications/${id}/read`); setUnread((u) => Math.max(0, u - 1)); setList((l) => l.map((n) => (n.id === id ? { ...n, isRead: true } : n))); } catch (e) {}
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white" title="الإشعارات">
        <Bell className="w-4 h-4" />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">{unread}</span>}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-gray-800">الإشعارات</span>
            {unread > 0 && <button onClick={markAll} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> قراءة الكل</button>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {list.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">لا توجد إشعارات</p>
            ) : list.map((n) => (
              <button key={n.id} onClick={() => !n.isRead && markOne(n.id)} className={`w-full text-right px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${n.isRead ? '' : 'bg-primary-50/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800">{n.title}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatDate(n.createdAt)}</span>
                </div>
                {n.message && <p className="text-xs text-gray-500 mt-1">{n.message}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 right-0 w-64 bg-gray-900 flex-col z-40">
        <SidebarContent />
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
              {getInitials(user?.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{user?.fullName}</div>
              <div className="text-white/50 text-xs">{ROLE_LABELS[user?.role]}</div>
            </div>
            <NotificationBell />
            <button onClick={handleLogout} className="flex items-center gap-2 text-white/50 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition" title="تسجيل الخروج">
              <LogOut className="w-4 h-4" />
              <span className="text-xs">خروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 right-0 w-72 bg-gray-900 flex flex-col z-50">
            <button className="absolute top-4 left-4 text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X className="w-6 h-6" />
            </button>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            <div className="px-4 py-4 border-t border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
                  {getInitials(user?.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{user?.fullName}</div>
                  <div className="text-white/50 text-xs">{ROLE_LABELS[user?.role]}</div>
                </div>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-white/60 hover:text-white px-3 py-2.5 rounded-lg hover:bg-white/10 transition border border-white/10">
                <LogOut className="w-4 h-4" />
                <span className="text-sm">تسجيل الخروج</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:mr-64">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <div className="text-sm font-bold text-gray-800">نظام إدارة العيادة</div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="تسجيل الخروج">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-6 lg:max-w-[1400px] lg:mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
