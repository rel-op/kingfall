// The built-in chess engine: its own move generator, evaluation and search.
// Kept apart from chess.js (the rules the game shows) because search needs a much faster board.
// Self-contained, so the same code runs in a Web Worker, on the page and under Node.
(function (root) {
  function ENGINE() {
    'use strict';
    const MATE = 30000, INF = 32000, MAXPLY = 96;
    const VAL = [0, 100, 320, 330, 500, 900, 0];
    // Piece-square tables: PeSTO (Ronald Friederich), listed from a8 to h1 for White.
    const MGV = [0, 82, 337, 365, 477, 1025, 0], EGV = [0, 94, 281, 297, 512, 936, 0], PH = [0, 0, 1, 1, 2, 4, 0];
    const MG = [
      [0, 0, 0, 0, 0, 0, 0, 0, 98, 134, 61, 95, 68, 126, 34, -11, -6, 7, 26, 31, 65, 56, 25, -20, -14, 13, 6, 21, 23, 12, 17, -23, -27, -2, -5, 12, 17, 6, 10, -25, -26, -4, -4, -10, 3, 3, 33, -12, -35, -1, -20, -23, -15, 24, 38, -22, 0, 0, 0, 0, 0, 0, 0, 0],
      [-167, -89, -34, -49, 61, -97, -15, -107, -73, -41, 72, 36, 23, 62, 7, -17, -47, 60, 37, 65, 84, 129, 73, 44, -9, 17, 19, 53, 37, 69, 18, 22, -13, 4, 16, 13, 28, 19, 21, -8, -23, -9, 12, 10, 19, 17, 25, -16, -29, -53, -12, -3, -1, 18, -14, -19, -105, -21, -58, -33, -17, -28, -19, -23],
      [-29, 4, -82, -37, -25, -42, 7, -8, -26, 16, -18, -13, 30, 59, 18, -47, -16, 37, 43, 40, 35, 50, 37, -2, -4, 5, 19, 50, 37, 37, 7, -2, -6, 13, 13, 26, 34, 12, 10, 4, 0, 15, 15, 15, 14, 27, 18, 10, 4, 15, 16, 0, 7, 21, 33, 1, -33, -3, -14, -21, -13, -12, -39, -21],
      [32, 42, 32, 51, 63, 9, 31, 43, 27, 32, 58, 62, 80, 67, 26, 44, -5, 19, 26, 36, 17, 45, 61, 16, -24, -11, 7, 26, 24, 35, -8, -20, -36, -26, -12, -1, 9, -7, 6, -23, -45, -25, -16, -17, 3, 0, -5, -33, -44, -16, -20, -9, -1, 11, -6, -71, -19, -13, 1, 17, 16, 7, -37, -26],
      [-28, 0, 29, 12, 59, 44, 43, 45, -24, -39, -5, 1, -16, 57, 28, 54, -13, -17, 7, 8, 29, 56, 47, 57, -27, -27, -16, -16, -1, 17, -2, 1, -9, -26, -9, -10, -2, -4, 3, -3, -14, 2, -11, -2, -5, 2, 14, 5, -35, -8, 11, 2, 8, 15, -3, 1, -1, -18, -9, 10, -15, -25, -31, -50],
      [-65, 23, 16, -15, -56, -34, 2, 13, 29, -1, -20, -7, -8, -4, -38, -29, -9, 24, 2, -16, -20, 6, 22, -22, -17, -20, -12, -27, -30, -25, -14, -36, -49, -1, -27, -39, -46, -44, -33, -51, -14, -14, -22, -46, -44, -30, -15, -27, 1, 7, -8, -64, -43, -16, 9, 8, -15, 36, 12, -54, 8, -28, 24, 14]];
    const EG = [
      [0, 0, 0, 0, 0, 0, 0, 0, 178, 173, 158, 134, 147, 132, 165, 187, 94, 100, 85, 67, 56, 53, 82, 84, 32, 24, 13, 5, -2, 4, 17, 17, 13, 9, -3, -7, -7, -8, 3, -1, 4, 7, -6, 1, 0, -5, -1, -8, 13, 8, 8, 10, 13, 0, 2, -7, 0, 0, 0, 0, 0, 0, 0, 0],
      [-58, -38, -13, -28, -31, -27, -63, -99, -25, -8, -25, -2, -9, -25, -24, -52, -24, -20, 10, 9, -1, -9, -19, -41, -17, 3, 22, 22, 22, 11, 8, -18, -18, -6, 16, 25, 16, 17, 4, -18, -23, -3, -1, 15, 10, -3, -20, -22, -42, -20, -10, -5, -2, -20, -23, -44, -29, -51, -23, -15, -22, -18, -50, -64],
      [-14, -21, -11, -8, -7, -9, -17, -24, -8, -4, 7, -12, -3, -13, -4, -14, 2, -8, 0, -1, -2, 6, 0, 4, -3, 9, 12, 9, 14, 10, 3, 2, -6, 3, 13, 19, 7, 10, -3, -9, -12, -3, 8, 10, 13, 3, -7, -15, -14, -18, -7, -1, 4, -9, -15, -27, -23, -9, -23, -5, -9, -16, -5, -17],
      [13, 10, 18, 15, 12, 12, 8, 5, 11, 13, 13, 11, -3, 3, 8, 3, 7, 7, 7, 5, 4, -3, -5, -3, 4, 3, 13, 1, 2, 1, -1, 2, 3, 5, 8, 4, -5, -6, -8, -11, -4, 0, -5, -1, -7, -12, -8, -16, -6, -6, 0, 2, -9, -9, -11, -3, -9, 2, 3, -1, -5, -13, 4, -20],
      [-9, 22, 22, 27, 27, 19, 10, 20, -17, 20, 32, 41, 58, 25, 30, 0, -20, 6, 9, 49, 47, 35, 19, 9, 3, 22, 24, 45, 57, 40, 57, 36, -18, 28, 19, 47, 31, 34, 39, 23, -16, -27, 15, 6, 9, 17, 10, 5, -22, -23, -30, -16, -16, -23, -36, -32, -33, -28, -22, -43, -5, -32, -20, -41],
      [-74, -35, -18, -18, -11, 15, 4, -17, -12, 17, 14, 17, 17, 38, 23, 11, 10, 17, 23, 15, 20, 45, 44, 13, -8, 22, 24, 27, 23, 36, 33, 3, -18, -4, 21, 24, 27, 23, 9, -11, -19, -3, 11, 21, 23, 16, 7, -9, -27, -11, 4, 13, 14, 4, -5, -17, -53, -34, -21, -11, -28, -14, -24, -43]];

    // Board: 0x88 squares (row * 16 + file, row 0 is rank 8). White pieces 1..6 (P N B R Q K), black 9..14.
    const board = new Int8Array(128), cnt = new Int8Array(16), king = [0, 0];
    const PMG = new Int16Array(16 * 128), PEG = new Int16Array(16 * 128);
    for (let t = 1; t <= 6; t++) for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = r * 16 + f, w = r * 8 + f, b = (7 - r) * 8 + f;
      PMG[t * 128 + sq] = MGV[t] + MG[t - 1][w]; PEG[t * 128 + sq] = EGV[t] + EG[t - 1][w];
      PMG[(t | 8) * 128 + sq] = MGV[t] + MG[t - 1][b]; PEG[(t | 8) * 128 + sq] = EGV[t] + EG[t - 1][b];
    }
    // Position keys: two 32-bit halves from a fixed-seed generator, so runs are repeatable.
    let seed = 0x9e3779b9;
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
    const fill = (n) => { const a = new Int32Array(n); for (let i = 0; i < n; i++) a[i] = rnd(); return a; };
    const ZL = fill(16 * 128), ZH = fill(16 * 128), ZCL = fill(16), ZCH = fill(16), ZEL = fill(128), ZEH = fill(128), ZSL = rnd(), ZSH = rnd();
    const NO = [-33, -31, -18, -14, 14, 18, 31, 33], KO = [-17, -16, -15, -1, 1, 15, 16, 17], DI = [-17, -15, 15, 17], OR = [-16, -1, 1, 16];
    const CM = new Int8Array(128).fill(15); CM[116] = 12; CM[119] = 14; CM[112] = 13; CM[4] = 3; CM[7] = 11; CM[0] = 7;

    let side = 0, castle = 0, ep = -1, half = 0, hp = 0, hLo = 0, hHi = 0, mg0 = 0, mg1 = 0, eg0 = 0, eg1 = 0, phase = 0;
    const STK = 2048, sCas = new Int8Array(STK), sEp = new Int16Array(STK), sHalf = new Int16Array(STK), sLo = new Int32Array(STK), sHi = new Int32Array(STK);
    const ML = new Int32Array(MAXPLY * 256), MS = new Int32Array(MAXPLY * 256), killer = new Int32Array(MAXPLY * 2), hist = new Int32Array(16 * 128);
    const TTN = 1 << 20, TTM = TTN - 1, ttHi = new Int32Array(TTN), ttMove = new Int32Array(TTN), ttScore = new Int16Array(TTN), ttDepth = new Int8Array(TTN), ttFlag = new Int8Array(TTN);
    let nodes = 0, stop = false, deadline = 0, nodeCap = 0;
    const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();

    function add(pc, sq) {
      board[sq] = pc; cnt[pc]++; hLo ^= ZL[pc * 128 + sq]; hHi ^= ZH[pc * 128 + sq]; phase += PH[pc & 7];
      if (pc < 8) { mg0 += PMG[pc * 128 + sq]; eg0 += PEG[pc * 128 + sq]; } else { mg1 += PMG[pc * 128 + sq]; eg1 += PEG[pc * 128 + sq]; }
      if ((pc & 7) === 6) king[pc >> 3] = sq;
    }
    function rem(sq) {
      const pc = board[sq];
      board[sq] = 0; cnt[pc]--; hLo ^= ZL[pc * 128 + sq]; hHi ^= ZH[pc * 128 + sq]; phase -= PH[pc & 7];
      if (pc < 8) { mg0 -= PMG[pc * 128 + sq]; eg0 -= PEG[pc * 128 + sq]; } else { mg1 -= PMG[pc * 128 + sq]; eg1 -= PEG[pc * 128 + sq]; }
    }
    const name = (sq) => 'abcdefgh'[sq & 7] + (8 - (sq >> 4));
    const uci = (m) => name(m & 127) + name((m >> 7) & 127) + ' pnbrq'[(m >> 18) & 7].trim();

    function attacked(sq, by) {
      const b8 = by << 3;
      if (by === 0) { if ((!((sq + 15) & 0x88) && board[sq + 15] === 1) || (!((sq + 17) & 0x88) && board[sq + 17] === 1)) return true; }
      else if ((!((sq - 15) & 0x88) && board[sq - 15] === 9) || (!((sq - 17) & 0x88) && board[sq - 17] === 9)) return true;
      for (let i = 0; i < 8; i++) {
        let s = sq + NO[i]; if (!(s & 0x88) && board[s] === (2 | b8)) return true;
        s = sq + KO[i]; if (!(s & 0x88) && board[s] === (6 | b8)) return true;
      }
      for (let i = 0; i < 4; i++) {
        let d = DI[i], s = sq + d;
        while (!(s & 0x88)) { const p = board[s]; if (p) { if (p === (3 | b8) || p === (5 | b8)) return true; break; } s += d; }
        d = OR[i]; s = sq + d;
        while (!(s & 0x88)) { const p = board[s]; if (p) { if (p === (4 | b8) || p === (5 | b8)) return true; break; } s += d; }
      }
      return false;
    }

    // A move is one integer: from | to << 7 | captured piece << 14 | promotion type << 18 | flag << 21.
    // Flags: 1 en passant, 2 castling, 3 pawn double step.
    function gen(base, capsOnly) {
      let n = base;
      const c = side, c8 = c << 3;
      for (let sq = 0; sq < 120; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const pc = board[sq];
        if (!pc || (pc >> 3) !== c) continue;
        const t = pc & 7;
        if (t === 1) {
          const d = c ? 16 : -16, to = sq + d, last = (to >> 4) === (c ? 7 : 0);
          if (!board[to]) {
            if (last) { ML[n++] = sq | to << 7 | 5 << 18; if (!capsOnly) { ML[n++] = sq | to << 7 | 4 << 18; ML[n++] = sq | to << 7 | 3 << 18; ML[n++] = sq | to << 7 | 2 << 18; } }
            else if (!capsOnly) { ML[n++] = sq | to << 7; if ((sq >> 4) === (c ? 1 : 6) && !board[to + d]) ML[n++] = sq | (to + d) << 7 | 3 << 21; }
          }
          for (let k = -1; k <= 1; k += 2) {
            const x = to + k;
            if (x & 0x88) continue;
            const q = board[x];
            if (q && (q >> 3) !== c) {
              if (last) { ML[n++] = sq | x << 7 | q << 14 | 5 << 18; if (!capsOnly) { ML[n++] = sq | x << 7 | q << 14 | 4 << 18; ML[n++] = sq | x << 7 | q << 14 | 3 << 18; ML[n++] = sq | x << 7 | q << 14 | 2 << 18; } }
              else ML[n++] = sq | x << 7 | q << 14;
            } else if (x === ep) ML[n++] = sq | x << 7 | (c ? 1 : 9) << 14 | 1 << 21;
          }
        } else if (t === 2 || t === 6) {
          const off = t === 2 ? NO : KO;
          for (let i = 0; i < 8; i++) {
            const to = sq + off[i];
            if (to & 0x88) continue;
            const q = board[to];
            if (!q) { if (!capsOnly) ML[n++] = sq | to << 7; } else if ((q >> 3) !== c) ML[n++] = sq | to << 7 | q << 14;
          }
          if (t === 6 && !capsOnly && sq === (c ? 4 : 116) && (castle & (c ? 12 : 3))) {
            if ((castle & (c ? 4 : 1)) && !board[sq + 1] && !board[sq + 2] && board[sq + 3] === (4 | c8) && !attacked(sq, c ^ 1) && !attacked(sq + 1, c ^ 1)) ML[n++] = sq | (sq + 2) << 7 | 2 << 21;
            if ((castle & (c ? 8 : 2)) && !board[sq - 1] && !board[sq - 2] && !board[sq - 3] && board[sq - 4] === (4 | c8) && !attacked(sq, c ^ 1) && !attacked(sq - 1, c ^ 1)) ML[n++] = sq | (sq - 2) << 7 | 2 << 21;
          }
        } else {
          const i0 = t === 4 ? 4 : 0, i1 = t === 3 ? 4 : 8;
          for (let i = i0; i < i1; i++) {
            const d = i < 4 ? DI[i] : OR[i - 4];
            let to = sq + d;
            while (!(to & 0x88)) {
              const q = board[to];
              if (!q) { if (!capsOnly) ML[n++] = sq | to << 7; } else { if ((q >> 3) !== c) ML[n++] = sq | to << 7 | q << 14; break; }
              to += d;
            }
          }
        }
      }
      return n - base;
    }

    function make(m) {
      const from = m & 127, to = (m >> 7) & 127, cap = (m >> 14) & 15, pro = (m >> 18) & 7, fl = (m >> 21) & 3;
      const pc = board[from], c = pc >> 3;
      sCas[hp] = castle; sEp[hp] = ep; sHalf[hp] = half; sLo[hp] = hLo; sHi[hp] = hHi; hp++;
      if (ep >= 0) { hLo ^= ZEL[ep]; hHi ^= ZEH[ep]; }
      hLo ^= ZCL[castle]; hHi ^= ZCH[castle];
      rem(from);
      if (cap) rem(fl === 1 ? to + (c ? -16 : 16) : to);
      add(pro ? pro | (c << 3) : pc, to);
      if (fl === 2) { if (to > from) { const r = board[to + 1]; rem(to + 1); add(r, to - 1); } else { const r = board[to - 2]; rem(to - 2); add(r, to + 1); } }
      ep = fl === 3 ? (from + to) >> 1 : -1;
      castle &= CM[from] & CM[to];
      half = cap || (pc & 7) === 1 ? 0 : half + 1;
      if (ep >= 0) { hLo ^= ZEL[ep]; hHi ^= ZEH[ep]; }
      hLo ^= ZCL[castle] ^ ZSL; hHi ^= ZCH[castle] ^ ZSH;
      side ^= 1;
    }
    function unmake(m) {
      const from = m & 127, to = (m >> 7) & 127, cap = (m >> 14) & 15, pro = (m >> 18) & 7, fl = (m >> 21) & 3;
      side ^= 1; hp--;
      const c = side, pc = board[to];
      rem(to);
      if (fl === 2) { if (to > from) { const r = board[to - 1]; rem(to - 1); add(r, to + 1); } else { const r = board[to + 1]; rem(to + 1); add(r, to - 2); } }
      add(pro ? 1 | (c << 3) : pc, from);
      if (cap) add(cap, fl === 1 ? to + (c ? -16 : 16) : to);
      castle = sCas[hp]; ep = sEp[hp]; half = sHalf[hp]; hLo = sLo[hp]; hHi = sHi[hp];
    }
    function makeNull() {
      sCas[hp] = castle; sEp[hp] = ep; sHalf[hp] = half; sLo[hp] = hLo; sHi[hp] = hHi; hp++;
      if (ep >= 0) { hLo ^= ZEL[ep]; hHi ^= ZEH[ep]; ep = -1; }
      hLo ^= ZSL; hHi ^= ZSH; half++; side ^= 1;
    }
    function unmakeNull() { side ^= 1; hp--; ep = sEp[hp]; half = sHalf[hp]; hLo = sLo[hp]; hHi = sHi[hp]; }
    // After make(), the side that just moved must not have left its own king attacked.
    const illegal = () => attacked(king[side ^ 1], side);

    function evaluate() {
      const ph = phase > 24 ? 24 : phase;
      let s = ((mg0 - mg1) * ph + (eg0 - eg1) * (24 - ph)) / 24 | 0;
      if (cnt[3] > 1) s += 30;
      if (cnt[11] > 1) s -= 30;
      return (side ? -s : s) + 10;
    }
    function repeated() {
      for (let i = hp - 2, n = half; n >= 2 && i >= 0; i -= 2, n -= 2) if (sLo[i] === hLo && sHi[i] === hHi) return true;
      return false;
    }
    function pick(base, n, i) {
      let b = i, bs = MS[base + i];
      for (let j = i + 1; j < n; j++) if (MS[base + j] > bs) { bs = MS[base + j]; b = j; }
      if (b !== i) { const m = ML[base + i], s = MS[base + i]; ML[base + i] = ML[base + b]; MS[base + i] = MS[base + b]; ML[base + b] = m; MS[base + b] = s; }
      return ML[base + i];
    }

    // Quiet-position search: only captures and queen promotions, so the evaluation is never taken mid-exchange.
    function qs(alpha, beta, ply) {
      nodes++;
      const stand = evaluate();
      if (ply >= MAXPLY - 1 || stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      let best = stand;
      const base = ply * 256, n = gen(base, true);
      for (let i = 0; i < n; i++) { const m = ML[base + i]; MS[base + i] = VAL[(m >> 14) & 7] * 16 - VAL[board[m & 127] & 7] + ((m >> 18) & 7 ? 14400 : 0); }
      for (let i = 0; i < n; i++) {
        const m = pick(base, n, i);
        if (!((m >> 18) & 7) && stand + VAL[(m >> 14) & 7] + 200 < alpha) continue;
        make(m);
        if (illegal()) { unmake(m); continue; }
        const s = -qs(-beta, -alpha, ply + 1);
        unmake(m);
        if (s > best) { best = s; if (s > alpha) { alpha = s; if (s >= beta) break; } }
      }
      return best;
    }

    function ab(depth, alpha, beta, ply, canNull) {
      if ((++nodes & 2047) === 0 && (now() > deadline || (nodeCap && nodes > nodeCap))) stop = true;
      if (stop) return 0;
      if (half >= 100 || repeated()) return 0;
      if (alpha < -MATE + ply) alpha = -MATE + ply;
      if (beta > MATE - ply - 1) beta = MATE - ply - 1;
      if (alpha >= beta) return alpha;
      const chk = attacked(king[side], side ^ 1);
      if (chk) depth++;
      if (depth <= 0) return qs(alpha, beta, ply);
      if (ply >= MAXPLY - 1) return evaluate();
      const idx = hLo & TTM;
      let ttm = 0;
      if (ttHi[idx] === hHi) {
        ttm = ttMove[idx];
        if (ttDepth[idx] >= depth) {
          let s = ttScore[idx];
          if (s > MATE - 200) s -= ply; else if (s < -MATE + 200) s += ply;
          const f = ttFlag[idx];
          if (f === 0 || (f === 1 && s >= beta) || (f === 2 && s <= alpha)) return s;
        }
      }
      if (!chk && beta - alpha === 1) {
        const ev = evaluate();
        if (depth <= 3 && ev - 110 * depth >= beta && beta > -MATE + 200) return ev;
        if (canNull && depth >= 3 && ev >= beta && cnt[2 | side << 3] + cnt[3 | side << 3] + cnt[4 | side << 3] + cnt[5 | side << 3] > 0) {
          makeNull();
          const s = -ab(depth - (depth > 6 ? 4 : 3), -beta, -beta + 1, ply + 1, false);
          unmakeNull();
          if (stop) return 0;
          if (s >= beta) return s > MATE - 200 ? beta : s;
        }
      }
      const base = ply * 256, n = gen(base, false), k0 = killer[ply * 2], k1 = killer[ply * 2 + 1];
      for (let i = 0; i < n; i++) {
        const m = ML[base + i], cap = (m >> 14) & 7, pro = (m >> 18) & 7;
        MS[base + i] = m === ttm ? 1 << 30 : cap || pro ? (1 << 24) + VAL[cap] * 16 - VAL[board[m & 127] & 7] + VAL[pro] * 16
          : m === k0 ? 1 << 23 : m === k1 ? (1 << 23) - 1 : hist[board[m & 127] * 128 + ((m >> 7) & 127)];
      }
      let best = -INF, bestM = 0, legal = 0;
      const a0 = alpha;
      for (let i = 0; i < n; i++) {
        const m = pick(base, n, i);
        make(m);
        if (illegal()) { unmake(m); continue; }
        legal++;
        const quiet = !((m >> 14) & 15) && !((m >> 18) & 7);
        let s;
        if (legal === 1) s = -ab(depth - 1, -beta, -alpha, ply + 1, true);
        else {
          // late quiet moves get a shallower look first, and a full one only if they surprise
          const r = depth >= 3 && legal > 3 && quiet && !chk ? (legal > 10 && depth > 4 ? 2 : 1) : 0;
          s = -ab(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
          if (s > alpha && r) s = -ab(depth - 1, -alpha - 1, -alpha, ply + 1, true);
          if (s > alpha && s < beta) s = -ab(depth - 1, -beta, -alpha, ply + 1, true);
        }
        unmake(m);
        if (stop) return 0;
        if (s > best) {
          best = s; bestM = m;
          if (s > alpha) {
            alpha = s;
            if (s >= beta) {
              if (quiet) {
                if (killer[ply * 2] !== m) { killer[ply * 2 + 1] = killer[ply * 2]; killer[ply * 2] = m; }
                const h = board[m & 127] * 128 + ((m >> 7) & 127);
                hist[h] += depth * depth; if (hist[h] > 1 << 22) for (let j = 0; j < hist.length; j++) hist[j] >>= 1;
              }
              break;
            }
          }
        }
      }
      if (!legal) return chk ? -MATE + ply : 0;
      ttHi[idx] = hHi; ttMove[idx] = bestM; ttDepth[idx] = depth; ttFlag[idx] = best >= beta ? 1 : best > a0 ? 0 : 2;
      ttScore[idx] = best > MATE - 200 ? best + ply : best < -MATE + 200 ? best - ply : best;
      return best;
    }

    function rootMoves() {
      const n = gen(0, false), out = [];
      for (let i = 0; i < n; i++) { const m = ML[i]; make(m); if (!illegal()) out.push(m); unmake(m); }
      return out;
    }
    function begin(o) { nodes = 0; stop = false; deadline = now() + (o.ms || 1e9); nodeCap = o.nodes || 0; killer.fill(0); for (let j = 0; j < hist.length; j++) hist[j] >>= 3; }
    // Scores are reported in centipawns for the side to move; a forced mate as mate: N (in moves, negative if being mated).
    const report = (s) => (s > MATE - 200 ? { cp: 10000 - (MATE - s), mate: (MATE - s + 1) >> 1 } : s < -MATE + 200 ? { cp: -10000 + (MATE + s), mate: -((MATE + s + 1) >> 1) } : { cp: s });

    // Strongest play: best move within a time, depth or node limit.
    function best(o) {
      begin(o);
      const list = rootMoves().map((m) => ({ m, s: 0 }));
      let out = null;
      if (!list.length) return { best: null, depth: 0, nodes: 0 };
      for (let d = 1; d <= (o.depth || 64); d++) {
        let alpha = -INF, bm = null;
        for (let i = 0; i < list.length; i++) {
          const x = list[i];
          make(x.m);
          let s;
          if (i === 0) s = -ab(d - 1, -INF, -alpha, 1, true);
          else { s = -ab(d - 1, -alpha - 1, -alpha, 1, true); if (s > alpha && !stop) s = -ab(d - 1, -INF, -alpha, 1, true); }
          unmake(x.m);
          if (stop) break;
          x.s = s;
          if (s > alpha) { alpha = s; bm = x; }
        }
        // a cut-short pass still counts if it already found something better than the last full pass's choice
        if (bm && (!stop || bm !== list[0])) out = Object.assign({ best: uci(bm.m), depth: d }, report(alpha));
        if (bm) { list.splice(list.indexOf(bm), 1); list.unshift(bm); }
        if (stop || alpha > MATE - 200 || list.length === 1) break;
      }
      if (!out) out = Object.assign({ best: uci(list[0].m), depth: 0 }, report(0));
      out.nodes = nodes;
      return out;
    }
    // Every legal move with its own score and the expected reply. Moves worse than the best by more than
    // `margin` only get a ceiling ("at least this bad"), which is all a coach or a weak opponent needs.
    function all(o) {
      begin(o);
      const margin = o.margin || 700;
      let list = rootMoves().map((m) => ({ m, s: 0, r: 0 })), depth = 0;
      for (let d = 1; d <= (o.depth || 8) && list.length; d++) {
        const lo = d > 1 ? list[0].s - margin : -INF, got = [], keep = deadline;
        if (d === 1) { deadline = now() + 1e9; nodeCap = 0; }   // the first pass always finishes
        for (const x of list) {
          make(x.m);
          const s = -ab(d - 1, -INF, -lo, 1, true), i = hLo & TTM, r = ttHi[i] === hHi ? ttMove[i] : 0;
          unmake(x.m);
          if (stop) break;
          got.push({ m: x.m, s, r });
        }
        deadline = keep; nodeCap = o.nodes || 0;
        if (stop) break;
        got.sort((a, b) => b.s - a.s);
        list = got; depth = d;
        if (list[0].s > MATE - 200 && d >= 3) break;
      }
      return { depth, nodes, moves: list.map((x) => Object.assign({ uci: uci(x.m), reply: x.r ? uci(x.r) : null }, report(x.s))) };
    }

    function setFen(fen) {
      const p = fen.trim().split(/\s+/);
      board.fill(0); cnt.fill(0); hLo = hHi = mg0 = mg1 = eg0 = eg1 = phase = 0; hp = 0;
      p[0].split('/').forEach((row, r) => {
        let f = 0;
        for (const ch of row) { if (ch >= '1' && ch <= '8') f += +ch; else { add(' pnbrqk'.indexOf(ch.toLowerCase()) | (ch === ch.toLowerCase() ? 8 : 0), r * 16 + f); f++; } }
      });
      side = p[1] === 'b' ? 1 : 0;
      castle = 0; for (const ch of p[2] || '-') castle |= { K: 1, Q: 2, k: 4, q: 8 }[ch] || 0;
      ep = !p[3] || p[3] === '-' ? -1 : (8 - +p[3][1]) * 16 + 'abcdefgh'.indexOf(p[3][0]);
      half = +p[4] || 0;
      if (ep >= 0) { hLo ^= ZEL[ep]; hHi ^= ZEH[ep]; }
      hLo ^= ZCL[castle]; hHi ^= ZCH[castle];
      if (side) { hLo ^= ZSL; hHi ^= ZSH; }
    }
    // Set up a position from a starting FEN plus the moves played since, so repeated positions are known.
    function set(fen, line) {
      setFen(fen);
      for (const u of line || []) { const m = rootMoves().find((x) => uci(x) === u); if (!m) throw new Error('bad move ' + u); make(m); }
    }
    function perft(d) {
      if (d === 0) return 1;
      const base = (MAXPLY - 1 - d) * 256, n = gen(base, false);
      let c = 0;
      for (let i = 0; i < n; i++) { const m = ML[base + i]; make(m); if (!illegal()) c += perft(d - 1); unmake(m); }
      return c;
    }
    function run(q) { set(q.fen, q.line); return q.mode === 'all' ? all(q) : best(q); }
    function clear() { ttHi.fill(0); ttMove.fill(0); ttDepth.fill(0); hist.fill(0); }
    return { set, best, all, perft, run, clear, moves: () => rootMoves().map(uci) };
  }
  // In a worker: one engine per caller, so the coach's deeper look never leaks into a weak opponent's memory.
  function SERVE(make, scope) {
    const eng = {};
    scope.onmessage = (e) => {
      const q = e.data;
      let out;
      try { out = (eng[q.who] || (eng[q.who] = make())).run(q); } catch (err) { out = { error: String(err) }; }
      out.id = q.id; scope.postMessage(out);
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
  else {
    root.BC = root.BC || {};
    root.BC.Engine = ENGINE;
    root.BC.engineSource = '(' + SERVE.toString() + ')(' + ENGINE.toString() + ', self)';
  }
})(typeof window !== 'undefined' ? window : globalThis);
