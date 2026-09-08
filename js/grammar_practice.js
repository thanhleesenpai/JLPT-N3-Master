/**
 * Grammar Practice Module — Grammar Dojo
 * Thiết kế chuẩn như Quiz từ vựng:
 * - Dynamics DOM selection (tránh lỗi null do timing load)
 * - Chọn số câu (5, 10, 20, Tất cả)
 * - Tự động hiển thị Furigana trên Kanji cho Shadow Typing
 * - Chấp nhận đáp án bằng Kanji, Hiragana hoặc Romaji
 * - Hiện phiên âm Hiragana & Dịch nghĩa tiếng Việt sau khi trả lời
 * - Giao diện Scramble có khung xếp câu rõ ràng
 */
import { N3_GRAMMAR_DATA } from './grammar_data.js';
import { updateGrammarScore } from './storage.js';
import { attachRomajiInput, romajiToHiragana } from './romaji.js';

// ========== STATE ==========
let practiceQueue = [];
let currentIndex = 0;
let currentMode = 'shadow';
let currentQuestion = null;
let currentExample = null;
let isAnswerSubmitted = false; // 2-stage: false=gõ, true=đã submit (chờ Next)
let grammarPracticeActive = false;
let profUpdatedIds = new Set(); // Mỗi ngữ pháp chỉ tính sao 1 lần/phiên

// Dynamic DOM getter helper
function getEl(id) {
  return document.getElementById(id);
}

// ========== INIT ==========
export function initGrammarPractice() {
  const btnPractice = getEl('btn-grammar-practice');
  const btnBack = getEl('btn-grammar-back-list');
  const btnStart = getEl('btn-start-grammar-quiz');
  const quizInput = getEl('grammar-quiz-input');
  const btnSubmit = getEl('btn-grammar-submit');
  const btnToggleRomaji = getEl('btn-grammar-toggle-romaji');
  const viewList = getEl('grammar-list-grid');
  const viewPractice = getEl('grammar-practice-view');

  if (btnPractice) {
    btnPractice.addEventListener('click', () => {
      const headerBar = document.querySelector('.grammar-header-bar');
      if (headerBar) headerBar.style.display = 'none';
      if (viewList) viewList.style.display = 'none';
      if (viewPractice) viewPractice.style.display = 'block';
      startPractice();
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      const headerBar = document.querySelector('.grammar-header-bar');
      if (headerBar) headerBar.style.display = 'flex';
      if (viewPractice) viewPractice.style.display = 'none';
      if (viewList) viewList.style.display = 'grid';
      grammarPracticeActive = false;
    });
  }

  if (btnStart) {
    btnStart.addEventListener('click', () => startPractice());
  }

  // Enter trên input → handleSubmitOrNext
  if (quizInput) {
    quizInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleSubmitOrNext();
      }
    });

    // Romaji mặc định TẮT
    quizInput.dataset.romajiMode = 'false';
    attachRomajiInput(quizInput);
  }

  // Enter ở cấp document → chỉ dùng khi input bị ẩn (giai đoạn 2: Next)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && isAnswerSubmitted && grammarPracticeActive) {
      e.preventDefault();
      handleSubmitOrNext();
    }
  });

  // Nút Xác Nhận / Câu Tiếp Theo
  if (btnSubmit) {
    btnSubmit.addEventListener('click', () => handleSubmitOrNext());
  }

  const btnToggleGrammarSetup = getEl('btn-toggle-grammar-setup');
  const grammarControls = getEl('grammar-practice-controls');

  if (btnToggleGrammarSetup && grammarControls) {
    btnToggleGrammarSetup.addEventListener('click', () => {
      grammarControls.classList.toggle('is-open');
      const isOpen = grammarControls.classList.contains('is-open');
      const arrow = btnToggleGrammarSetup.querySelector('.toggle-icon');
      if (arrow) arrow.textContent = isOpen ? '▲' : '▼';
    });
  }

  if (btnToggleRomaji) {
    btnToggleRomaji.addEventListener('click', () => {
      const qInput = getEl('grammar-quiz-input');
      const romajiStatus = getEl('grammar-romaji-status');
      if (!qInput) return;

      const isRomaji = qInput.dataset.romajiMode !== 'false';
      const newMode = !isRomaji;
      qInput.dataset.romajiMode = newMode;
      btnToggleRomaji.textContent = newMode ? 'Tắt Romaji Auto' : 'Bật Romaji Auto';
      if (romajiStatus) {
        romajiStatus.innerHTML = newMode
          ? '<span style="display:inline-block; width:8px; height:8px; background:var(--accent-green); border-radius:50%;"></span> Romaji: Bật'
          : '<span style="display:inline-block; width:8px; height:8px; background:var(--text-muted); border-radius:50%;"></span> Romaji: Tắt (Dùng IME HĐH)';
      }
      qInput.focus();
    });
  }
}

// ========== HELPER PARSING VÍ DỤ ==========
function getQuestionExample(grammarObj) {
  if (!grammarObj || !grammarObj.examples || grammarObj.examples.length === 0) {
    return {
      jp: grammarObj ? grammarObj.grammar : '',
      reading: grammarObj ? grammarObj.grammar : '',
      furigana: grammarObj ? grammarObj.grammar : '',
      meaning: grammarObj ? grammarObj.meaning : '',
      target: grammarObj ? grammarObj.grammar : ''
    };
  }

  const ex = grammarObj.examples[0];
  if (typeof ex === 'object') {
    return {
      jp: (ex.jp || '').replace(/^「|」$/g, '').trim(),
      reading: (ex.reading || ex.jp || '').replace(/^「|」$/g, '').trim(),
      furigana: (ex.furigana || ex.jp || '').replace(/^「|」$/g, '').trim(),
      meaning: ex.meaning || grammarObj.meaning || '',
      target: ex.target || grammarObj.grammar || ''
    };
  }

  const str = String(ex).replace(/^「|」$/g, '').trim();
  return {
    jp: str,
    reading: str,
    furigana: str,
    meaning: grammarObj.meaning || '',
    target: grammarObj.grammar || ''
  };
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/[。、，．\s「」\(\)（）\-\>→/／~～]/g, '').toLowerCase();
}

function checkGrammarAnswer(userAns, exObj, grammarTitle) {
  const rawUser = userAns.trim();
  if (!rawUser) return false;

  const cleanUser = cleanText(rawUser);
  const userHiragana = cleanText(romajiToHiragana(rawUser));

  const targetJp = cleanText(exObj.jp);
  const targetReading = cleanText(exObj.reading);

  // 1. Trùng khớp hoàn toàn với câu ví dụ (Kanji, Hiragana hoặc Romaji)
  if (cleanUser === targetJp || cleanUser === targetReading || userHiragana === targetReading || userHiragana === targetJp) {
    return true;
  }

  // 2. Trùng khớp với từ mục tiêu đục lỗ cụ thể (exObj.target)
  if (exObj && exObj.target) {
    const cleanTarget = cleanText(exObj.target);
    const targetHiragana = cleanText(romajiToHiragana(exObj.target));
    if (cleanUser === cleanTarget || userHiragana === targetHiragana) {
      return true;
    }
  }

  // 3. Trùng khớp với tên cấu trúc ngữ pháp hiển thị ở tiêu đề (kể cả có hay không có dấu / ~)
  const cleanTitle = cleanText(grammarTitle);
  const titleHiragana = cleanText(romajiToHiragana(grammarTitle));
  if (cleanUser === cleanTitle || userHiragana === titleHiragana) {
    return true;
  }

  // Tách các phương án biến thể của ngữ pháp (vd: "くらいなら／ぐらいなら" -> ["くらいなら", "ぐらいなら"])
  const titleParts = grammarTitle
    .split(/[→ー〉/／~～\s\(\)（）]/)
    .map(p => cleanText(p))
    .filter(p => p.length >= 2);

  if (titleParts.some(p => cleanUser === p || userHiragana === p || cleanText(romajiToHiragana(p)) === userHiragana)) {
    return true;
  }

  // 4. Shadowing / Cloze: Chấp nhận nếu gõ đúng một đoạn từ 3 ký tự trở lên trong câu ví dụ
  if (cleanUser.length >= 3) {
    if (targetJp.includes(cleanUser) || targetReading.includes(userHiragana)) {
      return true;
    }
  }

  return false;
}

// ========== CORE LOGIC: SUBMIT / NEXT ==========
function handleSubmitOrNext() {
  if (!isAnswerSubmitted) {
    doSubmit();
  } else {
    doNext();
  }
}

function doSubmit() {
  const quizInput = getEl('grammar-quiz-input');
  const scrambleSlots = getEl('grammar-scramble-slots');
  const typingSection = getEl('grammar-typing-section');
  const feedbackBox = getEl('grammar-feedback-box');
  const feedbackTitle = getEl('grammar-feedback-title');
  const feedbackDetail = getEl('grammar-feedback-detail');
  const btnSubmit = getEl('btn-grammar-submit');
  const quizCard = getEl('grammar-quiz-card');
  const promptMeaning = getEl('grammar-prompt-meaning');
  const promptJp = getEl('grammar-prompt-jp');

  let ans = quizInput ? quizInput.value.trim() : '';

  // Nếu ở Scramble mode mà quizInput rỗng, lấy chuỗi ghép từ scrambleSlots
  if (currentMode === 'scramble' && scrambleSlots) {
    const slotChips = Array.from(scrambleSlots.querySelectorAll('.scramble-chip'));
    ans = slotChips.map(c => c.dataset.original).join('');
    if (quizInput) quizInput.value = ans;
  }

  if (!ans && currentMode !== 'scramble') {
    if (quizInput) quizInput.focus();
    return;
  }

  if (quizInput) quizInput.disabled = true;
  isAnswerSubmitted = true;

  const exObj = currentExample;
  const isCorrect = checkGrammarAnswer(ans, exObj, currentQuestion.grammar);

  // Sai → đẩy vào cuối hàng đợi (cuốn chiếu)
  if (!isCorrect) {
    practiceQueue.push(currentQuestion);
  }

  // Cập nhật độ nhớ (chỉ tính 1 lần/phiên)
  if (currentQuestion.id && !profUpdatedIds.has(currentQuestion.id)) {
    updateGrammarScore(currentQuestion.id, isCorrect, currentMode);
    profUpdatedIds.add(currentQuestion.id);
  }

  // Ẩn khu vực nhập liệu
  if (typingSection) typingSection.style.display = 'none';
  const actionsBlock = getEl('grammar-quiz-actions');
  if (actionsBlock) actionsBlock.style.display = 'flex';

  // Trong chế độ Điền Khuyết: SAU KHI NỘP BÀI → Hiện lại tên ngữ pháp ở header và câu đầy đủ!
  if (currentMode === 'cloze') {
    if (promptMeaning) {
      promptMeaning.innerHTML = `
        <div style="font-size: 1.4rem; color: var(--accent-cyan); font-weight: 800; margin-bottom: 4px;">
          ${currentQuestion.grammar}
        </div>
        <div style="color: var(--accent-gold); font-size: 1.05rem; font-weight: 600;">
          ${currentQuestion.meaning.replace(/\n/g, '<br>')}
        </div>
      `;
    }
    if (promptJp) {
      promptJp.innerHTML = `
        <div style="font-size: 1.5rem; color: var(--text-primary); font-weight: 700; line-height: 2.2; text-align: center; margin: 0.5rem 0;">
          ${exObj.furigana}
        </div>
      `;
    }
  }

  // Hiển thị feedback chi tiết & đáp án cần điền
  if (feedbackBox) {
    feedbackBox.className = 'feedback-box';
    void feedbackBox.offsetWidth;

    const isCloze = currentMode === 'cloze';

    if (isCorrect) {
      feedbackBox.classList.add('correct');
      if (feedbackTitle) feedbackTitle.textContent = 'Chính Xác! 🎉';
      if (feedbackDetail) {
        if (isCloze) {
          feedbackDetail.innerHTML = `
            <div style="font-size: 1.1rem; color: var(--accent-green); margin-bottom: 0.4rem;">
              📌 Từ ngữ pháp cần điền: <strong style="color: var(--accent-green); font-size: 1.4rem; font-weight: 800;">${currentQuestion.grammar}</strong>
            </div>
            <div style="margin-bottom: 0.3rem;">
              <span style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 600;">📝 Câu đầy đủ (có Furigana):</span>
              <div style="font-size: 1.3rem; color: #fff; font-weight: 700; line-height: 2.2; margin-top: 0.2rem;">${exObj.furigana}</div>
            </div>
            <div style="font-size: 0.95rem; color: var(--accent-gold); margin-top: 0.4rem; padding-top: 0.35rem; border-top: 1px dashed rgba(255,255,255,0.15);">
              💡 <strong>Dịch câu:</strong> "${exObj.meaning}"
            </div>
          `;
        } else {
          feedbackDetail.innerHTML = `
            <div style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 0.3rem;">
              📌 Cấu trúc ngữ pháp: <strong style="color: var(--accent-cyan); font-size: 1.25rem;">${currentQuestion.grammar}</strong>
            </div>
            <div style="margin-bottom: 0.4rem;">
              <span style="font-size: 0.95rem; color: var(--accent-green); font-weight: 600;">📝 Đáp án câu gõ mẫu (Furigana):</span>
              <div style="font-size: 1.3rem; color: #fff; font-weight: 700; line-height: 2.2; margin-top: 0.2rem;">${exObj.furigana}</div>
            </div>
            <div style="font-size: 0.95rem; color: var(--accent-gold); margin-top: 0.35rem; padding-top: 0.3rem; border-top: 1px dashed rgba(255,255,255,0.15);">
              💡 <strong>Dịch câu:</strong> "${exObj.meaning}"
            </div>
          `;
        }
      }
      if (quizCard) {
        quizCard.classList.add('correct-pulse');
        setTimeout(() => quizCard.classList.remove('correct-pulse'), 500);
      }
    } else {
      feedbackBox.classList.add('incorrect');
      if (feedbackTitle) feedbackTitle.textContent = 'Chưa Đúng! ❌';
      if (feedbackDetail) {
        if (isCloze) {
          feedbackDetail.innerHTML = `
            <div style="font-size: 1.1rem; margin-bottom: 0.4rem; color: var(--text-primary);">
              📌 Từ ngữ pháp cần điền đúng: <strong style="color: var(--accent-pink); font-size: 1.4rem; font-weight: 800; text-decoration: underline;">${currentQuestion.grammar}</strong>
            </div>
            <div style="margin-bottom: 0.4rem;">
              <span style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 600;">📝 Câu đầy đủ (có Furigana):</span>
              <div style="font-size: 1.3rem; color: #fff; font-weight: 700; line-height: 2.2; margin-top: 0.2rem;">${exObj.furigana}</div>
            </div>
            <div style="font-size: 0.95rem; color: var(--accent-gold); margin-top: 0.4rem; padding-top: 0.35rem; border-top: 1px dashed rgba(255,255,255,0.15);">
              💡 <strong>Dịch câu:</strong> "${exObj.meaning}"
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.4rem;">
              ❌ Bạn đã nhập: <span style="color: #ef4444; font-weight: 600;">${ans || '(Rỗng)'}</span>
            </div>
          `;
        } else {
          feedbackDetail.innerHTML = `
            <div style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 0.3rem;">
              📌 Cấu trúc ngữ pháp: <strong style="color: var(--accent-cyan); font-size: 1.25rem;">${currentQuestion.grammar}</strong>
            </div>
            <div style="margin-bottom: 0.4rem;">
              <span style="font-size: 0.95rem; color: var(--accent-pink); font-weight: 700;">📝 Đáp án câu đúng cần gõ:</span>
              <div style="font-size: 1.3rem; color: var(--accent-cyan); font-weight: 700; line-height: 2.2; margin-top: 0.2rem;">${exObj.furigana}</div>
            </div>
            <div style="font-size: 0.95rem; color: var(--accent-gold); margin-top: 0.35rem; padding-top: 0.3rem; border-top: 1px dashed rgba(255,255,255,0.15);">
              💡 <strong>Dịch câu:</strong> "${exObj.meaning}"
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.4rem;">
              ❌ Bạn đã nhập: <span style="color: #ef4444; font-weight: 600;">${ans || '(Rỗng)'}</span>
            </div>
          `;
        }
      }
      if (quizCard) {
        quizCard.classList.add('shake');
        setTimeout(() => quizCard.classList.remove('shake'), 400);
      }
    }
  }

  if (btnSubmit) {
    btnSubmit.textContent = 'Câu Tiếp Theo (Enter) ➔';
  }
}

function doNext() {
  currentIndex++;
  isAnswerSubmitted = false;

  if (currentIndex >= practiceQueue.length) {
    showEndScreen();
  } else {
    loadNextQuestion();
  }
}

// ========== START PRACTICE ==========
function startPractice() {
  const modeSelect = getEl('grammar-practice-mode');
  const countSelect = getEl('grammar-practice-count');
  const quizCard = getEl('grammar-quiz-card');
  const modeLabel = getEl('grammar-quiz-mode-label');
  const grammarControls = getEl('grammar-practice-controls');
  const btnToggleGrammarSetup = getEl('btn-toggle-grammar-setup');

  if (grammarControls) grammarControls.classList.remove('is-open');
  if (btnToggleGrammarSetup) {
    const arrow = btnToggleGrammarSetup.querySelector('.toggle-icon');
    if (arrow) arrow.textContent = '▼';
  }

  currentMode = modeSelect ? modeSelect.value : 'shadow';
  const countVal = countSelect ? countSelect.value : '10';

  // Lọc tất cả các bài ngữ pháp có dữ liệu
  const validGrammars = N3_GRAMMAR_DATA.filter(g => g && (g.examples || g.grammar));
  const shuffled = [...validGrammars].sort(() => Math.random() - 0.5);

  let limit = 10;
  if (countVal === 'all') {
    limit = shuffled.length;
  } else {
    const parsed = parseInt(countVal, 10);
    limit = isNaN(parsed) ? 10 : Math.min(parsed, shuffled.length);
  }

  practiceQueue = shuffled.slice(0, limit);
  profUpdatedIds = new Set();
  isAnswerSubmitted = false;
  grammarPracticeActive = true;

  if (practiceQueue.length === 0) {
    alert('Không tìm thấy dữ liệu ngữ pháp hợp lệ để luyện tập!');
    return;
  }

  currentIndex = 0;
  if (quizCard) quizCard.style.display = 'block';

  const modeNames = { shadow: '⌨️ Shadow Typing', cloze: '💡 Điền khuyết', scramble: '🧩 Sắp xếp' };
  if (modeLabel) modeLabel.textContent = `Chế độ: ${modeNames[currentMode] || currentMode}`;

  loadNextQuestion();
}

// ========== LOAD QUESTION ==========
function loadNextQuestion() {
  const progressLabel = getEl('grammar-quiz-progress-label');
  const progressBar = getEl('grammar-quiz-progress-bar');
  const feedbackBox = getEl('grammar-feedback-box');
  const quizInput = getEl('grammar-quiz-input');
  const btnSubmit = getEl('btn-grammar-submit');
  const promptMeaning = getEl('grammar-prompt-meaning');
  const promptJp = getEl('grammar-prompt-jp');
  const scrambleContainer = getEl('grammar-scramble-container');
  const scrambleSlots = getEl('grammar-scramble-slots');
  const typingSection = getEl('grammar-typing-section');

  currentQuestion = practiceQueue[currentIndex];
  currentExample = getQuestionExample(currentQuestion);
  const exObj = currentExample;

  // Progress Bar
  if (progressLabel) progressLabel.textContent = `Câu ${currentIndex + 1} / ${practiceQueue.length}`;
  if (progressBar) progressBar.style.width = `${(currentIndex / practiceQueue.length) * 100}%`;

  // Reset UI
  if (feedbackBox) feedbackBox.className = 'feedback-box';
  if (quizInput) {
    quizInput.value = '';
    quizInput.disabled = false;
  }
  isAnswerSubmitted = false;

  if (btnSubmit) {
    btnSubmit.textContent = 'Xác Nhận (Enter) ↵';
  }

  // ── Shadow Typing ──
  if (currentMode === 'shadow') {
    if (promptMeaning) {
      promptMeaning.innerHTML = `
        <div style="font-size: 1.4rem; color: var(--accent-cyan); font-weight: 800; margin-bottom: 4px;">
          ${currentQuestion.grammar}
        </div>
        <div style="color: var(--text-secondary); font-size: 1.05rem; margin-bottom: 4px;">
          ${currentQuestion.meaning.replace(/\n/g, '<br>')}
        </div>
        ${currentQuestion.structure ? `<div style="font-size: 0.88rem; color: var(--accent-cyan); margin-bottom: 8px; font-weight: 600;">🧩 Cấu trúc: ${currentQuestion.structure}</div>` : ''}
        <div style="background: rgba(6, 182, 212, 0.12); border: 1px dashed var(--accent-cyan); border-radius: 8px; padding: 6px 12px; display: inline-block; color: var(--accent-cyan); font-weight: 700; font-size: 0.9rem;">
          ✍️ Nhiệm vụ: Gõ lại chính xác toàn bộ câu ví dụ chứa ngữ pháp bên dưới
        </div>
      `;
    }

    if (scrambleContainer) scrambleContainer.style.display = 'none';
    if (scrambleSlots) scrambleSlots.style.display = 'none';
    if (typingSection) typingSection.style.display = 'block';

    const actionsBlock = getEl('grammar-quiz-actions');
    if (actionsBlock) actionsBlock.style.display = 'flex';

    if (promptJp) {
      promptJp.innerHTML = `
        <div style="font-size: 1.5rem; color: var(--text-primary); font-weight: 700; line-height: 2.2; text-align: center; margin: 0.5rem 0;">
          ${exObj.furigana}
        </div>
      `;
    }
    if (quizInput) quizInput.focus();

  // ── Cloze (Điền khuyết) ──
  } else if (currentMode === 'cloze') {
    // Trong chế độ Điền Khuyết: ẨN hoàn toàn tên ngữ pháp ở header khi đang làm bài để tránh lộ đáp án!
    if (promptMeaning) {
      promptMeaning.innerHTML = `
        <div style="background: rgba(236, 72, 153, 0.12); border: 1px dashed var(--accent-pink); border-radius: 8px; padding: 6px 12px; margin-bottom: 8px; color: var(--accent-pink); font-weight: 700; font-size: 0.9rem; display: inline-block;">
          💡 Chế độ Điền Khuyết: Hãy tìm từ ngữ pháp thích hợp điền vào [________]
        </div>
        <div style="font-size: 1.1rem; color: #fff; font-weight: 600; margin-top: 4px;">
          Ý nghĩa / Gợi ý: <span style="color: var(--accent-gold); font-weight: 700;">${currentQuestion.meaning.replace(/\n/g, '<br>')}</span>
        </div>
        ${currentQuestion.structure ? `<div style="font-size: 0.88rem; color: var(--accent-cyan); margin-top: 6px; font-weight: 600;">🧩 Cấu trúc chia: <span style="color: #fff;">${currentQuestion.structure}</span></div>` : ''}
      `;
    }

    if (scrambleContainer) scrambleContainer.style.display = 'none';
    if (scrambleSlots) scrambleSlots.style.display = 'none';
    if (typingSection) typingSection.style.display = 'block';

    const clozeSentence = createClozeFurigana(exObj, currentQuestion.grammar);
    const actionsBlock = getEl('grammar-quiz-actions');
    if (actionsBlock) actionsBlock.style.display = 'flex';

    if (promptJp) {
      promptJp.innerHTML = `
        <div style="font-size: 1.45rem; color: var(--text-primary); font-weight: 700; line-height: 2.2; text-align: center; margin: 0.5rem 0;">
          ${clozeSentence}
        </div>
      `;
    }
    if (quizInput) quizInput.focus();

  // ── Scramble (Sắp xếp câu) ──
  } else if (currentMode === 'scramble') {
    if (promptMeaning) {
      const grammarTag = `<div style="font-size: 1.4rem; color: var(--accent-cyan); font-weight: 800; margin-bottom: 4px;">${currentQuestion.grammar}</div>`;
      const structTag = currentQuestion.structure ? `<div style="font-size: 0.88rem; color: var(--accent-cyan); margin-top: 4px; font-weight: 600;">🧩 Cấu trúc: ${currentQuestion.structure}</div>` : '';
      const hintTag = `<div style="background: rgba(234, 179, 8, 0.12); border: 1px dashed var(--accent-gold); border-radius: 8px; padding: 6px 12px; margin-top: 8px; color: var(--accent-gold); font-weight: 700; font-size: 0.9rem; display: inline-block;">🧩 Sắp xếp các từ bên dưới thành câu hoàn chỉnh:</div>`;
      promptMeaning.innerHTML = grammarTag + `<div style="color: var(--text-secondary); font-size: 1.05rem;">${currentQuestion.meaning.replace(/\n/g, '<br>')}</div>` + structTag + hintTag;
    }

    if (typingSection) typingSection.style.display = 'none';
    const actionsBlock = getEl('grammar-quiz-actions');
    if (actionsBlock) actionsBlock.style.display = 'flex';

    if (promptJp) {
      promptJp.innerHTML = '';
    }
    if (scrambleContainer) {
      scrambleContainer.style.display = 'flex';
      scrambleContainer.innerHTML = '';
    }
    if (scrambleSlots) {
      scrambleSlots.style.display = 'flex';
      scrambleSlots.innerHTML = '<span class="scramble-placeholder">Chạm các từ bên dưới để xếp câu vào đây...</span>';
    }

    // Tạo mảnh ghép
    let pieces = splitSentenceIntoChips(exObj.jp);
    const shuffledPieces = [...pieces].sort(() => Math.random() - 0.5);

    if (scrambleContainer) {
      shuffledPieces.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'scramble-chip';
        chip.textContent = p;
        chip.dataset.original = p;
        chip.onclick = () => handleChipClick(chip);
        scrambleContainer.appendChild(chip);
      });
    }
  }
}

function createClozeFurigana(exObj, grammarTitle) {
  const sentence = exObj.furigana || exObj.jp;
  const clozeSpan = '<span style="color:var(--accent-pink); font-weight:800; border-bottom: 2px dashed var(--accent-pink); padding: 0 0.5rem;">[________]</span>';

  // 1. Ưu tiên đục lỗ theo exObj.target nếu có
  if (exObj && exObj.target) {
    const cleanT = exObj.target.trim();
    if (cleanT && sentence.includes(cleanT)) {
      return sentence.replace(cleanT, clozeSpan);
    }
    // Nếu trong sentence target có chứa kanji và thẻ ruby (ví dụ <ruby>売<rt>う</rt></ruby>れている)
    const plainSentence = sentence.replace(/<ruby>(.*?)(?:<rt>.*?<\/rt>)*<\/ruby>/g, '$1');
    if (plainSentence.includes(cleanT)) {
      const rubyPattern = cleanT.split('').map(char => {
        const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return `(?:<ruby>${escaped}<rt>[^<]*<\/rt><\/ruby>|${escaped})`;
      }).join('');
      const regex = new RegExp(rubyPattern);
      if (regex.test(sentence)) {
        return sentence.replace(regex, clozeSpan);
      }
    }
  }

  // 2. Tách các biến thể tiêu đề của ngữ pháp
  const parts = grammarTitle.split(/[→ー〉/／\s]/).map(p => p.replace(/[\(\)（）]/g, '').trim()).filter(p => p.length > 0);

  for (const part of parts) {
    if (sentence.includes(part)) {
      return sentence.replace(part, clozeSpan);
    }
  }

  // 3. Nếu không khớp trực tiếp (do kanji/ruby), tìm cụm không trùng với tag ruby
  const cleanParts = parts.map(p => p.replace(/[a-zA-Z0-9\(\)]/g, '')).filter(p => p.length > 0);
  for (const part of cleanParts) {
    if (sentence.includes(part)) {
      return sentence.replace(part, clozeSpan);
    }
  }

  // 4. Fallback an toàn tuyệt đối: Không làm lộ grammarTitle!
  return sentence.replace(/(?:<ruby>[^<]+<rt>[^<]+<\/rt><\/ruby>|[ぁ-んァ-ン一-龯]){2,8}(?=[。！？]?$)/, clozeSpan);
}

function splitSentenceIntoChips(sentence) {
  if (sentence.length > 18) {
    const p1 = Math.floor(sentence.length / 3);
    const p2 = Math.floor(sentence.length * 2 / 3);
    return [
      sentence.substring(0, p1),
      sentence.substring(p1, p2),
      sentence.substring(p2)
    ];
  } else {
    const p = Math.floor(sentence.length / 2);
    return [sentence.substring(0, p), sentence.substring(p)];
  }
}

// ========== CHIP INTERACTIVITY (SCRAMBLE) ==========
function handleChipClick(chip) {
  if (isAnswerSubmitted) return;

  const scrambleContainer = getEl('grammar-scramble-container');
  const scrambleSlots = getEl('grammar-scramble-slots');
  if (!scrambleContainer || !scrambleSlots) return;

  const placeholder = scrambleSlots.querySelector('.scramble-placeholder');

  if (chip.parentElement === scrambleContainer) {
    if (placeholder) placeholder.style.display = 'none';
    chip.classList.add('in-slot');
    scrambleSlots.appendChild(chip);
  } else {
    chip.classList.remove('in-slot');
    scrambleContainer.appendChild(chip);

    const slotChips = scrambleSlots.querySelectorAll('.scramble-chip');
    if (slotChips.length === 0 && placeholder) {
      placeholder.style.display = 'inline';
    }
  }
}

// ========== END SCREEN ==========
function showEndScreen() {
  const progressBar = getEl('grammar-quiz-progress-bar');
  const promptMeaning = getEl('grammar-prompt-meaning');
  const promptJp = getEl('grammar-prompt-jp');
  const typingSection = getEl('grammar-typing-section');
  const scrambleContainer = getEl('grammar-scramble-container');
  const scrambleSlots = getEl('grammar-scramble-slots');
  const feedbackBox = getEl('grammar-feedback-box');

  if (progressBar) progressBar.style.width = '100%';
  if (promptMeaning) promptMeaning.innerHTML = '';
  if (promptJp) {
    promptJp.innerHTML = `<div style="text-align:center; padding: 1.5rem 0;">
      <h2 style="color: var(--accent-green); margin-bottom: 0.5rem;">Đã hoàn thành Dojo! 🏆</h2>
      <p style="color: var(--text-secondary);">Bạn đã hoàn thành ${practiceQueue.length} câu luyện tập ngữ pháp.</p>
      <button class="btn-primary" id="btn-grammar-retry" style="margin-top: 1.25rem;">🔄 Luyện lại bài khác</button>
    </div>`;
  }
  if (typingSection) typingSection.style.display = 'none';

  const actionsBlock = getEl('grammar-quiz-actions');
  if (actionsBlock) actionsBlock.style.display = 'none';

  if (scrambleContainer) scrambleContainer.style.display = 'none';
  if (scrambleSlots) scrambleSlots.style.display = 'none';
  if (feedbackBox) feedbackBox.className = 'feedback-box';

  grammarPracticeActive = false;

  const btnRetry = getEl('btn-grammar-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => startPractice());
  }
}
