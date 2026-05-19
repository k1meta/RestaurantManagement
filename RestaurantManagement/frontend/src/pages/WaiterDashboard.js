import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createOrder, getMenu, getOrders, updateOrderStatus } from '../api/client';

const STATUS_META = {
  pending: {
    label: 'Waiting for Food',
    borderClass: 'border-[#d76100]',
    cardClass: 'bg-surface-container-low',
    badgeClass: 'bg-[#ffdbca] text-[#773200]',
  },
  preparing: {
    label: 'Cooking',
    borderClass: 'border-primary',
    cardClass: 'bg-surface-container-low',
    badgeClass: 'bg-primary text-on-primary',
  },
  ready: {
    label: 'Order Ready',
    borderClass: 'border-secondary',
    cardClass: 'bg-white shadow-md',
    badgeClass: 'bg-secondary text-on-secondary',
  },
};

function minutesSince(timestamp) {
  const started = new Date(timestamp).getTime();
  const now = Date.now();
  return Math.max(1, Math.round((now - started) / 60000));
}

function statusLabel(status) {
  return STATUS_META[status]?.label || status;
}

export default function WaiterDashboard({ user, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState({});
  const [savingOrder, setSavingOrder] = useState(false);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const ordersSectionRef = useRef(null);
  const readySectionRef = useRef(null);

  function scrollToSection(ref) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');

    try {
      const [ordersRes, menuRes] = await Promise.all([
        getOrders({ include_items: true, include_closed: false }),
        getMenu(),
      ]);

      const nextOrders = ordersRes.data.orders || [];
      setOrders(nextOrders);
      setMenuItems(menuRes.data.menu || []);
      setSelectedOrderId((current) => current || (nextOrders[0]?.id ?? null));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load waiter dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      loadData(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadData]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status !== 'closed'),
    [orders]
  );

  const selectedOrder = useMemo(
    () => activeOrders.find((order) => order.id === selectedOrderId) || activeOrders[0] || null,
    [activeOrders, selectedOrderId]
  );

  const readyOrders = useMemo(
    () => activeOrders.filter((order) => order.status === 'ready').slice(0, 4),
    [activeOrders]
  );

  function updateQuantity(menuItemId, nextQuantity) {
    setQuantities((prev) => ({
      ...prev,
      [menuItemId]: Math.max(0, nextQuantity),
    }));
  }

  async function handleCreateOrder() {
    const items = Object.entries(quantities)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([menu_item_id, quantity]) => ({
        menu_item_id: Number(menu_item_id),
        quantity: Number(quantity),
      }));

    if (!items.length) {
      setError('Select at least one item to create an order');
      return;
    }

    setSavingOrder(true);
    setError('');

    try {
      await createOrder({
        table_number: tableNumber.trim() || 'Walk-in',
        notes: notes.trim() || null,
        items,
      });

      setShowCreateOrder(false);
      setTableNumber('');
      setNotes('');
      setQuantities({});
      await loadData(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create order');
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleServeOrder(orderId) {
    try {
      await updateOrderStatus(orderId, 'closed');
      await loadData(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not close order');
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-on-surface font-headline uppercase text-sm tracking-widest">
            Loading Waiter Dashboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface pb-24">
      <header className="bg-white dark:bg-[#1c1b1b] flex justify-between items-center px-6 py-4 border-b border-surface-variant sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
          <div className="flex flex-col">
            <span className="font-headline font-bold text-sm uppercase tracking-tight">
              Downtown Central
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              Waiter: {user.name}
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-black font-headline hidden md:block">The Kinetic Editorial</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => loadData(false)}
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

      <main className="p-6 max-w-[1500px] mx-auto">
        {error ? (
          <div className="mb-6 bg-error-container border border-error/30 text-on-error-container p-4 text-sm font-bold">
            {error}
          </div>
        ) : null}

        <div className="grid lg:grid-cols-12 gap-6">
          <section ref={ordersSectionRef} className="lg:col-span-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="font-headline text-5xl font-black tracking-tight uppercase leading-none">
                  Active Tables
                </h2>
                <p className="font-label text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mt-2">
                  {activeOrders.length} tickets in play • {readyOrders.length} ready to serve
                </p>
              </div>
              <button
                onClick={() => setShowCreateOrder(true)}
                className="bg-primary text-on-primary px-8 py-5 font-headline font-black text-xl flex items-center justify-center gap-3 hover:bg-on-primary-fixed active:scale-[0.98] transition-all shadow-lg"
              >
                <span className="material-symbols-outlined font-bold">add</span>
                Create New Order
              </button>
            </div>

            <div ref={readySectionRef} className="bg-secondary-container border border-secondary/30 p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-headline text-xl font-black uppercase tracking-tight text-on-secondary-container">
                  Ready To Serve
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-on-secondary-container/70">
                  {readyOrders.length} ready
                </span>
              </div>

              {readyOrders.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {readyOrders.map((order) => (
                    <div key={`ready-${order.id}`} className="bg-white border border-secondary/40 p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-secondary">Ticket #{order.id}</p>
                        <p className="font-headline font-black text-xl tracking-tight">Table {order.table_number || '--'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleServeOrder(order.id)}
                        className="bg-secondary text-on-secondary px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:brightness-110"
                      >
                        Serve
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-bold text-on-secondary-container/80">
                  No tickets are currently ready.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeOrders.length ? (
                activeOrders.map((order) => {
                  const meta = STATUS_META[order.status] || STATUS_META.pending;
                  const isSelected = selectedOrder?.id === order.id;

                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`text-left p-5 flex flex-col justify-between h-56 border-l-[6px] transition-all ${meta.cardClass} ${meta.borderClass} ${
                        isSelected ? 'ring-2 ring-primary/30' : 'hover:shadow-lg'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex flex-col">
                          <span className="font-headline text-huge font-black tracking-tighter">
                            {order.table_number || '--'}
                          </span>
                          <p className="font-label text-[10px] font-black uppercase tracking-widest text-on-surface-variant -mt-2">
                            Table Number
                          </p>
                        </div>
                        <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 ${meta.badgeClass}`}>
                          {statusLabel(order.status)}
                        </div>
                      </div>

                      <div className="flex justify-between items-end mt-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold font-headline uppercase tracking-tight">
                            {order.items?.length || 0} items • {minutesSince(order.created_at)} min
                          </p>
                          <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">
                            Ticket #{order.id}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="md:col-span-2 bg-surface-container-low border border-outline-variant/20 p-8 text-center">
                  <p className="font-headline font-black text-2xl uppercase mb-2">No Active Orders</p>
                  <p className="text-sm text-on-surface-variant">Create a new order to get started.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="lg:col-span-4 bg-white flex flex-col h-full min-h-[700px] border border-outline-variant/15 shadow-2xl lg:shadow-none">
            <div className="p-6 bg-surface-container-low border-b border-outline-variant/15">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="font-headline text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant">
                    Current View
                  </span>
                  <h2 className="font-headline text-5xl font-black leading-none mt-1">
                    TABLE {selectedOrder?.table_number || '--'}
                  </h2>
                </div>
              </div>
              {selectedOrder ? (
                <div className="flex flex-wrap gap-2">
                  <span className="bg-primary text-on-primary text-[10px] font-black px-3 py-1 uppercase tracking-tighter">
                    TICKET #{selectedOrder.id}
                  </span>
                  <span className="bg-surface-container-highest text-on-surface text-[10px] font-black px-3 py-1 uppercase tracking-tighter">
                    {statusLabel(selectedOrder.status)}
                  </span>
                  <span className="bg-surface-container-highest text-on-surface text-[10px] font-black px-3 py-1 uppercase tracking-tighter">
                    {minutesSince(selectedOrder.created_at)} min
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {selectedOrder ? (
                <>
                  <div className="space-y-6">
                    {(selectedOrder.items || []).map((item, idx) => (
                      <div key={item.id} className="flex justify-between items-start group">
                        <div className="flex gap-5">
                          <span className="font-headline font-black text-2xl text-primary/40">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <h4 className="font-headline font-black text-xl leading-none uppercase">
                              {item.item_name}
                            </h4>
                            <p className="text-[11px] font-bold text-on-surface-variant mt-2 uppercase tracking-wide">
                              Qty {item.quantity} • {item.category || 'general'}
                            </p>
                          </div>
                        </div>
                        <span className="font-headline font-black text-xl">
                          ${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedOrder.notes ? (
                    <div className="mt-10 p-4 border border-outline-variant/30 bg-surface-container-low">
                      <p className="font-headline text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-on-surface-variant">
                        Notes
                      </p>
                      <p className="text-sm font-bold">{selectedOrder.notes}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <p className="font-headline font-black text-2xl uppercase">No Ticket Selected</p>
                    <p className="text-sm text-on-surface-variant mt-2">
                      Pick a table card to see details.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-surface-container-low space-y-6">
              <div className="flex justify-between items-end">
                <span className="font-headline text-[11px] font-black uppercase tracking-[0.3em] text-on-surface-variant mb-1">
                  Total Due
                </span>
                <span className="font-headline text-4xl font-black tracking-tighter leading-none">
                  ${selectedOrder?.total_amount?.toFixed(2) || '0.00'}
                </span>
              </div>
              <button
                disabled={!selectedOrder || selectedOrder.status !== 'ready'}
                onClick={() => selectedOrder && handleServeOrder(selectedOrder.id)}
                className="w-full bg-primary text-on-primary py-5 font-headline font-black text-xl tracking-tighter uppercase flex justify-center items-center gap-4 hover:bg-black/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xl"
              >
                Mark Served
                <span className="material-symbols-outlined">done</span>
              </button>
            </div>
          </aside>
        </div>
      </main>

      {showCreateOrder ? (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white border border-outline-variant/20 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
              <div>
                <h3 className="font-headline text-3xl font-black uppercase tracking-tight">Create New Order</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-2">
                  Select items and send ticket to kitchen
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateOrder(false)}
                className="material-symbols-outlined p-2 hover:bg-surface-container-low"
              >
                close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                    Table Number
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                    placeholder="24"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                    placeholder="No onions, allergy info, etc."
                  />
                </div>
              </div>

              <div className="space-y-3">
                {menuItems.map((item) => {
                  const quantity = Number(quantities[item.id] || 0);
                  return (
                    <div
                      key={item.id}
                      className="bg-surface-container-low p-4 border border-outline-variant/20 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-headline font-black text-lg uppercase leading-none">{item.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">
                          {item.category} • ${Number(item.price).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, quantity - 1)}
                          className="w-9 h-9 bg-surface-container-highest border border-outline-variant/30 font-black"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-headline font-black text-xl">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, quantity + 1)}
                          className="w-9 h-9 bg-primary text-on-primary font-black"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/20 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowCreateOrder(false)}
                className="sm:flex-1 py-3 border border-outline-variant/30 font-black uppercase tracking-widest text-xs hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={savingOrder}
                className="sm:flex-1 py-3 bg-primary text-on-primary font-black uppercase tracking-widest text-xs disabled:opacity-50"
              >
                {savingOrder ? 'Sending...' : 'Send To Kitchen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-stretch overflow-hidden bg-black dark:bg-[#000000] shadow-[0_-4px_20px_rgba(0,0,0,0.1)] h-20 md:hidden">
        <button
          type="button"
          onClick={() => scrollToSection(ordersSectionRef)}
          className="flex flex-col items-center justify-center bg-[#1c1b1b] text-white rounded-none border-t-4 border-[#1b6d24] h-full w-full active:bg-[#1b6d24] transition-colors"
        >
          <span className="material-symbols-outlined">receipt_long</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">Orders</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(readySectionRef)}
          className="flex flex-col items-center justify-center text-[#e5e2e1]/70 h-full w-full hover:bg-[#1c1b1b] active:bg-[#1b6d24] transition-all"
        >
          <span className="material-symbols-outlined">done_all</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">Ready</span>
        </button>
        <button
          type="button"
          onClick={() => setShowCreateOrder(true)}
          className="flex flex-col items-center justify-center text-[#e5e2e1]/70 h-full w-full hover:bg-[#1c1b1b] active:bg-[#1b6d24] transition-all"
        >
          <span className="material-symbols-outlined">add_circle</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">New</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex flex-col items-center justify-center text-[#e5e2e1]/70 h-full w-full hover:bg-[#1c1b1b] active:bg-[#1b6d24] transition-all"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">Logout</span>
        </button>
      </nav>
    </div>
  );
}
