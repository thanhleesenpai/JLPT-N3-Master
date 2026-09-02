/**
 * Module Bài kiểm tra Gõ & Trắc nghiệm từ vựng (Quiz Engine)
 */

import { getAllVocabulary, recordQuizResult, incrementSessionCount, getSettings, updateProficiency } from './storage.js';
import { playCorrectSound, playIncorrectSound, playStreakSound } from './audio.js';
import { romajiToHiragana } from './romaji.js';

let quizState = {
  active: false,
  questions: [],
  currentIndex: 0,
  score: 0,
  streak: 0,
  userAnswers: [],
  mode: 'meaning_to_japanese',
  filterCategory: 'all',
  startTime: null,
  // Store the resolved mode for each question (important for mixed mode)
  resolvedModes: []
};

/**
 * Normalization helper for checking answers
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[！!？?。、]/g, '');
}

function normalizeHiragana(text) {
  const norm = normalizeText(text);
  return norm.replace(/[\u30a1-\u30f6]/g, match => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}

/**
 * Khởi tạo bài kiểm tra mới
 */
export function startQuiz(config = {}) {
  const allVocab = getAllVocabulary();
  let pool = [...allVocab];

  const categories = config.categories || ['all'];
  if (!categories.includes('all')) {
    pool = pool.filter(w => categories.includes(w.category));
  }

  // Shuffle pool
  pool.sort(() => Math.random() - 0.5);

  // Học cuốn chiếu: lấy toàn bộ từ trong pool thay vì giới hạn 10 từ
  const count = config.count || pool.length;
  const selectedVocab = pool.slice(0, count);

  const mode = config.mode || getSettings().quizMode || 'meaning_to_japanese';

  quizState = {
    active: true,
    questions: selectedVocab,
    currentIndex: 0,
    score: 0,
    streak: 0,
    userAnswers: [],
    mode: mode,
    filterCategory: categories,
    startTime: Date.now(),
    resolvedModes: []
  };

  return getCurrentQuestion();
}

/**
 * Lấy dữ liệu cho câu hỏi hiện tại
 */
export function getCurrentQuestion() {
  if (!quizState.active || quizState.currentIndex >= quizState.questions.length) {
    return null;
  }

  const word = quizState.questions[quizState.currentIndex];
  let actualMode = quizState.mode;

  if (actualMode === 'mixed') {
    // Use stored resolved mode for this question index (so it's consistent across calls)
    if (!quizState.resolvedModes[quizState.currentIndex]) {
      const modes = ['meaning_to_japanese', 'kanji_to_hiragana', 'kanji_to_multiple_choice'];
      quizState.resolvedModes[quizState.currentIndex] = modes[Math.floor(Math.random() * modes.length)];
    }
    actualMode = quizState.resolvedModes[quizState.currentIndex];
  }

  let prompt = '';
  let promptSub = '';
  let expectedType = 'japanese';
  let targetAnswer = '';
  let hintText = '';
  let choices = [];

  const allVocab = getAllVocabulary();

  switch (actualMode) {
    case 'kanji_to_hiragana':
      prompt = word.kanji || word.hiragana;
      promptSub = '';
      expectedType = 'hiragana';
      targetAnswer = word.hiragana;
      hintText = `Gồm ${word.hiragana.length} ký tự. Ký tự đầu: "${word.hiragana.charAt(0)}"`;
      break;

    case 'kanji_to_multiple_choice':
      prompt = word.kanji || word.hiragana;
      promptSub = '';
      expectedType = 'choice';
      targetAnswer = word.meaning;
      
      const distractors = allVocab
        .filter(w => w.id !== word.id && w.meaning !== word.meaning)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.meaning);
      
      choices = [word.meaning, ...distractors].sort(() => Math.random() - 0.5);
      break;

    case 'meaning_to_japanese':
    case 'meaning_to_hiragana':
    default:
      prompt = word.meaning;
      promptSub = '';
      expectedType = 'japanese';
      targetAnswer = word.kanji ? `${word.kanji} (${word.hiragana})` : word.hiragana;
      hintText = `Phiên âm gồm ${word.hiragana.length} âm: "${word.hiragana.charAt(0)}..."`;
      break;
  }

  return {
    index: quizState.currentIndex,
    total: quizState.questions.length,
    word: word,
    mode: actualMode,
    prompt: prompt,
    promptSub: promptSub,
    expectedType: expectedType,
    targetAnswer: targetAnswer,
    choices: choices,
    hintText: hintText,
    score: quizState.score,
    streak: quizState.streak
  };
}

/**
 * Kiểm tra đáp án người dùng gõ hoặc chọn (Chấp nhận tuyệt đối Kanji, Hiragana, Romaji)
 */
export function submitAnswer(rawInput) {
  if (!quizState.active) return null;

  const qData = getCurrentQuestion();
  if (!qData) return null;

  const word = qData.word;
  const raw = (rawInput || '').trim();
  if (!raw || !word) return null;

  let isCorrect = false;

  if (qData.expectedType === 'choice') {
    isCorrect = normalizeText(raw) === normalizeText(word.meaning);
  } else {
    // LUÔN chấp nhận cả Kanji LẪN Hiragana LẪN Romaji bất kể chế độ nào
    const kanjiTarget = (word.kanji || '').trim();
    const hiraTarget = (word.hiragana || '').trim();

    // So sánh trực tiếp (không qua normalize) trước - quan trọng nhất cho Kanji!
    if (kanjiTarget && raw === kanjiTarget) {
      isCorrect = true;
    } else if (hiraTarget && raw === hiraTarget) {
      isCorrect = true;
    } else {
      // So sánh qua normalize
      const normRaw = normalizeText(raw);
      const normRawHira = normalizeHiragana(raw);
      const normConverted = normalizeHiragana(romajiToHiragana(raw));
      const normKanji = normalizeText(kanjiTarget);
      const normHira = normalizeHiragana(hiraTarget);

      isCorrect = (normKanji && normRaw === normKanji) ||
                  (normHira && normRaw === normHira) ||
                  (normHira && normRawHira === normHira) ||
                  (normHira && normConverted === normHira) ||
                  (normKanji && normRawHira === normKanji) ||
                  (normKanji && normConverted === normKanji);
    }

    // Debug log để kiểm tra khi có lỗi
    console.log('[Quiz Debug] Input:', JSON.stringify(raw), '| Kanji:', JSON.stringify(kanjiTarget), '| Hiragana:', JSON.stringify(hiraTarget), '| Result:', isCorrect);
  }

  // Chế độ học cuốn chiếu: Trả lời sai bị ghim lại cuối hàng đợi
  if (!isCorrect) {
    quizState.questions.push(word);
    quizState.resolvedModes.push(qData.mode);
  }

  // Cập nhật độ thông thạo
  if (word.id) {
    updateProficiency(word.id, isCorrect);
  }

  if (isCorrect) {
    quizState.score += 10;
    quizState.streak += 1;
    if (quizState.streak >= 3) {
      playStreakSound();
    } else {
      playCorrectSound();
    }
  } else {
    quizState.streak = 0;
    playIncorrectSound();
  }

  recordQuizResult(isCorrect);

  const displayCorrect = word.kanji ? `${word.kanji}【${word.hiragana}】` : word.hiragana;

  const result = {
    isCorrect: isCorrect,
    userTyped: raw,
    correctAnswer: qData.expectedType === 'choice' ? word.meaning : displayCorrect,
    word: word,
    streak: quizState.streak,
    score: quizState.score
  };

  quizState.userAnswers.push({
    question: qData,
    userTyped: raw,
    isCorrect: isCorrect
  });

  return result;
}

/**
 * Chuyển sang câu hỏi tiếp theo
 */
export function nextQuestion() {
  if (!quizState.active) return null;
  quizState.currentIndex++;

  if (quizState.currentIndex >= quizState.questions.length) {
    return finishQuiz();
  }

  return getCurrentQuestion();
}

/**
 * Hoàn thành bài kiểm tra
 */
export function finishQuiz() {
  quizState.active = false;
  incrementSessionCount();

  const total = quizState.questions.length;
  const correctCount = quizState.userAnswers.filter(a => a.isCorrect).length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const timeTakenSeconds = Math.round((Date.now() - quizState.startTime) / 1000);

  return {
    total: total,
    correctCount: correctCount,
    incorrectCount: total - correctCount,
    percentage: percentage,
    score: quizState.score,
    timeTakenSeconds: timeTakenSeconds,
    userAnswers: quizState.userAnswers
  };
}

export function getQuizState() {
  return quizState;
}
