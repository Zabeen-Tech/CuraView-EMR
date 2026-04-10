import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const [patientData, setPatientData] = useState(null);
  const [error, setError] = useState(null);

  // --- NEW STATES FOR BOOKING ---
  const [doctors, setDoctors] = useState([]);
  const [bookingData, setBookingData] = useState({ doctor: '', date: '', reason: '' });
  const [bookingMsg, setBookingMsg] = useState('');

  useEffect(() => {
    fetchMyRecords();
    fetchDoctors();

    // AUTO-REFRESH: Check for status updates every 5 seconds
    const interval = setInterval(() => {
      fetchMyRecords();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchMyRecords = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setError("Session expired. Please login again.");
      return;
    }
    try {
      const response = await axios.get(`http://localhost:5000/api/patients/${userId}`);
      // Check if response.data is the patient object directly or wrapped
      const data = response.data.patient || response.data;
      if (data) {
        setPatientData(data);
      } else {
        setError("Patient record not found.");
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      // Don't set global error on background refresh to avoid flickering
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/doctors');
      setDoctors(res.data);
    } catch (err) {
      console.error("Error fetching doctors", err);
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem('userId');
    try {
      await axios.put(`http://localhost:5000/api/patients/${userId}`, {
        doctor: bookingData.doctor,
        assignedDoctor: bookingData.doctor, 
        date: bookingData.date,
        condition: bookingData.reason,
        bookingStatus: 'Pending',
        queuePosition: 0 
      });
      setBookingMsg("✅ Request Sent! Waiting for Admin approval.");
      fetchMyRecords(); 
    } catch (err) {
      setBookingMsg("❌ Failed to send request.");
    }
  };

  const handleResetBooking = async () => {
    const userId = localStorage.getItem('userId');
    try {
      await axios.put(`http://localhost:5000/api/patients/${userId}`, {
        bookingStatus: 'None',
        queuePosition: 0,
        adminNotes: '',
        appointmentTime: 'Not Scheduled',
        roomNumber: 'Not Assigned'
      });
      setBookingMsg("");
      fetchMyRecords();
    } catch (err) {
      console.error("Reset failed");
    }
  };

  if (error) {
    return (
      <div style={loadingStyle}>
        <div style={{textAlign: 'center'}}>
          <p style={{color: '#F87171', fontWeight: 'bold'}}>{error}</p>
          <button onClick={() => {localStorage.clear(); navigate('/');}} style={{...sidebarLogoutBtn, marginTop: '20px', padding: '10px 20px'}}>Back to Login</button>
        </div>
      </div>
    );
  }

  if (!patientData) return <div style={loadingStyle}>Loading your health records...</div>;

  return (
    <div style={containerStyle}>
      <aside style={sidebarStyle}>
        <div style={logoSection}><span style={logoText}>Patient Portal</span></div>
        <div style={profileSection}>
          <div style={avatarCircle}>{patientData.name ? patientData.name[0] : "P"}</div>
          <div>
            <div style={pNameText}>{patientData.name}</div>
            <div style={pStatusText}>Patient ID: {patientData._id ? patientData._id.slice(-6) : "------"}</div>
          </div>
        </div>
        <nav style={navStyle}>
          <div style={navItemActive}>My Health Summary</div>
        </nav>
        <button onClick={() => {localStorage.clear(); navigate('/');}} style={sidebarLogoutBtn}>Sign Out</button>
      </aside>

      <main style={mainContentStyle}>
        <header style={topHeaderStyle}>
          <h1 style={headerTitle}>Welcome back, {patientData.name ? patientData.name.split(' ')[0] : "Patient"}!</h1>
          <p style={subHeader}>Here is your latest clinical summary and treatment history.</p>
        </header>

        <div style={dashboardGrid}>
          <section style={leftColumn}>
            <div style={card}>
              <h3 style={cardTitle}>Current Vitals</h3>
              <div style={vitalsGrid}>
                <div style={vitalsBox}><span style={vLabel}>Weight</span><span style={vValue}>{patientData.vitals?.weight || "--"} kg</span></div>
                <div style={vitalsBox}><span style={vLabel}>Height</span><span style={vValue}>{patientData.vitals?.height || "--"} cm</span></div>
                <div style={vitalsBox}><span style={vLabel}>Blood Pressure</span><span style={vValue}>{patientData.vitals?.bp || "--"}</span></div>
                <div style={vitalsBox}><span style={vLabel}>Temperature</span><span style={vValue}>{patientData.vitals?.temp || "--"}°C</span></div>
              </div>
            </div>

            <div style={card}>
              <h3 style={cardTitle}>Appointment Status</h3>
              
              {(!patientData.bookingStatus || 
                ['None', 'Cancelled', 'Rejected', ''].includes(patientData.bookingStatus)) ? (
                
                <form onSubmit={handleBookAppointment} style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {['Cancelled', 'Rejected'].includes(patientData.bookingStatus) && (
                    <div style={{fontSize: '12px', color: '#B91C1C', backgroundColor: '#FEF2F2', padding: '10px', borderRadius: '8px', border: '1px solid #FEE2E2'}}>
                      <strong>Status:</strong> Your previous request was {patientData.bookingStatus.toLowerCase()}. You may book a new one.
                    </div>
                  )}
                  
                  <select 
                    style={inputStyle}
                    required
                    onChange={(e) => setBookingData({...bookingData, doctor: e.target.value})}
                  >
                    <option value="">Select a Doctor</option>
                    {doctors.map(doc => (
                      <option key={doc._id} value={doc.name}>Dr. {doc.name} - {doc.specialization}</option>
                    ))}
                  </select>
                  <input 
                    type="date" 
                    style={inputStyle} 
                    required
                    onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
                  />
                  <textarea 
                    placeholder="Reason for visit..." 
                    style={{...inputStyle, height: '60px', resize: 'none'}} 
                    required
                    onChange={(e) => setBookingData({...bookingData, reason: e.target.value})}
                  />
                  <button type="submit" style={bookBtnStyle}>Request Appointment</button>
                  {bookingMsg && <p style={{fontSize: '12px', color: '#0D9488', textAlign: 'center', margin: 0}}>{bookingMsg}</p>}
                </form>
              ) : (
                <div style={{textAlign: 'center', padding: '10px 0'}}>
                  
                  {patientData.bookingStatus === 'Pending' && (
                    <div>
                      <div style={statusBadgePending}>⏳ Approval Pending</div>
                      <p style={statusDesc}>Your request has been sent to the admin. Please wait for confirmation.</p>
                      <button onClick={handleResetBooking} style={{background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline'}}>Withdraw Request</button>
                    </div>
                  )}

                  {(patientData.bookingStatus === 'Accepted' || patientData.bookingStatus === 'In-Consultation') && (
                    <div>
                      <div style={patientData.bookingStatus === 'In-Consultation' ? {...statusBadgeAccepted, backgroundColor: '#0D9488', color: 'white'} : statusBadgeAccepted}>
                        {patientData.bookingStatus === 'In-Consultation' ? "🏥 In-Consultation" : "✅ Confirmed"}
                      </div>
                      
                      <div style={queueInfoBox}>
                        <div style={{fontSize: '14px', color: '#64748B'}}>Current Queue Position</div>
                        <div style={{fontSize: '32px', fontWeight: 'bold', color: '#0D9488'}}>
                            {patientData.bookingStatus === 'In-Consultation' ? "#0" : `#${patientData.queuePosition || 1}`}
                        </div>
                        <div style={{fontSize: '12px', color: '#94A3B8', marginTop: '5px'}}>
                            {patientData.bookingStatus === 'In-Consultation' ? "The doctor is seeing you now." : `Est. Wait: ${patientData.estimatedWaitTime || (patientData.queuePosition || 1) * 15} mins`}
                        </div>
                      </div>

                      <div style={{
                        textAlign: 'left', 
                        marginBottom: '15px', 
                        padding: '15px', 
                        backgroundColor: '#F0F9FF', 
                        borderRadius: '12px',
                        border: '1px solid #BAE6FD'
                      }}>
                         <div style={{marginBottom: '10px'}}>
                            <span style={{fontSize: '12px', color: '#0369A1', fontWeight: '600', display: 'block', textTransform: 'uppercase'}}>Scheduled Time</span>
                            <span style={{fontSize: '20px', fontWeight: 'bold', color: '#0C4A6E'}}>
                              {patientData.appointmentTime && patientData.appointmentTime !== "Not Scheduled" 
                                ? patientData.appointmentTime 
                                : "Awaiting Time..."}
                            </span>
                         </div>
                         <div>
                            <span style={{fontSize: '12px', color: '#0369A1', fontWeight: '600', display: 'block', textTransform: 'uppercase'}}>Assigned Room</span>
                            <span style={{fontSize: '20px', fontWeight: 'bold', color: '#0C4A6E'}}>
                              {patientData.roomNumber && patientData.roomNumber !== "Not Assigned" 
                                ? patientData.roomNumber 
                                : "Assigning..."}
                            </span>
                         </div>
                      </div>

                      <p style={{...statusDesc, color: '#0F172A', fontWeight: '600'}}>
                        {patientData.bookingStatus === 'In-Consultation' ? "Please proceed to your assigned room." : "Please arrive at the clinic 10 mins before your time."}
                      </p>
                      {patientData.bookingStatus !== 'In-Consultation' && (
                        <button onClick={handleResetBooking} style={{background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '11px', marginTop: '10px'}}>Cancel Appointment</button>
                      )}
                    </div>
                  )}

                  {patientData.bookingStatus === 'Discharged' && (
                    <div style={{padding: '10px', backgroundColor: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0'}}>
                      <div style={{...statusBadgeAccepted, backgroundColor: '#10B981', color: 'white'}}>🏁 Visit Complete</div>
                      <p style={{...statusDesc, color: '#065F46', fontWeight: 'bold'}}>You have been discharged.</p>
                      <button onClick={handleResetBooking} style={{...bookBtnStyle, width: '100%', marginTop: '10px'}}>Book New Appointment</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={card}>
              <h3 style={cardTitle}>Personal Details</h3>
              <div style={detailRow}><strong>Phone:</strong> {patientData.phone}</div>
              <div style={detailRow}><strong>Age/Gender:</strong> {patientData.age} / {patientData.gender}</div>
              <div style={detailRow}><strong>Current Status:</strong> <span style={{color: '#0D9488', fontWeight: 'bold'}}>{patientData.bookingStatus || "No Active Request"}</span></div>
            </div>
          </section>

          <section style={rightColumn}>
            <div style={card}>
              <h3 style={cardTitle}>Consultation History</h3>
              <div style={historyList}>
                {patientData.visitHistory && patientData.visitHistory.length > 0 ? (
                  [...patientData.visitHistory].reverse().map((visit, index) => (
                    <div key={index} style={historyItem}>
                      <div style={historyHeader}>
                        <span style={historyDate}>{visit.date}</span>
                        <span style={historyDoc}>Dr. {visit.doctor || visit.doctorName}</span>
                      </div>
                      <div style={historyBody}>
                        <p><strong>Clinical Note:</strong> {visit.notes || visit.diagnosis}</p>
                        <div style={rxBox}>
                          <strong>💊 Prescription:</strong> {visit.medications || "No medications prescribed."}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={emptyText}>No previous visit records found.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

// --- STYLES (NO CHANGES) ---
const containerStyle = { display: 'flex', minHeight: '100vh', backgroundColor: '#F1F5F9', fontFamily: 'Inter, sans-serif' };
const sidebarStyle = { width: '260px', backgroundColor: '#1E293B', color: 'white', display: 'flex', flexDirection: 'column', padding: '25px', position: 'fixed', height: '100vh', zIndex: 10 };
const logoSection = { marginBottom: '40px' };
const logoText = { fontSize: '22px', fontWeight: 'bold', color: '#5EEAD4' };
const profileSection = { display: 'flex', gap: '12px', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #334155', marginBottom: '20px' };
const avatarCircle = { width: '45px', height: '45px', borderRadius: '50%', backgroundColor: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' };
const pNameText = { fontSize: '16px', fontWeight: '600' };
const pStatusText = { fontSize: '12px', color: '#94A3B8' };
const navStyle = { flex: 1 };
const navItemActive = { padding: '14px 15px', borderRadius: '8px', backgroundColor: '#334155', borderLeft: '4px solid #0D9488', color: 'white', fontWeight: 'bold' };
const sidebarLogoutBtn = { padding: '12px', background: 'none', border: '1px solid #F87171', color: '#F87171', borderRadius: '8px', cursor: 'pointer', marginTop: 'auto' };
const mainContentStyle = { flex: 1, padding: '40px', marginLeft: '260px' };
const topHeaderStyle = { marginBottom: '30px' };
const headerTitle = { fontSize: '28px', fontWeight: 'bold', color: '#1E293B', margin: 0 };
const subHeader = { color: '#64748B', marginTop: '5px' };
const dashboardGrid = { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '30px' };
const leftColumn = { display: 'flex', flexDirection: 'column' };
const rightColumn = { display: 'flex', flexDirection: 'column' };
const card = { backgroundColor: 'white', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '25px' };
const cardTitle = { fontSize: '18px', fontWeight: 'bold', color: '#0D9488', marginBottom: '20px', borderBottom: '2px solid #F1F5F9', paddingBottom: '10px' };
const vitalsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const vitalsBox = { padding: '15px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' };
const vLabel = { fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 'bold' };
const vValue = { fontSize: '18px', fontWeight: 'bold', color: '#0F172A', marginTop: '5px' };
const detailRow = { marginBottom: '12px', fontSize: '14px', color: '#334155' };
const historyList = { display: 'flex', flexDirection: 'column', gap: '20px' };
const historyItem = { border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' };
const historyHeader = { backgroundColor: '#F8FAFC', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0' };
const historyDate = { fontWeight: 'bold', color: '#0D9488' };
const historyDoc = { fontSize: '13px', color: '#64748B' };
const historyBody = { padding: '15px', fontSize: '14px', color: '#334155' };
const rxBox = { marginTop: '10px', padding: '10px', backgroundColor: '#F0FDF4', borderRadius: '8px', color: '#166534', border: '1px dashed #86EFAC' };
const emptyText = { textAlign: 'center', color: '#94A3B8', padding: '40px' };
const loadingStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '20px', color: '#0D9488', backgroundColor: '#F1F5F9' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '14px', outline: 'none', fontFamily: 'inherit' };
const bookBtnStyle = { backgroundColor: '#0D9488', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: '0.3s' };
const statusBadgePending = { backgroundColor: '#FEF3C7', color: '#92400E', padding: '8px 16px', borderRadius: '20px', display: 'inline-block', fontWeight: 'bold', fontSize: '13px', marginBottom: '15px' };
const statusBadgeAccepted = { backgroundColor: '#DCFCE7', color: '#166534', padding: '8px 16px', borderRadius: '20px', display: 'inline-block', fontWeight: 'bold', fontSize: '13px', marginBottom: '15px' };
const statusBadgeRejected = { backgroundColor: '#FEE2E2', color: '#991B1B', padding: '8px 16px', borderRadius: '20px', display: 'inline-block', fontWeight: 'bold', fontSize: '13px', marginBottom: '15px' };
const statusDesc = { fontSize: '14px', color: '#64748B', lineHeight: '1.5', margin: '10px 0' };
const queueInfoBox = { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', margin: '15px 0' };

export default PatientDashboard;