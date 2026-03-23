// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "XXXX",
  authDomain: "auracardsduel.firebaseapp.com",
  databaseURL: "https://auracardsduel-default-rtdb.firebaseio.com",
  projectId: "auracardsduel",
  storageBucket: "auracardsduel.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ===== GAME DATA =====
const allCards = [
  { name: "Sigma Mode", power: 90, img: "images/sigma.jpg" },
  { name: "NPC Energy", power: 40, img: "images/npc.jpg" },
  { name: "Main Character", power: 85, img: "images/main-character.jpg" },
  { name: "Villain Arc", power: 80, img: "images/villain.jpg" },
  { name: "Gym Bro", power: 75, img: "images/gym.jpg" },
  { name: "Academic Weapon", power: 88, img: "images/academic.jpg" }
];

// ===== GAME STATE =====
let playerDeck = [];
let opponentDeck = [];
let selectedIndex = null;
let round = 1;
let playerScore = 0;
let opponentScore = 0;
let timeLeft = 60;
let timerInterval = null;
let playerId = null;
let opponentId = null;

// ===== DOM ELEMENTS =====
const restartBtn = document.getElementById("restartBtn");
const resultBox = document.getElementById("result");
const statusBox = document.getElementById("status");

// ===== START BUTTON =====
document.getElementById("startBtn").onclick = () => {
  document.querySelector(".hero").style.display = "none";
  document.getElementById("game").classList.remove("hidden");
};

// ===== GENERATE DECK =====
function generateDeck() {
  return [...allCards].sort(() => 0.5 - Math.random()).slice(0, 5);
}

// ===== RENDER CARDS =====
function renderCards() {
  const container = document.getElementById("playerCards");
  container.innerHTML = "";
  playerDeck.forEach((card, index) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <img src="${card.img}" alt="${card.name}">
      <h4>${card.name}</h4>
      <p>⚡ ${card.power}</p>
    `;
    div.onclick = () => {
      selectedIndex = index;
      document.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
      div.classList.add("selected");
    };
    container.appendChild(div);
  });
}

// ===== JOIN GAME & MATCHMAKING =====
document.getElementById("joinBtn").onclick = async () => {
  const username = document.getElementById("username").value;
  if (!username) return alert("Enter username");

  document.getElementById("lobby").classList.add("hidden");
  document.getElementById("match").classList.remove("hidden");
  statusBox.innerText = "Searching for opponent...";

  playerId = Date.now() + "-" + Math.floor(Math.random() * 1000);

  await database.ref("lobby/" + playerId).set({
    username: username,
    deck: generateDeck(),
    score: 0
  });

  database.ref("lobby").on("value", snapshot => {
    const players = snapshot.val() || {};
    const ids = Object.keys(players);

    for (let id of ids) {
      if (id !== playerId && !opponentId) {
        opponentId = id;
        database.ref("lobby/" + playerId).remove();
        database.ref("lobby/" + opponentId).remove();
        startMultiplayer(players[playerId], players[opponentId]);
        break;
      }
    }
  });
};

// ===== START MULTIPLAYER =====
function startMultiplayer(playerData, opponentData) {
  playerDeck = playerData.deck;
  opponentDeck = opponentData.deck;
  round = 1;
  playerScore = 0;
  opponentScore = 0;
  selectedIndex = null;

  renderCards();
  updateUI();
  startTimer();
  statusBox.innerText = "Match Found!";
}

// ===== PLAY CARD =====
document.getElementById("playBtn").onclick = playCardMultiplayer;

function playCardMultiplayer() {
  if (selectedIndex === null) return alert("Select a card!");
  clearInterval(timerInterval);

  const card = playerDeck[selectedIndex];

  database.ref("matches/" + playerId).set({
    card: card,
    timestamp: Date.now()
  });

  // Poll opponent move
  const poll = setInterval(async () => {
    const snap = await database.ref("matches/" + opponentId).once("value");
    if (snap.exists()) {
      clearInterval(poll);
      resolveRound(card, snap.val().card);
    }
  }, 500);
}

// ===== RESOLVE ROUND =====
function resolveRound(playerCard, opponentCard) {
  let resultText = "";

  if (playerCard.power > opponentCard.power) {
    let bonus = playerCard.power - opponentCard.power > 20 ? 4 : 3;
    playerScore += bonus;
    resultText = `🔥 You WIN! (+${bonus})`;
    resultBox.classList.add("flash-win");
    setTimeout(() => resultBox.classList.remove("flash-win"), 500);
  } else if (playerCard.power < opponentCard.power) {
    let bonus = opponentCard.power - playerCard.power > 20 ? 4 : 3;
    opponentScore += bonus;
    resultText = `💀 You LOSE! Opponent +${bonus}`;
    resultBox.classList.add("flash-lose");
    setTimeout(() => resultBox.classList.remove("flash-lose"), 500);
  } else {
    resultText = "😐 DRAW!";
  }

  resultBox.innerText = `${resultText} | Opponent played ${opponentCard.name} (${opponentCard.power})`;

  // Remove cards used
  playerDeck.splice(selectedIndex, 1);
  selectedIndex = null;
  opponentDeck.shift();

  round++;
  updateUI();
  cleanupMoves();

  if (round > 5) endGame();
  else startTimer();
}

// ===== CLEANUP MOVES =====
function cleanupMoves() {
  database.ref("matches/" + playerId).remove();
  if (opponentId) database.ref("matches/" + opponentId).remove();
}

// ===== UPDATE UI =====
function updateUI() {
  document.getElementById("round").innerText = `Round ${round} / 5`;
  document.getElementById("playerScore").innerText = playerScore;
  document.getElementById("opponentScore").innerText = opponentScore;
  renderCards();
}

// ===== END GAME =====
function endGame() {
  clearInterval(timerInterval);
  let finalText = "";
  if (playerScore > opponentScore) finalText = "🏆 YOU ARE HIM. MAIN CHARACTER ENERGY.";
  else if (playerScore < opponentScore) finalText = "💀 NPC ENERGY DETECTED.";
  else finalText = "⚖️ PERFECTLY BALANCED.";

  resultBox.innerText = finalText;
  restartBtn.classList.remove("hidden");
}

// ===== RESTART GAME =====
restartBtn.onclick = () => {
  restartBtn.classList.add("hidden");
  resultBox.innerText = "";
  opponentId = null;
  startGame();
};

// ===== TIMER =====
function startTimer() {
  clearInterval(timerInterval);
  timeLeft = 60;
  updateTimerUI();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      autoSelectCard();
    }
  }, 1000);
}

// ===== TIMER UI =====
function updateTimerUI() {
  const timerEl = document.getElementById("timer");
  timerEl.innerText = `Time: ${timeLeft}`;
  timerEl.classList.remove("timer-warning", "timer-danger");
  if (timeLeft <= 20) timerEl.classList.add("timer-warning");
  if (timeLeft <= 10) timerEl.classList.add("timer-danger");
}

// ===== AUTO-SELECT CARD =====
function autoSelectCard() {
  if (playerDeck.length === 0) return;
  selectedIndex = Math.floor(Math.random() * playerDeck.length);
  playCardMultiplayer();
}

// ===== START SINGLE-PLAYER =====
function startGame() {
  playerDeck = generateDeck();
  opponentDeck = generateDeck();
  round = 1;
  playerScore = 0;
  opponentScore = 0;
  selectedIndex = null;
  renderCards();
  updateUI();
  startTimer();
}

function shareMatch() {
  const url = window.location.href + "?match=" + playerId;
  navigator.clipboard.writeText(url);
  alert("Link copied! Challenge your friends to play.");
}