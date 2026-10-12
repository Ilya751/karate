/* Правая панель: переключатель боёв, участники текущего боя, таймер, табло, очередь. */
(function (K) {
  const T = K.T; if (!T) return;
  const { db, u, bracket: B, live: L } = K;
  const { $, esc, icon } = u;

  const PRESETS = [60, 90, 120, 180];

  /* ---------- Передача на табло ---------- */
  function snapshot() {
    const cat = T.category(), f = T.fight();
    const tt = db.tatami(T.tatamiId);
    const side = src => {
      const pid = cat && f ? B.resolve(cat, src) : null;
      const p = pid && db.participant(pid);
      return p ? { id: p.id, name: p.fio, cc: p.country || '', club: p.club || '' } : null;
    };
    const red = f ? side(f.a) : null, white = f ? side(f.b) : null;
    return {
      code: cat && f ? B.code(cat, f.n) : '',
      category: cat ? cat.name : '',
      round: cat && f ? B.roundLabel(cat, f.round) : '',
      red, white,
      winner: f && f.winner ? (red && f.winner === red.id ? 'red' : 'white') : null,
      tatamiName: tt ? tt.name : '',
      blockName: tt ? tt.blockName : '',
    };
  }
  function publish() {
    if (!T.tatamiId) return;
    L.write({
      tournamentId: T.tournament.id, tatamiId: T.tatamiId, discipline: T.discipline,
      categoryId: T.categoryId, fightN: T.fightN, timer: T.timer, board: snapshot(),
    });
  }
  T.publish = publish;

  /* ---------- Бой ---------- */
  function renderFight() {
    const cat = T.category(), f = T.fight();
    $('#fightLetter').textContent = cat ? cat.letter : '—';
    $('#fightNum').value = f ? f.n : '';
    $('#fightNum').disabled = !cat || !cat.fights.length;
    $('#prev').disabled = !f || f.n <= 1;
    $('#nextF').disabled = !f || f.n >= cat.fights.length;

    $('#roundName').textContent = f ? `${B.code(cat, f.n)} · ${B.roundLabel(cat, f.round)}` : 'Нет боя';
    const fill = (prefix, src) => {
      const pid = cat && f ? B.resolve(cat, src) : null;
      const p = pid && db.participant(pid);
      $(`#${prefix}Name`).textContent = p ? p.fio : (src && src.f ? `Победитель ${B.code(cat, src.f)}` : '—');
      $(`#${prefix}Sub`).textContent = p ? [p.club, `${u.fmtWeightRu(p.weight)} кг`].filter(Boolean).join(' · ') : 'ожидается';
      $(`#${prefix}Cc`).textContent = p ? p.country : '';
      $(`#${prefix}Cc`).hidden = !p || !p.country;
      const card = $(`#${prefix}Card`);
      card.classList.toggle('won', !!(f && f.winner && f.winner === pid));
      card.classList.toggle('lost', !!(f && f.winner && pid && f.winner !== pid));
    };
    fill('red', f && f.a);
    fill('white', f && f.b);
    renderQueue();
    renderPresets();
    paintTimer();
  }

  function renderQueue() {
    const cat = T.category();
    const box = $('#queue');
    if (!cat) { box.innerHTML = ''; return; }
    const next = cat.fights.filter(f => !f.winner && f.n !== T.fightN && B.isReady(cat, f)).slice(0, 5);
    const name = pid => { const p = db.participant(pid); return p ? p.fio.split(' ')[0] : '…'; };
    if (next.length) {
      box.innerHTML = next.map(f => `<div class="queue-item" data-go="${f.n}"><span class="fid">${B.code(cat, f.n)}</span>
        <span class="who">${esc(name(B.resolve(cat, f.a)))} — ${esc(name(B.resolve(cat, f.b)))}<div class="cat-s">${B.roundLabel(cat, f.round)}</div></span>${icon('chevron-right', 'icon-sm muted')}</div>`).join('');
      return;
    }
    if (B.isDone(cat)) {
      const nextCat = T.categories().find(c => c.id !== cat.id && !B.isDone(c) && c.fights.length);
      box.innerHTML = `<div class="queue-done">${icon('check-circle')}<span>Категория завершена</span></div>`
        + (nextCat ? `<button class="btn" style="width:100%" data-gocat="${nextCat.id}">Дальше: ${esc(nextCat.name)}${icon('chevron-right', 'icon-sm')}</button>` : '');
      return;
    }
    box.innerHTML = '<div class="muted" style="font-size:13px;padding:4px 10px">Следующие бои появятся, когда будут выбраны победители</div>';
  }

  $('#queue').addEventListener('click', e => {
    const q = e.target.closest('[data-go]');
    if (q) T.selectFight(+q.dataset.go);
    const c = e.target.closest('[data-gocat]');
    if (c) T.selectCategory(c.dataset.gocat);
  });

  // Переключатель: стрелки и поле ввода номера
  const step = d => { const f = T.fight(); if (f) T.selectFight(f.n + d); };
  $('#prev').onclick = () => step(-1);
  $('#nextF').onclick = () => step(1);
  $('#fightNum').addEventListener('change', e => {
    const n = parseInt(e.target.value, 10);
    const cat = T.category();
    if (cat && B.fight(cat, n)) T.selectFight(n); else renderFight();
  });
  $('#fightNum').addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
    if (e.key === 'Enter') e.target.blur();
  });

  /* ---------- Таймер ---------- */
  function renderPresets() {
    const cat = T.category();
    const cur = T.timer ? T.timer.duration : db.settings.fightTime;
    const custom = !PRESETS.includes(cur);
    $('#presets').innerHTML = PRESETS.map(s => `<button data-sec="${s}" class="${s === cur ? 'on' : ''}">${u.fmtClock(s)}</button>`).join('')
      + `<button data-custom class="${custom ? 'on' : ''}" title="Своё время">${custom ? u.fmtClock(cur) : icon('pencil', 'icon-sm')}</button>`;
    $('#presets').classList.toggle('disabled', !cat);
  }

  let beeped = false;
  function paintTimer() {
    const t = T.timer;
    const left = L.remainingMs(t);
    const st = L.timerStatus(t);
    $('#timer').textContent = u.fmtClock(left / 1000);
    $('#timerBox').className = 'timer-box ' + st;
    const f = T.fight();
    $('#timerState').textContent = f && f.winner ? 'бой окончен' : { ready: 'готов', running: 'идёт бой', paused: 'перерыв', over: 'время вышло' }[st];
    $('#liveBadge').hidden = st !== 'running';
    $('#start').innerHTML = st === 'paused' ? `${icon('play')}Продолжить` : `${icon('play')}Старт`;
    $('#start').disabled = st === 'running' || st === 'over' || !f;
    $('#pause').disabled = st !== 'running';
    // Время вышло: останавливаем и подаём сигнал
    if (t && t.running && left <= 0) {
      T.timer = { ...t, running: false, remainingMs: 0, startedAt: null };
      if (!beeped) { beep(); beeped = true; }
      publish();
      T.emit('timer-state');
    }
  }
  setInterval(paintTimer, 200);

  function setTimer(t) {
    const wasRunning = T.timer && T.timer.running;
    T.timer = t;
    beeped = false;
    paintTimer();
    publish();
    if (wasRunning !== t.running) T.emit('timer-state');
  }

  $('#start').onclick = () => {
    const cat = T.category(), f = T.fight();
    if (!f) return;
    if (!B.isReady(cat, f)) { u.toast('В этом бою пока нет обоих участников', 'err'); return; }
    setTimer(L.startTimer(T.timer));
  };
  $('#pause').onclick = () => setTimer(L.pauseTimer(T.timer));
  $('#reset').onclick = () => {
    if (T.timer.running && !u.confirmBox('Сбросить таймер во время боя?')) return;
    setTimer(L.newTimer(T.timer.duration));
  };
  $('#presets').addEventListener('click', e => {
    const cat = T.category(); if (!cat) return;
    let sec;
    if (e.target.closest('[data-custom]')) {
      const v = prompt('Время боя (минуты:секунды)', u.fmtClock(T.timer.duration));
      if (v == null) return;
      sec = u.parseClock(v);
      if (!sec || sec < 5 || sec > 3600) { u.toast('Не понял время. Пример: 2:30', 'err'); return; }
    } else {
      const b = e.target.closest('[data-sec]'); if (!b) return;
      sec = +b.dataset.sec;
    }
    if (T.timer.running && !u.confirmBox('Идёт бой. Поменять время и сбросить таймер?')) return;
    cat.fightTime = sec;      // запоминаем для следующих боёв этой категории
    db.save();
    setTimer(L.newTimer(sec));
    renderPresets();
    T.emit('data');
  });

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(at => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.25, ctx.currentTime + at);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.3);
        o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.3);
      });
    } catch (e) { /* звук недоступен */ }
  }

  /* ---------- Табло ---------- */
  function paintBoardStatus() {
    const on = L.boardOpen();
    $('#screenStatus').className = 'screen-status' + (on ? ' on' : '');
    $('#screenStatus').textContent = on ? 'открыто' : 'не открыто';
  }
  $('#openBoard').onclick = () => {
    publish();
    const w = L.openBoard(T.tatamiId);
    if (!w) u.toast('Браузер заблокировал окно. Разрешите всплывающие окна для этого сайта', 'err');
    setTimeout(() => { publish(); paintBoardStatus(); }, 500);
  };
  setInterval(paintBoardStatus, 1000);

  /* ---------- Горячие клавиши ---------- */
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('.modal-backdrop.open')) return;
    if (e.code === 'Space') { e.preventDefault(); (T.timer && T.timer.running ? $('#pause') : $('#start')).click(); }
    if (e.key === 'ArrowRight' && !e.ctrlKey) { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft' && !e.ctrlKey) { e.preventDefault(); step(-1); }
  });

  T.on('fight', () => { beeped = false; renderFight(); publish(); });
  T.on('data', () => { renderFight(); publish(); });
  T.on('winner', () => {
    if (T.timer.running) T.timer = L.pauseTimer(T.timer);
    renderFight(); publish(); T.emit('timer-state');
  });
})(window.K);
