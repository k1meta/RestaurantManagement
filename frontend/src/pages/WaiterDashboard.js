import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000/api';

export default function WaiterDashboard({ user, onLogout }) {
  const [stats, setStats] = useState({ total_tables: 0, waiting_food: 0, ready_to_serve: 0 });
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);

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
      const res = await axios.get(`${API}/dashboard/waiter-stats`, { headers });
      setStats(res.data.stats);
      setTickets(res.data.recentTickets || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching waiter data:', err.response?.status, err.message);
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
        <h1 className="text-2xl font-bold">Waiter Dashboard</h1>
        <button onClick={onLogout} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
          Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">Total Tables</p>
            <p className="text-4xl font-bold text-blue-600">{stats.total_tables}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">Waiting Food</p>
            <p className="text-4xl font-bold text-yellow-600">{stats.waiting_food}</p>
          </div>
          <div className="bg-green-50 border border-green-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">Ready to Serve</p>
            <p className="text-4xl font-bold text-green-600">{stats.ready_to_serve}</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">Recent Orders</h2>
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <p className="text-gray-500 text-center p-4">No active orders</p>
          ) : (
            tickets.map((ticket, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedTable(ticket)}
                className="p-4 bg-white border border-gray-200 rounded cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold">Table {ticket.table_number}</span>
                  <span className={`px-3 py-1 rounded text-sm font-semibold text-white ${ticket.status === 'pending' ? 'bg-red-500' : ticket.status === 'preparing' ? 'bg-yellow-500' : 'bg-green-500'}`}>
                    {ticket.status}
                  </span>
                </div>
                {selectedTable?.id === ticket.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">Created: {new Date(ticket.created_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
