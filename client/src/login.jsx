import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('token');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (role === 'patient') {
        const res = await axios.post('http://localhost:5000/api/patient-login', { phone });

        if (res.data.success) {
          localStorage.setItem('userId', res.data.userId);
          localStorage.setItem('userName', res.data.name);
          localStorage.setItem('userRole', 'patient');
          localStorage.setItem('token', res.data.token || 'patient-token');
          navigate('/patient-dashboard');
        }
      } else {
        const res = await axios.post('http://localhost:5000/api/login', { email, password });

        if (res.data.success) {
          if (res.data.role === role) {
            localStorage.setItem('userId', res.data.userId);
            localStorage.setItem('userRole', res.data.role);
            localStorage.setItem('userName', res.data.name);
            localStorage.setItem('token', res.data.token);

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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: `
          linear-gradient(135deg, #0A0F2A 0%, #1A2340 50%, #0A0F2A 100%),
          url('/medical-doodles.png')
        `,
        backgroundRepeat: 'no-repeat, repeat',
        backgroundSize: 'cover, 500px',
        backgroundBlendMode: 'overlay'
      }}
    >
      {/* Login Card */}
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black tracking-tight" style={{ color: '#0A0F2A' }}>
            CuraView
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Healthcare Management Portal
          </p>
        </div>

        {/* Role Selector */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
          {['admin', 'doctor', 'patient'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                role === r
                  ? 'bg-white text-[#1A2340] shadow-sm scale-105'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {role === 'patient' ? (
            <div>
              <label className="block text-[11px] font-bold text-[#1A2340] uppercase mb-1.5 ml-1 tracking-wide">
                Phone Number
              </label>
              <input
                type="text"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#1A2340] focus:bg-white outline-none transition-all"
                placeholder="Enter registered mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <p className="text-[10px] text-slate-400 mt-2 ml-1">
                Note: Patients only need their registered phone number to log in.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-[#1A2340] uppercase mb-1.5 ml-1 tracking-wide">
                  Official Email
                </label>
                <input
                  type="email"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#1A2340] focus:bg-white outline-none transition-all"
                  placeholder="name@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#1A2340] uppercase mb-1.5 ml-1 tracking-wide">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#1A2340] focus:bg-white outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-2xl font-bold transition-all shadow-lg mt-4 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1A2340', color: 'white' }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = '#0A0F2A')}
            onMouseLeave={(e) => (e.target.style.backgroundColor = '#1A2340')}
          >
            {isLoading ? 'Logging in...' : `Login as ${role.toUpperCase()}`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;