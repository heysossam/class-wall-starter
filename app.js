// ===================================================
// 우리 반 담벼락 - 시작점
//
// 메모를 쓰면 올린 순서대로 담벼락에 붙습니다.
// 지금은 데이터가 아래 배열에만 들어 있어서,
// 브라우저를 새로고침하면 전부 사라집니다.
// ===================================================


// --- 메모 목록 ---
// createdAt 은 메모를 쓴 시각(밀리초)입니다. 이 값으로 순서를 정합니다.
// likes 는 학생들이 누른 좋아요(하트) 개수입니다.
// author 와 pin 은 작성자 이름과 4자리 비밀번호입니다.
let memos = [
  { id: 1, text: "오늘 과학 시간에 한 실험이 재미있었다", createdAt: 1757030400000, likes: 5, author: "호기심이", pin: "0000" },
  { id: 2, text: "궁금한 점 - 물은 왜 100도에서 끓나요?", createdAt: 1757030500000, likes: 2, author: "질문왕", pin: "0000" },
  { id: 3, text: "모둠 친구들이 도와줘서 고마웠다", createdAt: 1757030600000, likes: 4, author: "행복이", pin: "0000" }
];

let nextId = 4;  // 새 메모에 붙일 번호


// ===================================================
// 로그인 관리 (간단한 이름과 4자리 비밀번호)
// ===================================================

let currentUser = null;

// 브라우저에 저장된 이전 로그인 정보가 있으면 복원합니다
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


// ===================================================
// 데이터를 다루는 함수들
// 백엔드 1 시간에 이 함수들이 Firestore를 쓰는 코드로 바뀝니다.
// ===================================================

// 메모를 읽어 옵니다.
// 백엔드 1: 여기가 Firestore에서 가져오는 코드로 바뀝니다.
//           순서는 orderBy("createdAt") 으로 맞춥니다.
function loadMemos() {
  return memos.slice().sort(function (a, b) {
    return a.createdAt - b.createdAt;
  });
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
function addMemo(text) {
  if (!currentUser) {
    alert("메모를 작성하려면 먼저 상단에서 이름과 4자리 비밀번호로 로그인해주세요!");
    const nameInput = document.getElementById("loginName");
    if (nameInput) nameInput.focus();
    return false;
  }

  memos.push({
    id: nextId,
    text: text,
    createdAt: Date.now(),
    likes: 0,
    author: currentUser.name,
    pin: currentUser.pin
  });
  nextId = nextId + 1;
  return true;
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
function deleteMemo(id) {
  const memo = memos.find(function (m) {
    return m.id === id;
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

  memos = memos.filter(function (m) {
    return m.id !== id;
  });
  render();
}

// 좋아요(하트)를 누릅니다.
function likeMemo(id) {
  const memo = memos.find(function (m) {
    return m.id === id;
  });
  if (memo) {
    memo.likes = (memo.likes || 0) + 1;
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
render();
