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

// 사용 가능한 반응 이모지 목록
const EMOJIS = ["❤️", "👍", "💡", "👏", "😊"];

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
      logoutBtn.addEventListener("click", function () {
        currentUser = null;
        sessionStorage.removeItem("class_wall_user");
        renderUserArea();
        render();
      });
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
    likedBy: [],
    reactions: { "❤️": 0, "👍": 0, "💡": 0, "👏": 0, "😊": 0 },
    comments: [],
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
    alert("좋아요를 누르려면 먼저 상단에서 이름과 4자리 비밀번호로 로그인해주세요!");
    const nameInput = document.getElementById("loginName");
    if (nameInput) nameInput.focus();
    return;
  }

  const memo = memos.find(function (m) {
    return String(m.id) === String(id);
  });
  if (!memo) return;

  // 자신의 글에는 좋아요를 누를 수 없음
  if (memo.author && memo.author === currentUser.name) {
    alert("자신의 글에는 좋아요를 누를 수 없습니다. 친구들의 글에 좋아요를 남겨보세요! 😊");
    return;
  }

  const likedBy = Array.isArray(memo.likedBy) ? memo.likedBy : [];
  const alreadyLiked = likedBy.includes(currentUser.name);

  if (isFirebaseReady && db) {
    try {
      if (alreadyLiked) {
        // 이미 누른 경우: 좋아요 취소 (1회 제한 유지)
        await updateDoc(doc(db, "memos", String(id)), {
          likedBy: arrayRemove(currentUser.name),
          likes: increment(-1)
        });
      } else {
        // 처음 누르는 경우: 좋아요 등록
        await updateDoc(doc(db, "memos", String(id)), {
          likedBy: arrayUnion(currentUser.name),
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
        return name !== currentUser.name;
      });
      memo.likes = Math.max(0, (memo.likes || 1) - 1);
    } else {
      memo.likedBy = [...likedBy, currentUser.name];
      memo.likes = (memo.likes || 0) + 1;
    }
    saveLocalMemos(memos);
    render();
  }
}

// 댓글을 새로 작성합니다
async function addComment(memoId, text) {
  if (!currentUser) {
    alert("댓글을 작성하려면 먼저 상단에서 이름과 4자리 비밀번호로 로그인해주세요!");
    const nameInput = document.getElementById("loginName");
    if (nameInput) nameInput.focus();
    return false;
  }

  const comment = {
    id: "c_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    text: text,
    author: currentUser.name,
    createdAt: Date.now()
  };

  const memo = memos.find(function (m) {
    return String(m.id) === String(memoId);
  });
  if (!memo) return false;

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

  if (currentUser && currentUser.name === comment.author) {
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

  // 하단 영역 (작성 시간 및 좋아요 / 댓글 버튼)
  const footer = document.createElement("div");
  footer.className = "memo-footer";

  const timeSpan = document.createElement("span");
  timeSpan.className = "memo-time";
  timeSpan.textContent = formatTime(memo.createdAt);
  footer.appendChild(timeSpan);

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "memo-actions";

  // 1. 좋아요 버튼 (다른 친구 글 1회 제한 및 토글)
  const likedBy = Array.isArray(memo.likedBy) ? memo.likedBy : [];
  const isLiked = Boolean(currentUser && likedBy.includes(currentUser.name));
  const likeCount = (memo.likedBy ? memo.likedBy.length : memo.likes) || 0;

  const likeBtn = document.createElement("button");
  likeBtn.className = `like-btn ${isLiked ? 'liked' : ''} ${isMine ? 'my-post' : ''}`;
  likeBtn.type = "button";
  likeBtn.title = isMine ? "자신의 글에는 좋아요를 누를 수 없습니다" : (isLiked ? "좋아요 취소" : "좋아요 누르기");
  likeBtn.innerHTML = `<span class="like-icon">${isLiked ? '❤️' : '🤍'}</span> <span class="like-count">${likeCount}</span>`;
  likeBtn.addEventListener("click", function () {
    likeMemo(memo.id);
  });
  actionsDiv.appendChild(likeBtn);

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
        if (currentUser && currentUser.name === comment.author) {
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

async function handleSubmit() {
  const text = input.value.trim();
  if (text === "") return;

  const success = await addMemo(text);
  if (success) {
    input.value = "";
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
