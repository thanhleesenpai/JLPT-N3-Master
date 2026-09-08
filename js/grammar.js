import { N3_GRAMMAR_DATA } from './grammar_data.js';
import { getGrammarStats, getGrammarLevel } from './storage.js';

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
    const level = getGrammarLevel(g.id);

    const card = document.createElement('div');
    card.className = `vocab-card ${level >= 5 ? 'mastered' : ''}`;
    
    // Tạo sao giống từ vựng
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span style="color: ${i <= level ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)'}; font-size: 0.85rem;">★</span>`;
    }

    // Display examples
    let exampleHtml = '';
    if (g.examples && g.examples.length > 0) {
      exampleHtml = `<div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.85rem; color: var(--text-muted);">
        <strong style="color: var(--accent-gold);">Ví dụ:</strong>
        <div style="margin-top: 0.3rem;">
          ${g.examples.map(ex => {
            if (typeof ex === 'object') {
              return `<div style="margin-bottom: 0.4rem;">
                <div style="font-size: 1rem; color: #fff;">${ex.furigana || ex.jp}</div>
                <div style="font-size: 0.82rem; color: var(--accent-gold); opacity: 0.9; margin-top: 0.1rem;">💡 ${ex.meaning}</div>
              </div>`;
            }
            return `<div style="color: #fff;">• ${ex}</div>`;
          }).join('')}
        </div>
      </div>`;
    }

    let structureHtml = g.structure ? `
      <div style="font-size: 0.82rem; color: var(--accent-cyan); background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 6px; padding: 3px 8px; margin: 0.35rem 0 0.45rem 0; display: inline-block; font-weight: 600;">
        🧩 Cấu trúc: ${g.structure}
      </div>
    ` : '';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div class="jp-word" style="font-size: 1.2rem; color: ${level >= 5 ? 'var(--accent-green)' : '#fff'}; margin-bottom: 0.3rem;">
          ${g.grammar}
        </div>
        <div style="display: flex; gap: 1px;">${starsHtml}</div>
      </div>
      <div class="vi-meaning" style="font-size: 0.95rem; margin-bottom: 0.2rem;">${meaningText}</div>
      ${structureHtml}
      ${exampleHtml}
    `;

    container.appendChild(card);
  });
}
