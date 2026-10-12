/* Экран турнира: общее состояние страницы и простая шина событий между модулями.
   Модули: sidebar.js (категории), bracket-view.js (сетка), control.js (бой, таймер, табло),
   category-modal.js (создание категории и состав участников). */
(function (K) {
  const { db, u } = K;
  db.load();

  const p = u.params();
  const tournament = db.tournament(p.t);
  if (!tournament) { location.replace('index.html'); return; }

  const listeners = {};

  const T = {
    tournament,
    discipline: p.d === 'kata' ? 'kata' : 'kumite',
    tatamiId: db.tatami(p.tatami) ? p.tatami : (db.tatamis()[0] || {}).id || null,
    categoryId: null,
    fightN: null,
    timer: null,

    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    emit(evt, data) { (listeners[evt] || []).forEach(fn => fn(data)); },

    // Категории текущего татами и дисциплины, в порядке букв
    categories() {
      return db.categoriesOf(tournament.id, T.discipline)
        .filter(c => c.tatamiId === T.tatamiId)
        .sort((a, b) => a.letter.length - b.letter.length || a.letter.localeCompare(b.letter));
    },
    category() { return db.category(T.categoryId); },
    fight() { const c = T.category(); return c && T.fightN ? K.bracket.fight(c, T.fightN) : null; },

    selectCategory(id, fightN) {
      T.categoryId = id;
      const c = T.category();
      T.fightN = c ? (fightN || firstOpenFight(c)) : null;
      T.timer = K.live.newTimer(c ? c.fightTime || db.settings.fightTime : db.settings.fightTime);
      T.emit('category');
      T.emit('fight');
    },
    selectFight(n) {
      const c = T.category();
      if (!c || !K.bracket.fight(c, n)) return;
      if (T.timer && T.timer.running && n !== T.fightN && !u.confirmBox('Идёт бой. Переключиться на другой бой и сбросить таймер?')) return;
      T.fightN = n;
      T.timer = K.live.newTimer(c.fightTime || db.settings.fightTime);
      T.emit('fight');
    },

    // Сохранить данные и перерисовать всё, что от них зависит
    commit() { db.save(); T.emit('data'); },
  };

  // Первый бой, где известны оба участника и нет победителя
  function firstOpenFight(c) {
    const f = c.fights.find(f => !f.winner && K.bracket.isReady(c, f)) || c.fights.find(f => !f.winner) || c.fights[0];
    return f ? f.n : null;
  }
  T.firstOpenFight = firstOpenFight;

  K.T = T;
})(window.K);
