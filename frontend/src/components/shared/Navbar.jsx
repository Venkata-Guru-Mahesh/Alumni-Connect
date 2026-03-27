import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiMenu,
  FiUser,
  FiSettings,
  FiLogOut,
  FiChevronDown,
} from 'react-icons/fi';

const Navbar = ({ onMenuClick, title }) => {
  const { user, profile, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Check if profile is in old format (snake_case) and needs refresh
  useEffect(() => {
    if (profile && profile.roll_no && !profile.rollNumber) {
      // Clear old format data and force re-login to get new camelCase format
      localStorage.removeItem('profile');
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
  }, [profile]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="px-4 h-16 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle sidebar"
          >
            <FiMenu className="w-6 h-6" />
          </button>
          
          <Link to="/" className="flex items-center gap-2">
            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXUjEM0r0I5UGvyH_3xy596muEJhbvBMVasg&s" alt="VVITU" className="h-8 rounded" />
            <span className="font-bold text-xl text-gray-900 hidden sm:block">
              VVITU Alumni
            </span>
          </Link>

          {title && (
            <div className="hidden md:block">
              <span className="text-gray-400 mx-2">/</span>
              <span className="text-gray-600 font-medium">{title}</span>
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Account Name / Roll Number */}
          {profile && (profile.rollNumber || profile.rollNo) && (
            <div className="hidden sm:flex items-center px-3 py-2 bg-gray-100 rounded-lg">
              <span className="text-sm font-medium text-gray-700">
                {profile.rollNumber || profile.rollNo}
              </span>
            </div>
          )}

          {/* User Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
            >
              {/* Profile Image or Initials */}
              {(user?.avatar || profile?.profileImage || profile?.profilePicture) ? (
                <img 
                  src={user?.avatar || profile?.profileImage || profile?.profilePicture} 
                  alt={`${profile?.firstName || user?.firstName} ${profile?.lastName || user?.lastName}`}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-700 font-medium text-sm">
                    {(profile?.firstName?.[0] || user?.firstName?.[0] || '')}
                    {(profile?.lastName?.[0] || user?.lastName?.[0] || '')}
                  </span>
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.firstName || user?.firstName} {profile?.lastName || user?.lastName}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <FiChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2">
                <div className="px-4 py-3 border-b border-gray-100 md:hidden">
                  <p className="font-medium text-gray-900">
                    {profile?.firstName || user?.firstName} {profile?.lastName || user?.lastName}
                  </p>
                  <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
                  {profile && (profile.rollNumber || profile.rollNo) && (
                    <p className="text-xs text-gray-600 mt-1">
                      {profile.rollNumber || profile.rollNo}
                    </p>
                  )}
                </div>
                <Link
                  to={`/${user?.role}/profile`}
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  <FiUser className="w-4 h-4" />
                  <span>Profile</span>
                </Link>
                <Link
                  to={`/${user?.role}/settings`}
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  <FiSettings className="w-4 h-4" />
                  <span>Settings</span>
                </Link>
                <hr className="my-2 border-gray-100" />
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    logout();
                  }}
                  className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 w-full"
                >
                  <FiLogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
