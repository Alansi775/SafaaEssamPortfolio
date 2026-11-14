import { WORK, OUTLETS } from './data.js';
import { T, LANGS, DIR, EXPERIENCE, TRAINING } from './i18n.js';
import { initCinema } from './cinema.js';

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =================================================================
   STATE
================================================================= */
const LS_LANG = 'se.lang';
const LS_BD   = 'se.birthday.hidden';

let lang = (()=>{
  const saved = localStorage.getItem(LS_LANG);
  if (LANGS.includes(saved)) return saved;
  const n = (navigator.language||'ar').slice(0,2).toLowerCase();
  return LANGS.includes(n) ? n : 'ar';
})();

const t = k => (T[lang] && T[lang][k]) ?? (T.ar[k] ?? '');

/* =================================================================
   LANGUAGE
================================================================= */
function applyLang(next, {rerender=true}={}){
  lang = next;
  localStorage.setItem(LS_LANG, lang);

  document.documentElement.lang = lang;
  document.documentElement.dir  = DIR[lang];
  document.title = t('meta.title');

  $$('[data-i18n]').forEach(el=>{ el.textContent = t(el.dataset.i18n); });

  $$('[data-setlang]').forEach(b=> b.classList.toggle('is-on', b.dataset.setlang===lang));

  const chip = $('#langbtn span');
  if (chip) chip.textContent = { ar:'ع', en:'EN', tr:'TR' }[lang] || lang.toUpperCase();
  movePill($('.langsw'), $(`.langsw [data-setlang="${lang}"]`));

  if (rerender){
    renderWork();
    renderTimeline();
    renderTraining();
    renderMarquee();
    initCinema({ t });
    buildWordReveals();
    movePill($('#filters'), $('#filters .is-on'));
  }
}

/* sliding pill used by the language switch + the work filters */
function movePill(wrap, btn){
  if (!wrap || !btn) return;
  const pill = wrap.querySelector('.langsw__pill, .filters__pill');
  if (!pill) return;

  /* offsetLeft, not getBoundingClientRect.
     The rect is measured against the VIEWPORT, so the moment the
     control could scroll sideways - which the filters now do on a
     phone - the pill was placed using a scrolled-away position and
     stopped lining up with the selected segment. offsetLeft is
     measured against the control itself, so it is correct at any
     scroll offset. */
  const pad = parseFloat(getComputedStyle(wrap).paddingLeft) || 0;

  pill.style.width = btn.offsetWidth + 'px';
  pill.style.transform = `translateX(${btn.offsetLeft - pad}px)`;

  /* keep the chosen segment in view when the strip is scrollable */
  if (wrap.scrollWidth > wrap.clientWidth){
    const left = btn.offsetLeft - (wrap.clientWidth - btn.offsetWidth) / 2;
    wrap.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }
}

/* =================================================================
   RENDER — work grid
================================================================= */
/* =================================================================
   PLATFORM MARKS
   Inline SVG rather than an icon font or remote images: these are the
   only six marks the page needs, they must inherit currentColor so
   they work on both the light and the dark card, and a network round
   trip for a 20px glyph is not worth it.

   Paths are the official brand geometry, normalised to a 24 box.
================================================================= */
const MARK = {
  youtube:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>',
  facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>',
  instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z"/><path d="M12 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/><circle cx="18.41" cy="5.59" r="1.44"/></svg>',
  x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z"/></svg>',
  article:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3.5h13a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5H6a2 2 0 0 1-2-2V3.5z"/><path d="M7.5 7.5h6M7.5 11h6M7.5 14.5h3.5"/></svg>',
  site:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z"/></svg>'
};

const MARK_NAME = {
  youtube:'YouTube', facebook:'Facebook', instagram:'Instagram',
  x:'X', article:'Article', site:'Website'
};


let filter = 'all';

function renderWork(){
  const grid = $('#workGrid');
  if (!grid) return;
  grid.innerHTML = '';

  WORK.forEach((w,idx)=>{
    const c = w.t[lang] || w.t.ar;
    const a = document.createElement('a');
    a.className = 'item magnetic' + (w.yt ? ' item--video' : ' item--text');
    a.href = w.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.dataset.cat = w.cat;
    a.style.setProperty('--d', (idx % 9) * 55 + 'ms');

    /* mqdefault is the 320px thumbnail. hqdefault is letterboxed with
       black bars on 16:9 uploads, which read as a bug in a grid this
       clean. */
    const thumb = w.yt
      ? `<span class="item__thumb" style="background-image:url('https://i.ytimg.com/vi/${w.yt}/mqdefault.jpg')"></span>
         <span class="item__shade"></span>
         <span class="item__play" aria-hidden="true">
           <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>
         </span>`
      : '';

    a.innerHTML = `
      ${thumb}
      <span class="item__top">
        <span class="item__kind" title="${MARK_NAME[w.kind]||''}">
          ${MARK[w.kind]||''}
          <span class="u-sr">${MARK_NAME[w.kind]||''}</span>
        </span>
        <span class="item__go">↗</span>
      </span>
      <h3 class="item__title">${esc(c.title)}</h3>
      <p class="item__org">${esc(c.org)}</p>
      <p class="item__note">${esc(c.note)}</p>`;

    grid.appendChild(a);
  });

  applyFilter(filter, true);
  observeAll('.item');
}

function esc(s=''){ return String(s).replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

/* -----------------------------------------------------------------
   FILTERING — FLIP

   Toggling display alone makes the surviving cards teleport to their
   new slots. Instead: measure where every card IS, change the set,
   measure where each card LANDS, then play each one from its old
   position to its new one. The browser does the layout; we animate
   only the difference.

   Three populations, three treatments:
     leaving  - fall back and fade, then leave the flow
     staying  - travel from the old slot to the new one
     entering - rise in behind the travellers, stepped

   Re-entrancy is the whole difficulty here. Filters get clicked faster
   than the sequence runs, so every pass begins by cancelling the last
   one outright: a half-finished exit that was allowed to persist is
   what left cards stuck invisible.
------------------------------------------------------------------*/
let filterTimer = null;

function clearCardAnimations(items){
  items.forEach(el=>{
    el.getAnimations?.().forEach(a=> a.cancel());
    el.style.opacity = '';
    el.style.transform = '';
    el.style.filter = '';
    el.style.transitionDelay = '';
  });
}

function applyFilter(cat, silent=false){
  filter = cat;

  const items = $$('#workGrid .item');
  const matches = el => cat === 'all' || el.dataset.cat === cat;

  /* abandon whatever the previous click was still doing */
  clearTimeout(filterTimer);
  filterTimer = null;
  clearCardAnimations(items);

  if (silent || RM){
    items.forEach(el=>{
      el.classList.toggle('is-out', !matches(el));
      if (matches(el) && !silent) el.classList.add('is-in');
    });
    return;
  }

  // FIRST: where everything sits right now
  const before = new Map();
  items.forEach(el=>{
    if (!el.classList.contains('is-out')) before.set(el, el.getBoundingClientRect());
  });

  const leaving = items.filter(el=> before.has(el) && !matches(el));

  /* The exit is NOT filled forwards. A forwards fill outlives the
     animation and kept pinning opacity:0 onto cards that later came
     back, which is how they disappeared for good. commit() clears
     these explicitly as well, so neither path can leak. */
  leaving.forEach((el,i)=>{
    el.animate(
      [{ opacity:1, transform:'scale(1)' },
       { opacity:0, transform:'scale(.94)' }],
      { duration:240, delay:i*18, easing:'cubic-bezier(.4,0,1,1)' }
    );
    el.style.opacity = '0';     // hold the end state until commit hides it
  });

  const commit = ()=>{
    filterTimer = null;
    clearCardAnimations(items);

    items.forEach(el=>{
      el.classList.toggle('is-out', !matches(el));
      if (matches(el)) el.classList.add('is-in');
    });

    // LAST: where everything landed
    const shown = items.filter(matches);
    let step = 0;

    shown.forEach(el=>{
      const after = el.getBoundingClientRect();
      const prev = before.get(el);

      if (prev){
        // INVERT then PLAY: start from the old slot, settle into the new
        const dx = prev.left - after.left;
        const dy = prev.top  - after.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5){
          el.animate(
            [{ transform:`translate(${dx}px, ${dy}px)` },
             { transform:'none' }],
            { duration:620, easing:'cubic-bezier(.22,1,.36,1)' }
          );
        }
      } else {
        // a newcomer: rise in behind whatever is still moving
        el.animate(
          [{ opacity:0, transform:'translateY(26px) scale(.96)', filter:'blur(6px)' },
           { opacity:1, transform:'none', filter:'blur(0)' }],
          { duration:720, delay:160 + (step++ % 9) * 55,
            easing:'cubic-bezier(.22,1,.36,1)', fill:'backwards' }
        );
      }
    });
  };

  if (leaving.length) filterTimer = setTimeout(commit, 210);
  else commit();
}

/* =================================================================
   VIDEO CARDS

   These used to start playing on hover, in an iframe inside the card.
   It was removed: the still frame and the play badge already say this
   is footage, and that is all the card needs to communicate. Playing
   it here competed with the page, cost an embed per hover, and put a
   second video surface in front of someone who had not asked for one.
   The click goes to the real player, where it belongs.
================================================================= */

/* =================================================================
   RENDER — timeline / training / marquee
================================================================= */
function renderTimeline(){
  const host = $('#timeline'); if (!host) return;
  host.innerHTML = EXPERIENCE.map(g=>`
    <div class="tgroup">
      <div class="tgroup__head">
        <h3 class="tgroup__h">${esc(t(g.group))}</h3>
        <span class="tgroup__r">${esc(g.range)}</span>
      </div>
      ${g.items.map(it=>{
        const [role, org] = it[lang] || it.ar;
        return `<div class="trow"><b>${esc(role)}</b><span>${esc(org)}</span></div>`;
      }).join('')}
    </div>`).join('');
  observeAll('.trow');
}

function renderTraining(){
  const host = $('#trainList'); if (!host) return;
  host.innerHTML = TRAINING.map((it,i)=>{
    const [name, org] = it[lang] || it.ar;
    return `<div class="trow2"><i>${String(i+1).padStart(2,'0')}</i><b>${esc(name)}</b><span>${esc(org)}</span></div>`;
  }).join('');
  observeAll('.trow2');
}

function renderMarquee(){
  const track = $('#marqueeTrack'); if (!track) return;

  /* Each repetition is its OWN element rather than a flat run of items.
     The width of one repetition then measures exactly, which is what
     makes the wrap invisible - see startMarquee. */
  const set = `<span class="marquee__set">` +
    OUTLETS.map(o=>`<span>${esc(o)}</span><i></i>`).join('') +
  `</span>`;

  track.innerHTML = set;
  startMarquee();   // safe: re-measures, never re-loops
}

/* =================================================================
   MARQUEE — rAF driven, direction-aware, pauses off-screen
================================================================= */
let marqX = 0, marqW = 0, marqRAF = null, marqWidth = 0;

/* Exactly one loop ever runs. measure() may be called as often as it
   likes; it only ever updates the geometry the single loop reads. */
function startMarquee(){
  const track = $('#marqueeTrack');
  if (!track || RM) return;

  const measure = ()=>{
    const first = track.firstElementChild;
    if (!first) return;

    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;

    /* One cycle is a repetition plus the gap after it. scrollWidth/3
       does not divide evenly once gaps exist, and the fraction left
       over showed up as a jump at every wrap. */
    const w = first.getBoundingClientRect().width + gap;
    if (w <= 1) return;
    marqW = w;

    const need = Math.ceil(innerWidth / marqW) + 2;
    while (track.children.length < need) track.appendChild(first.cloneNode(true));
  };

  measure();
  if (document.fonts?.ready) document.fonts.ready.then(measure);

  if (marqRAF !== null) return;        // a loop is already running

  const dir = () => DIR[lang] === 'rtl' ? 1 : -1;
  let last = performance.now();

  const step = now=>{
    const dt = Math.min(now - last, 48); last = now;
    if (!document.hidden && marqW > 1){
      const d = dir();
      marqX += d * (dt * 0.028);
      if (d < 0 && marqX <= -marqW) marqX = marqX % marqW;
      if (d > 0 && marqX >= 0)      marqX = (marqX % marqW) - marqW;
      track.style.transform = `translate3d(${marqX.toFixed(2)}px,0,0)`;
    }
    marqRAF = requestAnimationFrame(step);
  };
  marqRAF = requestAnimationFrame(step);
}

/* =================================================================
   WORD-BY-WORD HEADLINE REVEAL
================================================================= */
function buildWordReveals(){
  $$('.reveal-lines').forEach(el=>{
    const text = el.textContent.trim();
    if (!text) return;
    el.innerHTML = text.split(/\s+/)
      .map((w,i)=>`<span class="rw"><i style="--i:${i}">${esc(w)}</i></span>`)
      .join(' ');
    el.classList.remove('is-in');
    io.observe(el);
  });
}

/* =================================================================
   INTERSECTION OBSERVER
================================================================= */
const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    if (e.target.classList.contains('count')) runCount(e.target);

    /* Once the headline has finished rising, drop the mask that let it
       rise. Leaving it on clipped the closing dot's pulse against the
       edge of the line box. overflow cannot be animated, so this is a
       class rather than a keyframe. */
    if (e.target.classList.contains('hero')){
      setTimeout(()=> e.target.classList.add('is-open'), 1700);
    }

    io.unobserve(e.target);
  });
}, { threshold:.14, rootMargin:'0px 0px -8% 0px' });

function observeAll(sel){ $$(sel).forEach(el=> io.observe(el)); }

/* =================================================================
   COUNTERS
================================================================= */
function runCount(el){
  const to = +el.dataset.to || 0;
  const suffix = el.dataset.suffix || '';

  if (RM){ el.textContent = to + suffix; el.classList.add('is-done'); return; }

  /* The figure rises into focus while it counts: it starts low and
     blurred, and lands sharp on the final value. Counting alone reads
     as a stopwatch; arriving is what makes it feel composed. */
  const dur = 1800, t0 = performance.now();
  const ease = x => 1 - Math.pow(1 - x, 4);

  const tick = now=>{
    const raw = Math.min((now - t0)/dur, 1);
    const p = ease(raw);

    el.textContent = Math.round(to * p) + (raw === 1 ? suffix : '');
    el.style.setProperty('--p', p.toFixed(3));

    if (raw < 1) requestAnimationFrame(tick);
    else el.classList.add('is-done');
  };

  el.style.setProperty('--p', '0');
  requestAnimationFrame(tick);
}


/* =================================================================
   THEME
   The page follows the viewer's own clock: light through the day,
   dark after dusk. It also keeps watching, so a visitor reading at
   18:58 sees the page turn over rather than staying wrong.

   A manual press wins and is remembered - the clock stops driving
   once someone has stated a preference.
================================================================= */
const LS_THEME = 'se.theme';
const DAY_START = 7, DAY_END = 19;      // local hours

const clockTheme = (d = new Date()) => {
  const h = d.getHours();
  return (h >= DAY_START && h < DAY_END) ? 'light' : 'dark';
};

const currentTheme = () => document.documentElement.dataset.theme || 'light';

function setTheme(next, { animate = true } = {}){
  const root = document.documentElement;
  if (root.dataset.theme === next) return;

  if (!animate || RM){
    root.dataset.theme = next;
    syncThemeColor(next);
    return;
  }

  /* A true cross-fade of the whole page, where the browser supports it.
     This is the one case where the platform does it better than we can:
     it snapshots both states and dissolves between them. */
  if (document.startViewTransition){
    document.startViewTransition(()=>{
      root.dataset.theme = next;
      syncThemeColor(next);
    });
    return;
  }

  /* Fallback: cover, swap underneath, uncover.
     The previous approach transitioned background-color and color on
     every element at once. On a page with headlines this large that
     meant thousands of simultaneous interpolations - the type appeared
     to glow through grey and then snap. Hiding the swap behind a single
     opaque layer is both smoother and far cheaper. */
  const veil = $('#dusk');
  if (!veil){ root.dataset.theme = next; return; }

  veil.style.background = next === 'dark' ? '#000' : '#fff';
  veil.style.transition = 'opacity .30s ease-out';
  veil.style.opacity = '1';

  clearTimeout(setTheme._t);
  setTheme._t = setTimeout(()=>{
    root.dataset.theme = next;
    syncThemeColor(next);
    requestAnimationFrame(()=>{
      veil.style.transition = 'opacity .55s ease-in';
      veil.style.opacity = '0';
    });
  }, 300);
}

/* The strip behind the notch and the home indicator is painted by the
   browser from theme-color, not by the page. Left unchanged it stayed
   white while the page went dark, which is the mismatched band at the
   top and bottom of the phone. */
/* The colour the phone should paint its status and toolbar strips. It
   is NOT simply the theme: the statement section is dark in both
   themes and runs full-bleed, so while it is under the edge of the
   screen the chrome has to be dark too. One fixed value can never match
   a page whose sections differ - that mismatch is the band that read as
   a separate piece above and below the page. */
function chromeColour(){
  const theme = currentTheme();
  const pageColour = theme === 'dark' ? '#000000' : '#ffffff';

  const cine = $('#cine');
  if (!cine) return pageColour;

  const r = cine.getBoundingClientRect();
  // does the dark section actually cover the top and bottom edges?
  const covers = r.top <= 0 && r.bottom >= innerHeight;
  return covers ? STAGE_EDGE : pageColour;
}

/* The stage fades to this at its outer edge, so the chrome and the
   page meet on exactly the same value. Kept in step with --stage-2. */
const STAGE_EDGE = '#000000';

let chromeCurrent = null;

function syncChrome(){
  const want = chromeColour();
  if (want === chromeCurrent) return;    // never repaint for nothing
  chromeCurrent = want;
  writeThemeColor(want);
}

function syncThemeColor(theme){
  chromeCurrent = null;                  // force a write after a theme change
  syncChrome();
}

function writeThemeColor(colour){

  /* iOS does not reliably repaint the status and toolbar areas when the
     content attribute of an EXISTING theme-color meta changes - the bar
     keeps the colour it had at load, which is the black band above a
     light page. Replacing the element forces the repaint.
     Every matching meta is removed first: Safari honours the first one
     it finds, so a stale tag left behind would keep winning. */
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());

  const m = document.createElement('meta');
  m.setAttribute('name', 'theme-color');
  m.setAttribute('content', colour);
  m.id = 'themeColor';
  document.head.appendChild(m);
}

/* Watched on scroll, rAF-throttled, and only written when the value
   actually changes - replacing the meta is cheap but not free. */
function initChromeWatch(){
  let ticking = false;
  const onScroll = ()=>{
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{ syncChrome(); ticking = false; });
  };
  addEventListener('scroll', onScroll, { passive:true });
  addEventListener('resize', onScroll);
  syncChrome();
}

function initTheme(){
  const btn = $('#themebtn');
  let manual = null;
  try { manual = localStorage.getItem(LS_THEME); } catch(e){}
  if (manual !== 'light' && manual !== 'dark') manual = null;

  // the inline head script already set the first paint; just sync state
  if (!manual) setTheme(clockTheme(), { animate:false });
  syncThemeColor(currentTheme());

  btn?.addEventListener('click', ()=>{
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    manual = next;
    try { localStorage.setItem(LS_THEME, next); } catch(e){}
    setTheme(next);
  });

  /* Keep following the clock while the tab is open. Checking once a
     minute is enough to catch the turn without burning a timer. */
  setInterval(()=>{ if (!manual) setTheme(clockTheme()); }, 60000);
  document.addEventListener('visibilitychange', ()=>{
    if (!document.hidden && !manual) setTheme(clockTheme());
  });
}

/* =================================================================
   HEADER — stick + hide on scroll down, active link
================================================================= */
function initHeader(){
  const hdr = $('#hdr');
  let last = 0;
  const onScroll = ()=>{
    const y = window.scrollY;
    hdr.classList.toggle('is-stuck', y > 24);
    last = y;

    const max = document.documentElement.scrollHeight - innerHeight;
    const bar = $('.scroll-progress span');
    if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
  };
  addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  // active section link
  const links = $$('.hdr__nav a');
  const secs  = links.map(a=> $(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver(es=>{
    es.forEach(e=>{
      if (!e.isIntersecting) return;
      links.forEach(a=> a.classList.toggle('is-active', a.getAttribute('href') === '#'+e.target.id));
    });
  }, { threshold:.2, rootMargin:'-35% 0px -55% 0px' });
  secs.forEach(s=> spy.observe(s));
}

/* =================================================================
   MOBILE NAV
================================================================= */
function closeMenu(){
  $('#burger')?.classList.remove('is-on');
  $('#mobnav')?.classList.remove('is-on');
  document.body.classList.remove('is-locked');
}

function initMobNav(){
  const burger = $('#burger'), nav = $('#mobnav');
  if (!burger || !nav) return;

  burger.addEventListener('click', ()=>{
    const on = !nav.classList.contains('is-on');
    burger.classList.toggle('is-on', on);
    nav.classList.toggle('is-on', on);
    document.body.classList.toggle('is-locked', on);
  });

  /* Delegated, on the document.
     Bound listeners are tied to the element that existed when they were
     attached, and to that element still being the thing the tap lands
     on. Switching language re-runs a lot of the page, and the close
     button stopped responding afterwards in Arabic. Delegation does not
     care: it matches on the way up, every time, for the life of the
     page. The backdrop closes too, which is what most people try. */
  document.addEventListener('click', e=>{
    if (!nav.classList.contains('is-on')) return;

    if (e.target.closest('#mobClose')) { closeMenu(); return; }
    if (e.target.closest('#mobnav a')) { closeMenu(); return; }

    // a tap on the empty part of the overlay
    if (e.target === nav) closeMenu();
  });

  addEventListener('keydown', e=>{ if (e.key === 'Escape') closeMenu(); });
}

/* =================================================================
   CUSTOM CURSOR — lerped, grows on interactive targets
================================================================= */
function initCursor(){
  if (RM || matchMedia('(hover:none)').matches) return;
  const dot = $('.cursor__dot'), ring = $('.cursor__ring');
  let mx=innerWidth/2, my=innerHeight/2, rx=mx, ry=my, on=false;

  addEventListener('mousemove', e=>{
    mx = e.clientX; my = e.clientY;
    if (!on){ on = true; document.body.classList.add('has-cursor'); rx=mx; ry=my; }
  }, { passive:true });

  const loop = ()=>{
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    dot.style.transform  = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const grow = v => document.body.classList.toggle('cursor-grow', v);
  document.addEventListener('mouseover', e=>{
    grow(!!e.target.closest('a,button,.item,.card,.skill'));
  });
}

/* =================================================================
   MAGNETIC HOVER — subtle, Apple-restrained (max ~6px)
================================================================= */
function initMagnetic(){
  if (RM || matchMedia('(hover:none)').matches) return;
  document.addEventListener('mousemove', e=>{
    const el = e.target.closest('.magnetic');
    $$('.magnetic').forEach(m=>{ if (m !== el) m.style.transform = ''; });
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width/2)) / r.width;
    const dy = (e.clientY - (r.top + r.height/2)) / r.height;
    el.style.transform = `translate(${dx*6}px, ${dy*6}px)`;
  }, { passive:true });
  document.addEventListener('mouseleave', ()=> $$('.magnetic').forEach(m=> m.style.transform=''));
}

/* =================================================================
   PORTRAIT PARALLAX — tied to scroll position, not time
================================================================= */
function initParallax(){
  if (RM) return;
  const frame = $('#portrait .portrait__frame img');
  if (!frame) return;
  let ticking = false;
  const update = ()=>{
    const r = frame.getBoundingClientRect();
    const p = (r.top + r.height/2 - innerHeight/2) / innerHeight; // -1..1
    frame.style.setProperty('--py', (p * -26).toFixed(2) + 'px');
    ticking = false;
  };
  addEventListener('scroll', ()=>{
    if (!ticking){ ticking = true; requestAnimationFrame(update); }
  }, { passive:true });
  update();
}



/* =================================================================
   TOAST
================================================================= */
let toastTimer;
function toast(msg){
  const el = $('#toast'); if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove('is-on'), 3600);
}

/* =================================================================
   BOOT
================================================================= */
function boot(){
  $('#yr').textContent = new Date().getFullYear();

  // language buttons
  document.addEventListener('click', e=>{
    const b = e.target.closest('[data-setlang]');
    if (b) applyLang(b.dataset.setlang);
  });

  /* The bar is too narrow on a phone for three chips, so it carries one
     that cycles. It shows the language you are IN, which is the thing
     you need to read; tapping moves to the next. */
  $('#langbtn')?.addEventListener('click', ()=>{
    applyLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]);
  });

  // work filters
  $('#filters').addEventListener('click', e=>{
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    $$('#filters [data-filter]').forEach(x=> x.classList.toggle('is-on', x === b));
    movePill($('#filters'), b);
    applyFilter(b.dataset.filter);
  });

  applyLang(lang, { rerender:false });
  renderWork(); renderTimeline(); renderTraining(); renderMarquee();
  buildWordReveals();
  observeAll('.reveal');

  document.documentElement.classList.add('js-on');
  observeAll('.hero');          // the headline reveals on arrival
  observeAll('.count');        // the figures themselves, not just their row
  initTheme();
  initChromeWatch();
  initHeader(); initMobNav(); initCursor(); initMagnetic(); initParallax(); initCinema({ t });

  // pills need layout + fonts settled
  const settle = ()=>{
    movePill($('.langsw'), $(`.langsw [data-setlang="${lang}"]`));
    movePill($('#filters'), $('#filters .is-on'));
  };
  settle();
  if (document.fonts?.ready) document.fonts.ready.then(settle);
  let lastW = innerWidth;
  addEventListener('resize', ()=>{
    settle();
    /* iOS fires resize every time the address bar collapses during a
       scroll. Only a genuine width change affects these layouts. */
    if (innerWidth !== lastW){ lastW = innerWidth; startMarquee(); }
  });

  /* The pills are positioned from measured geometry, so anything that
     changes that geometry has to re-run them. A ResizeObserver catches
     the cases a resize listener misses: the webfont swapping, a
     language with wider labels, the control being laid out late. */
  if (window.ResizeObserver){
    const ro = new ResizeObserver(()=> settle());
    [$('.langsw'), $('#filters')].forEach(el=> el && ro.observe(el));
  }
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
