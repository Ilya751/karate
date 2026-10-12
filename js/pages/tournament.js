/* Экран турнира: шапка, выбор татами и запуск всех модулей страницы. */
(function (K) {
  const T = K.T; if (!T) return;
  const { db, u } = K;
  const { $ } = u;

  const tt = db.tatami(T.tatamiId);
  document.title = `${tt ? tt.name : 'Татами'} · ${K.categories.DISCIPLINES[T.discipline]}`;
  $('#crumbTournament').textContent = T.tournament.title;
  $('#crumbTournament').title = T.tournament.title;
  $('#crumbDiscipline').textContent = K.categories.DISCIPLINES[T.discipline];
  $('#tatamiName').textContent = tt ? `${tt.blockName} · ${tt.name}` : 'Татами не выбрано';
  $('#importBtn').href = u.url('import.html', { t: T.tournament.id });

  // Переключение татами и дисциплины
  $('#tatamiBtn').onclick = e => {
    e.stopPropagation();
    const go = (d, tatami) => { location.href = u.url('tournament.html', { t: T.tournament.id, d, tatami }); };
    const items = db.tatamis().map(t => ({
      label: `${t.blockName} · ${t.name}`, icon: 'square', active: t.id === T.tatamiId,
      hint: String(db.categoriesOf(T.tournament.id, T.discipline).filter(c => c.tatamiId === t.id).length),
      onClick: () => go(T.discipline, t.id),
    }));
    const other = T.discipline === 'kumite' ? 'kata' : 'kumite';
    items.push('sep', { label: `Перейти в ${K.categories.DISCIPLINES[other].toLowerCase()}`, icon: other === 'kata' ? 'person' : 'swords', onClick: () => go(other, T.tatamiId) });
    u.menu(e.currentTarget, items);
  };

  // Что открыть: из ссылки, иначе то, что было открыто на этом татами, иначе первую категорию
  const p = u.params();
  const saved = T.tatamiId ? K.live.read(T.tatamiId) : null;
  const cats = T.categories();
  let catId = null, fightN = null;
  if (p.cat && cats.some(c => c.id === p.cat)) { catId = p.cat; fightN = +p.fight || null; }
  else if (saved && saved.tournamentId === T.tournament.id && cats.some(c => c.id === saved.categoryId)) { catId = saved.categoryId; fightN = saved.fightN; }
  else if (cats.length) catId = cats[0].id;

  T.selectCategory(catId, fightN);

  // Таймер продолжает идти после перезагрузки страницы
  if (saved && saved.categoryId === T.categoryId && saved.fightN === T.fightN && saved.timer) {
    T.timer = saved.timer;
    T.emit('fight');
    T.emit('timer-state');
  }

  // Данные поменяли в другой вкладке (например, импорт) — перерисовываем
  db.onExternalChange(() => {
    if (T.categoryId && !db.category(T.categoryId)) T.selectCategory((T.categories()[0] || {}).id || null);
    else T.emit('data');
  });

  window.addEventListener('beforeunload', e => {
    if (T.timer && T.timer.running) { e.preventDefault(); e.returnValue = ''; }
  });

})(window.K);
