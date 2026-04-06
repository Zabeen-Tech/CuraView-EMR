import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import PatientRecords from './patientrecords'; 
import AppointmentCalendar from './appointmentcalendar'; 

const AdminDashboard = () => {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegModal, setShowRegModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  
  const navigate = useNavigate();

  const rooms = ["Room 1", "Room 2", "Room 3", "Room 4", "Room 5"];

  const initialPatientState = {
    name: '', 
    age: '', 
    gender: '', 
    phone: '',
    condition: '', 
    assignedDoctor: '', 
    appointmentDate: new Date().toISOString().split('T')[0], 
    appointmentTime: 'Not Scheduled', 
    roomNumber: 'Not Assigned', 
    status: 'Waiting',
    bookingStatus: 'Pending'
  };

  const [formData, setFormData] = useState(initialPatientState);
  const [docFormData, setDocFormData] = useState({
    name: '', email: '', password: '', role: 'doctor', specialization: ''
  });

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
    const interval = setInterval(fetchPatients, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/patients');
      setPatients(res.data || []);
    } catch (err) { console.error("Fetch Patients Error", err); }
  };

  const fetchDoctors = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/doctors');
      setDoctors(res.data || []);
    } catch (err) { console.error("Fetch Doctors Error", err); }
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        age: Number(formData.age),
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        status: 'Waiting',
        bookingStatus: 'Pending' 
      };
      await axios.post('http://localhost:5000/api/patients', dataToSend);
      setShowRegModal(false);
      fetchPatients();
      setFormData(initialPatientState); 
    } catch (err) {
      alert(`Registration Failed: ${err.response?.data?.message || "Check fields"}`);
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/register', docFormData);
      setShowDocModal(false);
      fetchDoctors();
      setDocFormData({ name: '', email: '', password: '', role: 'doctor', specialization: '' });
    } catch (err) { alert(err.response?.data?.message || "Error adding doctor"); }
  };

  // UPDATED: This function now correctly syncs with the Doctor Dashboard
  const handleStatusChange = async (patientId, newStatus) => {
    try {
      // Map 'In-Room' UI selection to 'In-Consultation' DB status so Doctor sees it
      const dbStatus = newStatus === 'In-Room' ? 'In-Consultation' : newStatus;
      
      await axios.put(`http://localhost:5000/api/patients/${patientId}/status`, { status: dbStatus });
      fetchPatients();
    } catch (err) { alert("Status update failed"); }
  };

  const handleRoomChange = async (patientId, newRoom) => {
    if (newRoom === "Not Assigned") return; 
    try {
      await axios.put(`http://localhost:5000/api/patients/${patientId}`, { roomNumber: newRoom });
      fetchPatients();
    } catch (err) { 
      console.error("Room Assignment Error", err);
      alert("Room assignment failed."); 
    }
  };

  const handleAppointmentDecision = async (patientId, decision) => {
    try {
      let notes = decision !== 'Accepted' ? prompt("Enter reason for rejection:") : "";
      await axios.put(`http://localhost:5000/api/patients/${patientId}/respond-appointment`, {
        decision, adminNotes: notes
      });
      fetchPatients();
    } catch (err) { alert("Decision update failed"); }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const filteredPatients = (patients || []).filter(p => {
    const name = p?.name ? String(p.name).toLowerCase() : "";
    const phone = p?.phone ? String(p.phone) : "";
    const search = (searchTerm || "").toLowerCase();
    return name.includes(search) || phone.includes(search);
  });

  return (
    <div className="flex min-h-screen font-sans text-slate-900" style={{ backgroundColor: '#F0F9F6' }}>
      
      <aside className="w-64 bg-[#1E293B] flex flex-col p-6 text-slate-300 shadow-xl fixed h-full">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-[#14B8A6] p-2 rounded-lg text-white font-bold text-sm">CV</div>
          <h1 className="text-white font-bold text-lg tracking-tight">CuraView EMR</h1>
        </div>

        <div className="flex items-center gap-3 mb-10 p-3 bg-slate-800/50 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold">MZ</div>
          <div>
            <p className="text-sm font-bold text-white">Mehak Zabeen</p>
            <p className="text-[10px] uppercase tracking-wider text-teal-400">Admin</p>
          </div>
        </div>

        <nav className="space-y-2 grow">
          {['Dashboard', 'Patient Records', 'Appointment Calendar', 'Billing & Reports', 'Settings'].map((item) => (
            <button 
              key={item} 
              onClick={() => setActiveTab(item)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition 
              ${activeTab === item ? 'bg-teal-500 text-white shadow-lg' : 'hover:bg-slate-800'}`}
            >
              {item}
            </button>
          ))}
        </nav>

        <button onClick={handleLogout} className="mt-auto flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 font-bold text-sm transition">
          Logout
        </button>
      </aside>

      <main className="flex-1 ml-64">
        <header className="bg-white p-6 flex justify-between items-center sticky top-0 z-10 border-b border-teal-100/50">
          <h2 className="text-lg font-bold text-slate-700">Healthcare Clinic Portal</h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search Patient..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-100 pl-10 pr-4 py-2 rounded-lg text-sm w-80 outline-none focus:ring-2 focus:ring-teal-500/20" 
              />
              <span className="absolute left-3 top-2.5 opacity-40">🔍</span>
            </div>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'Dashboard' ? (
            <>
              <h1 className="text-2xl font-black text-slate-800 mb-8">Today's Pulse</h1>
              <div className="grid grid-cols-12 gap-6">
                
                <section className="col-span-3 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Appointment Queue</h3>
                  <div className="space-y-3">
                    {patients.filter(p => p.bookingStatus === 'Pending').map(p => (
                      <div key={p._id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <p className="font-bold text-slate-800 text-sm mb-1">{p.name}</p>
                        <p className="text-[10px] text-slate-500 mb-3 italic">"{p.condition}"</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleAppointmentDecision(p._id, 'Accepted')} className="flex-1 bg-teal-500 text-white text-[10px] font-black py-2 rounded-lg">ACCEPT</button>
                          <button onClick={() => handleAppointmentDecision(p._id, 'Cancelled')} className="flex-1 bg-slate-100 text-slate-400 text-[10px] font-black py-2 rounded-lg">REJECT</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="col-span-6 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                       <h3 className="font-bold text-slate-800">Active Patient Flow</h3>
                       <button onClick={() => {
                         setFormData(initialPatientState);
                         setShowRegModal(true);
                       }} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-teal-700">
                         + Quick Patient Entry
                       </button>
                    </div>

                    <div className="space-y-4">
                       {filteredPatients.filter(p => p.status !== 'Discharged' && p.bookingStatus === 'Accepted').map(p => (
                        <div key={p._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">👤</div>
                            <div>
                              <p className="font-bold text-sm text-slate-800">{p.name}</p>
                              <p className="text-[10px] text-teal-500 font-bold italic">{p.assignedDoctor ? `Dr. ${p.assignedDoctor}` : 'No Doctor Assigned'}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <select 
                              value={p.roomNumber || "Not Assigned"}
                              onChange={(e) => handleRoomChange(p._id, e.target.value)}
                              className="text-[10px] font-bold px-2 py-2 rounded-xl border border-teal-100 bg-teal-50 text-teal-700 outline-none cursor-pointer hover:bg-teal-100 transition"
                            >
                              <option value="Not Assigned">Select Room</option>
                              {rooms.map(room => (
                                <option key={room} value={room}>{room}</option>
                              ))}
                            </select>
                            <select 
                              // Show 'In-Room' in UI if DB is 'In-Consultation'
                              value={p.status === 'In-Consultation' ? 'In-Room' : p.status}
                              onChange={(e) => handleStatusChange(p._id, e.target.value)}
                              className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase outline-none shadow-sm cursor-pointer
                                ${p.status === 'In-Consultation' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}
                            >
                              <option value="Waiting">Waiting</option>
                              <option value="In-Room">In-Room</option>
                              <option value="Discharged">Discharged</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                </section>

                <section className="col-span-3 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-fit">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 text-sm">Clinic Staff</h3>
                    <button onClick={() => setShowDocModal(true)} className="text-teal-600 font-bold text-xs">+ Add</button>
                  </div>
                  <div className="space-y-4">
                    {doctors.map(doc => (
                      <div key={doc._id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-xs">🩺</div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">{doc.name}</p>
                          <p className="text-[9px] text-teal-500 font-bold uppercase">{doc.specialization}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : activeTab === 'Patient Records' ? (
            <PatientRecords />
          ) : activeTab === 'Appointment Calendar' ? (
            <AppointmentCalendar 
              onSlotClick={(time, date) => {
                setFormData({ 
                    ...initialPatientState, 
                    appointmentTime: time,
                    appointmentDate: date,
                    bookingStatus: 'Pending'
                });
                setShowRegModal(true);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
              <span className="text-4xl mb-4">🚧</span>
              <p className="font-bold">{activeTab} section is under development.</p>
            </div>
          )}
        </div>
      </main>

      {showRegModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
            <h2 className="text-xl font-black mb-6 text-slate-800">New Patient Registration</h2>
            <form onSubmit={handleAddPatient} className="space-y-4">
              <input placeholder="Patient Name" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" 
                value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              
              <div className="flex gap-4">
                <input placeholder="Phone Number" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none flex-1" 
                  value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                <input placeholder="Age" type="number" className="w-24 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" 
                  value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} />
              </div>

              <div className="flex gap-4">
                <select className="w-1/2 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" 
                  value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <input type="date" className="w-1/2 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" 
                  value={formData.appointmentDate} onChange={(e) => setFormData({...formData, appointmentDate: e.target.value})} />
              </div>

              <div className="flex gap-4">
                <select 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none"
                  value={formData.assignedDoctor}
                  onChange={(e) => setFormData({...formData, assignedDoctor: e.target.value})}
                  required
                >
                  <option value="">Assign Doctor</option>
                  {doctors.map(doc => (
                    <option key={doc._id} value={doc.name}>Dr. {doc.name}</option>
                  ))}
                </select>
                <input placeholder="Time" className="w-1/3 p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-500 font-bold" 
                  value={formData.appointmentTime} readOnly />
              </div>

              <textarea placeholder="Reason for Visit" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none h-20" 
                value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value})} />
              
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition">REGISTER</button>
                <button type="button" onClick={() => setShowRegModal(false)} className="px-6 py-3 text-slate-400 font-bold">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDocModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
            <h2 className="text-xl font-black mb-6 text-slate-800">Add New Doctor</h2>
            <form onSubmit={handleAddDoctor} className="space-y-4">
              <input placeholder="Full Name" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" 
                value={docFormData.name} onChange={(e) => setDocFormData({...docFormData, name: e.target.value})} />
              <input placeholder="Email Address" type="email" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" 
                value={docFormData.email} onChange={(e) => setDocFormData({...docFormData, email: e.target.value})} />
              <input placeholder="Password" type="password" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" 
                value={docFormData.password} onChange={(e) => setDocFormData({...docFormData, password: e.target.value})} />
              <input placeholder="Specialization" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" 
                value={docFormData.specialization} onChange={(e) => setDocFormData({...docFormData, specialization: e.target.value})} />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#1E293B] text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition">SAVE STAFF</button>
                <button type="button" onClick={() => setShowDocModal(false)} className="px-6 py-3 text-slate-400 font-bold">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;