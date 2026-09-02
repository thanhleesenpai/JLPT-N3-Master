/**
 * Bộ chuyển đổi Romaji sang Hiragana thời gian thực (Live Romaji -> Hiragana Converter)
 * Hỗ trợ sokuon (っ), yōon (きゃ, しゃ...), âm ん (n/nn), và gắn trực tiếp vào input field.
 */

// Bảng ánh xạ Romaji sang Hiragana đầy đủ
const ROMAJI_MAP = {
  // Nguyên âm
  'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',

  // K-line
  'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
  'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',

  // G-line
  'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
  'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',

  // S-line
  'sa': 'さ', 'shi': 'し', 'si': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
  'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
  'sya': 'しゃ', 'syu': 'しゅ', 'syo': 'しょ',

  // Z/J-line
  'za': 'ざ', 'ji': 'じ', 'zi': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
  'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',
  'zya': 'じゃ', 'zyu': 'じゅ', 'zyo': 'じょ',

  // T-line
  'ta': 'た', 'chi': 'ち', 'ti': 'ち', 'tsu': 'つ', 'tu': 'つ', 'te': 'て', 'to': 'と',
  'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
  'cya': 'ちゃ', 'cyu': 'ちゅ', 'cyo': 'ちょ',

  // D-line
  'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
  'dya': 'ぢゃ', 'dyu': 'ぢゅ', 'dyo': 'ぢょ',

  // N-line
  'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
  'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',

  // H-line
  'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'hu': 'ふ', 'he': 'へ', 'ho': 'ほ',
  'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',

  // B-line
  'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
  'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',

  // P-line
  'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
  'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',

  // M-line
  'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
  'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',

  // Y-line
  'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',

  // R-line
  'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
  'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',

  // W-line
  'wa': 'わ', 'wi': 'ゐ', 'we': 'ゑ', 'wo': 'を',

  // Special / Nasal
  'nn': 'ん', "n'": 'ん', 'xn': 'ん',

  // Ký tự nhỏ
  'xa': 'ぁ', 'xi': 'ぃ', 'xu': 'ぅ', 'xe': 'ぇ', 'xo': 'ょ',
  'xtsu': 'っ', 'xtu': 'っ', 'xya': 'ゃ', 'xyu': 'ゅ', 'xyo': 'ょ',

  // Dấu câu
  '-': 'ー', '.': '。', ',': '、', '!': '！', '?': '？'
};

/**
 * Chuyển chuỗi Romaji sang Hiragana
 * @param {string} str - Chuỗi Romaji nhập vào
 * @returns {string} Chuỗi Hiragana
 */
export function romajiToHiragana(str) {
  if (!str) return '';
  
  let input = str.toLowerCase();
  let result = '';
  let i = 0;
  
  while (i < input.length) {
    // Nếu gặp chữ kanji hoặc hiragana/katakana sẵn có thì giữ nguyên
    const code = input.charCodeAt(i);
    if (code > 255) {
      result += input[i];
      i++;
      continue;
    }

    let matched = false;

    // 1. Kiểm tra khớp 4, 3, 2, 1 ký tự trong ROMAJI_MAP
    for (let len = 4; len >= 1; len--) {
      if (i + len <= input.length) {
        const sub = input.substring(i, i + len);
        if (ROMAJI_MAP[sub]) {
          result += ROMAJI_MAP[sub];
          i += len;
          matched = true;
          break;
        }
      }
    }

    if (matched) continue;

    // 2. Xử lý âm 'n' đứng trước phụ âm (không phải nguyên âm a, i, u, e, o, y)
    if (input[i] === 'n') {
      const nextChar = i + 1 < input.length ? input[i + 1] : '';
      if (nextChar === 'n' || (nextChar && !'aiueoy'.includes(nextChar))) {
        result += 'ん';
        i += (nextChar === 'n' ? 2 : 1);
        continue;
      }
    }

    // 3. Xử lý sokuon (âm lặp phụ âm như kk, tt, ss, pp, dd...) -> っ
    if (i + 1 < input.length && input[i] === input[i + 1] && 'bcdfghjklmnpqrstvwxz'.includes(input[i]) && input[i] !== 'n') {
      result += 'っ';
      i++;
      continue;
    }

    // 4. Nếu không khớp quy tắc nào thì giữ nguyên ký tự gốc
    result += input[i];
    i++;
  }

  return result;
}

/**
 * Gắn bộ tự động chuyển đổi Romaji vào một thẻ input HTML
 * @param {HTMLInputElement} inputEl 
 * @param {Function} onUpdateCallback 
 */
export function attachRomajiInput(inputEl, onUpdateCallback) {
  if (!inputEl) return;

  let isComposing = false;

  inputEl.addEventListener('compositionstart', () => { isComposing = true; });
  inputEl.addEventListener('compositionend', () => { 
    isComposing = false; 
    if (onUpdateCallback) onUpdateCallback(inputEl.value);
  });

  inputEl.addEventListener('input', (e) => {
    if (isComposing) return;
    
    // Đọc trạng thái toggle xem có bật Romaji auto-convert không
    const isRomajiMode = inputEl.dataset.romajiMode !== 'false';
    if (!isRomajiMode) {
      if (onUpdateCallback) onUpdateCallback(inputEl.value);
      return;
    }

    const cursorPos = inputEl.selectionStart;
    const oldVal = inputEl.value;
    const newVal = romajiToHiragana(oldVal);

    if (oldVal !== newVal) {
      inputEl.value = newVal;
      // Điều chỉnh vị trí con trỏ bàn phím
      const diff = oldVal.length - newVal.length;
      const newPos = Math.max(0, cursorPos - diff);
      inputEl.setSelectionRange(newPos, newPos);
    }

    if (onUpdateCallback) onUpdateCallback(inputEl.value);
  });
}
