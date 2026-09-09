/**
 * App Controller - Điểm khởi chạy & Gắn sự kiện cho toàn bộ ứng dụng JLPT N3
 */

import { romajiToHiragana, attachRomajiInput } from './romaji.js';
import { playCorrectSound, playIncorrectSound, playStreakSound, speakJapanese, setSoundEnabled, isSoundEnabled } from './audio.js';
import { getSettings, saveSettings, toggleMasteredStatus, toggleBookmarkStatus, getMasteredIds, getBookmarkedIds, clearAllCustomWords, getProficiencyLevel, getProficiencyAll, deleteCustomCategories, getCustomWords, updateCustomWord, deleteCustomWord, getDailyStats, recordWordStudied, getStarDistribution, getUserStats, getAllVocabulary } from './storage.js';
import { startQuiz, getCurrentQuestion, submitAnswer, nextQuestion, finishQuiz, getQuizState } from './quiz.js';
import { initFlashcards, getCurrentCardData, flipCard, nextCard, prevCard, toggleCardMastered, toggleCardBookmark } from './flashcards.js';
import { getCategories, getFilteredVocabulary, setDictionaryFilters, handleAddNewWord, importWordsFromJSON } from './dictionary.js';
import { setupAuthUI } from './auth.js';
import { initCommunity, openPublishModal } from './community.js';
import { initGrammarTab } from './grammar.js';
import { initGrammarPractice } from './grammar_practice.js';

let isAnswerSubmitted = false;

function openEditWordModal(wordId) {
  if (window._openEditWordModal) {
    window._openEditWordModal(wordId);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupNavigation();
  setupQuickMenu();
  setupSoundToggle();
  setupQuizView();
  setupFlashcardView();
  setupDictionaryView();
  setupModalForms();

  updateAllCategoryDropdowns();
  startNewQuizSession();
  setupAuthUI();
  initCommunity();
  
  initGrammarTab();
  initGrammarPractice();

  // Lắng nghe sự kiện khi dữ liệu Firebase được tải xong để render lại UI
  window.addEventListener('jlptDataLoaded', () => {
    updateAllCategoryDropdowns();
    startNewQuizSession();
    renderDictionaryGrid();
    initGrammarTab();
  });
}

/* ==========================================================================
   NAVIGATION & TABS
   ========================================================================== */
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      navBtns.forEach(b => {
        if (b.dataset.tab === targetTab) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });

      tabPanes.forEach(p => p.classList.remove('active'));

      const pane = document.getElementById(`pane-${targetTab}`);
      if (pane) pane.classList.add('active');

      // Refresh view data upon entering tab
      if (targetTab === 'flashcards') {
        renderFlashcard();
      } else if (targetTab === 'dictionary') {
        renderDictionaryGrid();
      } else if (targetTab === 'quiz') {
        const input = document.getElementById('quiz-input');
        if (input) input.focus();
      }
    });
  });
}

function setupQuickMenu() {
  const btnTrigger = document.getElementById('btn-quick-menu');
  const dropdown = document.getElementById('quick-menu-dropdown');

  if (!btnTrigger || !dropdown) return;

  btnTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !btnTrigger.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });

  dropdown.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      dropdown.classList.remove('active');
    });
  });
}

function setupSoundToggle() {
  const btn = document.getElementById('btn-sound-toggle');
  const iconOn = document.getElementById('icon-sound-on');
  const iconOff = document.getElementById('icon-sound-off');

  const settings = getSettings();
  setSoundEnabled(settings.soundEnabled);
  updateSoundUI();

  btn.addEventListener('click', () => {
    const newState = !isSoundEnabled();
    setSoundEnabled(newState);
    saveSettings({ soundEnabled: newState });
    updateSoundUI();
  });

  function updateSoundUI() {
    const enabled = isSoundEnabled();
    iconOn.style.display = enabled ? 'inline' : 'none';
    iconOff.style.display = enabled ? 'none' : 'inline';
  }
}

/* ==========================================================================
   QUIZ VIEW CONTROLLER
   ========================================================================== */
function setupQuizView() {
  const quizInput = document.getElementById('quiz-input');
  const btnSubmit = document.getElementById('btn-quiz-submit');
  const btnHint = document.getElementById('btn-quiz-hint');
  const btnToggleRomaji = document.getElementById('btn-toggle-romaji');
  const btnRestart = document.getElementById('btn-restart-quiz');
  const modeSelect = document.getElementById('quiz-mode-select');
  const feedbackAudioBtn = document.getElementById('btn-play-sound-feedback');
  const btnToggleQuizSetup = document.getElementById('btn-toggle-quiz-setup');
  const quizSettingsBar = document.getElementById('quiz-settings-bar');
  const btnRestartMobile = document.getElementById('btn-restart-quiz-mobile');

  if (btnToggleQuizSetup && quizSettingsBar) {
    btnToggleQuizSetup.addEventListener('click', () => {
      quizSettingsBar.classList.toggle('is-open');
      const isOpen = quizSettingsBar.classList.contains('is-open');
      const arrow = btnToggleQuizSetup.querySelector('.toggle-icon');
      if (arrow) arrow.textContent = isOpen ? '▲' : '▼';
    });
  }

  if (btnRestartMobile) {
    btnRestartMobile.addEventListener('click', () => {
      startNewQuizSession();
      if (quizSettingsBar) quizSettingsBar.classList.remove('is-open');
      if (btnToggleQuizSetup) {
        const arrow = btnToggleQuizSetup.querySelector('.toggle-icon');
        if (arrow) arrow.textContent = '▼';
      }
    });
  }

  // Gắn bộ tự động chuyển đổi Romaji sang Hiragana thời gian thực
  attachRomajiInput(quizInput);

  // Romaji Mode Toggle Button (Mặc định TẮT)
  let romajiEnabled = false;
  if (quizInput) quizInput.dataset.romajiMode = 'false';

  btnToggleRomaji.addEventListener('click', () => {
    romajiEnabled = !romajiEnabled;
    quizInput.dataset.romajiMode = romajiEnabled ? 'true' : 'false';
    const badge = document.getElementById('romaji-status-badge');
    if (romajiEnabled) {
      badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; background:var(--accent-cyan); border-radius:50%;"></span> Romaji: Bật (<i>taberu</i> ➔ <i>たべる</i>)`;
      btnToggleRomaji.textContent = 'Tắt Romaji Auto';
    } else {
      badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; background:var(--text-muted); border-radius:50%;"></span> Romaji: Tắt (Dùng IME HĐH)`;
      btnToggleRomaji.textContent = 'Bật Romaji Auto';
    }
  });

  // Soft keyboard helper buttons
  document.querySelectorAll('.soft-keyboard .key-btn').forEach(keyBtn => {
    keyBtn.addEventListener('click', () => {
      const char = keyBtn.dataset.char;
      if (!char || !quizInput) return;
      const start = quizInput.selectionStart;
      const end = quizInput.selectionEnd;
      const text = quizInput.value;
      quizInput.value = text.substring(0, start) + char + text.substring(end);
      quizInput.setSelectionRange(start + char.length, start + char.length);
      quizInput.focus();
    });
  });

  // Submit / Next Question action
  btnSubmit.addEventListener('click', () => handleQuizSubmitOrNext());

  // Nhấn Enter lần 1: Xác nhận đáp án. Nhấn Enter lần 2: Tự chuyển sang câu tiếp theo!
  document.addEventListener('keydown', (e) => {
    // Tránh xung đột với IME (bộ gõ tiếng Nhật): keyCode 229 hoặc isComposing = true
    if (e.isComposing || e.keyCode === 229) return;
    
    const activePane = document.querySelector('.tab-pane.active');
    if (activePane && activePane.id === 'pane-quiz') {
      const activeModal = document.querySelector('.modal-overlay.active');
      if (!activeModal) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleQuizSubmitOrNext();
        } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
          // Bắt phím tắt A, B, C, D cho trắc nghiệm
          const mcContainer = document.getElementById('quiz-mc-container');
          if (mcContainer && mcContainer.style.display !== 'none' && !isAnswerSubmitted) {
            const index = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
            const btns = mcContainer.querySelectorAll('.mc-option-btn');
            if (btns && btns[index]) {
              e.preventDefault();
              btns[index].click();
            }
          }
        }
      }
    }
  });

  // Hint button
  btnHint.addEventListener('click', () => {
    const qData = getCurrentQuestion();
    if (qData && qData.hintText) {
      alert(`💡 GỢI Ý: ${qData.hintText}`);
    }
  });

  const quizCategorySelect = document.getElementById('quiz-category-select');

  const catBtn = document.getElementById('quiz-category-btn');
  const catDropdown = document.getElementById('quiz-category-dropdown');

  if (catBtn) {
    catBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      catDropdown.style.display = catDropdown.style.display === 'none' ? 'block' : 'none';
    });
    
    document.addEventListener('click', (e) => {
      if (!catBtn.contains(e.target) && !catDropdown.contains(e.target)) {
        catDropdown.style.display = 'none';
      }
    });

    catDropdown.addEventListener('change', (e) => {
      const allCb = document.getElementById('quiz-cat-all');
      const cbs = Array.from(document.querySelectorAll('.quiz-cat-cb'));
      
      if (e.target === allCb) {
        cbs.forEach(cb => cb.checked = false);
      } else {
        if (cbs.some(cb => cb.checked)) {
          allCb.checked = false;
        } else {
          allCb.checked = true;
        }
      }

      const selectedCats = allCb.checked ? ['all'] : cbs.filter(cb => cb.checked).map(cb => cb.value);
      catBtn.textContent = allCb.checked ? 'Chọn Chương (Tất cả) ▼' : `Đã chọn (${selectedCats.length}) ▼`;
      
      startNewQuizSession();
    });
  }

  // Mode select change
  modeSelect.addEventListener('change', () => {
    saveSettings({ quizMode: modeSelect.value });
    startNewQuizSession();
  });

  btnRestart.addEventListener('click', () => {
    startNewQuizSession();
  });

  feedbackAudioBtn.addEventListener('click', () => {
    const qData = getCurrentQuestion();
    if (qData) {
      speakJapanese(qData.word.kanji || qData.word.hiragana);
    }
  });
}

function startNewQuizSession() {
  const modeSelect = document.getElementById('quiz-mode-select');
  const wordCountSelect = document.getElementById('quiz-word-count');
  
  const allCb = document.getElementById('quiz-cat-all');
  const cbs = Array.from(document.querySelectorAll('.quiz-cat-cb'));
  
  const mode = modeSelect ? modeSelect.value : 'meaning_to_hiragana';
  let categories = ['all'];
  if (allCb && !allCb.checked) {
    categories = cbs.filter(cb => cb.checked).map(cb => cb.value);
    if (categories.length === 0) categories = ['all'];
  }

  const countValue = wordCountSelect ? wordCountSelect.value : 'all';
  const count = countValue === 'all' ? undefined : parseInt(countValue, 10);

  startQuiz({ mode: mode, categories: categories, count: count });
  isAnswerSubmitted = false;

  const feedbackBox = document.getElementById('quiz-feedback-box');
  if (feedbackBox) feedbackBox.style.display = 'none';

  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  const qData = getCurrentQuestion();
  const quizInput = document.getElementById('quiz-input');
  const inputWrapper = document.getElementById('quiz-input-wrapper');
  const mcContainer = document.getElementById('quiz-mc-container');
  const inputHelperBar = document.querySelector('.input-helper-bar');
  const softKeyboard = document.querySelector('.soft-keyboard');
  const promptMain = document.getElementById('quiz-prompt-main');
  const promptSub = document.getElementById('quiz-prompt-sub');
  const questionTag = document.getElementById('quiz-question-tag');
  const progressLabel = document.getElementById('quiz-progress-label');
  const progressBar = document.getElementById('quiz-progress-bar');
  const btnSubmit = document.getElementById('btn-quiz-submit');
  const feedbackBox = document.getElementById('quiz-feedback-box');

  if (!qData) {
    promptMain.innerHTML = `📭 Chưa Có Từ Vựng Nào`;
    promptSub.innerHTML = `Danh sách từ vựng hiện đang trống (0 từ). Vui lòng bấm <strong>+ Thêm Từ</strong> hoặc <strong>📥 Nhập Hàng Loạt</strong> để thêm từ mới!`;
    progressLabel.textContent = `Câu 0 / 0`;
    progressBar.style.width = `0%`;
    if (quizInput) {
      quizInput.value = '';
      quizInput.disabled = true;
    }
    if (inputWrapper) inputWrapper.style.display = 'none';
    if (mcContainer) mcContainer.style.display = 'none';
    if (btnSubmit) btnSubmit.disabled = true;
    if (feedbackBox) feedbackBox.style.display = 'none';
    return;
  }

  if (btnSubmit) btnSubmit.disabled = false;

  promptMain.textContent = qData.prompt;
  promptSub.textContent = '';
  promptSub.style.display = 'none'; // Ẩn thông tin phụ trước khi trả lời

  // Set tag
  if (questionTag) questionTag.style.display = 'inline-block';
  if (qData.mode === 'meaning_to_japanese') {
    questionTag.textContent = `CÂU ${qData.index + 1} • GÕ TIẾNG NHẬT (KANJI / HIRAGANA)`;
  } else if (qData.mode === 'kanji_to_hiragana') {
    questionTag.textContent = `CÂU ${qData.index + 1} • GÕ HIRAGANA`;
  } else if (qData.mode === 'kanji_to_multiple_choice') {
    questionTag.textContent = `CÂU ${qData.index + 1} • CHỌN 1 TRONG 4 NGHĨA`;
  } else {
    questionTag.textContent = `CÂU ${qData.index + 1} • KIỂM TRA N3`;
  }

  progressLabel.textContent = `Câu ${qData.index + 1} / ${qData.total}`;
  const pct = Math.round(((qData.index) / qData.total) * 100);
  progressBar.style.width = `${pct}%`;

  const streakCount = document.getElementById('quiz-streak-count');
  const scoreCount = document.getElementById('quiz-score-count');
  if (streakCount) streakCount.textContent = qData.streak;
  if (scoreCount) scoreCount.textContent = qData.score;

  feedbackBox.style.display = 'none';
  isAnswerSubmitted = false;

  // Render input vs Multiple Choice mode
  if (qData.expectedType === 'choice') {
    if (inputWrapper) inputWrapper.style.display = 'none';
    if (inputHelperBar) inputHelperBar.style.display = 'none';
    if (softKeyboard) softKeyboard.style.display = 'none';
    if (mcContainer) {
      mcContainer.style.display = 'grid';
      mcContainer.innerHTML = qData.choices.map((choice, idx) => `
        <button class="mc-option-btn" data-choice="${choice}">
          <span class="mc-badge">${['A', 'B', 'C', 'D'][idx]}</span>
          <span>${choice}</span>
        </button>
      `).join('');

      mcContainer.querySelectorAll('.mc-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (isAnswerSubmitted) return;
          mcContainer.querySelectorAll('.mc-option-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          handleQuizSubmitOrNext(btn.dataset.choice);
        });
      });
    }
    btnSubmit.style.display = 'none';
  } else {
    if (inputWrapper) inputWrapper.style.display = 'flex';
    if (inputHelperBar) inputHelperBar.style.display = 'flex';
    if (softKeyboard) softKeyboard.style.display = 'flex';
    if (mcContainer) mcContainer.style.display = 'none';
    const btnHint = document.getElementById('btn-quiz-hint');
    if (btnHint) btnHint.style.display = 'inline-flex';
    btnSubmit.style.display = 'inline-flex';

    quizInput.value = '';
    quizInput.disabled = false;
    quizInput.placeholder = qData.expectedType === 'japanese' ? 'Gõ Kanji hoặc Hiragana...' : 'Gõ phiên âm Hiragana...';
    quizInput.focus();
  }

  btnSubmit.textContent = 'Xác Nhận (Enter) ↵';
}

function handleQuizSubmitOrNext(choiceValue = null) {
  const quizInput = document.getElementById('quiz-input');
  const btnSubmit = document.getElementById('btn-quiz-submit');
  const feedbackBox = document.getElementById('quiz-feedback-box');
  const cardElement = document.getElementById('quiz-card');
  const promptSub = document.getElementById('quiz-prompt-sub');

  if (!isAnswerSubmitted) {
    // Stage 1: Submit Answer
    let val = choiceValue;
    if (!val && quizInput) {
      val = quizInput.value.trim();
    }

    if (!val) {
      if (quizInput) quizInput.focus();
      return;
    }

    const res = submitAnswer(val);
    if (!res) return;

    if (res.word && res.word.id !== undefined) {
      recordWordStudied(res.word.id);
    }

    isAnswerSubmitted = true;
    if (quizInput) quizInput.disabled = true;

    // ẨN Ô GÕ, PHÍM ẢO VÀ NÚT GỢI Ý ĐỂ GIỮ NGUYÊN CHIỀU CAO THẺ (HOÀN TOÀN KHÔNG CUỘN)
    const inputWrapper = document.getElementById('quiz-input-wrapper');
    const inputHelperBar = document.querySelector('.input-helper-bar');
    const softKeyboard = document.querySelector('.soft-keyboard');
    const mcContainer = document.getElementById('quiz-mc-container');
    const btnHint = document.getElementById('btn-quiz-hint');
    const questionTag = document.getElementById('quiz-question-tag');

    if (inputWrapper) inputWrapper.style.display = 'none';
    if (inputHelperBar) inputHelperBar.style.display = 'none';
    if (softKeyboard) softKeyboard.style.display = 'none';
    if (mcContainer) mcContainer.style.display = 'none';
    if (btnHint) btnHint.style.display = 'none';
    if (questionTag) questionTag.style.display = 'none';

    // Hiện tóm tắt thông tin từ ngay dưới câu hỏi
    if (promptSub) {
      promptSub.style.display = 'block';
      const k = res.word.kanji ? `${res.word.kanji}【${res.word.hiragana}】` : res.word.hiragana;
      const hv = res.word.hanviet ? ` — ${res.word.hanviet}` : '';
      promptSub.textContent = `${k}${hv}`;
    }

    // Show Feedback Box with ALL INFORMATION REVEALED
    feedbackBox.className = `feedback-box ${res.isCorrect ? 'correct' : 'incorrect'}`;
    feedbackBox.style.display = 'block';

    const titleEl = document.getElementById('feedback-status-title');
    const detailEl = document.getElementById('feedback-detail-body');
    const breakdownEl = document.getElementById('feedback-word-breakdown');

    const correctDisplayStr = res.word.kanji ? `${res.word.kanji}【${res.word.hiragana}】` : res.word.hiragana;

    if (res.isCorrect) {
      titleEl.textContent = 'Chính Xác! 🎉';
      detailEl.innerHTML = `Bạn đã trả lời: <strong style="color:var(--accent-green); font-size:1.1rem;">${res.userTyped}</strong>`;
      cardElement.classList.add('correct-pulse');
      setTimeout(() => cardElement.classList.remove('correct-pulse'), 500);
    } else {
      titleEl.textContent = 'Chưa Đúng! ❌';
      detailEl.innerHTML = `
        <div>Đáp án đúng: <strong style="color:var(--accent-cyan); font-size:1.1rem;">${correctDisplayStr}</strong></div>
        <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem;">Bạn đã gõ/chọn: <span>${res.userTyped || '(để trống)'}</span></div>
      `;
      cardElement.classList.add('shake');
      setTimeout(() => cardElement.classList.remove('shake'), 400);
    }

    breakdownEl.innerHTML = `
      <span class="kanji">${res.word.kanji || res.word.hiragana}</span>
      <span class="reading">【${res.word.hiragana}】</span>
      <span class="hanviet">${res.word.hanviet || ''}</span>
      <span style="color:var(--text-secondary); font-size:0.85rem; margin-left:auto;">${res.word.meaning}</span>
    `;

    // Tự động đọc phát âm
    speakJapanese(res.word.kanji || res.word.hiragana);

    const btnEditQuizWord = document.getElementById('btn-edit-quiz-word');
    if (btnEditQuizWord) {
      if (res.word && res.word.id !== undefined && res.word.id !== null) {
        btnEditQuizWord.style.display = 'inline-block';
        btnEditQuizWord.onclick = () => {
          openEditWordModal(res.word.id);
        };
      } else {
        btnEditQuizWord.style.display = 'none';
        btnEditQuizWord.onclick = null;
      }
    }

    btnSubmit.style.display = 'inline-flex';
    btnSubmit.textContent = 'Câu Tiếp Theo (Enter) ➔';
  } else {
    // Stage 2: Move to next question
    const nextQ = nextQuestion();
    if (nextQ) {
      if (nextQ.total && nextQ.correctCount !== undefined) {
        showQuizResultsModal(nextQ);
      } else {
        renderCurrentQuestion();
      }
    } else {
      const summary = finishQuiz();
      showQuizResultsModal(summary);
    }
  }
}

function showQuizResultsModal(summary) {
  const modal = document.getElementById('modal-quiz-result');
  document.getElementById('res-summary-text').textContent = `Bạn đã hoàn thành ${summary.total} câu hỏi bài kiểm tra!`;
  document.getElementById('res-correct-count').textContent = `${summary.correctCount} / ${summary.total}`;
  document.getElementById('res-accuracy-rate').textContent = `${summary.percentage}%`;
  document.getElementById('res-total-score').textContent = summary.score;

  modal.classList.add('active');

  document.getElementById('btn-result-close').onclick = () => {
    modal.classList.remove('active');
  };
  document.getElementById('btn-result-retry').onclick = () => {
    modal.classList.remove('active');
    startNewQuizSession();
  };
}

/* ==========================================================================
   FLASHCARDS VIEW CONTROLLER
   ========================================================================== */
function setupFlashcardView() {
  initFlashcards('all');

  const cardEl = document.getElementById('flashcard-element');
  const btnPrev = document.getElementById('btn-fc-prev');
  const btnNext = document.getElementById('btn-fc-next');
  const btnMaster = document.getElementById('btn-fc-master');
  const btnSpeak = document.getElementById('btn-fc-speak');
  const filterSelect = document.getElementById('flashcard-filter-select');

  cardEl.addEventListener('click', () => {
    flipCard();
    renderFlashcard();
  });

  btnNext.addEventListener('click', (e) => {
    e.stopPropagation();
    nextCard();
    renderFlashcard();
  });

  btnPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    prevCard();
    renderFlashcard();
  });

  btnMaster.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCardMastered();
    renderFlashcard();
  });

  btnSpeak.addEventListener('click', (e) => {
    e.stopPropagation();
    const data = getCurrentCardData();
    if (!data.empty) {
      speakJapanese(data.word.kanji || data.word.hiragana);
    }
  });

  filterSelect.addEventListener('change', () => {
    initFlashcards(filterSelect.value);
    renderFlashcard();
  });

  // Keyboard shortcut Space to flip card
  document.addEventListener('keydown', (e) => {
    const activePane = document.querySelector('.tab-pane.active');
    if (activePane && activePane.id === 'pane-flashcards' && e.code === 'Space') {
      e.preventDefault();
      flipCard();
      renderFlashcard();
    }
  });

  renderFlashcard();
}

function renderFlashcard() {
  const data = getCurrentCardData();
  const cardEl = document.getElementById('flashcard-element');
  const counter = document.getElementById('flashcard-counter');

  if (data.empty) {
    counter.textContent = 'Không có thẻ nào';
    document.getElementById('fc-front-kanji').textContent = 'Empty';
    document.getElementById('fc-front-hiragana').textContent = 'Không tìm thấy từ vựng trong bộ lọc này';
    document.getElementById('fc-front-hanviet').textContent = '';
    return;
  }

  counter.textContent = `Thẻ ${data.index} / ${data.total}`;

  if (data.isFlipped) {
    cardEl.classList.add('flipped');
  } else {
    cardEl.classList.remove('flipped');
  }

  const w = data.word;
  const btnEditFc = document.getElementById('btn-edit-fc-word');
  if (btnEditFc) {
    if (w && w.id !== undefined && w.id !== null) {
      btnEditFc.style.display = 'inline-block';
      btnEditFc.onclick = (e) => {
        e.stopPropagation(); // prevent card flip
        openEditWordModal(w.id);
      };
    } else {
      btnEditFc.style.display = 'none';
      btnEditFc.onclick = null;
    }
  }
  document.getElementById('fc-front-kanji').textContent = w.kanji || w.hiragana;
  document.getElementById('fc-front-hiragana').textContent = w.kanji ? w.hiragana : '';
  document.getElementById('fc-front-hanviet').textContent = w.hanviet || 'N3';

  document.getElementById('fc-back-hanviet').textContent = w.hanviet;
  document.getElementById('fc-back-meaning').textContent = w.meaning;
  document.getElementById('fc-back-ex-jp').textContent = w.example_jp || w.kanji;
  document.getElementById('fc-back-ex-vi').textContent = w.example_vi || w.meaning;

  const btnMaster = document.getElementById('btn-fc-master');
  if (data.isMastered) {
    btnMaster.textContent = '✓ Đã Thuộc';
    btnMaster.style.background = 'rgba(16,185,129,0.2)';
  } else {
    btnMaster.textContent = '+ Đánh Dấu Thuộc';
    btnMaster.style.background = 'rgba(255,255,255,0.08)';
  }
}

/* ==========================================================================
   DICTIONARY CONTROLLER
   ========================================================================== */
function setupDictionaryView() {
  const searchInput = document.getElementById('dict-search-input');
  const statusFilter = document.getElementById('dict-status-filter');
  const catBtn = document.getElementById('dict-category-btn');
  const catDropdown = document.getElementById('dict-category-dropdown');

  // Toggle dropdown
  catBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    catDropdown.style.display = catDropdown.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', (e) => {
    if (!catBtn.contains(e.target) && !catDropdown.contains(e.target)) {
      catDropdown.style.display = 'none';
    }
  });

  // Handle Checkboxes
  catDropdown.addEventListener('change', (e) => {
    const allCb = document.getElementById('dict-cat-all');
    const cbs = Array.from(document.querySelectorAll('.dict-cat-cb'));
    
    if (e.target === allCb) {
      cbs.forEach(cb => cb.checked = false);
    } else {
      if (cbs.some(cb => cb.checked)) {
        allCb.checked = false;
      } else {
        allCb.checked = true;
      }
    }

    const selectedCats = allCb.checked ? ['all'] : cbs.filter(cb => cb.checked).map(cb => cb.value);
    catBtn.textContent = allCb.checked ? 'Chọn Chương (Tất cả) ▼' : `Đã chọn (${selectedCats.length}) ▼`;
    
    setDictionaryFilters({ categoryFilter: selectedCats });
    renderDictionaryGrid();
  });

  searchInput.addEventListener('input', () => {
    setDictionaryFilters({ searchTerm: searchInput.value });
    renderDictionaryGrid();
  });

  statusFilter.addEventListener('change', () => {
    setDictionaryFilters({ statusFilter: statusFilter.value });
    renderDictionaryGrid();
  });

  renderDictionaryGrid();
}

function renderDictionaryGrid() {
  const grid = document.getElementById('dict-vocab-grid');
  if (!grid) return;

  const list = getFilteredVocabulary();
  const masteredIds = getMasteredIds();
  const bookmarkedIds = getBookmarkedIds();
  const profs = getProficiencyAll();

  // Thống kê Dashboard
  let countLow = 0;
  let countMid = 0;
  let countHigh = 0;

  list.forEach(item => {
    const lvl = profs[item.id] ? profs[item.id].level : 0;
    if (lvl <= 1) countLow++;
    else if (lvl <= 3) countMid++;
    else countHigh++;
  });

  const dashLow = document.getElementById('dash-level-low');
  const dashMid = document.getElementById('dash-level-mid');
  const dashHigh = document.getElementById('dash-level-high');
  if (dashLow) dashLow.textContent = countLow;
  if (dashMid) dashMid.textContent = countMid;
  if (dashHigh) dashHigh.textContent = countHigh;

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">Không tìm thấy từ vựng khớp với kết quả tìm kiếm.</div>`;
    return;
  }

  grid.innerHTML = list.map(item => {
    const isMastered = masteredIds.includes(item.id);
    const isBookmarked = bookmarkedIds.includes(item.id);
    const lvl = profs[item.id] ? profs[item.id].level : 0;
    const isUserWord = item.id && item.id.startsWith('user_');
    
    // Render 5 stars based on lvl
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span style="color: ${i <= lvl ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)'}; font-size: 1.1rem;">★</span>`;
    }

    return `
      <div class="vocab-card" data-id="${item.id}">
        <div class="vocab-card-header">
          <div>
            <div class="vocab-kanji">${item.kanji || item.hiragana}</div>
            <div class="vocab-hiragana">${item.kanji ? item.hiragana : ''}</div>
            <span class="vocab-hanviet">${item.hanviet || 'N3'}</span>
          </div>

          <div style="display: flex; gap: 0.4rem; align-items: center;">
            ${isUserWord ? `
              <button class="icon-btn btn-edit-word" data-id="${item.id}" title="Sửa từ này" style="width: 32px; height: 32px; font-size: 0.85rem;">✏️</button>
            ` : ''}
            <button class="icon-btn btn-delete-word" data-id="${item.id}" title="Xóa từ này" style="width: 32px; height: 32px; font-size: 0.85rem; color: var(--accent-red);">🗑️</button>
            <button class="icon-btn btn-speak-word" data-text="${item.kanji || item.hiragana}" title="Nghe đọc" style="width: 32px; height: 32px;">🔊</button>
            <button class="icon-btn btn-toggle-fav" data-id="${item.id}" title="Yêu thích" style="width: 32px; height: 32px; color: ${isBookmarked ? 'var(--accent-sakura)' : 'inherit'};">
              ${isBookmarked ? '♥' : '♡'}
            </button>
          </div>
        </div>

        <div class="vocab-meaning">${item.meaning}</div>

        <div style="margin: 0.5rem 0; display: flex; align-items: center; gap: 0.25rem;">
          ${starsHtml}
        </div>

        ${item.example_jp ? `
          <div style="font-size:0.8rem; background:rgba(0,0,0,0.25); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); margin-bottom:0.75rem;">
            <div style="font-family:var(--font-jp); color:var(--text-japanese);">${item.example_jp}</div>
            <div style="color:var(--text-muted); font-size:0.75rem;">${item.example_vi || ''}</div>
          </div>
        ` : ''}

        <div class="vocab-footer">
          <span style="font-size:0.75rem; color:var(--text-muted);">${item.category || 'N3'}</span>
          <button class="btn-toggle-master" data-id="${item.id}" style="background:transparent; border:none; color:${isMastered ? 'var(--accent-green)' : 'var(--text-muted)'}; font-size:0.8rem; font-weight:700; cursor:pointer;">
            ${isMastered ? '✓ Đã thuộc' : '+ Chưa thuộc'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Bind Speak & Toggle events inside grid
  grid.querySelectorAll('.btn-speak-word').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakJapanese(btn.dataset.text);
    });
  });

  grid.querySelectorAll('.btn-toggle-fav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBookmarkStatus(btn.dataset.id);
      renderDictionaryGrid();
    });
  });

  grid.querySelectorAll('.btn-toggle-master').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMasteredStatus(btn.dataset.id);
      renderDictionaryGrid();
    });
  });

  // Bind Edit word
  grid.querySelectorAll('.btn-edit-word').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditWordModal(btn.dataset.id);
    });
  });

  // Bind Delete word
  grid.querySelectorAll('.btn-delete-word').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Bạn có chắc chắn muốn xóa từ này không?')) {
        deleteCustomWord(btn.dataset.id);
        renderDictionaryGrid();
        updateAllCategoryDropdowns();
      }
    });
  });
}

/* ==========================================================================
   MODAL & FORMS
   ========================================================================== */
function updateAllCategoryDropdowns() {
  const categories = getCategories();

  // 1. Quiz Category Multi-select
  const quizCatList = document.getElementById('quiz-category-list');
  if (quizCatList) {
    quizCatList.innerHTML = categories.map(cat => `
      <label style="display: block; padding: 0.5rem; cursor: pointer;">
        <input type="checkbox" class="quiz-cat-cb" value="${cat}"> ${cat}
      </label>
    `).join('');
  }

  // 2. Dictionary Category Multi-select
  const dictCatList = document.getElementById('dict-category-list');
  if (dictCatList) {
    dictCatList.innerHTML = categories.map(cat => `
      <label style="display: block; padding: 0.5rem; cursor: pointer;">
        <input type="checkbox" class="dict-cat-cb" value="${cat}"> ${cat}
      </label>
    `).join('');
  }

  // 3. Flashcards Category Dropdown (Keep single select)
  const fcCatSelect = document.getElementById('flashcard-filter-select');
  if (fcCatSelect) {
    const currentVal = fcCatSelect.value;
    fcCatSelect.innerHTML = `
      <option value="all">Tất cả các chương</option>
      <option value="unmastered">Chỉ các từ Chưa thuộc</option>
      <option value="bookmarked">Các từ đã Thả Tim (Yêu thích)</option>
    `;
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `Chương: ${cat}`;
      fcCatSelect.appendChild(opt);
    });
    if (currentVal) fcCatSelect.value = currentVal;
  }
}

function setupModalForms() {
  const modalAdd = document.getElementById('modal-add-word');
  const btnOpenModal = document.getElementById('btn-add-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const formAddWord = document.getElementById('form-add-word');
  const modalTitle = document.getElementById('modal-add-title');

  let editingWordId = null; // null = Thêm mới, có giá trị = Đang sửa

  btnOpenModal.addEventListener('click', () => {
    editingWordId = null;
    formAddWord.reset();
    if (modalTitle) modalTitle.textContent = '📝 Thêm Từ Vựng Mới';
    modalAdd.classList.add('active');
  });

  btnCloseModal.addEventListener('click', () => {
    editingWordId = null;
    modalAdd.classList.remove('active');
  });

  // Modal Thống Kê Học Tập
  const modalStats = document.getElementById('modal-learning-stats');
  const btnOpenStats = document.getElementById('btn-stats-modal');
  const btnCloseStats = document.getElementById('btn-close-stats');

  if (btnOpenStats && modalStats) {
    btnOpenStats.addEventListener('click', () => {
      renderLearningStatsModal();
      modalStats.classList.add('active');
    });
  }

  if (btnCloseStats && modalStats) {
    btnCloseStats.addEventListener('click', () => {
      modalStats.classList.remove('active');
    });
  }

  // Hàm mở modal ở chế độ Sửa (gọi từ bên ngoài)
  window._openEditWordModal = function(wordId) {
    if (wordId === undefined || wordId === null) return;
    const allWords = getAllVocabulary();
    const word = allWords.find(w => String(w.id) === String(wordId));
    if (!word) {
      console.warn('Không tìm thấy từ có ID:', wordId);
      return;
    }

    editingWordId = word.id;
    if (modalTitle) modalTitle.textContent = '✏️ Sửa Từ Vựng';
    
    document.getElementById('add-kanji').value = word.kanji || '';
    document.getElementById('add-hiragana').value = word.hiragana || '';
    document.getElementById('add-hanviet').value = word.hanviet || '';
    document.getElementById('add-meaning').value = word.meaning || '';
    document.getElementById('add-category').value = word.category || '';
    document.getElementById('add-example-jp').value = word.example_jp || '';
    document.getElementById('add-example-vi').value = word.example_vi || '';
    
    modalAdd.classList.add('active');
  };

  formAddWord.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      kanji: document.getElementById('add-kanji').value,
      hiragana: document.getElementById('add-hiragana').value,
      hanviet: document.getElementById('add-hanviet').value,
      meaning: document.getElementById('add-meaning').value,
      category: document.getElementById('add-category').value,
      example_jp: document.getElementById('add-example-jp').value,
      example_vi: document.getElementById('add-example-vi').value
    };

    if (editingWordId) {
      // Chế độ SỬA
      const result = updateCustomWord(editingWordId, data);
      if (result) {
        alert('✅ Đã cập nhật từ vựng thành công!');
        editingWordId = null;
        formAddWord.reset();
        modalAdd.classList.remove('active');
        updateAllCategoryDropdowns();
        renderDictionaryGrid();
      } else {
        alert('Không tìm thấy từ để cập nhật.');
      }
    } else {
      // Chế độ THÊM MỚI
      const res = handleAddNewWord(data);
      if (res.success) {
        alert('🎉 Đã thêm từ vựng mới thành công!');
        formAddWord.reset();
        modalAdd.classList.remove('active');
        updateAllCategoryDropdowns();
        renderDictionaryGrid();
        startNewQuizSession();
      } else {
        alert(res.error);
      }
    }
  });

  // Modal Nhập Hàng Loạt
  const modalImport = document.getElementById('modal-import-json');
  const btnOpenImport = document.getElementById('btn-import-modal');
  const btnCloseImport = document.getElementById('btn-close-import-modal');
  const btnSubmitImport = document.getElementById('btn-submit-import');
  const textareaImport = document.getElementById('import-json-textarea');
  const categoryOverrideInput = document.getElementById('import-category-override');
  const btnClearAllData = document.getElementById('btn-clear-all-data');

  if (btnOpenImport) {
    btnOpenImport.addEventListener('click', () => {
      modalImport.classList.add('active');
    });
  }

  if (btnCloseImport) {
    btnCloseImport.addEventListener('click', () => {
      modalImport.classList.remove('active');
    });
  }

  if (btnSubmitImport) {
    btnSubmitImport.addEventListener('click', () => {
      const text = textareaImport.value.trim();
      const catOverride = categoryOverrideInput ? categoryOverrideInput.value.trim() : '';

      if (!text) {
        alert('Vui lòng dán chuỗi mảng JSON từ vựng!');
        return;
      }

      const res = importWordsFromJSON(text, catOverride);
      if (res.success) {
        alert(`🎉 Đã nhập thành công ${res.count} từ vựng mới vào ứng dụng!`);
        textareaImport.value = '';
        if (categoryOverrideInput) categoryOverrideInput.value = '';
        modalImport.classList.remove('active');
        updateAllCategoryDropdowns();
        renderDictionaryGrid();
        startNewQuizSession();
      } else {
        alert(`❌ Lỗi nhập dữ liệu: ${res.error}`);
      }
    });
  }

  // Nút Xóa Sạch Toàn Bộ Dữ Liệu
  const executeClear = () => {
    if (confirm('⚠️ Bạn có chắc chắn muốn XÓA SẠCH TOÀN BỘ từ vựng hiện tại để về trạng thái TRỐNG (0 từ) không? Action này không thể hoàn tác!')) {
      clearAllCustomWords();
      alert('🗑️ Đã xóa sạch toàn bộ từ vựng! Ứng dụng hiện đang ở trạng thái trống (0 từ).');
      if (modalImport) modalImport.classList.remove('active');
      updateAllCategoryDropdowns();
      renderDictionaryGrid();
      initFlashcards('all');
      renderFlashcard();
      startNewQuizSession();
    }
  };

  if (btnClearAllData) {
    btnClearAllData.addEventListener('click', executeClear);
  }

  const btnManageData = document.getElementById('btn-manage-data');
  const modalManageData = document.getElementById('modal-manage-data');
  const btnCloseManage = document.getElementById('btn-close-manage');
  const manageCategoryList = document.getElementById('manage-category-list');
  const btnDeleteSelected = document.getElementById('btn-delete-selected');
  const btnShareSelected = document.getElementById('btn-share-selected');
  const btnClearAllManage = document.getElementById('btn-clear-all-data');

  if (btnManageData) {
    btnManageData.addEventListener('click', () => {
      const customWords = getCustomWords();
      const uniqueCategories = [...new Set(customWords.map(w => w.category))];
      
      if (uniqueCategories.length === 0) {
        manageCategoryList.innerHTML = '<div style="color: var(--text-muted); text-align: center;">Bạn chưa thêm từ vựng/chương nào.</div>';
      } else {
        manageCategoryList.innerHTML = uniqueCategories.map(cat => `
          <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <input type="checkbox" class="manage-cat-checkbox" value="${cat}">
            <span>${cat}</span>
            <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: auto;">
              (${customWords.filter(w => w.category === cat).length} từ)
            </span>
          </label>
        `).join('');
      }
      modalManageData.classList.add('active');
    });
  }

  if (btnCloseManage) {
    btnCloseManage.addEventListener('click', () => modalManageData.classList.remove('active'));
  }

  if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', () => {
      const checked = Array.from(document.querySelectorAll('.manage-cat-checkbox:checked')).map(cb => cb.value);
      if (checked.length === 0) {
        alert('Vui lòng chọn ít nhất 1 chương để xóa!');
        return;
      }
      if (confirm(`Bạn có chắc muốn XÓA VĨNH VIỄN ${checked.length} chương đã chọn không?`)) {
        deleteCustomCategories(checked);
        alert('Đã xóa thành công!');
        modalManageData.classList.remove('active');
        updateAllCategoryDropdowns();
        renderDictionaryGrid();
        initFlashcards('all');
        renderFlashcard();
        startNewQuizSession();
      }
    });
  }

  if (btnShareSelected) {
    btnShareSelected.addEventListener('click', () => {
      const checked = Array.from(document.querySelectorAll('.manage-cat-checkbox:checked')).map(cb => cb.value);
      openPublishModal(checked);
    });
  }

  const btnClosePublish = document.getElementById('btn-close-publish');
  if (btnClosePublish) {
    btnClosePublish.addEventListener('click', () => document.getElementById('modal-publish').classList.remove('active'));
  }
}

/* ==========================================================================
   LEARNING STATISTICS DASHBOARD RENDERER
   ========================================================================== */
function renderLearningStatsModal() {
  const daily = getDailyStats();
  const dist = getStarDistribution();
  const userStats = getUserStats();

  // 1. Date string formatted in Vietnamese
  const todayDateEl = document.getElementById('stats-today-date');
  if (todayDateEl) {
    const d = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dateStr = `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    todayDateEl.textContent = dateStr;
  }

  // 2. Today's stats
  const wordsStudiedEl = document.getElementById('stat-today-words');
  const questionsEl = document.getElementById('stat-today-questions');
  const star1El = document.getElementById('stat-today-star1');
  const star2El = document.getElementById('stat-today-star2');
  const star3plusEl = document.getElementById('stat-today-star3plus');

  if (wordsStudiedEl) wordsStudiedEl.textContent = daily.todayWordsStudied ? daily.todayWordsStudied.length : 0;
  if (questionsEl) questionsEl.textContent = daily.todayQuestions || 0;
  if (star1El) star1El.textContent = `+${daily.todayStarGain ? (daily.todayStarGain['1'] || 0) : 0}`;
  if (star2El) star2El.textContent = `+${daily.todayStarGain ? (daily.todayStarGain['2'] || 0) : 0}`;
  if (star3plusEl) {
    const s3 = daily.todayStarGain ? (daily.todayStarGain['3'] || 0) : 0;
    const s4 = daily.todayStarGain ? (daily.todayStarGain['4'] || 0) : 0;
    const s5 = daily.todayStarGain ? (daily.todayStarGain['5'] || 0) : 0;
    star3plusEl.textContent = `+${s3 + s4 + s5}`;
  }

  // 3. Star Distribution Breakdown
  const totalVocab = dist.total || 1;
  const totalVocabEl = document.getElementById('stats-total-vocab-count');
  if (totalVocabEl) totalVocabEl.textContent = `Tổng: ${dist.total} từ`;

  const stackedBar = document.getElementById('stats-stacked-bar');
  if (stackedBar) {
    const colors = {
      0: '#475569',
      1: '#06b6d4',
      2: '#f59e0b',
      3: '#a855f7',
      4: '#3b82f6',
      5: '#10b981'
    };
    let barHtml = '';
    for (let i = 0; i <= 5; i++) {
      const count = dist[i] || 0;
      const pct = (count / totalVocab) * 100;
      if (pct > 0) {
        barHtml += `<div class="stacked-bar-segment" style="width: ${pct}%; background: ${colors[i]};" title="${i}★: ${count} từ (${Math.round(pct)}%)"></div>`;
      }
    }
    stackedBar.innerHTML = barHtml || `<div class="stacked-bar-segment" style="width: 100%; background: #475569;"></div>`;
  }

  const levelGrid = document.getElementById('stats-level-grid');
  if (levelGrid) {
    const levelConfigs = [
      { lvl: 0, title: '0★ Chưa Học', desc: 'Mới khởi tạo', color: '#94a3b8' },
      { lvl: 1, title: '★ 1 Sao', desc: 'Mới nhận diện', color: '#06b6d4' },
      { lvl: 2, title: '★★ 2 Sao', desc: 'Đã thuộc sơ cấp', color: '#f59e0b' },
      { lvl: 3, title: '★★★ 3 Sao', desc: 'Thuộc khá tốt', color: '#a855f7' },
      { lvl: 4, title: '★★★★ 4 Sao', desc: 'Phản xạ nhanh', color: '#3b82f6' },
      { lvl: 5, title: '★★★★★ 5 Sao', desc: 'Thuộc lòng (Mastered)', color: '#10b981' }
    ];

    levelGrid.innerHTML = levelConfigs.map(c => {
      const cnt = dist[c.lvl] || 0;
      const pct = Math.round((cnt / totalVocab) * 100);
      return `
        <div class="level-stat-card">
          <div class="lvl-head">
            <span style="color: ${c.color};">${c.title}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${pct}%</span>
          </div>
          <div class="lvl-count" style="color: ${c.color};">${cnt} <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-secondary);">từ</span></div>
          <div class="lvl-desc">${c.desc}</div>
        </div>
      `;
    }).join('');
  }

  // 4. Overall performance
  const accValEl = document.getElementById('stats-accuracy-val');
  const streakValEl = document.getElementById('stats-best-streak-val');
  const totalQValEl = document.getElementById('stats-total-q-val');
  const sessionsValEl = document.getElementById('stats-sessions-val');

  const totalAns = userStats.totalQuestions || 0;
  const correctAns = userStats.correctAnswers || 0;
  const accRate = totalAns > 0 ? Math.round((correctAns / totalAns) * 100) : 0;

  if (accValEl) accValEl.textContent = `${accRate}%`;
  if (streakValEl) streakValEl.textContent = `${userStats.bestStreak || 0} 🔥`;
  if (totalQValEl) totalQValEl.textContent = totalAns;
  if (sessionsValEl) sessionsValEl.textContent = userStats.sessionsCompleted || 0;
}
