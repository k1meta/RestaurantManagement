(async function () {
  const App = window.DashboardApp;
  const user = App.requireAuth(['waiter', 'manager', 'owner']);
  if (!user) return;

  const waiterBadge = document.querySelector('header .font-label');
  if (waiterBadge) waiterBadge.textContent = `WAITER: ${user.name.toUpperCase()}`;

  try {
    const stats = await App.api('/dashboard/waiter-stats');

    const subtitle = document.querySelector('section h2 + p');
    if (subtitle) {
      subtitle.textContent = `${stats.myOrders} TABLES IN PLAY • ${stats.pendingCount} PENDING TICKETS`;
    }

    const cards = document.querySelector('section .grid.grid-cols-1.md\\:grid-cols-2.gap-4');
    if (cards) {
      cards.innerHTML = (stats.activeOrders || []).map((o) => {
        const mins = App.elapsedMinutes(o.created_at);
        const status = String(o.status || '').toLowerCase();
        const statusClass =
          status === 'ready' ? 'bg-secondary text-on-secondary' :
          status === 'preparing' ? 'bg-[#ffdbca] text-[#773200]' : 'bg-surface-container-highest text-on-surface';

        return `
        <div class="bg-surface-container-low p-5 flex flex-col justify-between h-52 relative border-l-[6px] border-primary">
          <div class="flex justify-between items-start">
            <div class="flex flex-col">
              <span class="font-headline text-huge font-black tracking-tighter">${o.table_number || '-'}</span>
              <p class="font-label text-[10px] font-black uppercase tracking-widest text-on-surface-variant -mt-2">Table Number</p>
            </div>
            <div class="${statusClass} px-3 py-1 text-[10px] font-black uppercase tracking-widest">${App.statusLabel(o.status)}</div>
          </div>
          <div class="flex justify-between items-end mt-4">
            <div class="space-y-1">
              <p class="text-xs font-bold font-headline uppercase tracking-tight">${o.items || 0} ITEMS • ${mins} MIN OPEN</p>
            </div>
            <button class="bg-primary text-on-primary px-4 py-2 font-headline font-black text-xs" data-order-open="${o.id}">OPEN</button>
          </div>
        </div>`;
      }).join('');
    }

    const urgentWrap = document.querySelector('.bg\\[\\#ffdbca\\]\\/40 .space-y-3.relative.z-10');
    if (urgentWrap) {
      const readyOrders = (stats.activeOrders || []).filter((o) => o.status === 'ready').slice(0, 4);
      urgentWrap.innerHTML = readyOrders.length
        ? readyOrders.map((o) => `
          <div class="bg-white p-5 flex justify-between items-center shadow-sm border border-black/5">
            <div class="flex items-center gap-6">
              <span class="font-headline font-black text-3xl text-primary">#${o.id}</span>
              <div class="h-10 w-px bg-outline-variant/30"></div>
              <div>
                <p class="text-base font-black font-headline uppercase leading-tight">TABLE ${o.table_number}: ORDER READY</p>
                <p class="text-[10px] uppercase text-on-surface-variant font-black tracking-widest mt-0.5">${App.elapsedMinutes(o.created_at)}M AGO</p>
              </div>
            </div>
            <button class="material-symbols-outlined text-on-surface-variant" data-order-open="${o.id}">chevron_right</button>
          </div>`).join('')
        : '<p class="text-sm font-bold text-on-surface-variant">No urgent alerts right now.</p>';
    }

    let selected = (stats.activeOrders || [])[0];
    if (selected) await renderTicket(selected.id);

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-order-open]');
      if (!btn) return;
      await renderTicket(btn.getAttribute('data-order-open'));
    });
  } catch (err) {
    console.error(err);
  }

  async function renderTicket(orderId) {
    const detail = await App.api(`/orders/${orderId}`);
    const order = detail.order;
    const items = detail.items || [];

    const title = document.querySelector('aside h2.font-headline.text-5xl');
    if (title) title.textContent = `TABLE ${order.table_number || '-'}`;

    const meta = document.querySelector('aside .flex.gap-2');
    if (meta) {
      meta.innerHTML = `
        <span class="bg-primary text-on-primary text-[10px] font-black px-3 py-1 uppercase tracking-tighter">TICKET #${order.id}</span>
        <span class="bg-surface-container-highest text-on-surface text-[10px] font-black px-3 py-1 uppercase tracking-tighter">${items.length} ITEMS</span>
        <span class="bg-surface-container-highest text-on-surface text-[10px] font-black px-3 py-1 uppercase tracking-tighter">${App.statusLabel(order.status)}</span>`;
    }

    const listWrap = document.querySelector('aside .flex-1.overflow-y-auto .space-y-8');
    if (listWrap) {
      listWrap.innerHTML = items.map((it, idx) => `
        <div class="flex justify-between items-start group">
          <div class="flex gap-5">
            <span class="font-headline font-black text-2xl text-primary/40">${String(idx + 1).padStart(2, '0')}</span>
            <div>
              <h4 class="font-headline font-black text-xl leading-none uppercase">${it.item_name}</h4>
              <p class="text-[11px] font-bold text-on-surface-variant mt-2 uppercase tracking-wide">QTY ${it.quantity} • ${it.category || 'menu'}</p>
            </div>
          </div>
          <span class="font-headline font-black text-xl">${App.formatMoney(Number(it.unit_price) * Number(it.quantity))}</span>
        </div>
      `).join('') || '<p class="text-sm text-on-surface-variant">No items in this order.</p>';
    }

    const total = items.reduce((sum, it) => sum + Number(it.unit_price) * Number(it.quantity), 0);
    const totalNode = document.querySelector('aside .font-headline.text-4xl.font-black.tracking-tighter.leading-none');
    if (totalNode) totalNode.textContent = App.formatMoney(total);
  }
})();
