/* Настройки: весовые категории, время боя, блоки и татами, резервная копия данных.
   Правим черновик и сохраняем кнопкой «Сохранить». */
(function (K) {
  const { db, u } = K;
  const { $, $$, esc, icon, plural } = u;
  db.load();

  let draft = JSON.parse(JSON.stringify(db.settings));
  let dirty = false;
  const touch = () => { dirty = true; $('#dirtyNote').textContent = 'Есть несохранённые изменения'; $('#saveBar').classList.add('dirty'); };

  /* ---------- Весовые категории ---------- */
  function renderGroups() {
    const groups = draft.ageGroups.slice().sort((a, b) => a.ageFrom - b.ageFrom || b.sex.localeCompare(a.sex));
    $('#groups').innerHTML = groups.map(g => {
      const ws = g.weights.slice().sort((a, b) => a - b);
      const chips = ws.map(w => `<span class="chip">до ${w}<button data-delw="${w}" title="Убрать">${icon('x', 'icon-sm')}</button></span>`).join('')
        + (ws.length ? (g.plus
          ? `<span class="chip">+${ws[ws.length - 1]}<button data-plus="off" title="Убрать категорию «+»">${icon('x', 'icon-sm')}</button></span>`
          : `<button class="chip-add" data-plus="on">${icon('plus', 'icon-sm')}категория «+${ws[ws.length - 1]}»</button>`) : '<span class="muted" style="font-size:13px">без весов — одна абсолютная категория</span>');
      return `<tr data-g="${g.id}">
        <td><button class="sex-tag ${g.sex === 'F' ? 'f' : 'm'}" data-sex title="Сменить пол">${g.sex === 'F' ? 'Ж' : 'М'}</button></td>
        <td><div class="age-edit">
          <input class="input mini mono" data-f="ageFrom" value="${g.ageFrom}" inputmode="numeric">
          <span>–</span>
          <input class="input mini mono" data-f="ageTo" value="${g.ageTo >= 99 ? '' : g.ageTo}" placeholder="∞" inputmode="numeric">
          <input class="input" data-f="title" value="${esc(g.title)}" placeholder="мальчики">
        </div></td>
        <td><div class="chips">${chips}
          <input class="chip-input mono" data-addw placeholder="+ вес" inputmode="decimal" title="Введите вес и нажмите Enter">
        </div></td>
        <td><button class="btn btn-sm btn-ghost btn-icon" data-delg title="Удалить группу">${icon('trash', 'icon-sm')}</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="4" class="muted">Групп нет. Добавьте первую.</td></tr>`;
  }

  const groupOf = el => draft.ageGroups.find(g => g.id === el.closest('[data-g]').dataset.g);

  $('#groups').addEventListener('click', e => {
    const row = e.target.closest('[data-g]'); if (!row) return;
    const g = groupOf(row);
    if (e.target.closest('[data-sex]')) { g.sex = g.sex === 'M' ? 'F' : 'M'; }
    else if (e.target.closest('[data-delw]')) { const w = +e.target.closest('[data-delw]').dataset.delw; g.weights = g.weights.filter(x => x !== w); }
    else if (e.target.closest('[data-plus]')) { g.plus = e.target.closest('[data-plus]').dataset.plus === 'on'; }
    else if (e.target.closest('[data-delg]')) {
      if (!u.confirmBox(`Удалить группу ${K.categories.ageLabel(g)} лет · ${g.title}?`)) return;
      draft.ageGroups = draft.ageGroups.filter(x => x !== g);
    } else return;
    touch(); renderGroups();
  });
  $('#groups').addEventListener('change', e => {
    const inp = e.target.closest('[data-f]'); if (!inp) return;
    const g = groupOf(inp);
    const f = inp.dataset.f;
    if (f === 'title') g.title = inp.value.trim();
    else {
      const v = parseInt(inp.value, 10);
      if (f === 'ageTo' && inp.value.trim() === '') g.ageTo = 99;
      else if (!isNaN(v)) g[f] = v;
      if (g.ageTo < g.ageFrom) g.ageTo = g.ageFrom;
    }
    touch(); renderGroups();
  });
  $('#groups').addEventListener('keydown', e => {
    const inp = e.target.closest('[data-addw]');
    if (!inp || e.key !== 'Enter') return;
    e.preventDefault();
    const w = parseFloat(inp.value.replace(',', '.'));
    if (isNaN(w) || w <= 0) { u.toast('Введите вес числом, например 32', 'err'); return; }
    const g = groupOf(inp);
    if (!g.weights.includes(w)) g.weights.push(w);
    touch(); renderGroups();
    const again = $(`[data-g="${g.id}"] [data-addw]`); if (again) again.focus();
  });
  $('#addGroup').onclick = () => {
    const last = draft.ageGroups.reduce((m, g) => Math.max(m, g.ageTo < 99 ? g.ageTo : 0), 0);
    draft.ageGroups.push({ id: db.uid('ag'), sex: 'M', ageFrom: last + 1, ageTo: last + 2, title: 'мальчики', weights: [], plus: true });
    touch(); renderGroups();
  };

  /* ---------- Время и страна ---------- */
  function renderBasics() {
    $('#fightTime').value = u.fmtClock(draft.fightTime);
    $('#country').value = draft.defaultCountry || '';
  }
  $('#fightTime').addEventListener('change', e => {
    const s = u.parseClock(e.target.value);
    if (!s) { u.toast('Время в формате 2:00', 'err'); renderBasics(); return; }
    draft.fightTime = s; touch(); renderBasics();
  });
  $('#country').addEventListener('change', e => { draft.defaultCountry = e.target.value.trim().toUpperCase(); touch(); });

  /* ---------- Блоки и татами ---------- */
  const usedBy = ttId => db.data.categories.filter(c => c.tatamiId === ttId).length;

  function renderBlocks() {
    $('#blocks').innerHTML = draft.blocks.map(b => `<div class="block" data-b="${b.id}">
      <div class="block-head">${icon('building')}
        <input class="input inline-input" data-bname value="${esc(b.name)}">
        <span>${b.tatamis.length} ${plural(b.tatamis.length, ['татами', 'татами', 'татами'])}</span>
        <button class="btn btn-sm btn-ghost btn-icon" data-delb style="margin-left:auto" title="Удалить блок">${icon('trash', 'icon-sm')}</button>
      </div>
      <div class="chips">${b.tatamis.map(t => `<span class="chip chip-edit"><input data-tname="${t.id}" value="${esc(t.name)}" size="${Math.max(4, t.name.length)}"><button data-delt="${t.id}" title="Удалить">${icon('x', 'icon-sm')}</button></span>`).join('')}
        <button class="chip-add" data-addt>${icon('plus', 'icon-sm')}татами</button></div>
    </div>`).join('') || '<p class="muted">Блоков нет. Добавьте хотя бы один, иначе вести бои будет негде.</p>';
  }
  const blockOf = el => draft.blocks.find(b => b.id === el.closest('[data-b]').dataset.b);
  const allTatamiCount = () => draft.blocks.reduce((s, b) => s + b.tatamis.length, 0);

  $('#blocks').addEventListener('click', e => {
    const blockEl = e.target.closest('[data-b]'); if (!blockEl) return;
    const b = blockOf(blockEl);
    if (e.target.closest('[data-addt]')) {
      b.tatamis.push({ id: db.uid('tt'), name: `Татами ${allTatamiCount() + 1}` });
    } else if (e.target.closest('[data-delt]')) {
      const id = e.target.closest('[data-delt]').dataset.delt;
      const n = usedBy(id);
      if (n && !u.confirmBox(`На этом татами ${n} ${plural(n, ['категория', 'категории', 'категорий'])}. Они останутся без татами. Удалить?`)) return;
      b.tatamis = b.tatamis.filter(t => t.id !== id);
    } else if (e.target.closest('[data-delb]')) {
      const n = b.tatamis.reduce((s, t) => s + usedBy(t.id), 0);
      if (!u.confirmBox(n ? `В блоке есть категории (${n}). Они останутся без татами. Удалить блок?` : `Удалить «${b.name}»?`)) return;
      draft.blocks = draft.blocks.filter(x => x !== b);
    } else return;
    touch(); renderBlocks();
  });
  $('#blocks').addEventListener('change', e => {
    const blockEl = e.target.closest('[data-b]'); if (!blockEl) return;
    const b = blockOf(blockEl);
    if (e.target.matches('[data-bname]')) b.name = e.target.value.trim() || b.name;
    const tn = e.target.closest('[data-tname]');
    if (tn) { const t = b.tatamis.find(x => x.id === tn.dataset.tname); t.name = tn.value.trim() || t.name; }
    touch(); renderBlocks();
  });
  $('#addBlock').onclick = () => {
    const letter = u.letterFor(draft.blocks.length);
    draft.blocks.push({ id: db.uid('bl'), name: `Блок ${letter}`, tatamis: [{ id: db.uid('tt'), name: `Татами ${allTatamiCount() + 1}` }] });
    touch(); renderBlocks();
  };

  /* ---------- Сохранение ---------- */
  $('#saveBtn').onclick = () => {
    db.data.settings = JSON.parse(JSON.stringify(draft));
    // Категории удалённых татами остаются без татами — переносим на первое доступное
    const ids = new Set(db.tatamis().map(t => t.id));
    const first = db.tatamis()[0];
    db.data.categories.forEach(c => { if (!ids.has(c.tatamiId)) c.tatamiId = first ? first.id : null; });
    db.save();
    dirty = false;
    $('#dirtyNote').textContent = '';
    $('#saveBar').classList.remove('dirty');
    u.toast('Настройки сохранены');
  };
  $('#cancelBtn').onclick = () => {
    draft = JSON.parse(JSON.stringify(db.settings));
    dirty = false; $('#dirtyNote').textContent = ''; $('#saveBar').classList.remove('dirty');
    renderAll();
  };
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Резервная копия ---------- */
  $('#exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(db.data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `karate-backup-${u.todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.settings || !Array.isArray(data.tournaments)) throw new Error('bad');
      if (!u.confirmBox(`Заменить все текущие данные копией (${data.tournaments.length} ${plural(data.tournaments.length, ['турнир', 'турнира', 'турниров'])})?`)) return;
      localStorage.setItem(db.KEY, JSON.stringify(data));
      db.load();
      draft = JSON.parse(JSON.stringify(db.settings));
      renderAll();
      u.toast('Данные загружены из копии');
    } catch (err) {
      u.toast('Это не файл резервной копии', 'err');
    }
    e.target.value = '';
  };
  $('#resetBtn').onclick = () => {
    if (!u.confirmBox('Удалить все турниры, участников, категории и настройки? Это нельзя отменить.')) return;
    localStorage.removeItem(db.KEY);
    Object.keys(localStorage).filter(k => k.startsWith('karate.')).forEach(k => localStorage.removeItem(k));
    db.load();
    draft = JSON.parse(JSON.stringify(db.settings));
    renderAll();
    u.toast('Все данные удалены');
  };

  /* ---------- Навигация по разделам ---------- */
  const navLinks = $$('#sideNav a');
  window.addEventListener('scroll', () => {
    let cur = navLinks[0];
    navLinks.forEach(a => { const s = $(a.getAttribute('href')); if (s && s.getBoundingClientRect().top < 140) cur = a; });
    navLinks.forEach(a => a.classList.toggle('on', a === cur));
  });

  function renderAll() { renderGroups(); renderBasics(); renderBlocks(); }
  renderAll();
})(window.K);
