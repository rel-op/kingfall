// Chess rules: move generation, check, castling, en passant, promotion, draws.
// No rendering here, so it also runs under Node for the perft test.
(function (root) {
  'use strict';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const N_OFF = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const K_OFF = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const FILES = 'abcdefgh';

  // Square index: row 0 is black's back rank (rank 8), file 0 is the a-file.
  function sqName(sq) { return FILES[sq & 7] + (8 - (sq >> 3)); }
  function sqFromName(n) { return (8 - +n[1]) * 8 + FILES.indexOf(n[0]); }

  function fromFEN(fen) {
    const parts = fen.trim().split(/\s+/);
    const board = new Array(64).fill(null);
    let id = 1;
    parts[0].split('/').forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        if (ch >= '1' && ch <= '8') f += +ch;
        else {
          board[r * 8 + f] = { t: ch.toLowerCase(), c: ch === ch.toLowerCase() ? 1 : 0, id: id++ };
          f++;
        }
      }
    });
    const S = {
      board,
      turn: parts[1] === 'b' ? 1 : 0,
      castle: !parts[2] || parts[2] === '-' ? '' : parts[2],
      ep: !parts[3] || parts[3] === '-' ? -1 : sqFromName(parts[3]),
      half: +parts[4] || 0,
      full: +parts[5] || 1,
      reps: {},
    };
    S.reps[posKey(S)] = 1;
    return S;
  }

  function newGame() { return fromFEN(START_FEN); }

  function boardString(S) {
    let s = '';
    for (let i = 0; i < 64; i++) {
      const p = S.board[i];
      s += p ? (p.c === 0 ? p.t.toUpperCase() : p.t) : '.';
    }
    return s;
  }

  function posKey(S) { return boardString(S) + S.turn + S.castle + S.ep; }

  function attacked(S, sq, by) {
    const b = S.board, r = sq >> 3, f = sq & 7;
    // A pawn of colour `by` sits one row "behind" the square from its own point of view.
    const pr = r + (by === 0 ? 1 : -1);
    if (pr >= 0 && pr < 8) {
      for (const df of [-1, 1]) {
        const pf = f + df;
        if (pf < 0 || pf > 7) continue;
        const p = b[pr * 8 + pf];
        if (p && p.c === by && p.t === 'p') return true;
      }
    }
    for (const [dr, df] of N_OFF) {
      const nr = r + dr, nf = f + df;
      if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;
      const p = b[nr * 8 + nf];
      if (p && p.c === by && p.t === 'n') return true;
    }
    for (const [dr, df] of K_OFF) {
      const nr = r + dr, nf = f + df;
      if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;
      const p = b[nr * 8 + nf];
      if (p && p.c === by && p.t === 'k') return true;
    }
    for (let d = 0; d < 8; d++) {
      const diag = d < 4;
      const [dr, df] = diag ? DIAG[d] : ORTH[d - 4];
      let nr = r + dr, nf = f + df;
      while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
        const p = b[nr * 8 + nf];
        if (p) {
          if (p.c === by && (p.t === 'q' || p.t === (diag ? 'b' : 'r'))) return true;
          break;
        }
        nr += dr; nf += df;
      }
    }
    return false;
  }

  function kingSq(S, c) {
    for (let i = 0; i < 64; i++) { const p = S.board[i]; if (p && p.t === 'k' && p.c === c) return i; }
    return -1;
  }

  function inCheck(S, c) {
    const k = kingSq(S, c);
    return k >= 0 && attacked(S, k, c ^ 1);
  }

  function pseudo(S) {
    const out = [], b = S.board, c = S.turn;
    const add = (from, to, p, extra) => {
      const target = b[to];
      const m = { from, to, p, c, cap: target ? target.t : null, capSq: target ? to : -1, promo: null, flag: null };
      if (extra) Object.assign(m, extra);
      out.push(m);
    };
    for (let sq = 0; sq < 64; sq++) {
      const pc = b[sq];
      if (!pc || pc.c !== c) continue;
      const r = sq >> 3, f = sq & 7;
      if (pc.t === 'p') {
        const dir = c === 0 ? -1 : 1, startR = c === 0 ? 6 : 1, promoR = c === 0 ? 0 : 7;
        const addPawn = (to, extra) => {
          if ((to >> 3) === promoR) for (const pr of ['q', 'r', 'b', 'n']) add(sq, to, 'p', Object.assign({ promo: pr }, extra));
          else add(sq, to, 'p', extra);
        };
        const one = (r + dir) * 8 + f;
        if (!b[one]) {
          addPawn(one);
          if (r === startR && !b[one + dir * 8]) add(sq, one + dir * 8, 'p', { flag: 'dbl' });
        }
        for (const df of [-1, 1]) {
          const nf = f + df;
          if (nf < 0 || nf > 7) continue;
          const to = (r + dir) * 8 + nf, q = b[to];
          if (q && q.c !== c) addPawn(to);
          else if (!q && to === S.ep) add(sq, to, 'p', { flag: 'ep', cap: 'p', capSq: r * 8 + nf });
        }
      } else if (pc.t === 'n' || pc.t === 'k') {
        for (const [dr, df] of pc.t === 'n' ? N_OFF : K_OFF) {
          const nr = r + dr, nf = f + df;
          if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;
          const q = b[nr * 8 + nf];
          if (!q || q.c !== c) add(sq, nr * 8 + nf, pc.t);
        }
        if (pc.t === 'k') {
          const home = c === 0 ? 60 : 4;
          if (sq === home && !attacked(S, home, c ^ 1)) {
            const kr = c === 0 ? 'K' : 'k', qr = c === 0 ? 'Q' : 'q';
            const rookAt = (s) => b[s] && b[s].t === 'r' && b[s].c === c;
            if (S.castle.includes(kr) && !b[home + 1] && !b[home + 2] && rookAt(home + 3) &&
              !attacked(S, home + 1, c ^ 1) && !attacked(S, home + 2, c ^ 1)) add(sq, home + 2, 'k', { flag: 'ck' });
            if (S.castle.includes(qr) && !b[home - 1] && !b[home - 2] && !b[home - 3] && rookAt(home - 4) &&
              !attacked(S, home - 1, c ^ 1) && !attacked(S, home - 2, c ^ 1)) add(sq, home - 2, 'k', { flag: 'cq' });
          }
        }
      } else {
        const dirs = pc.t === 'b' ? DIAG : pc.t === 'r' ? ORTH : K_OFF;
        for (const [dr, df] of dirs) {
          let nr = r + dr, nf = f + df;
          while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
            const q = b[nr * 8 + nf];
            if (!q) add(sq, nr * 8 + nf, pc.t);
            else { if (q.c !== c) add(sq, nr * 8 + nf, pc.t); break; }
            nr += dr; nf += df;
          }
        }
      }
    }
    return out;
  }

  function stripRights(cs, sq) {
    if (sq === 56) return cs.replace('Q', '');
    if (sq === 63) return cs.replace('K', '');
    if (sq === 0) return cs.replace('q', '');
    if (sq === 7) return cs.replace('k', '');
    return cs;
  }

  function make(S, m) {
    const b = S.board, p = b[m.from];
    const u = { castle: S.castle, ep: S.ep, half: S.half, full: S.full, cap: null };
    if (m.capSq >= 0) { u.cap = b[m.capSq]; b[m.capSq] = null; }
    b[m.to] = p; b[m.from] = null;
    if (m.promo) p.t = m.promo;
    if (m.flag === 'ck') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
    else if (m.flag === 'cq') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
    S.ep = m.flag === 'dbl' ? (m.from + m.to) >> 1 : -1;
    let cs = S.castle;
    if (cs) {
      if (m.p === 'k') cs = cs.replace(m.c === 0 ? /[KQ]/g : /[kq]/g, '');
      cs = stripRights(stripRights(cs, m.from), m.to);
    }
    S.castle = cs;
    S.half = (m.p === 'p' || u.cap) ? 0 : S.half + 1;
    if (S.turn === 1) S.full++;
    S.turn ^= 1;
    return u;
  }

  function unmake(S, m, u) {
    const b = S.board, p = b[m.to];
    S.turn ^= 1;
    if (m.flag === 'ck') { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = null; }
    else if (m.flag === 'cq') { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = null; }
    if (m.promo) p.t = 'p';
    b[m.from] = p; b[m.to] = null;
    if (m.capSq >= 0) b[m.capSq] = u.cap;
    S.castle = u.castle; S.ep = u.ep; S.half = u.half; S.full = u.full;
  }

  function legalMoves(S) {
    const out = [];
    for (const m of pseudo(S)) {
      const u = make(S, m);
      if (!inCheck(S, S.turn ^ 1)) out.push(m);
      unmake(S, m, u);
    }
    return out;
  }

  // Apply a move for real: also tracks repeated positions for the threefold rule.
  function play(S, m) {
    make(S, m);
    const k = posKey(S);
    S.reps[k] = (S.reps[k] || 0) + 1;
  }

  function insufficient(S) {
    const minor = [];
    for (let i = 0; i < 64; i++) {
      const p = S.board[i];
      if (!p || p.t === 'k') continue;
      if (p.t !== 'b' && p.t !== 'n') return false;
      minor.push({ t: p.t, c: p.c, shade: ((i >> 3) + (i & 7)) & 1 });
    }
    if (minor.length <= 1) return true;
    return minor.every((x) => x.t === 'b' && x.shade === minor[0].shade);
  }

  function status(S) {
    const moves = legalMoves(S);
    if (!moves.length) return inCheck(S, S.turn) ? 'checkmate' : 'stalemate';
    if (insufficient(S)) return 'material';
    if (S.half >= 100) return 'fifty';
    if ((S.reps[posKey(S)] || 0) >= 3) return 'repetition';
    return 'playing';
  }

  function san(S, m, legal) {
    let s;
    if (m.flag === 'ck') s = 'O-O';
    else if (m.flag === 'cq') s = 'O-O-O';
    else if (m.p === 'p') {
      s = (m.cap ? FILES[m.from & 7] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
    } else {
      const others = (legal || legalMoves(S)).filter((o) => o.p === m.p && o.to === m.to && o.from !== m.from);
      let dis = '';
      if (others.length) {
        if (!others.some((o) => (o.from & 7) === (m.from & 7))) dis = FILES[m.from & 7];
        else if (!others.some((o) => (o.from >> 3) === (m.from >> 3))) dis = '' + (8 - (m.from >> 3));
        else dis = sqName(m.from);
      }
      s = m.p.toUpperCase() + dis + (m.cap ? 'x' : '') + sqName(m.to);
    }
    const u = make(S, m);
    const chk = inCheck(S, S.turn), none = chk && legalMoves(S).length === 0;
    unmake(S, m, u);
    return s + (chk ? (none ? '#' : '+') : '');
  }

  function perft(S, d) {
    if (d === 0) return 1;
    let n = 0;
    for (const m of legalMoves(S)) { const u = make(S, m); n += perft(S, d - 1); unmake(S, m, u); }
    return n;
  }

  function clone(S) { return JSON.parse(JSON.stringify(S)); }

  const api = { START_FEN, VALUE, sqName, sqFromName, fromFEN, newGame, posKey, attacked, kingSq, inCheck,
    legalMoves, make, unmake, play, status, san, perft, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.BC = root.BC || {}).chess = api;
})(typeof window !== 'undefined' ? window : globalThis);
