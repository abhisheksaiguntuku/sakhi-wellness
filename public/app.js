// Client state management
let activeUser = localStorage.getItem('sakhi_auth_user') || null;
let userToken = localStorage.getItem('sakhi_user_token') || 'anonymous-default';
let currentAuthTab = 'login';

let userHabits = {
  wakeTime: "06:30",
  sleepTime: "22:30",
  meals: "3",
  foodPreference: "veg",
  age: "23",
  location: "Delhi",
  nickname: "sister"
};

let sessionData = {
  cycles: [],
  waterLogged: 0,
  waterStreak: 0,
  dailyStreak: 0,
  lastActiveDate: null,
  badges: [],
  checklist: {},
  moodLogs: {},
  journal: []
};

let currentCalendarDate = new Date();

// SPA Router
function showPage(pageId) {
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-page') === pageId) {
      btn.classList.add('active');
    }
  });
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // Intimate Privacy Guard Check
  if (checkPartnerPrivacy(pageId)) {
    return;
  }

  if (pageId === 'dashboard') {
    renderDashboard();
  } else if (pageId === 'remedies') {
    renderRemedies();
  } else if (pageId === 'diet') {
    generateDietPlan();
  } else if (pageId === 'cycle') {
    renderCalendar();
  } else if (pageId === 'trainer') {
    renderTrainerTimeline();
    initTrainerExercises();
  } else if (pageId === 'community') {
    loadCommunityPosts();
  } else if (pageId === 'education') {
    filterEducation('19-25');
  } else if (pageId === 'doctor') {
    findLadyGynecologists();
  } else if (pageId === 'breast') {
    initBseSlideshow();
  } else if (pageId === 'comfort') {
    initYogaComfort();
  }
}

// API request client
async function apiCall(endpoint, method = 'GET', body = null, overrideToken = null) {
  const tokenToUse = overrideToken || (isHimMode ? (localStorage.getItem('sakhi_partner_token') || 'anonymous-default') : userToken);
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Token': tokenToUse
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(endpoint, options);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error("API Call error on: " + endpoint, err);
    return null;
  }
}

// Load Session and Habits Profile
async function loadSession() {
  // Initialize Google One-Tap Login button if library is ready
  initializeGoogleSignIn();

  if (userToken === 'anonymous-default') {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('logout-btn').style.display = 'none';
    return;
  }
  
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('logout-btn').style.display = 'inline-block';
  document.getElementById('user-display-tag').innerText = `Logged in: ${activeUser}`;

  // Configure layout state based on account gender
  const accountGender = localStorage.getItem('sakhi_user_gender') || 'female';
  isHimMode = (accountGender === 'male');
  
  const himBtn = document.getElementById('him-toggle-btn');
  if (himBtn) {
    himBtn.style.display = 'none'; // Hide switching toggle for registered accounts
  }
  
  if (isHimMode) {
    document.body.classList.add('him-mode');
    showForHimDashboard();
  } else {
    document.body.classList.remove('him-mode');
  }

  // Fetch session logs
  const data = await apiCall('/api/session');
  if (data) sessionData = data;

  // Fetch user habits
  const habitRes = await apiCall('/api/habits');
  if (habitRes && habitRes.habits) {
    userHabits = habitRes.habits;
    document.getElementById('habits-overlay').style.display = 'none';
    if (userHabits.location) {
      const regionInput = document.getElementById('doctor-region-select');
      if (regionInput) regionInput.value = userHabits.location;
    }
    if (userHabits.nickname) {
      const nicknameInput = document.getElementById('onboard-nickname');
      if (nicknameInput) nicknameInput.value = userHabits.nickname;
    }
  } else {
    // Force onboarding habits questionnaire if registering new profile
    document.getElementById('habits-overlay').style.display = 'flex';
  }

  renderDashboard();
  personalizeGreetings();
}

function personalizeGreetings() {
  const nickname = userHabits.nickname || 'sister';
  
  // 1. Initial chat bubble greeting
  const chatBox = document.getElementById('chat-box');
  if (chatBox) {
    chatBox.innerHTML = `
      <div class="msg msg-bot">
        <div class="msg-bubble">
          Namaste, ${nickname}! I am Sakhi. What questions or worries do you have today? We can talk about cramps, PCOD facial hair, periods, or emotional ups and downs. 🌸
        </div>
      </div>
    `;
  }
  
  // 2. Emergency Modal Title & Content
  const emergencyTitle = document.querySelector('#emergency-modal h3');
  if (emergencyTitle) {
    emergencyTitle.innerHTML = `You are not alone, ${nickname}. 💛`;
  }
  
  const emergencyDesc = document.querySelector('#emergency-modal p');
  if (emergencyDesc) {
    emergencyDesc.innerHTML = `What you are feeling is real and valid, ${nickname}. Ovarian stress and high cortisol levels often spike mood dips, anxiety, and tears. You do not have to fight this alone.`;
  }
}

async function syncSessionState() {
  await apiCall('/api/session/update', 'POST', sessionData);
}

// Google Sign In Initializer
function initializeGoogleSignIn() {
  if (window.google && window.google.accounts) {
    window.google.accounts.id.initialize({
      client_id: "362148534514-egf2q6amtur812ebvnucg105h186ts2k.apps.googleusercontent.com", // Set your Google OAuth client ID here
      callback: handleGoogleAuthCallback
    });
    window.google.accounts.id.renderButton(
      document.getElementById('google-login-container'),
      { theme: 'outline', size: 'large', width: 280 }
    );
  }
}

async function handleGoogleAuthCallback(googleResponse) {
  const res = await apiCall('/api/auth/google', 'POST', { credential: googleResponse.credential });
  if (res && res.success) {
    activeUser = res.username;
    userToken = res.username;
    localStorage.setItem('sakhi_auth_user', res.username);
    localStorage.setItem('sakhi_user_token', res.username);
    
    document.getElementById('auth-overlay').style.display = 'none';
    await loadSession();
  } else {
    alert("Google authentication login failed!");
  }
}

// Authentication Tab Toggles
function switchAuthTab(tab) {
  currentAuthTab = tab;
  document.getElementById('tab-login-btn').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup-btn').classList.toggle('active', tab === 'signup');
  
  // Show gender dropdown only for registration
  const genderGroup = document.getElementById('auth-gender-group');
  if (genderGroup) {
    genderGroup.style.display = tab === 'signup' ? 'block' : 'none';
  }
}

async function submitAuth() {
  const user = document.getElementById('auth-username').value.trim();
  const pass = document.getElementById('auth-password').value.trim();
  const gender = document.getElementById('auth-gender').value;
  
  if (!user || !pass) {
    alert("Please enter both username and password!");
    return;
  }

  const path = currentAuthTab === 'login' ? '/api/auth/login' : '/api/auth/register';
  const body = currentAuthTab === 'login' ? { username: user, password: pass } : { username: user, password: pass, gender };
  
  const res = await apiCall(path, 'POST', body);
  
  if (res && res.success) {
    activeUser = user;
    userToken = user;
    localStorage.setItem('sakhi_auth_user', user);
    localStorage.setItem('sakhi_user_token', user);
    
    // Save account gender settings
    const accountGender = res.gender || gender || 'female';
    localStorage.setItem('sakhi_user_gender', accountGender);
    
    // Apply layout state
    if (accountGender === 'male') {
      isHimMode = true;
    } else {
      isHimMode = false;
    }
    
    document.getElementById('auth-overlay').style.display = 'none';
    await loadSession();
  } else {
    alert(res ? res.error : "Authentication failed. Try again!");
  }
}

function skipAuth() {
  activeUser = 'Offline Guest';
  userToken = 'guest-' + Math.random().toString(36).substr(2, 5);
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('logout-btn').style.display = 'inline-block';
  document.getElementById('user-display-tag').innerText = "Offline Guest Profile";
  
  // Show switching toggle button for guest profiles to test both formats
  const himBtn = document.getElementById('him-toggle-btn');
  if (himBtn) himBtn.style.display = 'inline-block';
  
  document.getElementById('habits-overlay').style.display = 'flex';
  renderDashboard();
}

// Habits Form Handler
async function submitHabitsProfile() {
  const wakeVal = document.getElementById('onboard-wake').value;
  const sleepVal = document.getElementById('onboard-sleep').value;
  const mealsVal = document.getElementById('onboard-meals').value;
  const prefVal = document.getElementById('onboard-preference').value;
  const ageVal = document.getElementById('onboard-age').value;
  const locVal = document.getElementById('onboard-location').value.trim() || "Delhi";
  const nickVal = document.getElementById('onboard-nickname').value.trim() || "sister";

  userHabits = {
    wakeTime: wakeVal,
    sleepTime: sleepVal,
    meals: mealsVal,
    foodPreference: prefVal,
    age: ageVal,
    location: locVal,
    nickname: nickVal
  };

  const regionInput = document.getElementById('doctor-region-select');
  if (regionInput) regionInput.value = locVal;

  const res = await apiCall('/api/habits', 'POST', { habits: userHabits });
  if (res && res.success) {
    document.getElementById('habits-overlay').style.display = 'none';
    renderDashboard();
    personalizeGreetings();
    renderTrainerTimeline();
    findLadyGynecologists(); // Automatically fetch gynecologists near the new location
  }
}

// --- 1. DASHBOARD ---
function renderDashboard() {
  const userDisp = userHabits.nickname || ((activeUser && activeUser !== 'Offline Guest') ? activeUser : 'sweet sister');
  const nameEl = document.getElementById('dash-user-name');
  if (nameEl) nameEl.innerText = userDisp;

  document.getElementById('dash-streak-days').innerText = sessionData.dailyStreak || 0;
  
  const glasses = document.querySelectorAll('.water-glass');
  glasses.forEach((gl, idx) => {
    if (idx < sessionData.waterLogged) {
      gl.classList.add('active');
    } else {
      gl.classList.remove('active');
    }
  });

  if (userToken && userToken !== 'anonymous-default' && !isHimMode) {
    const displayRow = document.getElementById('partner-id-display-row');
    const displayId = document.getElementById('partner-sync-id');
    if (displayRow && displayId) {
      displayRow.style.display = 'block';
      displayId.innerText = `SAKHI-${userToken.toUpperCase()}`;
    }
  } else if (!isHimMode) {
    const displayRow = document.getElementById('partner-id-display-row');
    if (displayRow) displayRow.style.display = 'none';
  }

  renderSymptomHeatmap();
  syncDashboardCyclePhase();
}

function syncDashboardCyclePhase() {
  const phaseTitle = document.getElementById('dash-phase-name');
  const phaseDesc = document.getElementById('dash-phase-details');
  
  if (!sessionData.cycles || sessionData.cycles.length === 0) {
    phaseTitle.innerText = "No cycle data logged yet";
    phaseDesc.innerText = "Navigate to the Cycle Tracker to input your last period start date and calculate sync states.";
    return;
  }

  const lastCycle = sessionData.cycles[sessionData.cycles.length - 1];
  const lastStart = new Date(lastCycle.startDate);
  const today = new Date();
  const diffTime = Math.abs(today - lastStart);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) % (lastCycle.cycleLength || 28);

  let phase = "";
  let details = "";
  
  if (diffDays <= 5) {
    phase = "Menstrual Phase (Day 1-5) 🌸";
    details = "Focus on warm, iron-rich foods. Sip ginger tea to soothe pelvic cramps and avoid extreme exercises today.";
  } else if (diffDays <= 13) {
    phase = "Follicular Phase (Day 6-13) 🌿";
    details = "Your estrogen is rising. Great time to consume light proteins, fresh sprouts, and perform active cardio or walking.";
  } else if (diffDays <= 17) {
    phase = "Ovulation Phase (Day 14-17) ✨";
    details = "Peak energy days! Perfect for intensive workouts, setting big resolutions, and enjoying zinc-rich seeds.";
  } else {
    phase = "Luteal / PMS Phase (Day 18-28) 🌙";
    details = "Progesterone peaks. Reduce sodium to prevent bloating, drink spearmint tea for androgens, and start sleeping by 10:30 PM.";
  }

  phaseTitle.innerText = phase;
  phaseDesc.innerText = `Day ${diffDays + 1} of your cycle. ${details}`;
}

function toggleWaterGlass(glassNum) {
  if (sessionData.waterLogged === glassNum) {
    sessionData.waterLogged = glassNum - 1;
  } else {
    sessionData.waterLogged = glassNum;
  }
  
  if (sessionData.waterLogged === 8) {
    awardBadge("💧 Hydration Queen");
  }

  renderDashboard();
  syncSessionState();
}

function awardBadge(badgeName) {
  if (!sessionData.badges.includes(badgeName)) {
    sessionData.badges.push(badgeName);
    alert(`Congratulations! You earned the "${badgeName}" badge! 🏆`);
  }
}

function renderSymptomHeatmap() {
  const container = document.getElementById('heatmap-cells');
  container.innerHTML = "";
  
  const today = new Date();
  for (let i = 27; i >= 0; i--) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - i);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.setAttribute('data-date', dateStr);
    
    const log = sessionData.moodLogs[dateStr];
    if (log) {
      if (log.mood >= 4) cell.classList.add('heat-1');
      else if (log.mood === 3) cell.classList.add('heat-2');
      else cell.classList.add('heat-3');
    } else {
      cell.classList.add('heat-0');
    }
    
    container.appendChild(cell);
  }
}

// --- 2. SAKHI DOUBT AI SOLVER CHAT (Groq Connected) ---
async function sendChatMessage() {
  const inputEl = document.getElementById('chat-input-text');
  const query = inputEl.value.trim();
  if (!query) return;

  inputEl.value = "";
  appendChatBubble(query, 'user');
  
  const chatResponse = await apiCall('/api/doubt', 'POST', { question: query });
  const responseText = chatResponse ? chatResponse.reply : "Connection error. Ask Sakhi again soon! 🌸";
  
  setTimeout(() => {
    appendChatBubble(responseText, 'bot');
  }, 400);
}

function appendChatBubble(text, sender) {
  const box = document.getElementById('chat-box');
  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = `msg msg-${sender}`;
  
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerText = text;
  
  bubbleWrap.appendChild(bubble);
  box.appendChild(bubbleWrap);
  box.scrollTop = box.scrollHeight;
}

// --- 3. SYMPTOM CHECKER ASSESSMENT ---
const checkerQuestions = [
  {
    id: "periods",
    question: "How regular or painful are your menstrual periods?",
    options: [
      { text: "Mostly regular, mild or moderate cramping.", score: 0, next: "unwanted_hair" },
      { text: "Delayed / Missed for months, or extremely irregular cycle dates.", score: 25, next: "unwanted_hair" },
      { text: "Debilitating pain that stops me from regular daily tasks.", score: 15, next: "unwanted_hair" }
    ]
  },
  {
    id: "unwanted_hair",
    question: "Do you experience excessive dark hair growth on chin, upper lip, chest, or stomach?",
    options: [
      { text: "No, standard body hair pattern.", score: 0, next: "weight" },
      { text: "Yes, prominent hair growth in those areas (High Androgen sign).", score: 25, next: "weight" }
    ]
  },
  {
    id: "weight",
    question: "Have you noticed sudden weight gain (especially around the belly) or struggle to lose weight?",
    options: [
      { text: "No, weight is stable or easily managed.", score: 0, next: "fatigue" },
      { text: "Yes, noticed weight gain and finding it hard to shift.", score: 20, next: "fatigue" }
    ]
  },
  {
    id: "fatigue",
    question: "How are your general fatigue and skin conditions?",
    options: [
      { text: "Normal energy, clear skin.", score: 0, next: "breast_lump" },
      { text: "High fatigue, frequent breakouts along jawline, or dark patches on neck/underarms.", score: 20, next: "breast_lump" }
    ]
  },
  {
    id: "breast_lump",
    question: "Have you noticed any new, hard lumps or nipple discharge?",
    options: [
      { text: "No, everything feels normal.", score: 0, next: "finish" },
      { text: "Yes, noticed a lump or changes recently.", score: 100, next: "finish" }
    ]
  }
];

let checkerAnswers = {};
let currentQuestionIndex = 0;

function startChecker() {
  checkerAnswers = {};
  currentQuestionIndex = 0;
  renderCheckerQuestion();
}

function renderCheckerQuestion() {
  const container = document.getElementById('checker-workflow');
  if (currentQuestionIndex >= checkerQuestions.length) {
    renderCheckerResults();
    return;
  }
  
  const questionObj = checkerQuestions[currentQuestionIndex];
  container.innerHTML = `
    <div class="question-card">
      <div class="card-badge">Step ${currentQuestionIndex + 1} of ${checkerQuestions.length}</div>
      <div class="question-text">${questionObj.question}</div>
      <div class="options-list">
        ${questionObj.options.map((opt, idx) => `
          <button class="option-btn" onclick="selectCheckerOption(${opt.score}, '${opt.next}')">${opt.text}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function selectCheckerOption(score, next) {
  checkerAnswers[checkerQuestions[currentQuestionIndex].id] = score;
  currentQuestionIndex++;
  renderCheckerQuestion();
}

function renderCheckerResults() {
  const container = document.getElementById('checker-workflow');
  let totalScore = Object.values(checkerAnswers).reduce((a, b) => a + b, 0);
  
  let title = "Low Risk Profile 🌸";
  let explainer = "Your symptoms indicate balanced hormone dynamics. Continue nourishing your body with balanced local meals and hydration.";
  let remedies = "No major treatments needed! You can practice daily seed cycling or butterfly yoga pose to support normal follicular stages.";
  
  if (checkerAnswers.breast_lump >= 100) {
    title = "Doctor Verification Recommended 🏥";
    explainer = "You mentioned noticing a breast lump or nipple discharge. This is an indicator to seek official validation. Please do not worry, but consult a warm health professional for safety.";
    remedies = "Please check the 'Doctor Finder' tab for helpline contact resources or free clinic references in your district.";
  } else if (totalScore >= 50) {
    title = "High PCOD/Hormonal Risk Profile 🌿";
    explainer = "Your symptoms (irregular cycles, androgen hair patterns, fatigue) map closely to polycystic ovarian syndrome indicators.";
    remedies = `
      <strong>Spearmint Tea Plan:</strong> Drink 2 hot cups of spearmint tea daily to reduce androgen levels.<br/>
      <strong>Sugar Restriction:</strong> Cut white sugar to reduce ovarian insulin resistance.<br/>
      <strong>Daily Walk:</strong> Walk for 30 minutes daily to assist metabolic regulation.
    `;
  } else if (totalScore >= 25) {
    title = "Mild Hormonal Discrepancy 🌿";
    explainer = "You have some minor indices like occasional delays or fatigue. These are very common and easily supported through simple kitchen changes.";
    remedies = "Add cinnamon water to your mornings to improve insulin response, cycle seeds monthly, and target 7.5+ hours of sleep.";
  }

  container.innerHTML = `
    <div class="checker-result-card">
      <div class="result-badge">${title}</div>
      <p class="result-explanation">${explainer}</p>
      <div class="remedies-section">
        <h4>Sakhi Natural Remedies Plan</h4>
        <p>${remedies}</p>
      </div>
      <br/>
      <button class="btn-primary" onclick="startChecker()">Retake Test</button>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  startChecker();
  loadSession();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log("Service Worker registered successfully! 🛠️"))
      .catch((err) => console.error("Service Worker registration failed:", err));
  }
});

// --- 4. AYURVEDIC ENGINE ---
const masterRemedies = [
  { name: "Spearmint Tea (Pahadi Pudina)", for: "Unwanted Hair & Androgens", desc: "Clinically proven to reduce testosterone levels in PCOD women.", prep: "Steep 1 tsp dried spearmint in hot water. Drink twice daily.", icon: "☕" },
  { name: "Flaxseeds (Alsi)", for: "Androgen Blockers & Fiber", desc: "Blocks excess free male hormones naturally from binding to receptors.", prep: "Consume 1 tablespoon ground seeds daily in yogurt or water.", icon: "🌾" },
  { name: "Shatavari (Asparagus Racemosus)", for: "Irregular Cycle & Estrogen", desc: "Adaptogen that balances progesterone levels and regulates cycle timing.", prep: "500mg capsules twice daily, or powder with milk at bedtime.", icon: "🌿" },
  { name: "Cinnamon (Dalchini)", for: "Insulin Resistance & Weight", desc: "Reduces blood insulin levels and improves metabolic fat burn.", prep: "Add 1/2 tsp ground cinnamon to warm morning water.", icon: "🍂" },
  { name: "Fresh Ginger Tea", for: "Period Cramps & Pain", desc: "Soothes uterine spasms by reducing prostaglandins naturally.", prep: "Boil crushed ginger root in water. Drink hot 3x daily during cramps.", icon: "🌱" },
  { name: "Turmeric Milk (Haldi Doodh)", for: "Sleep & Inflammatory Relief", desc: "Deep sleep promoter and general body cell inflammation reducer.", prep: "Mix 1/2 tsp pure turmeric in hot milk with black pepper pinch. Nightly.", icon: "🥛" },
  { name: "Ashwagandha (Indian Ginseng)", for: "Cortisol & Stress Management", desc: "Reduces stress hormones that block menstrual cycles and trigger period delays.", prep: "Take 1/2 tsp with warm water or milk at bedtime.", icon: "🪵" },
  { name: "Lodhra (Symplocos Racemosa)", for: "Excessive Flow & Cystic Control", desc: "Regulates ovarian hormones and prevents heavy, irregular menstrual bleeding.", prep: "Consume 1/2 tsp Lodhra bark powder with warm water twice daily.", icon: "🍂" },
  { name: "Kanchanar Guggulu", for: "Thyroid & Ovarian Cyst Support", desc: "Traditional Ayurvedic formula used to reduce sizes of cystic follicles and support TSH.", prep: "Take 1-2 tablets twice daily after meals with warm water.", icon: "🧆" },
  { name: "Triphala Powder", for: "Estrogen Detox & Gut Health", desc: "Supports bowel liver cycles which filter out used estrogen, lowering cramps.", prep: "Steep 1 tsp in hot water at night, drink warm before sleeping.", icon: "🍒" },
  { name: "Aloe Vera Juice (Kumari)", for: "Ovulation Booster & Acne", desc: "Rich in active enzymes that nourish ovaries and clear hormonal acne flareups.", prep: "Mix 2 tbsp fresh Aloe juice in warm water, drink on empty stomach.", icon: "🌵" },
  { name: "Dashmula Herb Drink", for: "Heavy Pelvic Congestion & Pain", desc: "A blend of ten roots that relieves deep pelvic blockages and lower back throbbing.", prep: "Boil 15ml Dashmularishta syrup with equal water, drink after meals.", icon: "🍷" },
  { name: "Fenugreek Seeds (Methi)", for: "Insulin Sensitivity & Glucose", desc: "Fibers and compounds that slow down sugar absorption, aiding PCOD weight issues.", prep: "Soak 1 tsp seeds in water overnight. Drink water & chew seeds on empty stomach.", icon: "🌿" },
  { name: "Fennel Seeds (Saunf)", for: "Bloating & Muscle Cramp Relief", desc: "Spasmolytic properties that relax smooth uterine muscles and reduce gas/bloating.", prep: "Chew 1 tsp raw seeds after meals or boil in water to drink as tea.", icon: "🌾" },
  { name: "Castor Oil Pack (Eranda)", for: "Localized Spasms & Circulation", desc: "External hot oil pack that penetrates skin to dissolve thick pelvic congestions.", prep: "Apply warm castor oil to abdomen, cover with cotton cloth & hot water bag.", icon: "💧" }
];

function renderRemedies() {
  const container = document.getElementById('remedy-list-grid');
  container.innerHTML = "";
  
  masterRemedies.forEach(rem => {
    const card = document.createElement('div');
    card.className = 'remedy-card';
    card.innerHTML = `
      <div class="icon">${rem.icon}</div>
      <h3>${rem.name}</h3>
      <div class="remedy-target">${rem.for}</div>
      <p class="remedy-desc">${rem.desc}</p>
      <div class="remedy-prep"><strong>How to use:</strong> ${rem.prep}</div>
    `;
    container.appendChild(card);
  });
}

function filterRemedies() {
  const query = document.getElementById('remedy-search').value.toLowerCase();
  const cards = document.querySelectorAll('.remedy-card');
  
  cards.forEach(card => {
    const title = card.querySelector('h3').innerText.toLowerCase();
    const targets = card.querySelector('.remedy-target').innerText.toLowerCase();
    if (title.includes(query) || targets.includes(query)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

// --- 5. SMART DIET ---
const dietCycles = {
  menstrual: {
    title: "Menstrual Phase Sync Plan (Day 1-5)",
    meals: {
      breakfast: "Ragi Malt or Warm Oats with dates and ground pumpkin seeds.",
      lunch: "Iron-rich spinach (Palak) dal with red rice and beetroot salad.",
      dinner: "Warm lentil soup, sautéed vegetables, and bedtime turmeric milk."
    }
  },
  follicular: {
    title: "Follicular Phase Sync Plan (Day 6-13)",
    meals: {
      breakfast: "Green moong sprouts salad with lemon juice, cucumber, and flaxseed powder.",
      lunch: "Mixed vegetable curry, whole wheat roti / quinoa, and home-set curd.",
      dinner: "Stir-fried tofu/paneer with local greens, carrots, and warm cumin water."
    }
  },
  ovulation: {
    title: "Ovulation Phase Sync Plan (Day 14-17)",
    meals: {
      breakfast: "Fruit bowl (papaya/berries) with chia seeds and almond milk.",
      lunch: "Moong dal khichdi, cabbage sabzi, and fresh mint buttermilk.",
      dinner: "Warm vegetable clear soup with grilled paneer or stir-fry chickpea salad."
    }
  },
  luteal: {
    title: "Luteal / PMS Phase Sync Plan (Day 18-28)",
    meals: {
      breakfast: "Steel-cut oatmeal, chopped almonds, pumpkin seeds, and ground flax.",
      lunch: "Ragi roti, black chana curry, and cucumber-tomato raita.",
      dinner: "Warm vegetable wrap, low sodium vegetable stir-fry, and 1 square of dark chocolate."
    }
  }
};

function generateDietPlan() {
  const pref = document.getElementById('diet-preference').value;
  const phase = document.getElementById('diet-phase').value;
  const plan = dietCycles[phase];
  
  const container = document.getElementById('diet-output-container');
  
  let breakfast = plan.meals.breakfast;
  let lunch = plan.meals.lunch;
  let dinner = plan.meals.dinner;
  
  if (pref === 'nonveg') {
    if (phase === 'menstrual') lunch = "Grilled chicken breast with spinach spinach salad and brown rice.";
    if (phase === 'follicular') dinner = "Steamed fish fillet with stir-fried greens and broccoli.";
    if (phase === 'ovulation') lunch = "Chicken stew with local vegetables and brown rice.";
    if (phase === 'luteal') breakfast = "Boiled eggs (2) with sautéed spinach and a cup of oats.";
  } else if (pref === 'egg') {
    if (phase === 'menstrual') breakfast = "Egg whites bhurji with whole wheat bread and dates.";
    if (phase === 'ovulation') dinner = "Egg drop soup with boiled beans and seeds.";
  }

  container.innerHTML = `
    <div class="diet-dashboard-row">
      <div class="diet-meal-card">
        <span class="meal-time-badge">Morning / Breakfast</span>
        <h4>${breakfast.split('or')[0]}</h4>
        <p>Prepares stomach enzymes and stabilizes insulin levels for the day.</p>
      </div>
      <div class="diet-meal-card">
        <span class="meal-time-badge">Midday / Lunch</span>
        <h4>${lunch}</h4>
        <p>Sustains high metabolism and supplies fiber to prevent PCOD insulin spikes.</p>
      </div>
      <div class="diet-meal-card">
        <span class="meal-time-badge">Evening / Dinner</span>
        <h4>${dinner}</h4>
        <p>Keeps cortisol low, supports evening cell repair, and improves sleep cycles.</p>
      </div>
    </div>
    
    <div class="avoid-rules-card">
      <h4>⚠️ Critical Avoidances (PCOD Rules)</h4>
      <ul>
        <li><strong>White Sugar</strong>: Elevates insulin, prompting ovaries to generate excess testosterone.</li>
        <li><strong>Maida / Refined Flour</strong>: Triggers cellular inflammation and disrupts gut health.</li>
        <li><strong>Caffeine</strong>: Avoid coffee or strong black tea during PMS week to prevent cramps.</li>
        <li><strong>Ice Cold Drinks</strong>: Restricts core digestive heat (Agni), worsening bloating.</li>
      </ul>
    </div>
  `;
}

// --- 6. CYCLE TRACKER ---
function renderCalendar() {
  const monthLabel = document.getElementById('calendar-month-year');
  const cellsContainer = document.getElementById('calendar-cells');
  cellsContainer.innerHTML = "";

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  monthLabel.innerText = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cycles = sessionData.cycles || [];

  for (let i = 0; i < firstDay; i++) {
    const pad = document.createElement('div');
    pad.className = 'calendar-cell inactive';
    cellsContainer.appendChild(pad);
  }

  for (let d = 1; d <= totalDays; d++) {
    const cellDate = new Date(year, month, d);
    const dateStr = cellDate.toISOString().split('T')[0];

    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    cell.innerText = d;

    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr === todayStr) {
      cell.classList.add('today');
    }

    cycles.forEach(c => {
      const start = new Date(c.startDate);
      const diffTime = cellDate - start;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < c.cycleLength) {
        if (diffDays < c.duration) {
          cell.classList.add('period');
        } else if (diffDays >= 13 && diffDays <= 16) {
          if (diffDays === 14) cell.classList.add('ovulation');
          else cell.classList.add('fertile');
        } else if (diffDays >= 22 && diffDays <= 27) {
          cell.classList.add('pms');
        }
      }
    });

    cell.onclick = () => {
      document.getElementById('cycle-start-date').value = dateStr;
    };

    cellsContainer.appendChild(cell);
  }

  updatePeriodPrediction();
}

function prevMonth() {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  renderCalendar();
}

// Next month navigation
function nextMonth() {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  renderCalendar();
}

async function logPeriodFromForm() {
  const startDate = document.getElementById('cycle-start-date').value;
  const duration = document.getElementById('cycle-duration').value;
  
  if (!startDate) {
    alert("Please select a starting date!");
    return;
  }

  const response = await apiCall('/api/tracker/cycle', 'POST', {
    startDate,
    duration,
    cycleLength: 28
  });

  if (response && response.success) {
    sessionData.cycles = response.cycles;
    awardBadge("🌸 PCOD Warrior");
    renderCalendar();
    syncDashboardCyclePhase();
  }
}

function updatePeriodPrediction() {
  const txt = document.getElementById('prediction-alert-text');
  if (!sessionData.cycles || sessionData.cycles.length === 0) {
    txt.innerText = "No cycles logged. Predictions will show once you add details.";
    return;
  }

  const last = sessionData.cycles[sessionData.cycles.length - 1];
  const nextStart = new Date(last.startDate);
  nextStart.setDate(nextStart.getDate() + (last.cycleLength || 28));
  
  txt.innerHTML = `
    Your next period is predicted to start on: <strong>${nextStart.toLocaleDateString('en-IN')}</strong>.<br/>
    <em>PMS Prep Alert</em>: Start reducing salt and eating magnesium-rich seeds 5 days before this date. 🌸
  `;
}

// --- 7. SLEEP ---
async function logSleepHours() {
  const dateVal = document.getElementById('sleep-date').value;
  const hours = document.getElementById('sleep-hours').value;
  
  if (!dateVal) {
    alert("Please select a log date!");
    return;
  }

  const response = await apiCall('/api/mood', 'POST', {
    date: dateVal,
    sleep: hours,
    mood: 3
  });

  if (response && response.success) {
    sessionData.moodLogs = response.logs;
    if (parseFloat(hours) >= 7.5) {
      awardBadge("🌙 Sleep Champion");
    }
    renderSymptomHeatmap();
    alert("Sleep duration logged successfully!");
  }
}

// --- 8. MOOD & MIND ---
let selectedMoodValue = 3;

function selectMood(val) {
  selectedMoodValue = val;
  document.querySelectorAll('.mood-btn').forEach((btn, idx) => {
    if (5 - idx === val) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

async function submitMoodLog() {
  const todayStr = new Date().toISOString().split('T')[0];
  const notes = document.getElementById('mood-notes').value;

  const response = await apiCall('/api/mood', 'POST', {
    date: todayStr,
    mood: selectedMoodValue,
    sleep: 7.5,
    notes: notes
  });

  if (response && response.success) {
    sessionData.moodLogs = response.logs;
    renderSymptomHeatmap();
    alert("Mood recorded! Heatmap updated.");
  }
}

function triggerEmergencySupport() {
  document.getElementById('emergency-modal').style.display = 'flex';
}

function closeEmergencyModal() {
  document.getElementById('emergency-modal').style.display = 'none';
}

async function saveJournalEntry() {
  const input = document.getElementById('journal-input');
  const txt = input.value.trim();
  if (!txt) return;

  const response = await apiCall('/api/journal', 'POST', { content: txt });
  if (response && response.success) {
    sessionData.journal = response.journal;
    input.value = "";
    awardBadge("📓 Journal Queen");
    renderJournals();
  }
}

function renderJournals() {
  const list = document.getElementById('journal-entries-list');
  list.innerHTML = "";
  if (!sessionData.journal) return;
  sessionData.journal.forEach(j => {
    const item = document.createElement('div');
    item.className = 'journal-item';
    item.innerHTML = `
      <small>${j.date}</small>
      <p>${j.content}</p>
    `;
    list.appendChild(item);
  });
}

let breathTimer = null;
let breathingActive = false;

function toggleBreathingExercise() {
  const btn = document.getElementById('btn-breath-start');
  const text = document.getElementById('breath-text');
  const circle = document.getElementById('breath-circle');

  if (breathingActive) {
    clearInterval(breathTimer);
    breathingActive = false;
    btn.innerText = "Start Breathing";
    text.innerText = "Tap Start to Begin";
    circle.className = "breathing-circle";
  } else {
    breathingActive = true;
    btn.innerText = "Stop Session";
    runBreathingCycle();
  }
}

function runBreathingCycle() {
  const text = document.getElementById('breath-text');
  const circle = document.getElementById('breath-circle');
  if (!breathingActive) return;

  circle.className = "breathing-circle inhale";
  text.innerText = "Breathe In... (4s)";
  
  breathTimer = setTimeout(() => {
    if (!breathingActive) return;
    circle.className = "breathing-circle inhale hold";
    text.innerText = "Hold... (7s)";
    
    breathTimer = setTimeout(() => {
      if (!breathingActive) return;
      circle.className = "breathing-circle";
      text.innerText = "Exhale Out Slowly... (8s)";
      
      breathTimer = setTimeout(() => {
        if (breathingActive) runBreathingCycle();
      }, 8000);
      
    }, 7000);
    
  }, 4000);
}

// --- 9. BREAST HEALTH ANIMATED GUIDE ---
// --- 9. BREAST HEALTH ANIMATED GUIDE ---
let currentBseStep = 0;
const bseSteps = [
  {
    title: "1. Mirror Check — Arms at Sides",
    desc: "Stand in front of a well-lit mirror. Relax your shoulders and let your arms hang at your sides or on your hips. Visually inspect both breasts for shape, contours, size, and skin color symmetry.",
    alert: "Look for dimpling, skin pulling, scaling, redness, or any changes in the position of the nipples.",
    svg: `<svg viewBox="0 0 200 200" class="bse-svg-art" width="100%" height="220px">
      <!-- Clean Minimalist Frame -->
      <rect x="10" y="10" width="180" height="180" rx="12" fill="#FFFFFF" stroke="#D0D0D0" stroke-width="1.5"/>
      <!-- Mirror Outline -->
      <rect x="25" y="25" width="150" height="150" rx="8" fill="none" stroke="#E0E0E0" stroke-width="2" stroke-dasharray="4 4"/>
      <!-- Cartoon Outline Character Torso -->
      <path d="M 60 50 C 70 60, 80 60, 90 50 L 95 60 C 95 60, 105 80, 115 60 L 120 50 C 130 60, 140 60, 150 50 L 160 95 C 160 95, 170 110, 170 130 L 165 190 L 140 190 L 142 145 C 142 145, 120 180, 100 145 C 80 180, 58 145, 58 145 L 60 190 L 35 190 L 30 130 C 30 110, 40 95, 40 95 Z" fill="none" stroke="#222222" stroke-width="2.5" stroke-linejoin="round"/>
      <!-- Breasts and Nipples -->
      <path d="M 60 135 C 65 155, 88 155, 96 135" fill="none" stroke="#222222" stroke-width="2"/>
      <circle cx="78" cy="138" r="3" fill="#E8526A"/>
      <path d="M 104 135 C 112 155, 135 155, 140 135" fill="none" stroke="#222222" stroke-width="2"/>
      <circle cx="122" cy="138" r="3" fill="#E8526A"/>
      <!-- Mirror reflection line -->
      <path d="M 35 35 L 50 35 L 35 50 Z" fill="#E8F5E9" opacity="0.5"/>
    </svg>`
  },
  {
    title: "2. Mirror Check — Arms Raised High",
    desc: "Raise your hands high above your head. This pulls the breast tissue upward, stretching the skin. Look at the mirror again and check for visual shifts, pulls, or changes in how the lower breast curves.",
    alert: "Watch for puckering or indentation at the bottom contours, which indicates tissues pulling inward.",
    svg: `<svg viewBox="0 0 200 200" class="bse-svg-art" width="100%" height="220px">
      <!-- Clean Minimalist Frame -->
      <rect x="10" y="10" width="180" height="180" rx="12" fill="#FFFFFF" stroke="#D0D0D0" stroke-width="1.5"/>
      <!-- Mirror Outline -->
      <rect x="25" y="25" width="150" height="150" rx="8" fill="none" stroke="#E0E0E0" stroke-width="2" stroke-dasharray="4 4"/>
      <!-- Character Torso with Arms Up -->
      <path d="M 60 95 C 70 105, 80 105, 90 95 L 95 105 C 95 105, 105 125, 115 105 L 120 95 C 130 105, 140 105, 150 95 L 158 130 C 158 130, 168 145, 168 165 L 163 190 L 140 190 L 141 170 C 141 170, 120 190, 100 170 C 80 190, 59 170, 59 170 L 60 190 L 37 190 L 32 130 C 32 110, 42 95, 42 95 Z" fill="none" stroke="#222222" stroke-width="2.5" stroke-linejoin="round"/>
      <!-- Raised Arm Outlines -->
      <path d="M 42 95 L 30 25 C 30 25, 48 15, 52 45 C 52 45, 56 65, 60 95" fill="none" stroke="#222222" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M 158 95 L 170 25 C 170 25, 152 15, 148 45 C 148 45, 144 65, 140 95" fill="none" stroke="#222222" stroke-width="2.5" stroke-linejoin="round"/>
      <!-- Breasts and Nipples (Shifted Upwards) -->
      <path d="M 62 148 C 67 165, 88 165, 96 148" fill="none" stroke="#222222" stroke-width="2"/>
      <circle cx="78" cy="151" r="3" fill="#E8526A"/>
      <path d="M 104 148 C 112 165, 133 165, 138 148" fill="none" stroke="#222222" stroke-width="2"/>
      <circle cx="122" cy="151" r="3" fill="#E8526A"/>
      <!-- Upward arrows to indicate movement -->
      <path d="M 78 180 L 78 166 M 78 166 L 75 170 M 78 166 L 81 170" stroke="#E8526A" stroke-width="2" fill="none"/>
      <path d="M 122 180 L 122 166 M 122 166 L 119 170 M 122 166 L 125 170" stroke="#E8526A" stroke-width="2" fill="none"/>
    </svg>`
  },
  {
    title: "3. Circular Scanning (Symmetry & Lumps)",
    desc: "Use the flat finger pads of your opposite hand to examine the breast tissue. Press and slide in gentle, overlapping circles, covering all regions of each breast.",
    alert: "Look for any localized thickness, hard nodules, or painless lumps under the skin.",
    svg: `<svg viewBox="0 0 200 200" class="bse-svg-art" width="100%" height="220px">
      <!-- Clean Minimalist Frame -->
      <rect x="10" y="10" width="180" height="180" rx="12" fill="#FFFFFF" stroke="#D0D0D0" stroke-width="1.5"/>
      <!-- Shower spray in corner representing wet skin examination -->
      <path d="M 160 20 L 180 10" stroke="#888" stroke-width="2"/>
      <path d="M 175 12 A 8 8 0 0 1 185 24" fill="none" stroke="#888" stroke-width="2"/>
      <line x1="165" y1="25" x2="150" y2="45" stroke="#B8DCEF" stroke-width="1.5"/>
      <line x1="172" y1="28" x2="160" y2="52" stroke="#B8DCEF" stroke-width="1.5"/>
      <line x1="178" y1="32" x2="170" y2="58" stroke="#B8DCEF" stroke-width="1.5"/>
      
      <!-- Cartoon character outline checking breast -->
      <path d="M 50 60 C 65 75, 75 75, 90 60 L 95 75 C 95 75, 105 95, 115 75 L 120 60 L 160 110 L 155 190 L 40 190 Z" fill="none" stroke="#222222" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M 55 130 C 65 155, 88 155, 96 130" fill="none" stroke="#222222" stroke-width="2"/>
      <path d="M 104 130 C 114 155, 135 155, 140 130" fill="none" stroke="#222222" stroke-width="2"/>
      
      <!-- Checking hand outline (touching the breast) -->
      <g>
        <!-- Arm & Hand outline -->
        <path d="M 125 155 Q 110 138 92 138 C 85 138, 78 140, 75 145" fill="none" stroke="#222222" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Fingers pressing -->
        <path d="M 92 138 L 78 142 M 92 142 L 78 146 M 92 146 L 79 150" stroke="#222222" stroke-width="2.5" stroke-linecap="round"/>
      </g>
      
      <!-- Finger Detail Panel Box in Corner (exactly like reference image) -->
      <g transform="translate(15, 110)">
        <rect x="0" y="0" width="55" height="55" fill="#FFFFFF" stroke="#222222" stroke-width="1.5"/>
        <!-- Hand representation -->
        <path d="M 10 50 L 10 35 C 10 35, 12 20, 16 20 C 20 20, 21 35, 21 35 M 21 35 C 21 35, 23 15, 28 15 C 33 15, 33 35, 33 35 M 33 35 C 33 35, 35 18, 40 18 C 45 18, 44 38, 44 38 M 44 38 L 48 45 L 48 50" fill="none" stroke="#222222" stroke-width="1.5" stroke-linejoin="round"/>
        <!-- 3 Highlight Circles on finger pads -->
        <circle cx="16" cy="22" r="4" fill="none" stroke="#E8526A" stroke-width="1.5"/>
        <circle cx="28" cy="17" r="4" fill="none" stroke="#E8526A" stroke-width="1.5"/>
        <circle cx="40" cy="20" r="4" fill="none" stroke="#E8526A" stroke-width="1.5"/>
      </g>
    </svg>`
  },
  {
    title: "4. Quadrant Pathways (Checking Patterns)",
    desc: "Divide your breast into 4 quadrants. Choose a pattern: Spiral (moving in circles to center), Up-and-Down Grid (vertical lines), or Wedges (radial lines from outer edge to nipple). Ensure full coverage.",
    alert: "Toggle and visualize the pathways below to know how to cover every quadrant completely.",
    svg: `<div class="check-pattern-controls" style="margin: 0.5rem 0; display: flex; justify-content: center; gap: 0.5rem;">
      <button class="btn-secondary active" id="pat-spiral" onclick="playBreastAnimation('spiral')">Spiral</button>
      <button class="btn-secondary" id="pat-updown" onclick="playBreastAnimation('updown')">Grid</button>
      <button class="btn-secondary" id="pat-wedges" onclick="playBreastAnimation('wedges')">Wedges</button>
    </div>
    <svg id="breast-anatomy-svg" viewBox="0 0 200 200" width="100%" height="180px">
      <rect x="10" y="10" width="180" height="180" rx="12" fill="#FFFFFF" stroke="#D0D0D0" stroke-width="1.5"/>
      <!-- Close up Breast Contour outline -->
      <path d="M 30 170 Q 100 80 170 170" fill="none" stroke="#222222" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="125" r="8" fill="#E8526A" opacity="0.3"/>
      <circle cx="100" cy="125" r="3" fill="#222222"/>
      
      <!-- Quadrant divider lines (dashed medical guidelines) -->
      <line x1="100" y1="30" x2="100" y2="180" stroke="#888888" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="25" y1="125" x2="175" y2="125" stroke="#888888" stroke-width="1" stroke-dasharray="4 4"/>
      
      <!-- Animated scan pathways -->
      <path id="check-path" d="" fill="none" stroke="#E8526A" stroke-width="2.5" stroke-dasharray="6 6" class="scan-path-animated"/>
      <g id="hand-indicator">
        <circle cx="0" cy="0" r="5" fill="#E8526A"/>
        <circle cx="0" cy="0" r="8" fill="none" stroke="#E8526A" stroke-width="1"/>
        <animateMotion id="motion-path-trigger" dur="6s" repeatCount="indefinite" path="" />
      </g>
    </svg>`
  },
  {
    title: "5. Examine Armpit & Lymph Nodes",
    desc: "Raise one arm slightly. Use your opposite hand's fingers to feel your underarm area, sweeping down to the breast tissue. Feel for swelling in the axillary lymph nodes.",
    alert: "Swollen nodes can feel like small, hard peas under the skin. Check collarbones and underarm regions.",
    svg: `<svg viewBox="0 0 200 200" class="bse-svg-art" width="100%" height="220px">
      <!-- Clean Minimalist Frame -->
      <rect x="10" y="10" width="180" height="180" rx="12" fill="#FFFFFF" stroke="#D0D0D0" stroke-width="1.5"/>
      <!-- Body outline, arm raised behind neck -->
      <path d="M 45 60 C 55 70, 70 70, 80 55 L 85 65 C 85 65, 100 90, 115 65 L 120 55 L 138 105 L 140 190 L 110 190 L 112 145 M 80 145 L 82 190 L 50 190 Z" fill="none" stroke="#222222" stroke-width="2.5" stroke-linejoin="round"/>
      <!-- Raised Right Arm behind head -->
      <path d="M 120 55 C 130 55, 140 35, 145 10 C 145 10, 130 -5, 120 15 C 120 15, 110 35, 110 50" fill="none" stroke="#222222" stroke-width="2.5" stroke-linejoin="round"/>
      <!-- Checking hand from opposite side sweeping underarm -->
      <path d="M 160 110 C 150 95, 135 90, 122 92" fill="none" stroke="#222222" stroke-width="2" stroke-linecap="round"/>
      <!-- Pulsing Node and pathway highlights -->
      <circle cx="130" cy="65" r="8" fill="#E8526A" opacity="0.3"/>
      <circle cx="130" cy="65" r="3" fill="#E8526A"/>
      <path d="M 135 55 Q 125 70, 130 85" fill="none" stroke="#E8526A" stroke-width="2" stroke-dasharray="3 3"/>
    </svg>`
  },
  {
    title: "6. Lying Down Check (Flat on Bed)",
    desc: "Lie down flat on your back in bed with a pillow under your shoulder. Put your arm behind your head. Lying down flattens the tissue, making deep lumps easier to feel against the ribs.",
    alert: "Use your left hand's fingers to feel your right breast, then swap sides to check the left.",
    svg: `<svg viewBox="0 0 200 200" class="bse-svg-art" width="100%" height="220px">
      <!-- Clean Minimalist Frame -->
      <rect x="10" y="10" width="180" height="180" rx="12" fill="#FFFFFF" stroke="#D0D0D0" stroke-width="1.5"/>
      <!-- Horizontal Bed Line -->
      <line x1="20" y1="150" x2="180" y2="150" stroke="#222222" stroke-width="2"/>
      <!-- Pillow under shoulder (Dashed box outline) -->
      <path d="M 110 150 Q 125 165, 140 150 Z" fill="#E8F5E9" stroke="#222222" stroke-width="1.5"/>
      <!-- Lying Torso Profile Outline -->
      <path d="M 30 150 C 30 150, 50 120, 90 120 C 130 120, 150 150, 150 150" fill="none" stroke="#222222" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Breasts contours lying flat -->
      <path d="M 65 140 Q 78 122, 90 140" fill="none" stroke="#222222" stroke-width="2"/>
      <path d="M 90 140 Q 102 122, 115 140" fill="none" stroke="#222222" stroke-width="2"/>
      <!-- Hand behind head outline -->
      <path d="M 115 140 C 128 130, 138 110, 135 95" fill="none" stroke="#222222" stroke-width="2"/>
      <!-- Checking Hand indicator -->
      <circle cx="78" cy="130" r="5" fill="#E8526A" opacity="0.8"/>
      <circle cx="78" cy="130" r="10" fill="none" stroke="#E8526A" stroke-width="1.5"/>
    </svg>`
  },
  {
    title: "7. Nipple Discharge Squeeze Test",
    desc: "Gently squeeze the nipple of each breast between your thumb and index finger. Check for fluid discharge, scaling, or bleeding.",
    alert: "Contact a doctor immediately if you observe clear, yellow, or bloody discharge from either nipple.",
    svg: `<svg viewBox="0 0 200 200" class="bse-svg-art" width="100%" height="220px">
      <!-- Clean Minimalist Frame -->
      <rect x="10" y="10" width="180" height="180" rx="12" fill="#FFFFFF" stroke="#D0D0D0" stroke-width="1.5"/>
      <!-- Close up breast contour outline -->
      <path d="M 20 160 Q 60 90 100 90 Q 140 90 180 160 Z" fill="none" stroke="#222222" stroke-width="2.5"/>
      <!-- Nipple contour -->
      <path d="M 94 90 C 94 82, 106 82, 106 90" fill="none" stroke="#222222" stroke-width="2"/>
      
      <!-- Squeezing Fingers Outline -->
      <g>
        <!-- Thumb -->
        <path d="M 65 72 Q 84 82, 92 90" stroke="#222222" stroke-width="3" fill="none" stroke-linecap="round"/>
        <!-- Index Finger -->
        <path d="M 135 72 Q 116 82, 108 90" stroke="#222222" stroke-width="3" fill="none" stroke-linecap="round"/>
      </g>
      <!-- Fluid Drop illustration -->
      <path d="M 100 92 Q 100 107 100 115 C 97 115, 95 118, 100 122 C 105 118, 103 115, 100 115" fill="#E8526A" class="fluid-drop-anim"/>
    </svg>`
  }
];

function initBseSlideshow() {
  currentBseStep = 0;
  renderBseStep();

  const dateInput = document.getElementById('bse-log-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  renderBseLogs();
}

function renderBseStep() {
  const step = bseSteps[currentBseStep];
  document.getElementById('bse-step-indicator').innerText = `Step ${currentBseStep + 1} of ${bseSteps.length}`;
  document.getElementById('bse-step-title').innerText = step.title;
  document.getElementById('bse-step-desc').innerText = step.desc;
  document.getElementById('bse-step-alert').innerHTML = `<strong>What to look for:</strong> ${step.alert}`;
  
  const display = document.getElementById('bse-svg-display');
  display.innerHTML = step.svg;

  const dotsContainer = document.getElementById('bse-dots-container');
  dotsContainer.innerHTML = "";
  bseSteps.forEach((_, idx) => {
    const dot = document.createElement('span');
    dot.className = `bse-dot ${idx === currentBseStep ? 'active' : ''}`;
    dot.onclick = () => goToBseStep(idx);
    dotsContainer.appendChild(dot);
  });

  if (currentBseStep === 5) {
    playBreastAnimation('spiral');
  }

  const instList = document.getElementById('bse-instructions-list');
  if (instList) {
    const insts = bseStepInstructions[currentBseStep] || [];
    instList.innerHTML = insts.map(inst => `<li>${inst}</li>`).join('');
  }
}

const bseStepInstructions = [
  [
    "Stand straight in front of a well-lit mirror with your shoulders relaxed and arms resting comfortably on your hips.",
    "Carefully inspect the general appearance of both breasts: check for differences in size, shape, contours, or color symmetry.",
    "Look out for any visible dimpling, skin pulling, scaling, redness, or nipple shifts."
  ],
  [
    "Raise both arms high above your head. This pulls the breast tissue upwards and stretches the skin.",
    "Observe if both breasts lift symmetrically and if the lower curves remain even.",
    "Look closely in the mirror for any puckering, indentations, or dimpling at the bottom contours."
  ],
  [
    "Keep your fingers flat and use the sensitive pads of your middle three fingers (not the tips).",
    "Press and glide in small, overlapping circles to feel the tissue.",
    "Use light pressure near the surface, medium pressure for deeper tissue, and firm pressure to feel down to the ribs, scanning for lumps."
  ],
  [
    "Mentally divide each breast into four separate quadrants (top-outer, top-inner, bottom-outer, bottom-inner).",
    "Choose a check pathway: **Spiral** (circles to center), **Grid** (vertical rows), or **Wedges** (lines radiating out).",
    "Follow the pattern steadily to cover all tissue from the collarbone to the ribs, and armpit to cleavage."
  ],
  [
    "Raise your left arm slightly to open and relax your underarm area.",
    "Use your right hand's finger pads to feel the underarm and armpit region, sweeping downwards.",
    "Check for any hard, pea-like swellings, nodes, or tender nodules under your armpits and collarbones."
  ],
  [
    "Lie down flat on a bed or a comfortable mat.",
    "Place a pillow under your right shoulder and put your right hand behind your head (this flattens and spreads the breast tissue evenly).",
    "Use your left hand's finger pads to check your right breast. Swap sides (left hand behind head, pillow under left shoulder, right hand checking left breast)."
  ],
  [
    "Gently place your thumb and index finger around the areola of one breast.",
    "Squeeze the nipple slightly inward and pull forward gently, checking for any discharge or fluid.",
    "Verify if any discharge is clear, yellow, or bloody, and check if the nipple pulls inward (nipple inversion)."
  ]
];

function prevBseStep() {
  currentBseStep = (currentBseStep - 1 + bseSteps.length) % bseSteps.length;
  renderBseStep();
}

function nextBseStep() {
  currentBseStep = (currentBseStep + 1) % bseSteps.length;
  renderBseStep();
}

function goToBseStep(index) {
  currentBseStep = index;
  renderBseStep();
}

const animationPaths = {
  spiral: "M 100 100 A 10 10 0 0 1 110 100 A 20 20 0 0 1 80 100 A 30 30 0 0 1 130 100 A 45 45 0 0 1 55 100 A 60 60 0 0 1 160 100 A 70 70 0 0 1 30 100",
  updown: "M 40 40 L 40 160 L 60 160 L 60 40 L 80 40 L 80 160 L 100 160 L 100 40 L 120 40 L 120 160 L 140 160 L 140 40 L 160 40 L 160 160",
  wedges: "M 100 100 L 100 25 M 100 100 L 175 100 M 100 100 L 100 175 M 100 100 L 25 100 M 100 100 L 153 47 M 100 100 L 153 153 M 100 100 L 47 153 M 100 100 L 47 47"
};

function playBreastAnimation(pattern) {
  document.querySelectorAll('.check-pattern-controls button').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`pat-${pattern}`);
  if (activeBtn) activeBtn.classList.add('active');

  const pathStr = animationPaths[pattern];
  const checkPath = document.getElementById('check-path');
  const motionTrigger = document.getElementById('motion-path-trigger');

  if (checkPath && motionTrigger) {
    checkPath.setAttribute('d', pathStr);
    motionTrigger.setAttribute('path', pathStr);
    motionTrigger.endElement();
    motionTrigger.beginElement();
  }
}

function checkBreastAdvisory() {
  const age = parseInt(document.getElementById('breast-age').value);
  const out = document.getElementById('breast-advisory-output');

  let text = "";
  if (age < 18) {
    text = "<strong>Teen Advisory:</strong> Standard mammograms are not needed. Focus on puberty education and understanding regular changes. Perform self-exams occasionally to get comfortable with your body.";
  } else if (age < 35) {
    text = "<strong>Young Adult (18-35):</strong> Perform a Breast Self-Examination (BSE) monthly, ideally 3-5 days after your period ends. Consult a doctor only if you notice persistent lumps or skin dimpling.";
  } else if (age < 50) {
    text = "<strong>Adult Segment (36-50):</strong> Keep doing monthly self-checks. Annual gynecological evaluations are standard practice, and you can consult a doctor about baseline mammograms by age 40-45.";
  } else {
    text = "<strong>Golden Age (50+):</strong> Routine mammography screenings every 1-2 years are recommended. Speak with a local health provider about maintaining a schedule.";
  }

  out.innerHTML = text;
}

// --- 10. HYPER-PERSONALIZED DAILY TIMELINE ---
function renderTrainerTimeline() {
  const container = document.getElementById('trainer-timeline-list');
  if (!container) return;
  container.innerHTML = "";

  function adjustTime(timeStr, offsetHours, offsetMinutes = 0) {
    if (!timeStr) return "08:00";
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr);
    let m = parseInt(mStr);
    
    m += offsetMinutes;
    h += offsetHours + Math.floor(m / 60);
    m = m % 60;
    h = h % 24;

    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}`;
  }

  const wake = userHabits.wakeTime || "06:30";
  const sleep = userHabits.sleepTime || "22:30";
  const mealsCount = parseInt(userHabits.meals) || 3;

  const schedule = [
    { time: wake, task: "Wake Up & Lemon Drink", desc: "Flushes metabolic toxins. Prepare your body for the day.", key: "wake- Lemon" },
    { time: adjustTime(wake, 0, 30), task: "Hormonal Yoga (10 mins)", desc: "Improves lower abdominal circulation. Try butterfly and cobra.", key: "wake- Yoga" },
    { time: adjustTime(wake, 1, 0), task: "Spearmint Tea + Ashwagandha", desc: "Lowers morning stress cortisol levels.", key: "wake- Tea" },
    { time: adjustTime(wake, 2, 0), task: "First Meal (Breakfast)", desc: "Consume high fiber (moong sprouts or oatmeal) to keep blood glucose stable.", key: "wake- Breakfast" },
    { time: adjustTime(wake, 6, 0), task: "Hormone-Sync Lunch", desc: "Dal, leafy greens, and local grain. Support insulin responses.", key: "midday- Lunch" },
    { time: "16:30", task: "Steady Walk (30 mins)", desc: "Lowers insulin resistance, improving PCOD parameters.", key: "afternoon- Walk" },
    { time: adjustTime(sleep, -3, 0), task: "Light dinner", desc: "Avoid heavy portions. Skip white sugar completely.", key: "night- Dinner" },
    { time: adjustTime(sleep, -1, 0), task: "Symptom Log & Heatmap Update", desc: "Log mood, pain, and water glasses to track monthly variations.", key: "night- Log" },
    { time: adjustTime(sleep, -0, 30), task: "Turmeric Milk & Screen sunset", desc: "Sip warm turmeric milk. Turn off all displays to trigger melatonin.", key: "night- Sleep" }
  ];

  schedule.forEach(item => {
    const isDone = sessionData.checklist[item.key] || false;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'timeline-item';
    itemDiv.innerHTML = `
      <div class="timeline-dot ${isDone ? 'done' : ''}"></div>
      <div class="timeline-content">
        <div class="timeline-time">${item.time}</div>
        <div class="timeline-title">${item.task}</div>
        <div class="timeline-note">${item.desc}</div>
      </div>
      <button class="timeline-check-btn ${isDone ? 'done' : ''}" onclick="toggleTrainerCheck('${item.key}')">✓</button>
    `;
    container.appendChild(itemDiv);
  });
}

async function toggleTrainerCheck(key) {
  sessionData.checklist[key] = !sessionData.checklist[key];
  const totalTasks = Object.keys(sessionData.checklist).filter(k => sessionData.checklist[k] === true).length;
  if (totalTasks >= 8) {
    awardBadge("🎯 Goal Crusher");
  }
  renderTrainerTimeline();
  await syncSessionState();
}

// --- 11. ML HEALTH ANALYZER ---
async function runMlReportAnalysis() {
  const lh = document.getElementById('ml-lh').value;
  const fsh = document.getElementById('ml-fsh').value;
  const testosterone = document.getElementById('ml-testosterone').value;
  const insulin = document.getElementById('ml-insulin').value;
  const tsh = document.getElementById('ml-tsh').value;

  const out = document.getElementById('analyzer-results-panel');
  out.innerHTML = `<p>Analyzing data packages, explaining report markers... 🌸</p>`;

  const result = await apiCall('/api/ml-analyze', 'POST', { lh, fsh, testosterone, insulin, tsh });
  if (!result) {
    out.innerHTML = `<p>Error during processing. Check internet connectivity.</p>`;
    return;
  }

  let reportHtml = `
    <h3>Medical Indicators explained</h3>
    <div class="risk-badge" style="font-size: 1.5rem; text-align: left; margin: 0.5rem 0;">
      Risk Classification: ${result.riskCategory} (${result.pcodRiskScore}%)
    </div>
    <p>${result.advice}</p>
    <div style="display: flex; flex-direction: column; gap: 0.8rem; margin-top: 1rem;">
  `;

  result.reports.forEach(rep => {
    reportHtml += `
      <div class="analysis-item">
        <div class="analysis-item-header">
          <span class="analysis-marker">${rep.marker}: <strong>${rep.value}</strong></span>
          <span class="analysis-status ${rep.status === 'High' ? 'status-high' : 'status-normal'}">${rep.status}</span>
        </div>
        <p class="analysis-desc">${rep.desc}</p>
      </div>
    `;
  });

  reportHtml += `</div>`;
  out.innerHTML = reportHtml;
}

function handleMockFileAnalysis() {
  const fileInput = document.getElementById('ml-file-picker');
  const statusLbl = document.getElementById('upload-status-lbl');
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    statusLbl.innerText = `Loaded: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    
    document.getElementById('ml-lh').value = 14.2;
    document.getElementById('ml-fsh').value = 5.8;
    document.getElementById('ml-testosterone').value = 82;
    document.getElementById('ml-insulin').value = 19.5;
    document.getElementById('ml-tsh').value = 4.9;
  }
}

// --- 12. ANONYMOUS COMMUNITY ---
async function loadCommunityPosts() {
  const container = document.getElementById('community-feed');
  container.innerHTML = "<p>Retrieving local conversations...</p>";

  const posts = await apiCall('/api/community');
  if (!posts) {
    container.innerHTML = "<p>Connection error while loading community.</p>";
    return;
  }

  container.innerHTML = "";
  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.innerHTML = `
      <div class="post-header-row">
        <span class="post-author">👤 ${post.author}</span>
        <span class="post-time">${post.time}</span>
      </div>
      <div class="post-body">${post.content}</div>
      <div class="post-tags">
        ${post.tags.map(t => `<span class="post-tag">#${t}</span>`).join('')}
      </div>
      <div class="post-actions-row">
        <button class="btn-relate" onclick="relatePost('${post.id}')">🌸 Relate (${post.relates || 0})</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function submitCommunityPost() {
  const txtInput = document.getElementById('community-post-text');
  const tagsInput = document.getElementById('community-post-tags');
  
  const content = txtInput.value.trim();
  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);

  if (!content) {
    alert("Please write a story before posting!");
    return;
  }

  const res = await apiCall('/api/community', 'POST', { content, tags });
  if (res && res.success) {
    txtInput.value = "";
    tagsInput.value = "";
    loadCommunityPosts();
    awardBadge("🌿 Remedy Pro");
  }
}

async function relatePost(postId) {
  const res = await apiCall('/api/community/relate', 'POST', { postId });
  if (res && res.success) {
    loadCommunityPosts();
  }
}

// --- 13. EDUCATION HUB ---
const ageArticles = {
  '13-18': {
    title: "Puberty, Period Health & Young Cycle Syncing 🌸",
    content: "Getting your period for the first time is a milestone. Your body is starting to secrete estrogen and progesterone. If your cycles are irregular or late during the first 2 years, don't panic! Your body is learning to communicate. However, look out for sudden weight gain, persistent fatigue, and dark skin patches—this could indicate early PCOD signs. Focus on regular nutrition and physical activities.",
    checkups: ["Track dates monthly.", "Avoid period shaming.", "Learn how to wear pads/cups."]
  },
  '19-25': {
    title: "Managing Stress, Hormones & Campus Lifestyle 🌿",
    content: "College and starting work are major stress factors. Higher cortisol levels can shut down your cycles. This is the peak age where PCOD triggers (facial hair, acne, fatigue). Natural spearmint tea, seed cycling, and daily walks are incredibly effective in restoring balance. Maintain sleep cycles and avoid late-night studying after midnight.",
    checkups: ["Check menstrual regularities.", "Monitor acne and skin transitions.", "Perform breast self-exams monthly."]
  },
  '26-35': {
    title: "Working Woman Stress, Fertility & Breast Care 🎗️",
    content: "As progesterone dynamics shift, tracking fertility cycles becomes important. Keep your insulin sensitive. This is also a key stage to start routine self-examinations of breast health to identify anomalies early. Eat healthy fats (almonds, flaxseeds, walnuts) to supply building blocks for your hormones.",
    checkups: ["Monitor ovulation windows.", "Monthly breast checkups.", "Annual wellness screens."]
  },
  '36-50': {
    title: "Perimenopause, Cycle Variations & Bone Health 🏥",
    content: "Your ovaries are gradually winding down. Estrogen levels fluctuate widely, leading to hot flashes, sleep changes, and irregular timelines. Add soy, flaxseeds, and calcium-rich ragi to support bone density. Annual medical screen schedules become key indicators during this phase.",
    checkups: ["Mammograms every 2 years.", "Bone density checks.", "Gynecologist evaluations."]
  },
  '50': {
    title: "Post-Menopause & Healthy Long-Term Aging 👵",
    content: "Menopause occurs when your cycle has stopped for 12 consecutive months. Estrogen drops permanently. Focus on bone strength (calcium + sunlight), cardiovascular health, and healthy joints. Do not ignore single occurrences of post-menopausal vaginal bleeding—consult a doctor immediately.",
    checkups: ["Mammogram scans standard.", "Joint health monitoring.", "Regular blood screens."]
  }
};

function filterEducation(ageSeg) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.innerText.includes(ageSeg) || (ageSeg === '50' && btn.innerText.includes('50+'))) {
      btn.classList.add('active');
    }
  });

  const art = ageArticles[ageSeg];
  const container = document.getElementById('education-articles');
  if (container) {
    container.innerHTML = `
      <div class="edu-article">
        <h3>${art.title}</h3>
        <p>${art.content}</p>
        <h4>Standard Safety Checklist:</h4>
        <ul>
          ${art.checkups.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </div>
    `;
  }
}

// --- 14. GENETIC RISK ---
async function calculateGeneticRisks() {
  const motherPcod = document.getElementById('risk-mother-pcod').checked;
  const sisterPcod = document.getElementById('risk-sister-pcod').checked;
  const motherSisterCancer = document.getElementById('risk-cancer').checked;
  const grandmotherCancer = document.getElementById('risk-grand-cancer').checked;
  const familyDiabetes = document.getElementById('risk-diabetes').checked;
  const firstPeriodAge = document.getElementById('risk-first-period').value;

  const out = document.getElementById('risk-results-output');
  out.innerHTML = "<p>Evaluating familial links, calculating margins... 🌸</p>";

  const res = await apiCall('/api/genetic-risk', 'POST', {
    motherPcod, sisterPcod, motherSisterCancer, grandmotherCancer, familyDiabetes, firstPeriodAge
  });

  if (!res) {
    out.innerHTML = "<p>Connection error. Unable to perform calculation.</p>";
    return;
  }

  out.innerHTML = `
    <h3>Genetic Risk Summary</h3>
    <div style="margin: 1.5rem 0;">
      <label>Calculated PCOD Susceptibility: <strong>${res.pcodRisk}%</strong></label>
      <div class="risk-bar"><div class="risk-needle" style="left: ${res.pcodRisk}%;"></div></div>
    </div>
    
    <div style="margin: 1.5rem 0;">
      <label>Calculated Breast Anomalies Susceptibility: <strong>${res.cancerRisk}%</strong></label>
      <div class="risk-bar"><div class="risk-needle" style="left: ${res.cancerRisk}%;"></div></div>
    </div>

    <div class="advisory-output">
      <h4>Recommended Screening Schedule:</h4>
      <p><strong>Breast Checkups</strong>: ${res.schedule.selfExam}</p>
      <p><strong>Clinical Mammogram</strong>: ${res.schedule.mammogram}</p>
      <p><strong>Clinical Visit</strong>: ${res.schedule.doctorVisit}</p>
    </div>
  `;
}

// --- 15. LADY GYNECOLOGIST FINDER ---
async function detectLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  
  const detectBtn = document.getElementById('detect-location-btn');
  const originalText = detectBtn.innerHTML;
  detectBtn.innerHTML = "⌛ Detecting...";
  detectBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
        const data = await response.json();
        
        // Extract city, town, village, or suburb name
        const address = data.address;
        const city = address.city || address.town || address.village || address.suburb || address.county || "";
        
        if (city) {
          document.getElementById('doctor-region-select').value = city;
          // Trigger search automatically
          findLadyGynecologists();
        } else {
          alert("Could not identify the city name from coordinates. Please enter it manually!");
        }
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
        alert("Unable to fetch city details from coordinates. Please enter manually.");
      } finally {
        detectBtn.innerHTML = originalText;
        detectBtn.disabled = false;
      }
    },
    (error) => {
      console.warn("Geolocation permission error:", error);
      alert("Location permission denied or unavailable. Please enter your location manually!");
      detectBtn.innerHTML = originalText;
      detectBtn.disabled = false;
    },
    { timeout: 10000 }
  );
}

async function findLadyGynecologists() {
  const region = document.getElementById('doctor-region-select').value;
  const container = document.getElementById('lady-gynae-list');
  if (!container) return;
  container.innerHTML = "<p>Searching lady gynecologists in selected city...</p>";

  const res = await apiCall(`/api/doctor/find?region=${region}`);
  if (!res || !res.doctors) {
    container.innerHTML = "<p>Unable to retrieve specialist lists at this moment.</p>";
    return;
  }

  container.innerHTML = "";
  res.doctors.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'gynae-card';
    card.innerHTML = `
      <h4>👩‍⚕️ ${doc.name}</h4>
      <div class="gynae-deg">${doc.degree}</div>
      <div class="gynae-clinic">🏥 Clinic: ${doc.clinic}</div>
      <div class="gynae-addr">📍 Address: ${doc.address}</div>
      <div class="gynae-phone">📞 Contact: ${doc.phone}</div>
      <div class="gynae-fee">💵 Consultation Fee: <strong>${doc.fee}</strong></div>
    `;
    container.appendChild(card);
  });
}

// --- 16. FOR HIM MODE ---
let isHimMode = false;

function toggleForHimMode() {
  isHimMode = !isHimMode;
  const btn = document.getElementById('him-toggle-btn');
  
  if (isHimMode) {
    document.body.classList.add('him-mode');
    btn.innerText = "🌸 For Her Mode";
    btn.style.background = "#E8526A";
    btn.style.color = "white";
    
    showForHimDashboard();
  } else {
    document.body.classList.remove('him-mode');
    btn.innerText = "🙋‍♂️ For Him Mode";
    btn.style.background = "";
    btn.style.color = "";
    
    // Restore any hidden privacy content
    const privatePages = ['cycle', 'mental', 'breast', 'checker'];
    privatePages.forEach(pId => {
      const pageEl = document.getElementById(`page-${pId}`);
      if (pageEl && pageEl.dataset.originalHtml) {
        pageEl.innerHTML = pageEl.dataset.originalHtml;
        pageEl.removeAttribute('data-original-html');
      }
    });
    
    showPage('dashboard');
  }
}

function showForHimDashboard() {
  // Update welcome banner
  const nameEl = document.getElementById('dash-user-name');
  if (nameEl) nameEl.innerText = "Support Partner";
  
  const welcomeText = document.querySelector('.welcome-banner p');
  if (welcomeText) {
    welcomeText.innerText = "Thank you for being here to support your partner. Learn about periods, Ayurvedic teas, and daily mobility exercises.";
  }
  
  // Show partner sync info at top of dashboard
  const partnerToken = localStorage.getItem('sakhi_partner_token');
  const partnerRow = document.getElementById('partner-id-display-row');
  if (partnerRow) {
    partnerRow.style.display = 'block';
    partnerRow.style.color = 'var(--rose)';
    if (partnerToken) {
      partnerRow.innerHTML = `
        🔗 Synced Partner: <strong style="color: var(--plum); text-transform: uppercase;">${partnerToken}</strong> 
        | <span style="cursor: pointer; text-decoration: underline; color: #D32F2F;" onclick="disconnectPartner()">Disconnect Sync</span>
      `;
    } else {
      partnerRow.innerHTML = `
        🔒 Partner logs locked. <span style="cursor: pointer; text-decoration: underline; color: var(--rose); font-weight: 700;" onclick="showPage('cycle')">Link Partner ID</span> to view period forecasts.
      `;
    }
  }

  // Update initial bot bubble
  const chatBox = document.getElementById('chat-box');
  if (chatBox) {
    chatBox.innerHTML = `
      <div class="msg msg-bot">
        <div class="msg-bubble">
          Hello, support partner! I am Sakhi. Ask me how to make soothing teas, prepare warm heating pads, or support your partner during PMS swings. 🌸
        </div>
      </div>
    `;
  }
}

function checkPartnerPrivacy(pageId) {
  const privatePages = ['cycle', 'mental', 'breast', 'checker'];
  if (isHimMode && privatePages.includes(pageId) && !localStorage.getItem('sakhi_partner_token')) {
    const pageEl = document.getElementById(`page-${pageId}`);
    if (pageEl) {
      if (!pageEl.dataset.originalHtml) {
        pageEl.dataset.originalHtml = pageEl.innerHTML;
      }
      pageEl.innerHTML = `
        <div class="privacy-lock-card" style="background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border: 1.5px solid var(--border); border-radius: 24px; padding: 4rem 2rem; text-align: center; max-width: 550px; margin: 3rem auto; box-shadow: var(--shadow);">
          <span style="font-size: 3.5rem; display: block; margin-bottom: 1rem;">🔒</span>
          <h3 style="font-family: var(--font-serif); color: var(--plum); margin-bottom: 0.75rem;">Intimate Sync Guard</h3>
          <p style="color: var(--mid); font-size: 0.92rem; line-height: 1.6; margin-bottom: 2rem;">
            Intimate diagnostics, journals, and period calendars are locked to protect her private space. 
            Enter your partner's <strong>Partner Sync ID</strong> to link accounts and unlock shared tracking.
          </p>
          <div class="form-group" style="margin-bottom: 1.5rem; max-width: 380px; margin-left: auto; margin-right: auto;">
            <input type="text" id="partner-id-input" placeholder="e.g. SAKHI-PRIYA123" style="text-align: center; font-weight: 600; text-transform: uppercase; font-size: 1.1rem; letter-spacing: 0.05em;"/>
          </div>
          <button class="btn-primary" onclick="connectPartner()" style="width: 100%; max-width: 380px; padding: 0.85rem;">Link Partner & Sync Logs</button>
        </div>
      `;
    }
    return true;
  }
  return false;
}

async function connectPartner() {
  const inputVal = document.getElementById('partner-id-input').value.trim().toUpperCase();
  if (!inputVal.startsWith('SAKHI-')) {
    alert("Invalid ID format. Partner Sync IDs must start with 'SAKHI-'");
    return;
  }
  const partnerUser = inputVal.substring(6).toLowerCase();
  
  const detectBtn = document.querySelector('.privacy-lock-card button');
  const originalText = detectBtn.innerText;
  detectBtn.innerText = "Connecting...";
  detectBtn.disabled = true;

  // Verify partner exists
  const res = await apiCall('/api/session', 'GET', null, partnerUser);
  if (res) {
    localStorage.setItem('sakhi_partner_token', partnerUser);
    alert(`Successfully synced with ${partnerUser}! Shared logs are now unlocked. 🌸`);
    location.reload();
  } else {
    alert("Partner ID not found. Ensure your partner has logged in and registered their account!");
    detectBtn.innerText = originalText;
    detectBtn.disabled = false;
  }
}

function disconnectPartner() {
  localStorage.removeItem('sakhi_partner_token');
  alert("Partner sync disconnected.");
  location.reload();
}

function copyPartnerId() {
  const syncId = document.getElementById('partner-sync-id').innerText;
  navigator.clipboard.writeText(syncId).then(() => {
    alert(`Partner Sync ID copied: ${syncId} 📋`);
  });
}

function handleLogout() {
  localStorage.removeItem('sakhi_auth_user');
  localStorage.removeItem('sakhi_user_token');
  localStorage.removeItem('sakhi_partner_token');
  activeUser = null;
  userToken = 'anonymous-default';
  location.reload();
}

// --- 17. PERIOD PAIN YOGA & EXERCISES ---
let currentYogaPose = 'vajrasana';
let yogaVisualMode = 'vector';
let trainerVisualMode = 'vector';

function getEmbedOrImageHtml(url, title, className = "") {
  if (url && url.includes('giphy.com')) {
    const parts = url.split('/');
    const id = parts[parts.length - 2];
    if (id) {
      return `<img src="https://i.giphy.com/${id}.gif" alt="${title}" class="${className}" referrerpolicy="no-referrer" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 12px; border: 1.5px solid var(--border); box-shadow: var(--shadow);" onerror="this.onerror=null; this.src='${url}';"/>`;
    }
  }
  return `<img src="${url || ''}" alt="${title}" class="${className}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 12px; border: 1.5px solid var(--border); box-shadow: var(--shadow);"/>`;
}

function setYogaMode(mode) {
  yogaVisualMode = mode;
  const btnVec = document.getElementById('btn-yoga-mode-vector');
  const btnGif = document.getElementById('btn-yoga-mode-gif');
  if (btnVec && btnGif) {
    btnVec.classList.toggle('active', mode === 'vector');
    btnVec.style.background = mode === 'vector' ? 'var(--rose)' : 'transparent';
    btnVec.style.color = mode === 'vector' ? 'white' : 'var(--mid)';
    btnGif.classList.toggle('active', mode === 'gif');
    btnGif.style.background = mode === 'gif' ? 'var(--rose)' : 'transparent';
    btnGif.style.color = mode === 'gif' ? 'white' : 'var(--mid)';
  }
  renderYogaPose();
}

function setTrainerMode(mode) {
  trainerVisualMode = mode;
  const btnVec = document.getElementById('btn-trainer-mode-vector');
  const btnGif = document.getElementById('btn-trainer-mode-gif');
  if (btnVec && btnGif) {
    btnVec.classList.toggle('active', mode === 'vector');
    btnVec.style.background = mode === 'vector' ? 'var(--rose)' : 'transparent';
    btnVec.style.color = mode === 'vector' ? 'white' : 'var(--mid)';
    btnGif.classList.toggle('active', mode === 'gif');
    btnGif.style.background = mode === 'gif' ? 'var(--rose)' : 'transparent';
    btnGif.style.color = mode === 'gif' ? 'white' : 'var(--mid)';
  }
  renderTrainerExercise();
}

const yogaPoses = {
  vajrasana: {
    title: "Vajrasana (Thunderbolt Pose) 🧘",
    benefit: "Relieves Bloating & Pelvic Congestion",
    desc: "Kneeling posture that regulates digestion and stimulates blood flow to the lower pelvic muscles to prevent severe uterine spasms.",
    steps: [
      "Stand straight on your mat with shoulders relaxed.",
      "Lower your right knee to the floor, followed by your left knee.",
      "Keep your big toes touching and heels slightly parted.",
      "Sit back completely on the cushion of your heels, resting hands on knees."
    ],
    image: "https://media.giphy.com/media/l3vR1uqhS4zH6QWGY/giphy.gif",
    svg: `<svg viewBox="0 0 500 150" class="yoga-svg-art" width="100%" height="100%">
      <rect x="5" y="5" width="490" height="140" rx="12" fill="#FFF0F2" stroke="#FFF0F2" stroke-width="1.5"/>
      <!-- Connecting dashed path -->
      <line x1="60" y1="110" x2="440" y2="110" stroke="#D0D0D0" stroke-width="1.5" stroke-dasharray="3 3"/>
      
      <!-- Numbered indicators -->
      <circle cx="60" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="60" y="113" font-size="9" text-anchor="middle" font-weight="700">1</text>
      
      <circle cx="180" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="180" y="113" font-size="9" text-anchor="middle" font-weight="700">2</text>
      
      <circle cx="300" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="300" y="113" font-size="9" text-anchor="middle" font-weight="700">3</text>
      
      <circle cx="420" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="420" y="113" font-size="9" text-anchor="middle" font-weight="700">4</text>
      
      <!-- Step labels -->
      <text x="60" y="132" font-size="9" text-anchor="middle" fill="#88">Stand</text>
      <text x="180" y="132" font-size="9" text-anchor="middle" fill="#88">One Knee Down</text>
      <text x="300" y="132" font-size="9" text-anchor="middle" fill="#88">Kneel</text>
      <text x="420" y="132" font-size="9" text-anchor="middle" font-weight="700" fill="#E8526A">Vajrasana</text>

      <!-- 1. Standing Fig -->
      <g transform="translate(40, 10)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 52" stroke="#222" stroke-width="2" fill="none"/>
        <!-- Red Top -->
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <line x1="20" y1="30" x2="16" y2="48" stroke="#222" stroke-width="2"/>
        <!-- Legs (Purple) -->
        <path d="M 18 52 L 16 85" stroke="#6C5CE7" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M 22 52 L 24 85" stroke="#6C5CE7" stroke-width="2.5" stroke-linecap="round"/>
      </g>

      <!-- 2. One Knee Down Fig -->
      <g transform="translate(160, 15)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 50" stroke="#222" stroke-width="2"/>
        <!-- Red Top -->
        <path d="M 16 27 C 16 27, 14 36, 16 46 L 24 46 C 26 36, 24 27, 24 27 Z" fill="#FF5252"/>
        <line x1="20" y1="30" x2="16" y2="46" stroke="#222" stroke-width="2"/>
        <!-- Bent legs -->
        <path d="M 18 50 L 8 62 L 8 80" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 22 50 L 30 62 L 32 80" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <!-- 3. Kneeling Fig -->
      <g transform="translate(280, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 48" stroke="#222" stroke-width="2"/>
        <!-- Red Top -->
        <path d="M 16 27 C 16 27, 14 35, 16 44 L 24 44 C 26 35, 24 27, 24 27 Z" fill="#FF5252"/>
        <line x1="20" y1="30" x2="18" y2="44" stroke="#222" stroke-width="2"/>
        <!-- Kneeling both legs -->
        <path d="M 20 48 L 20 65 L 5 75" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <!-- 4. Vajrasana Fig -->
      <g transform="translate(400, 26)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 45" stroke="#222" stroke-width="2"/>
        <!-- Red Top -->
        <path d="M 16 27 C 16 27, 14 33, 16 40 L 24 40 C 26 33, 24 27, 24 27 Z" fill="#FF5252"/>
        <line x1="20" y1="30" x2="28" y2="45" stroke="#222" stroke-width="2" stroke-linecap="round"/>
        <!-- Sat on heels -->
        <path d="M 20 45 Q 35 48 35 62 L 10 69 L 5 62 Z" fill="#6C5CE7" stroke="#222" stroke-width="1.5" stroke-linejoin="round"/>
      </g>
    </svg>`
  },
  balasana: {
    title: "Balasana (Child's Pose) 🧘",
    benefit: "Stretches Lower Back & Relaxes Abdomen",
    desc: "A resting pose that compresses the lower belly area gently, relieving uterine cramps and elongating back muscles.",
    steps: [
      "Sit in Vajrasana on your heels.",
      "Take a deep breath and extend your spine upward.",
      "Exhale and fold your torso forward over your thighs.",
      "Rest your forehead on the floor and extend your arms forward."
    ],
    image: "https://media.giphy.com/media/U8q8JdO559kX1dJ35M/giphy.gif",
    svg: `<svg viewBox="0 0 500 150" class="yoga-svg-art" width="100%" height="100%">
      <rect x="5" y="5" width="490" height="140" rx="12" fill="#FFF0F2" stroke="#FFF0F2" stroke-width="1.5"/>
      <line x1="60" y1="110" x2="440" y2="110" stroke="#D0D0D0" stroke-width="1.5" stroke-dasharray="3 3"/>
      
      <!-- Numbered indicators -->
      <circle cx="60" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="60" y="113" font-size="9" text-anchor="middle" font-weight="700">1</text>
      
      <circle cx="250" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="250" y="113" font-size="9" text-anchor="middle" font-weight="700">2</text>
      
      <circle cx="420" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="420" y="113" font-size="9" text-anchor="middle" font-weight="700">3</text>
      
      <!-- Labels -->
      <text x="60" y="132" font-size="9" text-anchor="middle" fill="#88">Kneel Upright</text>
      <text x="250" y="132" font-size="9" text-anchor="middle" fill="#88">Hinge Forward</text>
      <text x="420" y="132" font-size="9" text-anchor="middle" font-weight="700" fill="#E8526A">Balasana</text>

      <!-- 1. Kneeling Upright -->
      <g transform="translate(40, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 48" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 35, 16 44 L 24 44 C 26 35, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 20 48 L 20 65 L 5 75" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>

      <!-- 2. Hinging Forward -->
      <g transform="translate(230, 28)">
        <path d="M 10 12 Q 4 14 6 22" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="15" cy="12" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 15 19 L 28 35" stroke="#222" stroke-width="2.5"/>
        <path d="M 28 35 L 35 55 L 15 65" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>

      <!-- 3. Folded Balasana -->
      <g transform="translate(390, 42)">
        <circle cx="50" cy="40" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 10 50 Q 25 22 45 40" stroke="#6C5CE7" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9"/>
        <path d="M 45 40 L 70 48" stroke="#222" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg>`
  },
  butterfly: {
    title: "Baddha Konasana (Butterfly Pose) 🧘",
    benefit: "Opens Pelvis & Stimulates Ovaries",
    desc: "Opens the inner thighs and pelvic region, increasing blood flow to the reproductive organs to relieve deep cramp throbbing.",
    steps: [
      "Sit with legs stretched straight forward.",
      "Bend your knees and draw soles of feet together near pelvis.",
      "Clasp your feet firmly with both hands.",
      "Gently flap knees up and down while keeping spine straight."
    ],
    image: "https://media.giphy.com/media/26mkaHWJglqMIsLqE/giphy.gif",
    svg: `<svg viewBox="0 0 500 150" class="yoga-svg-art" width="100%" height="100%">
      <rect x="5" y="5" width="490" height="140" rx="12" fill="#FFF0F2" stroke="#FFF0F2" stroke-width="1.5"/>
      <line x1="60" y1="110" x2="440" y2="110" stroke="#D0D0D0" stroke-width="1.5" stroke-dasharray="3 3"/>
      
      <!-- Numbered indicators -->
      <circle cx="60" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="60" y="113" font-size="9" text-anchor="middle" font-weight="700">1</text>
      
      <circle cx="250" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="250" y="113" font-size="9" text-anchor="middle" font-weight="700">2</text>
      
      <circle cx="420" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="420" y="113" font-size="9" text-anchor="middle" font-weight="700">3</text>
      
      <!-- Labels -->
      <text x="60" y="132" font-size="9" text-anchor="middle" fill="#88">Staff Pose</text>
      <text x="250" y="132" font-size="9" text-anchor="middle" fill="#88">Bend Knees</text>
      <text x="420" y="132" font-size="9" text-anchor="middle" font-weight="700" fill="#E8526A">Baddha Konasana</text>

      <!-- 1. Staff Pose -->
      <g transform="translate(40, 20)">
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 55" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 20 55 L 50 55" stroke="#6C5CE7" stroke-width="2.5" stroke-linecap="round"/>
      </g>

      <!-- 2. Bend Knees -->
      <g transform="translate(230, 20)">
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 55" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 20 55 Q 35 40 40 55" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>

      <!-- 3. Butterfly Pose -->
      <g transform="translate(400, 20)">
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 55" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 20 55 Q 5 45 20 55" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M 20 55 Q 35 45 20 55" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>
    </svg>`
  },
  catcow: {
    title: "Cat-Cow Pose (Marjaryasana) 🧘",
    benefit: "Spinal Mobilization & Uterine Stretch",
    desc: "Stretches and tones the uterine muscles and spine, relieving congestion and tightness in the lumbar spine area.",
    steps: [
      "Get on hands and knees in tabletop position.",
      "Inhale, dip belly down, lift chest and head up (Cow).",
      "Exhale, arch spine up toward ceiling, tuck chin to chest (Cat).",
      "Flow between both shapes matching your breath."
    ],
    image: "https://media.giphy.com/media/5O2J8EXCZ41S3nJ2sF/giphy.gif",
    svg: `<svg viewBox="0 0 500 150" class="yoga-svg-art" width="100%" height="100%">
      <rect x="5" y="5" width="490" height="140" rx="12" fill="#FFF0F2" stroke="#FFF0F2" stroke-width="1.5"/>
      <line x1="60" y1="110" x2="440" y2="110" stroke="#D0D0D0" stroke-width="1.5" stroke-dasharray="3 3"/>
      
      <!-- Numbered indicators -->
      <circle cx="60" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="60" y="113" font-size="9" text-anchor="middle" font-weight="700">1</text>
      
      <circle cx="250" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="250" y="113" font-size="9" text-anchor="middle" font-weight="700">2</text>
      
      <circle cx="420" cy="110" r="8" fill="#FFF" stroke="#222" stroke-width="1.5"/>
      <text x="420" y="113" font-size="9" text-anchor="middle" font-weight="700">3</text>
      
      <!-- Labels -->
      <text x="60" y="132" font-size="9" text-anchor="middle" fill="#88">Tabletop</text>
      <text x="250" y="132" font-size="9" text-anchor="middle" fill="#88">Cow Pose (Inhale)</text>
      <text x="420" y="132" font-size="9" text-anchor="middle" font-weight="700" fill="#E8526A">Cat Pose (Exhale)</text>
 
      <!-- 1. Tabletop -->
      <g transform="translate(20, 30)">
        <circle cx="50" cy="25" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 15 50 Q 30 38 45 42" stroke="#6C5CE7" stroke-width="5" fill="none" stroke-linecap="round"/>
        <line x1="15" y1="50" x2="15" y2="72" stroke="#222" stroke-width="2"/>
        <line x1="45" y1="42" x2="45" y2="72" stroke="#222" stroke-width="2"/>
      </g>
 
      <!-- 2. Cow Pose -->
      <g transform="translate(200, 30)">
        <circle cx="50" cy="18" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 15 50 Q 30 46 45 42" stroke="#6C5CE7" stroke-width="5" fill="none" stroke-linecap="round"/>
        <line x1="15" y1="50" x2="15" y2="72" stroke="#222" stroke-width="2"/>
        <line x1="45" y1="42" x2="45" y2="72" stroke="#222" stroke-width="2"/>
      </g>
 
      <!-- 3. Cat Pose -->
      <g transform="translate(370, 30)">
        <circle cx="50" cy="32" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 15 50 Q 30 22 45 42" stroke="#6C5CE7" stroke-width="5" fill="none" stroke-linecap="round"/>
        <line x1="15" y1="50" x2="15" y2="72" stroke="#222" stroke-width="2"/>
        <line x1="45" y1="42" x2="45" y2="72" stroke="#222" stroke-width="2"/>
      </g>
    </svg>`
  }
};

function initYogaComfort() {
  currentYogaPose = 'vajrasana';
  renderYogaPose();
}

function renderYogaPose() {
  const pose = yogaPoses[currentYogaPose];
  document.getElementById('yoga-pose-title').innerText = pose.title;
  document.getElementById('yoga-pose-benefit').innerText = pose.benefit;
  document.getElementById('yoga-pose-desc').innerText = pose.desc;
  
  const display = document.getElementById('yoga-svg-display');
  if (display) {
    if (yogaVisualMode === 'vector') {
      display.innerHTML = pose.svg;
    } else {
      display.innerHTML = getEmbedOrImageHtml(pose.image, pose.title);
    }
  }

  const stepsList = document.getElementById('yoga-pose-steps');
  if (stepsList) {
    stepsList.innerHTML = pose.steps.map(step => `<li>${step}</li>`).join('');
  }

  // Toggle button active classes
  document.querySelectorAll('.yoga-controls button').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`btn-yoga-${currentYogaPose}`);
  if (activeBtn) activeBtn.classList.add('active');
}

function switchYogaPose(poseName) {
  currentYogaPose = poseName;
  renderYogaPose();
}

// --- 18. BSE EXAM LOG TRACKING ---
function renderBseLogs() {
  const list = document.getElementById('bse-logs-list');
  if (!list) return;
  
  const logs = sessionData.bseLogs || [];
  if (logs.length === 0) {
    list.innerHTML = `<p style="font-size: 0.82rem; color: var(--soft); text-align: center;">No exam logs found. Start logging monthly! 🌸</p>`;
    return;
  }

  list.innerHTML = logs.map(log => {
    let badgeClass = 'status-normal';
    let label = 'Normal 🌸';
    if (log.findings !== 'normal') {
      badgeClass = 'status-high';
      label = log.findings === 'pain' ? 'Tenderness 🤕' : (log.findings === 'lump' ? 'Lump ⚠️' : 'Discharge ⚠️');
    }
    return `
      <div class="bse-log-item" style="background: var(--cream); border: 1px solid var(--border); padding: 1rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <span style="font-size: 0.72rem; font-weight: 700; color: var(--soft);">${log.date}</span>
          <p style="font-size: 0.88rem; color: var(--charcoal); font-weight: 500; margin-top: 0.1rem;">${log.notes || 'No notes added'}</p>
        </div>
        <span class="analysis-status ${badgeClass}" style="font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 10px; text-transform: uppercase;">
          ${label}
        </span>
      </div>
    `;
  }).join('');
}

async function submitBseLog() {
  const dateVal = document.getElementById('bse-log-date').value;
  const findVal = document.getElementById('bse-log-findings').value;
  const notesVal = document.getElementById('bse-log-notes').value.trim();

  if (!dateVal) {
    alert("Please select a date for the breast exam log!");
    return;
  }

  if (!sessionData.bseLogs) sessionData.bseLogs = [];

  const newLog = {
    id: 'bse-' + Date.now(),
    date: dateVal,
    findings: findVal,
    notes: notesVal
  };

  sessionData.bseLogs.unshift(newLog);
  renderBseLogs();
  await syncSessionState();

  document.getElementById('bse-log-notes').value = "";
  
  if (findVal !== 'normal') {
    alert("Warning finding registered. For safety, we recommend medical evaluation. We will open the Doctor Finder page for you to locate specialized female gynecologists in your area. 🌸");
    showPage('doctor');
  } else {
    awardBadge("🎗️ Breast Safety Advocate");
    alert("Breast self-examination logged successfully! Keep checking monthly. 🌸");
  }
}

// --- 19. DAILY HEALTH & MOBILITY EXERCISES ---
let currentTrainerExercise = 'squats';
const trainerExercises = {
  squats: {
    title: "Gentle Bodyweight Squats 🏃‍♀️",
    benefit: "Strengthens pelvic floor & stabilizes insulin levels.",
    gif: "https://media.giphy.com/media/GVEyJmILvn6vrvsSNaz/giphy.gif",
    svg: `<svg viewBox="0 0 500 150" class="trainer-svg-art" width="100%" height="100%">
      <rect x="5" y="5" width="490" height="140" rx="12" fill="#E8F5E9" stroke="#E8F5E9" stroke-width="1.5"/>
      <line x1="60" y1="110" x2="440" y2="110" stroke="#C8E6C9" stroke-width="1.5" stroke-dasharray="3 3"/>
      
      <!-- Numbered indicators -->
      <circle cx="60" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="60" y="113" font-size="9" text-anchor="middle" font-weight="700">1</text>
      
      <circle cx="250" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="250" y="113" font-size="9" text-anchor="middle" font-weight="700">2</text>
      
      <circle cx="420" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="420" y="113" font-size="9" text-anchor="middle" font-weight="700">3</text>
      
      <!-- Labels -->
      <text x="60" y="132" font-size="9" text-anchor="middle" fill="#666">Stand</text>
      <text x="250" y="132" font-size="9" text-anchor="middle" fill="#666">Half Squat</text>
      <text x="420" y="132" font-size="9" text-anchor="middle" font-weight="700" fill="#2E7D32">Full Squat</text>

      <!-- 1. Stand -->
      <g transform="translate(40, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 52" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 52 L 18 80" stroke="#6C5CE7" stroke-width="2.5"/>
        <path d="M 22 52 L 22 80" stroke="#6C5CE7" stroke-width="2.5"/>
      </g>

      <!-- 2. Half Squat -->
      <g transform="translate(230, 26)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 48" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 36, 16 44 L 24 44 C 26 36, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 48 L 10 58 L 10 74" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 22 48 L 30 58 L 30 74" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="20" y1="32" x2="35" y2="32" stroke="#222" stroke-width="2"/>
      </g>

      <!-- 3. Full Squat -->
      <g transform="translate(400, 32)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 42" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 32, 16 38 L 24 38 C 26 32, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 42 L 5 48 L 15 68" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 22 42 L 35 48 L 25 68" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="20" y1="30" x2="40" y2="30" stroke="#222" stroke-width="2"/>
      </g>
    </svg>`,
    steps: [
      "Stand straight with feet slightly wider than shoulder-width apart.",
      "Bend your knees and lower your hips down as if sitting in an imaginary chair.",
      "Keep your chest upright, spine neutral, and knees behind your toes.",
      "Push through your heels to return to standing. Perform 10-12 gentle reps."
    ]
  },
  stretch: {
    title: "Standing Hamstring Stretch 🏃‍♀️",
    benefit: "Releases lower back tightness and improves flexibility.",
    gif: "https://media.giphy.com/media/3o7TKoWXmFHyN3N3Ny/giphy.gif",
    svg: `<svg viewBox="0 0 500 150" class="trainer-svg-art" width="100%" height="100%">
      <rect x="5" y="5" width="490" height="140" rx="12" fill="#E8F5E9" stroke="#E8F5E9" stroke-width="1.5"/>
      <line x1="60" y1="110" x2="440" y2="110" stroke="#C8E6C9" stroke-width="1.5" stroke-dasharray="3 3"/>
      
      <!-- Numbered indicators -->
      <circle cx="60" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="60" y="113" font-size="9" text-anchor="middle" font-weight="700">1</text>
      
      <circle cx="250" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="250" y="113" font-size="9" text-anchor="middle" font-weight="700">2</text>
      
      <circle cx="420" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="420" y="113" font-size="9" text-anchor="middle" font-weight="700">3</text>
      
      <!-- Labels -->
      <text x="60" y="132" font-size="9" text-anchor="middle" fill="#666">Stand Neutral</text>
      <text x="250" y="132" font-size="9" text-anchor="middle" fill="#666">Heel Forward</text>
      <text x="420" y="132" font-size="9" text-anchor="middle" font-weight="700" fill="#2E7D32">Hinge & Stretch</text>

      <!-- 1. Stand Neutral -->
      <g transform="translate(40, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 52" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 52 L 18 80" stroke="#6C5CE7" stroke-width="2.5"/>
        <path d="M 22 52 L 22 80" stroke="#6C5CE7" stroke-width="2.5"/>
      </g>

      <!-- 2. Heel Forward -->
      <g transform="translate(230, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 52" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 52 L 5 70 L 0 80" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M 22 52 L 22 80" stroke="#6C5CE7" stroke-width="2.5"/>
      </g>

      <!-- 3. Hinge and Stretch -->
      <g transform="translate(390, 26)">
        <path d="M 10 12 Q 4 14 6 22" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="15" cy="12" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 15 19 L 28 35" stroke="#222" stroke-width="2.5"/>
        <path d="M 28 35 L 5 50 M 28 35 L 35 65 L 15 75" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>
    </svg>`,
    steps: [
      "Extend one leg forward with your heel on the ground and toes pointing up.",
      "Hinge at your hips and gently lean your torso forward.",
      "Keep your back straight and rest your hands on your bent thigh for support.",
      "Hold the stretch for 20-30 seconds, then switch legs. Do not bounce."
    ]
  },
  rolls: {
    title: "Shoulder & Neck Rolls 🏃‍♀️",
    benefit: "Releases upper body stress and relieves desk fatigue.",
    gif: "https://media.giphy.com/media/lT4z3OQYk3WJ3sL7gR/giphy.gif",
    svg: `<svg viewBox="0 0 500 150" class="trainer-svg-art" width="100%" height="100%">
      <rect x="5" y="5" width="490" height="140" rx="12" fill="#E8F5E9" stroke="#E8F5E9" stroke-width="1.5"/>
      <line x1="60" y1="110" x2="440" y2="110" stroke="#C8E6C9" stroke-width="1.5" stroke-dasharray="3 3"/>
      
      <!-- Numbered indicators -->
      <circle cx="60" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="60" y="113" font-size="9" text-anchor="middle" font-weight="700">1</text>
      
      <circle cx="250" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="250" y="113" font-size="9" text-anchor="middle" font-weight="700">2</text>
      
      <circle cx="420" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="420" y="113" font-size="9" text-anchor="middle" font-weight="700">3</text>
      
      <!-- Labels -->
      <text x="60" y="132" font-size="9" text-anchor="middle" fill="#666">Neutral Setup</text>
      <text x="250" y="132" font-size="9" text-anchor="middle" fill="#666">Shrug Up</text>
      <text x="420" y="132" font-size="9" text-anchor="middle" font-weight="700" fill="#2E7D32">Roll Back</text>

      <!-- 1. Neutral Setup -->
      <g transform="translate(40, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 52" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 52 L 18 80" stroke="#6C5CE7" stroke-width="2.5"/>
        <path d="M 22 52 L 22 80" stroke="#6C5CE7" stroke-width="2.5"/>
      </g>

      <!-- 2. Shrug Up -->
      <g transform="translate(230, 20)">
        <path d="M 15 17 Q 8 19 10 29" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="17" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 24 L 20 52" stroke="#222" stroke-width="2"/>
        <!-- Shrugged shoulders top -->
        <path d="M 14 27 C 14 27, 12 34, 16 48 L 24 48 C 28 34, 26 27, 26 27 Z" fill="#FF5252"/>
        <path d="M 18 52 L 18 80" stroke="#6C5CE7" stroke-width="2.5"/>
        <path d="M 22 52 L 22 80" stroke="#6C5CE7" stroke-width="2.5"/>
      </g>

      <!-- 3. Roll Back -->
      <g transform="translate(400, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 52" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 52 L 18 80" stroke="#6C5CE7" stroke-width="2.5"/>
        <path d="M 22 52 L 22 80" stroke="#6C5CE7" stroke-width="2.5"/>
        <!-- Circle indicator on shoulders -->
        <circle cx="20" cy="34" r="9" fill="none" stroke="#FF5252" stroke-width="1.5" stroke-dasharray="2 2"/>
      </g>
    </svg>`,
    steps: [
      "Stand or sit upright with your shoulders relaxed.",
      "Roll your shoulders slowly backward in smooth circles 10 times, then forward 10 times.",
      "Gently tilt your head to bring your ear toward your shoulder, holding for 10 seconds.",
      "Repeat on the opposite side to release tension."
    ]
  },
  marching: {
    title: "Brisk Low-Impact Marching 🏃‍♀️",
    benefit: "Improves overall circulation and boosts insulin response.",
    gif: "https://media.giphy.com/media/5e3h2S2YQ04q26F22L/giphy.gif",
    svg: `<svg viewBox="0 0 500 150" class="trainer-svg-art" width="100%" height="100%">
      <rect x="5" y="5" width="490" height="140" rx="12" fill="#E8F5E9" stroke="#E8F5E9" stroke-width="1.5"/>
      <line x1="60" y1="110" x2="440" y2="110" stroke="#C8E6C9" stroke-width="1.5" stroke-dasharray="3 3"/>
      
      <!-- Numbered indicators -->
      <circle cx="60" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="60" y="113" font-size="9" text-anchor="middle" font-weight="700">1</text>
      
      <circle cx="250" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="250" y="113" font-size="9" text-anchor="middle" font-weight="700">2</text>
      
      <circle cx="420" cy="110" r="8" fill="#FFF" stroke="#2E7D32" stroke-width="1.5"/>
      <text x="420" y="113" font-size="9" text-anchor="middle" font-weight="700">3</text>
      
      <!-- Labels -->
      <text x="60" y="132" font-size="9" text-anchor="middle" fill="#666">Stand Neutral</text>
      <text x="250" y="132" font-size="9" text-anchor="middle" fill="#666">Lift Left Knee</text>
      <text x="420" y="132" font-size="9" text-anchor="middle" font-weight="700" fill="#2E7D32">Lift Right Knee</text>

      <!-- 1. Stand Neutral -->
      <g transform="translate(40, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 52" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 52 L 18 80" stroke="#6C5CE7" stroke-width="2.5"/>
        <path d="M 22 52 L 22 80" stroke="#6C5CE7" stroke-width="2.5"/>
      </g>

      <!-- 2. Lift Left Knee -->
      <g transform="translate(230, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 52" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 52 L 8 68 L 8 80" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M 22 52 L 22 80" stroke="#6C5CE7" stroke-width="2.5"/>
      </g>

      <!-- 3. Lift Right Knee -->
      <g transform="translate(400, 20)">
        <path d="M 15 20 Q 8 22 10 32" stroke="#222" stroke-width="2.5" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#FCD7B8" stroke="#222" stroke-width="1.5"/>
        <path d="M 20 27 L 20 52" stroke="#222" stroke-width="2"/>
        <path d="M 16 27 C 16 27, 14 38, 16 48 L 24 48 C 26 38, 24 27, 24 27 Z" fill="#FF5252"/>
        <path d="M 18 52 L 18 80" stroke="#6C5CE7" stroke-width="2.5"/>
        <path d="M 22 52 L 32 68 L 32 80" stroke="#6C5CE7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>
    </svg>`,
    steps: [
      "March in place, lifting your knees up toward your waist.",
      "Pump your arms back and forth in rhythm with your marching.",
      "Keep your core engaged and breath steady.",
      "Continue for 2-3 minutes. Great as a quick midday activity boost!"
    ]
  }
};

function initTrainerExercises() {
  currentTrainerExercise = 'squats';
  renderTrainerExercise();
}

function renderTrainerExercise() {
  const ex = trainerExercises[currentTrainerExercise];
  const titleEl = document.getElementById('trainer-ex-title');
  const benefitEl = document.getElementById('trainer-ex-benefit');
  const stepsEl = document.getElementById('trainer-ex-steps');
  const displayEl = document.getElementById('trainer-gif-display');
  
  if (titleEl) titleEl.innerText = ex.title;
  if (benefitEl) benefitEl.innerText = ex.benefit;
  if (stepsEl) {
    stepsEl.innerHTML = ex.steps.map(step => `<li>${step}</li>`).join('');
  }
  if (displayEl) {
    if (trainerVisualMode === 'vector') {
      displayEl.innerHTML = ex.svg;
    } else {
      displayEl.innerHTML = getEmbedOrImageHtml(ex.gif, ex.title);
    }
  }
  
  // Toggle button active classes
  document.querySelectorAll('.trainer-exercise-controls button').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`btn-trainer-${currentTrainerExercise}`);
  if (activeBtn) activeBtn.classList.add('active');
}

function switchTrainerExercise(exName) {
  currentTrainerExercise = exName;
  renderTrainerExercise();
}



