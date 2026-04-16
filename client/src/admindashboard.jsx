import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import PatientRecords from './patientrecords'; 
import AppointmentCalendar from './appointmentcalendar'; 
import Billing from './billing'; 
import Settings from './settings'; 

const AdminDashboard = () => {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [roomsStatus, setRoomsStatus] = useState([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegModal, setShowRegModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [approvalData, setApprovalData] = useState({
    roomNumber: '',
    appointmentTime: ''
  });
  
  const navigate = useNavigate();
  const roomsList = ["Room 1", "Room 2", "Room 3", "Room 4", "Room 5"];

  const initialPatientState = {
    name: '', age: '', gender: '', phone: '',
    condition: '', assignedDoctor: '', 
    appointmentDate: new Date().toISOString().split('T')[0], 
    appointmentTime: '', 
    roomNumber: 'Not Assigned', 
    status: 'Waiting',
    bookingStatus: 'Pending',
    queuePosition: 0
  };

  const [formData, setFormData] = useState(initialPatientState);
  const [docFormData, setDocFormData] = useState({
    name: '', email: '', password: '', role: 'doctor', specialization: ''
  });

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
    fetchRooms(); 
    const interval = setInterval(() => {
        fetchPatients();
        fetchRooms(); 
    }, 5000);
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

  const fetchRooms = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/rooms/status');
      setRoomsStatus(res.data || []);
    } catch (err) { console.error("Fetch Rooms Error", err); }
  };

  const suggestNextSlot = (doctorName) => {
    const today = new Date().toISOString().split('T')[0];
    const docAppts = patients
      .filter(p => p.assignedDoctor === doctorName && p.appointmentDate === today && p.appointmentTime && p.appointmentTime !== 'Not Scheduled')
      .map(p => p.appointmentTime);
    if (docAppts.length === 0) return "10:00 AM";
    const sorted = docAppts.sort((a, b) => new Date(`1970/01/01 ${a}`) - new Date(`1970/01/01 ${b}`));
    const lastTime = new Date(`1970/01/01 ${sorted[sorted.length - 1]}`);
    lastTime.setMinutes(lastTime.getMinutes() + 15);
    return lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const suggestNextRoom = () => {
    const occupied = roomsStatus.filter(r => r.isOccupied).map(r => r.room);
    return roomsList.find(r => !occupied.includes(r)) || roomsList[0];
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    try {
      const queuePos = patients.filter(p => 
        p.assignedDoctor === formData.assignedDoctor && 
        p.bookingStatus === 'Accepted' &&
        p.appointmentDate === formData.appointmentDate
      ).length + 1;

      const finalTime = formData.appointmentTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const dataToSend = {
        ...formData,
        appointmentTime: finalTime,
        age: Number(formData.age),
        status: 'Waiting',
        bookingStatus: 'Accepted',
        queuePosition: queuePos
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

  const handleStatusChange = async (patientId, newStatus) => {
    try {
      const dbStatus = newStatus === 'In-Room' ? 'In-Consultation' : newStatus;
      await axios.put(`http://localhost:5000/api/patients/${patientId}/status`, { status: dbStatus });
      fetchPatients();
      fetchRooms(); 
    } catch (err) { alert("Status update failed"); }
  };

  const handleRoomChange = async (patientId, newRoom) => {
    try {
      await axios.put(`http://localhost:5000/api/patients/${patientId}`, { roomNumber: newRoom });
      fetchPatients();
      fetchRooms(); 
    } catch (err) { alert("Room assignment failed."); }
  };

  const convertTo24hr = (time12) => {
    if (!time12 || time12 === 'Not Scheduled') return '10:00';
    if (!time12.includes('AM') && !time12.includes('PM')) return time12;
    const [time, modifier] = time12.split(' ');
    let [hours, minutes] = time.split(':');
    if (modifier === 'PM' && hours !== '12') hours = String(parseInt(hours) + 12);
    if (modifier === 'AM' && hours === '12') hours = '00';
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  const convertTo12hr = (time24) => {
    if (!time24) return 'Not Scheduled';
    const [h, m] = time24.split(':');
    const hours = parseInt(h);
    const modifier = hours >= 12 ? 'PM' : 'AM';
    const display = hours % 12 || 12;
    return `${display}:${m} ${modifier}`;
  };

  const handleOpenApproveModal = (patient) => {
    setSelectedPatient(patient);
    setApprovalData({
      roomNumber: patient.roomNumber !== "Not Assigned" ? patient.roomNumber : suggestNextRoom(),
      appointmentTime: patient.appointmentTime && patient.appointmentTime !== 'Not Scheduled' 
        ? convertTo24hr(patient.appointmentTime) 
        : convertTo24hr(suggestNextSlot(patient.assignedDoctor))
    });
    setShowApproveModal(true);
  };

  const submitFinalApproval = async (e) => {
    e.preventDefault();
    try {
      const doctorName = selectedPatient.assignedDoctor;
      const apptDate = selectedPatient.appointmentDate;
      const acceptedToday = patients.filter(p => p.assignedDoctor === doctorName && p.bookingStatus === 'Accepted' && p.appointmentDate === apptDate).length;
      const queuePos = selectedPatient.queuePosition || (acceptedToday + 1);

      await axios.put(`http://localhost:5000/api/patients/${selectedPatient._id}/respond-appointment`, {
        decision: 'Accepted', 
        adminNotes: "Confirmed via Heatmap",
        queuePosition: queuePos,
        roomNumber: approvalData.roomNumber,
        appointmentTime: convertTo12hr(approvalData.appointmentTime)
      });
      
      setShowApproveModal(false);
      fetchPatients();
      fetchRooms(); 
    } catch (err) { alert("Approval failed"); }
  };

  const handleAppointmentDecision = async (patientId, decision) => {
    if (decision === 'Accepted') {
      const p = patients.find(pat => pat._id === patientId);
      handleOpenApproveModal(p);
      return;
    }
    try {
      const reason = prompt("Enter reason for rejection:");
      if (reason === null) return; 
      await axios.put(`http://localhost:5000/api/patients/${patientId}/respond-appointment`, {
        decision: 'Rejected', adminNotes: reason, queuePosition: 0 
      });
      fetchPatients(); 
    } catch (err) { alert("Decision update failed"); }
  };

  const handleLogout = () => { localStorage.clear(); navigate('/'); };

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
            <button key={item} onClick={() => setActiveTab(item)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${activeTab === item ? 'bg-teal-500 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
              {item}
            </button>
          ))}
        </nav>

        <button onClick={handleLogout} className="mt-auto flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 font-bold text-sm transition">Logout</button>
      </aside>

      <main className="flex-1 ml-64">
        <header className="bg-white p-6 flex justify-between items-center sticky top-0 z-10 border-b border-teal-100/50">
          <h2 className="text-lg font-bold text-slate-700">Healthcare Clinic Portal</h2>
          <div className="relative">
            <input type="text" placeholder="Search Patient..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-100 pl-10 pr-4 py-2 rounded-lg text-sm w-80 outline-none focus:ring-2 focus:ring-teal-500/20" />
            <span className="absolute left-3 top-2.5 opacity-40">🔍</span>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'Dashboard' && (
            <>
              <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Today's Pulse</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Live Clinic Monitoring</p>
                </div>
                <div className="flex gap-2">
                    {patients.filter(p => p.bookingStatus === 'Pending').length > 0 && (
                        <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-[10px] font-black animate-pulse border border-amber-200">
                             {patients.filter(p => p.bookingStatus === 'Pending').length} NEW REQUESTS
                        </div>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4 mb-8">
                {roomsStatus.map((room, i) => (
                    <div key={i} className={`p-4 rounded-2xl border-t-4 shadow-sm bg-white transition-all ${room.isOccupied ? 'border-red-500' : 'border-emerald-500'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">{room.room}</span>
                            <div className={`w-2 h-2 rounded-full ${room.isOccupied ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                        </div>
                        {room.isOccupied ? (
                            <div>
                                <p className="text-xs font-bold text-slate-800 truncate">Dr. {room.doctor}</p>
                                <p className="text-[10px] text-slate-500 truncate">{room.patientName}</p>
                                <p className="text-[9px] mt-2 bg-slate-100 w-fit px-2 py-0.5 rounded text-slate-600 font-bold">Since {room.allottedTime}</p>
                            </div>
                        ) : (
                            <p className="text-xs font-bold text-emerald-600 mt-4">AVAILABLE</p>
                        )}
                    </div>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-6">
                <section className="col-span-3 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Incoming Requests</h3>
                  <div className="space-y-3">
                    {patients.filter(p => p.bookingStatus === 'Pending').map(p => (
                      <div key={p._id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <p className="font-bold text-slate-800 text-sm mb-1">{p.name}</p>
                        <p className="text-[10px] text-slate-500 mb-3 italic">"{p.condition}"</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleAppointmentDecision(p._id, 'Accepted')} className="flex-1 bg-teal-500 text-white text-[10px] font-black py-2 rounded-lg hover:bg-teal-600 transition uppercase tracking-wider">Accept</button>
                          <button onClick={() => handleAppointmentDecision(p._id, 'Rejected')} className="flex-1 bg-slate-100 text-slate-400 text-[10px] font-black py-2 rounded-lg hover:bg-slate-200 transition uppercase tracking-wider">Reject</button>
                        </div>
                      </div>
                    ))}
                    {patients.filter(p => p.bookingStatus === 'Pending').length === 0 && <p className="text-xs text-slate-400 italic">No pending requests</p>}
                  </div>
                </section>

                <section className="col-span-6 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-8">
                       <h3 className="font-bold text-slate-800">Active Patient Flow</h3>
                       <button onClick={() => { setFormData(initialPatientState); setShowRegModal(true); }} className="bg-teal-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-teal-700 transition-all uppercase tracking-wide">+ Quick Entry</button>
                    </div>

                    <div className="space-y-4">
                       {filteredPatients.filter(p => p.status !== 'Discharged' && p.bookingStatus === 'Accepted').map(p => (
                        <div key={p._id} 
                             className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${p.status === 'In-Consultation' ? 'border-l-8 border-emerald-500 bg-emerald-50/20' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex items-center gap-4 w-[30%]">
                            <div className="w-10 h-10 rounded-xl bg-white flex flex-col items-center justify-center shadow-sm border border-teal-100 flex-shrink-0">
                                <span className="text-[7px] uppercase font-black text-slate-400">Pos</span>
                                <span className="text-xs font-black text-teal-600">{p.queuePosition || "0"}</span>
                            </div>
                            <div className="overflow-hidden">
                              <p className="font-bold text-sm text-slate-800 truncate">{p.name}</p>
                              <p className="text-[10px] text-teal-500 font-bold uppercase truncate tracking-tight">{p.assignedDoctor ? `Dr. ${p.assignedDoctor}` : 'Unassigned'}</p>
                            </div>
                          </div>

                          <div className="flex-1 flex justify-center px-4">
                            <button
                                onClick={() => handleOpenApproveModal(p)}
                                className={`text-[12px] font-black px-5 py-2 rounded-lg border shadow-sm min-w-[100px] text-center transition-all ${
                                    p.appointmentTime && p.appointmentTime !== 'Not Scheduled' 
                                    ? 'text-teal-700 bg-white border-teal-200 hover:bg-teal-50' 
                                    : 'text-white bg-orange-500 border-orange-400 hover:bg-orange-600 uppercase tracking-widest'
                                }`}
                            >
                                {p.appointmentTime && p.appointmentTime !== 'Not Scheduled' ? p.appointmentTime : 'Set Time'}
                            </button>
                          </div>

                          <div className="flex gap-2 w-[35%] justify-end">
                            <select value={p.roomNumber || "Not Assigned"} onChange={(e) => handleRoomChange(p._id, e.target.value)}
                              className="text-[10px] font-bold px-2 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer w-24">
                              <option value="Not Assigned">Room</option>
                              {roomsList.map(room => <option key={room} value={room}>{room}</option>)}
                            </select>
                            <select value={p.status === 'In-Consultation' ? 'In-Room' : p.status} onChange={(e) => handleStatusChange(p._id, e.target.value)}
                              className={`text-[10px] font-black px-2 py-2 rounded-lg uppercase outline-none shadow-sm cursor-pointer transition w-28 ${p.status === 'In-Consultation' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                              <option value="Waiting">Waiting</option>
                              <option value="In-Room">In-Room</option>
                              <option value="Discharged">Done</option>
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
          )}

          {activeTab === 'Patient Records' && <PatientRecords />}
          
          {activeTab === 'Appointment Calendar' && (
            <AppointmentCalendar 
              doctors={doctors} 
              patients={patients} 
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
          )}

          {activeTab === 'Billing & Reports' && <Billing />}
          {activeTab === 'Settings' && <Settings />}
        </div>
      </main>

      {showApproveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border-4 border-teal-500">
            <h2 className="text-xl font-black mb-2 text-slate-800">Assign Best Slot</h2>
            <p className="text-xs text-slate-500 mb-6 font-semibold uppercase tracking-widest">Patient: {selectedPatient?.name}</p>
            
            <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Live Availability Heatmap</p>
              <div className="flex gap-1 overflow-x-auto pb-2">
                {[0, 15, 30, 45].map(m => (
                  <div key={m} className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-[9px] font-bold border transition ${m === 45 ? 'bg-teal-500 text-white animate-pulse border-teal-600' : 'bg-white text-slate-400 border-slate-100'}`}>
                    10:{m === 0 ? '00' : m}
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-teal-600 font-bold mt-2 italic">Next Free Slot: {suggestNextSlot(selectedPatient?.assignedDoctor)}</p>
            </div>

            <form onSubmit={submitFinalApproval} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Room Assignment</label>
                <select className="w-full p-3 mt-1 bg-slate-50 rounded-xl border border-slate-100 outline-none font-bold text-sm" value={approvalData.roomNumber} onChange={(e) => setApprovalData({...approvalData, roomNumber: e.target.value})} required>
                  {roomsList.map(room => <option key={room} value={room}>{room}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Confirm Time</label>
                <input type="time" className="w-full p-3 mt-1 bg-slate-50 rounded-xl border border-teal-200 text-teal-600 outline-none font-black text-sm" value={approvalData.appointmentTime} onChange={(e) => setApprovalData({...approvalData, appointmentTime: e.target.value})} required />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-teal-600 text-white py-4 rounded-2xl font-black text-xs hover:bg-teal-700 uppercase tracking-widest shadow-lg">Confirm & Queue</button>
                <button type="button" onClick={() => setShowApproveModal(false)} className="px-4 py-3 text-slate-400 font-bold text-xs uppercase tracking-tighter">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRegModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-md rounded-[2rem] p-8 shadow-2xl">
            <h2 className="text-xl font-black mb-6 text-slate-800">New Patient Registration</h2>
            <form onSubmit={handleAddPatient} className="space-y-4">
              <input placeholder="Patient Name" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              <div className="flex gap-4">
                <input placeholder="Phone" required className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                <input placeholder="Age" type="number" className="w-24 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} />
              </div>
              <div className="flex gap-4">
                <select className="w-1/2 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                  <option value="">Gender</option><option value="Male">Male</option><option value="Female">Female</option>
                </select>
                <input type="date" className="w-1/2 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={formData.appointmentDate} onChange={(e) => setFormData({...formData, appointmentDate: e.target.value})} />
              </div>
              <div className="flex gap-4">
                <select className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={formData.assignedDoctor} onChange={(e) => setFormData({...formData, assignedDoctor: e.target.value})} required>
                  <option value="">Assign Doctor</option>
                  {doctors.map(doc => <option key={doc._id} value={doc.name}>Dr. {doc.name}</option>)}
                </select>
                <input type="time" className="w-1/3 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none font-bold" value={formData.appointmentTime} onChange={(e) => setFormData({...formData, appointmentTime: e.target.value})} />
              </div>
              <textarea placeholder="Reason" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none h-20" value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value})} />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 uppercase tracking-widest">Register</button>
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
              <input placeholder="Full Name" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={docFormData.name} onChange={(e) => setDocFormData({...docFormData, name: e.target.value})} />
              <input placeholder="Email Address" type="email" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={docFormData.email} onChange={(e) => setDocFormData({...docFormData, email: e.target.value})} />
              <input placeholder="Password" type="password" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={docFormData.password} onChange={(e) => setDocFormData({...docFormData, password: e.target.value})} />
              <input placeholder="Specialization" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none" value={docFormData.specialization} onChange={(e) => setDocFormData({...docFormData, specialization: e.target.value})} />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#1E293B] text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition uppercase tracking-widest">Save Staff</button>
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