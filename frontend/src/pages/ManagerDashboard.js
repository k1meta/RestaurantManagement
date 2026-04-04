import React from 'react';

export default function ManagerDashboard({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-background text-on-surface pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-[#1c1b1b] flex justify-between items-center px-6 py-4 border-b border-surface-variant sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center overflow-hidden border border-outline-variant/15">
            <span className="text-lg font-bold">{user.name[0]}</span>
          </div>
          <h1 className="font-headline font-black text-2xl tracking-tight uppercase">The Kinetic Editorial</h1>
        </div>
        <button onClick={onLogout} className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors">
          Logout
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Alerts & Staff */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Price Approval Alert */}
          <section className="bg-[#ffdad6] p-6 border-2 border-error">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-xs bg-error text-white px-2 py-1">priority_high</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-error-container">
                Immediate Attention
              </span>
            </div>
            <h3 className="font-headline text-2xl font-black text-on-error-container mb-3 uppercase">
              Approve Price Update
            </h3>
            <p className="text-sm text-on-error-container/80 mb-6">
              Owner requested <strong>+5% adjustment</strong> on Specialty Cocktails due to supplier shift. Required for tonight's service.
            </p>
            <button className="w-full bg-error text-white py-4 font-headline font-black uppercase text-sm hover:brightness-110">
              Review & Sign Now
            </button>
          </section>

          {/* Staff Management */}
          <section className="bg-surface-container-low p-6">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-outline-variant/20">
              <h2 className="font-headline text-xs font-bold uppercase tracking-[0.2em]">Live: On Shift</h2>
              <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded-full">3 active</span>
            </div>

            <div className="space-y-3">
              {[
                { initials: 'JD', name: 'Julian D.', role: 'Head Chef' },
                { initials: 'ML', name: 'Marta L.', role: 'Floor Lead' },
                { initials: 'SR', name: 'Sam R.', role: 'Bar Manager' }
              ].map((staff, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-surface-container-lowest border border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-sm bg-secondary-container flex items-center justify-center text-xs font-bold text-on-secondary-container">
                        {staff.initials}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-secondary border-2 border-white rounded-full"></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{staff.name}</p>
                      <span className="text-[9px] bg-primary/5 text-primary-fixed-variant px-1.5 py-0.5 rounded border border-primary/10 font-bold uppercase tracking-widest">
                        {staff.role}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-secondary text-lg" style={{fontVariationSettings:'FILL 1'}}>
                    check_circle
                  </span>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 text-xs font-bold uppercase tracking-widest text-primary hover:text-secondary transition-colors py-2 border border-outline-variant/20">
              View Staff Directory
            </button>
          </section>
        </div>

        {/* Right Column: Inventory & Menu */}
        <div className="lg:col-span-8 space-y-6">
          {/* Inventory Section */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-headline text-2xl font-black uppercase">Kitchen Inventory</h2>
              <button className="bg-primary text-on-primary px-4 py-2 font-headline font-black text-sm flex items-center gap-2 hover:bg-on-primary-fixed">
                <span className="material-symbols-outlined">add</span>
                Manual Count
              </button>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Flour: OO-Fine', status: 'critical', current: 'Current', target: 'Some Target' },
                { name: 'Tomato Sauce', status: 'warning', current: 'Current', target: 'Refil 25RL Now' },
                { name: 'Olive Oil: EVOO', status: 'ok', current: 'Current', target: 'Stable' },
                { name: 'Mozzarella Buffalo', status: 'ok', current: 'Current', target: 'Stable' }
              ].map((item, idx) => (
                <div key={idx} className="bg-surface-container-low p-4 border-l-[6px] border-outline-variant">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-sm uppercase">{item.name}</h3>
                      <p className="text-xs text-on-surface-variant">{item.current}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-1 ${
                      item.status === 'critical' ? 'bg-error text-white' :
                      item.status === 'warning' ? 'bg-[#ffdbca] text-[#773200]' :
                      'bg-secondary/20 text-secondary'
                    }`}>
                      {item.status === 'critical' ? 'Refill Needed' : item.status === 'warning' ? 'Refill Needed' : 'Stable'}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2 mb-2">
                    <div className={`h-full ${
                      item.status === 'critical' ? 'bg-error w-1/4' :
                      item.status === 'warning' ? 'bg-[#d76100] w-1/2' :
                      'bg-secondary w-4/5'
                    }`}></div>
                  </div>
                  <p className="text-xs text-on-surface-variant">{item.target || 'Stable'}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Menu Management */}
          <section className="space-y-4">
            <h2 className="font-headline text-2xl font-black uppercase">Menu Hub</h2>
            <button className="w-full bg-primary text-on-primary py-4 font-headline font-black uppercase text-sm hover:bg-on-primary-fixed">
              Publish Changes
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: 'Pizza Margherita', price: '$18.50', status: 'Active' },
                { name: 'Grilled Lamb Chops', price: '$34.00', status: 'Sold Out' }
              ].map((item, idx) => (
                <div key={idx} className="bg-surface-container-low p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-sm uppercase">{item.name}</h3>
                      <p className="text-xs text-on-surface-variant">Main Course • 4 Servings</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{item.price}</p>
                      <p className={`text-[9px] font-bold uppercase ${item.status === 'Active' ? 'text-secondary' : 'text-error'}`}>
                        {item.status === 'Active' ? '◉ Active' : '◉ Sold Out'}
                      </p>
                    </div>
                  </div>
                  <button className="w-full text-xs font-bold uppercase tracking-widest border border-outline-variant/30 py-2 hover:bg-surface-container">
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>
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
