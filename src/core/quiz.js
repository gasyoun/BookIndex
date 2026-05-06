/**
 * @file quiz.js
 * @description Interactive Linguistics Quiz based on A.A. Zaliznyak's works
 */

export const QUIZ_LEVELS = [
  {
    id: 1,
    title: "Уровень 1: Историческая лингвистика (Начинающий)",
    questions: [
      {
        text: "Какое слово является этимологическим родственником русского 'глаз' в немецком языке (через значение 'шар')?",
        options: ["Glass", "Kugel", "Glanz"],
        answer: 1
      },
      {
        text: "С каким латинским словом родственно русское 'солнце'?",
        options: ["Luna", "Sol", "Stella"],
        answer: 1
      }
    ]
  },
  {
    id: 2,
    title: "Уровень 2: Берестяные грамоты и новгородский диалект (Средний)",
    questions: [
      {
        text: "Отсутствие какого процесса является уникальной чертой древненовгородского диалекта?",
        options: ["Первая палатализация", "Вторая палатализация", "Третья палатализация"],
        answer: 1
      },
      {
        text: "Согласно закону Вакернагеля, где в предложении должны стоять краткие формы местоимений (энклитики)?",
        options: ["В самом конце", "В самом начале", "После первого ударного слова"],
        answer: 2
      }
    ]
  },
  {
    id: 3,
    title: "Уровень 3: Текстология и 'Слово о полку Игореве' (Продвинутый)",
    questions: [
      {
        text: "Почему 'Слово...' не могло быть подделкой XVIII века с лингвистической точки зрения?",
        options: ["Слишком длинный текст", "Точное соблюдение правил постановки энклитик, неизвестных в XVIII веке", "Упоминание реальных князей"],
        answer: 1
      }
    ]
  },
  {
    id: 4,
    title: "Уровень 4: Грамматика и Акцентология (Эксперт)",
    questions: [
      {
        text: "Что означает индекс в Грамматическом словаре Зализняка?",
        options: ["Год издания слова", "Тип склонения и схема ударения", "Частота употребления"],
        answer: 1
      }
    ]
  }
];

let currentScore = 0;

export function checkAnswer(levelId, questionIdx, optionIdx) {
  const level = QUIZ_LEVELS.find(l => l.id === levelId);
  const q = level.questions[questionIdx];
  const isCorrect = q.answer === optionIdx;
  if (isCorrect) currentScore += 10;
  return isCorrect;
}
