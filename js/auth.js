import { auth, signInWithPopup, googleProvider, onAuthStateChanged, signOut } from './firebase-config.js';
import { loadDataFromFirestore, clearLocalDataOnLogout } from './storage.js';

export function setupAuthUI() {
  const btnLogin = document.getElementById('btn-auth-login');
  const btnLogout = document.getElementById('btn-auth-logout');
  const authName = document.getElementById('auth-name');
  const authAvatar = document.getElementById('auth-avatar');

  if (!btnLogin || !btnLogout) return;

  btnLogin.addEventListener('click', async () => {
    try {
      btnLogin.textContent = 'Đang đăng nhập...';
      btnLogin.disabled = true;
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      alert("Đăng nhập thất bại: " + error.message);
      btnLogin.textContent = 'Đăng Nhập';
      btnLogin.disabled = false;
    }
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
