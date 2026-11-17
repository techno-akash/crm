import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import LicensesPage from './pages/LicensesPage.jsx';
import LicenseFormPage from './pages/LicenseFormPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LicensesPage />} />
        <Route path="/licenses" element={<LicensesPage />} />
        <Route path="/licenses/new" element={<LicenseFormPage mode="create" />} />
        <Route path="/licenses/:id/edit" element={<LicenseFormPage mode="edit" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
