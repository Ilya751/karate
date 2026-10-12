/* Демо-турнир, чтобы сразу попробовать сайт без своего Excel-файла. */
(function (K) {
  const LAST = ['Смирнов', 'Ахметов', 'Нурланов', 'Ковалёв', 'Сейтказы', 'Абдуллаев', 'Жумабеков', 'Литвинов', 'Бекмуратов',
    'Оспанов', 'Тулегенов', 'Ким', 'Исмаилов', 'Каримов', 'Орлов', 'Садыков', 'Ли', 'Ермеков', 'Попов', 'Касымов',
    'Волков', 'Мусин', 'Байжанов', 'Цой', 'Рахимов', 'Иванов', 'Сериков', 'Галиев', 'Пак', 'Мамедов'];
  const BOYS = ['Илья', 'Санжар', 'Ерлан', 'Артём', 'Алихан', 'Тимур', 'Даниял', 'Марк', 'Нурсултан', 'Айдар', 'Арсен', 'Богдан', 'Расул', 'Мирас', 'Максим', 'Адиль', 'Руслан', 'Ислам'];
  const GIRLS = ['Аружан', 'Дарья', 'Амина', 'Алия', 'Софья', 'Камила', 'Мадина', 'Анна', 'Айым', 'Ева', 'Томирис', 'Полина'];
  const CLUBS = [['Сэмпай', 'KAZ', 'Алматы'], ['Кайрат', 'KAZ', 'Алматы'], ['Барс', 'KAZ', 'Караганда'], ['Будо', 'RUS', 'Москва'],
    ['Сибирь', 'RUS', 'Новосибирск'], ['Ала-Тоо', 'KGZ', 'Бишкек'], ['Ташкент Кёкусин', 'UZB', 'Ташкент']];

  function seed() {
    const { db } = K;
    let r = 7;
    const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];

    const t = { id: db.uid('t'), title: 'Открытый кубок Алматы по карате киокушинкай', place: 'Алматы, Дворец спорта им. Балуана Шолака', date: K.u.todayISO(), cover: 'img/cover-1.svg', country: 'KAZ' };
    db.data.tournaments.push(t);

    const year = new Date().getFullYear();
    const make = (sex, age, wFrom, wTo, n) => {
      for (let i = 0; i < n; i++) {
        const [club, country, city] = pick(CLUBS);
        let last = pick(LAST);
        if (sex === 'F' && /(ов|ев|ёв|ин)$/.test(last)) last += 'а';
        const birth = `${year - age - 1}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`;
        const p = {
          id: db.uid('p'), tournamentId: t.id, fio: `${last} ${pick(sex === 'M' ? BOYS : GIRLS)}`, sex, birth, age: null,
          weight: Math.round((wFrom + rnd() * (wTo - wFrom)) * 10) / 10, rank: `${8 + Math.floor(rnd() * 3)} кю`,
          region: city, city, club, coach: '', kumite: true, country,
        };
        p.age = K.categories.ageOn(birth, t.date);
        db.data.participants.push(p);
      }
    };
    make('M', 8, 25.2, 29.9, 15);
    make('M', 8, 30.2, 34.8, 11);
    make('M', 8, 35.5, 40, 6);
    make('F', 8, 24.5, 27.9, 7);
    make('M', 10, 35.2, 39.8, 13);
    make('F', 10, 30.5, 33.9, 10);

    K.categories.autoDistribute(t.id, 'kumite');
    // Пара боёв уже проведена, чтобы было видно, как выглядит сетка в процессе
    const first = db.categoriesOf(t.id, 'kumite').find(c => c.participantIds.length === 15) || db.categoriesOf(t.id)[0];
    if (first) first.fights.filter(f => f.round === 1).slice(0, 4).forEach(f => K.bracket.setWinner(first, f.n, K.bracket.resolve(first, rnd() > 0.5 ? f.a : f.b)));
    db.save();
    return t;
  }

  K.demo = { seed };
})(window.K);
