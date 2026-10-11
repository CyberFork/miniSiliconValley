// js/game/english.js - 英语语音朗读识别（Web Speech API）与全息填空拼写模块

class EnglishJudge {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.currentTask = null;
    this.onResultCallback = null;
    this.spellBuffer = [];

    // 六档初中学段词库配置（紧扣宇宙、月球与机甲主题）
    this.gradeConfigs = {
      junior1_up: { label: '初一上', mode: '基础高频词' },
      junior1_down: { label: '初一下', mode: '行星与基地' },
      junior2_up: { label: '初二上', mode: '战术与能量' },
      junior2_down: { label: '初二下', mode: '指令与行动' },
      junior3_up: { label: '初三上', mode: '银河与星系' },
      junior3_down: { label: '初三下', mode: '宇宙深空' }
    };

    this.wordBank = {
      junior1_up: {
        read: [
          { word: 'MOON', phonetic: '/muːn/', translation: '月球', clue: '故事发生的主战场星球' },
          { word: 'STAR', phonetic: '/stɑːr/', translation: '星星', clue: '夜空中闪耀的恒星' },
          { word: 'TEAM', phonetic: '/tiːm/', translation: '队伍', clue: '并肩作战的5人战队' },
          { word: 'FIRE', phonetic: '/ˈfaɪər/', translation: '开火', clue: '按下攻击按钮发射激光' },
          { word: 'ROBOT', phonetic: '/ˈroʊbɑːt/', translation: '机器人', clue: '星球巡逻机械卫兵' }
        ],
        spell: [
          { word: 'MOON', blanks: [1, 2], translation: '月球', clue: '故事发生的主战场星球' },
          { word: 'STAR', blanks: [1, 2], translation: '星星', clue: '夜空中闪耀的恒星' },
          { word: 'TEAM', blanks: [1, 2], translation: '队伍', clue: '并肩作战的5人战队' },
          { word: 'HERO', blanks: [1, 3], translation: '英雄', clue: '保卫基地的出战勇士' },
          { word: 'FAST', blanks: [1, 2], translation: '迅速的', clue: '战车高机动穿插' }
        ]
      },
      junior1_down: {
        read: [
          { word: 'SPACE', phonetic: '/speɪs/', translation: '太空/宇宙', clue: '无边无际的广阔星域' },
          { word: 'LASER', phonetic: '/ˈleɪzər/', translation: '激光', clue: '星芒脉冲枪射出的高能光束' },
          { word: 'POWER', phonetic: '/ˈpaʊər/', translation: '能量/动力', clue: '战甲核心反应堆的能量' },
          { word: 'EARTH', phonetic: '/ɜːrθ/', translation: '地球', clue: '悬挂在星空的蔚蓝母星' },
          { word: 'SHIELD', phonetic: '/ʃiːld/', translation: '护盾', clue: '抵御敌方攻击的能量场' }
        ],
        spell: [
          { word: 'SPACE', blanks: [2, 3], translation: '太空/宇宙', clue: '人类探索的无尽领域' },
          { word: 'EARTH', blanks: [1, 4], translation: '地球', clue: '悬挂在星空的蔚蓝母星' },
          { word: 'LASER', blanks: [1, 3], translation: '激光', clue: '脉冲步枪的高能弹道' },
          { word: 'POWER', blanks: [1, 3], translation: '力量/动力', clue: '机甲核心源源不断的能量' },
          { word: 'LIGHT', blanks: [1, 3], translation: '光芒', clue: '极光聚能重炮的光效' }
        ]
      },
      junior2_up: {
        read: [
          { word: 'TARGET', phonetic: '/ˈtɑːrɡɪt/', translation: '目标', clue: '雷达与准星锁定的敌人' },
          { word: 'ENERGY', phonetic: '/ˈenərdʒi/', translation: '能源', clue: '驱动机甲的纯净核能' },
          { word: 'PLANET', phonetic: '/ˈplænɪt/', translation: '行星', clue: '围绕恒星公转的大型天体' },
          { word: 'DEFEND', phonetic: '/dɪˈfend/', translation: '防守/保卫', clue: '保卫基地核心的作战指令' },
          { word: 'RESCUE', phonetic: '/ˈreskjuː/', translation: '救援/复活', clue: '艾拉治愈复活队友的神技' }
        ],
        spell: [
          { word: 'PLANET', blanks: [1, 3], translation: '行星', clue: '宇宙星海中的天体' },
          { word: 'ENERGY', blanks: [1, 4], translation: '能源', clue: '驱动机甲反应堆的核心能量' },
          { word: 'TARGET', blanks: [1, 4], translation: '目标', clue: '准星锁定的敌对机器人' },
          { word: 'DEFEND', blanks: [1, 3], translation: '防守', clue: '守护战线的战术指令' },
          { word: 'RESCUE', blanks: [1, 4], translation: '救援/复活', clue: '恢复倒下队友的生命' }
        ]
      },
      junior2_down: {
        read: [
          { word: 'COMMAND', phonetic: '/kəˈmænd/', translation: '指令', clue: '指挥官发布的战场指令' },
          { word: 'PROTECT', phonetic: '/prəˈtekt/', translation: '保护', clue: '守护队伍与基地' },
          { word: 'SURVIVE', phonetic: '/sərˈvaɪv/', translation: '生存', clue: '在激烈交火中坚持到最后' },
          { word: 'VICTORY', phonetic: '/ˈvɪktəri/', translation: '胜利', clue: '全清敌兵取得的光荣战果' },
          { word: 'WARRIOR', phonetic: '/ˈwɔːriər/', translation: '战斗者', clue: '英勇作战的机甲战士' }
        ],
        spell: [
          { word: 'VICTORY', blanks: [1, 4, 5], translation: '胜利', clue: '打通关卡后的最终成果' },
          { word: 'COMMAND', blanks: [1, 4], translation: '指令', clue: '战术小队的行动要求' },
          { word: 'PROTECT', blanks: [1, 4], translation: '保护', clue: '抵御外敌守护同伴' },
          { word: 'SURVIVE', blanks: [1, 4], translation: '生存', clue: '在木星陨石与敌袭中屹立不倒' },
          { word: 'WARRIOR', blanks: [1, 4], translation: '战士/战斗者', clue: '凯恩与纪元行者的身份' }
        ]
      },
      junior3_up: {
        read: [
          { word: 'GALAXY', phonetic: '/ˈɡæləksi/', translation: '银河系', clue: '拥有千亿恒星的宏大星系' },
          { word: 'MISSION', phonetic: '/ˈmɪʃən/', translation: '任务', clue: '守卫月球基地的关键作战' },
          { word: 'BARRIER', phonetic: '/ˈbæriər/', translation: '屏障', clue: '环绕战场的全息能量力场' },
          { word: 'METEOR', phonetic: '/ˈmiːtiər/', translation: '陨石', clue: '来自木星的冰铁心残骸' },
          { word: 'EXPLORE', phonetic: '/ɪkˈsplɔːr/', translation: '探索', clue: '向未知的银河边缘进发' }
        ],
        spell: [
          { word: 'GALAXY', blanks: [1, 3, 5], translation: '银河系', clue: '千亿恒星构成的星系' },
          { word: 'MISSION', blanks: [1, 4, 5], translation: '任务', clue: '关卡核心任务指令' },
          { word: 'BARRIER', blanks: [1, 4], translation: '防护屏障', clue: '阻止角色掉落出地图的力场' },
          { word: 'METEOR', blanks: [1, 3], translation: '陨石', clue: '木星冰铁心撞击残骸' },
          { word: 'EXPLORE', blanks: [1, 4], translation: '探索', clue: '突破银河边界的征程' }
        ]
      },
      junior3_down: {
        read: [
          { word: 'UNIVERSE', phonetic: '/ˈjuːnɪvɜːrs/', translation: '宇宙', clue: '科技终将统一的每一个角落' },
          { word: 'ADVENTURE', phonetic: '/ədˈventʃər/', translation: '冒险', clue: '星际穿越与战斗的壮举' },
          { word: 'STRATEGY', phonetic: '/ˈstrætədʒi/', translation: '策略', clue: '5v5 编队战术协同' },
          { word: 'ULTIMATE', phonetic: '/ˈʌltɪmət/', translation: '终极', clue: '迎战最终巨大机甲 BOSS' },
          { word: 'GRAVITY', phonetic: '/ˈɡrævəti/', translation: '引力', clue: '月球上低重力的物理环境' }
        ],
        spell: [
          { word: 'UNIVERSE', blanks: [2, 4, 7], translation: '宇宙', clue: '最终科技统一的目标空间' },
          { word: 'GRAVITY', blanks: [1, 4], translation: '引力', clue: '把角色牢牢吸附在地面的力' },
          { word: 'STRATEGY', blanks: [1, 5], translation: '策略', clue: '击败银河掠食者的关键战术' },
          { word: 'ULTIMATE', blanks: [1, 4, 6], translation: '终极的', clue: '最终战役的决战规格' },
          { word: 'ADVENTURE', blanks: [1, 4, 7], translation: '冒险', clue: '零号纪元的星际征途' }
        ]
      }
    };

    // DOM 元素缓存
    this.modal = document.getElementById('modal-english-challenge');
    this.badgeType = document.getElementById('challenge-type-badge');
    this.wordPrompt = document.getElementById('challenge-word-prompt');
    this.phoneticText = document.getElementById('challenge-phonetic');
    this.translationText = document.getElementById('challenge-translation');
    this.micWave = document.getElementById('mic-wave-box');
    this.spellingBox = document.getElementById('spelling-input-box');
    this.virtualKeyboard = document.getElementById('virtual-keyboard');
    this.statusText = document.getElementById('challenge-status-text');
    this.btnListen = document.getElementById('btn-listen-word');
    this.btnRetryMic = document.getElementById('btn-retry-mic');
    this.btnSubmitSpell = document.getElementById('btn-submit-spell');

    // Public showcase: no microphone; explicit self-reading exercise.
    this.recognition = null;
    this.bindEvents();
  }

  // 初始化 Web Speech API 语音识别
  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        this.recognition = new SpeechRec();
        this.recognition.lang = 'en-US';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
          this.isListening = true;
          this.statusText.textContent = "正在聆听... 请清晰大声朗读单词";
          if (this.micWave) this.micWave.style.display = 'flex';
          if (this.btnRetryMic) this.btnRetryMic.style.display = 'none';
        };

        this.recognition.onresult = (event) => {
          const result = event.results[0][0].transcript.trim().toUpperCase();
          this.handleSpeechResult(result);
        };

        this.recognition.onerror = (event) => {
          console.warn("Speech Recognition Error:", event.error);
          this.isListening = false;
          if (this.micWave) this.micWave.style.display = 'none';
          this.statusText.textContent = `识别提示: ${event.error === 'not-allowed' ? '未获麦克风权限' : '未检测到清晰声音'}，请点击重试`;
          if (this.btnRetryMic) this.btnRetryMic.style.display = 'inline-block';
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (this.micWave) this.micWave.style.display = 'none';
        };
      } catch (e) {
        console.warn("SpeechRecognition init failed:", e);
      }
    }
  }

  bindEvents() {
    // 听发音
    if (this.btnListen) {
      this.btnListen.addEventListener('click', () => {
        if (!this.currentTask) return;
        this.speakWord(this.currentTask.word);
      });
    }

    // 重试麦克风
    if (this.btnRetryMic) {
      this.btnRetryMic.addEventListener('click', () => {
        this.startListening();
      });
    }

    // 提交填空拼写
    if (this.btnSubmitSpell) {
      this.btnSubmitSpell.addEventListener('click', () => {
        this.submitSpelling();
      });
    }

    // 生成触屏软键盘 A-Z
    if (this.virtualKeyboard) {
      this.virtualKeyboard.innerHTML = '';
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      letters.forEach(char => {
        const btn = document.createElement('div');
        btn.className = 'key-btn';
        btn.textContent = char;
        btn.addEventListener('click', () => this.onKeyInput(char));
        this.virtualKeyboard.appendChild(btn);
      });

      // 退格键
      const delBtn = document.createElement('div');
      delBtn.className = 'key-btn';
      delBtn.style.width = '64px';
      delBtn.textContent = '←退格';
      delBtn.addEventListener('click', () => this.onKeyDelete());
      this.virtualKeyboard.appendChild(delBtn);
    }

    // 物理键盘监听
    window.addEventListener('keydown', (e) => {
      if (!this.modal || !this.modal.classList.contains('active')) return;
      if (this.currentTask && this.currentTask.type === 'spell') {
        const key = e.key.toUpperCase();
        if (/^[A-Z]$/.test(key)) {
          this.onKeyInput(key);
        } else if (e.key === 'Backspace') {
          this.onKeyDelete();
        } else if (e.key === 'Enter') {
          this.submitSpelling();
        }
      }
    });
  }

  getGradeConfig(gradeId) {
    return this.gradeConfigs[gradeId] || this.gradeConfigs.junior1_up;
  }

  // 根据当前所选等级和题型获取随机题目
  getWordForChallenge(gradeId, type = 'read') {
    const gradeData = this.wordBank[gradeId] || this.wordBank.junior1_up;
    const pool = gradeData[type] || gradeData.read;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return { ...picked, word: picked.word.toUpperCase() };
  }

  // 语音合成朗读提示音
  speakWord(word) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(word);
      utter.lang = 'en-US';
      utter.rate = 0.9;
      window.speechSynthesis.speak(utter);
    }
  }

  // 1. 开始朗读题型（第1关 & 第3关双考之一）
  startReadingChallenge(wordObj, callback, themeOptions = {}) {
    this.currentTask = { ...wordObj, type: 'read' };
    this.onResultCallback = callback;

    this.badgeType.textContent = themeOptions.title || "🎙️ 英语核能充能：单词朗读挑战";
    this.wordPrompt.textContent = wordObj.word;
    this.phoneticText.textContent = wordObj.phonetic || "";
    this.translationText.textContent = `${wordObj.translation}（${themeOptions.subtitle || wordObj.clue}）`;

    if (this.spellingBox) this.spellingBox.style.display = 'none';
    if (this.virtualKeyboard) this.virtualKeyboard.style.display = 'none';
    if (this.btnSubmitSpell) this.btnSubmitSpell.style.display = 'none';
    if (this.btnRetryMic) this.btnRetryMic.style.display = 'none';
    if (this.micWave) this.micWave.style.display = 'flex';

    this.modal.classList.add('active');

    // 自动读一次示范发音
    this.speakWord(wordObj.word);

    // 启动录音监听
    setTimeout(() => this.startListening(), 400);
  }

  startListening() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
      try {
        this.recognition.start();
      } catch (e) {
        this.statusText.textContent = "请直接清晰朗读单词进行识别";
      }
    } else {
      // 浏览器若不支持 Web Speech API，提供轻量智能模拟朗读判定
      this.statusText.innerHTML = "公开试玩为自读练习（不自动评分）。请朗读后点击【我已朗读，继续】。";
      if (this.btnRetryMic) {
        this.btnRetryMic.textContent = "我已朗读，继续";
        this.btnRetryMic.style.display = 'inline-block';
        this.btnRetryMic.onclick = () => {
          this.statusText.textContent = '已完成自读练习（未进行自动语音评分）';
          this.btnRetryMic.disabled = true;
          setTimeout(() => {
            this.modal.classList.remove('active');
            this.btnRetryMic.disabled = false;
            if (this.onResultCallback) this.onResultCallback(true);
          }, 600);
        };
      }
    }
  }

  handleSpeechResult(recognizedText) {
    const target = this.currentTask.word.trim().toUpperCase();
    console.log(`Recognized: "${recognizedText}", Target: "${target}"`);

    // 宽容容错匹配（针对中小学发音口音，包含或相似度超 65% 即判定通过）
    const isCorrect = recognizedText.includes(target) || 
                      target.includes(recognizedText) || 
                      this.calculateSimilarity(recognizedText, target) > 0.65;

    if (isCorrect) {
      this.statusText.innerHTML = `<span style="color:#00ff88; font-weight:bold;">★ 朗读正确！核能充能完成！★</span>`;
      if (window.soundSystem) window.soundSystem.playCorrect();
      setTimeout(() => {
        this.modal.classList.remove('active');
        if (this.onResultCallback) this.onResultCallback(true);
      }, 1200);
    } else {
      this.statusText.innerHTML = `<span style="color:#ff3366; font-weight:bold;">识别到: "${recognizedText}"，发音不符！判定失败</span>`;
      if (window.soundSystem) window.soundSystem.playWrong();
      setTimeout(() => {
        this.modal.classList.remove('active');
        if (this.onResultCallback) this.onResultCallback(false);
      }, 1600);
    }
  }

  // 2. 开始填空拼写题型（第2关 & 第3关双考之二，战斗暂停）
  startSpellingChallenge(wordObj, callback, themeOptions = {}) {
    this.currentTask = { ...wordObj, type: 'spell' };
    this.onResultCallback = callback;
    this.spellBuffer = [];

    this.badgeType.textContent = themeOptions.title || "⌨️ 战舰密码解锁：单词填空挑战";
    this.wordPrompt.textContent = "";
    this.phoneticText.textContent = "";
    this.translationText.textContent = `${wordObj.translation}（${themeOptions.subtitle || wordObj.clue}）`;

    if (this.micWave) this.micWave.style.display = 'none';
    if (this.btnRetryMic) this.btnRetryMic.style.display = 'none';
    if (this.spellingBox) this.spellingBox.style.display = 'flex';
    if (this.virtualKeyboard) this.virtualKeyboard.style.display = 'flex';
    if (this.btnSubmitSpell) this.btnSubmitSpell.style.display = 'inline-block';
    this.statusText.textContent = "请点击字母或使用键盘补全缺失的字母";

    this.renderSpellingBoxes();
    this.modal.classList.add('active');
  }

  renderSpellingBoxes() {
    if (!this.spellingBox) return;
    this.spellingBox.innerHTML = '';
    const word = this.currentTask.word;
    const blanks = this.currentTask.blanks || [1];

    let blankIdxCounter = 0;
    for (let i = 0; i < word.length; i++) {
      const box = document.createElement('div');
      box.className = 'spell-letter-box';
      if (blanks.includes(i)) {
        box.classList.add('blank');
        const filledLetter = this.spellBuffer[blankIdxCounter] || '_';
        box.textContent = filledLetter;
        blankIdxCounter++;
      } else {
        box.textContent = word[i];
      }
      this.spellingBox.appendChild(box);
    }
  }

  onKeyInput(letter) {
    const blanksCount = (this.currentTask.blanks || [1]).length;
    if (this.spellBuffer.length < blanksCount) {
      this.spellBuffer.push(letter);
      this.renderSpellingBoxes();
    }
  }

  onKeyDelete() {
    if (this.spellBuffer.length > 0) {
      this.spellBuffer.pop();
      this.renderSpellingBoxes();
    }
  }

  submitSpelling() {
    const word = this.currentTask.word;
    const blanks = this.currentTask.blanks || [1];
    
    // 还原组装字符串
    let reconstructed = '';
    let blankCounter = 0;
    for (let i = 0; i < word.length; i++) {
      if (blanks.includes(i)) {
        reconstructed += (this.spellBuffer[blankCounter] || ' ');
        blankCounter++;
      } else {
        reconstructed += word[i];
      }
    }

    const isCorrect = reconstructed.toUpperCase() === word.toUpperCase();

    if (isCorrect) {
      this.statusText.innerHTML = `<span style="color:#00ff88; font-weight:bold;">★ 拼写完全正确！指令已授权！★</span>`;
      if (window.soundSystem) window.soundSystem.playCorrect();
      setTimeout(() => {
        this.modal.classList.remove('active');
        if (this.onResultCallback) this.onResultCallback(true);
      }, 1200);
    } else {
      this.statusText.innerHTML = `<span style="color:#ff3366; font-weight:bold;">拼写错误！正确应为: ${word}，判定失败</span>`;
      if (window.soundSystem) window.soundSystem.playWrong();
      setTimeout(() => {
        this.modal.classList.remove('active');
        if (this.onResultCallback) this.onResultCallback(false);
      }, 1600);
    }
  }

  calculateSimilarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
      longer = s2;
      shorter = s1;
    }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - this.editDistance(longer, shorter)) / parseFloat(longerLength);
  }

  editDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
}

window.EnglishJudge = EnglishJudge;
