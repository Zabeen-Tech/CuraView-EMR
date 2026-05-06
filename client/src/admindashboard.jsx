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
  
  // State for doctor shifts
  const [doctorShifts, setDoctorShifts] = useState({});
  
  // Edit/Delete Doctor States
  const [showEditDoctorModal, setShowEditDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [editDoctorData, setEditDoctorData] = useState({
    name: '',
    email: '',
    specialization: ''
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

  // Load shifts from localStorage on mount (fallback)
  useEffect(() => {
    const savedShifts = localStorage.getItem('doctorShifts');
    if (savedShifts) {
      setDoctorShifts(JSON.parse(savedShifts));
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
    const interval = setInterval(() => {
        fetchPatients();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle shift changes from AppointmentCalendar
  const handleShiftsChange = (shifts) => {
    setDoctorShifts(shifts);
    localStorage.setItem('doctorShifts', JSON.stringify(shifts));
  };

  // Helper function to convert 12-hour time to 24-hour for comparison
  const convertTime12To24 = (time12) => {
    if (!time12) return '';
    const time12Str = time12.toString().trim();
    if (!time12Str.includes('AM') && !time12Str.includes('PM')) return time12Str;
    
    const [time, modifier] = time12Str.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  // ✅ FIXED: isSlotBooked - Shows booked slots as greyed out
  const isSlotBooked = (doctorName, time12, date) => {
    if (!doctorName || !time12 || !date) return false;
    
    const inputTime24 = convertTime12To24(time12);
    
    // Get ALL patients that are active for this doctor on this date
    const allPatientsForDoctor = patients.filter(p => 
      p.assignedDoctor === doctorName && 
      p.appointmentDate === date && 
      p.bookingStatus === 'Accepted' &&
      p.status !== 'Discharged' &&
      p.status !== 'Cancelled'
    );
    
    // Check if any OTHER patient has this time slot (excluding current patient)
    const isBookedByOther = allPatientsForDoctor.some(p => {
      // Skip checking the current patient's own time slot
      if (p._id === selectedPatient?._id) return false;
      
      let storedTime = p.appointmentTime;
      if (!storedTime || storedTime === 'Not Scheduled' || storedTime === '') return false;
      
      let storedTime24 = storedTime;
      if (storedTime.includes('AM') || storedTime.includes('PM')) {
        storedTime24 = convertTime12To24(storedTime);
      }
      
      return storedTime24 === inputTime24;
    });
    
    return isBookedByOther;
  };

  // ✅ FIXED: getBookedSlotsForDoctor - Gets all booked slots excluding current patient
  const getBookedSlotsForDoctor = (doctorName, date) => {
    const bookedTimes = new Set();
    
    patients.forEach(p => {
      if (p.assignedDoctor === doctorName && 
          p.appointmentDate === date && 
          p.bookingStatus === 'Accepted' &&
          p.status !== 'Discharged' &&
          p.status !== 'Cancelled' &&
          p._id !== selectedPatient?._id &&  // ← EXCLUDE current patient
          p.appointmentTime && 
          p.appointmentTime !== 'Not Scheduled' &&
          p.appointmentTime !== '') {
        
        let time = p.appointmentTime;
        // Convert to consistent 12-hour format for display
        if (time && !time.includes('AM') && !time.includes('PM')) {
          const [hours, minutes] = time.split(':');
          const hour = parseInt(hours);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const hour12 = hour % 12 || 12;
          time = `${hour12}:${minutes} ${ampm}`;
        }
        bookedTimes.add(time);
      }
    });
    
    return Array.from(bookedTimes);
  };

  // ✅ UPDATED: fetchPatients with console log
  const fetchPatients = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/patients');
      console.log("✅ Patients fetched from API:", res.data.length);
      setPatients([...res.data]);
    } catch (err) { console.error("Fetch Patients Error", err); }
  };

  // ✅ UPDATED: fetchDoctors with spread operator to force re-render
  const fetchDoctors = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/doctors');
      console.log("✅ Doctors fetched from API:", res.data);
      setDoctors([...res.data]);
    } catch (err) { console.error("Fetch Doctors Error", err); }
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
    const usedRooms = patients.filter(p => p.roomNumber && p.roomNumber !== "Not Assigned").map(p => p.roomNumber);
    return roomsList.find(r => !usedRooms.includes(r)) || roomsList[0];
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    try {
      const queuePos = patients.filter(p => 
        p.assignedDoctor === formData.assignedDoctor && 
        p.bookingStatus === 'Accepted' &&
        p.appointmentDate === formData.appointmentDate
      ).length + 1;

      const dataToSend = {
        ...formData,
        appointmentTime: 'Not Scheduled',
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

  // ✅ UPDATED: handleAddDoctor with proper refresh
  const handleAddDoctor = async (e) => {
    e.preventDefault();
    try {
      console.log("Adding doctor:", docFormData);
      const response = await axios.post('http://localhost:5000/api/register', docFormData);
      console.log("Server response:", response.data);
      
      if (response.data.success) {
        setShowDocModal(false);
        await fetchDoctors();
        setDocFormData({ name: '', email: '', password: '', role: 'doctor', specialization: '' });
        alert("✅ Doctor added successfully!");
      } else {
        alert(response.data.message || "Error adding doctor");
      }
    } catch (err) { 
      console.error("Add doctor error:", err);
      alert(err.response?.data?.message || "Error adding doctor"); 
    }
  };

  const handleEditDoctor = (doctor) => {
    setEditingDoctor(doctor);
    setEditDoctorData({
      name: doctor.name,
      email: doctor.email,
      specialization: doctor.specialization
    });
    setShowEditDoctorModal(true);
  };

  const handleUpdateDoctor = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/doctors/${editingDoctor._id}`, editDoctorData);
      setShowEditDoctorModal(false);
      setEditingDoctor(null);
      fetchDoctors();
      alert(`✅ Doctor ${editDoctorData.name} updated successfully!`);
    } catch (err) {
      alert("Failed to update doctor: " + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteDoctor = async (doctorId, doctorName) => {
    if (window.confirm(`Are you sure you want to delete Dr. ${doctorName}? This action cannot be undone.`)) {
      try {
        await axios.delete(`http://localhost:5000/api/doctors/${doctorId}`);
        fetchDoctors();
        alert(`✅ Dr. ${doctorName} deleted successfully!`);
      } catch (err) {
        alert("Failed to delete doctor: " + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleStatusChange = async (patientId, newStatus) => {
    try {
      const dbStatus = newStatus === 'In-Room' ? 'In-Consultation' : newStatus;
      
      const currentPatient = patients.find(p => p._id === patientId);
      
      if ((currentPatient?.status === 'In-Consultation' && dbStatus === 'Waiting') ||
          (currentPatient?.status === 'Waiting' && dbStatus === 'In-Consultation')) {
        await axios.put(`http://localhost:5000/api/patients/${patientId}`, { 
          status: dbStatus,
          queuePosition: currentPatient.queuePosition
        });
      } else {
        await axios.put(`http://localhost:5000/api/patients/${patientId}/status`, { status: dbStatus });
      }
      
      fetchPatients(); 
    } catch (err) { 
      console.error("Status update failed", err);
      alert("Status update failed"); 
    }
  };

  const handleRoomChange = async (patientId, newRoom) => {
    try {
      await axios.put(`http://localhost:5000/api/patients/${patientId}`, { roomNumber: newRoom });
      fetchPatients(); 
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

  const getSlotsForHour = (time12) => {
    if (!time12) return [];
    const [timePart, modifier] = time12.split(' ');
    let hour = parseInt(timePart.split(':')[0]);
    let hour24 = hour;
    if (modifier === 'PM' && hour !== 12) hour24 = hour + 12;
    if (modifier === 'AM' && hour === 12) hour24 = 0;
    
    const slots = [];
    for (let minute of [0, 15, 30, 45]) {
      let displayHour = hour24 > 12 ? hour24 - 12 : hour24;
      if (displayHour === 0) displayHour = 12;
      const displayAmpm = hour24 >= 12 ? 'PM' : 'AM';
      const time12Str = `${displayHour}:${minute.toString().padStart(2, '0')} ${displayAmpm}`;
      slots.push(time12Str);
    }
    return slots;
  };

  // ✅ FIXED: handleOpenApproveModal
  const handleOpenApproveModal = async (patient) => {
    setSelectedPatient(patient);
    
    let existingTime24 = '';
    if (patient.appointmentTime && patient.appointmentTime !== 'Not Scheduled' && patient.appointmentTime !== '') {
      existingTime24 = convertTo24hr(patient.appointmentTime);
    }
    
    setApprovalData({
      roomNumber: patient.roomNumber !== "Not Assigned" ? patient.roomNumber : suggestNextRoom(),
      appointmentTime: existingTime24
    });
    setShowApproveModal(true);
  };

  const submitFinalApproval = async (e) => {
    e.preventDefault();
    
    if (!approvalData.appointmentTime) {
      alert("❌ Please select a time slot before confirming.");
      return;
    }
    
    const selectedTime12 = convertTo12hr(approvalData.appointmentTime);
    const selectedDate = selectedPatient.appointmentDate;
    
    if (isSlotBooked(selectedPatient.assignedDoctor, selectedTime12, selectedDate)) {
      alert(`❌ The time slot ${selectedTime12} is already BOOKED for Dr. ${selectedPatient.assignedDoctor}. Please select a different time.`);
      return;
    }
    
    try {
      await axios.put(`http://localhost:5000/api/patients/${selectedPatient._id}/respond-appointment`, {
        decision: 'Accepted', 
        adminNotes: "Confirmed via Heatmap",
        queuePosition: selectedPatient.queuePosition,
        roomNumber: approvalData.roomNumber,
        appointmentTime: selectedTime12
      });
      
      setShowApproveModal(false);
      fetchPatients(); 
      alert(`✅ Appointment confirmed for ${selectedPatient.name} at ${selectedTime12} with Dr. ${selectedPatient.assignedDoctor}`);
    } catch (err) { 
      alert("Approval failed"); 
    }
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

  const getRecentBookedSlots = (doctorName, date) => {
    const bookedSlots = getBookedSlotsForDoctor(doctorName, date);
    return bookedSlots.slice(0, 5);
  };

  const getSortableTime = (timeStr) => {
    if (!timeStr || timeStr === 'Not Scheduled' || timeStr === '') return '99:99';
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = match[2];
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hour !== 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    }
    return '99:99';
  };

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
          {['Dashboard', 'Patient Records', 'Shift Manager', 'Billing & Reports', 'Settings'].map((item) => (
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
                {roomsList.map((room, i) => {
                  const occupiedPatient = patients.find(p => p.roomNumber === room && p.status !== 'Discharged');
                  return (
                    <div key={i} className={`p-4 rounded-2xl border-t-4 shadow-sm bg-white transition-all ${occupiedPatient ? 'border-red-500' : 'border-emerald-500'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase">{room}</span>
                        <div className={`w-2 h-2 rounded-full ${occupiedPatient ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                      </div>
                      {occupiedPatient ? (
                        <div>
                          <p className="text-xs font-bold text-slate-800 truncate">Dr. {occupiedPatient.assignedDoctor}</p>
                          <p className="text-[10px] text-slate-500 truncate">{occupiedPatient.name}</p>
                          <p className="text-[9px] mt-2 bg-slate-100 w-fit px-2 py-0.5 rounded text-slate-600 font-bold">Since {occupiedPatient.appointmentTime || '--'}</p>
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-emerald-600 mt-4">AVAILABLE</p>
                      )}
                    </div>
                  );
                })}
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
                       {filteredPatients
                         .filter(p => p.status !== 'Discharged' && p.bookingStatus === 'Accepted')
                         .sort((a, b) => {
                           const timeA = getSortableTime(a.appointmentTime);
                           const timeB = getSortableTime(b.appointmentTime);
                           return timeA.localeCompare(timeB);
                         })
                         .map(p => (
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
                                    p.appointmentTime && p.appointmentTime !== 'Not Scheduled' && p.appointmentTime !== '' 
                                    ? 'text-teal-700 bg-white border-teal-200 hover:bg-teal-50' 
                                    : 'text-white bg-orange-500 border-orange-400 hover:bg-orange-600 uppercase tracking-widest'
                                }`}
                            >
                                {p.appointmentTime && p.appointmentTime !== 'Not Scheduled' && p.appointmentTime !== '' ? p.appointmentTime : '--:--'}
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
                    <button onClick={() => setShowDocModal(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-teal-700 transition">+ Add</button>
                  </div>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {doctors.map(doc => (
                      <div key={doc._id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-sm flex-shrink-0">🩺</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-700 truncate">{doc.name}</p>
                            <p className="text-[9px] text-teal-500 font-bold uppercase truncate">{doc.specialization}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button 
                            onClick={() => handleEditDoctor(doc)}
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition"
                            title="Edit Doctor"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => handleDeleteDoctor(doc._id, doc.name)}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                            title="Delete Doctor"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                    {doctors.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">No doctors added yet</p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}

          {activeTab === 'Patient Records' && <PatientRecords />}
          
          {activeTab === 'Shift Manager' && (
            <AppointmentCalendar 
              doctors={doctors} 
              patients={patients} 
              onShiftsChange={handleShiftsChange}
              onSlotClick={(time, date) => { 
                setFormData({ 
                  ...initialPatientState, 
                  appointmentTime: 'Not Scheduled',
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
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl border-4 border-teal-500">
            <h2 className="text-xl font-black mb-1 text-slate-800">Assign Best Slot</h2>
            <p className="text-xs text-slate-500 mb-4 font-semibold">Patient: {selectedPatient?.name}</p>
            
            {(() => {
              const currentHour12 = approvalData.appointmentTime ? convertTo12hr(approvalData.appointmentTime) : "09:00 AM";
              const currentSlots = getSlotsForHour(currentHour12);
              const bookedSlots = getRecentBookedSlots(selectedPatient?.assignedDoctor, selectedPatient?.appointmentDate);
              const totalBookedCount = getBookedSlotsForDoctor(selectedPatient?.assignedDoctor, selectedPatient?.appointmentDate).length;
              
              return (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Quick jump to hour:</p>
                    <div className="flex flex-wrap gap-2">
                      {["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"].map(hour => {
                        const isSelected = approvalData.appointmentTime && convertTo12hr(approvalData.appointmentTime).split(' ')[0] === hour.split(' ')[0];
                        return (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => {
                              setApprovalData({...approvalData, appointmentTime: convertTo24hr(hour)});
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                              isSelected
                                ? 'bg-teal-600 text-white'
                                : 'bg-white text-slate-700 border border-teal-200 hover:bg-teal-50'
                            }`}
                          >
                            {hour}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
                    <p className="text-sm font-bold text-teal-700 mb-3 flex items-center gap-2">
                      <span className="text-base">⚡</span> Slots for {currentHour12}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {currentSlots.map((slot, idx) => {
                        const isSelected = approvalData.appointmentTime === convertTo24hr(slot);
                        const isBooked = isSlotBooked(selectedPatient?.assignedDoctor, slot, selectedPatient?.appointmentDate);
                        
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (!isBooked) {
                                setApprovalData({...approvalData, appointmentTime: convertTo24hr(slot)});
                              }
                            }}
                            disabled={isBooked}
                            className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                              isSelected
                                ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-300'
                                : isBooked
                                ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed line-through'
                                : 'bg-white text-slate-700 border border-teal-300 hover:bg-teal-100 cursor-pointer'
                            }`}
                          >
                            {slot}
                            {isBooked && <span className="block text-[8px]">Booked</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {bookedSlots.length > 0 && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                      <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
                        <span>📋</span> Already Booked Today (Other Patients)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {bookedSlots.map((slot, idx) => (
                          <span key={idx} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full line-through">
                            {slot}
                          </span>
                        ))}
                        {totalBookedCount > 5 && (
                          <span className="text-xs text-amber-500">+{totalBookedCount - 5} more</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {approvalData.appointmentTime ? (
                    <div className="bg-teal-50 p-3 rounded-xl border border-teal-200">
                      <p className="text-xs text-teal-600 font-semibold">Selected Time:</p>
                      <p className="text-base font-bold text-teal-800">{convertTo12hr(approvalData.appointmentTime)}</p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                      <p className="text-xs text-amber-600 font-semibold">No time selected</p>
                      <p className="text-sm text-amber-700">Please select a time slot above</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <form onSubmit={submitFinalApproval} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Room Assignment</label>
                <select className="w-full p-3 mt-1 bg-slate-50 rounded-xl border border-slate-100 outline-none font-bold text-sm" value={approvalData.roomNumber} onChange={(e) => setApprovalData({...approvalData, roomNumber: e.target.value})} required>
                  {roomsList.map(room => <option key={room} value={room}>{room}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-700 uppercase tracking-wider shadow-lg">Confirm & Queue</button>
                <button type="button" onClick={() => setShowApproveModal(false)} className="px-4 py-3 text-slate-400 font-bold text-sm uppercase tracking-tighter">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditDoctorModal && editingDoctor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl border-4 border-amber-500">
            <h2 className="text-xl font-black mb-2 text-slate-800">Edit Doctor</h2>
            <p className="text-xs text-slate-500 mb-6 font-semibold uppercase tracking-widest">Update doctor information</p>
            
            <form onSubmit={handleUpdateDoctor} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-3 mt-1 bg-slate-50 rounded-xl border border-slate-100 outline-none font-bold text-sm"
                  value={editDoctorData.name}
                  onChange={(e) => setEditDoctorData({...editDoctorData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  className="w-full p-3 mt-1 bg-slate-50 rounded-xl border border-slate-100 outline-none font-bold text-sm"
                  value={editDoctorData.email}
                  onChange={(e) => setEditDoctorData({...editDoctorData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Specialization</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-3 mt-1 bg-slate-50 rounded-xl border border-slate-100 outline-none font-bold text-sm"
                  value={editDoctorData.specialization}
                  onChange={(e) => setEditDoctorData({...editDoctorData, specialization: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-amber-700 uppercase tracking-wider shadow-lg">Update Doctor</button>
                <button type="button" onClick={() => setShowEditDoctorModal(false)} className="px-4 py-3 text-slate-400 font-bold text-sm uppercase tracking-tighter">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ UPDATED: Compact Quick Entry Modal */}
      {showRegModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">New Patient Registration</h2>
              <button onClick={() => setShowRegModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleAddPatient} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input 
                  placeholder="Patient Name" 
                  required 
                  className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:ring-1 focus:ring-teal-500" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                />
                <input 
                  placeholder="Phone" 
                  required 
                  className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <input 
                  placeholder="Age" 
                  type="number" 
                  className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm" 
                  value={formData.age} 
                  onChange={(e) => setFormData({...formData, age: e.target.value})} 
                />
                <select 
                  className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm" 
                  value={formData.gender} 
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <input 
                  type="date" 
                  className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm" 
                  value={formData.appointmentDate} 
                  onChange={(e) => setFormData({...formData, appointmentDate: e.target.value})} 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <select 
                  className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm" 
                  value={formData.assignedDoctor} 
                  onChange={(e) => setFormData({...formData, assignedDoctor: e.target.value})} 
                  required
                >
                  <option value="">Assign Doctor</option>
                  {doctors.map(doc => <option key={doc._id} value={doc.name}>Dr. {doc.name}</option>)}
                </select>
                <input 
                  type="time" 
                  className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm font-bold" 
                  value={formData.appointmentTime} 
                  onChange={(e) => setFormData({...formData, appointmentTime: e.target.value})} 
                />
              </div>
              
              <textarea 
                placeholder="Reason for visit..." 
                className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm h-16 resize-none" 
                value={formData.condition} 
                onChange={(e) => setFormData({...formData, condition: e.target.value})} 
              />
              
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-teal-700 transition">Register</button>
                <button type="button" onClick={() => setShowRegModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-lg font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
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