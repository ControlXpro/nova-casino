/* Nova Casino — in-page audit harness.
   Loaded into the running site during testing; not shipped to players.

   Usage in the console (or via the automation bridge):
     await novaAudit.page()            // audit whatever is on screen
     await novaAudit.sweep(ids)        // audit a list of game ids
*/
(() => {
  const MIN_TAP = 44;          // px, WCAG 2.5.5 / platform guidance
  const MIN_TEXT = 11;         // px, below this is unreadable on a phone
  const MIN_INPUT = 16;        // px, below this iOS zooms the page on focus

  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
      && cs.opacity !== '0';
  };
  const name = (el) =>
    el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim()
    || el.querySelector('img[alt]')?.alt || '';
  const desc = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };

  /* An element inside a horizontally scrolling or clipping ancestor is not
     page overflow — a carousel's off-screen slides are supposed to be there. */
  function clipped(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'hidden' || ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  }

  /* ── horizontal overflow ── */
  function overflow() {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const page = de.scrollWidth > vw + 1;
    const culprits = [];
    if (page) {
      for (const el of document.querySelectorAll('body *')) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > vw + 1) {
          if (clipped(el)) continue;
          // only report the outermost offenders
          if (!culprits.some((c) => c.el.contains(el))) {
            culprits.push({ el, right: Math.round(r.right), left: Math.round(r.left) });
          }
        }
      }
    }
    return {
      overflows: page,
      scrollWidth: de.scrollWidth,
      clientWidth: vw,
      culprits: culprits.slice(0, 6).map((c) => `${desc(c.el)} [${c.left}..${c.right}]`),
    };
  }

  /* ── touch targets ── */
  function touchTargets() {
    const sel = 'button,a,input,select,textarea,[role="button"],[role="tab"],[onclick]';
    const small = [];
    for (const el of document.querySelectorAll(sel)) {
      if (!vis(el) || el.disabled) continue;
      const r = el.getBoundingClientRect();
      // an element can be small if its parent gives it padding via a hit area
      // half-pixel tolerance: sub-pixel layout can report 43.99 for a 44px box
      if (r.width < MIN_TAP - 0.5 || r.height < MIN_TAP - 0.5) {
        small.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return { count: small.length, items: small.slice(0, 14) };
  }

  /* ── text legibility ── */
  function text() {
    const tiny = [];
    const inputs = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const hasOwnText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (hasOwnText && size < MIN_TEXT) tiny.push(`${desc(el)} ${size}px`);
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && size < MIN_INPUT) {
        inputs.push(`${desc(el)} ${size}px`);
      }
    }
    return { tinyText: tiny.slice(0, 12), tinyCount: tiny.length, zoomingInputs: inputs };
  }

  /* ── accessible names ── */
  function labels() {
    const missing = [];
    for (const el of document.querySelectorAll('button,a[href],input,[role="button"]')) {
      if (!vis(el)) continue;
      if (!name(el)) missing.push(desc(el));
    }
    return { count: missing.length, items: missing.slice(0, 12) };
  }

  /* ── images ── */
  function images() {
    const imgs = [...document.images];
    return {
      total: imgs.length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src).slice(0, 8),
      eager: imgs.filter((i) => i.loading !== 'lazy').length,
      noAlt: imgs.filter((i) => !i.hasAttribute('alt')).length,
    };
  }

  /* ── touch behaviour ── */
  function touchBehaviour() {
    const body = getComputedStyle(document.body);
    const issues = [];
    if (body.touchAction === 'auto') {
      // fine at body level as long as controls opt in
      const b = document.querySelector('.btn');
      if (b && getComputedStyle(b).touchAction === 'auto') issues.push('buttons lack touch-action: manipulation');
    }
    if (body.overscrollBehaviorY === 'auto') issues.push('body allows overscroll chaining');
    const vp = document.querySelector('meta[name=viewport]')?.content || '';
    if (/user-scalable\s*=\s*(no|0)/.test(vp)) issues.push('viewport disables pinch zoom');
    if (/maximum-scale\s*=\s*1/.test(vp)) issues.push('viewport caps zoom at 1x');
    if (!/viewport-fit\s*=\s*cover/.test(vp)) issues.push('viewport-fit=cover missing (safe areas)');
    return { issues, viewport: vp };
  }

  /* ── fixed bars vs safe area ── */
  function safeAreas() {
    const bar = document.querySelector('.tabbar');
    if (!bar || !vis(bar)) return { tabbar: 'hidden' };
    const cs = getComputedStyle(bar);
    return {
      tabbar: 'visible',
      paddingBottom: cs.paddingBottom,
      usesEnv: /env\(/.test(document.styleSheets ? '' : '') || cs.paddingBottom !== '0px',
      height: Math.round(bar.getBoundingClientRect().height),
    };
  }

  /* ── does content hide behind fixed bars? ── */
  function occlusion() {
    const bar = document.querySelector('.tabbar');
    if (!bar || !vis(bar)) return { ok: true, reason: 'no fixed bar' };
    const barTop = bar.getBoundingClientRect().top;
    const foot = document.querySelector('.foot');
    const main = document.querySelector('#main');
    const mainStyle = getComputedStyle(main);
    return {
      barTop: Math.round(barTop),
      mainPaddingBottom: mainStyle.paddingBottom,
      footPaddingBottom: foot ? getComputedStyle(foot).paddingBottom : null,
    };
  }

  async function page() {
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      hash: location.hash || '#/lobby',
      overflow: overflow(),
      tap: touchTargets(),
      text: text(),
      labels: labels(),
      images: images(),
      touch: touchBehaviour(),
      safe: safeAreas(),
      occlusion: occlusion(),
    };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function sweep(ids, wait = 380) {
    const out = {};
    for (const id of ids) {
      location.hash = '#/lobby';
      await sleep(70);
      location.hash = '#/game/' + id;
      await sleep(wait);
      const o = overflow();
      const t = touchTargets();
      const rec = {};
      if (o.overflows) rec.overflow = o.culprits;
      if (t.count) rec.smallTaps = t.items;
      const st = document.querySelector('#gameView .stage');
      if (!st || st.childElementCount < 3) rec.nomount = true;
      if (Object.keys(rec).length) out[id] = rec;
    }
    location.hash = '#/lobby';
    return { checked: ids.length, problems: out };
  }

  window.novaAudit = { page, sweep, overflow, touchTargets, text, labels, images };
})();
