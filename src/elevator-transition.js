import './elevator-transition.css';

const FLOORS = [
  { number: '01', title: '零号基地', subtitle: 'THE WORKSHOP' },
  { number: '02', title: '晶核熔金', subtitle: 'THE MINT' },
  { number: '03', title: '天际防线', subtitle: 'THE FRONTIER' },
];
const CLOSE_TIME = .42;
const TRAVEL_TIME = 1.48;
const OPEN_TIME = .62;
const TOTAL_TIME = CLOSE_TIME + TRAVEL_TIME + OPEN_TIME;
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const ease = t => t * t * (3 - 2 * t);

/**
 * A visual curtain over the independent floor scenes. The caller changes the
 * scene in onCovered; the scene must not move while the elevator is visible.
 * start returns false if already travelling. update is the only animation clock.
 */
export function createElevatorTransition({ container }) {
  if (!container?.appendChild) throw new TypeError('Elevator requires a container element.');
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'elevator-transition';
  root.hidden = true;
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', '升降舱转运中');
  root.innerHTML = `
    <div class="ev-door ev-door-left" aria-hidden="true">
      <div class="ev-door-brace"></div><div class="ev-door-topline">N / S — 07</div>
      <div class="ev-porthole"><div class="ev-shaft-stream"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="ev-window-reflection"></div></div>
      <div class="ev-panel-etch"><span>NEON</span><strong>SPIRE</strong><small>VERTICAL TRANSIT DIVISION</small></div>
      <div class="ev-door-lower"><i></i><i></i><i></i><span>PRESSURIZED CABIN</span></div><div class="ev-lock-light"></div>
    </div>
    <div class="ev-door ev-door-right" aria-hidden="true">
      <div class="ev-door-brace"></div><div class="ev-door-topline">CABIN / 001</div>
      <div class="ev-porthole"><div class="ev-shaft-stream"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="ev-window-reflection"></div></div>
      <div class="ev-panel-symbol"><svg viewBox="0 0 100 110"><path d="M50 7 90 30v48L50 102 10 78V30Z M25 70V39l25 43V27l25 43V39"/></svg><small>AUTHORIZED TRANSFER</small></div>
      <div class="ev-door-lower"><i></i><i></i><i></i><span>MIND THE DOORS</span></div><div class="ev-lock-light"></div>
    </div>
    <div class="ev-cabin-header"><div class="ev-system-line"><span><i></i> NEON SPIRE / TRANSIT</span><span class="ev-direction"></span></div><div class="ev-destination"><span class="ev-direction-icon">↑</span><strong class="ev-floor-number">02</strong><div><small>DESTINATION FLOOR</small><b class="ev-floor-title">晶核熔金</b><span class="ev-floor-subtitle">THE MINT</span></div></div><div class="ev-route"><span class="ev-route-origin">01</span><div><i></i></div><span class="ev-route-destination">02</span></div></div>
    <div class="ev-sill"><div class="ev-sill-stripe"></div><div class="ev-transfer-caption"><i></i><span class="ev-phase-label">舱门闭合</span><b class="ev-phase-code">DOOR SEQUENCE</b></div><div class="ev-footer-number">07 <span>NEON TRANSIT SYSTEM</span><b>SAFE TRANSFER</b></div></div>
  `;
  container.appendChild(root);
  const $ = selector => root.querySelector(selector);
  const dom = {
    direction: $('.ev-direction'), arrow: $('.ev-direction-icon'),
    number: $('.ev-floor-number'), title: $('.ev-floor-title'), subtitle: $('.ev-floor-subtitle'),
    origin: $('.ev-route-origin'), destination: $('.ev-route-destination'),
    phase: $('.ev-phase-label'), code: $('.ev-phase-code'),
  };
  let active = false, disposed = false, elapsed = 0, from = 0, to = 0;
  let phase = 'idle', covered = false, completed = false, callbacks = {}, generation = 0;
  let direction = 1;
  const blockedEvents = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'click', 'dblclick', 'contextmenu', 'wheel'];
  const blockInput = event => {
    if (!active) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  };
  blockedEvents.forEach(type => container.addEventListener(type, blockInput, { capture: true, passive: false }));

  function render() {
    const closing = clamp(elapsed / CLOSE_TIME);
    const travel = clamp((elapsed - CLOSE_TIME) / TRAVEL_TIME);
    const opening = clamp((elapsed - CLOSE_TIME - TRAVEL_TIME) / OPEN_TIME);
    const doorClosed = phase === 'closing' ? ease(closing) : phase === 'opening' ? 1 - ease(opening) : 1;
    const chromeOpacity = phase === 'closing' ? clamp(closing * 1.5) : phase === 'opening' ? 1 - ease(opening) : 1;
    root.style.setProperty('--ev-door-left', `${-101 * (1 - doorClosed)}%`);
    root.style.setProperty('--ev-door-right', `${101 * (1 - doorClosed)}%`);
    root.style.setProperty('--ev-chrome-opacity', chromeOpacity.toFixed(4));
    root.style.setProperty('--ev-travel-progress', `${travel * 100}%`);
    root.style.setProperty('--ev-light-position', `${direction * travel * 620}px`);
    root.style.setProperty('--ev-light-opacity', phase === 'travelling' ? '.94' : '.3');
    root.dataset.phase = phase;
    // Opaque doors provide the cover. A solid backing during travel also prevents
    // subpixel seams on high-DPI screens while the destination scene is swapped.
    root.style.backgroundColor = phase === 'travelling' ? '#17242c' : 'transparent';
    const labels = phase === 'closing' ? ['舱门闭合', 'SEALING CABIN'] : phase === 'opening' ? ['已抵达 · 舱门开启', 'ARRIVAL CONFIRMED'] : [direction > 0 ? '升降舱上行中' : direction < 0 ? '升降舱下行中' : '升降舱转运中', 'TRANSFER IN PROGRESS'];
    dom.phase.textContent = labels[0];
    dom.code.textContent = labels[1];
  }

  function start(options = {}) {
    if (disposed || active) return false;
    from = clamp(Math.trunc(Number(options.from) || 0), 0, 2);
    to = clamp(Math.trunc(Number(options.to) || 0), 0, 2);
    direction = Math.sign(to - from);
    callbacks = { covered: options.onCovered, complete: options.onComplete };
    covered = completed = false;
    elapsed = 0;
    active = true;
    phase = 'closing';
    generation++;
    dom.direction.textContent = direction > 0 ? 'ASCENDING' : direction < 0 ? 'DESCENDING' : 'TRANSFER';
    dom.arrow.textContent = direction > 0 ? '↑' : direction < 0 ? '↓' : '◇';
    dom.number.textContent = FLOORS[to].number;
    dom.title.textContent = FLOORS[to].title;
    dom.subtitle.textContent = FLOORS[to].subtitle;
    dom.origin.textContent = FLOORS[from].number;
    dom.destination.textContent = FLOORS[to].number;
    root.setAttribute('aria-label', `升降舱：${FLOORS[from].title}前往${FLOORS[to].title}`);
    root.hidden = false;
    container.setAttribute('data-elevator-active', 'true');
    render();
    return true;
  }

  function update(dt) {
    if (!active || disposed || !Number.isFinite(dt) || dt <= 0) return;
    const run = generation;
    elapsed = Math.min(TOTAL_TIME, elapsed + dt);
    if (!covered && elapsed >= CLOSE_TIME) {
      covered = true;
      phase = 'travelling';
      // Establish a fully closed curtain before allowing the floor to change.
      const finalElapsed = elapsed;
      elapsed = CLOSE_TIME;
      render();
      elapsed = finalElapsed;
      callbacks.covered?.();
      if (disposed || run !== generation || !active) return;
    }
    phase = elapsed < CLOSE_TIME ? 'closing' : elapsed < CLOSE_TIME + TRAVEL_TIME ? 'travelling' : 'opening';
    render();
    if (elapsed >= TOTAL_TIME && !completed) {
      completed = true;
      active = false;
      phase = 'idle';
      root.hidden = true;
      container.removeAttribute('data-elevator-active');
      const complete = callbacks.complete;
      callbacks = {};
      complete?.();
    }
  }

  return {
    start, update,
    getState: () => ({ active, from, to, phase, progress: elapsed / TOTAL_TIME }),
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      active = false;
      phase = 'idle';
      callbacks = {};
      blockedEvents.forEach(type => container.removeEventListener(type, blockInput, { capture: true }));
      container.removeAttribute('data-elevator-active');
      root.remove();
    },
  };
}
