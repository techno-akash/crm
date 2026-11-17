import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell, CheckSquare, Clock, Plus, Search, Settings, Share2
} from 'lucide-react';
import { CURRENT_USER } from '../../constants/app.js';

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Topbar() {
  const [query, setQuery] = useState('');
  const location = useLocation();
  const onLicenses = location.pathname.startsWith('/licenses');

  const submit = useMemo(() => (event) => event.preventDefault(), []);

  return (
    <>
      <div className="topbar-search">
        <form onSubmit={submit} className="search-form" role="search">
          <Search size={16} className="search-icon" />
          <input
            type="search"
            placeholder="Search..."
            aria-label="Global search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {onLicenses && (
            <button type="submit" className="search-add" aria-label="Quick create" title="New License">
              <Plus size={15} strokeWidth={3} />
            </button>
          )}
        </form>
      </div>

      <div className="topbar-actions">
        <button type="button" className="topbar-settings">
          <Settings size={17} />
          <span className="settings-label">Settings</span>
        </button>
        <button type="button" className="icon-btn" aria-label="Share"><Share2 size={17} /></button>
        <button type="button" className="icon-btn" aria-label="Tasks"><CheckSquare size={17} /></button>
        <button type="button" className="icon-btn" aria-label="Recent"><Clock size={17} /></button>
        <button type="button" className="icon-btn has-dot" aria-label="Notifications">
          <Bell size={17} />
        </button>
        <div className="topbar-avatar" title={CURRENT_USER.name} aria-label={CURRENT_USER.name}>
          {initials(CURRENT_USER.name)}
        </div>
      </div>
    </>
  );
}
