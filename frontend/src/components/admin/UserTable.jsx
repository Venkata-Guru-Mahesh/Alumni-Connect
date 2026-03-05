import { useState, useEffect } from 'react';
import { FiEdit2, FiTrash2, FiLock, FiUnlock, FiSearch, FiChevronDown } from 'react-icons/fi';
import { Pagination } from '../shared';

const ROLE_CONFIG = {
  student:   { label: 'Student',    dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  alumni:    { label: 'Alumni',     dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  counsellor:{ label: 'Counsellor', dot: 'bg-purple-500',  badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  hod:       { label: 'HOD',        dot: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  principal: { label: 'Principal',  dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700 border-rose-200' },
  admin:     { label: 'Admin',      dot: 'bg-indigo-600',  badge: 'bg-indigo-600 text-white border-indigo-600' },
};

const AVATAR_BG = {
  student:    'from-blue-400 to-blue-600',
  alumni:     'from-emerald-400 to-emerald-600',
  counsellor: 'from-purple-400 to-purple-600',
  hod:        'from-orange-400 to-orange-600',
  principal:  'from-rose-400 to-rose-600',
  admin:      'from-indigo-500 to-indigo-700',
};

const UserAvatar = ({ user }) => {
  const name = user.name || user.full_name || 'User';
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const gradient = AVATAR_BG[user.role] || 'from-gray-400 to-gray-600';

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={name}
        className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
      />
    );
  }
  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow-sm flex-shrink-0`}>
      {initials}
    </div>
  );
};

const UserTable = ({ users, onEdit, onDelete, onToggleStatus }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => { setCurrentPage(1); }, [searchTerm, roleFilter]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      (user.name || user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div>
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
        <div className="relative flex-1 max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all placeholder-gray-400"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all cursor-pointer"
          >
            <option value="">All Roles</option>
            {Object.entries(ROLE_CONFIG).map(([val, cfg]) => (
              <option key={val} value={val}>{cfg.label}</option>
            ))}
          </select>
          <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {(searchTerm || roleFilter) && (
          <button
            onClick={() => { setSearchTerm(''); setRoleFilter(''); }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            Clear filters
          </button>
        )}
        <div className="sm:ml-auto flex items-center text-sm text-gray-500 px-1">
          <span className="font-semibold text-gray-700">{filteredUsers.length}</span>
          &nbsp;user{filteredUsers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((user) => {
              const roleCfg = ROLE_CONFIG[user.role] || { label: user.role, dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700 border-gray-200' };
              const isActive = user.active !== false;
              const displayName = user.name || user.full_name || 'Unknown User';
              const joinedDate = user.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—';

              return (
                <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors group">
                  {/* User */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border capitalize ${roleCfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${roleCfg.dot} ${user.role === 'admin' ? 'bg-white/70' : ''}`} />
                      {roleCfg.label}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{joinedDate}</td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(user)}
                        title="Edit user"
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onToggleStatus(user)}
                        title={isActive ? 'Disable user' : 'Enable user'}
                        className={`p-2 rounded-lg transition-colors ${
                          isActive
                            ? 'text-gray-500 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {isActive ? <FiLock className="w-4 h-4" /> : <FiUnlock className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => onDelete(user)}
                        title="Delete user"
                        className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredUsers.length > itemsPerPage && (
        <div className="px-4 py-3 border-t border-gray-100">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredUsers.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            totalItems={filteredUsers.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      )}

      {filteredUsers.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <FiSearch className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No users found</p>
          {(searchTerm || roleFilter) && (
            <p className="text-xs mt-1">Try adjusting your search or filters</p>
          )}
        </div>
      )}
    </div>
  );
};

export default UserTable;

