/**
 * Module Thẻ Ghi Nhớ 3D (Interactive Flashcards)
 */

import { getAllVocabulary, getMasteredIds, toggleMasteredStatus, toggleBookmarkStatus, getBookmarkedIds } from './storage.js';
import { speakJapanese } from './audio.js';

let flashcardState = {
  deck: [],
  currentIndex: 0,
  isFlipped: false,
  filter: 'all' // 'all', 'unmastered', 'bookmarked', or category name
};

/**
 * Khởi tạo bộ thẻ ghi nhớ
 */
export function initFlashcards(filter = 'all') {
  const allVocab = getAllVocabulary();
  const masteredIds = getMasteredIds();
  const bookmarkedIds = getBookmarkedIds();

  let filtered = [...allVocab];

  if (filter === 'unmastered') {
    filtered = filtered.filter(w => !masteredIds.includes(w.id));
  } else if (filter === 'bookmarked') {
    filtered = filtered.filter(w => bookmarkedIds.includes(w.id));
  } else if (filter !== 'all') {
    filtered = filtered.filter(w => w.category === filter);
  }

  // Shuffle deck
  filtered.sort(() => Math.random() - 0.5);

  flashcardState = {
    deck: filtered,
    currentIndex: 0,
    isFlipped: false,
    filter: filter
  };

  return getCurrentCardData();
}

/**
 * Lấy dữ liệu thẻ hiện tại
 */
export function getCurrentCardData() {
  if (flashcardState.deck.length === 0) {
    return { empty: true };
  }

  const word = flashcardState.deck[flashcardState.currentIndex];
  const masteredIds = getMasteredIds();
  const bookmarkedIds = getBookmarkedIds();

  return {
    empty: false,
    index: flashcardState.currentIndex + 1,
    total: flashcardState.deck.length,
    word: word,
    isFlipped: flashcardState.isFlipped,
    isMastered: masteredIds.includes(word.id),
    isBookmarked: bookmarkedIds.includes(word.id)
  };
}

/**
 * Lật thẻ
 */
export function flipCard() {
  if (flashcardState.deck.length === 0) return null;
  flashcardState.isFlipped = !flashcardState.isFlipped;
  
  if (flashcardState.isFlipped) {
    const word = flashcardState.deck[flashcardState.currentIndex];
    speakJapanese(word.kanji || word.hiragana);
  }

  return getCurrentCardData();
}

/**
 * Thẻ tiếp theo
 */
export function nextCard() {
  if (flashcardState.deck.length === 0) return null;
  flashcardState.currentIndex = (flashcardState.currentIndex + 1) % flashcardState.deck.length;
  flashcardState.isFlipped = false;
  return getCurrentCardData();
}

/**
 * Thẻ trước đó
 */
export function prevCard() {
  if (flashcardState.deck.length === 0) return null;
  flashcardState.currentIndex = (flashcardState.currentIndex - 1 + flashcardState.deck.length) % flashcardState.deck.length;
  flashcardState.isFlipped = false;
  return getCurrentCardData();
}

/**
 * Đánh dấu Đã thuộc / Chưa thuộc thẻ hiện tại
 */
export function toggleCardMastered() {
  if (flashcardState.deck.length === 0) return null;
  const word = flashcardState.deck[flashcardState.currentIndex];
  const newStatus = toggleMasteredStatus(word.id);
  return getCurrentCardData();
}

/**
 * Đánh dấu Yêu thích thẻ hiện tại
 */
export function toggleCardBookmark() {
  if (flashcardState.deck.length === 0) return null;
  const word = flashcardState.deck[flashcardState.currentIndex];
  toggleBookmarkStatus(word.id);
  return getCurrentCardData();
}
