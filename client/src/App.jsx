import React, { useState, useEffect } from 'react';
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
  const token = localStorage.getItem('token'); // ✅ CHANGED: Use 'token' instead of 'userId'
  const role = localStorage.getItem('userRole'); // Check user role

  // If no token, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Updated logic: Check if allowedRole is an array (to allow multiple roles like doctor & nurse)
  const isAllowed = Array.isArray(allowedRole) 
    ? allowedRole.includes(role) 
    : role === allowedRole;

  if (allowedRole && !isAllowed) {
    // If unauthorized, send them to their own dashboard
    if (role === 'nurse') return <Navigate to="/nurse" replace />;
    return <Navigate to={`/${role}-dashboard`} replace />;
  }

  return children;
};

function App() {
  // Add state to track auth status
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('userRole'));

  // Listen for storage changes (logout from other tabs)
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
      setRole(localStorage.getItem('userRole'));
    };
    
    window.addEventListener('storage', handleStorageChange);
    setIsCheckingAuth(false);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* --- 🔐 AUTHENTICATION --- */}
        {/* Login is always accessible - NO AUTO REDIRECT */}
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
        
        {/* Root Redirect: Always goes to login page first */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Catch-all - Any unknown route goes to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;