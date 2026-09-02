/**
 * Module Từ Điển & Quản lý Từ Vựng N3
 */

import { getAllVocabulary, getMasteredIds, getBookmarkedIds, toggleMasteredStatus, toggleBookmarkStatus, addCustomWord, deleteCustomWord } from './storage.js';
import { speakJapanese } from './audio.js';

let dictionaryState = {
  searchTerm: '',
  categoryFilter: ['all'],
  statusFilter: 'all' // 'all', 'mastered', 'unmastered', 'bookmarked', 'custom'
};

/**
 * Lấy danh sách từ vựng theo điều kiện lọc và tìm kiếm
 */
export function getFilteredVocabulary() {
  const all = getAllVocabulary();
  const masteredIds = getMasteredIds();
  const bookmarkedIds = getBookmarkedIds();

  const term = dictionaryState.searchTerm.trim().toLowerCase();

  return all.filter(item => {
    // Filter Category (Multi-select)
    if (!dictionaryState.categoryFilter.includes('all') && !dictionaryState.categoryFilter.includes(item.category)) {
      return false;
    }

    // Filter Status
    if (dictionaryState.statusFilter === 'mastered' && !masteredIds.includes(item.id)) return false;
    if (dictionaryState.statusFilter === 'unmastered' && masteredIds.includes(item.id)) return false;
    if (dictionaryState.statusFilter === 'bookmarked' && !bookmarkedIds.includes(item.id)) return false;
    if (dictionaryState.statusFilter === 'custom' && !item.id.startsWith('user_')) return false;

    // Search term matching (Kanji, Hiragana, Hán Việt, Meaning)
    if (!term) return true;

    return (
      (item.kanji && item.kanji.toLowerCase().includes(term)) ||
      (item.hiragana && item.hiragana.toLowerCase().includes(term)) ||
      (item.hanviet && item.hanviet.toLowerCase().includes(term)) ||
      (item.meaning && item.meaning.toLowerCase().includes(term)) ||
      (item.category && item.category.toLowerCase().includes(term))
    );
  });
}

/**
 * Cập nhật bộ lọc tìm kiếm
 */
export function setDictionaryFilters(filters = {}) {
  if (filters.searchTerm !== undefined) dictionaryState.searchTerm = filters.searchTerm;
  if (filters.categoryFilter !== undefined) dictionaryState.categoryFilter = filters.categoryFilter;
  if (filters.statusFilter !== undefined) dictionaryState.statusFilter = filters.statusFilter;

  return getFilteredVocabulary();
}

/**
 * Trích xuất danh sách tất cả các Category độc nhất
 */
export function getCategories() {
  const all = getAllVocabulary();
  const categories = new Set(all.map(w => w.category).filter(Boolean));
  return Array.from(categories);
}

/**
 * Thêm từ mới từ form
 */
export function handleAddNewWord(formData) {
  if (!formData.hiragana || !formData.meaning) {
    return { success: false, error: 'Vui lòng nhập phiên âm Hiragana và Nghĩa tiếng Việt.' };
  }

  const newWord = addCustomWord(formData);
  return { success: true, word: newWord };
}

/**
 * Import danh sách từ vựng từ JSON string (có thể đè Tên Danh Mục / Chương)
 */
export function importWordsFromJSON(jsonString, overrideCategory = '') {
  try {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) {
      return { success: false, error: 'Dữ liệu không phải là mảng hợp lệ.' };
    }

    let addedCount = 0;
    data.forEach(item => {
      if (item.hiragana && item.meaning) {
        const cat = overrideCategory.trim() || item.category || 'Tự Nhập';
        addCustomWord({
          kanji: item.kanji || '',
          hiragana: item.hiragana,
          hanviet: item.hanviet || '',
          meaning: item.meaning,
          category: cat,
          example_jp: item.example_jp || '',
          example_vi: item.example_vi || ''
        });
        addedCount++;
      }
    });

    return { success: true, count: addedCount };
  } catch (e) {
    return { success: false, error: 'Cú pháp JSON không hợp lệ.' };
  }
}
