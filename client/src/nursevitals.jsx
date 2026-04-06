import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const NurseVitals = () => {
  const navigate = useNavigate();
  const [allPatients, setAllPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [vitals, setVitals] = useState({ weight: "", height: "", bp: "", temp: "" });

  const nurseName = localStorage.getItem('userName') || "Nurse Staff";

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/patients`);
      setAllPatients(response.data || []);
    } catch (err) {
      console.error("Fetch error", err);
    }
  };

  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    // Pre-fill if they already have vitals, otherwise empty
    setVitals({
      weight: p.vitals?.weight || "",
      height: p.vitals?.height || "",
      bp: p.vitals?.bp || "",
      temp: p.vitals?.temp || ""
    });
  };

  const handleUpdate = async () => {
    if (!selectedPatient) return;
    try {
      await axios.put(`http://localhost:5000/api/patients/${selectedPatient._id}`, { 
        vitals: { ...vitals, updatedAt: new Date() } 
      });
      alert("Vitals Updated Successfully!");
      fetchAllData(); 
    } catch (err) {
      alert("Error updating vitals");
    }
  };

  // --- LOGIC UPDATE: FILTERED & SORTED BY NEWEST FIRST ---
  const filteredPatients = allPatients
    .filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
      p.status !== "Discharged"
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return (
    <div style={containerStyle}>
      {/* SIDEBAR (Same as Doctor Dashboard) */}
      <aside style={sidebarStyle}>
        <div style={logoSection}><span style={logoText}>Nurse Portal</span></div>
        <div style={profileSection}>
          <div style={avatarCircle}>{nurseName.charAt(0)}</div>
          <div>
            <div style={drNameText}>{nurseName}</div>
            <div style={drStatusText}>Clinical Staff</div>
          </div>
        </div>
        <nav style={navStyle}>
          <div style={navItemActive}>Vitals Entry</div>
          <Link to="/doctor-dashboard" style={navLink}>Go to Doctor View</Link>
        </nav>
        <button onClick={() => {localStorage.clear(); navigate('/');}} style={sidebarLogoutBtn}>Sign Out</button>
      </aside>

      {/* MAIN CONTENT */}
      <main style={mainContentStyle}>
        <header style={topHeaderStyle}>
          <h1 style={headerTitle}>Nurse Vitals Station</h1>
          <div style={searchContainer}>
            <input 
              style={topSearchInput} 
              placeholder="🔍 Search Patient to update..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </header>

        <div style={dashboardGrid}>
          {/* BOX 1: PATIENT LIST */}
          <section style={columnWorklist}>
            <div style={sectionHeaderMatteMint}>Waiting Patients</div>
            <div style={scrollList}>
              {filteredPatients.map(p => (
                <div 
                  key={p._id} 
                  style={selectedPatient?._id === p._id ? activeRow : pRow} 
                  onClick={() => handleSelectPatient(p)}
                >
                  <div style={{fontWeight:'bold'}}>{p.name}</div>
                  <div style={{fontSize:'12px', color:'#64748B'}}>{p.phone}</div>
                </div>
              ))}
            </div>
          </section>

          {/* BOX 2: VITALS ENTRY (Same Page) */}
          <section style={columnFocus}>
            <div style={sectionHeaderMatteMint}>Vitals Recording</div>
            {selectedPatient ? (
              <div style={focusCard}>
                <div style={patientHeader}>
                  <div style={focusAvatar}>{selectedPatient.name[0]}</div>
                  <div>
                    <div style={focusName}>{selectedPatient.name}</div>
                    <div style={{fontSize:'12px', color:'#64748B'}}>Record current vitals below</div>
                  </div>
                </div>

                <div style={inputGrid}>
                  <div style={inputGroup}>
                    <label style={inputLabel}>WEIGHT (KG)</label>
                    <input style={vitalsInput} type="text" value={vitals.weight} onChange={(e)=>setVitals({...vitals, weight: e.target.value})} placeholder="e.g. 70" />
                  </div>
                  <div style={inputGroup}>
                    <label style={inputLabel}>HEIGHT (CM)</label>
                    <input style={vitalsInput} type="text" value={vitals.height} onChange={(e)=>setVitals({...vitals, height: e.target.value})} placeholder="e.g. 175" />
                  </div>
                  <div style={inputGroup}>
                    <label style={inputLabel}>BLOOD PRESSURE</label>
                    <input style={vitalsInput} type="text" value={vitals.bp} onChange={(e)=>setVitals({...vitals, bp: e.target.value})} placeholder="120/80" />
                  </div>
                  <div style={inputGroup}>
                    <label style={inputLabel}>TEMPERATURE (°C)</label>
                    <input style={vitalsInput} type="text" value={vitals.temp} onChange={(e)=>setVitals({...vitals, temp: e.target.value})} placeholder="36.5" />
                  </div>
                </div>

                <button style={saveBtn} onClick={handleUpdate}>Update & Sync to Doctor</button>
              </div>
            ) : (
              <div style={emptyFocus}>Select a patient from the list to enter vitals</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

// --- STYLES ---
const containerStyle = { display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif' };
const sidebarStyle = { width: '250px', backgroundColor: '#1E293B', color: 'white', display: 'flex', flexDirection: 'column', padding: '20px', position: 'fixed', height: '100vh' };
const logoSection = { marginBottom: '40px' };
const logoText = { fontSize: '22px', fontWeight: 'bold' };
const profileSection = { display: 'flex', gap: '12px', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #334155', marginBottom: '20px' };
const avatarCircle = { width: '45px', height: '45px', borderRadius: '50%', backgroundColor: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' };
const drNameText = { fontSize: '16px', fontWeight: '600' };
const drStatusText = { fontSize: '13px', color: '#94A3B8' };
const navStyle = { flex: 1 };
const navItemActive = { padding: '14px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', color: 'white', backgroundColor: '#334155', borderLeft: '5px solid #0D9488', fontWeight: 'bold', marginBottom: '5px' };
const navLink = { display: 'block', padding: '14px 15px', color: '#94A3B8', textDecoration: 'none', fontSize: '14px' };
const sidebarLogoutBtn = { padding: '12px', background: 'none', border: '1px solid #F87171', color: '#F87171', borderRadius: '8px', cursor: 'pointer', marginTop: 'auto' };
const mainContentStyle = { flex: 1, padding: '35px', marginLeft: '250px' };
const topHeaderStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px' };
const headerTitle = { fontSize: '26px', fontWeight: 'bold' };
const searchContainer = { width: '350px' };
const topSearchInput = { width: '100%', padding: '12px 18px', borderRadius: '12px', border: '1px solid #E2E8F0', outline: 'none' };
const dashboardGrid = { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '25px' };
const sectionHeaderMatteMint = { backgroundColor: '#0D9488', padding: '15px', borderRadius: '15px 15px 0 0', fontWeight: '600', color: 'white' };
const columnWorklist = { backgroundColor: 'white', borderRadius: '15px', border: '1px solid #E2E8F0' };
const scrollList = { height: '500px', overflowY: 'auto' };
const pRow = { padding: '15px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', transition: '0.2s' };
const activeRow = { ...pRow, backgroundColor: '#F0FDF4', borderLeft: '4px solid #0D9488' };
const columnFocus = { backgroundColor: 'white', borderRadius: '15px', border: '1px solid #E2E8F0', height: 'fit-content' };
const focusCard = { padding: '25px' };
const patientHeader = { display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '25px' };
const focusAvatar = { width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' };
const focusName = { fontWeight: 'bold', fontSize: '18px' };
const inputGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '5px' };
const inputLabel = { fontSize: '11px', fontWeight: 'bold', color: '#64748B' };
const vitalsInput = { padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '15px', outline: 'none' };
const saveBtn = { width: '100%', padding: '15px', backgroundColor: '#0D9488', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' };
const emptyFocus = { padding: '60px', textAlign: 'center', color: '#94A3B8' };

export default NurseVitals;