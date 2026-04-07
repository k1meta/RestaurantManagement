(async function () {
  const App = window.DashboardApp;
  const user = App.requireAuth(['kitchen', 'manager', 'owner']);
  if (!user) return;

  const subtitle = document.querySelector('header .text-\[10px\]');
  if (subtitle) subtitle.textContent = `${(user.name || '').toUpperCase()} • MAIN LINE`;

  try {
    const data = await App.api('/dashboard/kitchen-stats');

    const statCards = document.querySelectorAll('main section.mb-10 > div');
    if (statCards[0]) statCards[0].querySelector('h2').textContent = String(data.totalCount || 0);
    if (statCards[1]) statCards[1].querySelector('h2').textContent = String(15);
    if (statCards[2]) statCards[2].querySelector('h2').textContent = String(data.pendingCount || 0);
    if (statCards[3]) statCards[3].querySelector('h2').textContent = String(data.readyCount || 0);

    const wrap = document.querySelector('.editorial-grid');
    if (!wrap) return;

    wrap.innerHTML = (data.pendingOrders || []).map((o) => {
      const mins = App.elapsedMinutes(o.created_at);
      const urgent = mins > 15;
      const badge = urgent ? 'Urgent' : 'Active';
      const bg = urgent ? 'bg-error text-white' : 'bg-black text-white';
      const buttonBg = urgent ? 'bg-error text-white' : 'bg-secondary text-white';

      const itemsHtml = (o.items || []).map((it) => `
        <div class="flex justify-between items-center p-3 bg-surface-container-low border-l-4 border-black">
          <span class="font-['Space_Grotesk'] font-black text-xl uppercase tracking-tight text-black">${Number(it.quantity || 1)}x ${it.name}</span>
          <span class="font-['Space_Grotesk'] text-[10px] font-bold uppercase bg-black/10 px-1">Item</span>
        </div>
      `).join('');

      return `
      <div class="bg-white flex flex-col border ${urgent ? 'border-2 border-error' : 'border-outline-variant'} relative shadow-xl">
        <div class="${bg} px-4 py-2 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">restaurant</span>
            <span class="font-['Space_Grotesk'] text-[11px] font-black uppercase tracking-widest">${badge} • Kitchen</span>
          </div>
          <div class="font-['Space_Grotesk'] text-[11px] font-bold uppercase">Ticket T-${o.id}</div>
        </div>
        <div class="p-5 flex justify-between items-start border-b border-outline-variant/20">
          <h3 class="font-['Space_Grotesk'] text-6xl font-black tracking-tighter">Table ${o.table_number || '-'}</h3>
          <div class="text-right flex flex-col items-end">
            <span class="font-['Space_Grotesk'] text-2xl font-black ${urgent ? 'text-error' : 'text-secondary'}">${mins}m</span>
            <span class="text-[9px] font-black uppercase opacity-60">${App.statusLabel(o.status)}</span>
          </div>
        </div>
        <div class="p-5 flex-grow space-y-3">${itemsHtml || '<p>No items.</p>'}
          ${o.notes ? `<div class="bg-surface-container-highest p-3 italic border border-outline-variant/30"><p class="font-['Work_Sans'] text-sm font-bold">\"${o.notes}\"</p></div>` : ''}
        </div>
        <div class="grid grid-cols-2 gap-px bg-outline-variant/30">
          <button class="bg-white text-black py-6 font-['Space_Grotesk'] font-black uppercase tracking-widest text-sm" data-kitchen-action="prepare" data-order-id="${o.id}">Bump</button>
          <button class="${buttonBg} py-6 font-['Space_Grotesk'] font-black uppercase tracking-widest text-sm" data-kitchen-action="ready" data-order-id="${o.id}">Mark Ready</button>
        </div>
      </div>`;
    }).join('') || '<p class="text-on-surface-variant">No active kitchen tickets.</p>';

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-kitchen-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-order-id');
      const action = btn.getAttribute('data-kitchen-action');
      const status = action === 'ready' ? 'ready' : 'preparing';
      try {
        await App.api(`/orders/${id}/status`, { method: 'PATCH', headers: App.authHeaders(), body: JSON.stringify({ status }) });
        window.location.reload();
      } catch (err) {
        console.error(err);
      }
    });
  } catch (err) {
    console.error(err);
  }
})();
