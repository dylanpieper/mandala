// "On this page": a sand dot follows the section being read.

/** The heading being read: the last one at or above the reading line. */
export function current(tops: { id: string; top: number }[], line: number): string | null {
  if (!tops.length) return null;
  let id = tops[0].id;
  for (const t of tops) if (t.top <= line) id = t.id;
  return id;
}

/** Keeps the dot on the section in view. Returns a stop function. */
export function follow(toc: HTMLElement, line = 96): () => void {
  const links = [...toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter((e): e is HTMLElement => !!e);
  let frame = 0;
  const update = () => {
    frame = 0;
    const id = current(targets.map((t) => ({ id: t.id, top: t.getBoundingClientRect().top })), line);
    for (const a of links) a.classList.toggle('on', a.hash === `#${id}`);
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener('scroll', onScroll, { passive: true });
  update();
  return () => {
    removeEventListener('scroll', onScroll);
    cancelAnimationFrame(frame);
  };
}
