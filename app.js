/* オクトーバーフェスト 会場MAP  —  LINE LIFF / GitHub Pages */
(() => {
  const CFG = window.APP_CONFIG || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nl = s => esc(s).replace(/\n/g, '<br>');
  const WEEK = ['日','月','火','水','木','金','土'];
  const CAT = { drink: 'ビール', food: 'フード', limited: '限定' };
  const FAC_ICON = { info:'i', amusement:'★', dog:'🐶', trash:'🗑', photo:'📷', kids:'K', pier:'⛴' };

  let DATA = null, V = null, menuCat = 'all', selDate = null, zoom = 1;

  // ---------- 日付（日本時間） ----------
  const todayJST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const parseD = s => { const [y,m,d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fmtD = s => { const d = parseD(s); return `${d.getUTCMonth()+1}/${d.getUTCDate()}（${WEEK[d.getUTCDay()]}）`; };
  const inRange = (d, a, b) => (!a || d >= a) && (!b || d <= b);

  // Drive の共有リンクを表示用URLへ
  const img = u => {
    if (!u) return '';
    const m = String(u).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([\w-]+)/);
    return m ? `https://lh3.googleusercontent.com/d/${m[1]}=w1000` : u;
  };

  // ---------- 起動 ----------
  async function boot() {
    // LIFF は描画を待たせない（外部ブラウザで init が返らないケースがあるため並行実行）
    let liffReady = Promise.resolve(false);
    if (CFG.LIFF_ID && window.liff) {
      liffReady = Promise.race([
        liff.init({ liffId: CFG.LIFF_ID }).then(() => true),
        new Promise(r => setTimeout(() => r(false), 5000))
      ]).catch(e => { console.warn('LIFF init failed', e); return false; });
    }
    try {
      DATA = await load();
    } catch (e) {
      console.error(e);
      $('main').innerHTML = '<p class="empty">データを読み込めませんでした。時間をおいて再度お試しください。</p>';
      return;
    }
    const venues = DATA.venues || [];
    const q = new URLSearchParams(location.search).get('venue');
    V = venues.find(v => v.venue_id === q) || venues.find(v => v.venue_id === CFG.DEFAULT_VENUE) || venues[0];
    if (!V) { $('main').innerHTML = '<p class="empty">現在公開中の会場はありません。</p>'; return; }
    if (venues.length > 1) {
      const sel = $('#venueSelect');
      sel.innerHTML = venues.map(v => `<option value="${esc(v.venue_id)}">${esc(v.short_name || v.name)}</option>`).join('');
      sel.value = V.venue_id; sel.hidden = false;
      sel.onchange = () => { V = venues.find(v => v.venue_id === sel.value); render(); };
    }
    bindUI();
    render();
    liffReady.then(ok => { if (ok && V) renderInfo(); });
  }

  async function load() {
    const sources = [];
    if (CFG.GAS_URL) sources.push(CFG.GAS_URL);
    sources.push('data/fallback.json?v=' + Date.now());
    let last;
    for (const url of sources) {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        if (j && j.venues) return j;
      } catch (e) { last = e; console.warn('load failed:', url, e); }
    }
    throw last;
  }

  const of = k => (DATA[k] || []).filter(r => !r.venue_id || r.venue_id === V.venue_id);
  const copy = k => {
    const r = of('copy').find(c => c.key === k);
    if (!r) return null;
    try { return JSON.parse(r.value); } catch { return r.value; }
  };

  // ---------- 描画 ----------
  function render() {
    document.title = (copy('app_title') || 'オクトーバーフェスト会場MAP');
    $('#appTitle').textContent = copy('app_title') || 'オクトーバーフェスト会場MAP';
    $('#appSub').textContent = copy('app_subtitle') || V.name;
    $('#heroVenue').textContent = `${V.short_name || ''}  ${fmtD(V.start_date)}〜${fmtD(V.end_date)}`;
    const tl = copy('tab_labels');
    if (tl && typeof tl === 'object') document.querySelectorAll('.tab').forEach(b => { if (tl[b.dataset.tab]) b.textContent = tl[b.dataset.tab]; });
    $('#footerNotice').textContent = copy('footer_notice') || '飲酒は20歳になってから。';
    if (DATA.updated_at) $('#updated').textContent = '最終更新 ' + new Date(DATA.updated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const t = todayJST();
    selDate = inRange(t, V.start_date, V.end_date) ? t : (t < V.start_date ? V.start_date : V.end_date);
    renderToday(t);
    renderMap();
    renderMenu();
    renderSchedule();
    renderInfo();
  }

  function renderToday(t) {
    const box = $('#today');
    if (!inRange(t, V.start_date, V.end_date)) { box.hidden = true; return; }
    const day = of('days').find(d => d.date === t);
    const ev = of('schedule').filter(s => s.date === t).map(s => s.title);
    const txt = (day && day.highlight) || ev.join('／');
    if (!txt) { box.hidden = true; return; }
    $('#todayText').textContent = txt;
    box.hidden = false;
    box.onclick = () => { selDate = t; switchTab('schedule'); renderSchedule(); };
  }

  // MAP
  function renderMap() {
    const im = $('#mapImg');
    im.src = V.map_image || 'assets/map-toyosu.jpg';
    const spots = of('spots');
    const booths = of('booths');
    $('#pins').innerHTML = spots.map(s => {
      const b = booths.find(b => b.booth_id === s.booth_id);
      const mark = s.type === 'booth' ? (b ? b.no : '•') : (FAC_ICON[s.spot_id] || '•');
      return `<button class="pin ${esc(s.type)}" data-spot="${esc(s.spot_id)}" style="left:${+s.x}%;top:${+s.y}%" aria-label="${esc(s.label)}"><span class="pin-dot"><span>${esc(mark)}</span></span></button>`;
    }).join('');
    $('#legend').innerHTML = spots.map(s => {
      const b = booths.find(b => b.booth_id === s.booth_id);
      const mark = s.type === 'booth' ? (b ? b.no : '') : (FAC_ICON[s.spot_id] || '');
      const label = s.type === 'booth' && b ? b.name_ja : s.label.replace(/^[①-⑳]\s*/, '');
      return `<li class="${esc(s.type)}"><button data-spot="${esc(s.spot_id)}"><span class="num">${esc(mark)}</span>${esc(label)}</button></li>`;
    }).join('');
    document.querySelectorAll('[data-spot]').forEach(el => el.onclick = () => openSpot(el.dataset.spot));
    setZoom(1);
  }

  function setZoom(z) {
    zoom = Math.min(3, Math.max(1, z));
    const sc = $('#mapScroller');
    const cx = (sc.scrollLeft + sc.clientWidth / 2) / sc.scrollWidth;
    const cy = (sc.scrollTop + sc.clientHeight / 2) / sc.scrollHeight;
    $('#mapInner').style.width = (zoom * 100) + '%';
    requestAnimationFrame(() => {
      sc.scrollLeft = cx * sc.scrollWidth - sc.clientWidth / 2;
      sc.scrollTop = cy * sc.scrollHeight - sc.clientHeight / 2;
    });
  }

  function openSpot(id) {
    const s = of('spots').find(x => x.spot_id === id);
    if (!s) return;
    document.querySelectorAll('.pin').forEach(p => p.classList.toggle('is-active', p.dataset.spot === id));
    if (s.type === 'booth' && s.booth_id) {
      const b = of('booths').find(b => b.booth_id === s.booth_id);
      if (b) return openSheet(boothHTML(b, 'all', true));
    }
    openSheet(`<p class="fac-title">${esc(s.label)}</p><p class="fac-desc">${nl(s.description || '')}</p>`);
  }

  // MENU
  function itemsFor(b, cat) {
    const t = todayJST();
    return of('menus')
      .filter(m => m.booth_id === b.booth_id && (cat === 'all' || m.category === cat))
      .filter(m => !m.end_date || t <= m.end_date)
      .sort((a, c) => (+a.sort || 0) - (+c.sort || 0));
  }
  function boothHTML(b, cat, inSheet) {
    const t = todayJST();
    const items = itemsFor(b, cat);
    const photos = of('photos').filter(p => p.booth_id === b.booth_id).sort((a, c) => (+a.sort || 0) - (+c.sort || 0));
    const li = items.map(m => {
      const soon = m.start_date && t < m.start_date;
      const src = img(m.image_url);
      return `<li class="item">
        ${src ? `<img class="item-img" src="${esc(src)}" alt="" loading="lazy">` : ''}
        <div class="item-body">
          <p><span class="tag ${esc(m.category)}">${esc(CAT[m.category] || m.category)}</span>${soon ? `<span class="tag soon">${esc(fmtD(m.start_date))}〜</span>` : ''}</p>
          <p class="item-name">${esc(m.name)}${m.price ? `<span class="item-price">${esc(m.price)}</span>` : ''}</p>
          <p class="item-desc">${nl(m.description)}</p>
        </div></li>`;
    }).join('');
    return `<article class="booth" id="booth-${esc(b.booth_id)}">
      <div class="booth-head">
        ${b.logo_url ? `<img class="booth-logo" src="${esc(img(b.logo_url))}" alt="">` : ''}
        <div><p class="booth-name"><span class="booth-no">${esc(b.no)}</span>${esc(b.name_ja)}</p>
        <p class="booth-catch">${esc(b.catch || b.copy)}</p></div>
        ${inSheet ? '' : `<button class="booth-map-link" data-goto="${esc(b.booth_id)}">MAP</button>`}
      </div>
      ${photos.length ? `<div class="gallery">${photos.map(p => `<img src="${esc(img(p.url))}" alt="" loading="lazy">`).join('')}</div>` : ''}
      ${li ? `<ul class="items">${li}</ul>` : '<p class="empty">メニュー情報は準備中です</p>'}
      ${b.tips ? `<p class="tips"><b>豆知識</b>　${esc(b.tips)}</p>` : ''}
    </article>`;
  }
  function renderMenu() {
    const booths = of('booths').sort((a, c) => (+a.no || 0) - (+c.no || 0));
    const html = booths.map(b => (menuCat === 'all' || itemsFor(b, menuCat).length) ? boothHTML(b, menuCat, false) : '').join('');
    $('#boothList').innerHTML = html || '<p class="empty">該当するメニューはありません</p>';
    document.querySelectorAll('[data-goto]').forEach(el => el.onclick = () => {
      const s = of('spots').find(s => s.booth_id === el.dataset.goto);
      switchTab('map');
      if (s) setTimeout(() => openSpot(s.spot_id), 150);
    });
  }

  // SCHEDULE
  function renderSchedule() {
    const days = [];
    for (let d = parseD(V.start_date); d <= parseD(V.end_date); d = new Date(d.getTime() + 864e5)) days.push(d.toISOString().slice(0, 10));
    const sch = of('schedule');
    const t = todayJST();
    $('#dateStrip').innerHTML = days.map(ds => {
      const d = parseD(ds), w = d.getUTCDay();
      const hasEv = sch.some(s => s.date === ds && s.type === 'event');
      return `<button class="date ${w===6?'sat':''} ${w===0?'sun':''} ${hasEv?'has-event':''} ${ds===selDate?'is-active':''} ${ds===t?'is-today':''}" data-date="${ds}">
        <div class="m">${d.getUTCMonth()+1}月</div><div class="d">${d.getUTCDate()}</div><div class="w">${WEEK[w]}</div></button>`;
    }).join('');
    document.querySelectorAll('.date').forEach(el => el.onclick = () => { selDate = el.dataset.date; renderSchedule(); });
    const act = $('.date.is-active');
    if (act) act.scrollIntoView({ inline: 'center', block: 'nearest' });

    const day = of('days').find(d => d.date === selDate);
    const list = sch.filter(s => s.date === selDate).sort((a, c) => (a.type === 'event' ? -1 : 1) - (c.type === 'event' ? -1 : 1));
    const w = parseD(selDate).getUTCDay();
    const holiday = w === 0 || w === 6 || isHoliday(selDate);
    const parts = (V.hours || '').split('／');
    const lo = ((V.hours || '').match(/（L\.?O\.?[^）]*）/) || [''])[0];
    let hours = parts.find(h => holiday ? /^\s*土/.test(h) : /^\s*平日/.test(h)) || V.hours;
    if (lo && hours.indexOf(lo) < 0) hours += ' ' + lo;
    $('#dayDetail').innerHTML = `<div class="day-card">
      <p class="day-title">${fmtD(selDate)}${selDate === t ? '　<span class="tag limited">TODAY</span>' : ''}</p>
      <p class="day-hours">${esc(hours || '')}</p>
      ${day && day.highlight ? `<p class="day-highlight">${esc(day.highlight)}</p>` : ''}
      ${list.map(s => `<div class="ev ${esc(s.type)}"><span class="ev-icon">${s.type === 'event' ? '🍺' : '🎪'}</span>
        <div><p class="ev-title">${esc(s.title)}</p>${s.time ? `<p class="ev-time">${esc(s.time)}</p>` : ''}<p class="ev-desc">${nl(s.description)}</p></div></div>`).join('') || '<p class="empty">この日の予定は準備中です</p>'}
      <p class="ev-desc" style="margin-top:10px">※スケジュールは予告なく変更・中止となる場合がございます。</p>
    </div>`;
  }
  // 祝日（期間中に使う分だけ。会場追加時はここに追記）
  const HOLIDAYS = ['2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23','2026-12-23'];
  const isHoliday = d => HOLIDAYS.includes(d);

  // INFO
  function renderInfo() {
    const howto = copy('howto');
    const rows = [['会場', V.place], ['期間', `${fmtD(V.start_date)}〜${fmtD(V.end_date)}`], ['時間', V.hours], ['入場料', V.fee], ['アクセス', V.access], ['ご注意', V.notes]]
      .filter(r => r[1]);
    const shareBtn = (window.liff && CFG.LIFF_ID && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker'))
      ? '<button class="btn" id="shareBtn">友だちにシェアする</button>' : '';
    $('#infoBody').innerHTML = `
      ${copy('welcome') ? `<p style="font-size:13.5px;margin-bottom:12px">${esc(copy('welcome'))}</p>` : ''}
      ${Array.isArray(howto) ? `<h2 class="sec">使い方</h2><div class="info-card"><ol class="howto">${howto.map(h => `<li>${esc(h)}</li>`).join('')}</ol></div>` : ''}
      <h2 class="sec">開催概要</h2>
      <div class="info-card"><dl>${rows.map(r => `<div class="info-row"><dt>${esc(r[0])}</dt><dd>${nl(r[1])}</dd></div>`).join('')}</dl></div>
      <a class="btn ghost" href="https://www.oktober-fest.jp/" target="_blank" rel="noopener">公式サイトを見る</a>
      ${shareBtn}`;
    const sb = $('#shareBtn');
    if (sb) sb.onclick = async () => {
      try {
        await liff.shareTargetPicker([{ type: 'text', text: `${V.name}\n会場MAPはこちら👇\nhttps://miniapp.line.me/${CFG.LIFF_ID}` }]);
      } catch (e) { console.warn(e); }
    };
  }

  // ---------- UI ----------
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === name));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('is-active', p.id === 'panel-' + name));
    window.scrollTo({ top: $('.tabs').offsetTop, behavior: 'smooth' });
  }
  function openSheet(html) {
    $('#sheetBody').innerHTML = html;
    $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true;
    document.body.style.overflow = '';
    document.querySelectorAll('.pin').forEach(p => p.classList.remove('is-active'));
  }
  function bindUI() {
    document.querySelectorAll('.tab').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
    document.querySelectorAll('#menuFilter .chip').forEach(c => c.onclick = () => {
      menuCat = c.dataset.cat;
      document.querySelectorAll('#menuFilter .chip').forEach(x => x.classList.toggle('is-active', x === c));
      renderMenu();
    });
    $('#zoomIn').onclick = () => setZoom(zoom + 0.5);
    $('#zoomOut').onclick = () => setZoom(zoom - 0.5);
    $('#sheetClose').onclick = closeSheet;
    $('#sheetBackdrop').onclick = closeSheet;
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  }

  boot();
})();
