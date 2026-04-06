import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AppointmentCalendar = ({ onSlotClick }) => {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const timeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
  ];

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [patientRes, doctorRes] = await Promise.all([
        axios.get('http://localhost:5000/api/patients'),
        axios.get('http://localhost:5000/api/doctors')
      ]);
      setAppointments(patientRes.data || []);
      setDoctors(doctorRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching calendar data", err);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-[2rem] shadow-sm border border-teal-100">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Doctor's Daily Schedule</h2>
          <p className="text-slate-400 text-sm font-medium">Monitoring staff availability and active consultations</p>
        </div>
        
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 text-sm"
        />
      </div>

      {/* TIME SLOT GRID */}
      <div className="space-y-6">
        {timeSlots.map((slot) => (
          <div key={slot} className="flex gap-6">
            {/* Left side: Time Label */}
            <div className="w-20 pt-2 text-right">
              <span className="text-xs font-black text-slate-400 uppercase tracking-tighter">{slot}</span>
            </div>

            {/* Right side: Doctor Status Cards */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {doctors.map((doc) => {
                // Find if this specific doctor has a patient at this specific time/date
                const activeBooking = appointments.find(app => 
                  app.appointmentTime === slot && 
                  (app.appointmentDate?.split('T')[0] === selectedDate) &&
                  (app.assignedDoctor?.toLowerCase().includes(doc.name.toLowerCase()) || 
                   doc.name.toLowerCase().includes(app.assignedDoctor?.toLowerCase()))
                );

                return (
                  <div 
                    key={doc._id}
                    onClick={() => !activeBooking && onSlotClick(slot, selectedDate)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[80px]
                      ${activeBooking 
                        ? 'bg-white border-orange-200 shadow-sm border-l-4 border-l-orange-500' 
                        : 'bg-teal-50/30 border-teal-100 border-dashed hover:bg-white hover:border-teal-400 hover:shadow-md'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[11px] font-black text-slate-700">Dr. {doc.name}</p>
                        <p className="text-[9px] text-teal-600 font-bold uppercase">{doc.specialization || "General"}</p>
                      </div>
                      <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase
                        ${activeBooking ? 'bg-orange-100 text-orange-600' : 'bg-teal-100 text-teal-600'}`}>
                        {activeBooking ? 'Busy' : 'Available'}
                      </span>
                    </div>

                    {activeBooking ? (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          👤 {activeBooking.name}
                        </p>
                        <p className="text-[9px] text-slate-400 italic">
                          {activeBooking.status === 'In-Consultation' ? '📍 In Room' : '🛋️ Waiting'}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-[9px] text-teal-400 font-bold italic opacity-0 group-hover:opacity-100">+ Assign Patient</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppointmentCalendar;