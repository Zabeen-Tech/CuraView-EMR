import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PatientRecords = () => {
  const [allPatients, setAllPatients] = useState([]);
  const [doctors, setDoctors] = useState([]); 
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null); 
  
  // New state for Re-appointment Modal
  const [reappointPatient, setReappointPatient] = useState(null);
  const [reappointData, setReappointData] = useState({ doctor: '', condition: '' });

  useEffect(() => {
    fetchAll();
    fetchDoctors();
  }, []);

  const fetchAll = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/patients');
      setAllPatients(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchDoctors = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/doctors');
      setDoctors(res.data || []);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if(window.confirm("Are you sure you want to delete this record?")) {
      try {
        await axios.delete(`http://localhost:5000/api/patients/${id}`);
        setSelectedPatient(null);
        fetchAll();
      } catch (err) { alert("Delete failed"); }
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/patients/${selectedPatient._id}`, selectedPatient);
      setSelectedPatient(null);
      fetchAll();
    } catch (err) { alert("Update failed"); }
  };

  // --- RE-APPOINT EXECUTION ---
  const executeReappoint = async (e) => {
    e.preventDefault();
    if (!reappointData.doctor) return alert("Please select a doctor");
    
    try {
      await axios.put(`http://localhost:5000/api/patients/${reappointPatient._id}`, { 
        status: 'Waiting',
        assignedDoctor: reappointData.doctor,
        condition: reappointData.condition || reappointPatient.condition,
        bookingStatus: 'Accepted',
        notes: '' // Reset notes for new visit
      });
      alert("Patient moved to Active Queue");
      setReappointPatient(null);
      setReappointData({ doctor: '', condition: '' });
      fetchAll();
    } catch (err) {
      alert("Re-appointment failed");
    }
  };

  const filtered = allPatients.filter(p => {
    const name = p?.name ? String(p.name).toLowerCase() : "";
    const phone = p?.phone ? String(p.phone) : "";
    const query = search.toLowerCase();
    return name.includes(query) || phone.includes(query);
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black text-slate-800">Master Patient Index</h1>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Filter records..." 
            className="p-3 pl-10 bg-white border border-slate-200 rounded-xl w-80 shadow-sm outline-none focus:ring-2 focus:ring-teal-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute left-3 top-3.5 opacity-30">🔍</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Patient Name</th>
              <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Age/Gender</th>
              <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Contact</th>
              <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Last Visit Date</th>
              <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(p => (
              <tr key={p._id} className="hover:bg-slate-50/50 transition">
                <td className="p-5">
                   <p className="font-bold text-slate-700">{p.name}</p>
                   <p className="text-[10px] text-teal-600 font-bold uppercase">{p.condition || 'General'}</p>
                </td>
                <td className="p-5 text-sm text-slate-500">{p.age}y / {p.gender}</td>
                <td className="p-5 text-sm font-mono text-slate-400">{p.phone || 'No Contact'}</td>
                <td className="p-5 text-sm text-slate-500">
                  {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'New Entry'}
                </td>
                <td className="p-5 flex gap-2 justify-center">
                  <button 
                    onClick={() => {
                        setReappointPatient(p);
                        setReappointData({ ...reappointData, condition: p.condition });
                    }}
                    className="text-white font-bold text-[10px] bg-teal-600 px-3 py-2 rounded-lg hover:bg-teal-700 transition"
                  >
                    + RE-APPOINT
                  </button>
                  <button 
                    onClick={() => setSelectedPatient(p)}
                    className="text-slate-600 font-bold text-[10px] bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition"
                  >
                    EDIT
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- RE-APPOINT MODAL --- */}
      {reappointPatient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
            <h2 className="text-xl font-black text-slate-800 mb-2">Re-appoint Patient</h2>
            <p className="text-sm text-slate-400 mb-6 font-bold uppercase tracking-tighter">Patient: {reappointPatient.name}</p>
            
            <form onSubmit={executeReappoint} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Reason for Visit</label>
                <input 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" 
                  value={reappointData.condition}
                  onChange={(e) => setReappointData({...reappointData, condition: e.target.value})}
                  placeholder="e.g. Follow up, Fever, etc."
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Consulting Doctor</label>
                <select 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-teal-500 outline-none font-bold text-teal-700"
                  value={reappointData.doctor}
                  onChange={(e) => setReappointData({...reappointData, doctor: e.target.value})}
                  required
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map(doc => (
                    <option key={doc._id} value={doc.name}>Dr. {doc.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold shadow-lg">
                  CONFIRM APPOINTMENT
                </button>
                <button type="button" onClick={() => setReappointPatient(null)} className="px-4 text-slate-400 font-bold">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT / DELETE DIALOG --- */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">Edit Record</h2>
              <button onClick={() => setSelectedPatient(null)} className="text-slate-300 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                <input 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20" 
                  value={selectedPatient.name} 
                  onChange={(e) => setSelectedPatient({...selectedPatient, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Phone Number</label>
                <input 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20" 
                  value={selectedPatient.phone} 
                  onChange={(e) => setSelectedPatient({...selectedPatient, phone: e.target.value})} 
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-700 transition">
                  UPDATE RECORD
                </button>
                <button 
                  type="button" 
                  onClick={() => handleDelete(selectedPatient._id)}
                  className="flex-1 bg-red-50 text-red-500 py-3 rounded-xl font-bold hover:bg-red-100 transition"
                >
                  DELETE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientRecords;