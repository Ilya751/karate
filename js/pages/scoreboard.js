/* Табло: показывает текущий бой татами из ссылки (?tatami=…) и само отсчитывает таймер. */
(function (K) {
  const { u, live: L } = K;
  const { $ } = u;

  const tatamiId = u.params().tatami;
  const STATES = { ready: 'готов', running: 'бой', paused: 'перерыв', over: 'время' };
  let state = null;

  // «Смирнов Илья» → крупно фамилия, ниже имя
  const nameHTML = n => {
    const [last, ...rest] = String(n).split(' ');
    return `${u.esc(last)}<small>${u.esc(rest.join(' '))}</small>`;
  };

  function side(prefix, p) {
    $(`#${prefix}`).classList.toggle('empty', !p);
    $(`#${prefix}Cc`).textContent = p ? p.cc : '';
    $(`#${prefix}Cc`).style.display = p && p.cc ? '' : 'none';
    $(`#${prefix}Name`).innerHTML = p ? nameHTML(p.name) : 'Ожидается';
    $(`#${prefix}Club`).textContent = p ? p.club : '';
  }

  function render() {
    const b = state && state.board;
    document.body.classList.toggle('no-data', !b || !b.code);
    if (!b) return;
    document.title = `Табло · ${b.tatamiName || ''}`;
    $('#fid').textContent = b.code || '—';
    $('#round').textContent = b.round || '';
    $('#cat').textContent = b.category || '';
    $('#place').innerHTML = `${u.esc(b.blockName || '')}<br>${u.esc(b.tatamiName || '')}`;
    side('red', b.red);
    side('white', b.white);
    $('#red').classList.toggle('winner', b.winner === 'red');
    $('#white').classList.toggle('winner', b.winner === 'white');
    tick();
  }

  function tick() {
    if (!state || !state.board) return;
    const t = state.timer;
    const st = L.timerStatus(t);
    $('#timer').textContent = u.fmtClock(L.remainingMs(t) / 1000);
    const win = !!state.board.winner;
    $('#state').textContent = win ? 'бой окончен' : STATES[st];
    document.body.className = [win ? 'has-winner' : '', st, state.board.code ? '' : 'no-data'].join(' ');
  }
  setInterval(tick, 200);

  if (!tatamiId) {
    $('#waitTitle').textContent = 'Не выбрано татами';
  } else {
    L.subscribe(tatamiId, s => { state = s; render(); });
  }

  const toggleFs = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {});
  $('#fs').onclick = toggleFs;
  document.addEventListener('keydown', e => { if (['f', 'F', 'а', 'А'].includes(e.key)) toggleFs(); });
  document.addEventListener('dblclick', toggleFs);
})(window.K);
