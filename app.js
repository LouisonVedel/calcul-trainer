(function(){
  "use strict";

  var STORAGE_KEY = "calc_trainer_stats_v1";
  var LANG_KEY = "calc_trainer_lang";

  var STRINGS = {
    en: {
      eyebrow: "Training — mental math",
      h1: "Ready to start<br>a session?",
      ops_title: "Operations included",
      op_mult: "Multiplication",
      op_div: "Division",
      op_add: "Addition",
      op_sub: "Subtraction",
      op_sq: "Square",
      op_cube: "Cube",
      length_title: "Session length",
      btn_start: "Start training",
      btn_reset: "Reset all statistics",
      stats_tracked: "Questions tracked",
      stats_red: "In red zone",
      question_n: "Question",
      zone_consolidation: "hard (consolidation)",
      series_done: "Session complete",
      avg_time: "Average time",
      red_zone_title: "Red zone — to consolidate",
      empty_note: "No questions in red zone. Nice session.",
      btn_replay: "Start new session",
      btn_back: "Back to menu",
      btn_stop: "Stop",
      correct: "✓ Correct",
      timeout: "✗ Time's up — ",
      wrong: "✗ Correct answer: ",
      confirm_reset: "Reset all training statistics?"
    },
    fr: {
      eyebrow: "Entraînement — calcul mental",
      h1: "Prêt à lancer<br>une série ?",
      ops_title: "Opérations incluses",
      op_mult: "Multiplication",
      op_div: "Division",
      op_add: "Addition",
      op_sub: "Soustraction",
      op_sq: "Carré",
      op_cube: "Cube",
      length_title: "Longueur de la série",
      btn_start: "Démarrer l'entraînement",
      btn_reset: "Réinitialiser toutes les statistiques",
      stats_tracked: "Questions suivies",
      stats_red: "En zone rouge",
      question_n: "Question",
      zone_consolidation: "difficile (consolidation)",
      series_done: "Série terminée",
      avg_time: "Temps moyen",
      red_zone_title: "Zone rouge — à consolider",
      empty_note: "Aucune question en zone rouge. Belle série.",
      btn_replay: "Relancer une série",
      btn_back: "Retour au menu",
      btn_stop: "Arrêter",
      correct: "✓ Correct",
      timeout: "✗ Temps écoulé — ",
      wrong: "✗ Bonne réponse : ",
      confirm_reset: "Réinitialiser toutes les statistiques d'entraînement ?"
    }
  };

  var lang = "en";
  function t(key){ return STRINGS[lang][key] || key; }

  function setLang(l){
    lang = l;
    try{ localStorage.setItem(LANG_KEY, l); }catch(e){}
    document.documentElement.lang = l;
    document.querySelectorAll("[data-i18n]").forEach(function(el){
      el.innerHTML = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-text]").forEach(function(el){
      el.textContent = t(el.dataset.i18nText);
    });
    var toggle = document.getElementById("btn-lang");
    if (toggle) toggle.textContent = lang === "en" ? "FR" : "EN";
    refreshMenuStats();
  }

  var el = {
    menu: document.getElementById('screen-menu'),
    game: document.getElementById('screen-game'),
    end: document.getElementById('screen-end'),
    lengthRow: document.getElementById('length-row'),
    btnStart: document.getElementById('btn-start'),
    btnReset: document.getElementById('btn-reset'),
    opGrid: document.getElementById('op-grid'),
    btnLang: document.getElementById('btn-lang'),
    statTotal: document.getElementById('stat-total'),
    statPriority: document.getElementById('stat-priority'),
    qcount: document.getElementById('qcount'),
    zoneDot: document.getElementById('zone-dot'),
    zoneLabel: document.getElementById('zone-label'),
    timerFill: document.getElementById('timer-fill'),
    btnStop: document.getElementById('btn-stop'),
    questionCard: document.getElementById('question-card'),
    questionText: document.getElementById('question-text'),
    answerDisplay: document.getElementById('answer-display'),
    keypad: document.getElementById('keypad'),
    feedback: document.getElementById('feedback'),
    endScore: document.getElementById('end-score'),
    endAvg: document.getElementById('end-avg'),
    priorityList: document.getElementById('priority-list'),
    endEmptyNote: document.getElementById('end-empty-note'),
    endPriorityBlock: document.getElementById('end-priority-block'),
    btnReplay: document.getElementById('btn-replay'),
    btnMenu: document.getElementById('btn-menu')
  };

  var ZONE_COLORS = {
    facile: 'var(--zone-facile)',
    moyenne: 'var(--zone-moyenne)',
    difficile: 'var(--zone-difficile)',
    prioritaire: 'var(--zone-prioritaire)',
    unknown: 'var(--zone-unknown)'
  };

  var sessionLength = 50;
  var selectedOps = { multiplication: true, division: true, carre: true, cube: true, addition: true, soustraction: true };
  var sessionBackup = null;
  var stats = {};
  var currentInput = '';

  var session = {
    priorityQueue: [],
    queue: [],
    questionNumber: 0,
    score: 0,
    totalTime: 0,
    current: null,
    startTime: 0,
    timeLimit: 6,
    answered: false,
    timerHandle: null,
    timedOut: false
  };

  // ---------------- persistence ----------------

  function blankEntry(){
    return { history: [], priority: false, last_time: null, level: "unknown", post_priority: false };
  }

  function buildDefaultStats(){
    var s = {};
    var nums = [];
    for (var n = 1; n <= 20; n++) nums.push(n);

    nums.forEach(function(i){
      nums.forEach(function(j){
        if (i === 1 || j === 1) return;
        s["multiplication_" + i + "_" + j] = blankEntry();
      });
    });

    nums.forEach(function(i){
      nums.forEach(function(j){
        if (j === 1) return;
        var a = i * j, b = j;
        s["division_" + a + "_" + b] = blankEntry();
      });
    });

    nums.forEach(function(i){
      nums.forEach(function(j){
        s["addition_" + i + "_" + j] = blankEntry();
      });
    });

    nums.forEach(function(i){
      nums.forEach(function(j){
        if (j === 1) return;
        var a = i + j, b = j;
        s["soustraction_" + a + "_" + b] = blankEntry();
      });
    });

    nums.forEach(function(i){ s["carre_" + i + "_2"] = blankEntry(); });
    nums.forEach(function(i){ s["cube_" + i + "_3"] = blankEntry(); });

    return s;
  }

  function loadStats(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }catch(e){}
    var fresh = buildDefaultStats();
    saveStats(fresh);
    return fresh;
  }

  function saveStats(s){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
    catch(e){}
  }

  // ---------------- menu ----------------

  function refreshMenuStats(){
    var total = Object.keys(stats).length;
    var prio = 0;
    Object.keys(stats).forEach(function(k){ if (stats[k].level === 'prioritaire') prio++; });
    el.statTotal.textContent = total;
    el.statPriority.textContent = prio;
  }

  el.lengthRow.addEventListener('click', function(e){
    var btn = e.target.closest('.length-btn');
    if (!btn) return;
    Array.prototype.forEach.call(el.lengthRow.children, function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    sessionLength = parseInt(btn.dataset.len, 10);
  });

  el.opGrid.addEventListener('click', function(e){
    var chip = e.target.closest('.op-chip');
    if (!chip) return;
    var op = chip.dataset.op;
    // guard: don't deselect last one
    var activeCount = Object.keys(selectedOps).filter(function(k){ return selectedOps[k]; }).length;
    if (selectedOps[op] && activeCount === 1) return;
    selectedOps[op] = !selectedOps[op];
    chip.classList.toggle('active');
  });

  el.btnLang.addEventListener('click', function(){
    setLang(lang === "en" ? "fr" : "en");
  });

  el.btnReset.addEventListener('click', function(){
    if (!confirm(t("confirm_reset"))) return;
    stats = buildDefaultStats();
    saveStats(stats);
    refreshMenuStats();
  });

  function goFullscreen(){
    var elRoot = document.documentElement;
    var req = elRoot.requestFullscreen || elRoot.webkitRequestFullscreen ||
              elRoot.mozRequestFullScreen || elRoot.msRequestFullscreen;
    if (req) {
      try { req.call(elRoot).catch(function(){}); } catch(e){}
    }
  }

  el.btnStart.addEventListener('click', startGame);
  el.btnReplay.addEventListener('click', startGame);
  el.btnMenu.addEventListener('click', showMenu);

  el.btnStop.addEventListener('click', stopGame);

  function stopGame(){
    if (session.timerHandle) clearTimeout(session.timerHandle);
    stats = JSON.parse(sessionBackup);
    saveStats(stats);
    el.btnStop.classList.add('hidden');
    showMenu();
  }

  function showMenu(){
    var exitFn = document.exitFullscreen || document.webkitExitFullscreen ||
                 document.mozCancelFullScreen || document.msExitFullscreen;
    if (document.fullscreenElement && exitFn) {
      try { exitFn.call(document); } catch(e){}
    }
    el.end.classList.add('hidden');
    el.game.classList.add('hidden');
    el.menu.classList.remove('hidden');
    refreshMenuStats();
  }

  // ---------------- session setup ----------------

  function generateSessionQueue(){
    var buckets = { difficile: [], moyenne: [], facile: [], unknown: [] };

    Object.keys(stats).forEach(function(k){
      var op = k.split('_')[0];
      if (!selectedOps[op]) return;
      var level = stats[k].level || 'unknown';
      if (level !== 'prioritaire' && buckets[level]) buckets[level].push(k);
    });

    var weights = [['difficile', 0.3], ['moyenne', 0.2], ['facile', 0.1], ['unknown', 0.4]];
    var queue = [];
    var guard = 0;

    while (queue.length < sessionLength && guard < sessionLength * 400) {
      guard++;
      var r = Math.random();
      var acc = 0, chosen = 'unknown';
      for (var i = 0; i < weights.length; i++) {
        acc += weights[i][1];
        if (r <= acc) { chosen = weights[i][0]; break; }
      }
      var bucket = buckets[chosen];
      if (bucket && bucket.length) {
        var q = bucket[Math.floor(Math.random() * bucket.length)];
        var last3 = queue.slice(-3);
        if (last3.indexOf(q) === -1) queue.push(q);
      }
    }

    var allKeys = Object.keys(stats).filter(function(k){ return selectedOps[k.split('_')[0]] && stats[k].level !== 'prioritaire'; });
    while (queue.length < sessionLength && allKeys.length) {
      queue.push(allKeys[Math.floor(Math.random() * allKeys.length)]);
    }

    return queue;
  }

  function shuffle(arr){
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function startGame(){
    goFullscreen();
    sessionBackup = JSON.stringify(stats);
    session.priorityQueue = shuffle(Object.keys(stats).filter(function(k){ return selectedOps[k.split('_')[0]] && stats[k].level === 'prioritaire'; }));
    session.queue = generateSessionQueue();
    session.questionNumber = 0;
    session.score = 0;
    session.totalTime = 0;

    el.menu.classList.add('hidden');
    el.end.classList.add('hidden');
    el.game.classList.remove('hidden');
    el.btnStop.classList.remove('hidden');

    nextQuestion();
  }

  // ---------------- question flow ----------------

  function parseKey(key){
    var parts = key.split('_');
    return { op: parts[0], a: parseInt(parts[1], 10), b: parseInt(parts[2], 10) };
  }

  function getTimeLimit(entry){
    var level = entry.level || 'unknown';
    if (level === 'facile') return 3;
    if (level === 'moyenne') return 5;
    if (level === 'difficile') return entry.post_priority ? 8 : 6;
    if (level === 'prioritaire') return 10;
    return 6;
  }

  function nextQuestion(){
    if (session.questionNumber >= sessionLength) {
      return endGame();
    }

    var key;
    if (session.priorityQueue.length) {
      key = session.priorityQueue.shift();
    } else if (session.queue.length) {
      key = session.queue.shift();
    } else {
      return endGame();
    }

    session.questionNumber++;
    var parsed = parseKey(key);
    var entry = stats[key] || blankEntry();
    stats[key] = entry;

    session.current = { key: key, a: parsed.a, b: parsed.b, op: parsed.op };
    session.timeLimit = getTimeLimit(entry);
    session.answered = false;
    session.timedOut = false;
    session.startTime = Date.now();

    renderQuestion(entry);
    startTimer();
  }

  function opText(a, b, op){
    if (op === 'multiplication') return a + ' × ' + b + ' = ?';
    if (op === 'division') return a + ' ÷ ' + b + ' = ?';
    if (op === 'addition') return a + ' + ' + b + ' = ?';
    if (op === 'soustraction') return a + ' − ' + b + ' = ?';
    if (op === 'carre') return a + '² = ?';
    return a + '³ = ?';
  }

  function renderQuestion(entry){
    var totalPlanned = sessionLength;
    el.qcount.textContent = t("question_n") + ' ' + session.questionNumber + '/' + totalPlanned;

    var level = entry.level || 'unknown';
    el.zoneDot.style.background = ZONE_COLORS[level] || ZONE_COLORS.unknown;
    var label = level;
    if (level === 'difficile' && entry.post_priority) label = t("zone_consolidation");
    el.zoneLabel.textContent = label;
    el.zoneLabel.style.color = ZONE_COLORS[level] || 'var(--muted)';

    el.questionText.textContent = opText(session.current.a, session.current.b, session.current.op);
    currentInput = '';
    updateAnswerDisplay();
    el.questionCard.classList.remove('wrong', 'correct');
    el.feedback.className = 'feedback-flash';
    el.feedback.textContent = '';
  }

  function updateAnswerDisplay(){
    if (!currentInput.length) {
      el.answerDisplay.innerHTML = '<span class="ph">0</span><span class="cursor"></span>';
    } else {
      el.answerDisplay.innerHTML = currentInput + '<span class="cursor"></span>';
    }
  }

  function startTimer(){
    el.timerFill.style.transition = 'none';
    el.timerFill.style.transform = 'scaleX(1)';
    el.timerFill.style.background = ZONE_COLORS[stats[session.current.key].level] || ZONE_COLORS.unknown;
    void el.timerFill.offsetWidth;
    el.timerFill.style.transition = 'transform ' + session.timeLimit + 's linear';
    el.timerFill.style.transform = 'scaleX(0)';

    if (session.timerHandle) clearTimeout(session.timerHandle);
    session.timerHandle = setTimeout(function(){
      if (!session.answered) {
        session.timedOut = true;
        checkAnswer();
      }
    }, session.timeLimit * 1000);
  }

  function stopTimerVisual(){
    var computed = getComputedStyle(el.timerFill).transform;
    el.timerFill.style.transition = 'none';
    el.timerFill.style.transform = computed;
    if (session.timerHandle) { clearTimeout(session.timerHandle); session.timerHandle = null; }
  }

  el.keypad.addEventListener('click', function(e){
    var btn = e.target.closest('.key-btn');
    if (!btn || session.answered) return;
    var key = btn.dataset.key;

    if (key === 'ok') {
      checkAnswer();
    } else if (key === 'back') {
      currentInput = currentInput.slice(0, -1);
      updateAnswerDisplay();
    } else if (currentInput.length < 6) {
      currentInput += key;
      updateAnswerDisplay();
    }
  });

  function expectedAnswer(a, b, op){
    if (op === 'multiplication') return a * b;
    if (op === 'division') return Math.floor(a / b);
    if (op === 'addition') return a + b;
    if (op === 'soustraction') return a - b;
    if (op === 'carre') return a * a;
    return a * a * a;
  }

  function checkAnswer(){
    if (session.answered) return;
    session.answered = true;
    stopTimerVisual();

    var userAnswer = currentInput.length ? parseInt(currentInput, 10) : NaN;
    var cur = session.current;
    var expected = expectedAnswer(cur.a, cur.b, cur.op);
    var correct = (userAnswer === expected) && !session.timedOut;

    var duration = (Date.now() - session.startTime) / 1000;
    session.totalTime += duration;

    updateStats(cur.key, correct, duration);

    if (correct) {
      session.score++;
      el.questionCard.classList.add('correct');
      el.feedback.className = 'feedback-flash correct';
      el.feedback.textContent = t("correct");
    } else {
      el.questionCard.classList.add('wrong');
      el.feedback.className = 'feedback-flash wrong';
      el.feedback.textContent = session.timedOut ? t("timeout") + expected : t("wrong") + expected;
    }

    setTimeout(nextQuestion, correct ? 350 : 1000);
  }

  function updateStats(key, correct, duration){
    var data = stats[key] || blankEntry();
    if (typeof data.post_priority === 'undefined') data.post_priority = false;

    data.history.push(correct ? 1 : 0);
    if (data.history.length > 3) data.history = data.history.slice(-3);
    data.last_time = duration;

    var level = data.level || 'unknown';

    if (level === 'unknown') {
      if (correct) level = duration < 3 ? 'facile' : 'moyenne';
      else level = 'difficile';
    }

    if (data.history.length >= 3 && data.history.every(function(h){ return h === 0; })) {
      level = 'prioritaire';
    } else if (level === 'prioritaire' && correct) {
      level = 'difficile';
      data.post_priority = true;
    } else if (level === 'facile' && !correct) {
      level = 'moyenne';
    } else if (level === 'moyenne') {
      if (correct && duration < 3) level = 'facile';
      else if (!correct) level = 'difficile';
    } else if (level === 'difficile' && correct) {
      if (data.post_priority) data.post_priority = false;
      else level = 'moyenne';
    }

    data.level = level;
    data.priority = (level === 'prioritaire');

    stats[key] = data;
    saveStats(stats);
  }

  // ---------------- end screen ----------------

  function endGame(){
    el.btnStop.classList.add('hidden');
    el.game.classList.add('hidden');
    el.end.classList.remove('hidden');

    el.endScore.textContent = session.score + '/' + session.questionNumber;
    var avg = session.totalTime / Math.max(1, session.questionNumber);
    el.endAvg.textContent = t("avg_time") + ' : ' + avg.toFixed(2) + 's';

    var priorities = Object.keys(stats).filter(function(k){ return stats[k].level === 'prioritaire'; });

    el.priorityList.innerHTML = '';
    if (priorities.length) {
      el.endPriorityBlock.classList.remove('hidden');
      el.endEmptyNote.classList.add('hidden');
      priorities.forEach(function(k){
        var p = parseKey(k);
        var txt;
        if (p.op === 'multiplication') txt = p.a + ' × ' + p.b;
        else if (p.op === 'division') txt = p.a + ' ÷ ' + p.b;
        else if (p.op === 'addition') txt = p.a + ' + ' + p.b;
        else if (p.op === 'soustraction') txt = p.a + ' − ' + p.b;
        else if (p.op === 'carre') txt = p.a + '²';
        else txt = p.a + '³';
        var row = document.createElement('div');
        row.className = 'priority-item';
        row.textContent = txt;
        el.priorityList.appendChild(row);
      });
    } else {
      el.endPriorityBlock.classList.add('hidden');
      el.endEmptyNote.classList.remove('hidden');
    }
  }

  // ---------------- init ----------------

  try{ lang = localStorage.getItem(LANG_KEY) || "en"; }catch(e){}
  if (!STRINGS[lang]) lang = "en";

  stats = loadStats();
  setLang(lang);
})();
