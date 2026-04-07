import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000/api';

export default function ManagerDashboard({ user, onLogout }) {
  const [alerts, setAlerts] = useState({ lowInventory: [], staff: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token in localStorage');
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/dashboard/manager-alerts`, { headers });
      setAlerts(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching manager data:', err.response?.status, err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="bg-white border-b border-gray-200 flex justify-between items-center px-6 py-4 sticky top-0 z-50 shadow-sm">
        <h1 className="text-2xl font-bold">Manager Dashboard</h1>
        <button onClick={onLogout} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
          Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {alerts.lowInventory && alerts.lowInventory.length > 0 && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <h2 className="text-xl font-bold text-red-700 mb-3">Low Inventory Alerts</h2>
            <div className="space-y-2">
              {alerts.lowInventory.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-red-700">
                  <span className="font-semibold">{item.item_name}</span>
                  <span className="text-sm">{item.quantity} units (min: {item.min_quantity})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Inventory Status</h2>
            <div className="space-y-3">
              {alerts.lowInventory && alerts.lowInventory.length === 0 ? (
                <p className="text-gray-500 p-4 bg-gray-50 rounded">All inventory levels normal</p>
              ) : (
                alerts.lowInventory && alerts.lowInventory.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold">{item.item_name}</span>
                      <span className="text-sm text-gray-600">{item.quantity} units</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${Math.min((item.quantity / item.min_quantity) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Staff On Duty</h2>
            <div className="space-y-3">
              {alerts.staff && alerts.staff.length === 0 ? (
                <p className="text-gray-500 p-4 bg-gray-50 rounded">No staff available</p>
              ) : (
                alerts.staff && alerts.staff.map((person, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{person.email}</p>
                      <p className="text-sm text-gray-600">{person.role}</p>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
