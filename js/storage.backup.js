/**
 * Module Quản lý Dữ liệu LocalStorage
 */

import { INITIAL_N3_VOCABULARY } from './n3data.js';

const STORAGE_KEYS = {
  CUSTOM_WORDS: 'jlpt_n3_custom_words',
  MASTERED_IDS: 'jlpt_n3_mastered_ids',
  BOOKMARKED_IDS: 'jlpt_n3_bookmarked_ids',
  USER_STATS: 'jlpt_n3_user_stats',
  SETTINGS: 'jlpt_n3_settings',
  PROFICIENCY: 'jlpt_n3_proficiency'
};

/**
 * Lấy toàn bộ từ vựng (Dữ liệu mặc định N3 + Từ vựng người dùng tự thêm)
 */
export function getAllVocabulary() {
  const customWords = getCustomWords();
  return [...INITIAL_N3_VOCABULARY, ...customWords];
}

/**
 * Lấy danh sách từ vựng do người dùng tự thêm
 */
export function getCustomWords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_WORDS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Lỗi đọc custom words:", e);
    return [];
  }
}

/**
 * Thêm một từ vựng mới
 */
export function addCustomWord(wordData) {
  const customWords = getCustomWords();
  const newWord = {
    id: 'user_' + Date.now(),
    kanji: wordData.kanji.trim(),
    hiragana: wordData.hiragana.trim(),
    hanviet: wordData.hanviet.trim().toUpperCase(),
    meaning: wordData.meaning.trim(),
    category: wordData.category ? wordData.category.trim() : 'Từ mới thêm',
    example_jp: wordData.example_jp ? wordData.example_jp.trim() : '',
    example_vi: wordData.example_vi ? wordData.example_vi.trim() : ''
  };

  customWords.unshift(newWord);
  localStorage.setItem(STORAGE_KEYS.CUSTOM_WORDS, JSON.stringify(customWords));
  return newWord;
}

/**
 * Xóa sạch toàn bộ từ vựng và dữ liệu học của người dùng
 */
export function clearAllCustomWords() {
  localStorage.removeItem(STORAGE_KEYS.CUSTOM_WORDS);
  localStorage.removeItem(STORAGE_KEYS.MASTERED_IDS);
  localStorage.removeItem(STORAGE_KEYS.BOOKMARKED_IDS);
  localStorage.removeItem(STORAGE_KEYS.USER_STATS);
}

/**
 * Xóa một từ vựng người dùng đã thêm
 */
export function deleteCustomWord(id) {
  let customWords = getCustomWords();
  customWords = customWords.filter(w => w.id !== id);
  localStorage.setItem(STORAGE_KEYS.CUSTOM_WORDS, JSON.stringify(customWords));
}

/**
 * Lấy danh sách ID các từ đã thuộc
 */
export function getMasteredIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MASTERED_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Đánh dấu hoặc hủy đánh dấu Đã thuộc một từ
 */
export function toggleMasteredStatus(id) {
  const mastered = getMasteredIds();
  const idx = mastered.indexOf(id);
  if (idx >= 0) {
    mastered.splice(idx, 1);
  } else {
    mastered.push(id);
  }
  localStorage.setItem(STORAGE_KEYS.MASTERED_IDS, JSON.stringify(mastered));
  return mastered.includes(id);
}

/**
 * Lấy danh sách từ yêu thích (Bookmarked)
 */
export function getBookmarkedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKED_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function toggleBookmarkStatus(id) {
  const bookmarked = getBookmarkedIds();
  const idx = bookmarked.indexOf(id);
  if (idx >= 0) {
    bookmarked.splice(idx, 1);
  } else {
    bookmarked.push(id);
  }
  localStorage.setItem(STORAGE_KEYS.BOOKMARKED_IDS, JSON.stringify(bookmarked));
  return bookmarked.includes(id);
}

/**
 * Thống kê người dùng (Stats)
 */
export function getUserStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_STATS);
    const defaultStats = {
      totalQuestions: 0,
      correctAnswers: 0,
      currentStreak: 0,
      bestStreak: 0,
      sessionsCompleted: 0
    };
    return raw ? { ...defaultStats, ...JSON.parse(raw) } : defaultStats;
  } catch (e) {
    return { totalQuestions: 0, correctAnswers: 0, currentStreak: 0, bestStreak: 0, sessionsCompleted: 0 };
  }
}

export function recordQuizResult(isCorrect) {
  const stats = getUserStats();
  stats.totalQuestions++;

  if (isCorrect) {
    stats.correctAnswers++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
  } else {
    stats.currentStreak = 0;
  }

  localStorage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify(stats));
  return stats;
}

export function incrementSessionCount() {
  const stats = getUserStats();
  stats.sessionsCompleted++;
  localStorage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify(stats));
}

/**
 * Đọc / Lưu Cài đặt
 */
export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const defaultSettings = {
      romajiAutoConvert: false,
      soundEnabled: true,
      quizMode: 'meaning_to_japanese', // 'meaning_to_japanese', 'kanji_to_hiragana', 'kanji_to_multiple_choice'
      quizCount: 10
    };
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch (e) {
    return { romajiAutoConvert: true, soundEnabled: true, quizMode: 'meaning_to_hiragana', quizCount: 10 };
  }
}

export function saveSettings(newSettings) {
  const current = getSettings();
  const updated = { ...current, ...newSettings };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  return updated;
}

/**
 * Lấy toàn bộ dữ liệu độ thông thạo (Proficiency)
 */
export function getProficiencyAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFICIENCY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Cập nhật độ thông thạo của 1 từ (Cộng/Trừ XP)
 * level từ 0 (Chưa thuộc) đến 5 (Khắc sâu)
 */
export function updateProficiency(id, isCorrect) {
  const profs = getProficiencyAll();
  if (!profs[id]) {
    profs[id] = { correct: 0, wrong: 0, level: 0 };
  }
  
  if (isCorrect) {
    profs[id].correct += 1;
    profs[id].level = Math.min(5, profs[id].level + 1); // Max level 5
  } else {
    profs[id].wrong += 1;
    profs[id].level = Math.max(0, profs[id].level - 1); // Min level 0
  }
  
  localStorage.setItem(STORAGE_KEYS.PROFICIENCY, JSON.stringify(profs));
  return profs[id];
}

/**
 * Lấy level của 1 từ (0 đến 5)
 */
export function getProficiencyLevel(id) {
  const profs = getProficiencyAll();
  return profs[id] ? profs[id].level : 0;
}
