/* Хранилище данных в localStorage браузера.
   Структура:
   {
     settings:     { fightTime, extraTime, warnAt, defaultCountry, ageGroups[], blocks[] },
     tournaments:  [{ id, title, place, date, cover, country }],
     participants: [{ id, tournamentId, fio, sex, birth, age, weight, rank, region, city, club, coach, kumite, country }],
     categories:   [{ id, tournamentId, letter, discipline, name, sex, ageFrom, ageTo, weightMin, weightMax,
                      tatamiId, fightTime, participantIds[], fights[] }]
   } */
(function (K) {
  const KEY = 'karate.db.v1';

  const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function defaults() {
    const g = (sex, ageFrom, ageTo, title, weights, plus = true) => ({ id: uid('ag'), sex, ageFrom, ageTo, title, weights, plus });
    return {
      version: 1,
      settings: {
        fightTime: 120,
        extraTime: 60,
        warnAt: 10,
        defaultCountry: 'KAZ',
        ageGroups: [
          g('M', 6, 7, 'мальчики', [20, 25, 30]),
          g('F', 6, 7, 'девочки', [20, 25]),
          g('M', 8, 9, 'мальчики', [25, 30, 35]),
          g('F', 8, 9, 'девочки', [24, 28]),
          g('M', 10, 11, 'мальчики', [30, 35, 40, 45]),
          g('F', 10, 11, 'девочки', [30, 34, 40]),
          g('M', 12, 13, 'юноши', [40, 45, 50, 55]),
          g('F', 12, 13, 'девушки', [40, 45, 50]),
          g('M', 14, 15, 'юноши', [50, 55, 60, 65]),
          g('F', 14, 15, 'девушки', [45, 50, 55]),
          g('M', 16, 17, 'юниоры', [60, 65, 70, 75]),
          g('F', 16, 17, 'юниорки', [50, 55, 60]),
          g('M', 18, 99, 'мужчины', [70, 80, 90]),
          g('F', 18, 99, 'женщины', [55, 60, 65]),
        ],
        blocks: [
          { id: uid('bl'), name: 'Блок А · Большой зал', tatamis: [{ id: uid('tt'), name: 'Татами 1' }, { id: uid('tt'), name: 'Татами 2' }] },
        ],
      },
      tournaments: [],
      participants: [],
      categories: [],
    };
  }

  let data = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : defaults();
    } catch (e) {
      console.error('Не удалось прочитать данные', e);
      data = defaults();
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.error(e);
      K.u.toast('Не удалось сохранить: в браузере закончилось место', 'err');
    }
  }

  // Если данные поменяли в другой вкладке — перечитываем
  function onExternalChange(fn) {
    window.addEventListener('storage', e => { if (e.key === KEY) { load(); fn(); } });
  }

  /* ---------- Выборки ---------- */
  const db = {
    KEY, uid, load, save, onExternalChange, defaults,
    get data() { return data || load(); },
    get settings() { return db.data.settings; },

    tournament: id => db.data.tournaments.find(t => t.id === id),
    participant: id => db.data.participants.find(p => p.id === id),
    category: id => db.data.categories.find(c => c.id === id),
    participantsOf: tid => db.data.participants.filter(p => p.tournamentId === tid),
    categoriesOf: (tid, discipline) => db.data.categories.filter(c => c.tournamentId === tid && (!discipline || c.discipline === discipline)),

    tatamis() {
      return db.settings.blocks.flatMap(b => b.tatamis.map(t => ({ ...t, blockId: b.id, blockName: b.name })));
    },
    tatami: id => db.tatamis().find(t => t.id === id),

    removeTournament(id) {
      const d = db.data;
      d.tournaments = d.tournaments.filter(t => t.id !== id);
      d.participants = d.participants.filter(p => p.tournamentId !== id);
      d.categories = d.categories.filter(c => c.tournamentId !== id);
      save();
    },

    // Следующая свободная буква для ID боёв внутри турнира
    nextLetter(tid) {
      const used = new Set(db.categoriesOf(tid).map(c => c.letter));
      for (let i = 0; ; i++) { const l = K.u.letterFor(i); if (!used.has(l)) return l; }
    },
  };

  K.db = db;
})(window.K);
