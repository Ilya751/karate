/* Окна категории: создание и изменение, состав участников, меню категории. */
(function (K) {
  const T = K.T; if (!T) return;
  const { db, u, bracket: B, categories: C } = K;
  const { $, esc, icon, plural } = u;

  /* ================= Создание и изменение ================= */
  const modal = $('#catModal'), form = $('#catForm');
  u.bindModal(modal);
  let editing = null, nameTouched = false;

  const groupsFor = sex => db.settings.ageGroups.filter(g => !sex || g.sex === sex)
    .sort((a, b) => a.ageFrom - b.ageFrom || b.sex.localeCompare(a.sex));

  function fillAgeSelect() {
    const sex = form.sex.value;
    const cur = form.age.value;
    form.age.innerHTML = '<option value="">Любой возраст</option>' + groupsFor(sex)
      .map(g => `<option value="${g.id}">${C.ageLabel(g)} лет · ${esc(g.title)}</option>`).join('');
    if ([...form.age.options].some(o => o.value === cur)) form.age.value = cur;
    fillWeightSelect();
  }
  function fillWeightSelect() {
    const g = db.settings.ageGroups.find(x => x.id === form.age.value);
    const cur = form.weight.value;
    form.weight.innerHTML = '<option value="">Любой вес</option>' + (g ? C.weightClasses(g).map(w =>
      `<option value="${w.key}">${w.max == null ? w.label : 'до ' + w.label}</option>`).join('') : '');
    if ([...form.weight.options].some(o => o.value === cur)) form.weight.value = cur;
  }

  // Поля формы → фильтры категории
  function filters() {
    const g = db.settings.ageGroups.find(x => x.id === form.age.value);
    const wc = g && C.weightClasses(g).find(w => w.key === form.weight.value);
    return {
      discipline: form.discipline.value,
      sex: form.sex.value || null,
      ageFrom: g ? g.ageFrom : null, ageTo: g ? g.ageTo : null,
      weightMin: wc ? wc.min : null, weightMax: wc ? wc.max : null,
      group: g, wc,
    };
  }

  function autoName() {
    const f = filters();
    if (f.group) return C.makeName(f.discipline, f.group, f.wc);
    const sex = { M: 'мужчины', F: 'женщины' }[f.sex] || '';
    return [C.DISCIPLINES[f.discipline], sex].filter(Boolean).join(' ');
  }

  function refresh() {
    if (!nameTouched && !editing) form.name.value = autoName();
    if (editing) { $('#catHint').innerHTML = ''; return; }
    const f = filters();
    const probe = { tournamentId: T.tournament.id, ...f };
    const all = C.candidates(probe);
    const taken = C.assigned(T.tournament.id, f.discipline);
    const free = all.filter(p => !taken.has(p.id));
    $('#catHint').innerHTML = `${icon('info')}<div>Под фильтры подходят <b>${all.length} ${plural(all.length, ['участник', 'участника', 'участников'])}</b>`
      + (all.length !== free.length ? `, из них ${all.length - free.length} уже в других категориях. В новую попадут <b>${free.length}</b>.` : '.')
      + ' Первый круг сетки построится автоматически: пары по весу, при нечётном числе самый тяжёлый проходит во второй круг без боя.</div>';
  }

  function openCatModal(cat = null) {
    editing = cat;
    nameTouched = !!cat;
    $('#catModalTitle').textContent = cat ? 'Категория' : 'Новая категория';
    $('#catSubmit').innerHTML = cat ? `${icon('check')}Сохранить` : `${icon('shuffle')}Создать и построить сетку`;
    form.tatami.innerHTML = db.tatamis().map(t => `<option value="${t.id}">${esc(t.blockName)} · ${esc(t.name)}</option>`).join('');
    form.discipline.value = cat ? cat.discipline : T.discipline;
    form.sex.value = cat ? cat.sex || '' : '';
    fillAgeSelect();
    if (cat) {
      const g = db.settings.ageGroups.find(x => x.sex === cat.sex && x.ageFrom === cat.ageFrom && x.ageTo === cat.ageTo);
      form.age.value = g ? g.id : '';
      fillWeightSelect();
      const wc = g && C.weightClasses(g).find(w => w.min === cat.weightMin && w.max === cat.weightMax);
      form.weight.value = wc ? wc.key : '';
    }
    form.tatami.value = cat ? cat.tatamiId : T.tatamiId;
    form.time.value = u.fmtClock(cat ? cat.fightTime : db.settings.fightTime);
    form.name.value = cat ? cat.name : autoName();
    // Фильтры у существующей категории не меняем — состав правится в «Участниках»
    ['discipline', 'sex', 'age', 'weight'].forEach(n => { form[n].disabled = !!cat; });
    refresh();
    u.openModal(modal);
  }

  form.name.addEventListener('input', () => { nameTouched = true; });
  form.sex.addEventListener('change', () => { fillAgeSelect(); refresh(); });
  form.age.addEventListener('change', () => { fillWeightSelect(); refresh(); });
  form.weight.addEventListener('change', refresh);
  form.discipline.addEventListener('change', refresh);

  form.onsubmit = e => {
    e.preventDefault();
    const time = u.parseClock(form.time.value);
    if (!time) { u.toast('Время боя в формате 2:00', 'err'); return; }
    const name = form.name.value.trim() || autoName();
    if (editing) {
      Object.assign(editing, { name, tatamiId: form.tatami.value, fightTime: time });
      db.save();
      u.closeModal(modal);
      if (editing.tatamiId !== T.tatamiId) {
        u.toast('Категория перенесена на другое татами');
        T.selectCategory((T.categories()[0] || {}).id || null);
      } else T.commit();
      return;
    }
    const f = filters();
    const taken = C.assigned(T.tournament.id, f.discipline);
    const cat = C.create({
      tournamentId: T.tournament.id, discipline: f.discipline, name,
      sex: f.sex, ageFrom: f.ageFrom, ageTo: f.ageTo, weightMin: f.weightMin, weightMax: f.weightMax,
      tatamiId: form.tatami.value, fightTime: time,
    });
    cat.participantIds = C.candidates(cat).filter(p => !taken.has(p.id)).map(p => p.id);
    C.rebuild(cat);
    db.save();
    u.closeModal(modal);
    u.toast(`Категория ${cat.letter} создана`);
    if (cat.discipline === T.discipline && cat.tatamiId === T.tatamiId) T.selectCategory(cat.id);
    else T.emit('data');
  };

  /* ================= Состав участников ================= */
  const mModal = $('#membersModal');
  u.bindModal(mModal);
  let chosen = new Set(), scope = 'match';

  function renderMembers() {
    const cat = T.category(); if (!cat) return;
    const q = $('#memSearch').value.trim().toLowerCase();
    const t = T.tournament;
    const others = new Map();
    db.categoriesOf(t.id, cat.discipline).forEach(c => { if (c.id !== cat.id) c.participantIds.forEach(id => others.set(id, c)); });
    let list = db.participantsOf(t.id);
    if (scope === 'match') list = list.filter(p => chosen.has(p.id) || C.matches(cat, p, t));
    if (scope === 'in') list = list.filter(p => chosen.has(p.id));
    if (q) list = list.filter(p => (p.fio + ' ' + (p.club || '')).toLowerCase().includes(q));
    list.sort((a, b) => (chosen.has(b.id) - chosen.has(a.id)) || (a.weight ?? 999) - (b.weight ?? 999));

    $('#memCount').textContent = `Выбрано: ${chosen.size}`;
    $('#memList').innerHTML = list.length ? list.map(p => {
      const other = others.get(p.id);
      const age = C.participantAge(p, t);
      return `<label class="mem-row ${chosen.has(p.id) ? 'on' : ''}">
        <input type="checkbox" data-pid="${p.id}" ${chosen.has(p.id) ? 'checked' : ''}>
        <span class="sex-tag ${p.sex === 'F' ? 'f' : 'm'}">${p.sex === 'F' ? 'Ж' : 'М'}</span>
        <span class="mem-name">${esc(p.fio)}<small>${esc([p.club, p.city].filter(Boolean).join(', '))}</small></span>
        ${other ? `<span class="badge" title="${esc(other.name)}">уже в ${esc(other.letter)}</span>` : ''}
        <span class="mem-num">${age ?? '—'} ${age != null ? plural(age, ['год', 'года', 'лет']) : ''}</span>
        <span class="mem-num"><b>${u.fmtWeightRu(p.weight)}</b> кг</span>
        <span class="cc">${esc(p.country || '')}</span>
      </label>`;
    }).join('') : `<div class="empty-state small"><p>Никого не нашлось</p></div>`;
  }

  function openMembers() {
    const cat = T.category(); if (!cat) return;
    chosen = new Set(cat.participantIds);
    $('#memTitle').textContent = cat.name;
    $('#memSearch').value = '';
    $('#addForm').hidden = true;
    renderMembers();
    u.openModal(mModal);
  }

  $('#memList').addEventListener('change', e => {
    const cb = e.target.closest('[data-pid]'); if (!cb) return;
    if (cb.checked) chosen.add(cb.dataset.pid); else chosen.delete(cb.dataset.pid);
    cb.closest('.mem-row').classList.toggle('on', cb.checked);
    $('#memCount').textContent = `Выбрано: ${chosen.size}`;
  });
  $('#memSearch').addEventListener('input', u.debounce(renderMembers, 100));
  $('#memScope').addEventListener('click', e => {
    const b = e.target.closest('[data-scope]'); if (!b) return;
    scope = b.dataset.scope;
    [...$('#memScope').children].forEach(x => x.classList.toggle('on', x === b));
    renderMembers();
  });

  $('#memSave').onclick = () => {
    const cat = T.category();
    const before = cat.participantIds.slice().sort().join();
    const after = [...chosen].sort().join();
    if (before === after) { u.closeModal(mModal); return; }
    if (B.hasResults(cat) && !u.confirmBox('Сетка будет построена заново, результаты проведённых боёв пропадут. Продолжить?')) return;
    cat.participantIds = [...chosen];
    C.rebuild(cat);
    u.closeModal(mModal);
    T.selectCategory(cat.id);
    T.commit();
    u.toast('Состав обновлён, сетка построена заново');
  };

  // Быстрое добавление участника (поздняя заявка)
  $('#addToggle').onclick = () => {
    $('#addForm').hidden = !$('#addForm').hidden;
    if (!$('#addForm').hidden) {
      const cat = T.category();
      const f = $('#addForm');
      f.reset();
      f.sex.value = cat.sex || 'M';
      f.country.value = T.tournament.country || db.settings.defaultCountry || '';
      f.fio.focus();
    }
  };
  $('#addForm').onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    const weight = parseFloat(String(f.weight.value).replace(',', '.'));
    if (!f.fio.value.trim() || isNaN(weight)) { u.toast('Нужны ФИО и вес', 'err'); return; }
    const p = {
      id: db.uid('p'), tournamentId: T.tournament.id, fio: f.fio.value.trim(), sex: f.sex.value,
      birth: f.birth.value || null, age: null, weight, rank: '', region: '', city: '', club: f.club.value.trim(),
      coach: '', kumite: true, country: f.country.value.trim().toUpperCase(),
    };
    p.age = C.ageOn(p.birth, T.tournament.date);
    db.data.participants.push(p);
    db.save();
    chosen.add(p.id);
    f.hidden = true;
    renderMembers();
    u.toast('Участник добавлен в турнир');
  };

  /* ================= Меню категории ================= */
  $('#catMenuBtn').onclick = e => {
    e.stopPropagation();
    const cat = T.category(); if (!cat) return;
    u.menu(e.currentTarget, [
      { label: 'Изменить категорию', icon: 'pencil', onClick: () => openCatModal(cat) },
      { label: 'Построить сетку заново', icon: 'shuffle', onClick: () => {
        if (B.hasResults(cat) && !u.confirmBox('Результаты проведённых боёв пропадут. Построить сетку заново?')) return;
        C.rebuild(cat); T.selectCategory(cat.id); T.commit(); u.toast('Сетка построена заново');
      } },
      'sep',
      { label: 'Удалить категорию', icon: 'trash', danger: true, onClick: () => {
        if (!u.confirmBox(`Удалить категорию «${cat.name}»? Участники останутся в турнире.`)) return;
        C.remove(cat.id); db.save();
        T.selectCategory((T.categories()[0] || {}).id || null);
        T.emit('data');
      } },
    ]);
  };

  T.on('new-category', () => openCatModal());
  T.on('members', openMembers);
  $('#membersBtn').onclick = openMembers;
})(window.K);
