import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [role, setRole] = useState('admin'); // admin, doctor, patient
  const [email, setEmail] = useState('');    // For Admin/Doctor
  const [password, setPassword] = useState(''); // For Admin/Doctor
  const [phone, setPhone] = useState('');    // For Patient
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      if (role === 'patient') {
        // --- 🔑 PATIENT LOGIN ---
        // Matches the route: app.post('/api/patient-login') in server.js
        const res = await axios.post('http://localhost:5000/api/patient-login', { phone });
        
        if (res.data.success) {
          // FIXED: Using 'userId' to match what the server sends and what the dashboard expects
          localStorage.setItem('userId', res.data.userId); 
          localStorage.setItem('userName', res.data.name);
          localStorage.setItem('userRole', 'patient');
          navigate('/patient-dashboard');
        }
      } else {
        // --- 🔑 STAFF LOGIN (Admin/Doctor) ---
        const res = await axios.post('http://localhost:5000/api/login', { email, password });
        
        if (res.data.success) {
          // Check if the role matches the selection
          if (res.data.role === role) {
            localStorage.setItem('userId', res.data.userId); 
            localStorage.setItem('userRole', res.data.role);
            localStorage.setItem('userName', res.data.name);
            
            if (res.data.role === 'admin') navigate('/admin-dashboard');
            else if (res.data.role === 'doctor') navigate('/doctor-dashboard');
          } else {
            alert(`Access Denied: This account is registered as a ${res.data.role}.`);
          }
        }
      }
    } catch (err) {
      const message = err.response?.data?.message || "Login failed. Please check your credentials.";
      alert(message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">CuraView</h2>
          <p className="text-slate-500 text-sm font-medium">Healthcare Management Portal</p>
        </div>
        
        {/* Role Selector Toggle */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
          {['admin', 'doctor', 'patient'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                role === r ? 'bg-white text-blue-600 shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {role === 'patient' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Phone Number</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                placeholder="Enter registered mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required 
              />
              <p className="text-[10px] text-slate-400 mt-2 ml-1">Note: Patients only need their registered phone number to log in.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Official Email</label>
                <input 
                  type="email" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                  placeholder="name@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Password</label>
                <input 
                  type="password" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </>
          )}

          <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-lg hover:shadow-slate-300 mt-4 active:scale-95">
            Login as {role.toUpperCase()}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;