import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Added Link
import axios from 'axios';

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Dashboard"); 
  const [allPatients, setAllPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showSoapModal, setShowSoapModal] = useState(false);
  const [showHistoryOnly, setShowHistoryOnly] = useState(false); 
  
  const [clinicalNote, setClinicalNote] = useState("");
  const [prescription, setPrescription] = useState("");

  const doctorName = localStorage.getItem('userName') || "Mehak";

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/patients`);
      const data = response.data || [];
      setAllPatients(data);
      
      if (selectedPatient) {
        const updated = data.find(p => p._id === selectedPatient._id);
        if (updated) setSelectedPatient(updated);
      }
    } catch (err) {
      console.error("Fetch error", err);
    }
  };

  const schedulePatients = allPatients.filter(p => p.assignedDoctor === doctorName && p.status === 'In-Consultation');
  const myPersonalHistory = allPatients.filter(p => p.assignedDoctor === doctorName);
  const globalRecords = allPatients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.phone.includes(searchTerm)
  );

  const openHistoryQuickly = (patient) => {
    setSelectedPatient(patient);
    setShowHistoryOnly(true);
  };

  const handleDischarge = async () => {
    if (!selectedPatient) return;
    try {
      await axios.put(`http://localhost:5000/api/patients/${selectedPatient._id}`, {
        status: 'Discharged',
        $push: { 
          visitHistory: {
            date: new Date().toLocaleDateString(),
            notes: clinicalNote,
            medications: prescription,
            doctor: doctorName
          }
        }
      });
      setShowSoapModal(false);
      setSelectedPatient(null);
      setClinicalNote("");
      setPrescription("");
      fetchAllData();
    } catch (err) {
      console.error("Discharge failed", err);
    }
  };

  return (
    <div style={containerStyle}>
      {/* SIDEBAR */}
      <aside style={sidebarStyle}>
        <div style={logoSection}><span style={logoText}>Doctor Portal</span></div>
        <div style={profileSection}>
          <div style={avatarCircle}>{doctorName.charAt(0)}</div>
          <div>
            <div style={drNameText}>Dr. {doctorName}</div>
            <div style={drStatusText}>Individual</div>
          </div>
        </div>
        <nav style={navStyle}>
          <div onClick={() => setActiveTab("Dashboard")} style={activeTab === "Dashboard" ? navItemActive : navItem}>Dashboard</div>
          <div onClick={() => setActiveTab("My Patients")} style={activeTab === "My Patients" ? navItemActive : navItem}>My Patients</div>
          <div onClick={() => setActiveTab("Patient Records")} style={activeTab === "Patient Records" ? navItemActive : navItem}>Patient Records</div>
        </nav>

        {/* NURSE ACCESS LINK */}
        <Link to="/nurse" style={nurseLinkBtn}>👩‍⚕️ Nurse Station</Link>
        
        <button onClick={() => {localStorage.clear(); navigate('/');}} style={sidebarLogoutBtn}>Sign Out</button>
      </aside>

      {/* MAIN CONTENT */}
      <main style={mainContentStyle}>
        <header style={topHeaderStyle}>
          <h1 style={headerTitle}>Healthcare Clinic EMR System</h1>
          <div style={searchContainer}>
            <input style={topSearchInput} placeholder="🔍 Patient Records Search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </header>

        <h2 style={todayPulse}>Today's Pulse</h2>

        {/* TAB 1: DASHBOARD VIEW */}
        {activeTab === "Dashboard" && (
          <div style={dashboardGrid}>
            <section style={columnAgenda}>
              <div style={sectionHeaderMatteMint}>My Daily Agenda</div>
              <div style={timelineWrapper}>
                {['07:00', '08:00', '11:00', '12:00', '1:00'].map((time, idx) => (
                  <div key={time} style={timelineRow}>
                    <span style={timelineTime}>{time}</span>
                    <div style={timelineLine}>
                      {idx === 1 && schedulePatients.length > 0 && (
                        <div style={appointmentCardSmall}>
                          <div style={{fontWeight:'bold'}}>{schedulePatients[0].name}</div>
                          <div style={{fontSize:'10px', opacity: 0.8}}>Current Session</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={columnWorklist}>
              <div style={sectionHeaderMatteMint}>Active Patient Worklist</div>
              <table style={workTable}>
                <thead><tr style={tableHeaderRow}><th style={thStyle}>Patient Name</th><th style={thStyle}>Status</th><th style={thStyle}>Actions</th></tr></thead>
                <tbody>
                  {schedulePatients.map(p => (
                    <tr key={p._id} style={trStyle} onClick={() => setSelectedPatient(p)}>
                      <td style={tdStyle}><strong>{p.name}</strong></td>
                      <td style={tdStyle}><span style={statusTagMatte}>In-Consultation</span></td>
                      <td style={tdStyle}>
                        <div style={{display:'flex', gap:'8px'}}>
                           <button style={outlineBtnSmall} onClick={(e) => { e.stopPropagation(); setShowSoapModal(true); }}>Write SOAP Note</button>
                           <button style={historyBtnSmall} onClick={(e) => { e.stopPropagation(); openHistoryQuickly(p); }}>History</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section style={columnFocus}>
              <div style={sectionHeaderMatteMint}>Active Patient Focus</div>
              {selectedPatient ? (
                <div style={focusCard}>
                   <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
                      <div style={focusAvatar}>{selectedPatient.name[0]}</div>
                      <div style={{textAlign:'left'}}><div style={focusName}>{selectedPatient.name}</div><div style={{fontSize:'12px', color:'#64748B'}}>Basic Info</div></div>
                   </div>
                  <div style={vitalsGrid}>
                    <div style={vitalsBox}><span style={vitalsLabel}>WEIGHT</span><span style={vitalsValue}>{selectedPatient.vitals?.weight || "--"} kg</span></div>
                    <div style={vitalsBox}><span style={vitalsLabel}>HEIGHT</span><span style={vitalsValue}>{selectedPatient.vitals?.height || "--"} cm</span></div>
                    <div style={vitalsBox}><span style={vitalsLabel}>BP</span><span style={vitalsValue}>{selectedPatient.vitals?.bp || "--"}</span></div>
                    <div style={vitalsBox}><span style={vitalsLabel}>TEMP</span><span style={vitalsValue}>{selectedPatient.vitals?.temp || "--"}°C</span></div>
                  </div>
                  <button style={viewRecordBtn} onClick={() => openHistoryQuickly(selectedPatient)}>View Full History</button>
                  <button style={secureReportBtn} onClick={() => setShowSoapModal(true)}>Generate Secure Report</button>
                </div>
              ) : <div style={emptyFocus}>Select a patient to view focus details</div>}
            </section>
          </div>
        )}

        {/* TABLES FOR OTHER TABS */}
        {(activeTab === "My Patients" || activeTab === "Patient Records") && (
          <section style={tableContainerCard}>
            <table style={workTable}>
              <thead>
                <tr style={tableHeaderRow}>
                  <th style={thStyle}>Patient Name</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>Last Condition</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === "My Patients" ? myPersonalHistory : globalRecords).map(p => (
                  <tr key={p._id} style={trStyle}>
                    <td style={tdStyle}><strong>{p.name}</strong></td>
                    <td style={tdStyle}>{p.phone}</td>
                    <td style={tdStyle}>{p.condition}</td>
                    <td style={tdStyle}>
                      <button style={historyBtnSmall} onClick={() => openHistoryQuickly(p)}>View History</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {/* QUICK HISTORY MODAL */}
      {showHistoryOnly && (
        <div style={modalOverlayStyle}>
          <div style={historyModalContainer}>
            <div style={historyModalHeader}>
               <h3 style={{color: '#0D9488', margin: 0}}>Medical History: {selectedPatient?.name}</h3>
               <button onClick={() => setShowHistoryOnly(false)} style={closeX}>✕</button>
            </div>
            <div style={historyModalBody}>
               {selectedPatient?.visitHistory?.length > 0 ? (
                 selectedPatient.visitHistory.map((v, i) => (
                   <div key={i} style={historyCard}>
                     <div style={historyDate}>{v.date} — Dr. {v.doctor}</div>
                     <div style={historyNote}><strong>Note:</strong> {v.notes}</div>
                     <div style={historyMeds}><strong>Rx:</strong> {v.medications}</div>
                   </div>
                 ))
               ) : <p style={{textAlign:'center', color:'#94A3B8', padding: '20px'}}>No history records found.</p>}
            </div>
          </div>
        </div>
      )}

      {/* SOAP MODAL */}
      {showSoapModal && (
        <div style={modalOverlayStyle}>
          <div style={extendedModalContent}>
            <div style={historySidebar}>
              <h4 style={{color: '#0D9488', marginBottom: '15px'}}>Past Visits</h4>
              <div style={historyScrollArea}>
                {selectedPatient?.visitHistory?.map((v, i) => (
                  <div key={i} style={historyCard}>
                    <div style={historyDate}>{v.date}</div>
                    <div style={historyNote}>{v.notes}</div>
                    <div style={historyMeds}>Rx: {v.medications}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={activeSessionArea}>
              <h3>Consultation Note - {selectedPatient?.name}</h3>
              <textarea style={modalInput} placeholder="Write SOAP Note..." value={clinicalNote} onChange={(e) => setClinicalNote(e.target.value)} />
              <textarea style={{...modalInput, height:'80px', marginTop:'10px'}} placeholder="Prescription..." value={prescription} onChange={(e) => setPrescription(e.target.value)} />
              <div style={{marginTop: '20px', display:'flex', gap:'10px'}}>
                <button style={secureReportBtn} onClick={handleDischarge}>Complete & Discharge</button>
                <button style={{...secureReportBtn, backgroundColor:'#64748B'}} onClick={() => setShowSoapModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- STYLES ---
const containerStyle = { display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif' };
const sidebarStyle = { width: '250px', backgroundColor: '#1E293B', color: 'white', display: 'flex', flexDirection: 'column', padding: '20px', position: 'fixed', height: '100vh' };
const logoSection = { marginBottom: '40px' };
const logoText = { fontSize: '24px', fontWeight: 'bold' };
const profileSection = { display: 'flex', gap: '12px', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #334155', marginBottom: '20px' };
const avatarCircle = { width: '45px', height: '45px', borderRadius: '50%', backgroundColor: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' };
const drNameText = { fontSize: '16px', fontWeight: '600' };
const drStatusText = { fontSize: '13px', color: '#94A3B8' };
const navStyle = { flex: 1 };
const navItem = { padding: '14px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', color: '#E2E8F0', marginBottom: '5px' };
const navItemActive = { ...navItem, backgroundColor: '#334155', borderLeft: '5px solid #0D9488', fontWeight: 'bold' };

// Nurse Link Style
const nurseLinkBtn = { 
  textDecoration: 'none', 
  color: '#0D9488', 
  fontSize: '14px', 
  fontWeight: '600', 
  padding: '12px', 
  backgroundColor: '#F0FDF4', 
  borderRadius: '8px', 
  textAlign: 'center', 
  marginBottom: '10px',
  border: '1px solid #0D9488' 
};

const sidebarLogoutBtn = { padding: '12px', background: 'none', border: '1px solid #F87171', color: '#F87171', borderRadius: '8px', cursor: 'pointer', marginTop: 'auto' };
const mainContentStyle = { flex: 1, padding: '35px', marginLeft: '250px' };
const topHeaderStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const headerTitle = { fontSize: '28px', fontWeight: 'bold' };
const searchContainer = { width: '380px' };
const topSearchInput = { width: '100%', padding: '12px 18px', borderRadius: '12px', border: '1px solid #E2E8F0', outline: 'none' };
const todayPulse = { fontSize: '22px', fontWeight: '700', marginBottom: '25px' };
const dashboardGrid = { display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.2fr', gap: '20px' };
const sectionHeaderMatteMint = { backgroundColor: '#0D9488', padding: '18px', borderRadius: '15px 15px 0 0', fontWeight: '600', color: 'white' };
const columnAgenda = { backgroundColor: 'white', borderRadius: '15px', border: '1px solid #E2E8F0' };
const timelineWrapper = { padding: '15px' };
const timelineRow = { display: 'flex', gap: '15px', height: '60px' };
const timelineTime = { fontSize: '11px', color: '#64748B', width: '35px', textAlign: 'right' };
const timelineLine = { flex: 1, borderTop: '1px solid #F1F5F9', paddingTop: '5px', position: 'relative' };
const appointmentCardSmall = { backgroundColor: '#134E48', color: 'white', padding: '8px', borderRadius: '6px', fontSize: '11px' };
const columnWorklist = { backgroundColor: 'white', borderRadius: '15px', border: '1px solid #E2E8F0' };
const tableContainerCard = { backgroundColor: 'white', borderRadius: '15px', padding: '20px', border: '1px solid #E2E8F0' };
const workTable = { width: '100%', borderCollapse: 'collapse' };
const tableHeaderRow = { textAlign: 'left', borderBottom: '1px solid #F1F5F9' };
const thStyle = { padding: '15px', fontSize: '13px', color: '#64748B' };
const trStyle = { borderBottom: '1px solid #F8FAFC', cursor: 'pointer' };
const tdStyle = { padding: '15px', fontSize: '14px' };
const statusTagMatte = { backgroundColor: '#F0FDF4', color: '#166534', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' };
const outlineBtnSmall = { border: '1px solid #CBD5E1', color: '#1E293B', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '12px' };
const historyBtnSmall = { border: '1px solid #0D9488', color: '#0D9488', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '12px' };
const columnFocus = { backgroundColor: 'white', borderRadius: '15px', border: '1px solid #E2E8F0' };
const focusCard = { padding: '20px' };
const focusAvatar = { width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' };
const focusName = { fontWeight: 'bold', fontSize: '16px' };

const vitalsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' };
const vitalsBox = { backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'baseline', gap: '8px' };
const vitalsLabel = { fontSize: '10px', color: '#64748B', fontWeight: 'bold' };
const vitalsValue = { fontSize: '14px', fontWeight: 'bold', color: '#0D9488' };

const viewRecordBtn = { width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', marginBottom: '10px' };
const secureReportBtn = { width: '100%', padding: '12px', backgroundColor: '#0D9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const emptyFocus = { padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' };

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const historyModalContainer = { backgroundColor: 'white', borderRadius: '16px', width: '550px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' };
const historyModalHeader = { padding: '20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const historyModalBody = { padding: '20px', maxHeight: '450px', overflowY: 'auto', backgroundColor: '#F8FAFC' };

const extendedModalContent = { backgroundColor: 'white', borderRadius: '20px', width: '900px', display: 'flex', overflow: 'hidden' };
const historySidebar = { width: '300px', backgroundColor: '#F8FAFC', padding: '25px', borderRight: '1px solid #E2E8F0' };
const historyScrollArea = { height: '400px', overflowY: 'auto' };
const historyCard = { backgroundColor: 'white', padding: '15px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
const historyDate = { fontSize: '11px', fontWeight: 'bold', color: '#0D9488', marginBottom: '4px' };
const historyNote = { fontSize: '13px', color: '#475569', lineHeight: '1.5' };
const historyMeds = { fontSize: '12px', color: '#1E293B', fontStyle: 'italic', marginTop: '5px' };
const activeSessionArea = { flex: 1, padding: '30px' };
const modalInput = { width: '100%', height: '120px', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', outline: 'none' };
const closeX = { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' };

export default DoctorDashboard;