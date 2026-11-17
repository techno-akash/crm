import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import LicensesPage from './pages/LicensesPage.jsx';
import LicenseFormPage from './pages/LicenseFormPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminLoginPage from './pages/auth/AdminLoginPage.jsx';
import CustomerLoginPage from './pages/auth/CustomerLoginPage.jsx';
import Verify2FAPage from './pages/auth/Verify2FAPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import AccountHomePage from './pages/auth/AccountHomePage.jsx';

function LegacyLicenseRedirect() {
  const location = useLocation();
  return <Navigate to={`${location.pathname.replace(/^\/licenses/, '/admin/licenses')}${location.search}${location.hash}`} replace />;
}

export default function App() {
  return (
    <AuthProvider><Routes>
      <Route path="/admin/authentication" element={<AdminLoginPage />} />
      <Route path="/admin/login" element={<Navigate to="/admin/authentication" replace />} />
      <Route path="/authentication/login" element={<CustomerLoginPage />} />
      <Route path="/login" element={<Navigate to="/authentication/login" replace />} />
      <Route path="/verify-2fa" element={<Verify2FAPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute allowedType="staff" />}>
        <Route element={<Layout />}>
          <Route path="/admin/" element={<AccountHomePage embedded />} />
          <Route path="/admin/licenses" element={<LicensesPage />} />
          <Route path="/admin/licenses/new" element={<LicenseFormPage mode="create" />} />
          <Route path="/admin/licenses/:id/edit" element={<LicenseFormPage mode="edit" />} />
          <Route path="/" element={<Navigate to="/admin/" replace />} />
          <Route path="/licenses/*" element={<LegacyLicenseRedirect />} />
          <Route path="/licenses" element={<LegacyLicenseRedirect />} />
          <Route path="/admin/*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedType="customer" />}>
        <Route path="/portal" element={<AccountHomePage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes></AuthProvider>
  );
}
