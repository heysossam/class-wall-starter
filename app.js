// ===================================================
// 우리 반 담벼락 - Firebase Firestore & 데이터베이스 연동
//
// Firebase 무료 Spark 요금제 기반 실시간 데이터베이스(Firestore)를 사용합니다.
// Firebase 설정(firebaseConfig)을 넣으면 모든 학생 화면에서 실시간 동기화되고,
// 설정 전에도 브라우저 저장소(localStorage)에 안전하게 자동 저장됩니다.
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


// ===================================================
// 1. Firebase 설정 (무료 Spark 요금제)
// ===================================================
const firebaseConfig = {
  apiKey: "AIzaSyCw7SfjfDSMoyvpXJ3oYOnElSVG2bj9Exg",
  authDomain: "wall-class.firebaseapp.com",
  projectId: "wall-class",
  storageBucket: "wall-class.firebasestorage.app",
  messagingSenderId: "730664953899",
  appId: "1:730664953899:web:7d6eb312d3b19555b8626e"
};

// Firebase 설정이 유효한지 확인
const isFirebaseReady = Boolean(
  firebaseConfig.projectId &&
  firebaseConfig.apiKey
);

let db = null;
let memosCollection = null;
let auth = null;

if (isFirebaseReady) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    memosCollection = collection(db, "memos");
  } catch (err) {
    console.error("Firebase 초기화 오류:", err);
  }
}


// ===================================================
// 2. 메모 데이터 및 로컬 저장소(localStorage) 관리
// ===================================================

const LOCAL_STORAGE_KEY = "class_wall_memos_v1";

// 사용 가능한 반응 이모지 목록
const EMOJIS = ["❤️", "👍", "💡", "👏", "😊"];

// 비속어 금칙어 목록 (바르고 고운 교실 언어 문화 조성을 위한 필터링)
const BAD_WORDS = [
  "시발", "씨발", "시빨", "씨빨", "병신", "븅신", "지랄", "존나", "졸라",
  "개새끼", "개색기", "새끼", "닥쳐", "꺼져", "뒈져", "뒤져", "썅", "좆",
  "미친놈", "미친년", "느금마", "니애미", "애미", "창녀", "걸레"
];

// 비속어 검사 함수 (공백이나 특수문자로 띄어쓴 비속어도 감지)
function containsBadWord(text) {
  if (!text) return false;
  const clean = text.replace(/[\s\-_.,!?~@#$%^&*()]/g, "").toLowerCase();
  return BAD_WORDS.some(function (word) {
    return clean.includes(word) || text.includes(word);
  });
}

// 의미없는 문자 반복(도배) 검사 함수 (동일 문자 5회 이상 연속 방지)
function hasExcessiveRepetition(text) {
  if (!text) return false;
  return /(.)\1{4,}/u.test(text);
}

// 댓글 연속 작성 쿨다운 추적 (마지막 댓글 작성 시각)
let lastCommentTime = 0;

// 댓글 창이 열려 있는 메모 ID 목록
const openComments = new Set();

// 기본 메모 목록 (처음 접속 시 표시할 예시 데이터)
const defaultMemos = [
  {
    id: "1",
    text: "오늘 과학 시간에 한 실험이 재미있었다",
    createdAt: 1757030400000,
    likes: 5,
    likedBy: [],
    reactions: { "❤️": 5, "👍": 2, "💡": 1, "👏": 1, "😊": 0 },
    author: "호기심이",
    pin: "0000",
    comments: [
      { id: "c1", text: "어떤 실험이 가장 재미있었나요?", author: "탐구왕", createdAt: 1757030460000 }
    ]
  },
  {
    id: "2",
    text: "궁금한 점 - 물은 왜 100도에서 끓나요?",
    createdAt: 1757030500000,
    likes: 2,
    likedBy: [],
    reactions: { "❤️": 2, "👍": 1, "💡": 3, "👏": 0, "😊": 0 },
    author: "질문왕",
    pin: "0000",
    comments: [
      { id: "c2", text: "기압이 1기압일 때 물이 100도에서 끓어요!", author: "과학꿈나무", createdAt: 1757030560000 }
    ]
  },
  {
    id: "3",
    text: "모둠 친구들이 도와줘서 고마웠다",
    createdAt: 1757030600000,
    likes: 4,
    likedBy: [],
    reactions: { "❤️": 4, "👍": 3, "💡": 0, "👏": 4, "😊": 1 },
    author: "행복이",
    pin: "0000",
    comments: []
  }
];

// 로컬 저장소에서 메모 불러오기
function getLocalMemos() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("로컬 메모 읽기 오류:", e);
  }
  return defaultMemos;
}

// 로컬 저장소에 메모 저장하기
function saveLocalMemos(memoList) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(memoList));
  } catch (e) {
    console.error("로컬 메모 저장 오류:", e);
  }
}

// 현재 메모 목록
let memos = isFirebaseReady ? [] : getLocalMemos();

// Firebase Firestore 실시간 구독 (새 글, 삭제, 좋아요 자동 반영)
if (isFirebaseReady && memosCollection) {
  const q = query(memosCollection, orderBy("createdAt", "asc"));
  onSnapshot(q, function (snapshot) {
    memos = [];
    snapshot.forEach(function (docSnap) {
      memos.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    render();
  }, function (error) {
    console.error("Firestore 실시간 동기화 오류:", error);
  });
}


// ===================================================
// 3. 로그인 관리 (Google 로그인 및 간단 로그인 지원)
// ===================================================

let currentUser = null;
let showSimpleLoginForm = false; // 이름/PIN 로그인 폼 표시 여부

// 브라우저 세션에 저장된 이전 간단 로그인 정보 복원
try {
  const savedUser = sessionStorage.getItem("class_wall_user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
  }
} catch (e) {
  console.error("세션 정보 복원 오류:", e);
}

// Google 로그인 실행 함수
async function loginWithGoogle() {
  if (!auth) {
    alert("Firebase 인증 설정이 준비되지 않았습니다. 인터넷 연결 및 설정을 확인해주세요.");
    return;
  }

  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    currentUser = {
      name: user.displayName || "구글 사용자",
      uid: user.uid,
      photoURL: user.photoURL,
      isGoogle: true
    };
    renderUserArea();
    render();

    const inputArea = document.getElementById("input");
    if (inputArea) inputArea.focus();
  } catch (error) {
    console.error("구글 로그인 실패:", error);
    if (error.code === "auth/popup-closed-by-user") {
      return; // 사용자가 팝업창을 닫은 경우 알림 불필요
    }
    if (error.code === "auth/operation-not-allowed" || error.code === "auth/configuration-not-found") {
      alert("Firebase 콘솔에서 Authentication > 로그인 방법 > Google을 '사용 설정'으로 켜주세요!");
    } else {
      alert(`구글 로그인 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  }
}

// 로그아웃 처리 함수
async function logout() {
  if (auth && auth.currentUser) {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase 로그아웃 오류:", e);
    }
  }
  currentUser = null;
  sessionStorage.removeItem("class_wall_user");
  renderUserArea();
  render();
}

// Firebase Auth 로그인 상태 실시간 감지 (새로고침해도 구글 로그인 유지)
if (auth) {
  onAuthStateChanged(auth, function (user) {
    if (user) {
      currentUser = {
        name: user.displayName || "구글 사용자",
        uid: user.uid,
        photoURL: user.photoURL,
        isGoogle: true
      };
      renderUserArea();
      render();
    } else {
      // Firebase Auth 로그아웃 시 구글 로그인 계정이면 초기화
      if (currentUser && currentUser.isGoogle) {
        currentUser = null;
        renderUserArea();
        render();
      }
    }
  });
}

// 상단 로그인 영역 화면 그리기
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  if (!userArea) return;

  if (currentUser) {
    // 로그인 상태 UI (프로필 사진, 이름, 로그아웃 버튼)
    const avatarHtml = currentUser.photoURL
      ? `<img src="${currentUser.photoURL}" class="user-profile-img" alt="프로필" referrerpolicy="no-referrer">`
      : `<span class="user-avatar">👤</span>`;

    userArea.innerHTML = `
      <div class="user-logged-in">
        <div class="user-info">
          ${avatarHtml}
          <span><strong>${currentUser.name}</strong>님 참여 중</span>
        </div>
        <button id="logoutBtn" class="logout-btn" type="button">로그아웃</button>
      </div>
    `;

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }

    const inputArea = document.getElementById("input");
    if (inputArea) {
      inputArea.placeholder = `${currentUser.name}님의 생각을 남겨보세요! (최대 100자, 엔터로 등록)`;
    }
  } else {
    // 비로그인 상태 UI: Google 로그인 버튼 + 필요 시 이름/PIN 로그인 토글 제공
    let simpleFormHtml = "";
    if (showSimpleLoginForm) {
      simpleFormHtml = `
        <div class="login-divider">또는</div>
        <form class="user-form" id="loginForm">
          <input type="text" id="loginName" placeholder="이름/별명" maxlength="10" required>
          <input type="password" id="loginPin" placeholder="비밀번호(숫자 4자리)" maxlength="4" pattern="\\d{4}" inputmode="numeric" title="숫자 4자리를 입력하세요" required>
          <button type="submit" class="auth-btn">로그인</button>
        </form>
      `;
    }

    userArea.innerHTML = `
      <div class="login-container">
        <button id="googleLoginBtn" class="google-login-btn" type="button">
          <svg class="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.36 7.35 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.29 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
          </svg>
          Google 계정으로 로그인
        </button>
        <div>
          <button id="toggleSimpleBtn" class="toggle-simple-btn" type="button">
            ${showSimpleLoginForm ? "▲ 간단 로그인 접기" : "▼ 구글 계정이 없으신가요? 이름으로 로그인"}
          </button>
        </div>
        ${simpleFormHtml}
      </div>
    `;

    // Google 로그인 버튼 이벤트
    const googleLoginBtn = document.getElementById("googleLoginBtn");
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener("click", loginWithGoogle);
    }

    // 간단 로그인 토글 버튼 이벤트
    const toggleSimpleBtn = document.getElementById("toggleSimpleBtn");
    if (toggleSimpleBtn) {
      toggleSimpleBtn.addEventListener("click", function () {
        showSimpleLoginForm = !showSimpleLoginForm;
        renderUserArea();
      });
    }

    // 간단 로그인 폼 이벤트
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const nameInput = document.getElementById("loginName");
        const pinInput = document.getElementById("loginPin");
        const name = nameInput.value.trim();
        const pin = pinInput.value.trim();

        if (!name) {
          alert("이름 또는 별명을 입력해주세요.");
          nameInput.focus();
          return;
        }

        if (!/^\d{4}$/.test(pin)) {
          alert("비밀번호는 숫자 4자리로 입력해주세요.");
          pinInput.focus();
          return;
        }

        currentUser = { name: name, pin: pin };
        sessionStorage.setItem("class_wall_user", JSON.stringify(currentUser));
        renderUserArea();
        render();

        const inputArea = document.getElementById("input");
        if (inputArea) inputArea.focus();
      });
    }

    const inputArea = document.getElementById("input");
    if (inputArea) {
      inputArea.placeholder = "상단에서 로그인 후 메모를 남길 수 있습니다.";
    }
  }
}

// ===================================================
// 4. 데이터를 다루는 함수들
// 백엔드: 이 함수들이 Firestore 데이터베이스와 연동됩니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore 순서는 query의 orderBy("createdAt") 으로 맞춥니다.
function loadMemos() {
  return memos.slice().sort(function (a, b) {
    return a.createdAt - b.createdAt;
  });
}

// 메모를 새로 씁니다.
// 백엔드: 작성자 정보(author, uid, pin)를 함께 저장합니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("메모를 작성하려면 먼저 상단에서 구글 로그인 또는 이름으로 로그인해주세요!");
    return false;
  }

  // 1. 글자 수 검사 (5자 이상 100자 이하)
  if (text.length < 5) {
    alert("메모는 5글자 이상 작성해주세요!");
    return false;
  }
  if (text.length > 100) {
    alert("메모는 최대 100자까지 입력할 수 있습니다.");
    return false;
  }

  // 2. 비속어 검사
  if (containsBadWord(text)) {
    alert("바르고 고운 말을 사용해주세요! 비속어가 포함되어 있어 등록할 수 없습니다.");
    return false;
  }

  // 3. 의미없는 문자 반복 도배 검사
  if (hasExcessiveRepetition(text)) {
    alert("동일한 문자가 너무 많이 반복되었습니다. 올바른 문장으로 작성해 주세요!");
    return false;
  }

  const memoData = {
    text: text,
    createdAt: Date.now(),
    likes: 0,
    likedBy: [],
    reactions: { "❤️": 0, "👍": 0, "💡": 0, "👏": 0, "😊": 0 },
    comments: [],
    author: currentUser.name,
    uid: currentUser.uid || null,
    pin: currentUser.pin || ""
  };

  if (isFirebaseReady && memosCollection) {
    try {
      await addDoc(memosCollection, memoData);
      // Firestore onSnapshot에 의해 화면이 자동으로 갱신됩니다.
    } catch (e) {
      console.error("Firestore 저장 실패:", e);
      alert("데이터베이스 저장에 실패했습니다. Firebase 보안 규칙을 확인해주세요.");
      return false;
    }
  } else {
    // 로컬 저장소 모드
    const newId = "memo_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    memos.push({
      id: newId,
      ...memoData
    });
    saveLocalMemos(memos);
    render();
  }
  return true;
}

// 메모를 지웁니다.
// 내가 작성한 메모(구글 로그인 uid 또는 이름+비밀번호)이거나 4자리 비밀번호가 일치해야 지울 수 있습니다.
async function deleteMemo(id) {
  const memo = memos.find(function (m) {
    return String(m.id) === String(id);
  });
  if (!memo) return;

  // 작성자 본인 확인
  // 1) 구글 로그인 사용자: memo.uid와 currentUser.uid 일치 여부
  // 2) 일반 로그인 사용자: memo.author와 currentUser.name, memo.pin과 currentUser.pin 일치 여부
  const isAuthor = currentUser && (
    (currentUser.uid && memo.uid && currentUser.uid === memo.uid) ||
    (currentUser.name === memo.author && currentUser.pin && currentUser.pin === memo.pin)
  );

  if (isAuthor) {
    if (!confirm("작성하신 메모를 삭제하시겠습니까?")) return;
  } else {
    // 본인이 아니거나 비로그인 상태일 때는 4자리 비밀번호 확인 (핀이 등록된 경우)
    if (!memo.pin) {
      alert("구글 계정으로 작성된 메모는 작성자 본인만 삭제할 수 있습니다.");
      return;
    }
    const inputPin = prompt(`'${memo.author || "작성자"}'님이 설정한 4자리 비밀번호를 입력해주세요:`);
    if (inputPin === null) return; // 취소한 경우

    if (inputPin !== memo.pin) {
      alert("비밀번호가 일치하지 않아 삭제할 수 없습니다.");
      return;
    }
  }

  if (isFirebaseReady && db) {
    try {
      await deleteDoc(doc(db, "memos", String(id)));
    } catch (e) {
      console.error("Firestore 삭제 실패:", e);
      alert("데이터베이스 삭제에 실패했습니다.");
    }
  } else {
    // 로컬 저장소 모드
    memos = memos.filter(function (m) {
      return String(m.id) !== String(id);
    });
    saveLocalMemos(memos);
    render();
  }
}

// 이모지 반응(❤️, 👍, 💡, 👏, 😊)을 누릅니다
async function reactMemo(id, emoji) {
  const memo = memos.find(function (m) {
    return String(m.id) === String(id);
  });
  if (!memo) return;

  if (isFirebaseReady && db) {
    try {
      await updateDoc(doc(db, "memos", String(id)), {
        [`reactions.${emoji}`]: increment(1),
        likes: increment(1)
      });
    } catch (e) {
      console.error("이모지 반응 업데이트 실패:", e);
    }
  } else {
    // 로컬 저장소 모드
    if (!memo.reactions) {
      memo.reactions = { "❤️": memo.likes || 0 };
    }
    memo.reactions[emoji] = (memo.reactions[emoji] || 0) + 1;
    memo.likes = (memo.likes || 0) + 1;
    saveLocalMemos(memos);
    render();
  }
}

// 좋아요(하트)를 누릅니다
// 규칙: 본인 글에는 누를 수 없고, 친구 글에 1인 1회만 누를 수 있습니다 (다시 누르면 취소).
async function likeMemo(id) {
  if (!currentUser) {
    alert("좋아요를 누르려면 먼저 상단에서 구글 로그인 또는 이름으로 로그인해주세요!");
    return;
  }

  const memo = memos.find(function (m) {
    return String(m.id) === String(id);
  });
  if (!memo) return;

  // 자신의 글에는 좋아요를 누를 수 없음
  const isMyMemo = (currentUser.uid && memo.uid && currentUser.uid === memo.uid) ||
                   (currentUser.name === memo.author);
  if (isMyMemo) {
    alert("자신의 글에는 좋아요를 누를 수 없습니다. 친구들의 글에 좋아요를 남겨보세요! 😊");
    return;
  }

  const likedBy = Array.isArray(memo.likedBy) ? memo.likedBy : [];
  const userIdentifier = currentUser.uid ? `uid_${currentUser.uid}` : currentUser.name;
  const alreadyLiked = likedBy.includes(userIdentifier) || likedBy.includes(currentUser.name);
  const removeKey = likedBy.includes(userIdentifier) ? userIdentifier : currentUser.name;

  if (isFirebaseReady && db) {
    try {
      if (alreadyLiked) {
        // 이미 누른 경우: 좋아요 취소 (1회 제한 유지)
        await updateDoc(doc(db, "memos", String(id)), {
          likedBy: arrayRemove(removeKey),
          likes: increment(-1)
        });
      } else {
        // 처음 누르는 경우: 좋아요 등록
        await updateDoc(doc(db, "memos", String(id)), {
          likedBy: arrayUnion(userIdentifier),
          likes: increment(1)
        });
      }
    } catch (e) {
      console.error("좋아요 처리 실패:", e);
      alert("좋아요 처리에 실패했습니다.");
    }
  } else {
    // 로컬 저장소 모드
    if (alreadyLiked) {
      memo.likedBy = likedBy.filter(function (name) {
        return name !== removeKey && name !== userIdentifier && name !== currentUser.name;
      });
      memo.likes = Math.max(0, (memo.likes || 1) - 1);
    } else {
      memo.likedBy = [...likedBy, userIdentifier];
      memo.likes = (memo.likes || 0) + 1;
    }
    saveLocalMemos(memos);
    render();
  }
}

// 댓글을 새로 작성합니다
async function addComment(memoId, text) {
  if (!currentUser) {
    alert("댓글을 작성하려면 먼저 상단에서 구글 로그인 또는 이름으로 로그인해주세요!");
    return false;
  }

  // 1. 비속어 검사
  if (containsBadWord(text)) {
    alert("바르고 고운 말을 사용해주세요! 비속어가 포함된 댓글은 등록할 수 없습니다.");
    return false;
  }

  // 2. 의미없는 문자 반복 도배 검사 (예: ㅋㅋㅋㅋㅋ 등)
  if (hasExcessiveRepetition(text)) {
    alert("동일한 문자가 너무 많이 반복되었습니다. 올바른 문장으로 작성해 주세요!");
    return false;
  }

  // 3. 댓글 연속 작성 간격(쿨다운) 검사 (5초)
  const now = Date.now();
  if (now - lastCommentTime < 5000) {
    const remainSec = Math.ceil((5000 - (now - lastCommentTime)) / 1000);
    alert(`댓글을 너무 연속으로 빠르게 작성할 수 없습니다. ${remainSec}초 후 다시 시도해주세요. (도배 방지)`);
    return false;
  }

  const memo = memos.find(function (m) {
    return String(m.id) === String(memoId);
  });
  if (!memo) return false;

  // 4. 한 게시글당 1인 댓글 최대 5개 제한
  const myCommentsCount = (memo.comments || []).filter(function (c) {
    return (currentUser.uid && c.uid && currentUser.uid === c.uid) || (c.author === currentUser.name);
  }).length;
  if (myCommentsCount >= 5) {
    alert("한 게시글에는 1인당 최대 5개까지만 댓글을 작성할 수 있습니다.");
    return false;
  }

  // 쿨다운 시각 기록
  lastCommentTime = now;

  const comment = {
    id: "c_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    text: text,
    author: currentUser.name,
    uid: currentUser.uid || null,
    createdAt: Date.now()
  };

  openComments.add(String(memoId));

  if (isFirebaseReady && db) {
    try {
      await updateDoc(doc(db, "memos", String(memoId)), {
        comments: arrayUnion(comment)
      });
    } catch (e) {
      console.error("댓글 저장 실패:", e);
      alert("댓글 저장에 실패했습니다.");
      return false;
    }
  } else {
    // 로컬 저장소 모드
    if (!memo.comments) memo.comments = [];
    memo.comments.push(comment);
    saveLocalMemos(memos);
    render();
  }
  return true;
}

// 댓글을 삭제합니다
async function deleteComment(memoId, commentId) {
  const memo = memos.find(function (m) {
    return String(m.id) === String(memoId);
  });
  if (!memo || !memo.comments) return;

  const comment = memo.comments.find(function (c) {
    return c.id === commentId;
  });
  if (!comment) return;

  const isCommentAuthor = currentUser && (
    (currentUser.uid && comment.uid && currentUser.uid === comment.uid) ||
    (currentUser.name === comment.author)
  );

  if (isCommentAuthor) {
    if (!confirm("작성하신 댓글을 삭제하시겠습니까?")) return;
  } else {
    alert("본인이 작성한 댓글만 삭제할 수 있습니다.");
    return;
  }

  const updatedComments = memo.comments.filter(function (c) {
    return c.id !== commentId;
  });

  if (isFirebaseReady && db) {
    try {
      await updateDoc(doc(db, "memos", String(memoId)), {
        comments: updatedComments
      });
    } catch (e) {
      console.error("댓글 삭제 실패:", e);
    }
  } else {
    memo.comments = updatedComments;
    saveLocalMemos(memos);
    render();
  }
}


// ===================================================
// 화면 그리기
// ===================================================

function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  loadMemos().forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기 (예쁜 포스트잇 스타일, 작성자 표시, 다양한 이모지 반응 및 댓글)
function makeMemo(memo) {
  const div = document.createElement("div");
  // 색상 테마를 순서대로 적용 (theme-0 ~ theme-4)
  const themeIndex = (memo.id || 0) % 5;
  div.className = `memo theme-${themeIndex}`;

  // 상단 핀 장식
  const pin = document.createElement("span");
  pin.className = "memo-pin";
  pin.textContent = "📌";
  div.appendChild(pin);

  // 상단 헤더 (작성자 뱃지 & 삭제 버튼)
  const header = document.createElement("div");
  header.className = "memo-header";

  const authorBadge = document.createElement("span");
  authorBadge.className = "memo-author-badge";
  const isMine = currentUser && (
    (currentUser.uid && memo.uid && currentUser.uid === memo.uid) ||
    (currentUser.name === memo.author)
  );
  if (isMine) {
    authorBadge.classList.add("my-memo");
  }
  authorBadge.textContent = memo.author ? `👤 ${memo.author}${isMine ? ' (나)' : ''}` : "👤 익명";
  header.appendChild(authorBadge);

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.title = "메모 지우기";
  del.textContent = "×";
  del.addEventListener("click", function () {
    deleteMemo(memo.id);
  });
  header.appendChild(del);
  div.appendChild(header);

  // 메모 본문 내용
  const textDiv = document.createElement("div");
  textDiv.className = "memo-text";
  textDiv.textContent = memo.text;
  div.appendChild(textDiv);

  // 이모지 반응 뱃지 바 (누적된 이모지가 있을 때 표시)
  if (memo.reactions) {
    const reactionsBar = document.createElement("div");
    reactionsBar.className = "reactions-bar";
    let hasAnyReaction = false;

    EMOJIS.forEach(function (emoji) {
      const count = memo.reactions[emoji] || 0;
      if (count > 0) {
        hasAnyReaction = true;
        const badge = document.createElement("button");
        badge.type = "button";
        badge.className = "reaction-badge";
        badge.innerHTML = `<span>${emoji}</span> <span>${count}</span>`;
        badge.title = `${emoji} 반응 남기기 (${count}개)`;
        badge.addEventListener("click", function (e) {
          e.stopPropagation();
          if (!currentUser) {
            alert("이모지 반응을 남기려면 먼저 로그인해주세요!");
            return;
          }
          reactMemo(memo.id, emoji);
        });
        reactionsBar.appendChild(badge);
      }
    });

    if (hasAnyReaction) {
      div.appendChild(reactionsBar);
    }
  }

  // 하단 영역 (작성 시간 및 좋아요 / 댓글 버튼)
  const footer = document.createElement("div");
  footer.className = "memo-footer";

  const timeSpan = document.createElement("span");
  timeSpan.className = "memo-time";
  timeSpan.textContent = formatTime(memo.createdAt);
  footer.appendChild(timeSpan);

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "memo-actions";

  // 1. 이모지 반응 & 좋아요 버튼 (호버 시 다양한 이모지 선택 가능)
  const reactionWrapper = document.createElement("div");
  reactionWrapper.className = "reaction-wrapper";

  // 호버 시 나타나는 이모지 팝오버 (❤️, 👍, 💡, 👏, 😊)
  const popover = document.createElement("div");
  popover.className = "emoji-popover";

  EMOJIS.forEach(function (emoji) {
    const popBtn = document.createElement("button");
    popBtn.type = "button";
    popBtn.className = "emoji-popover-btn";
    popBtn.textContent = emoji;
    popBtn.title = `${emoji} 반응 남기기`;
    popBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!currentUser) {
        alert("이모지 반응을 남기려면 먼저 로그인해주세요!");
        return;
      }
      reactMemo(memo.id, emoji);
    });
    popover.appendChild(popBtn);
  });
  reactionWrapper.appendChild(popover);

  const likedBy = Array.isArray(memo.likedBy) ? memo.likedBy : [];
  const userIdentifier = currentUser ? (currentUser.uid ? `uid_${currentUser.uid}` : currentUser.name) : null;
  const isLiked = Boolean(currentUser && (likedBy.includes(userIdentifier) || likedBy.includes(currentUser.name)));
  const likeCount = (memo.likedBy ? memo.likedBy.length : memo.likes) || 0;

  const likeBtn = document.createElement("button");
  likeBtn.className = `like-btn ${isLiked ? 'liked' : ''} ${isMine ? 'my-post' : ''}`;
  likeBtn.type = "button";
  likeBtn.title = isMine ? "마우스를 올리면 이모지를 선택할 수 있습니다" : (isLiked ? "좋아요 취소 (마우스 올려 다른 이모지 선택)" : "좋아요 누르기 (마우스 올려 다른 이모지 선택)");
  likeBtn.innerHTML = `<span class="like-icon">${isLiked ? '❤️' : '🤍'}</span> <span class="like-count">${likeCount}</span>`;
  likeBtn.addEventListener("click", function () {
    likeMemo(memo.id);
  });
  reactionWrapper.appendChild(likeBtn);
  actionsDiv.appendChild(reactionWrapper);

  // 2. 댓글 토글 버튼
  const comments = memo.comments || [];
  const isCommentsOpen = openComments.has(String(memo.id));

  const commentToggleBtn = document.createElement("button");
  commentToggleBtn.className = `comment-toggle-btn ${isCommentsOpen ? 'active' : ''}`;
  commentToggleBtn.type = "button";
  commentToggleBtn.title = isCommentsOpen ? "댓글 접기" : "댓글 펼치기";
  commentToggleBtn.innerHTML = `💬 <span>${comments.length > 0 ? comments.length : '댓글'}</span>`;
  commentToggleBtn.addEventListener("click", function () {
    if (openComments.has(String(memo.id))) {
      openComments.delete(String(memo.id));
    } else {
      openComments.add(String(memo.id));
    }
    render();
  });
  actionsDiv.appendChild(commentToggleBtn);

  footer.appendChild(actionsDiv);
  div.appendChild(footer);

  // 댓글 섹션 (펼쳐졌을 때만 표시)
  if (isCommentsOpen) {
    const commentsSection = document.createElement("div");
    commentsSection.className = "comments-section";

    // 댓글 목록
    const commentsList = document.createElement("div");
    commentsList.className = "comments-list";

    if (comments.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.style.fontSize = "11px";
      emptyMsg.style.color = "#94a3b8";
      emptyMsg.textContent = "아직 댓글이 없습니다. 첫 댓글을 남겨보세요!";
      commentsList.appendChild(emptyMsg);
    } else {
      comments.forEach(function (comment) {
        const item = document.createElement("div");
        item.className = "comment-item";

        const cHeader = document.createElement("div");
        cHeader.className = "comment-header";

        const cAuthor = document.createElement("span");
        cAuthor.className = "comment-author";
        cAuthor.textContent = `👤 ${comment.author}`;
        cHeader.appendChild(cAuthor);

        // 작성자 본인일 경우 삭제 버튼 표시
        const isMyComment = currentUser && (
          (currentUser.uid && comment.uid && currentUser.uid === comment.uid) ||
          (currentUser.name === comment.author)
        );
        if (isMyComment) {
          const cDel = document.createElement("button");
          cDel.className = "comment-del-btn";
          cDel.textContent = "×";
          cDel.title = "댓글 삭제";
          cDel.addEventListener("click", function () {
            deleteComment(memo.id, comment.id);
          });
          cHeader.appendChild(cDel);
        }
        item.appendChild(cHeader);

        const cText = document.createElement("div");
        cText.className = "comment-text";
        cText.textContent = comment.text;
        item.appendChild(cText);

        commentsList.appendChild(item);
      });
    }
    commentsSection.appendChild(commentsList);

    // 댓글 작성 폼
    const commentForm = document.createElement("form");
    commentForm.className = "comment-form";

    const cInput = document.createElement("input");
    cInput.className = "comment-input";
    cInput.type = "text";
    cInput.placeholder = currentUser ? "댓글을 입력하세요..." : "로그인 후 댓글 작성 가능";
    cInput.maxLength = 100;
    if (!currentUser) cInput.disabled = true;

    const cSubmit = document.createElement("button");
    cSubmit.className = "comment-submit-btn";
    cSubmit.type = "submit";
    cSubmit.textContent = "등록";
    if (!currentUser) cSubmit.disabled = true;

    commentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const val = cInput.value.trim();
      if (!val) return;
      addComment(memo.id, val);
    });

    commentForm.appendChild(cInput);
    commentForm.appendChild(cSubmit);
    commentsSection.appendChild(commentForm);

    div.appendChild(commentsSection);
  }

  return div;
}

// 시간 표시를 깔끔하게 변환해 주는 함수
function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}월 ${day}일 ${hours}:${minutes}`;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르거나 등록 버튼을 클릭하면 담벼락에 붙습니다
// ===================================================

const input = document.getElementById("input");
const submitBtn = document.getElementById("submitBtn");
const charCount = document.getElementById("charCount");

// 글자 수 실시간 표시 및 5자 이상 / 100자 제한
function updateCharCount() {
  if (!input || !charCount) return;
  // 100자 초과 시 잘라내기
  if (input.value.length > 100) {
    input.value = input.value.slice(0, 100);
  }
  const len = input.value.length;
  if (len === 0) {
    charCount.textContent = "현재 글자수: 0 / 100자 (최소 5자)";
    charCount.className = "char-count too-short";
  } else if (len < 5) {
    charCount.textContent = `현재 글자수: ${len} / 100자 (최소 5자)`;
    charCount.className = "char-count too-short";
  } else if (len >= 100) {
    charCount.textContent = `현재 글자수: 100 / 100자 (최대)`;
    charCount.className = "char-count limit";
  } else {
    charCount.textContent = `현재 글자수: ${len} / 100자`;
    charCount.className = "char-count valid";
  }
}

if (input) {
  input.addEventListener("input", updateCharCount);
}

async function handleSubmit() {
  const text = input.value.trim();
  if (text === "") {
    alert("메모 내용을 입력해주세요!");
    input.focus();
    return;
  }

  // 1. 최소 5글자 검사
  if (text.length < 5) {
    alert("메모는 5글자 이상 작성해주세요!");
    input.focus();
    return;
  }

  // 2. 최대 100글자 검사
  if (text.length > 100) {
    alert("메모는 최대 100자까지 작성할 수 있습니다.");
    return;
  }

  // 3. 비속어 검사
  if (containsBadWord(text)) {
    alert("바르고 고운 말을 사용해주세요! 비속어가 감지되어 등록할 수 없습니다.");
    return;
  }

  // 4. 반복 문자 도배 검사
  if (hasExcessiveRepetition(text)) {
    alert("동일한 문자가 너무 많이 반복되었습니다. 올바른 문장으로 작성해 주세요!");
    return;
  }

  const success = await addMemo(text);
  if (success) {
    input.value = "";
    updateCharCount();
    render();
    input.focus();
  }
}

input.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSubmit();
  }
});

if (submitBtn) {
  submitBtn.addEventListener("click", handleSubmit);
}


// 첫 화면 그리기
renderUserArea();
render();
updateCharCount();
