import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown, ChevronLeft, LayoutDashboard
} from 'lucide-react';
import ProfileMenu from '../ProfileMenu.jsx';

function LicenseIcon({ className, ...props }) {
  return (
    <svg {...props} viewBox="0 0 640 640" fill="currentColor" className={className} aria-hidden="true">
      <path d="M32 160C32 124.7 60.7 96 96 96L544 96C579.3 96 608 124.7 608 160L32 160zM32 208L608 208L608 480C608 515.3 579.3 544 544 544L96 544C60.7 544 32 515.3 32 480L32 208zM279.3 480C299.5 480 314.6 460.6 301.7 445C287 427.3 264.8 416 240 416L176 416C151.2 416 129 427.3 114.3 445C101.4 460.6 116.5 480 136.7 480L279.2 480zM208 376C238.9 376 264 350.9 264 320C264 289.1 238.9 264 208 264C177.1 264 152 289.1 152 320C152 350.9 177.1 376 208 376zM392 272C378.7 272 368 282.7 368 296C368 309.3 378.7 320 392 320L504 320C517.3 320 528 309.3 528 296C528 282.7 517.3 272 504 272L392 272zM392 368C378.7 368 368 378.7 368 392C368 405.3 378.7 416 392 416L504 416C517.3 416 528 405.3 528 392C528 378.7 517.3 368 504 368L392 368z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin/' },
  {
    label: 'License',
    icon: LicenseIcon,
    defaultOpen: true,
    children: [
      { label: 'Client License', to: '/admin/licenses' },
      { label: 'Associated Products' }
    ]
  }
];

function isLicenseRoute(pathname) {
  return pathname.startsWith('/admin/licenses');
}

function NavGroup({ item, open, onToggle }) {
  const Icon = item.icon;
  const location = useLocation();
  const active = item.children?.some((child) => child.to && location.pathname.startsWith(child.to));
  if (item.collapsed) {
    return (
      <li className="nav-group">
        <button type="button" className="nav-link nav-group-btn" aria-expanded={false}>
          <Icon size={18} strokeWidth={2} className="nav-icon menu-icon" />
          <span className="nav-label">{item.label}</span>
          <ChevronLeft size={14} className="nav-caret" />
        </button>
      </li>
    );
  }
  return (
    <li className={`nav-group${open ? ' open' : ''}${active ? ' active' : ''}`}>
      <button type="button" className="nav-link nav-group-btn" onClick={onToggle} aria-expanded={open}>
        <Icon size={18} strokeWidth={2} className="nav-icon menu-icon" />
        <span className="nav-label">{item.label}</span>
        {open ? <ChevronDown size={14} className="nav-caret" /> : <ChevronLeft size={14} className="nav-caret" />}
      </button>
      <ul className="nav-sub">
        {item.children.map((child) => (
          <li key={child.label}>
            {child.to ? (
              <NavLink to={child.to} className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                {child.label}
              </NavLink>
            ) : (
              <span className="nav-sub-link">{child.label}</span>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation();
  const initialOpen = useMemo(() => {
    const open = {};
    NAV_ITEMS.forEach((item) => {
      if (item.children && item.defaultOpen) open[item.label] = true;
    });
    return open;
  }, []);

  const [openGroups, setOpenGroups] = useState(initialOpen);

  useEffect(() => {
    if (isLicenseRoute(location.pathname)) {
      setOpenGroups((prev) => ({ ...prev, License: true }));
    }
  }, [location.pathname]);

  const toggle = (label) => setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`} aria-label="Main navigation">
      <ProfileMenu />

      <nav className="sidebar-nav">
        <ul className="nav-list">
          {NAV_ITEMS.map((item) =>
            item.children || item.collapsed ? (
              <NavGroup
                key={item.label}
                item={item}
                open={Boolean(openGroups[item.label])}
                onToggle={() => toggle(item.label)}
              />
            ) : (
              <li key={item.label}>
                <NavLink to={item.to} end={item.to === '/admin/'} className="nav-link">
                  <item.icon size={18} strokeWidth={2} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              </li>
            )
          )}
        </ul>
      </nav>
    </aside>
  );
}
