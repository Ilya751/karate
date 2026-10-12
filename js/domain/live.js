/* Текущий бой и таймер на татами + передача их на табло.
   Состояние лежит в localStorage (ключ на каждое татами), поэтому табло
   в отдельном окне видит изменения сразу и переживает перезагрузку. */
(function (K) {
  const PREFIX = 'karate.live.';
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('karate-live') : null;

  const key = tatamiId => PREFIX + tatamiId;

  function read(tatamiId) {
    try { return JSON.parse(localStorage.getItem(key(tatamiId))) || null; } catch (e) { return null; }
  }

  const popups = new Set();
  function write(state) {
    const s = { ...state, updatedAt: Date.now() };
    try { localStorage.setItem(key(s.tatamiId), JSON.stringify(s)); } catch (e) { /* место кончилось */ }
    if (channel) channel.postMessage(s);
    popups.forEach(w => { if (w.closed) popups.delete(w); else w.postMessage({ karateLive: s }, '*'); });
    return s;
  }

  // Табло подписывается на своё татами. Три канала — на случай,
  // если браузер не поддерживает какой-то из них при открытии файла с диска.
  function subscribe(tatamiId, fn) {
    let last = 0;
    const take = s => { if (s && s.tatamiId === tatamiId && (s.updatedAt || 0) >= last) { last = s.updatedAt || 0; fn(s); } };
    window.addEventListener('storage', e => { if (e.key === key(tatamiId) && e.newValue) take(JSON.parse(e.newValue)); });
    if (channel) channel.addEventListener('message', e => take(e.data));
    window.addEventListener('message', e => { if (e.data && e.data.karateLive) take(e.data.karateLive); });
    take(read(tatamiId));
  }

  function openBoard(tatamiId) {
    const w = window.open(K.u.url('scoreboard.html', { tatami: tatamiId }), 'karate-board-' + tatamiId, 'popup,width=1280,height=720');
    if (w) popups.add(w);
    return w;
  }
  const boardOpen = () => [...popups].some(w => !w.closed);

  /* ---------- Таймер ----------
     { duration: сек, remainingMs, running, startedAt } — время считаем от startedAt,
     чтобы таймер не «уплывал» и одинаково шёл на сайте и на табло. */
  const newTimer = duration => ({ duration, remainingMs: duration * 1000, running: false, startedAt: null });
  const remainingMs = t => !t ? 0 : t.running ? Math.max(0, t.remainingMs - (Date.now() - t.startedAt)) : t.remainingMs;
  const timerStatus = t => {
    if (!t) return 'ready';
    const left = remainingMs(t);
    if (left <= 0) return 'over';
    if (t.running) return 'running';
    return left < t.duration * 1000 ? 'paused' : 'ready';
  };
  const startTimer = t => (t.running || remainingMs(t) <= 0) ? t : { ...t, running: true, startedAt: Date.now() };
  const pauseTimer = t => !t.running ? t : { ...t, running: false, remainingMs: remainingMs(t), startedAt: null };

  K.live = { read, write, subscribe, openBoard, boardOpen, newTimer, remainingMs, timerStatus, startTimer, pauseTimer };
})(window.K);
