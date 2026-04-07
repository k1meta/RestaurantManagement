(async function () {
  const App = window.DashboardApp;
  const user = App.requireAuth(['manager', 'owner']);
  if (!user) return;

  const topTitle = document.querySelector('header h1');
  if (topTitle) topTitle.textContent = 'THE KINETIC EDITORIAL';

  try {
    const [stats, inventoryData, menuData] = await Promise.all([
      App.api('/dashboard/manager-stats'),
      App.api('/inventory'),
      App.api('/dashboard/menu'),
    ]);

    const activeBadge = document.querySelector('.bg-secondary\/10.text-secondary.text-\[10px\].font-bold');
    if (activeBadge) activeBadge.textContent = `${stats.staffCount} active`;

    const invGrid = document.querySelector('section.bg-surface-container-low.p-6.md\\:p-8.rounded-lg .grid.grid-cols-1.md\\:grid-cols-2.gap-4');
    if (invGrid) {
      const inventory = (inventoryData.inventory || []).slice(0, 8);
      invGrid.innerHTML = inventory.map((it) => {
        const q = Number(it.quantity || 0);
        const target = Math.max(1, q * 2);
        const pct = Math.min(100, Math.round((q / target) * 100));
        const low = pct < 35;
        return `
        <div class="bg-surface-container-lowest p-5 flex flex-col gap-4 border-l-4 ${low ? 'border-error' : 'border-secondary'} shadow-sm">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-headline text-lg font-bold">${it.ingredient}</h4>
              <p class="text-[10px] text-on-surface-variant uppercase tracking-widest">${it.location_name || 'Current location'}</p>
            </div>
            <span class="${low ? 'text-error bg-error/10' : 'text-secondary'} font-black text-[10px] uppercase tracking-widest px-2 py-1 rounded">${low ? 'Refill Needed' : 'Stable'}</span>
          </div>
          <div class="space-y-1.5">
            <div class="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
              <span>${q}${it.unit || ''} Current</span>
              <span>${target}${it.unit || ''} Target</span>
            </div>
            <div class="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div class="${low ? 'bg-error' : 'bg-secondary'} h-full" style="width:${Math.max(5, pct)}%"></div>
            </div>
          </div>
        </div>`;
      }).join('') || '<p class="text-on-surface-variant">No inventory data.</p>';
    }

    const menuWrap = document.querySelector('section.bg-surface-container-low.p-6.md\\:p-8.rounded-lg .grid.grid-cols-1.gap-4');
    if (menuWrap) {
      menuWrap.innerHTML = (menuData.items || []).slice(0, 10).map((m) => `
        <div class="bg-surface-container-lowest p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-outline-variant/10 shadow-sm group">
          <div class="flex items-center gap-6">
            <div class="w-20 h-20 bg-surface-container-high rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
              <span class="material-symbols-outlined text-3xl">restaurant</span>
            </div>
            <div>
              <h4 class="font-headline text-xl font-bold uppercase tracking-tight">${m.name}</h4>
              <p class="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">${m.category || 'menu'} • #${m.id}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-6 md:gap-12">
            <div class="flex flex-col">
              <label class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Price ($)</label>
              <div class="flex items-center">
                <span class="text-lg font-bold mr-1">$</span>
                <input class="bg-surface-container-high border-none font-headline font-black text-xl w-24 focus:ring-2 focus:ring-primary p-2 text-center" type="number" step="0.01" min="0" value="${Number(m.price).toFixed(2)}" data-menu-price-id="${m.id}"/>
              </div>
            </div>
            <div class="flex flex-col items-center">
              <label class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Availability</label>
              <span class="text-xs font-bold uppercase ${m.active ? 'text-secondary' : 'text-on-surface-variant'}">${m.active ? 'Active' : 'Sold Out'}</span>
            </div>
          </div>
        </div>`).join('');
    }

    document.addEventListener('change', async (e) => {
      const input = e.target.closest('[data-menu-price-id]');
      if (!input) return;
      const id = input.getAttribute('data-menu-price-id');
      const price = Number(input.value);
      if (Number.isNaN(price) || price <= 0) return;
      try {
        await App.api(`/menu/${id}/price`, {
          method: 'PATCH',
          headers: App.authHeaders(),
          body: JSON.stringify({ price }),
        });
      } catch (err) {
        console.error(err);
      }
    });
  } catch (err) {
    console.error(err);
  }
})();
