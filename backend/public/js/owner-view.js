(async function () {
  const App = window.DashboardApp;
  const user = App.requireAuth(['owner']);
  if (!user) return;

  const title = document.querySelector('header h1');
  if (title) title.textContent = 'THE KINETIC EDITORIAL';

  try {
    const [analytics, sales] = await Promise.all([
      App.api('/dashboard/owner-analytics'),
      App.api('/sales?period=weekly'),
    ]);

    const bigRevenue = document.querySelector('.text-7xl.md\\:text-9xl.font-black.font-headline');
    if (bigRevenue) bigRevenue.textContent = App.formatMoney(analytics.totalRevenue);

    const topStats = document.querySelectorAll('section.flex.flex-col.md\\:flex-row.md\\:items-end.justify-between.gap-6 .grid.grid-cols-2.gap-2 > div');
    if (topStats[0]) topStats[0].querySelector('.text-3xl') && (topStats[0].querySelector('.text-3xl').innerHTML = `${analytics.locations} <span class="text-on-surface-variant/30">/ ${analytics.locations}</span>`);
    if (topStats[1]) topStats[1].querySelector('.text-3xl') && (topStats[1].querySelector('.text-3xl').innerHTML = `${analytics.activeStaff} <span class="material-symbols-outlined text-secondary text-2xl">verified_user</span>`);

    const locSection = document.querySelector('section.grid.grid-cols-1.md\\:grid-cols-3.gap-6');
    if (locSection) {
      locSection.innerHTML = (analytics.byLocation || []).slice(0, 6).map((loc) => {
        const revenue = Number(loc.revenue || 0);
        const pct = Math.min(100, Math.max(5, Math.round((revenue / (Number(analytics.totalRevenue) || 1)) * 100)));
        return `
        <div class="bg-surface-container-low p-8 border-l-4 border-black space-y-6">
          <div class="flex justify-between items-center">
            <h4 class="text-xl font-black uppercase tracking-tighter">${loc.location_name}</h4>
            <span class="material-symbols-outlined text-secondary">trending_up</span>
          </div>
          <div class="space-y-1">
            <p class="text-4xl font-black font-headline tracking-tighter">${App.formatMoney(revenue)}</p>
            <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Revenue 30d</p>
          </div>
          <div class="h-1 bg-surface-container-highest"><div class="h-full bg-secondary" style="width:${pct}%"></div></div>
          <div class="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <span>Weight</span>
            <span class="text-secondary">${pct}%</span>
          </div>
        </div>`;
      }).join('');
    }

    const bars = document.querySelectorAll('.h-80 .w-16.group .w-full');
    if (bars.length && analytics.dailyRevenue && analytics.dailyRevenue.length) {
      const vals = analytics.dailyRevenue.map((d) => Number(d.daily_revenue || 0));
      const max = Math.max(...vals, 1);
      bars.forEach((bar, i) => {
        const v = vals[i % vals.length] || 0;
        bar.style.height = `${Math.max(8, Math.round((v / max) * 100))}%`;
      });
    }

    const topList = document.querySelector('.lg\\:col-span-4 .flex-1.p-6.space-y-8');
    if (topList) {
      const sorted = (sales.sales || []).slice().sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue)).slice(0, 3);
      topList.innerHTML = sorted.map((s) => `
        <div class="flex items-center gap-5">
          <div class="w-20 h-20 bg-surface-container-highest overflow-hidden group border border-outline-variant/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-3xl">local_dining</span>
          </div>
          <div class="flex-1 space-y-1">
            <p class="font-black font-headline uppercase tracking-tight text-lg">${s.item_name}</p>
            <div class="flex justify-between items-center">
              <span class="text-[10px] font-bold text-on-surface-variant uppercase">${s.total_sold} units</span>
              <span class="text-xs font-black text-secondary">${App.formatMoney(s.total_revenue)}</span>
            </div>
          </div>
        </div>`).join('') || '<p class="text-on-surface-variant">No sales data yet.</p>';
    }
  } catch (err) {
    console.error(err);
  }
})();
