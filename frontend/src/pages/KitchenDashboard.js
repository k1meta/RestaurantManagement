import React from 'react';

const TICKETS = [
  {
    id: 'T-14',
    time: '14:22',
    urgent: true,
    target: '18m',
    items: [
      { qty: 2, name: 'Margherita Pizza', type: 'Main' },
      { qty: 1, name: 'Caesar Salad', type: 'Side' }
    ],
    notes: 'Dressing on the side, no croutons.'
  },
  {
    id: 'T-08',
    time: '14:35',
    urgent: false,
    target: '15m',
    items: [
      { qty: 4, name: 'Sourdough Loaf', type: 'Retail' },
      { qty: 2, name: 'Almond Croissant', type: 'Pastry' }
    ]
  },
  {
    id: 'T-22',
    time: '14:38',
    urgent: false,
    target: '2m',
    items: [
      { qty: 1, name: 'Wagyu Burger', type: 'Main' },
      { qty: 1, name: 'Truffle Fries', type: 'Side' }
    ],
    notes: 'Medium Rare, Extra Napkins.'
  }
];

export default function KitchenDashboard({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-background text-on-surface pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-[#1c1b1b] flex justify-between items-center px-6 py-4 border-b border-surface-variant sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
          <div className="flex flex-col">
            <h1 className="font-headline font-bold text-lg uppercase tracking-tight">
              The Kinetic Editorial <span className="mx-1 opacity-30">/</span> Kitchen
            </h1>
            <span className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              Station A • Main Line
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onLogout} className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors">
            Logout
          </button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {/* Status Board */}
        <section className="mb-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-primary text-on-primary p-5 flex flex-col justify-between h-32">
            <p className="text-[10px] font-headline font-bold uppercase tracking-widest opacity-70">Active Tickets</p>
            <h2 className="font-headline text-5xl font-black">{TICKETS.length}</h2>
          </div>
          <div className="bg-surface-container-low border border-outline-variant/30 p-5 flex flex-col justify-between h-32">
            <p className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">Target Goal</p>
            <div className="flex items-baseline gap-1">
              <h2 className="font-headline text-4xl font-bold">15</h2>
              <span className="text-xs opacity-50 uppercase">Min</span>
            </div>
          </div>
          <div className="bg-error-container p-5 flex flex-col justify-between h-32">
            <p className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-error-container">Delayed</p>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-3xl">warning</span>
              <h2 className="font-headline text-4xl font-bold text-error">02</h2>
            </div>
          </div>
          <div className="bg-secondary/20 border border-secondary p-5 flex flex-col justify-between h-32">
            <p className="text-[10px] font-headline font-bold uppercase tracking-widest text-secondary">Ready</p>
            <h2 className="font-headline text-5xl font-black text-secondary">05</h2>
          </div>
        </section>

        {/* Tickets Queue */}
        <div className="space-y-4">
          {TICKETS.map((ticket, idx) => (
            <div
              key={idx}
              className={`border-l-[6px] p-6 ${
                ticket.urgent
                  ? 'bg-error/10 border-error'
                  : idx === 1
                  ? 'border-secondary/50'
                  : 'border-surface-variant'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  {ticket.urgent && (
                    <div className="flex items-center gap-2 mb-2 bg-error text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 w-fit">
                      <span className="material-symbols-outlined text-xs">priority_high</span>
                      Urgent • Kitchen
                    </div>
                  )}
                  <h3 className="font-headline text-4xl font-black">{ticket.time}</h3>
                  <p className="text-sm text-error font-bold uppercase">{ticket.target} over target</p>
                </div>
                <div className={`text-center p-3 rounded ${
                  ticket.urgent ? 'bg-error text-white' : 'bg-surface-container'
                }`}>
                  <p className="text-[10px] font-bold uppercase">Ticket</p>
                  <p className="text-2xl font-black">{ticket.id}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4 border-t border-b border-outline-variant/20 py-4">
                {ticket.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-lg">{item.qty}X {item.name.toUpperCase()}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 ${
                      item.type === 'Main' ? 'bg-[#ffdbca] text-[#773200]' :
                      item.type === 'Side' ? 'bg-gray-200' : 'bg-surface-container'
                    }`}>
                      {item.type}
                    </span>
                  </div>
                ))}
              </div>

              {ticket.notes && (
                <div className="bg-surface-container-low p-3 mb-4 mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Kitchen Notes</p>
                  <p className="text-sm italic">"{ticket.notes}"</p>
                </div>
              )}

              <div className="flex gap-3">
                <button className="flex-1 bg-surface-container text-on-surface py-3 font-headline font-black uppercase text-sm hover:bg-surface-container-high transition-colors">
                  Bump
                </button>
                <button className="flex-1 bg-secondary text-on-secondary py-3 font-headline font-black uppercase text-sm hover:brightness-110 transition-colors">
                  Mark Ready
                </button>
              </div>
            </div>
          ))}
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
          <span className="text-[10px] font-bold">Kitchen</span>
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
