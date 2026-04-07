import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000/api';

export default function OwnerDashboard({ user, onLogout }) {
  const [analytics, setAnalytics] = useState({ totalRevenue: 0, byLocation: [], dailyRevenue: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
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
      const res = await axios.get(`${API}/dashboard/owner-analytics`, { headers });
      setAnalytics(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching owner data:', err.response?.status, err.message);
      setLoading(false); // Stop loading even on error
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
        <h1 className="text-2xl font-bold">Owner Dashboard</h1>
        <button onClick={onLogout} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
          Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 border border-blue-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">Total Revenue (30d)</p>
            <p className="text-4xl font-bold text-blue-600">
              ${(analytics.totalRevenue || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">Active Locations</p>
            <p className="text-4xl font-bold text-green-600">{analytics.byLocation?.length || 0}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">System Status</p>
            <p className="text-2xl font-bold text-purple-600">OPERATIONAL</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">Revenue by Location</h2>
            <div className="space-y-3">
              {analytics.byLocation && analytics.byLocation.length === 0 ? (
                <p className="text-gray-500 p-4 bg-gray-50 rounded">No revenue data</p>
              ) : (
                analytics.byLocation && analytics.byLocation.map((loc, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded border border-gray-200 flex justify-between items-center">
                    <span className="font-semibold">{loc.location_name}</span>
                    <span className="text-xl font-bold text-blue-600">
                      ${(loc.revenue || 0).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Daily Revenue Trend (7d)</h2>
            <div className="space-y-3">
              {analytics.dailyRevenue && analytics.dailyRevenue.length === 0 ? (
                <p className="text-gray-500 p-4 bg-gray-50 rounded">No revenue data</p>
              ) : (
                analytics.dailyRevenue && analytics.dailyRevenue.map((day, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-semibold">{day.date}</span>
                    <span className="font-bold text-green-600">${(day.daily_revenue || 0).toFixed(2)}</span>
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
