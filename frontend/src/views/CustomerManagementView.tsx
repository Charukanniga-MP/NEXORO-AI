import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Package,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Globe
} from 'lucide-react';
import { api, Customer, Order } from '../services/api';

export const CustomerManagementView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Chennai');
  const [state, setState] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('600001');
  const [preferredLanguage, setPreferredLanguage] = useState('en');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.getCustomers({ search: searchTerm || undefined });
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleViewCustomerOrders = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setOrdersLoading(true);
    try {
      const res = await api.getCustomerOrders(cust.id);
      setCustomerOrders(res.data);
    } catch (e) {
      console.error("Failed to load customer orders", e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCustomer({
        name,
        phone,
        email: email || undefined,
        address_line1: address || undefined,
        city,
        state,
        pincode,
        preferred_language: preferredLanguage,
        consent_for_outbound: true,
        dnd_opt_out: false
      });
      setShowAddModal(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to register customer');
    }
  };

  const getLanguageLabel = (code: string) => {
    const map: Record<string, string> = {
      en: 'English',
      ta: 'Tamil (தமிழ்)',
      te: 'Telugu (తెలుగు)',
      ml: 'Malayalam (മലയാളം)',
      hi: 'Hindi (हिन्दी)'
    };
    return map[code?.toLowerCase()] || code?.toUpperCase() || 'EN';
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Registered Customers Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual customer profiles, unique Customer IDs, address books, and order histories.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add Registered Customer</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Customer ID (e.g. CUST-2026-00001), Name, Phone, or Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </form>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Mobile Number</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Delivery Address</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Registration Date</th>
                <th className="py-3 px-4">Total Orders</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading registered customer database...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No customers found matching search criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {c.customer_code || 'CUST-GUEST'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {c.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {c.phone}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {c.email || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {c.address_line1 ? `${c.address_line1}, ${c.city || ''} ${c.pincode || ''}` : `${c.city || 'Chennai'}, ${c.state || 'Tamil Nadu'}`}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center space-x-1">
                        <Globe className="w-3 h-3 text-blue-500" />
                        <span>{getLanguageLabel(c.preferred_language)}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[11px]">
                        {c.total_orders_count || 0} Orders
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        ACTIVE
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleViewCustomerOrders(c)}
                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg cursor-pointer flex items-center space-x-1 ml-auto text-[11px]"
                        title="View Customer Order History"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Orders</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Orders History Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Customer Profile & Order History</h3>
                <p className="text-[11px] text-blue-100 font-mono">
                  {selectedCustomer.name} • {selectedCustomer.customer_code} • {selectedCustomer.phone}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Delivery Address</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedCustomer.address_line1 || 'No street address saved'}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    {selectedCustomer.city}, {selectedCustomer.state} - {selectedCustomer.pincode}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Voice Call Preference</p>
                  <p className="font-semibold text-blue-700 mt-0.5">
                    {getLanguageLabel(selectedCustomer.preferred_language)}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Calls Received: {selectedCustomer.total_calls_count || 0}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Orders Placed by {selectedCustomer.name}
                </p>

                {ordersLoading ? (
                  <p className="py-6 text-center text-slate-400">Loading orders...</p>
                ) : customerOrders.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    No orders placed yet by this customer.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {customerOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-blue-600">{ord.order_number}</span>
                            <span className="text-slate-400 text-[10px]">
                              {new Date(ord.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-slate-700 font-semibold mt-0.5">
                            {(ord.items || []).map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            AI Call: <span className="font-bold text-emerald-700">{ord.ai_call_status || 'PENDING'}</span>
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">₹{Number(ord.total_amount).toFixed(2)}</p>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {ord.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Customer Registration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Register New Customer</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Krishnan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
                <input
                  type="text"
                  required
                  placeholder="+91-98401-00000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="ramesh@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="Street and Door Number"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIN</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Preferred Language</label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                >
                  <option value="en">English</option>
                  <option value="ta">Tamil (தமிழ்)</option>
                  <option value="te">Telugu (తెలుగు)</option>
                  <option value="ml">Malayalam (മലയാളം)</option>
                                  </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  Save & Generate ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
