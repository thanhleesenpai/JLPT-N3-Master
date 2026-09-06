import { auth, db, doc, collection, addDoc, getDocs, deleteDoc, query, orderBy } from './firebase-config.js';
import { getCustomWords, addCustomWordsBulk } from './storage.js';

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || '';

const DOM = {
  tab: document.getElementById('pane-community'),
  grid: document.getElementById('community-grid'),
  btnRefresh: document.getElementById('btn-refresh-community'),
  
  modalManage: document.getElementById('modal-manage-data'),
  modalPublish: document.getElementById('modal-publish'),
  
  inputTitle: document.getElementById('publish-title'),
  inputDesc: document.getElementById('publish-desc'),
  btnSubmitPublish: document.getElementById('btn-submit-publish')
};

let selectedCategoriesToPublish = [];

export function initCommunity() {
  if (DOM.btnRefresh) {
    DOM.btnRefresh.addEventListener('click', loadPublicChapters);
  }

  if (DOM.btnSubmitPublish) {
    DOM.btnSubmitPublish.addEventListener('click', handlePublish);
  }

  // Khởi tạo tab sự kiện
  const tabs = document.querySelectorAll('.nav-btn');
  tabs.forEach(t => {
    if (t.dataset.tab === 'community') {
      t.addEventListener('click', () => {
        if (!auth.currentUser) {
          alert('Bạn cần đăng nhập để truy cập Thư Viện Cộng Đồng!');
          return;
        }
        loadPublicChapters();
      });
    }
  });
}

export function openPublishModal(categories) {
  if (!auth.currentUser) {
    alert('Vui lòng đăng nhập để chia sẻ dữ liệu!');
    return;
  }
  if (categories.length === 0) {
    alert('Vui lòng chọn ít nhất 1 chương để chia sẻ.');
    return;
  }
  selectedCategoriesToPublish = categories;
  DOM.inputTitle.value = '';
  DOM.inputDesc.value = '';
  DOM.modalPublish.classList.add('active');
}

async function handlePublish() {
  const title = DOM.inputTitle.value.trim();
  const desc = DOM.inputDesc.value.trim();

  if (!title) {
    alert('Vui lòng nhập tiêu đề!');
    return;
  }

  const allWords = getCustomWords();
  const wordsToPublish = allWords.filter(w => selectedCategoriesToPublish.includes(w.category));

  if (wordsToPublish.length === 0) {
    alert('Không tìm thấy từ vựng nào trong các chương đã chọn!');
    return;
  }

  const cleanWords = wordsToPublish.map(w => ({
    kanji: w.kanji,
    hiragana: w.hiragana,
    hanviet: w.hanviet,
    meaning: w.meaning,
    category: w.category,
    example_jp: w.example_jp || '',
    example_vi: w.example_vi || ''
  }));

  try {
    DOM.btnSubmitPublish.textContent = 'Đang đẩy lên...';
    DOM.btnSubmitPublish.disabled = true;

    await addDoc(collection(db, "shared_chapters"), {
      authorId: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || 'Người dùng Ẩn danh',
      title: title,
      description: desc,
      words: cleanWords,
      createdAt: new Date().toISOString()
    });

    alert('🎉 Đã chia sẻ thành công lên Thư Viện Cộng Đồng!');
    DOM.modalPublish.classList.remove('active');
    DOM.modalManage.classList.remove('active');
    
    document.querySelector('.nav-btn[data-tab="community"]').click();
  } catch (err) {
    console.error('Lỗi publish:', err);
    alert('Có lỗi xảy ra khi chia sẻ: ' + err.message);
  } finally {
    DOM.btnSubmitPublish.textContent = 'Đăng Tải';
    DOM.btnSubmitPublish.disabled = false;
  }
}

async function loadPublicChapters() {
  if (!DOM.grid) return;
  DOM.grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Đang tải dữ liệu cộng đồng...</div>';

  try {
    const q = query(collection(db, "shared_chapters"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      DOM.grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có bộ từ vựng nào được chia sẻ. Hãy là người đầu tiên!</div>';
      return;
    }

    let html = '';
    const docsData = [];
    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    const isAdmin = currentUid === ADMIN_UID;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      data.id = docSnap.id;
      docsData.push(data);
      
      const date = new Date(data.createdAt).toLocaleDateString('vi-VN');
      const isOwner = data.authorId === currentUid;
      const canDelete = isAdmin || isOwner;
      
      html += `
        <div class="vocab-card" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <div style="font-size: 0.8rem; color: var(--accent-gold);">Đóng góp bởi: ${data.authorName}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">📅 ${date}</div>
            </div>
            <h3 style="color: var(--accent-cyan); margin-bottom: 0.5rem;">${data.title}</h3>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.4;">${data.description || 'Không có mô tả.'}</p>
            <div style="display: inline-block; padding: 0.2rem 0.6rem; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 0.8rem; margin-bottom: 1.5rem;">
              📦 ${data.words ? data.words.length : 0} từ vựng
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-primary btn-download-shared" data-id="${data.id}" style="flex: 1; display: flex; justify-content: center; align-items: center; gap: 0.5rem;">
              📥 Tải về máy
            </button>
            ${canDelete ? `<button class="btn-secondary btn-delete-shared" data-id="${data.id}" style="padding: 0.5rem 0.75rem; color: var(--accent-red); border-color: rgba(239,68,68,0.4);" title="${isAdmin ? 'Xóa (Admin)' : 'Xóa bài của tôi'}">🗑️</button>` : ''}
          </div>
        </div>
      `;
    });

    DOM.grid.innerHTML = html;

    // Gắn sự kiện tải về
    DOM.grid.querySelectorAll('.btn-download-shared').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sharedData = docsData.find(d => d.id === e.currentTarget.dataset.id);
        if (sharedData) handleDownloadShared(sharedData);
      });
    });

    // Gắn sự kiện xóa
    DOM.grid.querySelectorAll('.btn-delete-shared').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Bạn có chắc chắn muốn xóa bài chia sẻ này không?')) {
          try {
            await deleteDoc(doc(db, "shared_chapters", id));
            alert('Đã xóa thành công!');
            loadPublicChapters();
          } catch (err) {
            console.error('Lỗi xóa:', err);
            alert('Lỗi xóa: ' + err.message);
          }
        }
      });
    });

  } catch (err) {
    console.error('Lỗi tải community:', err);
    DOM.grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--accent-red); padding: 2rem;">Lỗi tải dữ liệu. Vui lòng thử lại sau.</div>';
  }
}

function handleDownloadShared(sharedData) {
  if (!sharedData.words || sharedData.words.length === 0) {
    alert('Gói này không có từ vựng nào!');
    return;
  }

  if (confirm(`Bạn có muốn tải về ${sharedData.words.length} từ vựng từ bộ "${sharedData.title}" vào từ điển của bạn không?`)) {
    addCustomWordsBulk(sharedData.words);
    alert(`🎉 Đã tải thành công ${sharedData.words.length} từ vựng! Bạn có thể xem chúng trong Tab Từ Điển.`);
    window.dispatchEvent(new CustomEvent('jlptDataLoaded'));
  }
}
