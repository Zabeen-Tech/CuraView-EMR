import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Billing = () => {
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [stats, setStats] = useState({ revenue: 0, pending: 0, count: 0 });
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    date: new Date().toISOString().split('T')[0],
    items: [{ service: '', price: 0, quantity: 1, total: 0 }],
    discount: 0,
    totalAmount: 0
  });

  useEffect(() => {
    fetchInvoices();
    fetchPatients();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/invoices');
      const data = res.data || [];
      setInvoices(data);
      calculateStats(data);
    } catch (err) {
      console.error("Error fetching invoices:", err);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/patients');
      setPatients(res.data || []);
    } catch (err) {
      console.error("Error fetching patients:", err);
    }
  };

  const calculateStats = (data) => {
    const revenue = data
      .filter(inv => inv.status === 'Paid')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    const pending = data
      .filter(inv => inv.status === 'Unpaid')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    const unpaidCount = data.filter(inv => inv.status === 'Unpaid').length;

    setStats({ revenue, pending, count: unpaidCount });
  };

  const handleCreateInvoice = async () => {
    if (!formData.patientId) return alert("Please select a patient");
    
    try {
      const calculatedSubtotal = formData.items.reduce((sum, item) => sum + item.total, 0);

      const payload = {
        patientId: formData.patientId,
        patientName: formData.patientName,
        date: formData.date,
        items: formData.items,
        subtotal: calculatedSubtotal,
        discount: formData.discount || 0,
        totalAmount: formData.totalAmount,
        status: 'Unpaid',
        invoiceId: `INV-${Math.floor(10000 + Math.random() * 90000)}`
      };

      const res = await axios.post('http://localhost:5000/api/invoices', payload);
      const updatedInvoices = [res.data, ...invoices];
      setInvoices(updatedInvoices);
      calculateStats(updatedInvoices);
      
      setShowModal(false);
      setFormData({
        patientId: '',
        patientName: '',
        date: new Date().toISOString().split('T')[0],
        items: [{ service: '', price: 0, quantity: 1, total: 0 }],
        discount: 0,
        totalAmount: 0
      });

      alert("Invoice generated successfully!");
    } catch (err) {
      console.error("Failed to create invoice:", err.response?.data || err.message);
      alert("Error saving invoice.");
    }
  };

  // --- NEW: ACCEPT PAYMENT LOGIC ---
  const handleAcceptPayment = async (id) => {
    try {
      const res = await axios.put(`http://localhost:5000/api/invoices/${id}/status`, {
        status: 'Paid'
      });
      
      const updatedInvoices = invoices.map(inv => inv._id === id ? res.data : inv);
      setInvoices(updatedInvoices);
      calculateStats(updatedInvoices);
      alert("Payment confirmed!");
    } catch (err) {
      console.error("Payment failed:", err);
      alert("Could not update payment.");
    }
  };

  // --- NEW: VIEW MODAL LOGIC ---
  const openViewModal = (invoice) => {
    setSelectedInvoice(invoice);
    setShowViewModal(true);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { service: '', price: 0, quantity: 1, total: 0 }]
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    if (field === 'price' || field === 'quantity') {
      newItems[index].total = newItems[index].price * newItems[index].quantity;
    }
    
    const subtotal = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ 
      ...formData, 
      items: newItems, 
      totalAmount: subtotal - formData.discount 
    });
  };

  return (
    <div className="animate-fade-in">
      {/* OVERVIEW CARDS */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Revenue</p>
          <h2 className="text-3xl font-black text-slate-800">₹{stats.revenue.toLocaleString('en-IN')}</h2>
          <span className="text-teal-500 text-xs font-bold">Confirmed collections</span>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Pending Payments</p>
          <h2 className="text-3xl font-black text-slate-800">₹{stats.pending.toLocaleString('en-IN')}</h2>
          <span className="text-orange-400 text-xs font-bold">{stats.count} Invoices outstanding</span>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Collection Rate</p>
            <h2 className="text-3xl font-black text-slate-800">
              {stats.revenue + stats.pending > 0 
                ? Math.round((stats.revenue / (stats.revenue + stats.pending)) * 100) 
                : 0}%
            </h2>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-teal-500 border-t-slate-100 flex items-center justify-center text-[10px] font-black text-teal-600 italic">LIVE</div>
        </div>
      </div>

      {/* BILLING TABLE */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-800 text-lg">Active Clinic Flow: Billing</h3>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-teal-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-teal-700 transition shadow-lg shadow-teal-100"
          >
            + Generate New Invoice
          </button>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-50">
              <th className="pb-4 px-2">Patient Name</th>
              <th className="pb-4">Invoice ID</th>
              <th className="pb-4">Amount</th>
              <th className="pb-4">Status</th>
              <th className="pb-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {invoices.map((inv) => (
              <tr key={inv._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                <td className="py-4 px-2 font-bold text-slate-700">{inv.patientName}</td>
                <td className="py-4 text-slate-500">#{inv.invoiceId}</td>
                <td className="py-4 font-black text-slate-800">₹{inv.totalAmount?.toLocaleString('en-IN')}</td>
                <td className="py-4">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                    inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {inv.status}
                  </span>
                </td>
                <td className="py-4 text-right">
                  {inv.status === 'Unpaid' && (
                    <button 
                      onClick={() => handleAcceptPayment(inv._id)}
                      className="text-teal-600 font-bold hover:underline mr-4"
                    >
                      Accept Payment
                    </button>
                  )}
                  <button 
                    onClick={() => openViewModal(inv)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl animate-modal-up">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800">Create New Invoice</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Select Patient</label>
                <select 
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none mt-1 font-semibold"
                  value={formData.patientId}
                  onChange={(e) => {
                    const selected = patients.find(p => p._id === e.target.value);
                    if(selected) setFormData({...formData, patientId: selected._id, patientName: selected.name});
                  }}
                >
                  <option value="">Select Patient...</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Visit Date</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none mt-1 font-semibold" 
                />
              </div>
            </div>

            <div className="space-y-3 mb-6 max-h-40 overflow-y-auto pr-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 ml-1">Services & Items</p>
              {formData.items.map((item, index) => (
                <div key={index} className="flex gap-3 animate-fade-in">
                  <input 
                    placeholder="Service Name" 
                    className="flex-grow p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm"
                    onChange={(e) => updateItem(index, 'service', e.target.value)}
                  />
                  <input 
                    type="number" placeholder="Price" 
                    className="w-24 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm"
                    onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                  />
                  <input 
                    type="number" placeholder="Qty" 
                    className="w-20 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm text-center"
                    onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                  />
                  <div className="w-24 p-3 text-right font-bold text-slate-700 text-sm self-center">
                    ₹{item.total.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
              <button onClick={handleAddItem} className="text-teal-600 font-bold text-xs mt-2 hover:underline">+ Add Another Item</button>
            </div>

            <div className="flex justify-between items-end border-t border-slate-50 pt-8">
              <div className="text-slate-400 text-xs italic">All invoices include standard clinic taxes.</div>
              <div className="text-right">
                <p className="text-slate-400 text-xs font-bold uppercase">Total Amount Due</p>
                <h2 className="text-4xl font-black text-teal-600">₹{formData.totalAmount.toLocaleString('en-IN')}</h2>
                <div className="flex gap-4 mt-6">
                  <button 
                    onClick={handleCreateInvoice}
                    className="bg-teal-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-100 transition"
                  >
                    CREATE INVOICE
                  </button>
                  <button onClick={() => setShowModal(false)} className="text-slate-400 font-bold px-4">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW INVOICE MODAL */}
      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative">
            <button 
                onClick={() => setShowViewModal(false)} 
                className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 text-2xl"
            >×</button>
            
            <div className="text-center mb-8">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">CuraView Clinic</h2>
              <p className="text-slate-400 text-[10px] font-bold">INVOICE RECEIPT</p>
            </div>

            <div className="border-y border-slate-50 py-6 mb-6 flex justify-between text-sm">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase">Patient</p>
                <p className="font-bold text-slate-800">{selectedInvoice.patientName}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[10px] font-bold uppercase">Date</p>
                <p className="font-bold text-slate-800">{new Date(selectedInvoice.date).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {selectedInvoice.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.service} (x{item.quantity})</span>
                  <span className="font-bold text-slate-800">₹{item.total.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 flex justify-between items-center">
              <span className="text-slate-400 font-bold text-xs uppercase">Grand Total</span>
              <span className="text-2xl font-black text-teal-600">₹{selectedInvoice.totalAmount.toLocaleString('en-IN')}</span>
            </div>

            <div className="mt-8">
              <button 
                onClick={() => window.print()}
                className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-slate-900 transition"
              >
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;