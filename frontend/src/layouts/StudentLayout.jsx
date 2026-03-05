import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar, Sidebar } from '../components/shared';
import { SCOPES } from '../constants/roles';

const StudentLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);

  const menuItems = [
    {
      label: 'Home',
      path: '/student/home',
      icon: 'home',
    },
    {
      label: 'Alumni Directory',
      path: '/student/alumni',
      icon: 'users',
      scope: SCOPES.VIEW_ALUMNI,
    },
    {
      label: 'Events',
      path: '/student/events',
      icon: 'calendar',
      scope: SCOPES.VIEW_EVENTS,
    },
    {
      label: 'Jobs & Internships',
      path: '/student/jobs',
      icon: 'briefcase',
      scope: SCOPES.VIEW_JOBS,
    },
    {
      label: 'Saved Items',
      path: '/student/saved-jobs',
      icon: 'bookmark',
      scope: SCOPES.VIEW_JOBS,
    },
    {
      label: 'AI Career',
      path: '/student/career',
      icon: 'cpu',
      scope: SCOPES.AI_RECOMMENDATIONS,
    },
    {
      label: 'Profile',
      path: '/student/profile',
      icon: 'user',
      scope: SCOPES.EDIT_PROFILE,
    },
    {
      label: 'Settings',
      path: '/student/settings',
      icon: 'settings',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        title="Student Dashboard"
      />
      
      <Sidebar
        menuItems={menuItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className={`pt-16 min-h-screen transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default StudentLayout;
