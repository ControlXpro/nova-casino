/* Monte-Carlo the slot maths so the RTP printed in each game's rules panel is
   the RTP the engine actually pays. Run: node tools/rtp.mjs [spins] */
import { MODELS, spinGrid, evaluate } from '../js/games/slots.js';

const SPINS = Number(process.argv[2]) || 2_000_000;
const BET = 20;

for (const [name, model] of Object.entries(MODELS)) {
  let wagered = 0, returned = 0, fsRounds = 0, biggest = 0;

  for (let i = 0; i < SPINS; i++) {
    wagered += BET;
    const res = evaluate(spinGrid(model), model, BET, 1);
    let round = res.total;
    if (res.freeSpins) {
      fsRounds++;
      let left = res.freeSpins;
      for (let f = 0; f < left && f < 60; f++) {
        const fs = evaluate(spinGrid(model), model, BET, model.fsMult);
        round += fs.total;
        if (fs.freeSpins) left += 5;
      }
    }
    returned += round;
    if (round / BET > biggest) biggest = round / BET;
  }

  const rtp = (returned / wagered) * 100;
  const drift = rtp - model.rtp;
  console.log(
    `${name.padEnd(5)} stated ${String(model.rtp).padStart(5)}%  ` +
    `measured ${rtp.toFixed(2).padStart(6)}%  drift ${(drift >= 0 ? '+' : '') + drift.toFixed(2)}%  ` +
    `free-spin rounds ${(fsRounds / SPINS * 100).toFixed(2)}%  best ${biggest.toFixed(0)}x  ` +
    `[suggested calib ${(model.calib * model.rtp / rtp).toFixed(4)}]`);
}
