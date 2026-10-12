/* Страница «Турниры»: список, создание и редактирование, выбор дисциплины и татами. */
(function (K) {
  const { db, u } = K;
  const { $, $$, esc, icon, plural } = u;
  db.load();

  const COVERS = ['img/cover-1.svg', 'img/cover-2.svg', 'img/cover-3.svg', 'img/cover-4.svg', 'img/cover-5.svg'];
  let filter = 'all';

  /* ---------- Список ---------- */
  function status(t) {
    const d = u.daysBetween(u.todayISO(), t.date);
    if (d === 0) return { key: 'live', html: '<span class="badge badge-live">Идёт сейчас</span>' };
    if (d > 0) {
      const txt = d === 1 ? 'Завтра' : d < 7 ? `Через ${d} ${plural(d, ['день', 'дня', 'дней'])}`
        : `Через ${Math.round(d / 7)} ${plural(Math.round(d / 7), ['неделю', 'недели', 'недель'])}`;
      return { key: 'soon', html: `<span class="badge badge-soon">${txt}</span>` };
    }
    return { key: 'done', html: '<span class="badge badge-ok">Завершён</span>' };
  }

  function card(t) {
    const st = status(t);
    const people = db.participantsOf(t.id).length;
    const cats = db.categoriesOf(t.id).length;
    return `<article class="card t-card" data-id="${t.id}">
      <div class="t-cover"><img src="${esc(t.cover || COVERS[0])}" alt="">${st.html}
        <button class="btn btn-sm btn-icon t-edit" data-edit="${t.id}" title="Изменить">${icon('pencil', 'icon-sm')}</button></div>
      <div class="t-body">
        <div>
          <div class="t-title">${esc(t.title)}</div>
          ${t.place ? `<div class="t-place">${icon('map-pin', 'icon-sm')}${esc(t.place)}</div>` : ''}
        </div>
        <div class="t-stats">
          <div class="t-stat"><b>${u.fmtDateShort(t.date)}</b><span>${u.fmtYearDay(t.date)}</span></div>
          <div class="t-stat"><b>${people}</b><span>${plural(people, ['участник', 'участника', 'участников'])}</span></div>
          <div class="t-stat"><b>${cats}</b><span>${plural(cats, ['категория', 'категории', 'категорий'])}</span></div>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const q = $('#search').value.trim().toLowerCase();
    const list = db.data.tournaments
      .filter(t => filter === 'all' || status(t).key === filter)
      .filter(t => !q || (t.title + ' ' + (t.place || '')).toLowerCase().includes(q))
      .sort((a, b) => {
        const order = { live: 0, soon: 1, done: 2 };
        const sa = status(a).key, sb = status(b).key;
        return order[sa] - order[sb] || (sa === 'done' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
      });

    const newCard = `<button class="card t-card t-new" id="newCard">
      <span class="t-new-icon">${icon('plus', 'icon-lg')}</span><b>Создать турнир</b>
      <span class="muted" style="font-size:13px">Название, дата, место, обложка</span></button>`;

    if (!db.data.tournaments.length) {
      $('#grid').innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">${icon('trophy', 'icon-lg')}</div>
        <h3>Турниров пока нет</h3>
        <p>Создайте первый турнир или загрузите демо, чтобы посмотреть, как всё работает</p>
        <div style="display:flex;gap:8px;justify-content:center">
          <button class="btn btn-primary" id="emptyNew">${icon('plus')}Создать турнир</button>
          <button class="btn" id="demoBtn">${icon('shuffle')}Загрузить демо-турнир</button>
        </div></div>`;
      $('#emptyNew').onclick = () => openForm();
      $('#demoBtn').onclick = () => { K.demo.seed(); u.toast('Демо-турнир создан'); render(); };
      return;
    }
    $('#grid').innerHTML = list.length ? list.map(card).join('') + newCard
      : `<div class="empty-state" style="grid-column:1/-1"><h3>Ничего не нашлось</h3><p>Попробуйте изменить поиск или фильтр</p></div>`;
    const nc = $('#newCard');
    if (nc) nc.onclick = () => openForm();
  }

  $('#search').addEventListener('input', u.debounce(render, 100));
  $('#filter').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    $$('#filter button').forEach(x => x.classList.toggle('on', x === b));
    filter = b.dataset.f; render();
  });
  $('#grid').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    if (ed) { e.stopPropagation(); openForm(db.tournament(ed.dataset.edit)); return; }
    const c = e.target.closest('.t-card[data-id]');
    if (c) openPicker(db.tournament(c.dataset.id));
  });
  $('#newBtn').onclick = () => openForm();

  /* ---------- Форма турнира ---------- */
  const tModal = $('#tModal'), form = $('#tForm');
  u.bindModal(tModal);
  let editing = null, cover = COVERS[0];

  function renderCovers() {
    const custom = cover && !COVERS.includes(cover) ? cover : null;
    $('#coverPick').innerHTML = COVERS.map(c => `<button type="button" class="cover-opt ${c === cover ? 'on' : ''}" data-cover="${c}"><img src="${c}" alt=""></button>`).join('')
      + (custom ? `<button type="button" class="cover-opt on" data-cover="${esc(custom)}"><img src="${esc(custom)}" alt=""></button>` : '')
      + `<button type="button" class="cover-opt cover-upload" id="coverUp">${icon('upload')}<span>Своя</span></button>`;
  }
  $('#coverPick').addEventListener('click', e => {
    if (e.target.closest('#coverUp')) { $('#coverFile').click(); return; }
    const b = e.target.closest('[data-cover]'); if (!b) return;
    cover = b.dataset.cover; renderCovers();
  });
  $('#coverFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { cover = await u.imageToDataURL(f); renderCovers(); } catch (err) { u.toast('Не удалось открыть картинку', 'err'); }
    e.target.value = '';
  };

  function openForm(t = null) {
    editing = t;
    form.reset();
    $('#tModalTitle').textContent = t ? 'Турнир' : 'Новый турнир';
    form.title.value = t ? t.title : '';
    form.place.value = t ? t.place || '' : '';
    form.date.value = t ? t.date : u.todayISO();
    form.country.value = t ? t.country || '' : db.settings.defaultCountry || '';
    cover = t ? t.cover || COVERS[0] : COVERS[db.data.tournaments.length % COVERS.length];
    $('#tDelete').style.visibility = t ? 'visible' : 'hidden';
    renderCovers();
    u.openModal(tModal);
  }

  form.onsubmit = e => {
    e.preventDefault();
    const fields = {
      title: form.title.value.trim(), place: form.place.value.trim(), date: form.date.value,
      country: form.country.value.trim().toUpperCase(), cover,
    };
    if (!fields.title || !fields.date) return;
    if (editing) Object.assign(editing, fields);
    else db.data.tournaments.push({ id: db.uid('t'), ...fields });
    db.save();
    u.closeModal(tModal);
    u.toast(editing ? 'Турнир сохранён' : 'Турнир создан');
    render();
  };

  $('#tDelete').onclick = () => {
    if (!editing) return;
    const n = db.participantsOf(editing.id).length;
    if (!u.confirmBox(`Удалить «${editing.title}»? Вместе с ним удалятся ${n} ${plural(n, ['участник', 'участника', 'участников'])}, все категории и сетки.`)) return;
    db.removeTournament(editing.id);
    u.closeModal(tModal);
    render();
  };

  /* ---------- Выбор дисциплины, блока и татами ---------- */
  const pick = $('#pick');
  u.bindModal(pick);
  let current = null, step = 1, disc = 'kumite', tatamiId = null;

  function discStats(tid, d) {
    const cats = db.categoriesOf(tid, d);
    const people = new Set(cats.flatMap(c => c.participantIds)).size;
    return { cats: cats.length, people };
  }

  function renderDisc() {
    const card = (d, ic, text) => {
      const s = discStats(current.id, d);
      return `<button class="disc ${disc === d ? 'on' : ''}" data-disc="${d}">
        <span class="disc-icon">${icon(ic, 'icon-lg')}</span>
        <div><h3>${K.categories.DISCIPLINES[d]}</h3><p>${text}</p></div>
        <div class="disc-meta"><span><b>${s.people}</b> ${plural(s.people, ['участник', 'участника', 'участников'])}</span><span><b>${s.cats}</b> ${plural(s.cats, ['категория', 'категории', 'категорий'])}</span></div>
      </button>`;
    };
    $('#discGrid').innerHTML = card('kumite', 'swords', 'Поединки двух участников по олимпийской системе')
      + card('kata', 'person', 'Выступления парами, побеждает один из двоих');
  }

  function tatamiStats(tt) {
    const cats = db.categoriesOf(current.id, disc).filter(c => c.tatamiId === tt.id);
    const total = cats.reduce((s, c) => s + c.fights.length, 0);
    const done = cats.reduce((s, c) => s + K.bracket.doneCount(c), 0);
    const live = K.live.read(tt.id);
    const running = live && live.tournamentId === current.id && live.timer && live.timer.running;
    let badge = '<span class="badge">не начат</span>';
    if (running) badge = '<span class="badge badge-live">бой</span>';
    else if (total && done === total) badge = '<span class="badge badge-ok">готово</span>';
    else if (done) badge = '<span class="badge">идёт</span>';
    return { cats: cats.length, total, done, badge };
  }

  function renderBlocks() {
    const blocks = db.settings.blocks;
    if (!blocks.length || !blocks.some(b => b.tatamis.length)) {
      $('#blockList').innerHTML = `<div class="note warn">${icon('alert')}<div>Не настроено ни одного татами. <a href="settings.html#places" style="text-decoration:underline">Добавьте блоки и татами в настройках</a>.</div></div>`;
      return;
    }
    if (!tatamiId || !db.tatami(tatamiId)) tatamiId = blocks.find(b => b.tatamis.length).tatamis[0].id;
    $('#blockList').innerHTML = blocks.map(b => `<div class="block">
      <div class="block-head">${icon('building')}<h4>${esc(b.name)}</h4><span>${b.tatamis.length} ${plural(b.tatamis.length, ['татами', 'татами', 'татами'])}</span></div>
      <div class="tatami-row">${b.tatamis.map(tt => {
        const s = tatamiStats(tt);
        return `<button class="tatami ${tt.id === tatamiId ? 'on' : ''}" data-tatami="${tt.id}">
          <div class="tatami-name">${esc(tt.name)} ${s.badge}</div>
          <small>${s.cats} ${plural(s.cats, ['категория', 'категории', 'категорий'])} · ${s.done} из ${s.total} ${plural(s.total, ['боя', 'боёв', 'боёв'])}</small>
          <div class="bar"><i style="width:${s.total ? Math.round(s.done / s.total * 100) : 0}%"></i></div>
        </button>`;
      }).join('')}</div></div>`).join('');
  }

  function showStep(s) {
    step = s;
    $('#step1').hidden = s !== 1; $('#step2').hidden = s !== 2;
    $('#st1').className = 'step ' + (s === 1 ? 'on' : 'done');
    $('#st2').className = 'step ' + (s === 2 ? 'on' : '');
    $('#back').style.visibility = s === 1 ? 'hidden' : 'visible';
    $('#next').innerHTML = s === 1 ? `Далее${icon('chevron-right')}` : `Открыть татами${icon('chevron-right')}`;
    if (s === 1) renderDisc(); else renderBlocks();
  }

  function openPicker(t) {
    current = t;
    const n = db.participantsOf(t.id).length, c = db.categoriesOf(t.id).length;
    $('#pickTitle').textContent = t.title;
    $('#pickSub').textContent = `${u.fmtDateLong(t.date)} · ${n} ${plural(n, ['участник', 'участника', 'участников'])} · ${c} ${plural(c, ['категория', 'категории', 'категорий'])}`;
    $('#importLink').href = u.url('import.html', { t: t.id });
    showStep(1);
    u.openModal(pick);
  }

  $('#discGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-disc]'); if (!b) return;
    disc = b.dataset.disc; renderDisc();
  });
  $('#discGrid').addEventListener('dblclick', e => { if (e.target.closest('[data-disc]')) showStep(2); });
  $('#blockList').addEventListener('click', e => {
    const b = e.target.closest('[data-tatami]'); if (!b) return;
    tatamiId = b.dataset.tatami; renderBlocks();
  });
  $('#blockList').addEventListener('dblclick', e => { if (e.target.closest('[data-tatami]')) go(); });
  $('#back').onclick = () => showStep(1);
  $('#next').onclick = () => step === 1 ? showStep(2) : go();

  function go() {
    if (!tatamiId) return;
    location.href = u.url('tournament.html', { t: current.id, d: disc, tatami: tatamiId });
  }

  db.onExternalChange(render);
  render();
})(window.K);
