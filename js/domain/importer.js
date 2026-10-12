/* Импорт участников из Excel (через библиотеку SheetJS в vendor/xlsx.full.min.js). */
(function (K) {
  // Колонки файла → поля участника. Ключ — заголовок без пробелов и знаков, в нижнем регистре.
  const COLUMNS = [
    { field: 'fio', title: 'ФИО', keys: ['фио', 'фамилияимяотчество', 'фамилияимя', 'участник'], required: true },
    { field: 'sex', title: 'Пол (М/Ж)', keys: ['пол', 'полмж'], required: true },
    { field: 'birth', title: 'Дата рождения', keys: ['датарождения', 'дата', 'др', 'годрождения'] },
    { field: 'age', title: 'Возраст', keys: ['возраст', 'летвозраст'] },
    { field: 'weight', title: 'Вес', keys: ['вес', 'весkg', 'веской', 'вескг'], required: true },
    { field: 'rank', title: 'Кю/дан', keys: ['кюдан', 'кю', 'дан', 'разряд', 'пояс'] },
    { field: 'region', title: 'Регион', keys: ['регион', 'область'] },
    { field: 'city', title: 'Город', keys: ['город'] },
    { field: 'club', title: 'Клуб', keys: ['клуб', 'команда'] },
    { field: 'coach', title: 'Тренер', keys: ['тренер'] },
    { field: 'kumite', title: 'Кумите', keys: ['кумите'] },
    { field: 'country', title: 'Страна', keys: ['страна', 'country'], optional: true },
  ];
  const norm = s => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');

  function mapHeaders(headers) {
    const map = {};
    headers.forEach((h, i) => {
      const n = norm(h);
      const col = COLUMNS.find(c => c.keys.includes(n));
      if (col && map[col.field] == null) map[col.field] = i;
    });
    return map;
  }

  function parseSex(v) {
    const s = norm(v);
    if (/^(м|m|муж|мужской|мальчик)/.test(s)) return 'M';
    if (/^(ж|f|w|жен|женский|девочка)/.test(s)) return 'F';
    return null;
  }

  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return K.u.toISO(v);
    if (typeof v === 'number' && window.XLSX) {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const m = String(v).trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (m) {
      let y = +m[3]; if (y < 100) y += y > 30 ? 1900 : 2000;
      return `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
    }
    const iso = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }

  const parseNum = v => {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.]/g, ''));
    return isNaN(n) ? null : n;
  };

  function parseYes(v) {
    const s = norm(v);
    if (!s) return false;
    return !['нет', 'no', '0', 'false', 'н'].includes(s);
  }

  const clean = v => String(v ?? '').trim().replace(/\s+/g, ' ');

  /* Читаем файл → { headers, map, missing, rows: [{ data, errors[], warnings[] }] } */
  async function readFile(file, tournament) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const sheetName = wb.SheetNames[0];
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
    // Заголовки — первая строка, где нашлось «ФИО»
    let hi = aoa.findIndex(r => r.some(c => COLUMNS[0].keys.includes(norm(c))));
    if (hi < 0) hi = 0;
    const headers = (aoa[hi] || []).map(clean);
    const map = mapHeaders(headers);
    const missing = COLUMNS.filter(c => !c.optional && map[c.field] == null).map(c => c.title);

    const rows = [];
    for (let r = hi + 1; r < aoa.length; r++) {
      const raw = aoa[r];
      if (!raw || raw.every(c => clean(c) === '')) continue;
      const get = f => map[f] == null ? '' : raw[map[f]];
      const p = {
        fio: clean(get('fio')),
        sex: parseSex(get('sex')),
        birth: parseDate(get('birth')),
        age: parseNum(get('age')),
        weight: parseNum(get('weight')),
        rank: clean(get('rank')),
        region: clean(get('region')),
        city: clean(get('city')),
        club: clean(get('club')),
        coach: clean(get('coach')),
        kumite: map.kumite == null ? true : parseYes(get('kumite')),
        country: (clean(get('country')) || tournament.country || K.db.settings.defaultCountry || '').toUpperCase().slice(0, 3),
      };
      if (p.age != null) p.age = Math.round(p.age);
      rows.push({ line: r + 1, data: p, ...validate(p, tournament) });
    }
    return { sheetName, headers, map, missing, rows };
  }

  function validate(p, tournament) {
    const errors = [], warnings = [];
    if (!p.fio) errors.push('Нет ФИО');
    if (!p.sex) errors.push('Пол не М/Ж');
    if (p.weight == null) errors.push('Нет веса');
    else if (p.weight < 10 || p.weight > 200) warnings.push(`Странный вес: ${p.weight}`);
    const calc = K.categories.ageOn(p.birth, tournament.date);
    if (calc == null && p.age == null) warnings.push('Нет даты рождения и возраста');
    if (calc != null && p.age != null && calc !== p.age) warnings.push(`Возраст ≠ дата рождения (${calc})`);
    let category = '';
    if (!errors.length) {
      const c = K.categories.classify(p, tournament);
      if (!c) warnings.push('Нет возрастной группы в настройках');
      else if (!c.wc) warnings.push(`Нет категории для ${K.u.fmtWeightRu(p.weight)} кг`);
      else category = K.categories.makeName('kumite', c.group, c.wc);
    }
    return { errors, warnings, category };
  }

  // Повтор: то же ФИО и дата рождения в этом турнире
  const sameKey = p => norm(p.fio) + '|' + (p.birth || '');

  function commit(tournamentId, rows) {
    const existing = new Set(K.db.participantsOf(tournamentId).map(sameKey));
    let added = 0, dup = 0;
    for (const r of rows) {
      if (r.errors.length) continue;
      if (existing.has(sameKey(r.data))) { dup++; continue; }
      existing.add(sameKey(r.data));
      K.db.data.participants.push({ id: K.db.uid('p'), tournamentId, ...r.data });
      added++;
    }
    return { added, dup };
  }

  function downloadTemplate() {
    const head = COLUMNS.filter(c => !c.optional).map(c => c.title).concat('Страна');
    const sample = ['Иванов Иван Иванович', 'М', '14.03.2017', 9, 29.3, '9 кю', 'Алматы', 'Алматы', 'Сэмпай', 'Петров П. П.', 'да', 'KAZ'];
    const ws = XLSX.utils.aoa_to_sheet([head, sample]);
    ws['!cols'] = head.map((h, i) => ({ wch: i === 0 ? 32 : 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Участники');
    XLSX.writeFile(wb, 'шаблон_участники.xlsx');
  }

  K.importer = { COLUMNS, readFile, commit, downloadTemplate };
})(window.K);
