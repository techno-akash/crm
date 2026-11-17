import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page">
      <h1 className="page-title">Page not found</h1>
      <p style={{ color: '#6b7280' }}>
        The page you are looking for does not exist. <Link to="/admin/licenses" style={{ color: '#0066ff' }}>Go to Licenses</Link>
      </p>
    </div>
  );
}
