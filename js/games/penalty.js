/* Penalty Shootout — a real scene, not a row of buttons.

   You look at a floodlit goal from the penalty spot and pick a spot in the
   net. The keeper commits to two of the six zones, the ball flies to where you
   aimed (shrinking as it travels into the goal) and the keeper dives. Score to
   compound your multiplier, cash out whenever you like. */
import { el, clear, fmt, fmtx, rndInt, shuffle, sleep, wallet, round2, toast } from '../core.js';
import { betPanel, msgLine, rules } from '../ui.js';
import { play } from '../sound.js';

const EDGE = 0.99;

/* Six aim points, as percentages of the goal mouth.
   x/y position the ball, dive is how far the keeper travels to cover it. */
const ZONES = [
  { key: 'tl', label: 'Top left',      x: 20, y: 26, dive: -1, high: true },
  { key: 'tc', label: 'Top centre',    x: 50, y: 20, dive: 0,  high: true },
  { key: 'tr', label: 'Top right',     x: 80, y: 26, dive: 1,  high: true },
  { key: 'bl', label: 'Bottom left',   x: 18, y: 66, dive: -1, high: false },
  { key: 'bc', label: 'Bottom centre', x: 50, y: 70, dive: 0,  high: false },
  { key: 'br', label: 'Bottom right',  x: 82, y: 66, dive: 1,  high: false },
];

export function penalty(root) {
  const id = 'penalty';
  let live = false, stake = 0, scored = 0, shooting = false;

  const multAt = (n) => Math.round(EDGE * Math.pow(6 / 4, n) * 100) / 100;

  /* ── the pitch ── */
  const keeper = el('div.pk-keeper', { 'aria-hidden': 'true' });
  const ball = el('div.pk-ball', { 'aria-hidden': 'true' });
  const flash = el('div.pk-flash', { 'aria-hidden': 'true' });

  const targets = el('div.pk-targets');
  const zoneEls = {};
  for (const z of ZONES) {
    const t = el('button.pk-zone', {
      type: 'button', 'aria-label': `Shoot ${z.label}`,
      style: { left: z.x + '%', top: z.y + '%' },
    }, el('span.pk-cross', {}, '✛'));
    t.addEventListener('click', () => shoot(z));
    zoneEls[z.key] = t;
    targets.append(t);
  }

  const pitch = el('div.pk-pitch', {}, keeper, targets, ball, flash);
  const scoreboard = el('div.pk-hud', {},
    el('span.pk-goals', {}, '0'), ' scored',
    el('span.pk-mult', {}, '—'));

  const msg = msgLine();
  const bp = betPanel({ start: 25, min: 1, action: 'TAKE THE KICK', onAction: go });
  const btnOut = el('button.btn.btn-gold.btn-lg', { type: 'button', onclick: cashOut }, 'CASH OUT');
  btnOut.hidden = true;

  function resetBall() {
    ball.style.transition = 'none';
    ball.style.left = '50%';
    ball.style.top = '92%';
    ball.style.transform = 'translate(-50%,-50%) scale(1)';
    void ball.offsetWidth;
    ball.style.transition = '';
  }
  function paint() {
    pitch.classList.toggle('armed', live && !shooting);
    scoreboard.querySelector('.pk-goals').textContent = scored;
    scoreboard.querySelector('.pk-mult').textContent = live
      ? `${fmtx(multAt(scored))} banked · next ${fmtx(multAt(scored + 1))}`
      : `Keeper covers 2 of 6 · each goal ${fmtx(multAt(1))}`;
    btnOut.textContent = `CASH OUT ${fmt(round2(stake * multAt(scored)))}`;
  }

  function go() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    scored = 0; live = true;
    bp.lock(); btnOut.hidden = false;
    keeper.className = 'pk-keeper';
    resetBall();
    msg.set('Pick your spot', 'push');
    paint();
  }

  async function shoot(zone) {
    if (!live || shooting) return;
    shooting = true; paint();

    /* keeper commits to two zones — the 1/3 house side of a 60% win chance */
    const covered = shuffle(ZONES.map((z) => z.key)).slice(0, 2);
    const saved = covered.includes(zone.key);
    const diveTo = ZONES.find((z) => z.key === covered[0]);

    play('whoosh');
    keeper.className = 'pk-keeper dive '
      + (diveTo.dive < 0 ? 'left' : diveTo.dive > 0 ? 'right' : 'centre')
      + (diveTo.high ? ' high' : '');

    /* ball travels into the goal, shrinking with distance */
    ball.style.transition = 'left .52s cubic-bezier(.3,.1,.5,1), top .52s cubic-bezier(.3,.1,.5,1), transform .52s ease-out';
    ball.style.left = zone.x + '%';
    ball.style.top = zone.y + '%';
    ball.style.transform = 'translate(-50%,-50%) scale(.42)';
    await sleep(540);

    if (saved) {
      play('lose');
      flash.className = 'pk-flash save';
      ball.style.transition = 'left .3s ease-out, top .3s ease-out, transform .3s ease-out';
      ball.style.left = (zone.x + (zone.dive || 1) * 14) + '%';
      ball.style.top = (zone.y + 16) + '%';
      msg.lose(`SAVED! ${scored} goal${scored === 1 ? '' : 's'} lost`);
      wallet.logResult(id, stake, 0);
      await sleep(700);
      end();
    } else {
      play('winSmall');
      flash.className = 'pk-flash goal';
      scored++;
      msg.set(`GOAL! ${fmtx(multAt(scored))} banked`, 'win');
      paint();
      await sleep(820);
      flash.className = 'pk-flash';
      keeper.className = 'pk-keeper';
      resetBall();
      shooting = false;
      paint();
    }
  }

  function cashOut() {
    if (!live || shooting) return;
    if (scored === 0) { toast('Score at least one goal first.'); return; }
    const payout = round2(stake * multAt(scored));
    wallet.pay(payout);
    msg.win(payout - stake, `Cashed out after ${scored} goal${scored === 1 ? '' : 's'} ·`, stake);
    wallet.logResult(id, stake, payout);
    end();
  }

  function end() {
    live = false; shooting = false;
    btnOut.hidden = true; bp.unlock();
    flash.className = 'pk-flash';
    setTimeout(() => { keeper.className = 'pk-keeper'; resetBall(); }, 400);
    paint();
  }

  resetBall();
  paint();
  root.append(pitch, scoreboard, msg.node,
    el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' } },
      bp.node, btnOut),
    rules('PENALTY SHOOTOUT',
      `Pick one of <b>six spots</b> in the goal. The keeper commits to <b>two of the six</b> — beat him and you score.`,
      `Win chance per kick is <code>60%</code>, and each goal multiplies your stake by <code>1.49×</code>.`,
      `Keep shooting to compound, or cash out. One save ends the run and loses everything.`,
      `Theoretical return <code>99%</code>. The keeper's dive is chosen by <code>crypto.getRandomValues</code> at the moment you shoot — he is not reacting to your aim.`));
}
