import React from 'react';

export default function OwnerDashboard({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-surface text-on-surface pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-[#121212] border-b border-outline-variant flex justify-between items-center px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-black dark:text-white transition-colors hover:bg-[#e5e2e1] dark:hover:bg-[#2c2c2c] p-2 rounded-sm cursor-pointer">
            restaurant_menu
          </span>
          <h1 className="text-black dark:text-white font-headline font-black text-2xl tracking-tight uppercase">
            The Kinetic Editorial
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-8">
            <a className="text-black dark:text-white font-black underline underline-offset-8 decoration-4 font-headline uppercase text-sm tracking-tighter">
              Analytics
            </a>
            <a className="text-[#1c1b1b]/60 dark:text-[#e5e2e1]/60 font-medium font-headline uppercase text-sm tracking-tighter hover:text-black transition-colors cursor-pointer">
              Locations
            </a>
            <a className="text-[#1c1b1b]/60 dark:text-[#e5e2e1]/60 font-medium font-headline uppercase text-sm tracking-tighter hover:text-black transition-colors cursor-pointer">
              Settings
            </a>
            <button onClick={onLogout} className="text-[#1c1b1b]/60 dark:text-[#e5e2e1]/60 font-medium font-headline uppercase text-sm tracking-tighter hover:text-black transition-colors">
              Logout
            </button>
          </nav>
          <div className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center overflow-hidden border border-outline-variant/20 cursor-pointer">
            <span className="font-bold text-lg">{user.name[0]}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 space-y-12">
        {/* Mission Control Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-secondary rounded-full animate-pulse"></span>
              <p className="text-secondary font-headline font-black text-xs tracking-[0.3em] uppercase">
                Global Command Active
              </p>
            </div>
            <h2 className="text-6xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9] border-l-8 border-black dark:border-white pl-6">
              Owner
              <br />
              Dashboard
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-container-low px-5 py-4 flex flex-col items-start border border-outline-variant/20">
              <span className="text-[10px] font-bold uppercase text-on-surface-variant tracking-[0.2em] mb-1">
                Nodes Online
              </span>
              <span className="text-3xl font-black font-headline">
                03 <span className="text-on-surface-variant/30">/ 03</span>
              </span>
            </div>
            <div className="bg-primary px-5 py-4 flex flex-col items-start text-on-primary border border-primary">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-1">
                Fleet Health
              </span>
              <span className="text-3xl font-black font-headline flex items-center gap-2">
                NOMINAL
                <span className="material-symbols-outlined text-secondary text-2xl">verified_user</span>
              </span>
            </div>
          </div>
        </section>

        {/* Revenue Display */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 bg-surface-container-low border border-outline-variant/10 p-10">
            <div className="space-y-12">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant mb-4">
                  Total Aggregate Revenue
                </h3>
                <span className="text-7xl md:text-8xl font-black font-headline tracking-tighter block leading-none">
                  $142,850.42
                </span>
              </div>

              {/* Weekly Chart */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <div className={`w-8 ${
                        idx === 4 ? 'h-32 bg-secondary' :
                        idx === 5 ? 'h-24 bg-surface-container' :
                        'h-16 bg-outline-variant/30'
                      }`}></div>
                      <span className="text-xs font-bold text-on-surface-variant">{day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="space-y-4">
            {[
              { label: 'Downtown', value: '$68,240', change: 'UP 12%', positive: true },
              { label: 'Uptown', value: '$44,912', change: 'SAME', positive: false },
              { label: 'Midtown', value: '$39,698', change: 'DOWN 3%', positive: false }
            ].map((metric, idx) => (
              <div key={idx} className="bg-surface-container-low border border-outline-variant/20 p-4">
                <p className="text-xs font-bold uppercase text-on-surface-variant mb-2 tracking-[0.1em]">
                  {metric.label}
                </p>
                <p className="text-3xl font-black font-headline mb-2">{metric.value}</p>
                <p className={`text-xs font-bold uppercase tracking-widest ${
                  metric.positive ? 'text-secondary' : 'text-on-surface-variant'
                }`}>
                  {metric.change}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Global Command Section */}
        <section className="space-y-6 border-t border-outline-variant/20 pt-12">
          <h3 className="font-headline text-3xl font-black uppercase">Global Sync Command</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-primary text-on-primary p-6">
              <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Last Global</p>
              <p className="font-headline text-lg font-black uppercase">Price Update</p>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/20 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Menu Review</p>
              <p className="font-headline text-lg font-black uppercase">Active</p>
            </div>
            <div className="bg-secondary/20 border border-secondary p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-2">Bulk Order</p>
              <p className="font-headline text-lg font-black uppercase text-secondary">Auto-Sync</p>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-primary text-on-primary flex justify-around p-4">
        <button className="flex flex-col items-center gap-1 p-2 hover:opacity-70">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px] font-bold">Dashboard</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:opacity-70">
          <span className="material-symbols-outlined">location_on</span>
          <span className="text-[10px] font-bold">Locations</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:opacity-70">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[10px] font-bold">Settings</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:opacity-70">
          <span className="material-symbols-outlined">analytics</span>
          <span className="text-[10px] font-bold">Analytics</span>
        </button>
      </nav>
    </div>
  );
}
