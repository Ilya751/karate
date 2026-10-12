/* Импорт участников из Excel: выбор файла, проверка строк, загрузка в турнир. */
(function (K) {
  const { db, u, importer: I } = K;
  const { $, $$, esc, icon, plural } = u;
  db.load();

  let tournament = db.tournament(u.params().t);
  let parsed = null, rowFilter = 'all';

  /* ---------- Турнир ---------- */
  function setTournament(t) {
    tournament = t;
    $('#crumbT').textContent = t ? t.title : 'Турнир не выбран';
    $('#cancelBtn').href = 'index.html';
    if (parsed && t) reparse();
  }
  if (!tournament) {
    const list = db.data.tournaments;
    if (!list.length) {
      $('#tPick').hidden = false;
      $('#tPick').innerHTML = `<div class="note warn">${icon('alert')}<div>Сначала <a href="index.html" style="text-decoration:underline">создайте турнир</a>, потом загружайте участников.</div></div>`;
    } else {
      $('#tPick').hidden = false;
      $('#tSelect').innerHTML = list.map(t => `<option value="${t.id}">${esc(t.title)} · ${u.fmtDMY(t.date)}</option>`).join('');
      $('#tSelect').onchange = () => setTournament(db.tournament($('#tSelect').value));
      setTournament(list[0]);
    }
  } else setTournament(tournament);

  $('#colsHint').innerHTML = I.COLUMNS.map(c => `<code>${esc(c.title)}${c.optional ? ' (необяз.)' : ''}</code>`).join('');
  $('#templateBtn').onclick = () => I.downloadTemplate();

  /* ---------- Файл ---------- */
  let lastFile = null;
  async function handle(file) {
    if (!file) return;
    if (!tournament) { u.toast('Сначала выберите турнир', 'err'); return; }
    if (!window.XLSX) { u.toast('Не загрузилась библиотека для Excel (vendor/xlsx.full.min.js)', 'err'); return; }
    lastFile = file;
    try {
      parsed = await I.readFile(file, tournament);
    } catch (e) {
      console.error(e);
      u.toast('Не удалось прочитать файл. Это точно Excel?', 'err');
      return;
    }
    render();
  }
  const reparse = () => lastFile && handle(lastFile);

  $('#file').onchange = e => { handle(e.target.files[0]); e.target.value = ''; };
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => handle(e.dataTransfer.files[0]));
  $('#clearFile').onclick = () => { parsed = null; lastFile = null; render(); };

  /* ---------- Предпросмотр ---------- */
  const FIELDS = I.COLUMNS;
  function cell(r, c) {
    const d = r.data;
    switch (c.field) {
      case 'sex': return d.sex === 'M' ? 'М' : d.sex === 'F' ? 'Ж' : '';
      case 'birth': return u.fmtDMY(d.birth);
      case 'weight': return d.weight == null ? '—' : u.fmtWeightRu(d.weight);
      case 'kumite': return d.kumite ? 'да' : 'нет';
      default: return esc(d[c.field] ?? '');
    }
  }
  const badCell = (r, c) =>
    (c.field === 'weight' && r.errors.includes('Нет веса')) || (c.field === 'sex' && r.errors.includes('Пол не М/Ж'))
    || (c.field === 'fio' && r.errors.includes('Нет ФИО')) || (c.field === 'age' && r.warnings.some(w => w.startsWith('Возраст')));

  function render() {
    $('#result').hidden = !parsed;
    $('#actions').hidden = !parsed;
    $('#drop').parentElement.hidden = !!parsed;
    if (!parsed) return;

    const rows = parsed.rows;
    const ok = rows.filter(r => !r.errors.length && !r.warnings.length).length;
    const warn = rows.filter(r => !r.errors.length && r.warnings.length).length;
    const err = rows.filter(r => r.errors.length).length;
    $('#fileName').textContent = lastFile.name;
    $('#fileMeta').textContent = `Лист «${parsed.sheetName}» · ${rows.length} ${plural(rows.length, ['строка', 'строки', 'строк'])}`;
    $('#summary').innerHTML = `
      <div class="s"><b>${rows.length}</b><span>строк в файле</span></div>
      <div class="s ok"><b>${ok}</b><span>готовы к импорту</span></div>
      <div class="s warn"><b>${warn}</b><span>с предупреждениями</span></div>
      <div class="s err"><b>${err}</b><span>с ошибками, пропустим</span></div>`;

    $('#missing').hidden = !parsed.missing.length;
    $('#missing').innerHTML = `${icon('alert')}<div>В файле не нашлись колонки: <b>${parsed.missing.map(esc).join(', ')}</b>. Проверьте заголовки в первой строке.</div>`;

    const shown = FIELDS.filter(c => !c.optional || parsed.map[c.field] != null);
    $('#thead').innerHTML = `<tr><th></th>${shown.map(c => `<th>${esc(c.title)}<span class="map ${parsed.map[c.field] == null ? 'no' : ''}">${parsed.map[c.field] == null ? '✕ нет в файле' : '✓ найдено'}</span></th>`).join('')}<th>Категория</th></tr>`;

    const list = rows.filter(r => rowFilter === 'all' || (rowFilter === 'err' ? r.errors.length : !r.errors.length && r.warnings.length));
    $('#tbody').innerHTML = list.map(r => {
      const kind = r.errors.length ? 'err' : r.warnings.length ? 'warn' : 'ok';
      const flag = { ok: 'check-circle', warn: 'alert', err: 'x-circle' }[kind];
      const msg = [...r.errors, ...r.warnings];
      const catCell = msg.length
        ? `<span class="badge ${kind === 'err' ? 'badge-err' : 'badge-warn'}">${esc(msg.join('; '))}</span>`
        : esc(r.category);
      return `<tr class="${kind === 'ok' ? '' : kind}"><td><span class="row-flag ${kind}" title="Строка ${r.line}">${icon(flag, 'icon-sm')}</span></td>
        ${shown.map(c => `<td class="${['age', 'weight'].includes(c.field) ? 'num' : ''} ${badCell(r, c) ? 'bad' : ''}">${cell(r, c)}</td>`).join('')}
        <td>${catCell}</td></tr>`;
    }).join('') || `<tr><td colspan="${shown.length + 2}" class="muted" style="padding:20px">Таких строк нет</td></tr>`;

    const n = ok + warn;
    $('#importLabel').textContent = `Импортировать ${n} ${plural(n, ['участника', 'участников', 'участников'])}`;
    $('#importBtn').disabled = !n || parsed.missing.some(m => ['ФИО', 'Вес', 'Пол (М/Ж)'].includes(m));
  }

  $('#rowFilter').addEventListener('click', e => {
    const b = e.target.closest('[data-rf]'); if (!b) return;
    rowFilter = b.dataset.rf;
    $$('#rowFilter button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });

  /* ---------- Импорт ---------- */
  $('#importBtn').onclick = () => {
    if (!parsed || !tournament) return;
    const { added, dup } = I.commit(tournament.id, parsed.rows);
    let created = 0;
    if ($('#auto').checked) created = K.categories.autoDistribute(tournament.id, 'kumite');
    db.save();
    const msg = [`Добавлено ${added} ${plural(added, ['участник', 'участника', 'участников'])}`];
    if (dup) msg.push(`повторов пропущено: ${dup}`);
    if (created) msg.push(`создано ${created} ${plural(created, ['категория', 'категории', 'категорий'])}`);
    u.toast(msg.join(', '));
    const first = db.tatamis()[0];
    setTimeout(() => { location.href = u.url('tournament.html', { t: tournament.id, d: 'kumite', tatami: first && first.id }); }, 900);
  };
})(window.K);
