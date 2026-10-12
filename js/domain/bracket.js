/* Турнирная сетка (олимпийская система).
   Бой: { n, round, a, b, winner }
     n      — номер боя внутри категории (ID = буква категории + n, например A3)
     round  — 1, 2, 3 …
     a, b   — источники участников: { p: participantId } или { f: номер боя } (победитель этого боя) или null
              a — красный (ака), b — белый (сиро)
     winner — id победителя или null */
(function (K) {

  /* Автоматически строим сетку. Пары подбираются по весу (соседи после сортировки).
     При нечётном числе самый тяжёлый сразу проходит во второй круг.
     Дальше структура строится целиком, но заполняется по мере выбора победителей. */
  function generate(participants) {
    const sorted = participants.slice().sort((x, y) => (x.weight ?? 999) - (y.weight ?? 999));
    const fights = [];
    if (sorted.length < 2) return fights;

    let sources = [];
    let bye = null;
    let pool = sorted;
    if (sorted.length % 2 === 1) { bye = sorted[sorted.length - 1]; pool = sorted.slice(0, -1); }
    for (let i = 0; i < pool.length; i += 2) {
      const f = { n: fights.length + 1, round: 1, a: { p: pool[i].id }, b: { p: pool[i + 1].id }, winner: null };
      fights.push(f);
      sources.push({ f: f.n });
    }
    if (bye) sources.push({ p: bye.id });

    // Следующие круги. Если число нечётное, без боя проходит верхний,
    // чтобы самый тяжёлый (он внизу) точно дрался во втором круге.
    let round = 2;
    while (sources.length > 1) {
      const next = [];
      let i = 0;
      if (sources.length % 2 === 1) { next.push(sources[0]); i = 1; }
      for (; i < sources.length; i += 2) {
        const f = { n: fights.length + 1, round, a: sources[i], b: sources[i + 1], winner: null };
        fights.push(f);
        next.push({ f: f.n });
      }
      sources = next;
      round++;
    }
    return fights;
  }

  const fight = (cat, n) => cat.fights.find(f => f.n === n);
  const roundsCount = cat => cat.fights.reduce((m, f) => Math.max(m, f.round), 0);

  // Кто стоит в слоте: id участника или null (ещё не известен)
  function resolve(cat, src) {
    if (!src) return null;
    if (src.p) return src.p;
    const f = fight(cat, src.f);
    return f ? f.winner : null;
  }

  function roundLabel(cat, round) {
    const k = roundsCount(cat) - round;
    if (k === 0) return 'Финал';
    if (k === 1) return 'Полуфинал';
    return `1/${2 ** k} финала`;
  }

  const code = (cat, n) => `${cat.letter}${n}`;

  // Бой, в который уходит победитель боя n
  const parentOf = (cat, n) => cat.fights.find(f => (f.a && f.a.f === n) || (f.b && f.b.f === n));

  // Сбрасываем результаты выше по сетке, если победитель поменялся
  function clearUpstream(cat, n, oldWinner) {
    const parent = parentOf(cat, n);
    if (!parent || !oldWinner) return;
    if (parent.winner === oldWinner) {
      parent.winner = null;
      clearUpstream(cat, parent.n, oldWinner);
    }
  }

  function setWinner(cat, n, pid) {
    const f = fight(cat, n);
    if (!f) return;
    const old = f.winner;
    if (old === pid) return;
    f.winner = pid;
    clearUpstream(cat, n, old);
  }

  function clearWinner(cat, n) {
    const f = fight(cat, n);
    if (!f || !f.winner) return;
    const old = f.winner;
    f.winner = null;
    clearUpstream(cat, n, old);
  }

  // Ручная правка: меняем местами двух участников, стоящих в сетке напрямую
  function canEdit(cat, pid) {
    return cat.fights.some(f => ((f.a && f.a.p === pid) || (f.b && f.b.p === pid)) && !f.winner);
  }
  function swap(cat, p1, p2) {
    if (p1 === p2) return false;
    if (!canEdit(cat, p1) || !canEdit(cat, p2)) return false;
    for (const f of cat.fights) {
      for (const side of ['a', 'b']) {
        const s = f[side];
        if (!s || !s.p) continue;
        if (s.p === p1) f[side] = { p: p2 };
        else if (s.p === p2) f[side] = { p: p1 };
      }
    }
    return true;
  }

  const finalFight = cat => cat.fights.find(f => !parentOf(cat, f.n));
  function champion(cat) {
    if (cat.fights.length === 0) return cat.participantIds.length === 1 ? cat.participantIds[0] : null;
    const f = finalFight(cat);
    return f ? f.winner : null;
  }
  const isDone = cat => !!champion(cat) && cat.participantIds.length > 1;
  const doneCount = cat => cat.fights.filter(f => f.winner).length;
  const hasResults = cat => cat.fights.some(f => f.winner);

  // Бой можно проводить, когда известны оба участника
  const isReady = (cat, f) => !!(resolve(cat, f.a) && resolve(cat, f.b));

  K.bracket = {
    generate, fight, resolve, roundsCount, roundLabel, code, parentOf, setWinner, clearWinner,
    canEdit, swap, finalFight, champion, isDone, doneCount, hasResults, isReady,
  };
})(window.K);
