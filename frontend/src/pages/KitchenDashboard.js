import React, { useEffect, useMemo, useState } from 'react';
import { getOrders, updateOrderStatus } from '../api/client';

const TARGET_MINUTES = 15;

function minutesSince(timestamp) {
  const started = new Date(timestamp).getTime();
  return Math.max(1, Math.round((Date.now() - started) / 60000));
}

function toClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function urgencyClass(order) {
  if (order.status === 'ready') {
    return 'border-secondary bg-white';
  }
  if (minutesSince(order.created_at) > TARGET_MINUTES) {
    return 'border-error bg-error/10';
  }
  return 'border-outline-variant bg-surface-container-low';
}

export default function KitchenDashboard({ user, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('all');

  async function loadQueue(showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');

    try {
      const response = await getOrders({
        include_items: true,
        status: 'pending,preparing,ready',
      });
      setOrders(response.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load kitchen queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadQueue(true);
    const interval = setInterval(() => {
      loadQueue(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const queue = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aDelay = minutesSince(a.created_at) > TARGET_MINUTES ? 1 : 0;
      const bDelay = minutesSince(b.created_at) > TARGET_MINUTES ? 1 : 0;
      if (aDelay !== bDelay) return bDelay - aDelay;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [orders]);

  const visibleQueue = useMemo(() => {
    if (viewMode === 'delayed') {
      return queue.filter((order) => order.status !== 'ready' && minutesSince(order.created_at) > TARGET_MINUTES);
    }

    if (viewMode === 'ready') {
      return queue.filter((order) => order.status === 'ready');
    }

    return queue;
  }, [queue, viewMode]);

  const stats = useMemo(() => {
    const active = queue.filter((o) => o.status !== 'ready').length;
    const delayed = queue.filter(
      (o) => o.status !== 'ready' && minutesSince(o.created_at) > TARGET_MINUTES
    ).length;
    const ready = queue.filter((o) => o.status === 'ready').length;

    const prepMinutes = queue
      .filter((o) => o.status !== 'ready')
      .map((o) => minutesSince(o.created_at));

    const avgPrep = prepMinutes.length
      ? Math.round(prepMinutes.reduce((sum, v) => sum + v, 0) / prepMinutes.length)
      : 0;

    return {
      active,
      delayed,
      ready,
      avgPrep,
    };
  }, [queue]);

  async function bumpOrder(order) {
    if (order.status !== 'pending') return;
    try {
      await updateOrderStatus(order.id, 'preparing');
      await loadQueue(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update order');
    }
  }

  async function markReady(order) {
    if (order.status === 'ready') return;
    try {
      await updateOrderStatus(order.id, 'ready');
      await loadQueue(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark order as ready');
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-on-surface font-headline uppercase text-sm tracking-widest">
            Loading Kitchen Queue
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface pb-20">
      <header className="bg-white dark:bg-[#1c1b1b] flex justify-between items-center px-6 py-4 border-b border-surface-variant sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
          <div className="flex flex-col">
            <h1 className="font-headline font-bold text-lg uppercase tracking-tight">
              The Kinetic Editorial <span className="mx-1 opacity-30">/</span> Kitchen
            </h1>
            <span className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              Station A • Main Line • {user.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => loadQueue(false)}
            className="text-xs font-black uppercase tracking-widest hover:text-primary transition-colors"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={onLogout}
            className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto">
        {error ? (
          <div className="mb-6 bg-error-container border border-error/30 text-on-error-container p-4 text-sm font-bold">
            {error}
          </div>
        ) : null}

        <section className="mb-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-primary text-on-primary p-5 flex flex-col justify-between h-32">
            <p className="font-headline text-[10px] font-bold uppercase tracking-widest opacity-70 leading-none">
              Active Tickets
            </p>
            <h2 className="font-headline text-5xl font-black leading-none">{stats.active}</h2>
          </div>
          <div className="bg-surface-container-low border border-outline-variant/30 p-5 flex flex-col justify-between h-32">
            <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant leading-none">
              Avg Prep Time
            </p>
            <div className="flex items-baseline gap-1">
              <h2 className="font-headline text-4xl font-bold leading-none">{stats.avgPrep || 0}</h2>
              <span className="text-xs opacity-50 uppercase">Min</span>
            </div>
          </div>
          <div className="bg-error-container p-5 flex flex-col justify-between h-32">
            <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-error-container leading-none">
              Delayed
            </p>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-3xl">warning</span>
              <h2 className="font-headline text-4xl font-black text-on-error-container leading-none">{stats.delayed}</h2>
            </div>
          </div>
          <div className="bg-secondary-container p-5 flex flex-col justify-between h-32">
            <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-secondary-container leading-none">
              Ready
            </p>
            <h2 className="font-headline text-4xl font-black text-on-secondary-container leading-none">{stats.ready}</h2>
          </div>
        </section>

        <div className="space-y-4">
          {visibleQueue.length ? (
            visibleQueue.map((order) => {
              const orderAge = minutesSince(order.created_at);
              const overTarget = orderAge - TARGET_MINUTES;
              const isUrgent = order.status !== 'ready' && overTarget > 0;

              return (
                <div key={order.id} className={`bg-white flex flex-col border-l-[6px] ${urgencyClass(order)}`}>
                  <div
                    className={`px-4 py-2 flex justify-between items-center ${
                      isUrgent ? 'bg-error text-white animate-pulse' : 'bg-black text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">
                        {isUrgent ? 'priority_high' : 'restaurant'}
                      </span>
                      <span className="font-headline text-[11px] font-black uppercase tracking-widest">
                        {isUrgent ? 'Urgent' : order.status} • Kitchen
                      </span>
                    </div>
                    <div className="font-headline text-[11px] font-bold uppercase">Ticket #{order.id}</div>
                  </div>

                  <div className="p-5 flex justify-between items-start border-b border-outline-variant/20">
                    <h3 className="font-headline text-5xl md:text-6xl font-black tracking-tighter">{toClock(order.created_at)}</h3>
                    <div className="text-right flex flex-col items-end">
                      <span
                        className={`font-headline text-2xl font-black px-2 ${
                          isUrgent ? 'text-error' : order.status === 'ready' ? 'text-secondary' : 'text-on-surface'
                        }`}
                      >
                        {orderAge}m
                      </span>
                      <span className="text-[9px] font-black uppercase opacity-60">
                        {isUrgent ? `${overTarget}m over target` : order.status === 'ready' ? 'Ready' : 'In progress'}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 flex-grow space-y-3">
                    {(order.items || []).map((item) => (
                      <div
                        key={item.id}
                        className={`flex justify-between items-center p-3 border-l-4 ${
                          isUrgent ? 'bg-red-50 border-error' : 'bg-surface-container-low border-outline-variant'
                        }`}
                      >
                        <span className="font-headline font-black text-lg md:text-xl uppercase tracking-tight text-black">
                          {item.quantity}x {item.item_name}
                        </span>
                        <span className="font-headline text-[10px] font-bold uppercase bg-black/10 px-1">
                          {item.category || 'general'}
                        </span>
                      </div>
                    ))}

                    {order.notes ? (
                      <div className="bg-tertiary-fixed p-3 mt-4">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="material-symbols-outlined text-sm">sticky_note_2</span>
                          <span className="font-headline text-[10px] font-bold uppercase tracking-widest">
                            Kitchen Notes
                          </span>
                        </div>
                        <p className="font-body text-sm font-bold italic">"{order.notes}"</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-outline-variant/30">
                    <button
                      onClick={() => bumpOrder(order)}
                      disabled={order.status !== 'pending'}
                      className="bg-white text-black py-5 font-headline font-black uppercase tracking-widest text-sm hover:bg-surface-container transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Bump
                    </button>
                    <button
                      onClick={() => markReady(order)}
                      disabled={order.status === 'ready'}
                      className="bg-secondary text-white py-5 font-headline font-black uppercase tracking-widest text-sm hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mark Ready
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-surface-container-low p-10 text-center border border-outline-variant/20">
              <p className="font-headline text-3xl font-black uppercase tracking-tight">
                {viewMode === 'all' ? 'Kitchen Queue Is Clear' : 'No Tickets In This View'}
              </p>
              <p className="text-sm text-on-surface-variant mt-2">
                {viewMode === 'all'
                  ? 'New tickets will appear here automatically.'
                  : 'Try switching back to All to see every ticket.'}
              </p>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-stretch bg-black shadow-[0_-4px_20px_rgba(0,0,0,0.2)] h-20 md:hidden">
        <button
          type="button"
          onClick={() => setViewMode('all')}
          className={`flex flex-col items-center justify-center w-full transition-all ${
            viewMode === 'all' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
          }`}
        >
          <span className="material-symbols-outlined mb-1">receipt_long</span>
          <span className="font-['Work_Sans'] text-[10px] font-bold uppercase tracking-widest">Orders</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('delayed')}
          className={`flex flex-col items-center justify-center w-full transition-all ${
            viewMode === 'delayed' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
          }`}
        >
          <span className="material-symbols-outlined mb-1">warning</span>
          <span className="font-['Work_Sans'] text-[10px] font-bold uppercase tracking-widest">Delayed</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('ready')}
          className={`flex flex-col items-center justify-center w-full transition-all ${
            viewMode === 'ready' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
          }`}
        >
          <span className="material-symbols-outlined mb-1">done_all</span>
          <span className="font-['Work_Sans'] text-[10px] font-bold uppercase tracking-widest">Ready</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex flex-col items-center justify-center text-[#e5e2e1]/70 w-full hover:bg-[#1c1b1b] transition-all"
        >
          <span className="material-symbols-outlined mb-1">logout</span>
          <span className="font-['Work_Sans'] text-[10px] font-bold uppercase tracking-widest">Logout</span>
        </button>
      </nav>
    </div>
  );
}
