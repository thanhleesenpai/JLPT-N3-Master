import { N3_GRAMMAR_DATA } from './grammar_data.js';
import { updateGrammarScore } from './storage.js';

let practiceQueue = [];
let currentIndex = 0;
let currentMode = 'shadow';
let currentQuestion = null;
let currentScrambleOrder = [];

// DOM Elements
const viewList = document.getElementById('grammar-list-grid');
const viewPractice = document.getElementById('grammar-practice-view');
const btnPractice = document.getElementById('btn-grammar-practice');
const btnBack = document.getElementById('btn-grammar-back-list');
const btnStart = document.getElementById('btn-start-grammar-quiz');
const modeSelect = document.getElementById('grammar-practice-mode');
const quizCard = document.getElementById('grammar-quiz-card');
const promptJp = document.getElementById('grammar-prompt-jp');
const promptMeaning = document.getElementById('grammar-prompt-meaning');
const scrambleContainer = document.getElementById('grammar-scramble-container');
const scrambleSlots = document.getElementById('grammar-scramble-slots');
const typingSection = document.getElementById('grammar-typing-section');
const quizInput = document.getElementById('grammar-quiz-input');
const feedbackBox = document.getElementById('grammar-feedback-box');
const feedbackTitle = document.getElementById('grammar-feedback-title');
const feedbackDetail = document.getElementById('grammar-feedback-detail');
const progressLabel = document.getElementById('grammar-quiz-progress-label');
const progressBar = document.getElementById('grammar-quiz-progress-bar');
const modeLabel = document.getElementById('grammar-quiz-mode-label');

export function initGrammarPractice() {
  if (!btnPractice) return;

  btnPractice.addEventListener('click', () => {
    viewList.style.display = 'none';
    viewPractice.style.display = 'block';
    quizCard.style.display = 'none';
  });

  btnBack.addEventListener('click', () => {
    viewPractice.style.display = 'none';
    viewList.style.display = 'grid'; // .vocab-grid uses grid
  });

  btnStart.addEventListener('click', () => {
    startPractice();
  });

  quizInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitAnswer();
    }
  });
}

function startPractice() {
  currentMode = modeSelect.value;
  
  // Lọc ra các cấu trúc có chứa ví dụ
  const validGrammars = N3_GRAMMAR_DATA.filter(g => g.examples && g.examples.some(ex => hasJapanese(ex)));
  
  // Random chọn 10 câu
  const shuffled = validGrammars.sort(() => Math.random() - 0.5);
  practiceQueue = shuffled.slice(0, 10);
  
  if (practiceQueue.length === 0) {
    alert("Không tìm thấy dữ liệu ngữ pháp hợp lệ để luyện tập!");
    return;
  }

  currentIndex = 0;
  quizCard.style.display = 'block';
  
  // Set mode label
  const modeNames = { 'shadow': '⌨️ Shadow Typing', 'cloze': '💡 Điền khuyết', 'scramble': '🧩 Sắp xếp' };
  modeLabel.textContent = `Chế độ: ${modeNames[currentMode]}`;
  
  loadNextQuestion();
}

function hasJapanese(str) {
  return /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(str);
}

function extractExample(grammarObj) {
  // Tìm câu ví dụ đầu tiên có tiếng Nhật
  const ex = grammarObj.examples.find(e => hasJapanese(e));
  return ex || grammarObj.grammar; // fallback
}

function loadNextQuestion() {
  if (currentIndex >= practiceQueue.length) {
    showEndScreen();
    return;
  }

  currentQuestion = practiceQueue[currentIndex];
  const exampleSentence = extractExample(currentQuestion);
  
  // Update progress
  progressLabel.textContent = `Câu ${currentIndex + 1} / ${practiceQueue.length}`;
  progressBar.style.width = `${((currentIndex) / practiceQueue.length) * 100}%`;
  
  // Reset UI
  feedbackBox.className = 'feedback-box';
  quizInput.value = '';
  quizInput.disabled = false;
  promptMeaning.innerHTML = currentQuestion.meaning.replace(/\n/g, '<br>') || "Hãy gõ lại cấu trúc: " + currentQuestion.grammar;
  
  // Tùy chỉnh theo chế độ
  if (currentMode === 'shadow') {
    scrambleContainer.style.display = 'none';
    scrambleSlots.style.display = 'none';
    typingSection.style.display = 'block';
    
    // Câu ví dụ mờ
    promptJp.innerHTML = `<span style="opacity: 0.3">${exampleSentence}</span>`;
    quizInput.focus();
    
  } else if (currentMode === 'cloze') {
    scrambleContainer.style.display = 'none';
    scrambleSlots.style.display = 'none';
    typingSection.style.display = 'block';
    
    // Đục lỗ: Tìm cấu trúc ngữ pháp trong câu ví dụ và khoét lỗ
    // Simple logic: thay thế grammar point bằng [____]
    let clozeSentence = exampleSentence;
    // Bỏ ngoặc, dấu suy ra để tìm chuỗi cốt lõi
    const coreGrammar = currentQuestion.grammar.replace(/[（）()]/g, '').trim().split(' ')[0]; // lấy từ đầu tiên làm core (heuristic)
    
    // Try to exact match grammar first
    if (exampleSentence.includes(currentQuestion.grammar)) {
      clozeSentence = exampleSentence.replace(currentQuestion.grammar, '<span style="color:var(--accent-pink);">[________]</span>');
    } else {
      // Fallback: cứ hiện cả câu mờ
      clozeSentence = `<span style="opacity: 0.5">${exampleSentence}</span><br><br><span style="font-size: 1rem; color: var(--accent-pink);">Gõ: ${currentQuestion.grammar}</span>`;
    }
    
    promptJp.innerHTML = clozeSentence;
    quizInput.focus();
    
  } else if (currentMode === 'scramble') {
    typingSection.style.display = 'none';
    promptJp.innerHTML = '';
    scrambleContainer.style.display = 'flex';
    scrambleSlots.style.display = 'flex';
    scrambleContainer.innerHTML = '';
    scrambleSlots.innerHTML = '';
    
    // Tách câu thành các mảnh (giả lập xé nhỏ)
    // Thực tế tiếng Nhật tách từ khá khó, ta sẽ tách theo các hạt (particles) hoặc chia 3-4 phần
    let pieces = [];
    if (exampleSentence.length > 15) {
      pieces = [
        exampleSentence.substring(0, Math.floor(exampleSentence.length/3)),
        exampleSentence.substring(Math.floor(exampleSentence.length/3), Math.floor(exampleSentence.length*2/3)),
        exampleSentence.substring(Math.floor(exampleSentence.length*2/3))
      ];
    } else {
      pieces = [
        exampleSentence.substring(0, exampleSentence.length/2),
        exampleSentence.substring(exampleSentence.length/2)
      ];
    }
    
    // Shuffle pieces
    const shuffledPieces = [...pieces].sort(() => Math.random() - 0.5);
    currentScrambleOrder = [];
    
    shuffledPieces.forEach((p, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.style.padding = '0.5rem 1rem';
      btn.textContent = p;
      btn.dataset.original = p;
      btn.onclick = () => handleScrambleClick(btn);
      scrambleContainer.appendChild(btn);
    });
  }
}

function handleScrambleClick(btn) {
  // Move to slots
  if (btn.parentElement === scrambleContainer) {
    scrambleSlots.appendChild(btn);
  } else {
    scrambleContainer.appendChild(btn);
  }
  
  // Check if all pieces are in slot
  if (scrambleContainer.children.length === 0) {
    // Check order
    const userSentence = Array.from(scrambleSlots.children).map(b => b.dataset.original).join('');
    const correctSentence = extractExample(currentQuestion);
    if (userSentence === correctSentence) {
      submitScramble(true);
    } else {
      submitScramble(false, correctSentence);
    }
  }
}

function submitScramble(isCorrect, correctSentence = '') {
  showFeedback(isCorrect, correctSentence);
}

function submitAnswer() {
  const ans = quizInput.value.trim();
  if (!ans) return;
  
  quizInput.disabled = true;
  let isCorrect = false;
  let expected = "";
  
  if (currentMode === 'shadow') {
    const correctSentence = extractExample(currentQuestion);
    expected = correctSentence;
    // Chấm điểm thoáng: loại bỏ dấu câu, spaces
    const cleanUser = ans.replace(/[。、，．\s]/g, '');
    const cleanCorrect = correctSentence.replace(/[。、，．\s]/g, '');
    
    // Fuzzy match đơn giản: kiểm tra bao hàm
    if (cleanUser === cleanCorrect || cleanUser.includes(cleanCorrect) || cleanCorrect.includes(cleanUser)) {
      isCorrect = true;
    }
  } else if (currentMode === 'cloze') {
    expected = currentQuestion.grammar;
    // Gõ đúng hoặc gần đúng ngữ pháp
    const cleanUser = ans.replace(/[\s（）()]/g, '');
    const cleanCorrect = expected.replace(/[\s（）()]/g, '');
    if (cleanUser === cleanCorrect || expected.includes(ans) && ans.length > 2) {
      isCorrect = true;
    }
  }

  showFeedback(isCorrect, expected);
}

function showFeedback(isCorrect, expectedText) {
  feedbackBox.classList.remove('show', 'correct', 'wrong');
  
  // Kích hoạt re-flow
  void feedbackBox.offsetWidth;
  
  if (isCorrect) {
    feedbackBox.classList.add('show', 'correct');
    feedbackTitle.textContent = 'Chính Xác! 🎉';
    feedbackDetail.innerHTML = `Làm rất tốt! <br> <span style="color:var(--text-muted);font-size:0.9rem;">Cấu trúc: ${currentQuestion.grammar}</span>`;
    
    // Update score
    updateGrammarScore(currentQuestion.id, true, currentMode);
    
    setTimeout(() => {
      currentIndex++;
      feedbackBox.classList.remove('show');
      loadNextQuestion();
    }, 1500);
  } else {
    feedbackBox.classList.add('show', 'wrong');
    feedbackTitle.textContent = 'Chưa Đúng! ❌';
    feedbackDetail.innerHTML = `
      Đáp án đúng: <strong>${expectedText || currentQuestion.grammar}</strong>
    `;
    
    // Update score
    updateGrammarScore(currentQuestion.id, false, currentMode);
    
    setTimeout(() => {
      quizInput.disabled = false;
      quizInput.value = '';
      quizInput.focus();
      if (currentMode === 'scramble') {
        // Reset scramble
        Array.from(scrambleSlots.children).forEach(b => scrambleContainer.appendChild(b));
      }
    }, 2000);
  }
}

function showEndScreen() {
  progressBar.style.width = '100%';
  promptJp.innerHTML = `<div style="text-align:center;">
    <h2 style="color: var(--accent-green);">Đã hoàn thành Dojo! 🏆</h2>
    <p>Bạn đã luyện tập xong 10 câu ngữ pháp.</p>
  </div>`;
  typingSection.style.display = 'none';
  scrambleContainer.style.display = 'none';
  scrambleSlots.style.display = 'none';
  feedbackBox.classList.remove('show');
}
