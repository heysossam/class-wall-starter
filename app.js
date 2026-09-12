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
let memos = [
  { id: 1, text: "오늘 과학 시간에 한 실험이 재미있었다", createdAt: 1757030400000, likes: 5 },
  { id: 2, text: "궁금한 점 - 물은 왜 100도에서 끓나요?", createdAt: 1757030500000, likes: 2 },
  { id: 3, text: "모둠 친구들이 도와줘서 고마웠다", createdAt: 1757030600000, likes: 4 }
];

let nextId = 4;  // 새 메모에 붙일 번호


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
  memos.push({
    id: nextId,
    text: text,
    createdAt: Date.now(),
    likes: 0
  });
  nextId = nextId + 1;
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
function deleteMemo(id) {
  memos = memos.filter(function (memo) {
    return memo.id !== id;
  });
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

// 메모 한 장 만들기 (예쁜 포스트잇 스타일과 하트 버튼)
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

  // 상단 헤더 (삭제 버튼)
  const header = document.createElement("div");
  header.className = "memo-header";

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.title = "메모 지우기";
  del.textContent = "×";
  del.onclick = function () {
    deleteMemo(memo.id);
    render();
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

  addMemo(text);
  input.value = "";
  render();
  input.focus();
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
render();
input.focus();
