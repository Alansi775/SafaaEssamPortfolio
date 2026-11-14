/* =================================================================
   CINEMA — a scroll-scrubbed sequence.
   Scroll is the transport. Nothing plays on a timer, so the scene
   obeys the hand: forward, back, stop. It reads as one continuous
   camera move through a 3D space with morphing geometry.

   Shots are cross-faded by depth, not by opacity alone, so the
   transition carries the camera with it.
================================================================= */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
/* smootherstep — zero 1st and 2nd derivative at both ends, so shots
   enter and leave without a visible kick */
const ss = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
/* progress of a sub-range, eased */
const seg = (p, a, b) => ss((p - a) / (b - a));

/* Called once on boot, and again on every language switch. Only the
   letter-splitting needs to repeat; the listeners must not stack. */
let cinemaBooted = false;
let reSplit = null;

export function initCinema({ t }) {
  if (cinemaBooted) { reSplit?.(); return; }
  cinemaBooted = true;

  const sec = $('#cine');
  if (!sec) return;

  const world  = $('#cineWorld');
  const blob   = $('#cineBlob');
  const ring   = $('#cineRing');
  const shots  = $$('.shot', sec);
  const rail   = $('#cineRail');
  const counter= $('#cineCount');

  /* ---------------------------------------------------------------
     Split every shot headline into letters so they can stretch.
  ----------------------------------------------------------------*/
  let letterSets = [];

  const splitLetters = () => {
    /* Arabic is cursive: a letter's shape depends on its neighbours and
       it joins them. Giving each character its own box forces the
       isolated form and severs every join - "الدقة" came apart into
       loose glyphs. Latin letters do not join, so they keep the
       per-glyph stretch; for a joining script the word is the unit. */
    const joins = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

    letterSets = shots.map(shot => {
      const h = $('.shot__h', shot);
      if (!h) return [];
      const text = h.textContent.trim();
      if (!text) return [];

      const cursive = joins.test(text);

      h.innerHTML = text.split(/\s+/).map(word =>
        '<span class="shot__word">' +
          (cursive
            ? '<span class="shot__l">' + escHTML(word) + '</span>'
            : [...word].map(ch => '<span class="shot__l">' + escHTML(ch) + '</span>').join(''))
        + '</span>'
      ).join(' ');

      return $$('.shot__l', h);
    });
  };

  splitLetters();
  /* applyLang resets .shot__h to plain text, so re-split on each switch */
  reSplit = splitLetters;

  if (RM) {
    sec.style.height = 'auto';
    shots.forEach((s, i) => {
      s.style.opacity = i === 0 ? 1 : 0;
      s.style.transform = 'none';
    });
    drawBlob(blob, 0, 0);
    return;
  }

  /* ---------------------------------------------------------------
     Scroll state. Velocity is smoothed — raw wheel deltas are spiky
     and would make the letters jitter instead of breathe.
  ----------------------------------------------------------------*/
  let p = 0, pSmooth = 0, vel = 0, lastP = 0;
  let raf = null, running = false;

  const readProgress = () => {
    const r = sec.getBoundingClientRect();
    const runway = r.height - innerHeight;
    return runway <= 0 ? 0 : clamp(-r.top / runway);
  };

  const frame = () => {
    p = readProgress();

    /* critically-damped follow: the camera trails the scroll slightly,
       which is what makes the move feel like a camera and not a slider */
    pSmooth = lerp(pSmooth, p, 0.12);

    const dv = (pSmooth - lastP);
    vel = lerp(vel, dv, 0.18);
    lastP = pSmooth;

    render(pSmooth, vel);

    /* idle out when the scene is settled and off-screen */
    const r = sec.getBoundingClientRect();
    const visible = r.bottom > -200 && r.top < innerHeight + 200;
    if (!visible && Math.abs(p - pSmooth) < 0.0005 && Math.abs(vel) < 0.0002) {
      running = false; raf = null; return;
    }
    raf = requestAnimationFrame(frame);
  };

  const kick = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  kick();

  /* ---------------------------------------------------------------
     RENDER — one function, one transform write per element.
  ----------------------------------------------------------------*/
  function render(p, v) {
    const N = shots.length;

    /* ---- CAMERA -------------------------------------------------
       A single continuous path. The dolly pushes in across the whole
       scene while the pan swings through two gentle arcs, so no two
       shots are framed from the same angle.
    --------------------------------------------------------------*/
    /* The move is scaled to the frame. The same travel that reads as a
       slow push on a desktop throws the type clean off the edge of a
       phone, so narrow screens get a much tighter camera. */
    const narrow = innerWidth < 760;
    const k = narrow ? 0.3 : 1;

    const dolly  = lerp(-620 * (narrow ? 0.45 : 1), 340 * (narrow ? 0.4 : 1), ss(p));
    const panY   = Math.sin(p * Math.PI * 2) * 13 * k;
    const tiltX  = Math.cos(p * Math.PI * 1.4) * 5.5 * k;
    const rollZ  = Math.sin(p * Math.PI) * 1.6 * k;
    const driftX = Math.sin(p * Math.PI * 1.7) * 44 * k;

    world.style.transform =
      `translate3d(${driftX.toFixed(2)}px,0,${dolly.toFixed(2)}px) ` +
      `rotateX(${tiltX.toFixed(2)}deg) rotateY(${panY.toFixed(2)}deg) rotateZ(${rollZ.toFixed(2)}deg)`;

    /* ---- SHOTS --------------------------------------------------
       Each shot owns a slice of the runway. Neighbours overlap, so
       one is always arriving while another leaves — the cut never
       lands on an empty frame.
    --------------------------------------------------------------*/
    const each = 1 / N;
    let active = 0;

    shots.forEach((shot, i) => {
      const last  = i === N - 1;
      const start = i * each;
      const inP   = seg(p, start - each * 0.42, start + each * 0.40);
      /* the closing shot never exits — the sequence ends on it held,
         rather than dissolving just as the runway runs out */
      const outP  = last ? 0 : seg(p, start + each * 0.62, start + each * 1.35);
      const life  = inP * (1 - outP);

      if (life > 0.45) active = i;

      /* travels toward the camera on entry, past it on exit */
      const z  = lerp(-760 * (narrow ? 0.5 : 1), 0, inP) + outP * (narrow ? 320 : 700);
      const y  = (1 - inP) * 58 - outP * 52;
      const rx = ((1 - inP) * 11 - outP * 9) * k;
      const sc = lerp(0.9, 1, inP) + outP * (narrow ? 0.04 : 0.16);

      shot.style.opacity = life.toFixed(3);
      shot.style.transform =
        `translate3d(0,${y.toFixed(1)}px,${z.toFixed(1)}px) ` +
        `rotateX(${rx.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
      shot.style.filter = `blur(${((1 - inP) * 9 + outP * 11).toFixed(2)}px)`;
      shot.style.pointerEvents = life > 0.5 ? 'auto' : 'none';

      /* ---- LETTER STRETCH --------------------------------------
         Driven by scroll velocity, not by time. Scroll fast and the
         glyphs elongate; stop and they settle back. Area is kept
         roughly constant (x compensates y) so weight reads steady.
      -----------------------------------------------------------*/
      const set = letterSets[i];
      if (!set || life < 0.02) return;

      const stretch = clamp(Math.abs(v) * 26, 0, 0.5);
      const dir = Math.sign(v) || 1;

      for (let k = 0; k < set.length; k++) {
        /* a travelling wave so the stretch sweeps the word
           instead of hitting every glyph at once */
        const phase = Math.sin((p * 10) - k * 0.42);
        const sy = 1 + stretch * (0.55 + 0.45 * phase);
        const sx = 1 - stretch * 0.30 * (0.55 + 0.45 * phase);
        const ty = (1 - inP) * (14 + k * 2.2) * dir;

        set[k].style.transform =
          `translateY(${ty.toFixed(1)}px) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
      }
    });

    /* ---- MORPHING GEOMETRY -------------------------------------- */
    drawBlob(blob, p, v);

    if (ring) {
      ring.style.transform =
        `translate(-50%,-50%) rotateX(${(68 + Math.sin(p * 3.1) * 16).toFixed(2)}deg) ` +
        `rotateZ(${(p * 190).toFixed(2)}deg) scale(${(0.82 + ss(p) * 0.5).toFixed(3)})`;
      ring.style.opacity = (0.10 + Math.sin(p * Math.PI) * 0.26).toFixed(3);
    }

    /* ---- HUD ---------------------------------------------------- */
    if (rail)    rail.style.setProperty('--p', p.toFixed(4));
    if (counter) counter.textContent =
      String(active + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
  }
}

/* =================================================================
   MORPHING BLOB
   The outline is rebuilt every frame from 9 radii driven by layered
   sine waves, then closed with Catmull-Rom converted to cubic
   Béziers. Because the radii move continuously, the silhouette
   morphs rather than cross-fading between fixed shapes.
================================================================= */
const BLOB_N = 9;

function drawBlob(path, p, v = 0) {
  if (!path) return;

  const R = 190;
  const pts = [];
  const wob = 1 + Math.abs(v) * 10;           // scroll energy swells it

  for (let i = 0; i < BLOB_N; i++) {
    const a = (i / BLOB_N) * Math.PI * 2;
    const r = R * (
      1 +
      0.17 * Math.sin(a * 3 + p * 6.1) +
      0.11 * Math.sin(a * 5 - p * 4.3) +
      0.07 * Math.cos(a * 2 + p * 8.0)
    ) * wob;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }

  path.setAttribute('d', catmullRomClosed(pts));
}

/* closed Catmull-Rom → cubic Bézier */
function catmullRomClosed(pts) {
  const n = pts.length;
  const at = i => pts[(i % n + n) % n];
  let d = `M ${f(at(0)[0])} ${f(at(0)[1])}`;

  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + ' Z';
}

const f = n => n.toFixed(1);
const escHTML = s => String(s).replace(/[&<>"]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));
