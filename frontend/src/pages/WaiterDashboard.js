import React, { useState } from 'react';

const TABLES = [
  { id: 24, guests: 3, seated: '18 min', items: 8, status: 'waiting', statusColor: 'bg-[#ffdbca] text-[#773200]' },
  { id: 8, guests: 2, seated: '42 min', items: 5, status: 'ready', statusColor: 'bg-secondary text-on-secondary' },
  { id: 12, guests: 5, seated: '2 min', items: 1, status: 'ordering', statusColor: 'bg-primary text-on-primary' },
  { id: 31, guests: 4, seated: '10 min', items: 3, status: 'seated', statusColor: 'bg-surface-container text-on-surface' },
];

const ORDERS = [
  { ticket: '#{24}', items: 3, guests: 3, status: 'Waiting for Food', time: '18m' },
];

export default function WaiterDashboard({ user, onLogout }) {
  const [selectedTable, setSelectedTable] = useState(null);

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Header */}
      <header className="bg-white dark:bg-[#1c1b1b] flex justify-between items-center px-6 py-4 border-b border-surface-variant sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
          <div className="flex flex-col">
            <span className="font-headline font-bold text-sm uppercase tracking-tight">Downtown Central</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              Waiter: {user.name}
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-black font-headline hidden md:block">The Kinetic Editorial</h1>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center overflow-hidden border border-outline-variant/15 cursor-pointer hover:bg-surface-container transition-colors">
            <span className="text-lg font-bold">{user.name[0]}</span>
          </div>
          <button onClick={onLogout} className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors">
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Active Tables */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="font-headline text-5xl font-black tracking-tight uppercase">Active Tables</h2>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mt-2">
                  {TABLES.length} Tables in play • {ORDERS.length} Pending Tickets
                </p>
              </div>
              <button className="bg-primary text-on-primary px-8 py-4 font-headline font-black text-lg flex items-center justify-center gap-2 hover:bg-on-primary-fixed transition-colors">
                <span className="material-symbols-outlined">add</span>
                Create New Order
              </button>
            </div>

            {/* Table Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TABLES.map((table) => (
                <div
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`p-5 flex flex-col justify-between h-52 border-l-[6px] cursor-pointer hover:shadow-lg transition-all ${
                    table.status === 'waiting' ? 'bg-surface-container-low border-[#d76100]' :
                    table.status === 'ready' ? 'bg-white border-secondary shadow-md' :
                    'bg-surface-container-low border-outline-variant'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-headline text-5xl font-black">{table.id}</span>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant -mt-1">
                        {table.status === 'ready' ? 'Ready to Serve' : 'Table Number'}
                      </p>
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 ${table.statusColor}`}>
                      {table.status === 'waiting' ? 'Waiting for Food' :
                       table.status === 'ready' ? 'Order Ready' :
                       table.status === 'ordering' ? 'Ordering' : 'Seated'}
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-xs font-bold uppercase">
                      {table.guests} guests • {table.seated} seated • {table.items} items
                    </p>
                    <button className="p-2 hover:bg-outline-variant transition-colors">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Urgent Alerts & Current Order */}
          <div className="space-y-6">
            {/* Alerts */}
            <div className="bg-[#ffdad6] p-6 border-2 border-error">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-xs bg-error text-white px-2 py-1">priority_high</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-error-container">Urgent Alert</span>
              </div>
              <h3 className="font-headline text-lg font-black mb-2 uppercase">Table 08: Drinks</h3>
              <p className="text-sm text-on-error-container/80">Cold Bar • 2m ago</p>
            </div>

            {/* Current Order Detail */}
            {selectedTable && (
              <div className="bg-surface-container-low p-6 space-y-4">
                <h3 className="font-headline text-xl font-black uppercase">Table {selectedTable.id}</h3>
                <div className="space-y-2">
                  <p className="text-sm">Ticket #{selectedTable.id}</p>
                  <p className="text-sm">{selectedTable.items} Items</p>
                  <p className="text-sm font-bold text-secondary">Total Due: $114.00</p>
                </div>
                <button className="w-full bg-primary text-on-primary py-3 font-headline font-black uppercase text-sm hover:bg-on-primary-fixed transition-colors">
                  Send to Kitchen
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-primary text-on-primary flex justify-around p-4">
        <button className="flex flex-col items-center gap-1 p-2 hover:opacity-70">
          <span className="material-symbols-outlined">shopping_cart</span>
          <span className="text-[10px] font-bold">Orders</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:opacity-70">
          <span className="material-symbols-outlined">restaurant_menu</span>
          <span className="text-[10px] font-bold">Menu</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:opacity-70">
          <span className="material-symbols-outlined">inventory_2</span>
          <span className="text-[10px] font-bold">Inventory</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:opacity-70">
          <span className="material-symbols-outlined">analytics</span>
          <span className="text-[10px] font-bold">Analytics</span>
        </button>
      </nav>
    </div>
  );
}
