'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Plus,
  X,
  Key,
  Eye,
  EyeOff,
  User,
  Phone,
  Lock,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import {
  createRider,
  toggleRiderStatus,
  resetRiderPassword
} from '@/app/actions/riderManagementActions';

interface Rider {
  id: string;
  name: string;
  phone: string;
  username: string;
  is_active: boolean | null;
  total_deliveries: number | null;
  total_earnings: number | null;
  created_at: string;
}

interface RiderManagementClientProps {
  initialRiders: Rider[];
}

export default function RiderManagementClient({ initialRiders }: RiderManagementClientProps) {
  const [riders, setRiders] = useState<Rider[]>(initialRiders);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  // Form states for Add Rider
  const [addForm, setAddForm] = useState({
    name: '',
    username: '',
    phone: '',
    password: ''
  });
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Form states for Reset Password
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Loading state for toggle actions
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  // Filter and search
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRiders = riders.filter(
    (rider) =>
      rider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rider.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rider.phone.includes(searchQuery)
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const name = addForm.name.trim();
    const username = addForm.username.trim().toLowerCase();
    const phone = addForm.phone.trim();
    const password = addForm.password.trim();

    if (!name) {
      setAddError('Name is required');
      return;
    }
    if (!username || username.length < 3) {
      setAddError('Username must be at least 3 characters');
      return;
    }
    if (!phone) {
      setAddError('Phone number is required');
      return;
    }
    if (!password || password.length < 4) {
      setAddError('Password must be at least 4 characters');
      return;
    }

    setAddLoading(true);
    try {
      const result = await createRider(name, username, phone, password);
      if (result.success && result.data) {
        setRiders((prev) => [result.data as Rider, ...prev]);
        setIsAddModalOpen(false);
        setAddForm({ name: '', username: '', phone: '', password: '' });
      } else {
        setAddError(result.error || 'Failed to create rider');
      }
    } catch (err) {
      const error = err as Error;
      setAddError(error.message || 'An unexpected error occurred');
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleActive = async (riderId: string, currentStatus: boolean | null) => {
    setToggleLoadingId(riderId);
    const newStatus = !currentStatus;

    try {
      const result = await toggleRiderStatus(riderId, newStatus);
      if (result.success) {
        setRiders((prev) =>
          prev.map((r) => (r.id === riderId ? { ...r, is_active: newStatus } : r))
        );
      } else {
        alert('Failed to update rider status: ' + result.error);
      }
    } catch (err) {
      const error = err as Error;
      alert('Error: ' + error.message);
    } finally {
      setToggleLoadingId(null);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!selectedRider) return;

    const password = passwordForm.password.trim();
    const confirm = passwordForm.confirmPassword.trim();

    if (!password || password.length < 4) {
      setResetError('Password must be at least 4 characters');
      return;
    }
    if (password !== confirm) {
      setResetError('Passwords do not match');
      return;
    }

    setResetLoading(true);
    try {
      const result = await resetRiderPassword(selectedRider.id, password);
      if (result.success) {
        setIsPasswordModalOpen(false);
        setPasswordForm({ password: '', confirmPassword: '' });
        alert(`Password for ${selectedRider.name} reset successfully`);
      } else {
        setResetError(result.error || 'Failed to reset password');
      }
    } catch (err) {
      const error = err as Error;
      setResetError(error.message || 'An unexpected error occurred');
    } finally {
      setResetLoading(false);
    }
  };

  const openPasswordResetModal = (rider: Rider) => {
    setSelectedRider(rider);
    setPasswordForm({ password: '', confirmPassword: '' });
    setResetError(null);
    setIsPasswordModalOpen(true);
  };

  const activeRidersCount = riders.filter((r) => r.is_active).length;

  return (
    <div className="space-y-6 pb-24">
      {/* Overview Cards & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-primary/10 text-primary rounded-2xl">
            <Truck size={24} />
          </div>
          <div>
            <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Total Riders</h3>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{riders.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-green-500/10 text-green-600 rounded-2xl">
            <Activity size={24} />
          </div>
          <div>
            <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Active Riders</h3>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{activeRidersCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-slate-100 text-slate-500 rounded-2xl">
            <XCircle size={24} />
          </div>
          <div>
            <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Inactive Riders</h3>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{riders.length - activeRidersCount}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            placeholder="Search riders by name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-semibold"
          />
        </div>

        <button
          onClick={() => {
            setAddError(null);
            setIsAddModalOpen(true);
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white font-bold text-sm rounded-2xl hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/20 transition-all cursor-pointer"
        >
          <Plus size={18} /> Add New Rider
        </button>
      </div>

      {/* Riders List / Table */}
      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        {filteredRiders.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <Truck size={48} className="text-slate-300" strokeWidth={1.5} />
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">No Riders Found</h3>
              <p className="text-xs text-slate-400 font-medium">Try checking your spelling or add a new rider.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rider</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Deliveries</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Earnings</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                {filteredRiders.map((rider) => (
                  <tr key={rider.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{rider.name}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">@{rider.username}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{rider.phone}</td>
                    <td className="px-6 py-4 text-center font-mono">{rider.total_deliveries ?? 0}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-900">₹{(rider.total_earnings ?? 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          rider.is_active
                            ? 'bg-green-50 text-green-600 border-green-100'
                            : 'bg-rose-50 text-rose-500 border-rose-100'
                        }`}
                      >
                        {rider.is_active ? (
                          <>
                            <CheckCircle size={10} /> Active
                          </>
                        ) : (
                          <>
                            <XCircle size={10} /> Inactive
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {/* Toggle Status switch */}
                        <div className="flex items-center gap-2">
                          <button
                            disabled={toggleLoadingId === rider.id}
                            onClick={() => handleToggleActive(rider.id, rider.is_active)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                              rider.is_active ? 'bg-green-500' : 'bg-slate-200'
                            } ${toggleLoadingId === rider.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={rider.is_active ? 'Deactivate Rider' : 'Activate Rider'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                rider.is_active ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => openPasswordResetModal(rider)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-transparent hover:border-primary/10"
                          title="Reset Password"
                        >
                          <Key size={16} />
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

      {/* Add Rider Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Add New Rider</h2>
                    <p className="text-slate-500 text-xs mt-0.5">Register a new rider profile</p>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {addError && (
                  <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-start gap-3 text-xs font-bold">
                    <AlertCircle className="shrink-0" size={16} />
                    <span>{addError}</span>
                  </div>
                )}

                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1.5">
                      <User size={12} /> Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm font-semibold"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1.5">
                      <User size={12} /> Username
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. johndoe (min 3 chars)"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm font-semibold"
                      value={addForm.username}
                      onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1.5">
                      <Phone size={12} /> Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +919876543210"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm font-semibold"
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1.5">
                      <Lock size={12} /> Initial Password
                    </label>
                    <div className="relative">
                      <input
                        type={showAddPassword ? 'text' : 'password'}
                        placeholder="min 4 characters"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pr-12 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm font-semibold"
                        value={addForm.password}
                        onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowAddPassword(!showAddPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showAddPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-2xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addLoading}
                      className="flex-1 py-4 bg-primary hover:bg-primary/95 text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {addLoading ? 'Creating...' : 'Create Rider'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && selectedRider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Reset Password</h2>
                    <p className="text-slate-500 text-xs mt-0.5">Reset password for {selectedRider.name}</p>
                  </div>
                  <button
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {resetError && (
                  <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-start gap-3 text-xs font-bold">
                    <AlertCircle className="shrink-0" size={16} />
                    <span>{resetError}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1.5">
                      <Lock size={12} /> New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        placeholder="min 4 characters"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pr-12 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm font-semibold"
                        value={passwordForm.password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1.5">
                      <Lock size={12} /> Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Repeat new password"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm font-semibold"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      required
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPasswordModalOpen(false)}
                      className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-2xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 py-4 bg-primary hover:bg-primary/95 text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {resetLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
