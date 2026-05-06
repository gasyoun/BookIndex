/**
 * @file achievements.js
 * @description Gamification and Achievement system for Zalizniakiada v17.5
 */

import { saveNote, getNote } from './storage.js';

export const ACHIEVEMENTS = [
  { id: 'first_note', title: 'Первое открытие', desc: 'Напишите свою первую заметку к термину', icon: '📝' },
  { id: 'quiz_master', title: 'Магистр лингвистики', desc: 'Пройдите все уровни теста без ошибок', icon: '🎓' },
  { id: 'polyglot', title: 'Полиглот', desc: 'Посетите карточки 10 разных языков', icon: '🌍' },
  { id: 'beresto_fan', title: 'Берестолог', desc: 'Изучите 5 берестяных грамот', icon: '📜' },
  { id: 'navigator', title: 'Великий навигатор', desc: 'Воспользуйтесь перекрестной ссылкой 20 раз', icon: '⚓' },
  { id: 'night_watch', title: 'Ночной дозор', desc: 'Занимались лингвистикой глубокой ночью', icon: '🌙', secret: true },
  { id: 'easter_egg', title: 'Искатель секретов', desc: 'Нашли скрытую кнопку в подвале', icon: '🥚', secret: true }
];

/**
 * Check and unlock achievements based on user actions.
 */
export async function checkAchievements(actionType, data) {
  const unlocked = JSON.parse(localStorage.getItem('unlocked_achievements') || '[]');
  const newUnlocks = [];
  
  if (actionType === 'note_saved' && !unlocked.includes('first_note')) {
    newUnlocks.push('first_note');
  }
  
  if (actionType === 'app_opened') {
    const hour = new Date().getHours();
    if ((hour >= 0 && hour <= 4) && !unlocked.includes('night_watch')) {
      newUnlocks.push('night_watch');
    }
  }
  
  if (actionType === 'easter_egg_clicked' && !unlocked.includes('easter_egg')) {
    newUnlocks.push('easter_egg');
  }
  
  if (actionType === 'language_visited') {
    const visited = JSON.parse(localStorage.getItem('visited_languages') || '[]');
    if (!visited.includes(data.id)) visited.push(data.id);
    localStorage.setItem('visited_languages', JSON.stringify(visited));
    if (visited.length >= 10 && !unlocked.includes('polyglot')) {
      newUnlocks.push('polyglot');
    }
  }

  if (newUnlocks.length > 0) {
    const total = [...unlocked, ...newUnlocks];
    localStorage.setItem('unlocked_achievements', JSON.stringify(total));
    return newUnlocks.map(id => ACHIEVEMENTS.find(a => a.id === id));
  }
  
  return [];
}
