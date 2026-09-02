/**
 * Module Quản lý Dữ liệu Storage (Hỗ trợ LocalStorage & Firebase)
 */

import { INITIAL_N3_VOCABULARY } from './n3data.js';
import { db, doc, setDoc, getDoc } from './firebase-config.js';

const STORAGE_KEYS = {
  CUSTOM_WORDS: 'jlpt_n3_custom_words',
  MASTERED_IDS: 'jlpt_n3_mastered_ids',
  BOOKMARKED_IDS: 'jlpt_n3_bookmarked_ids',
  USER_STATS: 'jlpt_n3_user_stats',
  SETTINGS: 'jlpt_n3_settings',
  PROFICIENCY: 'jlpt_n3_proficiency'
};

// ==========================================
// BỘ NHỚ ĐỆM (IN-MEMORY CACHE)
// ==========================================
let currentUserUid = null;

let cache = {
  customWords: [],
  masteredIds: [],
  bookmarkedIds: [],
  userStats: { totalQuestions: 0, correctAnswers: 0, currentStreak: 0, bestStreak: 0, sessionsCompleted: 0 },
  settings: { romajiAutoConvert: false, soundEnabled: true, quizMode: 'meaning_to_japanese', quizCount: 10 },
  proficiency: {}
};

// Khởi tạo cache từ LocalStorage (Dùng khi chưa đăng nhập)
function initCacheFromLocal() {
  const getLocal = (key, defaultVal) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultVal;
    } catch(e) { return defaultVal; }
  };
  
  cache.customWords = getLocal(STORAGE_KEYS.CUSTOM_WORDS, []);
  cache.masteredIds = getLocal(STORAGE_KEYS.MASTERED_IDS, []);
  cache.bookmarkedIds = getLocal(STORAGE_KEYS.BOOKMARKED_IDS, []);
  cache.userStats = getLocal(STORAGE_KEYS.USER_STATS, { totalQuestions: 0, correctAnswers: 0, currentStreak: 0, bestStreak: 0, sessionsCompleted: 0 });
  cache.settings = getLocal(STORAGE_KEYS.SETTINGS, { romajiAutoConvert: false, soundEnabled: true, quizMode: 'meaning_to_japanese', quizCount: 10 });
  cache.proficiency = getLocal(STORAGE_KEYS.PROFICIENCY, {});
}
initCacheFromLocal();

// ==========================================
// CƠ CHẾ ĐỒNG BỘ (SYNC)
// ==========================================
let syncTimeout = null;

function saveToLocal() {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_WORDS, JSON.stringify(cache.customWords));
  localStorage.setItem(STORAGE_KEYS.MASTERED_IDS, JSON.stringify(cache.masteredIds));
  localStorage.setItem(STORAGE_KEYS.BOOKMARKED_IDS, JSON.stringify(cache.bookmarkedIds));
  localStorage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify(cache.userStats));
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(cache.settings));
  localStorage.setItem(STORAGE_KEYS.PROFICIENCY, JSON.stringify(cache.proficiency));
}

export function clearLocalDataOnLogout() {
  localStorage.removeItem(STORAGE_KEYS.CUSTOM_WORDS);
  localStorage.removeItem(STORAGE_KEYS.MASTERED_IDS);
  localStorage.removeItem(STORAGE_KEYS.BOOKMARKED_IDS);
  localStorage.removeItem(STORAGE_KEYS.USER_STATS);
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  localStorage.removeItem(STORAGE_KEYS.PROFICIENCY);
  initCacheFromLocal(); // Reset cache to empty defaults
}

function triggerSave() {
  // Luôn lưu local dự phòng
  saveToLocal();
  
  // Lưu lên Firestore nếu đã đăng nhập
  if (currentUserUid) {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', currentUserUid), cache);
        console.log('Đã đồng bộ dữ liệu lên Firestore');
      } catch (err) {
        console.error('Lỗi đồng bộ Firestore:', err);
      }
    }, 2000); // Debounce 2 giây
  }
}

export async function loadDataFromFirestore(uid) {
  currentUserUid = uid;
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Nạp vào Cache
      cache.customWords = data.customWords || [];
      cache.masteredIds = data.masteredIds || [];
      cache.bookmarkedIds = data.bookmarkedIds || [];
      cache.userStats = data.userStats || cache.userStats;
      cache.settings = data.settings || cache.settings;
      cache.proficiency = data.proficiency || {};
      
      // Đè xuống LocalStorage để đồng bộ 2 chiều
      saveToLocal();
      console.log('Đã nạp dữ liệu từ Firestore thành công');
    } else {
      // User mới -> Push dữ liệu Local hiện tại lên Firestore
      console.log('Tạo dữ liệu Firestore lần đầu cho user mới');
      triggerSave();
    }
  } catch (err) {
    console.error('Lỗi khi tải từ Firestore:', err);
  }
}

// ==========================================
// CÁC HÀM XỬ LÝ DỮ LIỆU (READ / WRITE)
// ==========================================

export function getAllVocabulary() {
  return [...INITIAL_N3_VOCABULARY, ...cache.customWords];
}

export function getCustomWords() {
  return cache.customWords;
}

export function addCustomWord(wordData) {
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
  cache.customWords.unshift(newWord);
  triggerSave();
  return newWord;
}

export function deleteCustomWord(id) {
  cache.customWords = cache.customWords.filter(w => w.id !== id);
  triggerSave();
}

export function addCustomWordsBulk(wordsArray) {
  const newWords = wordsArray.map(wordData => ({
    id: 'user_' + Date.now() + Math.random().toString(36).substr(2, 5),
    kanji: wordData.kanji.trim(),
    hiragana: wordData.hiragana.trim(),
    hanviet: wordData.hanviet.trim().toUpperCase(),
    meaning: wordData.meaning.trim(),
    category: wordData.category ? wordData.category.trim() : 'Từ mới thêm',
    example_jp: wordData.example_jp ? wordData.example_jp.trim() : '',
    example_vi: wordData.example_vi ? wordData.example_vi.trim() : ''
  }));
  
  cache.customWords = [...newWords, ...cache.customWords];
  triggerSave();
  return newWords;
}

export function deleteCustomCategories(categoriesArray) {
  cache.customWords = cache.customWords.filter(w => !categoriesArray.includes(w.category));
  triggerSave();
}

export function clearAllCustomWords() {
  cache.customWords = [];
  cache.masteredIds = [];
  cache.bookmarkedIds = [];
  cache.proficiency = {};
  cache.userStats = { totalQuestions: 0, correctAnswers: 0, currentStreak: 0, bestStreak: 0, sessionsCompleted: 0 };
  triggerSave();
}

export function getMasteredIds() {
  return cache.masteredIds;
}

export function toggleMasteredStatus(id) {
  const idx = cache.masteredIds.indexOf(id);
  if (idx >= 0) cache.masteredIds.splice(idx, 1);
  else cache.masteredIds.push(id);
  triggerSave();
  return cache.masteredIds.includes(id);
}

export function getBookmarkedIds() {
  return cache.bookmarkedIds;
}

export function toggleBookmarkStatus(id) {
  const idx = cache.bookmarkedIds.indexOf(id);
  if (idx >= 0) cache.bookmarkedIds.splice(idx, 1);
  else cache.bookmarkedIds.push(id);
  triggerSave();
  return cache.bookmarkedIds.includes(id);
}

export function getUserStats() {
  return cache.userStats;
}

export function recordQuizResult(isCorrect) {
  cache.userStats.totalQuestions++;
  if (isCorrect) {
    cache.userStats.correctAnswers++;
    cache.userStats.currentStreak++;
    if (cache.userStats.currentStreak > cache.userStats.bestStreak) {
      cache.userStats.bestStreak = cache.userStats.currentStreak;
    }
  } else {
    cache.userStats.currentStreak = 0;
  }
  triggerSave();
  return cache.userStats;
}

export function incrementSessionCount() {
  cache.userStats.sessionsCompleted++;
  triggerSave();
}

export function getSettings() {
  return cache.settings;
}

export function saveSettings(newSettings) {
  cache.settings = { ...cache.settings, ...newSettings };
  triggerSave();
  return cache.settings;
}

export function getProficiencyAll() {
  return cache.proficiency;
}

export function updateProficiency(id, isCorrect) {
  if (!cache.proficiency[id]) {
    cache.proficiency[id] = { correct: 0, wrong: 0, level: 0 };
  }
  if (isCorrect) {
    cache.proficiency[id].correct += 1;
    cache.proficiency[id].level = Math.min(5, cache.proficiency[id].level + 1);
  } else {
    cache.proficiency[id].wrong += 1;
    cache.proficiency[id].level = Math.max(0, cache.proficiency[id].level - 1);
  }
  triggerSave();
  return cache.proficiency[id];
}

export function getProficiencyLevel(id) {
  return cache.proficiency[id] ? cache.proficiency[id].level : 0;
}
