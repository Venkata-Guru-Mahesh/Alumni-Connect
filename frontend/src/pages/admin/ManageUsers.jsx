import { useState, useEffect } from 'react';
import adminApi from '../../api/admin.api';
import { UserTable, UserEditModal } from '../../components/admin';
import { Loader, ErrorAlert, ConfirmModal } from '../../components/shared';
import { FiUsers, FiUserCheck, FiUserX, FiShield } from 'react-icons/fi';

const StatCard = ({ icon: Icon, label, value, colorClass, bgClass, borderClass }) => (
  <div className={`rounded-xl border ${borderClass} ${bgClass} p-5 flex items-center gap-4 shadow-sm`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass} bg-white/60 shadow-sm flex-shrink-0`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${colorClass} opacity-80`}>{label}</p>
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  </div>
);

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [toggleUser, setToggleUser] = useState(null);
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getUsers();
      const usersData = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
      setUsers(usersData);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userData) => {
    try {
      setProcessing(true);
      await adminApi.updateUser(userData.id, userData);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      setError('Failed to update user');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setProcessing(true);
      await adminApi.deleteUser(deleteUser.id);
      setDeleteUser(null);
      fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      setProcessing(true);
      await adminApi.toggleUserStatus(toggleUser.id);
      setToggleUser(null);
      fetchUsers();
    } catch (err) {
      setError('Failed to update user status');
    } finally {
      setProcessing(false);
    }
  };

  const activeCount = users.filter((u) => u.active !== false).length;
  const disabledCount = users.filter((u) => u.active === false).length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#A8422F] via-[#C4503A] to-[#E77E69] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manage Users</h1>
            <p className="text-rose-100 mt-1 text-sm">
              View, edit, and control all platform user accounts
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={FiUsers}
          label="Total Users"
          value={users.length}
          colorClass="text-indigo-700"
          bgClass="bg-indigo-50"
          borderClass="border-indigo-200"
        />
        <StatCard
          icon={FiUserCheck}
          label="Active"
          value={activeCount}
          colorClass="text-emerald-700"
          bgClass="bg-emerald-50"
          borderClass="border-emerald-200"
        />
        <StatCard
          icon={FiUserX}
          label="Disabled"
          value={disabledCount}
          colorClass="text-rose-700"
          bgClass="bg-rose-50"
          borderClass="border-rose-200"
        />
        <StatCard
          icon={FiShield}
          label="Admins"
          value={adminCount}
          colorClass="text-violet-700"
          bgClass="bg-violet-50"
          borderClass="border-violet-200"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader size="lg" />
          </div>
        ) : (
          <UserTable
            users={users}
            onEdit={(user) => setEditingUser(user)}
            onDelete={(user) => setDeleteUser(user)}
            onToggleStatus={(user) => setToggleUser(user)}
          />
        )}
      </div>

      {/* Edit User Modal */}
      <UserEditModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSave={handleUpdateUser}
        loading={processing}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteUser?.name}? This action cannot be undone.`}
        confirmText={processing ? 'Deleting...' : 'Delete'}
        variant="danger"
      />

      {/* Toggle Status Confirmation */}
      <ConfirmModal
        isOpen={!!toggleUser}
        onClose={() => setToggleUser(null)}
        onConfirm={handleToggleStatus}
        title={toggleUser?.active !== false ? 'Disable User' : 'Enable User'}
        message={`Are you sure you want to ${toggleUser?.active !== false ? 'disable' : 'enable'} ${toggleUser?.name}'s account?`}
        confirmText={processing ? 'Processing...' : toggleUser?.active !== false ? 'Disable' : 'Enable'}
        variant={toggleUser?.active !== false ? 'danger' : 'primary'}
      />
    </div>
  );
};

export default ManageUsers;
