/* Категории: подбор участников по полу, возрасту и весу, авто-распределение. */
(function (K) {
  const { db } = K;

  const DISCIPLINES = { kumite: 'Кумите', kata: 'Ката' };

  // Полных лет на дату турнира
  function ageOn(birthISO, onISO) {
    const b = K.u.parseISO(birthISO), d = K.u.parseISO(onISO) || new Date();
    if (!b) return null;
    let a = d.getFullYear() - b.getFullYear();
    if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
    return a;
  }

  // Возраст участника: по дате рождения, иначе из колонки «возраст»
  function participantAge(p, tournament) {
    const a = ageOn(p.birth, tournament && tournament.date);
    return a ?? p.age ?? null;
  }

  const ageLabel = g => g.ageTo >= 99 ? `${g.ageFrom}+` : (g.ageFrom === g.ageTo ? `${g.ageFrom}` : `${g.ageFrom}–${g.ageTo}`);

  // Весовые классы группы: [{min, max, label}]
  function weightClasses(g) {
    const ws = g.weights.slice().sort((a, b) => a - b);
    const list = ws.map((w, i) => ({ min: i ? ws[i - 1] : 0, max: w, label: `${w} кг`, key: String(w) }));
    if (g.plus && ws.length) list.push({ min: ws[ws.length - 1], max: null, label: `+${ws[ws.length - 1]} кг`, key: '+' + ws[ws.length - 1] });
    if (!ws.length) list.push({ min: 0, max: null, label: 'абсолютная', key: 'abs' });
    return list;
  }

  const inWeight = (w, min, max) => w != null && (min == null || w > min) && (max == null || w <= max);

  // Возрастная группа и весовой класс участника по настройкам
  function classify(p, tournament) {
    const age = participantAge(p, tournament);
    if (age == null || !p.sex) return null;
    const group = db.settings.ageGroups.find(g => g.sex === p.sex && age >= g.ageFrom && age <= g.ageTo);
    if (!group) return null;
    const wc = weightClasses(group).find(c => inWeight(p.weight, c.min, c.max));
    return wc ? { group, wc } : { group, wc: null };
  }

  function makeName(discipline, group, wc) {
    const parts = [DISCIPLINES[discipline], ageLabel(group), group.title];
    if (wc && wc.key !== 'abs') parts.push(wc.label);
    return parts.join(' ');
  }

  // Подходит ли участник под фильтры категории
  function matches(cat, p, tournament) {
    if (cat.discipline === 'kumite' && p.kumite === false) return false;
    if (cat.sex && p.sex !== cat.sex) return false;
    const age = participantAge(p, tournament);
    if (cat.ageFrom != null && (age == null || age < cat.ageFrom)) return false;
    if (cat.ageTo != null && (age == null || age > cat.ageTo)) return false;
    if (cat.weightMin != null || cat.weightMax != null) {
      if (!inWeight(p.weight, cat.weightMin, cat.weightMax)) return false;
    }
    return true;
  }

  function candidates(cat) {
    const t = db.tournament(cat.tournamentId);
    return db.participantsOf(cat.tournamentId).filter(p => matches(cat, p, t));
  }

  function create(fields) {
    const cat = {
      id: db.uid('cat'),
      letter: db.nextLetter(fields.tournamentId),
      fightTime: db.settings.fightTime,
      participantIds: [],
      fights: [],
      ...fields,
    };
    db.data.categories.push(cat);
    return cat;
  }

  function rebuild(cat) {
    const ps = cat.participantIds.map(db.participant).filter(Boolean);
    cat.participantIds = ps.map(p => p.id);
    cat.fights = K.bracket.generate(ps);
  }

  function remove(id) {
    db.data.categories = db.data.categories.filter(c => c.id !== id);
  }

  // Участник уже стоит в какой-то категории этой дисциплины?
  function assigned(tid, discipline) {
    const set = new Set();
    db.categoriesOf(tid, discipline).forEach(c => c.participantIds.forEach(id => set.add(id)));
    return set;
  }

  /* Авто-распределение: для каждого возрастного и весового класса, где есть участники,
     создаём категорию (или дополняем существующую с такими же фильтрами) и строим сетку. */
  function autoDistribute(tid, discipline = 'kumite', tatamiId = null) {
    const t = db.tournament(tid);
    const taken = assigned(tid, discipline);
    const tatamis = db.tatamis();
    const buckets = new Map();
    for (const p of db.participantsOf(tid)) {
      if (taken.has(p.id)) continue;
      if (discipline === 'kumite' && p.kumite === false) continue;
      const c = classify(p, t);
      if (!c || !c.wc) continue;
      const key = c.group.id + '|' + c.wc.key;
      if (!buckets.has(key)) buckets.set(key, { ...c, list: [] });
      buckets.get(key).list.push(p);
    }
    let created = 0, i = 0;
    const order = [...buckets.values()].sort((a, b) =>
      a.group.ageFrom - b.group.ageFrom
      || (a.group.sex === b.group.sex ? 0 : a.group.sex === 'M' ? -1 : 1)
      || (a.wc.max ?? 999) - (b.wc.max ?? 999));
    for (const b of order) {
      let cat = db.categoriesOf(tid, discipline).find(c => c.sex === b.group.sex && c.ageFrom === b.group.ageFrom
        && c.ageTo === b.group.ageTo && c.weightMin === b.wc.min && c.weightMax === b.wc.max);
      if (cat && K.bracket.hasResults(cat)) cat = null;
      if (!cat) {
        cat = create({
          tournamentId: tid, discipline, name: makeName(discipline, b.group, b.wc),
          sex: b.group.sex, ageFrom: b.group.ageFrom, ageTo: b.group.ageTo,
          weightMin: b.wc.min, weightMax: b.wc.max,
          tatamiId: tatamiId || (tatamis.length ? tatamis[i++ % tatamis.length].id : null),
        });
        created++;
      }
      cat.participantIds.push(...b.list.map(p => p.id));
      rebuild(cat);
    }
    return created;
  }

  K.categories = {
    DISCIPLINES, ageOn, participantAge, ageLabel, weightClasses, classify, makeName, matches, candidates,
    create, rebuild, remove, autoDistribute, assigned,
  };
})(window.K);
