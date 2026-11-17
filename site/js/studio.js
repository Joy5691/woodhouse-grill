/* =========================================================
   WOODHOUSE GRILL — 3D Cut Studio UI
   Wires the cut list / doneness / slice controls to steak3d.js.
   The 3D engine is only created when the section approaches
   the viewport, so it never slows the intro.
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const D = window.WH;
const cuts = D.cuts;

const list = $('#cutList'), stageEl = $('#studioStage'), loading = $('#studioLoading');
const nameEl = $('#cutName'), descEl = $('#cutDesc'), chipsEl = $('#cutChips'), idxEl = $('#cutIdx');
const doneTrack = $('#doneTrack'), doneLabel = $('#doneLabel'), doneNote = $('#doneNote');
const sliceBtn = $('#sliceBtn'), priceBtn = $('#cutPrice');

let studio = null, DONENESS = null, current = 0, doneness = 1;

/* ---------- static UI ---------- */
$('#cutTotal').textContent = String(cuts.length).padStart(2, '0');
list.innerHTML = cuts.map((c, i) => `
  <button type="button" class="cutbtn" data-i="${i}" aria-pressed="${i === 0}">
    <small>${String(i + 1).padStart(2, '0')}</small><b>${c.name}</b><em>${c.weight}</em>
  </button>`).join('');

const DONE_UI = [
  { name: 'Rare', temp: '50°C', c: '#a0303c' }, { name: 'Medium Rare', temp: '55°C', c: '#bd4f55' },
  { name: 'Medium', temp: '60°C', c: '#c47672' }, { name: 'Medium Well', temp: '65°C', c: '#a98476' },
  { name: 'Well Done', temp: '70°C+', c: '#86695b' }
];
const short = ['Rare', 'Med-Rare', 'Medium', 'Med-Well', 'Well'];
doneTrack.innerHTML = DONE_UI.map((d, i) => `<button type="button" class="done__btn" role="radio" aria-checked="${i === doneness}" aria-label="${d.name}" data-d="${i}" style="--c:${d.c}"><span>${short[i]}</span></button>`).join('');

function paintPanel(i, animate) {
  const c = cuts[i];
  const apply = () => {
    idxEl.textContent = String(i + 1).padStart(2, '0');
    nameEl.textContent = c.name;
    descEl.textContent = c.desc;
    chipsEl.innerHTML = `<span class="chip chip--gold">${c.weight}</span><span class="chip">${c.bone ? 'Bone-in' : 'Boneless'}</span><span class="chip">${c.id === 'tbone' ? 'East Texas' : 'West Texas'}</span>`;
    priceBtn.dataset.item = c.id;
    const canSlice = c.shape !== 'picanha';
    sliceBtn.disabled = !canSlice;
    doneNote.textContent = canSlice ? 'Tap a doneness to slice it open and look inside.' : 'Served on the churrasco skewer — carved at your table.';
    setSliceLabel(false);
  };
  if (!animate || !window.gsap) return apply();
  gsap.to([nameEl, descEl, chipsEl], { opacity: 0, y: -10, duration: .2, ease: 'power2.in', onComplete: () => {
    apply();
    gsap.fromTo([nameEl, chipsEl, descEl], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .55, stagger: .06, ease: 'power3.out' });
  } });
}
function setSliceLabel(on) { $('span', sliceBtn).textContent = on ? 'Put it back together' : 'Slice it open'; }
function setDone(i) {
  doneness = i;
  [...doneTrack.children].forEach((b, k) => b.setAttribute('aria-checked', String(k === i)));
  doneLabel.textContent = `${DONE_UI[i].name} · ${DONE_UI[i].temp}`;
  if (studio) {
    studio.setDoneness(i);
    if (studio.canSlice() && !studio.isSliced()) { if (studio.setSliced(true)) setSliceLabel(true); }
  }
}

function select(i) {
  if (i === current && studio) return;
  current = i;
  [...list.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  const btn = list.children[i];
  if (btn && list.scrollWidth > list.clientWidth) list.scrollTo({ left: btn.offsetLeft - 16, behavior: 'smooth' });
  paintPanel(i, true);
  studio && studio.show(cuts[i].shape);
}

list.addEventListener('click', e => { const b = e.target.closest('.cutbtn'); if (b) select(+b.dataset.i); });
list.addEventListener('keydown', e => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const n = (current + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + cuts.length) % cuts.length;
  select(n); list.children[n].focus();
});
doneTrack.addEventListener('click', e => { const b = e.target.closest('.done__btn'); if (b) setDone(+b.dataset.d); });
sliceBtn.addEventListener('click', () => {
  if (!studio || !studio.canSlice()) return;
  const on = studio.setSliced(!studio.isSliced());
  setSliceLabel(on);
});

paintPanel(0, false);
setDone(doneness);

/* ---------- lazy 3D boot ---------- */
async function boot() {
  try {
    const t = document.createElement('canvas');
    if (!(t.getContext('webgl2') || t.getContext('webgl'))) throw new Error('no webgl');
    const mod = await import('./steak3d.js');
    DONENESS = mod.DONENESS;
    studio = mod.createStudio(stageEl);
    window.__studio = studio;
    studio.setDoneness(doneness);
    studio.show(cuts[current].shape);
    loading.classList.add('is-done');
    // pre-paint remaining cuts while the browser is idle
    // painting is time-sliced inside steak3d, so this never blocks scrolling
    const idle = cb => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 300));
    (async () => {
      for (let k = 1; k < cuts.length; k++) {
        await new Promise(r => idle(r));
        await studio.prebuild(cuts[(current + k) % cuts.length].shape);
      }
    })();
  } catch (err) {
    console.warn('3D studio unavailable:', err);
    loading.innerHTML = '3D preview isn’t supported on this device — every cut is listed in the menu below.';
  }
}
let booted = false;
const go = () => { if (booted) return; booted = true; boot(); };
const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '900px 0px' });
const startWatch = () => io.observe(document.getElementById('cuts'));
if (document.documentElement.classList.contains('is-loading')) document.addEventListener('wh:ready', startWatch, { once: true });
else startWatch();
