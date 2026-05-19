(() => {
  "use strict";

  const DB_NAME = "nimbus-nook-db";
  const DB_VERSION = 1;
  const SESSION_KEY = "nimbus-nook-session";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const state = {
    db: null,
    authMode: "login",
    user: null,
    selectedTriggers: new Set(),
    calmStep: 0,
    journalPages: [],
    currentPage: null,
    selectedSticker: null,
    quizId: "weather",
    quizAnswers: {},
    breath: {
      running: false,
      timer: null,
      phaseIndex: 0,
      remaining: 0,
      cycle: 0
    },
    audio: {
      ctx: null,
      master: null,
      padGain: null,
      filter: null,
      beatTimer: null,
      oscillators: []
    },
    saveTimer: null
  };

  const triggers = [
    "uncertainty",
    "social pressure",
    "health worry",
    "money",
    "too much noise",
    "deadlines",
    "conflict",
    "sleep",
    "change",
    "messy space",
    "body sensations",
    "news"
  ];

  const calmSteps = [
    "Drop your shoulders and unclench your jaw.",
    "Name five colors you can see from where you are.",
    "Press your feet into the floor for one slow exhale.",
    "Place one hand on your chest and one on your belly.",
    "Choose the smallest next action, then make it smaller."
  ];

  const infoText = {
    body:
      "Anxiety can show up as a racing heart, tight chest, hot face, shaky hands, nausea, or restless energy. The goal is not to force it away; the goal is to signal safety to your body in small, repeatable ways.",
    thoughts:
      "An anxious mind often scans for danger, certainty, and control. Try labeling thoughts as predictions, not facts. Then ask: what is one grounded piece of evidence I have right now?",
    actions:
      "Avoidance can feel soothing for a moment and still make the fear grow later. Tiny brave actions, paired with recovery time, help your nervous system learn that you can move through discomfort."
  };

  const breathPatterns = [
    {
      id: "coherent",
      name: "Coherent cloud",
      description: "A steady 5-in, 5-out rhythm for settling the nervous system.",
      phases: [
        { key: "inhale", label: "Inhale", seconds: 5, prompt: "Breathe in as the cloud rises." },
        { key: "exhale", label: "Exhale", seconds: 5, prompt: "Breathe out and let your shoulders melt." }
      ]
    },
    {
      id: "box",
      name: "Box breath",
      description: "Four equal sides: inhale, hold, exhale, pause.",
      phases: [
        { key: "inhale", label: "Inhale", seconds: 4, prompt: "Inhale, tracing the first side." },
        { key: "hold", label: "Hold", seconds: 4, prompt: "Hold gently. No strain." },
        { key: "exhale", label: "Exhale", seconds: 4, prompt: "Exhale, tracing the third side." },
        { key: "hold", label: "Pause", seconds: 4, prompt: "Pause and soften your face." }
      ]
    },
    {
      id: "soft-478",
      name: "Soft 4-7-8",
      description: "A gentler version of 4-7-8 with a long, quiet exhale.",
      phases: [
        { key: "inhale", label: "Inhale", seconds: 4, prompt: "Inhale through your nose if that feels okay." },
        { key: "hold", label: "Hold", seconds: 7, prompt: "Hold lightly, like holding a feather." },
        { key: "exhale", label: "Exhale", seconds: 8, prompt: "Exhale slowly through relaxed lips." }
      ]
    },
    {
      id: "panic-sigh",
      name: "Double-sigh reset",
      description: "Two small inhales and one longer exhale for high-intensity moments.",
      phases: [
        { key: "inhale", label: "Sip in", seconds: 2, prompt: "Take a small sip of air." },
        { key: "inhale", label: "Sip again", seconds: 2, prompt: "Add one tiny top-up inhale." },
        { key: "exhale", label: "Long exhale", seconds: 6, prompt: "Let the air fall out slowly." },
        { key: "hold", label: "Rest", seconds: 2, prompt: "Rest before the next round." }
      ]
    }
  ];

  const journalTemplates = [
    ["Worry Parking Lot", "Park each worry here, then choose what actually needs action today.", ["The worry says...", "What is mine to do?", "What can wait until tomorrow?"]],
    ["Evidence Lantern", "Separate anxious predictions from what you know right now.", ["Prediction", "Evidence for", "Evidence against", "More balanced thought"]],
    ["Body Weather Report", "Track sensations without making them emergencies.", ["Where do I feel activation?", "Temperature, pressure, movement", "One comfort cue"]],
    ["Tiny Brave Step", "Design a step so small your nervous system can try it.", ["Fear story", "Smallest step", "Reward after"]],
    ["Reassurance Budget", "Reduce repetitive checking with care, not shame.", ["What I want to ask", "What I already know", "Delay plan"]],
    ["Panic Debrief", "Look back after a spike and collect proof that it passed.", ["What started it?", "Peak intensity", "What helped even 1%?"]],
    ["Safe Place Sketch", "Build a sensory refuge in words and stickers.", ["What I see", "What I hear", "What I feel", "What protects this place"]],
    ["Future Me Note", "Let a steadier version of you speak kindly.", ["Dear current me", "This feeling is...", "The next kind thing is..."]],
    ["Intrusive Thought Cloud", "Practice letting sticky thoughts pass without debate.", ["Thought headline", "Label", "Let it float by because..."]],
    ["Social Aftercare", "Recover after people-time without replaying everything.", ["What went okay", "What I am replaying", "What I choose to release"]],
    ["Decision Fog", "Make choices less spiky.", ["Options", "Values involved", "Good-enough choice", "Review date"]],
    ["Sleep Landing Page", "Unload the day before bed.", ["Unfinished loops", "Tomorrow container", "Bedtime kindness"]],
    ["Morning Nervous System Menu", "Pick the first support before the day gets loud.", ["Today may ask of me", "I can support myself with", "First 10 minutes"]],
    ["Trigger Detective", "Find patterns without blaming yourself.", ["Situation", "Meaning my brain made", "Need underneath"]],
    ["Boundary Practice", "Script a small no, pause, or request.", ["What I need", "Kind sentence", "Backup sentence"]],
    ["Values Anchor", "Reconnect to what matters under the fear.", ["Fear wants me to", "My value says", "One aligned action"]],
    ["Sensory Inventory", "Build a menu of calming inputs.", ["Soft", "Warm", "Weighted", "Sound", "Scent"]],
    ["Gratitude Without Pressure", "Notice small okay things without forcing positivity.", ["One tolerable thing", "One helpful person/place", "One moment I survived"]],
    ["What If Ladder", "Climb down from catastrophe to coping.", ["What if...", "Then I could...", "And I would ask..."]],
    ["Control Circles", "Sort control, influence, and release.", ["I control", "I influence", "I release for now"]],
    ["Self-Compassion Break", "Talk to yourself like someone worth caring for.", ["This is hard because", "Other humans feel this too", "May I offer myself"]],
    ["Racing Thoughts Inbox", "Collect mental tabs so they stop shouting.", ["Task", "Worry", "Idea", "Later list"]],
    ["Calm Evidence Album", "Proof that calm has happened before.", ["A past hard moment", "What I did", "What that proves"]],
    ["Exposure Ladder", "Plan gradual practice with recovery.", ["Goal", "Step 1", "Step 2", "Step 3", "Recovery"]],
    ["Health Anxiety Check", "Slow the urge to scan and search.", ["Sensation", "Benign possibilities", "When I will seek care", "What I will not repeat"]],
    ["Unsent Message", "Express feelings safely without sending.", ["What I want to say", "What I need", "What can stay private"]],
    ["Critic Translator", "Turn inner criticism into a need.", ["Critic says", "It is trying to protect me from", "Kinder translation"]],
    ["Overwhelm Triage", "Choose the next doable thing.", ["Urgent", "Important", "Can wait", "Can ask for help"]],
    ["Pocket Script", "Write a phrase for a difficult moment.", ["When this happens", "I can say", "Then I can do"]],
    ["Comfort Vault", "Store dependable soothing ideas.", ["Media", "Food/drink", "Texture", "Person", "Place"]],
    ["Rumination Exit Ramp", "Move from replaying to re-entering now.", ["Loop topic", "Signal to stop", "Present action"]],
    ["Courage Receipt", "Give yourself credit for invisible work.", ["Today I did", "It mattered because", "I want to remember"]],
    ["Nervous System Needs", "Name the state and match the support.", ["Fight/flight/freeze/fawn", "Clue", "Support"]],
    ["Appointment Prep", "Reduce medical or therapy appointment dread.", ["Questions", "Symptoms", "What I need them to know"]],
    ["Study or Work Spiral", "Unstick performance anxiety.", ["Task", "First ugly draft step", "Timer length", "Done enough means"]],
    ["Travel Calm Plan", "Prepare anchors for leaving home.", ["Route", "Comfort items", "If panic rises", "Return plan"]],
    ["Money Worry Sorter", "Give financial fear a container.", ["Number I know", "Number I need", "Next admin step"]],
    ["Conflict Cooldown", "Separate heat from message.", ["What happened", "What I felt", "What I need", "When to respond"]],
    ["Perfectionism Loosener", "Aim for useful instead of flawless.", ["Standard I am chasing", "Cost", "Good-enough version"]],
    ["After Nightmare Reset", "Return to present after a rough dream.", ["Dream residue", "Present facts", "Body comfort"]],
    ["Hormone/Body Cycle Notes", "Notice body-linked anxiety patterns.", ["Cycle/body context", "Mood", "Support that fits"]],
    ["Screen Detox Plan", "Create a softer relationship with feeds.", ["App/site", "Feeling after", "Limit", "Replacement"]],
    ["Friendship Check", "Sort connection anxiety.", ["Story I am telling", "Other explanations", "Kind reach-out"]],
    ["Creative Calm", "Use making as regulation.", ["Color", "Shape", "Texture", "What it expresses"]],
    ["Identity Safety", "Feel real and safe in who you are.", ["Place I mask", "Place I soften", "Tiny true expression"]],
    ["Cleaning Micro-Quest", "Make space care less overwhelming.", ["One surface", "Five items", "Reset reward"]],
    ["Food and Anxiety", "Notice hunger, caffeine, and comfort with kindness.", ["Fuel today", "Caffeine", "Body asks for"]],
    ["Weathering Grief", "Hold anxiety mixed with loss.", ["What I miss", "What still connects me", "One tender ritual"]],
    ["Sensory Shutdown Card", "Plan for low-capacity moments.", ["Signals", "Reduce input", "Safe message to send"]],
    ["Public Place Plan", "Carry calm into outside spaces.", ["Exit", "Anchor object", "Grounding cue", "Support text"]],
    ["Creative Exposure Story", "Write yourself succeeding imperfectly.", ["Scene", "Obstacle", "I cope by", "Ending"]],
    ["Compliment Keeper", "Save kind words for future doubt.", ["What was said", "Who said it", "Why I can let it count"]],
    ["Re-entry After Avoidance", "Come back gently.", ["What I avoided", "No-shame reason", "Small return step"]],
    ["Medication/Support Notes", "Track questions for a professional.", ["Effects to discuss", "Questions", "Appointments"]],
    ["Nature Noticing", "Use the outside world as an anchor.", ["Sky", "Plant", "Sound", "Small wonder"]],
    ["Anger Under Anxiety", "Listen for crossed boundaries.", ["Anger says", "Boundary", "Safe expression"]],
    ["Loneliness Bridge", "Make connection less all-or-nothing.", ["Who feels safe", "Low-pressure contact", "Aftercare"]],
    ["Joy Permission Slip", "Let relief exist beside worry.", ["Tiny joy", "Why anxiety objects", "Why I am allowed"]],
    ["End-of-Day Release", "Close loops and let the day be done.", ["Kept", "Learned", "Released", "Tomorrow's first kindness"]],
    ["Cupcake Victory Page", "Celebrate one soft win, Quantum Cupcake style.", ["Soft win", "Sprinkle detail", "How I will honor it"]]
  ].map(([title, description, prompts], index) => ({
    id: index,
    title,
    description,
    prompts
  }));

  const stickers = [
    ["cloud hush", "☁️", "#dff7ff"],
    ["brave spark", "✨", "#fff2b8"],
    ["soft heart", "💗", "#ffd6df"],
    ["moon rest", "🌙", "#e6dcff"],
    ["tiny flower", "🌸", "#ffe0f0"],
    ["warm tea", "🍵", "#d9f2dc"],
    ["shield", "🛡️", "#dbeafe"],
    ["anchor", "⚓", "#d7f4ef"],
    ["rain okay", "🌧️", "#dbeafe"],
    ["sun patch", "☀️", "#ffe7a3"],
    ["music", "🎧", "#e4ecff"],
    ["star note", "⭐", "#fff4b8"],
    ["comfy sock", "🧦", "#f8d9c4"],
    ["leaf", "🍃", "#d7f8d4"],
    ["butterfly", "🦋", "#d9ebff"],
    ["bubble", "🫧", "#dffbff"],
    ["seedling", "🌱", "#dbf5ca"],
    ["soft flame", "🕯️", "#ffe1b5"],
    ["gem thought", "💎", "#e6e7ff"],
    ["letter", "💌", "#ffdbe6"],
    ["mountain", "⛰️", "#dce8dc"],
    ["compass", "🧭", "#f6e3bd"],
    ["check", "✅", "#dbf8e1"],
    ["pause", "⏸️", "#f0e6ff"],
    ["glimmer", "🌟", "#fff0a8"],
    ["cupcake", "🧁", "#ffe1ee"]
  ].map(([label, glyph, color], index) => ({ id: index, label, glyph, color }));

  const quizzes = [
    {
      id: "weather",
      title: "Anxiety Weather",
      blurb: "Find the forecast inside your body and thoughts.",
      feedback: [
        "Light clouds: choose maintenance calm before it piles up.",
        "Windy: your system may want grounding, food, water, or a smaller task.",
        "Stormy: lower demands and use support. You do not have to logic your way out."
      ],
      questions: [
        ["How loud are the thoughts?", ["background hum", 0], ["noticeable loop", 1], ["very sticky", 2], ["all-consuming", 3]],
        ["How is your body acting?", ["mostly settled", 0], ["a bit tense", 1], ["activated", 2], ["panic-level", 3]],
        ["How easy is the next task?", ["clear", 0], ["foggy", 1], ["hard to start", 2], ["impossible right now", 3]],
        ["How much support do you want?", ["I am okay", 0], ["a tool might help", 1], ["I want someone nearby", 2], ["I need help now", 3]]
      ]
    },
    {
      id: "trigger",
      title: "Trigger Mapper",
      blurb: "Spot the kind of trigger without blaming yourself.",
      feedback: [
        "Context trigger: change the environment before debating the fear.",
        "Meaning trigger: try evidence, compassion, and a values anchor.",
        "Capacity trigger: your basics may need care before your thoughts can soften."
      ],
      questions: [
        ["What came first?", ["a place or noise", 0], ["a thought/story", 1], ["hunger/tiredness", 2], ["a body sensation", 2]],
        ["What would help fastest?", ["less input", 0], ["a kinder thought", 1], ["rest/food/water", 2], ["movement", 0]],
        ["What is the fear asking for?", ["escape", 0], ["certainty", 1], ["recovery", 2], ["reassurance", 1]],
        ["What pattern repeats?", ["crowds or clutter", 0], ["what-if loops", 1], ["low sleep days", 2], ["checking my body", 2]]
      ]
    },
    {
      id: "thoughts",
      title: "Thought Pattern Spotter",
      blurb: "Name the mental habit so it loosens a little.",
      feedback: [
        "Prediction mode: answer with probability and coping, not certainty.",
        "Mind-reading mode: collect alternate explanations before reacting.",
        "All-or-nothing mode: look for the useful middle."
      ],
      questions: [
        ["The thought begins with...", ["What if", 0], ["They probably", 1], ["I always/never", 2], ["I cannot handle", 0]],
        ["The thought wants...", ["a guarantee", 0], ["approval", 1], ["perfection", 2], ["escape", 0]],
        ["A balanced reply would include...", ["I can cope", 0], ["I do not know yet", 1], ["Some is enough", 2], ["This can pass", 0]],
        ["Your next tool:", ["evidence lantern", 0], ["friendship check", 1], ["perfectionism loosener", 2], ["breathing", 0]]
      ]
    },
    {
      id: "calm-style",
      title: "Calm Style",
      blurb: "Choose regulation that matches your wiring today.",
      feedback: [
        "Sensory calmer: sound, texture, warmth, and breath may be your quickest door.",
        "Cognitive calmer: scripts, evidence, and planning may help your mind stand down.",
        "Action calmer: movement, brave ladders, and tidy micro-quests may unlock relief."
      ],
      questions: [
        ["When anxious, I crave...", ["blanket/music", 0], ["answers", 1], ["movement", 2], ["a plan", 1]],
        ["What helped before?", ["warm drink", 0], ["writing it out", 1], ["walking", 2], ["cleaning one spot", 2]],
        ["What feels annoying right now?", ["thinking harder", 0], ["sitting still", 2], ["messy uncertainty", 1], ["loud input", 0]],
        ["Pick a reward:", ["soft light", 0], ["clear list", 1], ["fresh air", 2], ["done checkbox", 2]]
      ]
    },
    {
      id: "sleep",
      title: "Sleep Spiral Scan",
      blurb: "Untangle evening anxiety before bed.",
      feedback: [
        "Body wind-down: lower stimulation and use a slow exhale pattern.",
        "Thought unload: park tomorrow in the journal and set a review time.",
        "Safety cue: create a predictable bedtime anchor your brain can recognize."
      ],
      questions: [
        ["At night, the loudest thing is...", ["body energy", 0], ["tomorrow thoughts", 1], ["feeling unsafe", 2], ["phone pull", 0]],
        ["The best first step is...", ["dim lights", 0], ["write loops down", 1], ["comfort object", 2], ["move phone", 0]],
        ["Your mind asks for...", ["slowing", 0], ["certainty", 1], ["protection", 2], ["distraction", 1]],
        ["Choose a closing ritual:", ["coherent breath", 0], ["end-of-day release", 1], ["safe place sketch", 2], ["sleep landing page", 1]]
      ]
    }
  ];

  const groundingFields = [
    ["see", "5 things I can see"],
    ["feel", "4 things I can feel"],
    ["hear", "3 things I can hear"],
    ["smell", "2 things I can smell"],
    ["taste", "1 thing I can taste or imagine tasting"]
  ];

  const bodySuggestions = {
    Head: "Try relaxing your forehead, then look around and name three non-danger facts.",
    Chest: "Place a hand on your chest and lengthen only the exhale for three rounds.",
    Belly: "Sip water or tea, loosen your waistband, and let your belly be unbraced.",
    Hands: "Press thumb to each fingertip slowly, like counting tiny safe moments.",
    Legs: "Push feet into the floor, then release. Repeat until your legs feel noticed.",
    Voice: "Hum one low note or read your anchor phrase out loud."
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    state.db = await openDatabase();
    bindAuth();
    bindNavigation();
    bindHome();
    bindBreathing();
    bindJournal();
    bindToolkit();
    renderStaticPieces();
    await restoreSession();
    registerServiceWorker();
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("users")) {
          db.createObjectStore("users", { keyPath: "id" });
        }
        ["checkins", "journalPages", "quizResults"].forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: "id", autoIncrement: true });
            store.createIndex("userId", "userId", { unique: false });
          }
        });
        if (!db.objectStoreNames.contains("toolkit")) {
          const store = db.createObjectStore("toolkit", { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
        }
      };
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  function getStore(name, mode = "readonly") {
    return state.db.transaction(name, mode).objectStore(name);
  }

  function dbGet(name, key) {
    return requestToPromise(getStore(name).get(key));
  }

  function dbPut(name, value) {
    return requestToPromise(getStore(name, "readwrite").put(value));
  }

  function dbAdd(name, value) {
    return requestToPromise(getStore(name, "readwrite").add(value));
  }

  function dbDelete(name, key) {
    return requestToPromise(getStore(name, "readwrite").delete(key));
  }

  function dbByUser(name, userId) {
    return requestToPromise(getStore(name).index("userId").getAll(userId));
  }

  function normalizeUsername(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function bindAuth() {
    $("#toggleAuthMode").addEventListener("click", () => {
      state.authMode = state.authMode === "login" ? "signup" : "login";
      $("#authSubmit").textContent = state.authMode === "signup" ? "Create my Nook" : "Enter the Nook";
      $("#toggleAuthMode").textContent =
        state.authMode === "signup" ? "I already have a nook" : "Create a new private nook";
      $("#passwordInput").autocomplete = state.authMode === "signup" ? "new-password" : "current-password";
      $("#authMessage").textContent = "";
    });

    $("#authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = normalizeUsername($("#usernameInput").value);
      const password = $("#passwordInput").value;
      const message = $("#authMessage");
      if (id.length < 3 || password.length < 6) {
        message.textContent = "Use at least 3 username characters and 6 password characters.";
        return;
      }
      if (state.authMode === "signup") {
        await createAccount(id, password, message);
      } else {
        await login(id, password, message);
      }
    });

    $("#logoutButton").addEventListener("click", () => {
      localStorage.removeItem(SESSION_KEY);
      state.user = null;
      stopBreathing();
      $("#appView").hidden = true;
      $("#authView").hidden = false;
      $("#passwordInput").value = "";
    });
  }

  async function createAccount(id, password, message) {
    const existing = await dbGet("users", id);
    if (existing) {
      message.textContent = "That nook already exists in this browser.";
      return;
    }
    const salt = randomSalt();
    const user = {
      id,
      name: id,
      salt,
      passwordHash: await hashPassword(password, salt),
      createdAt: Date.now()
    };
    await dbPut("users", user);
    localStorage.setItem(SESSION_KEY, id);
    state.user = user;
    await showApp();
  }

  async function login(id, password, message) {
    const user = await dbGet("users", id);
    if (!user) {
      message.textContent = "No nook with that username exists in this browser.";
      return;
    }
    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      message.textContent = "That password does not open this nook.";
      return;
    }
    localStorage.setItem(SESSION_KEY, id);
    state.user = user;
    await showApp();
  }

  async function restoreSession() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return;
    const user = await dbGet("users", id);
    if (!user) return;
    state.user = user;
    await showApp();
  }

  async function showApp() {
    $("#authView").hidden = true;
    $("#appView").hidden = false;
    $("#todayStamp").textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    }).format(new Date());
    await ensureJournalPages();
    await loadToolkit();
    await renderMiniHistory();
    await renderQuizHistory();
    await renderInsights();
  }

  function bindNavigation() {
    $$("[data-view]").forEach((button) => {
      button.addEventListener("click", () => activateView(button.dataset.view));
    });
  }

  async function activateView(name) {
    $$(".view").forEach((view) => view.classList.toggle("active", view.id === `${name}View`));
    $$(".nav-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
    if (name === "insights") await renderInsights();
    if (name === "journal") await ensureJournalPages();
  }

  function renderStaticPieces() {
    renderTriggerChips();
    renderCalmSteps();
    renderInfoCards();
    renderBreathPatterns();
    renderTemplates();
    renderStickers();
    renderQuizList();
    renderGroundingInputs();
    renderBodyMap();
  }

  function bindHome() {
    ["anxiety", "energy", "safety"].forEach((name) => {
      const input = $(`#${name}Range`);
      const output = $(`#${name}Output`);
      input.addEventListener("input", () => {
        output.textContent = input.value;
      });
    });

    $("#saveCheckin").addEventListener("click", saveCheckin);
    $("#nextCalmStep").addEventListener("click", () => {
      state.calmStep = (state.calmStep + 1) % calmSteps.length;
      renderCalmSteps();
    });
  }

  function renderTriggerChips() {
    const holder = $("#triggerChips");
    holder.innerHTML = "";
    triggers.forEach((trigger) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = trigger;
      button.addEventListener("click", () => {
        if (state.selectedTriggers.has(trigger)) state.selectedTriggers.delete(trigger);
        else state.selectedTriggers.add(trigger);
        button.classList.toggle("active");
      });
      holder.append(button);
    });
  }

  function renderCalmSteps() {
    const list = $("#calmSteps");
    list.innerHTML = "";
    calmSteps.forEach((step, index) => {
      const li = document.createElement("li");
      li.textContent = step;
      li.classList.toggle("active", index === state.calmStep);
      list.append(li);
    });
  }

  function renderInfoCards() {
    $$(".info-cards button").forEach((button, index) => {
      if (index === 0) button.classList.add("active");
      button.addEventListener("click", () => {
        $$(".info-cards button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        $("#infoText").textContent = infoText[button.dataset.info];
      });
    });
    $("#infoText").textContent = infoText.body;
  }

  async function saveCheckin() {
    if (!state.user) return;
    const checkin = {
      userId: state.user.id,
      anxiety: Number($("#anxietyRange").value),
      energy: Number($("#energyRange").value),
      safety: Number($("#safetyRange").value),
      triggers: Array.from(state.selectedTriggers),
      note: $("#checkinNote").value.trim(),
      createdAt: Date.now()
    };
    await dbAdd("checkins", checkin);
    $("#checkinMessage").textContent = "Saved. Your future self gets one more clue.";
    $("#checkinNote").value = "";
    await renderMiniHistory();
    await renderInsights();
  }

  async function renderMiniHistory() {
    if (!state.user) return;
    const rows = (await dbByUser("checkins", state.user.id)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const holder = $("#miniHistory");
    holder.innerHTML = "";
    if (!rows.length) {
      holder.innerHTML = '<p class="soft-note">Your first check-in will appear here.</p>';
      return;
    }
    rows.forEach((row) => {
      const div = document.createElement("div");
      div.className = "history-row";
      const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(row.createdAt);
      div.innerHTML = `<strong>${time}</strong><span class="history-meter"><span style="width:${row.anxiety * 10}%"></span></span><span>${row.anxiety}/10</span>`;
      holder.append(div);
    });
  }

  function bindBreathing() {
    $("#startBreath").addEventListener("click", startBreathing);
    $("#cloudBreathButton").addEventListener("click", startBreathing);
    $("#stopBreath").addEventListener("click", stopBreathing);
    $("#breathPattern").addEventListener("change", renderPatternDetails);
  }

  function renderBreathPatterns() {
    const select = $("#breathPattern");
    select.innerHTML = breathPatterns
      .map((pattern) => `<option value="${pattern.id}">${pattern.name}</option>`)
      .join("");
    renderPatternDetails();
  }

  function renderPatternDetails() {
    const pattern = getSelectedPattern();
    $("#patternDescription").textContent = pattern.description;
    $("#breathPromptDeck").innerHTML = pattern.phases
      .map((phase) => `<div class="prompt-card"><strong>${phase.label}</strong><br>${phase.prompt} (${phase.seconds}s)</div>`)
      .join("");
  }

  function getSelectedPattern() {
    return breathPatterns.find((pattern) => pattern.id === $("#breathPattern").value) || breathPatterns[0];
  }

  async function startBreathing() {
    if (state.breath.running) return;
    const pattern = getSelectedPattern();
    state.breath.running = true;
    state.breath.phaseIndex = 0;
    state.breath.cycle = 0;
    $("#cloudBreathButton").classList.add("active");
    await startAudio();
    applyBreathPhase(pattern);
    state.breath.timer = window.setInterval(() => {
      state.breath.remaining -= 1;
      if (state.breath.remaining <= 0) {
        state.breath.phaseIndex += 1;
        if (state.breath.phaseIndex >= pattern.phases.length) {
          state.breath.phaseIndex = 0;
          state.breath.cycle += 1;
        }
        applyBreathPhase(pattern);
      } else {
        $("#breathCounter").textContent = String(state.breath.remaining).padStart(2, "0");
      }
    }, 1000);
  }

  function applyBreathPhase(pattern) {
    const phase = pattern.phases[state.breath.phaseIndex];
    state.breath.remaining = phase.seconds;
    $("#breathPrompt").textContent = phase.prompt;
    $("#breathCounter").textContent = String(phase.seconds).padStart(2, "0");
    $("#breathCloud").className = `breath-cloud ${phase.key}`;
    tuneAudioForPhase(phase.key);
  }

  async function startAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!state.audio.ctx) {
      const ctx = new Audio();
      const master = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const padGain = ctx.createGain();
      master.gain.value = 0.0001;
      filter.type = "lowpass";
      filter.frequency.value = 620;
      padGain.gain.value = 0.08;
      filter.connect(master);
      master.connect(ctx.destination);
      [196, 246.94, 329.63].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index === 0 ? "sine" : "triangle";
        osc.frequency.value = freq;
        gain.gain.value = index === 0 ? 0.08 : 0.035;
        osc.connect(gain);
        gain.connect(filter);
        osc.start();
        state.audio.oscillators.push(osc);
      });
      state.audio.ctx = ctx;
      state.audio.master = master;
      state.audio.padGain = padGain;
      state.audio.filter = filter;
    }
    if (state.audio.ctx.state === "suspended") await state.audio.ctx.resume();
    state.audio.master.gain.cancelScheduledValues(state.audio.ctx.currentTime);
    state.audio.master.gain.linearRampToValueAtTime(0.36, state.audio.ctx.currentTime + 0.8);
    if (!state.audio.beatTimer) {
      state.audio.beatTimer = window.setInterval(playSoftBeat, 1250);
    }
  }

  function tuneAudioForPhase(key) {
    if (!state.audio.ctx || !state.audio.filter || !state.audio.master) return;
    const ctx = state.audio.ctx;
    const target = key === "inhale" ? 780 : key === "hold" ? 520 : 360;
    const gain = key === "inhale" ? 0.39 : key === "hold" ? 0.28 : 0.22;
    state.audio.filter.frequency.linearRampToValueAtTime(target, ctx.currentTime + 0.7);
    state.audio.master.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.7);
    playChime(key);
  }

  function playSoftBeat() {
    const ctx = state.audio.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(78, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24);
    osc.connect(gain);
    gain.connect(state.audio.master);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.28);
  }

  function playChime(key) {
    const ctx = state.audio.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = key === "inhale" ? 659.25 : key === "hold" ? 523.25 : 392;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(state.audio.master);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  }

  function stopBreathing() {
    state.breath.running = false;
    window.clearInterval(state.breath.timer);
    state.breath.timer = null;
    $("#cloudBreathButton").classList.remove("active");
    $("#breathCloud").className = "breath-cloud";
    $("#breathPrompt").textContent = "Paused. Return whenever your body is ready.";
    $("#breathCounter").textContent = "00";
    if (state.audio.beatTimer) {
      window.clearInterval(state.audio.beatTimer);
      state.audio.beatTimer = null;
    }
    if (state.audio.ctx && state.audio.master) {
      state.audio.master.gain.linearRampToValueAtTime(0.0001, state.audio.ctx.currentTime + 0.6);
    }
  }

  function bindJournal() {
    $("#journalCover").addEventListener("click", async () => {
      const cover = $("#journalCover");
      cover.classList.add("opening");
      cover.setAttribute("aria-expanded", "true");
      window.setTimeout(() => {
        $("#journalStudio").hidden = false;
        cover.classList.remove("opening");
      }, 520);
      await ensureJournalPages();
    });
    $("#newPageButton").addEventListener("click", () => createJournalPage(0, true));
    $("#saveJournalPage").addEventListener("click", saveCurrentPage);
    $("#pageTitleInput").addEventListener("input", scheduleJournalSave);
    $("#beforeRange").addEventListener("input", scheduleJournalSave);
    $("#afterRange").addEventListener("input", scheduleJournalSave);
    $("#journalBody").addEventListener("input", scheduleJournalSave);
    $("#journalCanvas").addEventListener("dragover", (event) => event.preventDefault());
    $("#journalCanvas").addEventListener("drop", dropSticker);
    $("#journalCanvas").addEventListener("click", placeSelectedSticker);
    $("#clearStickers").addEventListener("click", async () => {
      if (!state.currentPage) return;
      state.currentPage.stickers = [];
      await saveCurrentPage();
      renderPlacedStickers();
    });
    $("#randomSticker").addEventListener("click", () => {
      state.selectedSticker = stickers[Math.floor(Math.random() * stickers.length)];
      renderStickers();
    });
  }

  async function ensureJournalPages() {
    if (!state.user) return;
    state.journalPages = (await dbByUser("journalPages", state.user.id)).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!state.journalPages.length) {
      await createJournalPage(0, false);
      state.journalPages = (await dbByUser("journalPages", state.user.id)).sort((a, b) => b.updatedAt - a.updatedAt);
    }
    renderPageList();
    if (!state.currentPage || !state.journalPages.some((page) => page.id === state.currentPage.id)) {
      selectJournalPage(state.journalPages[0].id);
    }
  }

  async function createJournalPage(templateId = 0, shouldSelect = true) {
    const template = journalTemplates[templateId];
    const page = {
      userId: state.user.id,
      title: template.title,
      templateId,
      body: bodyFromTemplate(template),
      stickers: [],
      anxietyBefore: 5,
      anxietyAfter: 4,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const id = await dbAdd("journalPages", page);
    page.id = id;
    state.journalPages.unshift(page);
    renderPageList();
    if (shouldSelect) selectJournalPage(id);
  }

  function bodyFromTemplate(template) {
    return `${template.title}\n${template.description}\n\n${template.prompts
      .map((prompt) => `${prompt}:\n- `)
      .join("\n\n")}\n\nTiny closing kindness:\n- `;
  }

  function renderTemplates() {
    const holder = $("#templateList");
    holder.innerHTML = "";
    journalTemplates.forEach((template) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "template-button";
      button.innerHTML = `${template.title}<small>${template.description}</small>`;
      button.addEventListener("click", async () => {
        if (!state.currentPage) return;
        state.currentPage.templateId = template.id;
        state.currentPage.title = template.title;
        state.currentPage.body = bodyFromTemplate(template);
        renderJournalPage();
        await saveCurrentPage();
      });
      holder.append(button);
    });
  }

  function renderPageList() {
    const holder = $("#pageList");
    holder.innerHTML = "";
    state.journalPages.forEach((page) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "page-button";
      button.classList.toggle("active", state.currentPage && state.currentPage.id === page.id);
      const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(page.updatedAt);
      button.innerHTML = `${escapeHTML(page.title)}<small>${date} · before ${page.anxietyBefore} / after ${page.anxietyAfter}</small>`;
      button.addEventListener("click", () => selectJournalPage(page.id));
      holder.append(button);
    });
  }

  function selectJournalPage(id) {
    state.currentPage = state.journalPages.find((page) => page.id === id);
    renderPageList();
    renderJournalPage();
  }

  function renderJournalPage() {
    if (!state.currentPage) return;
    const template = journalTemplates[state.currentPage.templateId] || journalTemplates[0];
    $("#pageTitleInput").value = state.currentPage.title || "";
    $("#beforeRange").value = state.currentPage.anxietyBefore ?? 5;
    $("#afterRange").value = state.currentPage.anxietyAfter ?? 4;
    $("#activeTemplateName").textContent = template.title;
    $("#journalBody").innerText = state.currentPage.body || "";
    $("#savedState").textContent = "saved";
    $$(".template-button").forEach((button, index) => button.classList.toggle("active", index === template.id));
    renderPlacedStickers();
  }

  function scheduleJournalSave() {
    $("#savedState").textContent = "saving...";
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(saveCurrentPage, 420);
  }

  async function saveCurrentPage() {
    if (!state.currentPage) return;
    state.currentPage.title = $("#pageTitleInput").value.trim() || "Untitled calm page";
    state.currentPage.anxietyBefore = Number($("#beforeRange").value);
    state.currentPage.anxietyAfter = Number($("#afterRange").value);
    state.currentPage.body = $("#journalBody").innerText.trim();
    state.currentPage.updatedAt = Date.now();
    await dbPut("journalPages", state.currentPage);
    const index = state.journalPages.findIndex((page) => page.id === state.currentPage.id);
    if (index >= 0) state.journalPages[index] = state.currentPage;
    renderPageList();
    $("#savedState").textContent = "saved";
  }

  function renderStickers() {
    const holder = $("#stickerTray");
    holder.innerHTML = "";
    stickers.forEach((sticker) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sticker-button";
      button.draggable = true;
      button.style.setProperty("--sticker-bg", sticker.color);
      button.classList.toggle("active", state.selectedSticker && state.selectedSticker.id === sticker.id);
      button.innerHTML = `<span class="sticker-glyph">${sticker.glyph}</span><span>${sticker.label}</span>`;
      button.addEventListener("click", () => {
        state.selectedSticker = sticker;
        renderStickers();
      });
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", String(sticker.id));
      });
      holder.append(button);
    });
  }

  function dropSticker(event) {
    event.preventDefault();
    const sticker = stickers.find((item) => item.id === Number(event.dataTransfer.getData("text/plain")));
    if (!sticker) return;
    const rect = $("#journalCanvas").getBoundingClientRect();
    addSticker(sticker, event.clientX - rect.left - 24, event.clientY - rect.top - 24);
  }

  function placeSelectedSticker(event) {
    if (!state.selectedSticker || event.target.closest(".placed-sticker")) return;
    const rect = $("#journalCanvas").getBoundingClientRect();
    addSticker(state.selectedSticker, event.clientX - rect.left - 24, event.clientY - rect.top - 24);
  }

  async function addSticker(sticker, x, y) {
    if (!state.currentPage) return;
    state.currentPage.stickers = state.currentPage.stickers || [];
    state.currentPage.stickers.push({
      id: crypto.randomUUID(),
      stickerId: sticker.id,
      x: Math.max(8, x),
      y: Math.max(8, y),
      rotate: Math.round(Math.random() * 18 - 9),
      scale: 0.92 + Math.random() * 0.28
    });
    renderPlacedStickers();
    await saveCurrentPage();
  }

  function renderPlacedStickers() {
    const layer = $("#stickerLayer");
    layer.innerHTML = "";
    if (!state.currentPage) return;
    (state.currentPage.stickers || []).forEach((placed) => {
      const sticker = stickers.find((item) => item.id === placed.stickerId) || stickers[0];
      const el = document.createElement("button");
      el.type = "button";
      el.className = "placed-sticker";
      el.textContent = sticker.glyph;
      el.title = `${sticker.label} sticker. Drag to move, double click to remove.`;
      el.style.left = `${placed.x}px`;
      el.style.top = `${placed.y}px`;
      el.style.transform = `rotate(${placed.rotate}deg) scale(${placed.scale})`;
      el.style.setProperty("--sticker-bg", sticker.color);
      el.addEventListener("dblclick", async () => {
        state.currentPage.stickers = state.currentPage.stickers.filter((item) => item.id !== placed.id);
        renderPlacedStickers();
        await saveCurrentPage();
      });
      bindStickerDrag(el, placed);
      layer.append(el);
    });
  }

  function bindStickerDrag(el, placed) {
    let startX = 0;
    let startY = 0;
    let originalX = 0;
    let originalY = 0;
    el.addEventListener("pointerdown", (event) => {
      startX = event.clientX;
      startY = event.clientY;
      originalX = placed.x;
      originalY = placed.y;
      el.setPointerCapture(event.pointerId);
    });
    el.addEventListener("pointermove", (event) => {
      if (!el.hasPointerCapture(event.pointerId)) return;
      placed.x = Math.max(0, originalX + event.clientX - startX);
      placed.y = Math.max(0, originalY + event.clientY - startY);
      el.style.left = `${placed.x}px`;
      el.style.top = `${placed.y}px`;
    });
    el.addEventListener("pointerup", async (event) => {
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      await saveCurrentPage();
    });
  }

  function renderQuizList() {
    const holder = $("#quizList");
    holder.innerHTML = "<h3>Quizzes</h3>";
    quizzes.forEach((quiz) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-card";
      button.classList.toggle("active", quiz.id === state.quizId);
      button.innerHTML = `${quiz.title}<small>${quiz.blurb}</small>`;
      button.addEventListener("click", () => {
        state.quizId = quiz.id;
        state.quizAnswers = {};
        renderQuizList();
        renderQuizStage();
      });
      holder.append(button);
    });
    renderQuizStage();
  }

  function renderQuizStage() {
    const quiz = quizzes.find((item) => item.id === state.quizId) || quizzes[0];
    const stage = $("#quizStage");
    stage.innerHTML = `<h3>${quiz.title}</h3><p class="soft-note">${quiz.blurb}</p>`;
    quiz.questions.forEach((question, index) => {
      const card = document.createElement("div");
      card.className = "question-card";
      const [prompt, ...answers] = question;
      card.innerHTML = `<strong>${index + 1}. ${prompt}</strong>`;
      answers.forEach(([label, score], answerIndex) => {
        const option = document.createElement("label");
        option.className = "answer-option";
        option.innerHTML = `<input type="radio" name="q${index}" value="${answerIndex}"><span>${label}</span>`;
        option.querySelector("input").addEventListener("change", () => {
          state.quizAnswers[index] = Number(score);
        });
        card.append(option);
      });
      stage.append(card);
    });
    const button = document.createElement("button");
    button.className = "primary-action";
    button.textContent = "Reveal my calm fit";
    button.addEventListener("click", finishQuiz);
    stage.append(button);
  }

  async function finishQuiz() {
    const quiz = quizzes.find((item) => item.id === state.quizId) || quizzes[0];
    if (Object.keys(state.quizAnswers).length < quiz.questions.length) {
      $("#quizStage").insertAdjacentHTML("beforeend", '<p class="status-line">Answer each question first.</p>');
      return;
    }
    const score = Object.values(state.quizAnswers).reduce((total, value) => total + value, 0);
    const max = quiz.questions.length * 3;
    const band = Math.min(2, Math.floor((score / max) * 3));
    const result = {
      userId: state.user.id,
      quizId: quiz.id,
      title: quiz.title,
      score,
      max,
      feedback: quiz.feedback[band],
      createdAt: Date.now()
    };
    await dbAdd("quizResults", result);
    $("#quizStage").insertAdjacentHTML(
      "beforeend",
      `<div class="result-card"><strong>${score}/${max}</strong><br>${quiz.feedback[band]}</div>`
    );
    await renderQuizHistory();
    await renderInsights();
  }

  async function renderQuizHistory() {
    if (!state.user) return;
    const rows = (await dbByUser("quizResults", state.user.id)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
    const holder = $("#quizHistory");
    holder.innerHTML = rows.length
      ? ""
      : '<p class="soft-note">Quiz results will collect here.</p>';
    rows.forEach((row) => {
      const div = document.createElement("div");
      div.className = "prompt-card";
      const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(row.createdAt);
      div.innerHTML = `<strong>${escapeHTML(row.title)}</strong><br>${date} · ${row.score}/${row.max}<br>${escapeHTML(row.feedback)}`;
      holder.append(div);
    });
  }

  function bindToolkit() {
    $("#saveGrounding").addEventListener("click", saveGrounding);
    $("#floatWorry").addEventListener("click", floatWorry);
    $("#savePlan").addEventListener("click", savePlan);
    $("#addExposure").addEventListener("click", () => addExposureRow("", false));
  }

  function renderGroundingInputs() {
    const holder = $("#groundingInputs");
    holder.innerHTML = "";
    groundingFields.forEach(([id, label]) => {
      const field = document.createElement("label");
      field.innerHTML = `<span>${label}</span><input id="ground-${id}" />`;
      holder.append(field);
    });
  }

  function renderBodyMap() {
    const holder = $("#bodyMap");
    holder.innerHTML = "";
    Object.keys(bodySuggestions).forEach((part) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = part;
      button.addEventListener("click", () => {
        $$("#bodyMap button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        $("#bodySuggestion").textContent = bodySuggestions[part];
      });
      holder.append(button);
    });
    $("#bodySuggestion").textContent = "Tap the area where anxiety is loudest.";
  }

  async function saveGrounding() {
    const entries = Object.fromEntries(groundingFields.map(([id]) => [id, $(`#ground-${id}`).value.trim()]));
    await dbPut("toolkit", {
      id: `${state.user.id}:grounding`,
      userId: state.user.id,
      type: "grounding",
      entries,
      updatedAt: Date.now()
    });
  }

  async function floatWorry() {
    const text = $("#worryInput").value.trim();
    if (!text) return;
    const bubble = document.createElement("div");
    bubble.className = "worry-bubble";
    bubble.textContent = text;
    bubble.style.left = `${30 + Math.random() * 40}%`;
    $("#worrySky").append(bubble);
    window.setTimeout(() => bubble.remove(), 6200);
    $("#worryInput").value = "";
    const record = (await dbGet("toolkit", `${state.user.id}:worries`)) || {
      id: `${state.user.id}:worries`,
      userId: state.user.id,
      type: "worries",
      worries: []
    };
    record.worries.unshift({ text, createdAt: Date.now() });
    record.worries = record.worries.slice(0, 20);
    record.updatedAt = Date.now();
    await dbPut("toolkit", record);
  }

  async function savePlan() {
    await dbPut("toolkit", {
      id: `${state.user.id}:panicPlan`,
      userId: state.user.id,
      type: "panicPlan",
      anchor: $("#anchorPhrase").value.trim(),
      person: $("#safePerson").value.trim(),
      place: $("#safePlace").value.trim(),
      updatedAt: Date.now()
    });
    $("#planStatus").textContent = "Saved. Pocket plan ready.";
  }

  async function loadToolkit() {
    const plan = await dbGet("toolkit", `${state.user.id}:panicPlan`);
    if (plan) {
      $("#anchorPhrase").value = plan.anchor || "";
      $("#safePerson").value = plan.person || "";
      $("#safePlace").value = plan.place || "";
    }
    const grounding = await dbGet("toolkit", `${state.user.id}:grounding`);
    if (grounding) {
      groundingFields.forEach(([id]) => {
        $(`#ground-${id}`).value = grounding.entries?.[id] || "";
      });
    }
    const ladder = await dbGet("toolkit", `${state.user.id}:exposure`);
    renderExposureList(ladder?.steps || [
      { text: "Look at the task for 30 seconds", done: false },
      { text: "Try one low-stakes version", done: false },
      { text: "Recover with a comfort cue", done: false }
    ]);
  }

  function renderExposureList(steps) {
    const holder = $("#exposureList");
    holder.innerHTML = "";
    steps.forEach((step) => addExposureRow(step.text, step.done, false));
  }

  function addExposureRow(text = "", done = false, shouldSave = true) {
    const holder = $("#exposureList");
    const row = document.createElement("div");
    row.className = "exposure-row";
    row.innerHTML = `<input type="checkbox" ${done ? "checked" : ""}><input type="text" value="${escapeAttribute(text)}"><button class="text-action" type="button">remove</button>`;
    row.querySelector("button").addEventListener("click", () => {
      row.remove();
      saveExposure();
    });
    row.querySelectorAll("input").forEach((input) => input.addEventListener("input", saveExposure));
    holder.append(row);
    if (shouldSave) saveExposure();
  }

  async function saveExposure() {
    const steps = $$(".exposure-row").map((row) => ({
      done: row.querySelector('input[type="checkbox"]').checked,
      text: row.querySelector('input[type="text"]').value.trim()
    }));
    await dbPut("toolkit", {
      id: `${state.user.id}:exposure`,
      userId: state.user.id,
      type: "exposure",
      steps,
      updatedAt: Date.now()
    });
  }

  async function renderInsights() {
    if (!state.user) return;
    const [checkins, pages, results] = await Promise.all([
      dbByUser("checkins", state.user.id),
      dbByUser("journalPages", state.user.id),
      dbByUser("quizResults", state.user.id)
    ]);
    const sorted = checkins.sort((a, b) => a.createdAt - b.createdAt);
    const avg = sorted.length
      ? (sorted.reduce((total, row) => total + row.anxiety, 0) / sorted.length).toFixed(1)
      : "0.0";
    const triggerCounts = {};
    sorted.forEach((row) => row.triggers.forEach((trigger) => {
      triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
    }));
    const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none yet";
    $("#insightStats").innerHTML = `
      <h3>Nook numbers</h3>
      <div class="stat-stack">
        <div class="stat"><span>Average anxiety</span><strong>${avg}/10</strong></div>
        <div class="stat"><span>Check-ins</span><strong>${sorted.length}</strong></div>
        <div class="stat"><span>Journal pages</span><strong>${pages.length}</strong></div>
        <div class="stat"><span>Quizzes taken</span><strong>${results.length}</strong></div>
        <div class="stat"><span>Most-noted trigger</span><strong>${escapeHTML(topTrigger)}</strong></div>
      </div>
    `;
    renderChart(sorted.slice(-14));
  }

  function renderChart(rows) {
    const svg = $("#moodChart");
    svg.innerHTML = "";
    const width = 640;
    const height = 260;
    const pad = 34;
    [0, 2, 4, 6, 8, 10].forEach((tick) => {
      const y = height - pad - (tick / 10) * (height - pad * 2);
      svg.insertAdjacentHTML(
        "beforeend",
        `<line x1="${pad}" y1="${y}" x2="${width - pad}" y2="${y}" stroke="rgba(32,50,58,.12)" /><text x="6" y="${y + 5}" fill="#63757b" font-size="13">${tick}</text>`
      );
    });
    if (!rows.length) {
      svg.insertAdjacentHTML("beforeend", '<text x="210" y="132" fill="#63757b" font-size="16">Save check-ins to grow a trend.</text>');
      return;
    }
    const points = rows.map((row, index) => {
      const x = pad + (index / Math.max(1, rows.length - 1)) * (width - pad * 2);
      const y = height - pad - (row.anxiety / 10) * (height - pad * 2);
      return [x, y, row];
    });
    const d = points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
    svg.insertAdjacentHTML("beforeend", `<path d="${d}" fill="none" stroke="#3a9b9b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />`);
    points.forEach(([x, y, row]) => {
      const label = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(row.createdAt);
      svg.insertAdjacentHTML(
        "beforeend",
        `<circle cx="${x}" cy="${y}" r="7" fill="#ee7b6a" /><text x="${x - 24}" y="${height - 8}" fill="#63757b" font-size="12">${label}</text>`
      );
    });
  }

  function escapeHTML(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value = "") {
    return escapeHTML(value).replace(/`/g, "&#096;");
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }
})();
