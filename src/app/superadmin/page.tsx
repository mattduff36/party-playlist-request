'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Shield,
  Mail,
  Calendar,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import Checkbox from '@/components/ui/Checkbox';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';

interface User {
  id: string;
  username: string;
  email: string;
  account_status: string;
  email_verified: boolean;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export default function SuperAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Add/Edit form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    is_super_admin: false
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [search, statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/superadmin/users?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const response = await authenticatedFetch('/api/superadmin/users', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error || 'Failed to create user');
        return;
      }

      // Success
      setShowAddModal(false);
      setFormData({ username: '', email: '', password: '', is_super_admin: false });
      fetchUsers();
    } catch (error) {
      setFormError('Network error. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setFormError('');
    setFormLoading(true);

    try {
      const updateData: Record<string, unknown> = {
        email: formData.email,
        is_super_admin: formData.is_super_admin
      };

      // Only include password if it's been changed
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await authenticatedFetch(`/api/superadmin/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error || 'Failed to update user');
        return;
      }

      // Success
      setShowEditModal(false);
      setSelectedUser(null);
      setFormData({ username: '', email: '', password: '', is_super_admin: false });
      fetchUsers();
    } catch (error) {
      setFormError('Network error. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/superadmin/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to delete user');
        return;
      }

      fetchUsers();
    } catch (error) {
      alert('Network error. Please try again.');
    }
  };

  const handleAccountStatus = async (
    user: User,
    account_status: 'active' | 'rejected'
  ) => {
    const actionLabel = account_status === 'active' ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${actionLabel} "${user.username}"?`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/superadmin/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ account_status }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || `Failed to ${actionLabel} user`);
        return;
      }

      fetchUsers();
    } catch {
      alert('Network error. Please try again.');
    }
  };

  const openAddModal = () => {
    setFormData({ username: '', email: '', password: '', is_super_admin: false });
    setFormError('');
    setShowAddModal(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      is_super_admin: user.is_super_admin
    });
    setFormError('');
    setShowEditModal(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const grantBeta = async (userId: string) => {
    try {
      const response = await authenticatedFetch('/api/superadmin/beta-entitlements', {
        method: 'POST',
        body: JSON.stringify({ userId, days: 30, notes: 'Paid beta grant' }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to grant beta entitlement');
        return;
      }
      alert(`Beta entitlement granted until ${data.entitlement?.ends_at || 'n/a'}`);
    } catch (error) {
      console.error(error);
      alert('Failed to grant beta entitlement');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-bone mb-2">User Management</h1>
        <p className="text-muted">Manage all user accounts and permissions</p>
      </div>

      {/* Filters & Actions */}
      <div className="bg-surface backdrop-blur-md rounded-xl p-6 border border-white/10 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-faint" />
            <input
              type="text"
              placeholder="Search username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>

          {/* Add User Button */}
          <button
            onClick={openAddModal}
            className="flex items-center space-x-2 px-6 py-2 bg-accent hover:bg-accent-hover text-ink rounded-lg font-bold transition-all duration-300 shadow-lg hover:shadow-accent/30"
          >
            <Plus className="w-5 h-5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Users className="w-16 h-16 text-faint mb-4" />
            <p className="text-muted text-lg">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-muted">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-muted">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-muted">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-muted">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-muted">Created</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-muted">Last Login</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-ink font-bold">
                          {user.username[0].toUpperCase()}
                        </div>
                        <span className="text-bone font-medium">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-faint" />
                        <span className="text-muted">{user.email}</span>
                        {user.email_verified && (
                          <Check className="w-4 h-4 text-accent" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user.account_status === 'active' ? 'bg-accent/20 text-accent' :
                        user.account_status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                        user.account_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-white/10 text-muted'
                      }`}>
                        {user.account_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.is_super_admin ? (
                        <div className="flex items-center space-x-2 text-red-400">
                          <Shield className="w-4 h-4" />
                          <span className="text-sm font-semibold">Super Admin</span>
                        </div>
                      ) : (
                        <span className="text-faint text-sm">User</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-muted">
                        <Calendar className="w-4 h-4 text-faint" />
                        <span className="text-sm">{formatDate(user.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-muted text-sm">{formatDate(user.last_login)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        {user.account_status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAccountStatus(user, 'active')}
                              className="p-2 text-accent hover:bg-accent/20 rounded-lg transition-colors"
                              title="Approve user"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAccountStatus(user, 'rejected')}
                              className="p-2 text-red-400 hover:bg-red-400/20 rounded-lg transition-colors"
                              title="Reject user"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => void grantBeta(user.id)}
                          className="p-2 text-amber-300 hover:bg-amber-400/20 rounded-lg transition-colors"
                          title="Grant 30-day beta entitlement"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 text-accent hover:bg-accent/20 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-red-400 hover:bg-red-400/20 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-elevated rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/10">
            <h2 className="text-2xl font-bold text-bone mb-6">Add New User</h2>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                  required
                  pattern="[a-z0-9-]{3,30}"
                  className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="username"
                />
                <p className="text-xs text-faint mt-1">3-30 characters, lowercase, numbers, hyphens</p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="user@example.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-faint hover:text-bone"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Super Admin */}
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="add-super-admin"
                  checked={formData.is_super_admin}
                  onChange={(e) => setFormData({ ...formData, is_super_admin: e.target.checked })}
                />
                <label htmlFor="add-super-admin" className="text-sm text-muted flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span>Super Admin (full access)</span>
                </label>
              </div>

              {/* Error */}
              {formError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                  {formError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-surface hover:bg-white/20 text-bone rounded-lg font-medium transition-colors"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover text-ink rounded-lg font-bold transition-all duration-300 disabled:opacity-50"
                  disabled={formLoading}
                >
                  {formLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-elevated rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/10">
            <h2 className="text-2xl font-bold text-bone mb-6">Edit User: {selectedUser.username}</h2>
            
            <form onSubmit={handleEditUser} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              {/* Password (Optional) */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  New Password (leave blank to keep current)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    minLength={8}
                    className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-faint hover:text-bone"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Super Admin */}
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="edit-super-admin"
                  checked={formData.is_super_admin}
                  onChange={(e) => setFormData({ ...formData, is_super_admin: e.target.checked })}
                />
                <label htmlFor="edit-super-admin" className="text-sm text-muted flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span>Super Admin (full access)</span>
                </label>
              </div>

              {/* Error */}
              {formError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                  {formError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 bg-surface hover:bg-white/20 text-bone rounded-lg font-medium transition-colors"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover text-ink rounded-lg font-bold transition-all duration-300 disabled:opacity-50"
                  disabled={formLoading}
                >
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

