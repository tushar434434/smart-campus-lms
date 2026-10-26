import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types/api';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { label: 'Overview', to: '/', icon: LayoutDashboard },
  { label: 'Courses', to: '/courses', icon: BookOpen },
  { label: 'Students', to: '/students', icon: Users, roles: ['faculty', 'admin'] },
  { label: 'Assignments', to: '/assignments', icon: ClipboardList },
  { label: 'Quizzes', to: '/quizzes', icon: GraduationCap },
];

function pageTitle(path: string) {
  if (path.startsWith('/courses/')) return 'Course overview';
  if (path.startsWith('/students/')) return 'Student profile';
  return navItems.find((item) => item.to === path)?.label ?? 'Learning workspace';
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return null;

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      {drawerOpen && <button className="drawer-scrim" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />}
      <aside className={`sidebar ${drawerOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={21} /></div>
          <div><strong>Smart Campus</strong><span>Learning platform</span></div>
          <button className="drawer-close icon-button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><BookOpen size={17} /></div>
            <strong>Need a hand?</strong>
            <p>Some student workflows require a linked campus record.</p>
          </div>
          <div className="sidebar-version">SMART CAMPUS LMS <span>v1.0</span></div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="topbar-context">
            <span className="topbar-eyebrow">SMART CAMPUS LMS</span>
            <h1>{pageTitle(location.pathname)}</h1>
          </div>
          <div className="topbar-actions">
            <div className="profile-wrap">
              <button className="profile-button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
                <span className="avatar">{user.name.trim().charAt(0).toUpperCase()}</span>
                <span className="profile-copy"><strong>{user.name}</strong><small>{user.role}</small></span>
                <ChevronDown size={16} className="profile-chevron" />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-id"><strong>{user.name}</strong><span>{user.email}</span></div>
                  <button onClick={signOut}><LogOut size={16} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
