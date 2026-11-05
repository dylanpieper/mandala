// Hold to act. A press (pointer, Space or Enter) fills the button over `ms`;
// releasing early drains it back. At full, `done` runs once. The fill is
// drawn by CSS from `--hold` (0 to 1) on the button, and `.held` is set while
// pressed, so each control can show it in its own way (`.holdable` in app.css).

export interface HoldOptions {
  done: () => void;
  ms?: number;
}

export const HOLD_MS = 1000;
const DRAIN_MS = 400;

export function hold(node: HTMLElement, options: HoldOptions) {
  let opts = options;
  let progress = 0;
  let holding = false;
  let last = 0;
  let frame = 0;

  const draw = () => node.style.setProperty('--hold', progress.toFixed(3));

  function tick(t: number) {
    const dt = last ? t - last : 0;
    last = t;
    progress = Math.min(1, Math.max(0, progress + (holding ? dt / (opts.ms ?? HOLD_MS) : -dt / DRAIN_MS)));
    draw();
    if (progress >= 1) {
      release();
      progress = 0;
      draw();
      opts.done();
      return;
    }
    if (holding || progress > 0) frame = requestAnimationFrame(tick);
    else last = 0;
  }

  function press() {
    if (holding) return;
    holding = true;
    node.classList.add('held');
    last = 0;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }
  function release() {
    holding = false;
    node.classList.remove('held');
  }

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    node.setPointerCapture?.(e.pointerId);
    press();
  };
  const keydown = (e: KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      press();
    }
  };
  const keyup = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') release();
  };
  // A plain click must not act: only a full hold does.
  const click = (e: MouseEvent) => e.preventDefault();

  node.classList.add('holdable');
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointerup', release);
  node.addEventListener('pointercancel', release);
  node.addEventListener('lostpointercapture', release);
  node.addEventListener('keydown', keydown);
  node.addEventListener('keyup', keyup);
  node.addEventListener('blur', release);
  node.addEventListener('click', click);

  return {
    update(next: HoldOptions) {
      opts = next;
    },
    destroy() {
      cancelAnimationFrame(frame);
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointerup', release);
      node.removeEventListener('pointercancel', release);
      node.removeEventListener('lostpointercapture', release);
      node.removeEventListener('keydown', keydown);
      node.removeEventListener('keyup', keyup);
      node.removeEventListener('blur', release);
      node.removeEventListener('click', click);
    },
  };
}
