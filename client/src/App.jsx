import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- COMPONENTS ---
import Login from './login'; 
import AdminDashboard from './admindashboard';
import DoctorDashboard from './doctordashboard';
import PatientDashboard from './patientdashboard';
import NurseVitals from './nursevitals'; // Added Import for Nurse Vitals

/**
 * 🛡️ Protected Route Wrapper
 * Prevents unauthorized users from accessing specific dashboards.
 */
const ProtectedRoute = ({ children, allowedRole }) => {
  const token = localStorage.getItem('userId'); // Check if logged in
  const role = localStorage.getItem('userRole'); // Check user role

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Updated logic: Check if allowedRole is an array (to allow multiple roles like doctor & nurse)
  const isAllowed = Array.isArray(allowedRole) 
    ? allowedRole.includes(role) 
    : role === allowedRole;

  if (allowedRole && !isAllowed) {
    // If unauthorized, send them to their own dashboard
    return <Navigate to={`/${role}-dashboard`} replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* --- 🔐 AUTHENTICATION --- */}
        <Route path="/login" element={<Login />} />

        {/* --- 🏥 DASHBOARD ROUTES (Protected) --- */}
        
        {/* Admin Portal */}
        <Route 
          path="/admin-dashboard" 
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Doctor Portal */}
        <Route 
          path="/doctor-dashboard" 
          element={
            <ProtectedRoute allowedRole="doctor">
              <DoctorDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Nurse Station (Accessible by both Doctor and Nurse) */}
        <Route 
          path="/nurse" 
          element={
            <ProtectedRoute allowedRole={["doctor", "nurse"]}>
              <NurseVitals />
            </ProtectedRoute>
          } 
        />

        {/* Patient Portal */}
        <Route 
          path="/patient-dashboard" 
          element={
            <ProtectedRoute allowedRole="patient">
              <PatientDashboard />
            </ProtectedRoute>
          } 
        />

        {/* --- 🚀 NAVIGATION LOGIC --- */}
        
        {/* Root Redirect: Checks if already logged in, otherwise sends to login */}
        <Route path="/" element={<LoginRedirect />} />
        
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

/**
 * 🔄 Login Redirect Logic
 * If a user visits the root "/", check if they have a session and send them to their dashboard.
 */
const LoginRedirect = () => {
  const role = localStorage.getItem('userRole');
  if (role) {
    // Handling redirect for nurse role specifically
    if (role === 'nurse') return <Navigate to="/nurse" replace />;
    return <Navigate to={`/${role}-dashboard`} replace />;
  }
  return <Navigate to="/login" replace />;
};

export default App;