import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import Services from './pages/Services';
import Devices from './pages/Devices';
import Sessions from './pages/Sessions';
import TreatmentPlans from './pages/TreatmentPlans';
import Packages from './pages/Packages';
import Photos from './pages/Photos';
import Consents from './pages/Consents';
import FollowUps from './pages/FollowUps';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Staff from './pages/Staff';
import Reports from './pages/Reports';
import Branches from './pages/Branches';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import Expenses from './pages/Expenses';
import Laser from './pages/Laser';
import Accounting from './pages/Accounting';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="patients" element={<Patients />} />
              <Route path="patients/:id" element={<PatientDetail />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="services" element={<Services />} />
              <Route path="devices" element={<Devices />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="treatment-plans" element={<TreatmentPlans />} />
              <Route path="packages" element={<Packages />} />
              <Route path="photos" element={<Photos />} />
              <Route path="consents" element={<Consents />} />
              <Route path="follow-ups" element={<FollowUps />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="laser" element={<Laser />} />
              <Route path="accounting" element={<Accounting />} />
              <Route path="staff" element={<Staff />} />
              <Route path="reports" element={<Reports />} />
              <Route path="branches" element={<Branches />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
