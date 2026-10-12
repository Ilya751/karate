/* Центр экрана: турнирная сетка текущей категории.
   Раскладка считается вручную: бои первого круга (и участники без пары) стоят друг под другом,
   каждый следующий бой — посередине между боями, из которых в него приходят победители. */
(function (K) {
  const T = K.T; if (!T) return;
  const { db, u, bracket: B } = K;
  const { $, $$, esc, icon, plural } = u;

  const W = 264;      // ширина карточки боя
  const H = 76;       // высота карточки
  const GAP_X = 56;   // между кругами
  const GAP_Y = 22;   // между соседними боями первого круга
  const SLOT = H + GAP_Y;

  let editMode = false;
  let selected = null; // участник, выбранный для обмена в режиме правки

  const person = id => db.participant(id);

  function layout(cat) {
    const nodes = [];   // { kind: 'fight'|'bye', f?, pid?, col, y }
    const links = [];   // [child, parent]
    let leaf = 0;
    const place = f => {
      const node = { kind: 'fight', f, col: f.round - 1 };
      const kids = [];
      for (const side of ['a', 'b']) {
        const s = f[side];
        if (!s) continue;
        if (s.f) kids.push(place(B.fight(cat, s.f)));
        else if (f.round > 1) {
          const bye = { kind: 'bye', pid: s.p, col: f.round - 2, y: leaf++ * SLOT + H / 2 };
          nodes.push(bye);
          kids.push(bye);
        }
      }
      node.y = kids.length ? kids.reduce((s, k) => s + k.y, 0) / kids.length : leaf++ * SLOT + H / 2;
      kids.forEach(k => links.push([k, node]));
      nodes.push(node);
      return node;
    };
    const fin = B.finalFight(cat);
    const root = fin ? place(fin) : null;
    return { nodes, links, root, leaves: leaf, cols: B.roundsCount(cat) };
  }

  function fighterRow(cat, f, side) {
    const src = f[side];
    const pid = B.resolve(cat, src);
    const color = side === 'a' ? 'aka' : 'shiro';
    if (!pid) {
      const label = src && src.f ? `Победитель ${B.code(cat, src.f)}` : '—';
      return `<div class="fighter ${color} empty"><span class="belt"></span><span class="name">${label}</span></div>`;
    }
    const p = person(pid);
    const state = f.winner ? (f.winner === pid ? 'won' : 'lost') : '';
    const editable = editMode && src.p && B.canEdit(cat, pid);
    let action = '';
    if (!editMode && B.isReady(cat, f)) {
      action = f.winner === pid
        ? `<button class="pick-winner undo" data-undo="${f.n}">${icon('rotate-ccw', 'icon-sm')}Отменить</button>`
        : `<button class="pick-winner" data-win="${f.n}" data-pid="${pid}">${icon('check', 'icon-sm')}Победил</button>`;
    }
    return `<div class="fighter ${color} ${state} ${editable ? 'editable' : ''} ${selected === pid ? 'sel' : ''}" data-p="${pid}">
      <span class="belt"></span>
      <span class="name">${esc(p ? p.fio : '?')}</span>
      <span class="cc">${esc(p ? p.country : '')}</span>
      <span class="w">${p ? u.fmtWeight(p.weight) : ''}</span>
      <svg class="icon icon-sm win-mark"><use href="#i-trophy"/></svg>
      ${action}
    </div>`;
  }

  function fightCard(cat, node) {
    const f = node.f;
    const cls = ['fight'];
    if (f.n === T.fightN) cls.push('current');
    if (!editMode && B.isReady(cat, f)) cls.push('pickable');
    if (f.winner) cls.push('decided');
    const live = f.n === T.fightN && T.timer && T.timer.running;
    return `<div class="${cls.join(' ')}" id="f-${f.n}" data-fight="${f.n}" style="left:${node.col * (W + GAP_X)}px;top:${node.y - H / 2}px">
      <span class="fight-id">${B.code(cat, f.n)}</span>
      ${live ? '<span class="badge badge-live fight-live">идёт</span>' : ''}
      ${fighterRow(cat, f, 'a')}
      ${fighterRow(cat, f, 'b')}
    </div>`;
  }

  function byeCard(cat, node) {
    const p = person(node.pid);
    const editable = editMode && B.canEdit(cat, node.pid);
    return `<div class="fight bye" style="left:${node.col * (W + GAP_X)}px;top:${node.y - H / 2}px">
      <div class="fighter ${editable ? 'editable' : ''} ${selected === node.pid ? 'sel' : ''}" data-p="${node.pid}"><span class="belt"></span><span class="name">${esc(p ? p.fio : '?')}</span><span class="cc">${esc(p ? p.country : '')}</span><span class="w">${p ? u.fmtWeight(p.weight) : ''}</span></div>
      <div class="fighter bye-note">Без пары, проходит дальше без боя</div>
    </div>`;
  }

  function render() {
    const cat = T.category();
    const area = $('#bracket');
    const heads = $('#roundHeads');
    renderToolbar(cat);
    if (!cat) { heads.innerHTML = ''; area.innerHTML = ''; area.style.cssText = ''; return; }

    if (cat.fights.length === 0) {
      heads.innerHTML = '';
      area.style.cssText = '';
      const champ = B.champion(cat);
      area.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${icon('users', 'icon-lg')}</div>
        <h3>${champ ? 'В категории один участник' : 'В категории нет участников'}</h3>
        <p>${champ ? `${esc(person(champ).fio)} становится победителем без боёв.` : 'Добавьте участников, и сетка построится автоматически.'}</p>
        <button class="btn btn-primary" data-act="members">${icon('users')}Участники</button>
      </div>`;
      return;
    }

    const L = layout(cat);
    const champ = B.champion(cat);
    const cols = L.cols + (champ ? 1 : 0);
    const width = cols * (W + GAP_X) - GAP_X;
    const height = Math.max(L.leaves * SLOT - GAP_Y, H);

    // Подписи кругов
    const perRound = {};
    cat.fights.forEach(f => { perRound[f.round] = (perRound[f.round] || 0) + 1; });
    heads.style.width = width + 'px';
    heads.innerHTML = Object.keys(perRound).map(r => `<div class="round-label" style="width:${W}px;margin-right:${GAP_X}px">
      ${B.roundLabel(cat, +r)}<em>${perRound[r]} ${plural(perRound[r], ['бой', 'боя', 'боёв'])}</em></div>`).join('')
      + (champ ? `<div class="round-label" style="width:${W}px">Победитель</div>` : '');

    // Линии
    const path = ([c, p]) => {
      const x1 = c.col * (W + GAP_X) + W, y1 = c.y;
      const x2 = p.col * (W + GAP_X), y2 = p.y;
      const mx = x2 - GAP_X / 2;
      return `<path d="M${x1} ${y1} H${mx} V${y2} H${x2}"/>`;
    };
    let champHTML = '';
    if (champ && L.root) {
      const x = L.cols * (W + GAP_X);
      const p = person(champ);
      champHTML = `<div class="champion" style="left:${x}px;top:${L.root.y - 34}px">
        ${icon('trophy', 'icon-lg')}<div><b>${esc(p.fio)}</b><span>${esc(p.club || '')} ${esc(p.country || '')}</span></div></div>`;
    }
    area.style.width = width + 'px';
    area.style.height = height + 'px';
    area.innerHTML = `<svg class="links" width="${width}" height="${height}">${L.links.map(path).join('')}
      ${champ && L.root ? `<path d="M${L.root.col * (W + GAP_X) + W} ${L.root.y} H${L.cols * (W + GAP_X)}"/>` : ''}</svg>`
      + L.nodes.map(n => n.kind === 'fight' ? fightCard(cat, n) : byeCard(cat, n)).join('')
      + champHTML;

    $('#editBanner').hidden = !editMode;
    applyNameSearch(false);
  }

  function renderToolbar(cat) {
    $('#catTitle').textContent = cat ? cat.name : 'Нет категории';
    $$('[data-cat-only]').forEach(el => el.hidden = !cat);
    if (!cat) { $('#catMeta').textContent = 'Создайте категорию слева'; return; }
    const n = cat.participantIds.length, f = cat.fights.length, d = B.doneCount(cat);
    $('#catMeta').textContent = `${n} ${plural(n, ['участник', 'участника', 'участников'])} · проведено ${d} из ${f} ${plural(f, ['боя', 'боёв', 'боёв'])} · ${u.fmtClock(cat.fightTime || db.settings.fightTime)} на бой`;
    $('#editBtn').classList.toggle('btn-accent', editMode);
  }

  /* ---------- Победитель ---------- */
  $('#bracket').addEventListener('click', e => {
    const cat = T.category(); if (!cat) return;
    if (e.target.closest('[data-act="members"]')) { T.emit('members'); return; }

    const win = e.target.closest('[data-win]');
    if (win) {
      const n = +win.dataset.win, pid = win.dataset.pid;
      const f = B.fight(cat, n);
      const parent = B.parentOf(cat, n);
      if (f.winner && parent && parent.winner && !u.confirmBox('Результаты следующих боёв с этим участником будут сброшены. Продолжить?')) return;
      B.setWinner(cat, n, pid);
      T.commit();
      if (n === T.fightN) T.emit('winner');
      return;
    }
    const undo = e.target.closest('[data-undo]');
    if (undo) {
      const n = +undo.dataset.undo;
      const parent = B.parentOf(cat, n);
      if (parent && parent.winner && !u.confirmBox('Результаты следующих боёв с этим участником тоже будут сброшены. Продолжить?')) return;
      B.clearWinner(cat, n);
      T.commit();
      if (n === T.fightN) T.emit('winner');
      return;
    }

    if (editMode) {
      const row = e.target.closest('.fighter.editable');
      if (!row) return;
      const pid = row.dataset.p;
      if (!selected) { selected = pid; render(); return; }
      if (selected === pid) { selected = null; render(); return; }
      if (B.swap(cat, selected, pid)) { selected = null; T.commit(); u.toast('Участники поменялись местами'); }
      else { selected = null; render(); }
      return;
    }

    const card = e.target.closest('[data-fight]');
    if (card) T.selectFight(+card.dataset.fight);
  });

  /* ---------- Режим правки ---------- */
  function setEdit(on) {
    editMode = on; selected = null;
    render();
  }
  $('#editBtn').onclick = () => setEdit(!editMode);
  $('#editDone').onclick = () => setEdit(false);

  /* ---------- Поиск ---------- */
  function applyNameSearch(scroll) {
    const q = $('#qName').value.trim().toLowerCase();
    let first = null;
    $$('#bracket .fighter[data-p]').forEach(el => {
      const p = person(el.dataset.p);
      const hit = !!q && !!p && p.fio.toLowerCase().includes(q);
      el.classList.toggle('hl', hit);
      if (hit && !first) first = el;
    });
    if (scroll && first) first.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    $('#qNameCount').textContent = q ? String($$('#bracket .fighter.hl').length) : '';
  }
  $('#qName').addEventListener('input', u.debounce(() => applyNameSearch(true), 120));

  // Поиск боя по ID: «B3» — категория B, бой 3. Можно ввести просто номер — бой в текущей категории.
  function findById() {
    const raw = u.normalizeCode($('#qId').value);
    $$('.fight.found').forEach(el => el.classList.remove('found'));
    if (!raw) return;
    const m = raw.match(/^([A-Z]*)(\d+)$/);
    if (!m) return;
    let cat = T.category();
    if (m[1]) cat = K.db.categoriesOf(T.tournament.id).find(c => c.letter === m[1]);
    if (!cat) { u.toast(`Категории ${m[1]} нет`, 'err'); return; }
    const n = +m[2];
    if (!B.fight(cat, n)) { u.toast(`Боя ${cat.letter}${n} нет`, 'err'); return; }
    if (cat.discipline !== T.discipline || cat.tatamiId !== T.tatamiId) {
      if (u.confirmBox(`Бой ${cat.letter}${n} в категории «${cat.name}» на другом татами или в другой дисциплине. Перейти туда?`)) {
        location.href = u.url('tournament.html', { t: T.tournament.id, d: cat.discipline, tatami: cat.tatamiId, cat: cat.id, fight: n });
      }
      return;
    }
    if (cat.id !== T.categoryId) T.selectCategory(cat.id, n);
    const el = document.getElementById('f-' + n);
    if (el) { el.classList.add('found'); el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); }
  }
  $('#qId').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findById(); } });
  $('#qId').addEventListener('input', u.debounce(findById, 450));

  T.on('category', () => { editMode = false; selected = null; $('#qId').value = ''; render(); $('#bracketScroll').scrollTo(0, 0); });
  T.on('fight', () => {
    render();
    const el = document.getElementById('f-' + T.fightN);
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  });
  T.on('data', render);
  T.on('timer-state', render);
})(window.K);
