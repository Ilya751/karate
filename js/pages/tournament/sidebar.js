/* Левая панель: категории текущего татами. */
(function (K) {
  const T = K.T; if (!T) return;
  const { u } = K;
  const { $, esc } = u;

  const GROUPS = [['M', 'Мужской пол'], ['F', 'Женский пол'], ['', 'Смешанные']];

  function dot(c) {
    if (K.bracket.isDone(c)) return 'done';
    if (c.id === T.categoryId && T.timer && T.timer.running) return 'live';
    if (K.bracket.hasResults(c)) return 'started';
    return '';
  }

  function render() {
    const q = $('#catSearch').value.trim().toLowerCase();
    const cats = T.categories().filter(c => !q || c.name.toLowerCase().includes(q) || c.letter.toLowerCase() === q);
    const list = $('#catList');
    if (!T.categories().length) {
      list.innerHTML = `<div class="empty-state small">
        <p>На этом татами пока нет категорий</p>
        <button class="btn btn-sm btn-primary" data-new>${u.icon('plus', 'icon-sm')}Новая категория</button>
        <a class="btn btn-sm" href="${u.url('import.html', { t: T.tournament.id })}">${u.icon('upload', 'icon-sm')}Импорт участников</a>
      </div>`;
      return;
    }
    list.innerHTML = GROUPS.map(([sex, title]) => {
      const g = cats.filter(c => (c.sex || '') === sex);
      if (!g.length) return '';
      return `<div class="cat-group">${title}</div>` + g.map(c => `
        <div class="cat ${c.id === T.categoryId ? 'on' : ''}" data-cat="${c.id}" title="${esc(c.name)}">
          <span class="cat-dot ${dot(c)}"></span>
          <span class="cat-letter">${esc(c.letter)}</span>
          <span class="cat-name">${esc(c.name)}</span>
          <span class="cat-count">${c.participantIds.length}</span>
        </div>`).join('');
    }).join('') || '<div class="empty-state small"><p>Ничего не нашлось</p></div>';
  }

  $('#catList').addEventListener('click', e => {
    if (e.target.closest('[data-new]')) { T.emit('new-category'); return; }
    const el = e.target.closest('[data-cat]');
    if (!el || el.dataset.cat === T.categoryId) return;
    if (T.timer && T.timer.running && !u.confirmBox('Идёт бой. Перейти в другую категорию и сбросить таймер?')) return;
    T.selectCategory(el.dataset.cat);
  });
  $('#catSearch').addEventListener('input', render);
  $('#newCatBtn').onclick = () => T.emit('new-category');

  T.on('category', render);
  T.on('data', render);
  T.on('timer-state', render);
})(window.K);
