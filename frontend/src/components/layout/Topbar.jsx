import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell, CheckSquare, Clock, Plus, Search, Settings, Share2
} from 'lucide-react';
import ProfileMenu from '../ProfileMenu.jsx';

export default function Topbar() {
  const [query, setQuery] = useState('');
  const location = useLocation();
  const onLicenses = location.pathname.startsWith('/admin/licenses');

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
        <ProfileMenu compact />
      </div>
    </>
  );
}
