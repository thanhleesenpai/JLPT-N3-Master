import { auth, signInWithPopup, googleProvider, onAuthStateChanged, signOut } from './firebase-config.js';
import { loadDataFromFirestore, clearLocalDataOnLogout } from './storage.js';

export function setupAuthUI() {
  const btnLogin = document.getElementById('btn-auth-login');
  const btnLogout = document.getElementById('btn-auth-logout');
  const authName = document.getElementById('auth-name');
  const authAvatar = document.getElementById('auth-avatar');

  // Xử lý Popup - Mở cửa sổ NGAY LẬP TỨC (đồng bộ) trong sự kiện click
  // rồi bắt Firebase dùng lại cửa sổ đó, tránh bị trình duyệt chặn.
  btnLogin.addEventListener('click', (e) => {
    e.preventDefault();

    // Bước 1: Mở cửa sổ trắng ĐỒNG BỘ ngay trong click handler
    // → Trình duyệt KHÔNG BAO GIỜ chặn được vì đây là thao tác trực tiếp của người dùng
    const popup = window.open('about:blank', 'firebaseAuth', 'width=500,height=600,scrollbars=yes');

    if (!popup) {
      alert('Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép popup cho trang web này.');
      return;
    }

    btnLogin.textContent = 'Đang đăng nhập...';
    btnLogin.disabled = true;

    // Bước 2: Tạm thời ghi đè window.open để Firebase SDK dùng lại cửa sổ đã mở
    const _originalOpen = window.open.bind(window);
    window.open = (url, ...rest) => {
      window.open = _originalOpen; // Khôi phục ngay lập tức
      popup.location.href = url;  // Điều hướng popup tới trang đăng nhập Google
      return popup;
    };

    // Bước 3: Gọi signInWithPopup - Firebase sẽ điều hướng cửa sổ đã mở tới trang Google
    signInWithPopup(auth, googleProvider)
      .then(result => {
        console.log("Đăng nhập thành công:", result.user);
      })
      .catch(error => {
        console.error("Lỗi đăng nhập:", error);
        if (popup && !popup.closed) popup.close();
        alert("Đăng nhập thất bại: " + error.message);
        btnLogin.textContent = 'Đăng Nhập';
        btnLogin.disabled = false;
        window.open = _originalOpen; // Khôi phục phòng trường hợp lỗi
      });
  });

  btnLogout.addEventListener('click', async () => {
    try {
      clearLocalDataOnLogout();
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Đã đăng nhập
      btnLogin.style.display = 'none';
      btnLogout.style.display = 'block';
      authName.style.display = 'inline';
      authName.textContent = user.displayName;
      if (user.photoURL) {
        authAvatar.style.display = 'inline';
        authAvatar.src = user.photoURL;
      }

      // Kích hoạt load dữ liệu
      await loadDataFromFirestore(user.uid);
      
      // Bắn sự kiện báo cho app.js tải lại UI
      window.dispatchEvent(new CustomEvent('jlptDataLoaded'));
    } else {
      // Chưa đăng nhập
      btnLogin.style.display = 'block';
      btnLogin.textContent = 'Đăng Nhập';
      btnLogin.disabled = false;
      btnLogout.style.display = 'none';
      authName.style.display = 'none';
      authAvatar.style.display = 'none';
      authAvatar.src = '';

      // Tải lại dữ liệu LocalStorage
      window.dispatchEvent(new CustomEvent('jlptDataLoaded'));
    }
  });
}
