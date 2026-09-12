// ===================================================
// 우리 반 담벼락 - Firebase Firestore & 데이터베이스 연동
//
// Firebase 무료 Spark 요금제 기반 실시간 데이터베이스(Firestore)를 사용합니다.
// Firebase 설정(firebaseConfig)을 넣으면 모든 학생 화면에서 실시간 동기화되고,
// 설정 전에도 브라우저 저장소(localStorage)에 안전하게 자동 저장됩니다.
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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
  increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ===================================================
// 1. Firebase 설정 (무료 Spark 요금제)
// Firebase 콘솔(https://console.firebase.google.com/)에서 프로젝트를 만들고
// 웹 앱을 추가한 뒤 받은 본인의 설정을 여기에 붙여넣으세요.
// ===================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase 설정이 유효한지 확인
const isFirebaseReady = Boolean(
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID" &&
  firebaseConfig.apiKey !== "YOUR_API_KEY"
);

let db = null;
let memosCollection = null;

if (isFirebaseReady) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    memosCollection = collection(db, "memos");
  } catch (err) {
    console.error("Firebase 초기화 오류:", err);
  }
}


// ===================================================
// 2. 메모 데이터 및 로컬 저장소(localStorage) 관리
// ===================================================

const LOCAL_STORAGE_KEY = "class_wall_memos_v1";

// 기본 메모 목록 (처음 접속 시 표시할 예시 데이터)
const defaultMemos = [
  { id: "1", text: "오늘 과학 시간에 한 실험이 재미있었다", createdAt: 1757030400000, likes: 5, author: "호기심이", pin: "0000" },
  { id: "2", text: "궁금한 점 - 물은 왜 100도에서 끓나요?", createdAt: 1757030500000, likes: 2, author: "질문왕", pin: "0000" },
  { id: "3", text: "모둠 친구들이 도와줘서 고마웠다", createdAt: 1757030600000, likes: 4, author: "행복이", pin: "0000" }
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
// 3. 로그인 관리 (간단한 이름과 4자리 비밀번호)
// ===================================================

let currentUser = null;

// 브라우저 세션에 저장된 이전 로그인 정보 복원
try {
  const savedUser = sessionStorage.getItem("class_wall_user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
  }
} catch (e) {
  console.error("세션 정보 복원 오류:", e);
}

// 상단 로그인 영역 화면 그리기
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  if (!userArea) return;

  if (currentUser) {
    // 로그인 상태 UI
    userArea.innerHTML = `
      <div class="user-logged-in">
        <div class="user-info">
          <span class="user-avatar">👤</span>
          <span><strong>${currentUser.name}</strong>님 참여 중</span>
        </div>
        <button id="logoutBtn" class="logout-btn" type="button">로그아웃</button>
      </div>
    `;

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = function () {
        currentUser = null;
        sessionStorage.removeItem("class_wall_user");
        renderUserArea();
        render();
      };
    }

    const inputArea = document.getElementById("input");
    if (inputArea) {
      inputArea.placeholder = `${currentUser.name}님의 생각을 남겨보세요! (엔터로 등록)`;
    }
  } else {
    // 비로그인 상태 UI (이름 + 숫자 4자리 비밀번호)
    userArea.innerHTML = `
      <form class="user-form" id="loginForm">
        <span class="user-form-title">👤 로그인</span>
        <input type="text" id="loginName" placeholder="이름/별명" maxlength="10" required>
        <input type="password" id="loginPin" placeholder="비밀번호(숫자 4자리)" maxlength="4" pattern="\\d{4}" inputmode="numeric" title="숫자 4자리를 입력하세요" required>
        <button type="submit" class="auth-btn">로그인</button>
      </form>
    `;

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.onsubmit = function (e) {
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
      };
    }

    const inputArea = document.getElementById("input");
    if (inputArea) {
      inputArea.placeholder = "상단에서 로그인 후 메모를 남길 수 있습니다.";
    }
  }
}

// 저장소 상태 표시 업데이트
function updateStorageNotice() {
  const noticeEl = document.getElementById("storageNotice");
  if (!noticeEl) return;

  if (isFirebaseReady) {
    noticeEl.innerHTML = "☁️ <strong>Firebase Firestore 실시간 클라우드 DB</strong>에 연결되었습니다. 모든 친구들과 실시간으로 공유됩니다!";
    noticeEl.style.background = "#eff6ff";
    noticeEl.style.borderColor = "#bfdbfe";
    noticeEl.style.color = "#1d4ed8";
  } else {
    noticeEl.innerHTML = "💾 <strong>데이터베이스 저장 기능이 활성화되었습니다.</strong> 새로고침해도 메모가 안전하게 유지됩니다. (Firebase 설정 시 실시간 연동)";
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
// 백엔드 2: 여기에 "누가 썼는지"(author, pin)를 함께 저장합니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("메모를 작성하려면 먼저 상단에서 이름과 4자리 비밀번호로 로그인해주세요!");
    const nameInput = document.getElementById("loginName");
    if (nameInput) nameInput.focus();
    return false;
  }

  const memoData = {
    text: text,
    createdAt: Date.now(),
    likes: 0,
    author: currentUser.name,
    pin: currentUser.pin
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
// 내가 작성한 메모이거나 4자리 비밀번호가 일치해야 지울 수 있습니다.
async function deleteMemo(id) {
  const memo = memos.find(function (m) {
    return String(m.id) === String(id);
  });
  if (!memo) return;

  // 작성자 본인 확인 (로그인 정보와 일치하는지)
  const isAuthor = currentUser && currentUser.name === memo.author && currentUser.pin === memo.pin;

  if (isAuthor) {
    if (!confirm("작성하신 메모를 삭제하시겠습니까?")) return;
  } else {
    // 본인이 아니거나 비로그인 상태일 때는 4자리 비밀번호 확인
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

// 좋아요(하트)를 누릅니다.
async function likeMemo(id) {
  const memo = memos.find(function (m) {
    return String(m.id) === String(id);
  });
  if (!memo) return;

  if (isFirebaseReady && db) {
    try {
      await updateDoc(doc(db, "memos", String(id)), {
        likes: increment(1)
      });
    } catch (e) {
      console.error("Firestore 좋아요 업데이트 실패:", e);
    }
  } else {
    // 로컬 저장소 모드
    memo.likes = (memo.likes || 0) + 1;
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

// 메모 한 장 만들기 (예쁜 포스트잇 스타일, 작성자 표시 및 하트 버튼)
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
  const isMine = currentUser && currentUser.name === memo.author;
  if (isMine) {
    authorBadge.classList.add("my-memo");
  }
  authorBadge.textContent = memo.author ? `👤 ${memo.author}${isMine ? ' (나)' : ''}` : "👤 익명";
  header.appendChild(authorBadge);

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.title = "메모 지우기";
  del.textContent = "×";
  del.onclick = function () {
    deleteMemo(memo.id);
  };
  header.appendChild(del);
  div.appendChild(header);

  // 메모 본문 내용
  const textDiv = document.createElement("div");
  textDiv.className = "memo-text";
  textDiv.textContent = memo.text;
  div.appendChild(textDiv);

  // 하단 영역 (작성 시간 및 좋아요 하트 버튼)
  const footer = document.createElement("div");
  footer.className = "memo-footer";

  const timeSpan = document.createElement("span");
  timeSpan.className = "memo-time";
  timeSpan.textContent = formatTime(memo.createdAt);
  footer.appendChild(timeSpan);

  // 좋아요(하트) 버튼
  const likeBtn = document.createElement("button");
  likeBtn.className = "like-btn";
  likeBtn.type = "button";
  likeBtn.title = "좋아요 누르기";
  likeBtn.innerHTML = `❤️ <span>${memo.likes || 0}</span>`;
  likeBtn.onclick = function () {
    likeMemo(memo.id);
    render();
  };
  footer.appendChild(likeBtn);

  div.appendChild(footer);
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

function handleSubmit() {
  const text = input.value.trim();
  if (text === "") return;

  const success = addMemo(text);
  if (success) {
    input.value = "";
    render();
    input.focus();
  }
}

input.onkeydown = function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSubmit();
  }
};

if (submitBtn) {
  submitBtn.onclick = handleSubmit;
}


// 첫 화면 그리기
renderUserArea();
updateStorageNotice();
render();
