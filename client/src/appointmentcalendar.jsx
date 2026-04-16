import React, { useState } from 'react';

const AppointmentCalendar = ({ doctors = [] }) => {
  const timeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", 
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
  ];

  // State to track manual shift overrides
  const [shifts, setShifts] = useState({});
  // State for the custom selection modal
  const [statusModal, setStatusModal] = useState({ show: false, docId: null, docName: null, time: null });

  const handleOpenModal = (docId, docName, time) => {
    setStatusModal({ show: true, docId, docName, time });
  };

  const updateStatus = (newStatus) => {
    const key = `${statusModal.docId}-${statusModal.time}`;
    setShifts({ ...shifts, [key]: newStatus });
    setStatusModal({ show: false, docId: null, docName: null, time: null });
  };

  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 min-h-[600px] relative">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Staff Duty Roster</h2>
          <p className="text-xs text-teal-500 font-black uppercase tracking-widest mt-1">
            Click any card to set shift status
          </p>
        </div>
        
        <div className="flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
            <div className="w-3 h-3 bg-teal-500 rounded-sm"></div> ON-DUTY
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
            <div className="w-3 h-3 bg-slate-200 rounded-sm"></div> OFF-DUTY
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-3">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4 pl-4 w-48">Doctor Name</th>
              {timeSlots.map(time => (
                <th key={time} className="text-center text-[10px] font-black text-slate-400 uppercase pb-4 min-w-[100px]">{time}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doctors.map((doc) => (
              <tr key={doc._id}>
                <td className="py-2 pl-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-sm shadow-sm border border-teal-100">🩺</div>
                    <div>
                      <p className="text-xs font-black text-slate-700">Dr. {doc.name}</p>
                      <p className="text-[9px] text-teal-500 font-bold uppercase">{doc.specialization}</p>
                    </div>
                  </div>
                </td>

                {timeSlots.map((time) => {
                  const status = shifts[`${doc._id}-${time}`] || "OFF-DUTY";
                  const isOnDuty = status === "ON-DUTY";
                  return (
                    <td key={time} className="p-1">
                      <div 
                        onClick={() => handleOpenModal(doc._id, doc.name, time)}
                        className={`h-12 rounded-xl border transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95
                          ${isOnDuty ? 'bg-teal-500 border-teal-600 shadow-md' : 'bg-slate-50 border-slate-100 hover:border-teal-200'}`}
                      >
                        <span className={`text-[8px] font-black uppercase ${isOnDuty ? 'text-white' : 'text-slate-300'}`}>
                          {status}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CUSTOM STATUS MODAL */}
      {statusModal.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-xs rounded-[2rem] p-6 shadow-2xl border-4 border-teal-500 text-center">
            <h3 className="text-lg font-black text-slate-800 mb-1">Set Duty Status</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">
              Dr. {statusModal.docName} • {statusModal.time}
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={() => updateStatus("ON-DUTY")}
                className="w-full py-4 bg-teal-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-600 transition shadow-lg"
              >
                On-Duty
              </button>
              <button 
                onClick={() => updateStatus("OFF-DUTY")}
                className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition"
              >
                Off-Duty
              </button>
              <button 
                onClick={() => setStatusModal({ show: false })}
                className="w-full py-2 text-slate-300 font-bold text-[10px] uppercase mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentCalendar;