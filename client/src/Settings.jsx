import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Clock } from 'lucide-react';
import axios from 'axios';

const Settings = () => {  // Changed from 'settings' to 'Settings' (React convention)
    // 1. State for Clinic Profile
    const [clinicInfo, setClinicInfo] = useState({
        adminName: '',
        email: '',
        clinicName: '',
        address: '',
        contact: ''
    });

    // 2. State for Services List
    const [services, setServices] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');

    // --- FETCH DATA FROM MONGODB ON LOAD ---
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Fetch Clinic Profile
                const profileRes = await axios.get("http://localhost:5000/api/settings");
                if (profileRes.data) setClinicInfo(profileRes.data);

                // Fetch Master Service List
                const servicesRes = await axios.get("http://localhost:5000/api/services");
                setServices(servicesRes.data);
            } catch (err) {
                console.error("Error loading settings:", err);
                setErrorMessage("Failed to load settings. Please refresh the page.");
                setTimeout(() => setErrorMessage(''), 3000);
            }
        };
        fetchSettings();
    }, []);

    // Handle Input Changes for Profile
    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setClinicInfo(prev => ({ ...prev, [name]: value }));
    };

    // Add New Service
    const addService = async () => {
        const newServiceTemplate = {
            name: 'New Service',
            price: 0,
            category: 'Consultation'
        };

        try {
            const response = await axios.post("http://localhost:5000/api/services", newServiceTemplate);
            setServices([...services, response.data]);
            setErrorMessage('');
        } catch (err) {
            console.error("Add service error:", err);
            setErrorMessage("Failed to add service to database.");
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    // Remove Service
    const removeService = async (id) => {
        try {
            await axios.delete(`http://localhost:5000/api/services/${id}`);
            setServices(services.filter(s => s._id !== id));
            setErrorMessage('');
        } catch (err) {
            console.error("Delete service error:", err);
            setErrorMessage("Could not delete service.");
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    // Save individual service to database (SILENT - no popups)
    const saveServiceToDB = async (id, updatedData) => {
        try {
            const response = await axios.put(`http://localhost:5000/api/services/${id}`, updatedData);
            if (response.status >= 200 && response.status < 300) {
                console.log(`✅ Service ${id} saved successfully`);
                return true;
            }
        } catch (err) {
            // Silently log error - no popup
            console.warn(`⚠️ Save issue for ${id}:`, err.response?.status);
            return false;
        }
        return false;
    };

    // Handle service field change with auto-save
    const handleServiceChange = async (id, field, value) => {
        const currentService = services.find(s => s._id === id);
        if (!currentService) return;
        
        const updatedService = {
            ...currentService,
            [field]: field === 'price' ? parseFloat(value) || 0 : value
        };
        
        // Update local state immediately
        setServices(services.map(s => s._id === id ? updatedService : s));
        
        // Save to database in background
        await saveServiceToDB(id, updatedService);
    };

    // Global Save for Clinic Info
    const handleSave = async () => {
        try {
            await axios.put("http://localhost:5000/api/settings", clinicInfo);
            alert("Clinic Settings Saved Successfully! ✅");
            setErrorMessage('');
        } catch (err) {
            console.error("Save error:", err);
            setErrorMessage("Error saving clinic settings.");
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans">
            <h1 className="text-2xl font-bold text-teal-800 mb-6">CuraView EMR :: Settings</h1>

            {/* Error Message Display */}
            {errorMessage && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm">
                    ⚠️ {errorMessage}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT COLUMN: Profile & Hours */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Clinic & Admin Profile Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-teal-700 mb-4">Clinic & Admin Profile</h2>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <p className="font-bold text-slate-700 text-sm">Admin Profile</p>
                                <input 
                                    name="adminName"
                                    type="text" 
                                    value={clinicInfo.adminName} 
                                    onChange={handleProfileChange}
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm focus:ring-2 focus:ring-teal-200 outline-none" 
                                    placeholder="Update Name" 
                                />
                                <input 
                                    name="email"
                                    type="email" 
                                    value={clinicInfo.email} 
                                    onChange={handleProfileChange}
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm focus:ring-2 focus:ring-teal-200 outline-none" 
                                    placeholder="Email" 
                                />
                                <input 
                                    type="password" 
                                    value="********" 
                                    readOnly 
                                    className="w-full p-2 bg-slate-100 border rounded-lg text-sm text-slate-400 cursor-not-allowed" 
                                />
                                <button 
                                    onClick={handleSave} 
                                    className="bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-teal-600 transition"
                                >
                                    <Save size={16} /> Save Admin Changes
                                </button>
                            </div>
                            <div className="space-y-4">
                                <p className="font-bold text-slate-700 text-sm">Clinic Details</p>
                                <input 
                                    name="clinicName" 
                                    type="text" 
                                    value={clinicInfo.clinicName} 
                                    onChange={handleProfileChange} 
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm" 
                                    placeholder="Clinic Name" 
                                />
                                <input 
                                    name="address" 
                                    type="text" 
                                    value={clinicInfo.address} 
                                    onChange={handleProfileChange} 
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm" 
                                    placeholder="Clinic Address" 
                                />
                                <input 
                                    name="contact" 
                                    type="text" 
                                    value={clinicInfo.contact} 
                                    onChange={handleProfileChange} 
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm" 
                                    placeholder="Contact Number" 
                                />
                                <button 
                                    onClick={handleSave} 
                                    className="bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-teal-600 transition"
                                >
                                    <Save size={16} /> Save Clinic Details
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Operational Hours Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-teal-700 mb-4">Operational Hours</h2>
                        <div className="flex gap-6">
                            <div className="w-1/3 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Opening Time</label>
                                    <input type="time" defaultValue="09:00" className="w-full p-2 bg-slate-50 border rounded-lg mt-1" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Closing Time</label>
                                    <input type="time" defaultValue="18:00" className="w-full p-2 bg-slate-50 border rounded-lg mt-1" />
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-200 overflow-x-auto">
                                <table className="w-full text-xs text-center border-collapse">
                                    <thead>
                                        <tr className="text-slate-400">
                                            <th>Weekly</th>
                                            <th>Mon</th>
                                            <th>Tue</th>
                                            <th>Wed</th>
                                            <th>Thu</th>
                                            <th>Fri</th>
                                            <th>Sat</th>
                                            <th>Sun</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-600">
                                        <tr className="border-t border-slate-200">
                                            <td className="py-2 font-bold">9 AM</td>
                                            <td className="bg-teal-100 rounded m-1">✓</td>
                                            <td className="bg-teal-100 rounded">✓</td>
                                            <td className="bg-teal-100 rounded">✓</td>
                                            <td className="bg-teal-100 rounded">✓</td>
                                            <td className="bg-teal-100 rounded">✓</td>
                                            <td className="text-slate-300">-</td>
                                            <td className="text-slate-300">-</td>
                                        </tr>
                                        <tr className="border-t border-slate-200">
                                            <td className="py-2 font-bold">1 PM</td>
                                            <td className="bg-teal-200">✓</td>
                                            <td className="bg-teal-200">✓</td>
                                            <td className="bg-teal-200">✓</td>
                                            <td className="bg-teal-200">✓</td>
                                            <td className="bg-teal-200">✓</td>
                                            <td className="text-slate-300">-</td>
                                            <td className="text-slate-300">-</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Master Service List */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[700px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-teal-700">Master Service Price List</h2>
                        <button 
                            onClick={addService}
                            className="bg-teal-500 text-white p-2 rounded-xl hover:bg-teal-600 transition shadow-md shadow-teal-100"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="space-y-2 overflow-y-auto pr-2 flex-1">
                        {services.map((s) => (
                            <div key={s._id} className="flex flex-col p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition group border border-transparent hover:border-teal-100">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-2 h-2 bg-teal-400 rounded-full"></div>
                                        <input 
                                            className="bg-transparent border-none text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-300 rounded px-1 w-full" 
                                            value={s.name}
                                            onChange={(e) => handleServiceChange(s._id, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-teal-600 font-bold">₹</span>
                                        <input 
                                            className="bg-transparent border-none text-sm font-bold text-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-300 rounded px-1 w-20 text-right" 
                                            type="number"
                                            value={s.price}
                                            onChange={(e) => handleServiceChange(s._id, 'price', e.target.value)}
                                        />
                                        <button 
                                            onClick={() => removeService(s._id)}
                                            className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {services.length === 0 && (
                            <div className="text-center text-slate-400 py-8">
                                No services added yet. Click + to add.
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={addService} 
                        className="w-full py-3 bg-teal-50 text-teal-600 rounded-2xl font-bold border-2 border-dashed border-teal-200 hover:bg-teal-100 transition mt-6"
                    >
                        + Add New Service
                    </button>
                </div>
            </div>
            <p className="text-center text-slate-400 text-xs mt-8 italic">Database Synced. Secure MERN connection active.</p>
        </div>
    );
};

export default Settings;  // Changed from 'settings' to 'Settings'