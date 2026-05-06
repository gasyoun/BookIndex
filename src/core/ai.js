/**
 * @file ai.js
 * @description Linguistic AI Copilot for Zalizniakiada v15.0
 * Provides smart insights, etymological hypotheses, and cross-corpus connections.
 */

import { APP_DATA } from './state.js';
import { stemRussian, normalizeHeadForMatch } from '../utils/linguistics.js';

/**
 * Generate an "Insight" for a specific entity.
 * This simulates an AI assistant by performing deep cross-category analysis.
 */
export function getLinguisticInsight(head, type) {
  const qStem = stemRussian(normalizeHeadForMatch(head));
  const insights = [];
  
  // 1. Semantic Proximity Insight
  const semantic = (APP_DATA.semantic_links || {})[head] || [];
  if (semantic.length > 0) {
    insights.push(`Обнаружена высокая семантическая близость с термином "${semantic[0].head}" (${Math.round(semantic[0].score * 100)}%).`);
  }
  
  // 2. Cross-Category Morphological Connection
  const categories = ['lexicon', 'names', 'toponyms'];
  for (const cat of categories) {
    if (cat === type) continue;
    const items = APP_DATA[cat] || [];
    const match = items.find(it => stemRussian(normalizeHeadForMatch(it.head || '')) === qStem);
    if (match) {
      insights.push(`Замечена морфологическая связь с ${cat === 'names' ? 'личностью' : 'топонимом'} "${match.head}". Возможно общее происхождение.`);
    }
  }
  
  // 3. Frequency Analysis
  const item = (APP_DATA[type] || []).find(it => it.head === head);
  if (item && (item.page_list || []).length > 5) {
    insights.push(`Данный термин является высокочастотным для этого корпуса. Рекомендуется проверить его роль в ключевых лингвистических законах Зализняка.`);
  }

  return insights.length > 0 ? insights : ["Инсайтов пока нет, продолжайте исследование."];
}

/**
 * Bridge for external LLM API integration.
 */
export async function askLinguisticAI(prompt) {
  // Placeholder for future OpenAI/Anthropic integration
  return "Этот запрос будет передан языковой модели в будущих версиях v15.x";
}
