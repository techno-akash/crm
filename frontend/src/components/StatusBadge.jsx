const BADGE_CLASS = {
  active: 'badge-active',
  inactive: 'badge-inactive',
  suspended: 'badge-suspended',
  expired: 'badge-expired'
};

export default function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase();
  const label = key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : '';
  return <span className={`status-badge ${BADGE_CLASS[key] || 'badge-inactive'}`}>{label}</span>;
}
