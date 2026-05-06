/**
 * @file export.js
 * @description Export utilities for researcher data (Markdown, BibTeX)
 */

import { getAllNotes } from '../core/storage.js';

/**
 * Export all researcher notes as a single Markdown file.
 */
export function generateEntityJsonLd(item, type) {
  if (!item) return '';
  const ld = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "name": item.head || item.name,
    "description": item.description,
    "inDefinedTermSet": "https://zaliznyak.philology.ru/corpus",
    "termCode": `${type}:${item.head}`
  };
  return JSON.stringify(ld, null, 2);
}

export async function exportAllNotesMarkdown() {
  const notes = await getAllNotes();
  if (!notes || notes.length === 0) {
    alert('Нет заметок для экспорта.');
    return;
  }
  
  let md = `# Исследовательские заметки: Zalizniakiada\n\n`;
  md += `Дата экспорта: ${new Date().toLocaleDateString()}\n\n---\n\n`;
  
  notes.forEach(note => {
    const [type, head] = note.id.split(':');
    md += `## [${type}] ${head}\n\n`;
    md += `${note.text}\n\n`;
    md += `*Обновлено: ${new Date(note.updatedAt).toLocaleString()}*\n\n---\n\n`;
  });
  
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zalizniakiada_research_notes_${new Date().toISOString().slice(0,10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCurrentCardMarkdown() {
  // logic to export single card...
}
