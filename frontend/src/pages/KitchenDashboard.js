import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000/api';

export default function KitchenDashboard({ user, onLogout }) {
  const [stats, setStats] = useState({ total_active: 0, pending: 0, preparing: 0, ready: 0 });
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
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
      const res = await axios.get(`${API}/dashboard/kitchen-stats`, { headers });
      setStats(res.data.stats);
      setTickets(res.data.tickets || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching kitchen data:', err.response?.status, err.message);
      setLoading(false);
    }
  };

  const markReady = async (ticketId) => {
    try {
      const token = localStorage.getItem('user');
      await axios.patch(`${API}/orders/${ticketId}/status`, { status: 'ready' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      alert('Error updating ticket: ' + (err.response?.data?.error || err.message));
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
        <h1 className="text-2xl font-bold">Kitchen Dashboard</h1>
        <button onClick={onLogout} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
          Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">Total Active</p>
            <p className="text-4xl font-bold text-blue-600">{stats.total_active}</p>
          </div>
          <div className="bg-red-50 border border-red-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">Pending</p>
            <p className="text-4xl font-bold text-red-600">{stats.pending}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">Preparing</p>
            <p className="text-4xl font-bold text-yellow-600">{stats.preparing}</p>
          </div>
          <div className="bg-green-50 border border-green-200 p-6 rounded">
            <p className="text-sm text-gray-600 mb-2">Ready</p>
            <p className="text-4xl font-bold text-green-600">{stats.ready}</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">Ticket Queue</h2>
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <p className="text-gray-500 text-center p-4">No active tickets</p>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`p-4 rounded border-l-4 ${ticket.status === 'pending' ? 'border-red-500 bg-red-50' : ticket.status === 'preparing' ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-lg">Table {ticket.table_number}</p>
                    <p className="text-sm text-gray-600">Order #{ticket.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded text-sm font-semibold text-white ${ticket.status === 'pending' ? 'bg-red-500' : ticket.status === 'preparing' ? 'bg-yellow-500' : 'bg-green-500'}`}>
                    {ticket.status}
                  </span>
                </div>
                {ticket.items && ticket.items.length > 0 && (
                  <div className="bg-white p-3 rounded mb-3 border border-gray-200">
                    <p className="text-sm font-semibold mb-2">Items:</p>
                    <ul className="text-sm space-y-1">
                      {ticket.items.map((item, idx) => (
                        <li key={idx} className="text-gray-700">
                          {item.quantity}x {item.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ticket.status !== 'ready' && (
                  <button
                    onClick={() => markReady(ticket.id)}
                    className="w-full bg-green-500 text-white py-2 rounded font-semibold hover:bg-green-600 transition-colors"
                  >
                    Mark Ready
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
