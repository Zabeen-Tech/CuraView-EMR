import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const [patientData, setPatientData] = useState(null);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [livePosition, setLivePosition] = useState(null);
  const [liveEstimatedWait, setLiveEstimatedWait] = useState(0);
  const [liveStatus, setLiveStatus] = useState(null);
  const [allPatients, setAllPatients] = useState([]);
  
  // NEW: State for cancel confirmation modal
  const [showCancelModal, setShowCancelModal] = useState(false);

  // --- NEW STATES FOR BOOKING ---
  const [doctors, setDoctors] = useState([]);
  const [bookingData, setBookingData] = useState({ doctor: '', date: '', reason: '' });
  const [bookingMsg, setBookingMsg] = useState('');

  // WebSocket connection for real-time Live Pulse
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    const newSocket = io('http://localhost:5000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Patient socket connected');
      newSocket.emit('join-room', 'patient');
    });

    // Listen for queue updates
    newSocket.on('queue_updated', () => {
      fetchMyRecords();
      fetchLivePosition();
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    fetchMyRecords();
    fetchDoctors();
    fetchAllPatients();

    // AUTO-REFRESH: Check for status updates every 5 seconds
    const interval = setInterval(() => {
      fetchMyRecords();
      fetchAllPatients();
      fetchLivePosition();
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
      const data = response.data.patient || response.data;
      if (data) {
        setPatientData(data);
      } else {
        setError("Patient record not found.");
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    }
  };

  const fetchAllPatients = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/patients');
      setAllPatients(response.data || []);
    } catch (err) {
      console.error("Fetch all patients error:", err);
    }
  };

  const fetchLivePosition = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId || !patientData) return;
    
    try {
      // Get all patients and calculate position based on doctor's queue
      const allPatientsData = allPatients.length > 0 ? allPatients : await axios.get('http://localhost:5000/api/patients').then(res => res.data);
      
      // Filter patients for the SAME doctor, with status 'Waiting' or 'In-Consultation'
      const doctorPatients = allPatientsData.filter(p => 
        p.assignedDoctor === patientData.assignedDoctor && 
        (p.status === 'Waiting' || p.status === 'In-Consultation')
      ).sort((a, b) => a.queuePosition - b.queuePosition);
      
      // Find this patient's position in the doctor's queue
      const patientIndex = doctorPatients.findIndex(p => p._id === userId);
      
      if (patientIndex !== -1) {
        const position = patientIndex + 1;
        setLivePosition(position);
        setLiveEstimatedWait(position * 10);
        setLiveStatus(doctorPatients[patientIndex].status);
      } else if (patientData.status === 'In-Consultation') {
        setLivePosition(0);
        setLiveEstimatedWait(0);
        setLiveStatus('in-progress');
      } else {
        setLivePosition(null);
        setLiveEstimatedWait(0);
        setLiveStatus(null);
      }
    } catch (err) {
      console.error("Fetch live position error:", err);
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

  // ✅ FIXED: handleBookAppointment - sets appointmentTime to 'Not Scheduled'
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem('userId');
    
    // Validate inputs
    if (!bookingData.doctor) {
      setBookingMsg("❌ Please select a doctor");
      return;
    }
    if (!bookingData.date) {
      setBookingMsg("❌ Please select a date");
      return;
    }
    if (!bookingData.reason) {
      setBookingMsg("❌ Please enter reason for visit");
      return;
    }
    
    try {
      await axios.put(`http://localhost:5000/api/patients/${userId}`, {
        assignedDoctor: bookingData.doctor,
        appointmentDate: bookingData.date,
        condition: bookingData.reason,
        bookingStatus: 'Pending',
        queuePosition: 0,
        appointmentTime: 'Not Scheduled',  // ← CRITICAL: Reset time
        roomNumber: 'Not Assigned',
        status: 'Waiting'
      });
      setBookingMsg("✅ Request Sent! Waiting for Admin approval.");
      // Reset form
      setBookingData({ doctor: '', date: '', reason: '' });
      fetchMyRecords();
      fetchLivePosition();
    } catch (err) {
      console.error("Booking error:", err);
      setBookingMsg("❌ Failed to send request. Please try again.");
    }
  };

  // ✅ FIXED: handleResetBooking - ensures appointmentTime is reset
  const handleResetBooking = async () => {
    const userId = localStorage.getItem('userId');
    try {
      await axios.put(`http://localhost:5000/api/patients/${userId}`, {
        bookingStatus: 'None',
        queuePosition: 0,
        adminNotes: '',
        appointmentTime: 'Not Scheduled',
        roomNumber: 'Not Assigned',
        status: 'Waiting'
      });
      setBookingMsg("");
      setBookingData({ doctor: '', date: '', reason: '' });
      fetchMyRecords();
      fetchLivePosition();
    } catch (err) {
      console.error("Reset failed", err);
    }
  };

  // ========== NEW: Cancel Appointment Function ==========
  const handleCancelAppointment = async () => {
    const userId = localStorage.getItem('userId');
    setShowCancelModal(false);
    
    try {
      // Call the cancel appointment API
      const response = await axios.put(`http://localhost:5000/api/patients/${userId}/cancel-appointment`);
      
      if (response.data.success) {
        alert(`✅ Your appointment has been cancelled successfully.`);
        // Refresh all data
        await fetchMyRecords();
        await fetchAllPatients();
        await fetchLivePosition();
        
        // Emit socket event to update all dashboards
        if (socket) {
          socket.emit('appointment_cancelled', { patientId: userId });
        }
      } else {
        alert("❌ Failed to cancel appointment. Please try again.");
      }
    } catch (err) {
      console.error("Cancel appointment error:", err);
      alert("❌ Failed to cancel appointment: " + (err.response?.data?.message || "Please try again"));
    }
  };

  // Update live position when allPatients changes
  useEffect(() => {
    if (patientData && allPatients.length > 0) {
      fetchLivePosition();
    }
  }, [allPatients, patientData]);

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

  // Check if appointment details are available
  const hasAppointmentDetails = patientData.appointmentTime && patientData.appointmentTime !== "Not Scheduled" && patientData.appointmentTime !== "";
  const hasRoomDetails = patientData.roomNumber && patientData.roomNumber !== "Not Assigned" && patientData.roomNumber !== "";

  return (
    <div style={containerStyle}>
      {/* Mobile Menu Button - Added for responsiveness */}
      <button className="mobile-menu-btn" onClick={() => {
        const sidebar = document.querySelector('.sidebar-mobile');
        if (sidebar) sidebar.style.left = '0';
      }} style={{position: 'fixed', top: '15px', left: '15px', zIndex: 100, background: '#1E293B', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '20px', cursor: 'pointer', display: 'none'}}>☰</button>
      
      <aside style={{...sidebarStyle, ...responsiveSidebar}} className="sidebar-mobile">
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

      <main style={{...mainContentStyle, ...responsiveMainContent}}>
        <header style={topHeaderStyle}>
          <h1 style={{...headerTitle, ...responsiveHeaderTitle}}>Welcome back, {patientData.name ? patientData.name.split(' ')[0] : "Patient"}!</h1>
          <p style={subHeader}>Here is your latest clinical summary and treatment history.</p>
        </header>

        <div style={{...dashboardGrid, ...responsiveDashboardGrid}}>
          <section style={{...leftColumn, ...responsiveLeftColumn}}>
            <div style={card}>
              <h3 style={cardTitle}>Current Vitals</h3>
              <div style={{...vitalsGrid, ...responsiveVitalsGrid}}>
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
                      {/* LIVE PULSE QUEUE POSITION - SMALLER RECTANGULAR CARD */}
                      <div style={{...livePulseContainerSmall, ...responsiveLivePulse}}>
                        <div style={{...livePulseHeaderSmall, ...responsiveLivePulseHeader}}>
                          <span style={livePulseIconSmall}>📡</span>
                          <span style={livePulseTitleSmall}>Live Pulse</span>
                          {livePosition !== null && livePosition > 0 && patientData.bookingStatus !== 'In-Consultation' && (
                            <span style={liveUpdateBadgeSmall}>Auto-refreshing</span>
                          )}
                        </div>
                        
                        {patientData.status === 'In-Consultation' || liveStatus === 'in-progress' ? (
                          <div style={consultationNowBoxSmall}>
                            <div style={consultationIconSmall}>👨‍⚕️</div>
                            <div style={{...consultationTextSmall, ...responsiveConsultationText}}>The doctor is seeing you NOW!</div>
                            <div style={consultationSubTextSmall}>Please proceed to your assigned room</div>
                          </div>
                        ) : (
                          <div style={{...queuePositionDisplaySmall, ...responsiveQueueDisplay}}>
                            <div style={{...positionNumberSmall, ...responsivePositionNumber}}>
                              {livePosition !== null ? livePosition : (patientData.queuePosition || 1)}
                            </div>
                            <div style={{...estimatedWaitSmall, ...responsiveEstimatedWait}}>
                              <strong>{liveEstimatedWait !== 0 ? liveEstimatedWait : ((patientData.queuePosition || 1) * 10)} min</strong>
                            </div>
                            <div style={progressBarContainerSmall}>
                              <div style={{
                                ...progressBarFillSmall,
                                width: livePosition !== null 
                                  ? `${Math.max(5, 100 - (livePosition - 1) * 15)}%` 
                                  : `${Math.max(5, 100 - ((patientData.queuePosition || 1) - 1) * 15)}%`
                              }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* PROFESSIONAL APPOINTMENT DETAILS SECTION */}
                      <div style={{...appointmentDetailsCard, ...responsiveAppointmentDetails}}>
                        <div style={appointmentDetailsHeader}>
                          <span style={appointmentDetailsIcon}>📋</span>
                          <span style={appointmentDetailsTitle}>Appointment Details</span>
                        </div>
                        <div style={{...appointmentDetailsGrid, ...responsiveAppointmentGrid}}>
                          <div style={appointmentDetailItem}>
                            <div style={appointmentDetailLabel}>Scheduled Time</div>
                            <div style={appointmentDetailValue}>
                              {hasAppointmentDetails ? patientData.appointmentTime : '—'}
                            </div>
                          </div>
                          <div style={appointmentDetailItem}>
                            <div style={appointmentDetailLabel}>Assigned Room</div>
                            <div style={appointmentDetailValue}>
                              {hasRoomDetails ? patientData.roomNumber : '—'}
                            </div>
                          </div>
                          <div style={appointmentDetailItem}>
                            <div style={appointmentDetailLabel}>Doctor</div>
                            <div style={appointmentDetailValue}>
                              Dr. {patientData.assignedDoctor || 'Not assigned'}
                            </div>
                          </div>
                          <div style={appointmentDetailItem}>
                            <div style={appointmentDetailLabel}>Date</div>
                            <div style={appointmentDetailValue}>
                              {patientData.appointmentDate || '—'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <p style={{...statusDesc, color: '#0F172A', fontWeight: '600'}}>
                        {patientData.status === 'In-Consultation' ? "Please proceed to your assigned room." : "Please arrive at the clinic 10 mins before your time."}
                      </p>
                      {patientData.status !== 'In-Consultation' && patientData.bookingStatus !== 'Discharged' && (
                        <button onClick={() => setShowCancelModal(true)} style={{background: 'none', border: '1px solid #F87171', color: '#F87171', cursor: 'pointer', fontSize: '12px', marginTop: '10px', padding: '8px 16px', borderRadius: '8px'}}>Cancel Appointment</button>
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

          <section style={{...rightColumn, ...responsiveRightColumn}}>
            <div style={card}>
              <h3 style={cardTitle}>Consultation History</h3>
              <div style={{...historyList, ...responsiveHistoryList}}>
                {patientData.visitHistory && patientData.visitHistory.length > 0 ? (
                  [...patientData.visitHistory].reverse().map((visit, index) => (
                    <div key={index} style={historyItem}>
                      <div style={{...historyHeader, ...responsiveHistoryHeader}}>
                        <span style={historyDate}>{visit.date}</span>
                        <span style={{...historyDoc, ...responsiveHistoryDoc}}>Dr. {visit.doctor || visit.doctorName}</span>
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

      {/* NEW: Cancel Appointment Confirmation Modal */}
      {showCancelModal && (
        <div style={modalOverlayStyle}>
          <div style={{...cancelModalContainer, ...responsiveModalContainer}}>
            <div style={cancelModalHeader}>
              <h3 style={{color: '#B91C1C', margin: 0}}>Cancel Appointment</h3>
              <button onClick={() => setShowCancelModal(false)} style={closeX}>✕</button>
            </div>
            <div style={cancelModalBody}>
              <p>Are you sure you want to cancel your appointment?</p>
              <p style={{fontSize: '12px', color: '#64748B', marginTop: '8px'}}>
                <strong>Patient:</strong> {patientData.name}<br/>
                <strong>Doctor:</strong> Dr. {patientData.assignedDoctor}<br/>
                <strong>Date:</strong> {patientData.appointmentDate}<br/>
                <strong>Time:</strong> {patientData.appointmentTime || 'Not scheduled'}
              </p>
              <p style={{fontSize: '12px', color: '#F87171', marginTop: '8px'}}>
                ⚠️ This action cannot be undone. Your slot will be freed for other patients.
              </p>
            </div>
            <div style={{...cancelModalFooter, ...responsiveModalFooter}}>
              <button onClick={handleCancelAppointment} style={{...cancelConfirmBtn, ...responsiveConfirmBtn}}>Yes, Cancel Appointment</button>
              <button onClick={() => setShowCancelModal(false)} style={{...cancelCancelBtn, ...responsiveCancelBtn}}>No, Go Back</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile close button script */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .mobile-menu-btn {
            display: block !important;
          }
          .sidebar-mobile {
            left: -280px !important;
            transition: left 0.3s ease !important;
            z-index: 1000 !important;
          }
          .sidebar-mobile.open {
            left: 0 !important;
          }
        }
      `}} />
    </div>
  );
};

// --- STYLES (Existing + Cancel Modal Styles) ---
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
const cardTitle = { fontSize: '18px', fontWeight: 'bold', color: '#0D9488', marginBottom: '20px', borderBottom: '2px solid #F1F5F9', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' };
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
const statusDesc = { fontSize: '14px', color: '#64748B', lineHeight: '1.5', margin: '10px 0' };

// APPOINTMENT DETAILS STYLES
const appointmentDetailsCard = {
  backgroundColor: '#F8FAFC',
  borderRadius: '16px',
  padding: '20px',
  margin: '15px 0',
  border: '1px solid #E2E8F0'
};

const appointmentDetailsHeader = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '16px',
  paddingBottom: '12px',
  borderBottom: '1px solid #E2E8F0'
};

const appointmentDetailsIcon = {
  fontSize: '18px'
};

const appointmentDetailsTitle = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#1E293B',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const appointmentDetailsGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px'
};

const appointmentDetailItem = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px'
};

const appointmentDetailLabel = {
  fontSize: '11px',
  fontWeight: '600',
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const appointmentDetailValue = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#0F172A'
};

// SMALLER RECTANGULAR LIVE PULSE STYLES
const livePulseContainerSmall = {
  backgroundColor: '#1E293B',
  borderRadius: '12px',
  padding: '12px 16px',
  margin: '12px 0',
  background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)'
};

const livePulseHeaderSmall = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '10px',
  borderBottom: '1px solid #334155',
  paddingBottom: '8px'
};

const livePulseIconSmall = {
  fontSize: '14px'
};

const livePulseTitleSmall = {
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#5EEAD4',
  textTransform: 'uppercase',
  letterSpacing: '1px'
};

const liveUpdateBadgeSmall = {
  backgroundColor: '#0D9488',
  color: 'white',
  fontSize: '8px',
  padding: '2px 6px',
  borderRadius: '20px',
  marginLeft: 'auto'
};

const queuePositionDisplaySmall = {
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px'
};

const positionNumberSmall = {
  fontSize: '36px',
  fontWeight: 'bold',
  color: '#5EEAD4',
  minWidth: '60px'
};

const positionLabelSmall = {
  fontSize: '10px',
  color: '#94A3B8',
  display: 'none'
};

const estimatedWaitSmall = {
  fontSize: '12px',
  color: '#CBD5E1',
  flex: 1
};

const progressBarContainerSmall = {
  backgroundColor: '#334155',
  borderRadius: '6px',
  height: '4px',
  width: '80px',
  overflow: 'hidden'
};

const progressBarFillSmall = {
  backgroundColor: '#0D9488',
  height: '100%',
  borderRadius: '6px',
  transition: 'width 0.5s ease-in-out'
};

const queueHintSmall = {
  fontSize: '10px',
  color: '#94A3B8',
  minWidth: '80px',
  textAlign: 'right'
};

const consultationNowBoxSmall = {
  textAlign: 'center',
  padding: '8px'
};

const consultationIconSmall = {
  fontSize: '28px',
  marginBottom: '4px'
};

const consultationTextSmall = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#5EEAD4',
  marginBottom: '2px'
};

const consultationSubTextSmall = {
  fontSize: '10px',
  color: '#94A3B8'
};

// NEW: Cancel Modal Styles
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const cancelModalContainer = {
  backgroundColor: 'white',
  borderRadius: '20px',
  width: '400px',
  maxWidth: '90%',
  overflow: 'hidden',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
};

const cancelModalHeader = {
  padding: '20px',
  borderBottom: '1px solid #E2E8F0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#FEF2F2'
};

const cancelModalBody = {
  padding: '20px'
};

const cancelModalFooter = {
  padding: '20px',
  borderTop: '1px solid #E2E8F0',
  display: 'flex',
  gap: '10px',
  justifyContent: 'flex-end'
};

const cancelConfirmBtn = {
  backgroundColor: '#F87171',
  color: 'white',
  padding: '10px 20px',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '13px'
};

const cancelCancelBtn = {
  backgroundColor: '#E2E8F0',
  color: '#64748B',
  padding: '10px 20px',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '13px'
};

const closeX = { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' };

// ========== RESPONSIVE STYLES (ADDED AT BOTTOM) ==========
const responsiveSidebar = {
  '@media (max-width: 768px)': {
    position: 'fixed',
    left: '-280px',
    transition: 'left 0.3s ease',
    zIndex: 1000,
    width: '280px'
  }
};

const responsiveMainContent = {
  '@media (max-width: 768px)': {
    marginLeft: '0',
    padding: '20px 15px'
  }
};

const responsiveHeaderTitle = {
  '@media (max-width: 768px)': {
    fontSize: '22px'
  }
};

const responsiveDashboardGrid = {
  '@media (max-width: 1024px)': {
    gridTemplateColumns: '1fr',
    gap: '20px'
  }
};

const responsiveLeftColumn = {
  '@media (max-width: 768px)': {
    width: '100%'
  }
};

const responsiveRightColumn = {
  '@media (max-width: 768px)': {
    width: '100%'
  }
};

const responsiveVitalsGrid = {
  '@media (max-width: 480px)': {
    gridTemplateColumns: '1fr',
    gap: '10px'
  }
};

const responsiveLivePulse = {
  '@media (max-width: 480px)': {
    padding: '10px 12px'
  }
};

const responsiveLivePulseHeader = {
  '@media (max-width: 480px)': {
    marginBottom: '6px'
  }
};

const responsiveQueueDisplay = {
  '@media (max-width: 480px)': {
    gap: '8px'
  }
};

const responsivePositionNumber = {
  '@media (max-width: 480px)': {
    fontSize: '28px',
    minWidth: '45px'
  }
};

const responsiveEstimatedWait = {
  '@media (max-width: 480px)': {
    fontSize: '10px'
  }
};

const responsiveConsultationText = {
  '@media (max-width: 480px)': {
    fontSize: '12px'
  }
};

const responsiveAppointmentDetails = {
  '@media (max-width: 480px)': {
    padding: '15px'
  }
};

const responsiveAppointmentGrid = {
  '@media (max-width: 480px)': {
    gridTemplateColumns: '1fr',
    gap: '12px'
  }
};

const responsiveHistoryList = {
  '@media (max-width: 768px)': {
    gap: '15px'
  }
};

const responsiveHistoryHeader = {
  '@media (max-width: 480px)': {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '5px'
  }
};

const responsiveHistoryDoc = {
  '@media (max-width: 480px)': {
    fontSize: '11px'
  }
};

const responsiveModalContainer = {
  '@media (max-width: 480px)': {
    width: '95%'
  }
};

const responsiveModalFooter = {
  '@media (max-width: 480px)': {
    flexDirection: 'column',
    gap: '8px'
  }
};

const responsiveConfirmBtn = {
  '@media (max-width: 480px)': {
    width: '100%'
  }
};

const responsiveCancelBtn = {
  '@media (max-width: 480px)': {
    width: '100%'
  }
};

export default PatientDashboard;