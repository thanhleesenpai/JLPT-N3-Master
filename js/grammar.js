import { N3_GRAMMAR_DATA } from './grammar_data.js';
import { getGrammarStats } from './storage.js';

let grammarData = [...N3_GRAMMAR_DATA];

export function initGrammarTab() {
  renderGrammarList();

  const searchInput = document.getElementById('grammar-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      renderGrammarList(q);
    });
  }
}

function renderGrammarList(searchQuery = '') {
  const container = document.getElementById('grammar-list-grid');
  if (!container) return;

  container.innerHTML = '';
  const stats = getGrammarStats();

  const filtered = grammarData.filter(g => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return g.grammar.toLowerCase().includes(q) || 
           g.meaning.toLowerCase().includes(q) || 
           (g.examples && g.examples.some(ex => ex.toLowerCase().includes(q)));
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center;">Không tìm thấy ngữ pháp nào.</p>';
    return;
  }

  filtered.forEach(g => {
    const s = stats[g.id] || { cloze: { correct: 0 }, shadow: { correct: 0 }, scramble: { correct: 0 }, mastered: false };
    const isMastered = s.mastered;

    const card = document.createElement('div');
    card.className = `vocab-card ${isMastered ? 'mastered' : ''}`;
    
    // Display examples beautifully
    let exampleHtml = '';
    if (g.examples && g.examples.length > 0) {
      exampleHtml = `<div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.85rem; color: var(--text-muted);">
        <strong style="color: var(--accent-gold);">Ví dụ:</strong><br>
        ${g.examples.map(ex => `• ${ex}`).join('<br>')}
      </div>`;
    }

    // Meaning format
    let meaningText = g.meaning.replace(/\n/g, '<br>');

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div class="jp-word" style="font-size: 1.2rem; color: ${isMastered ? 'var(--accent-green)' : '#fff'}; margin-bottom: 0.5rem;">
          ${g.grammar}
        </div>
        ${isMastered ? '<span style="font-size: 1.2rem;" title="Đã Master">⭐</span>' : ''}
      </div>
      <div class="vi-meaning" style="font-size: 0.95rem;">${meaningText}</div>
      ${exampleHtml}
    `;

    // Add double click to edit (just placeholder for now)
    card.addEventListener('dblclick', () => {
      // In future: open edit modal
      console.log('Edit grammar:', g);
    });

    container.appendChild(card);
  });
}
