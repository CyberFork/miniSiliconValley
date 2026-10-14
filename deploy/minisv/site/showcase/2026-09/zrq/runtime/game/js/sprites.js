/* ============================================================
   sprites.js —— 读取旧版精灵表：自动抠掉白底 + 按行切动画
   产出两种东西：
   1) 给网页用的单帧图片（人物卡片、HUD 头像）
   2) 给 three.js 用的逐行动画贴图（丧尸/同伴的 3D 广告牌）
   ============================================================ */
const SHEET_DEFS = {
  hero:   { src: 'assets/sheet_hero.png',   cols: 6, rows: 4 },
  mate:   { src: 'assets/sheet_mate.png',   cols: 6, rows: 4 },
  zombie: { src: 'assets/sheet_zombie.png', cols: 6, rows: 4 },
  boss:   { src: 'assets/sheet_boss.png',   cols: 6, rows: 4 },
};

const SHEETS = {};          // key -> { rows:[canvas], frames:[[dataURL]], idleURL }
const SHEET_READY = { done: false };

function spriteFrameURL(key, row, col) {
  const s = SHEETS[key];
  if (!s || !s.frames[row]) return '';
  return s.frames[row][col] || s.frames[row][0] || '';
}
function spriteIdleURL(key) { return spriteFrameURL(key, 0, 0); }

/* 抠白底：从四边泛洪，只删真正连到边框的白色 */
function keyOutWhite(img) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const idd = cx.getImageData(0, 0, W, H), d = idd.data;
  const isBg = (i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mn > 200 && mx - mn < 32;
  };
  const mark = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, 0); stack.push(x, H - 1); }
  for (let y = 0; y < H; y++) { stack.push(0, y); stack.push(W - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (mark[p] || !isBg(p * 4)) continue;
    mark[p] = 1; d[p * 4 + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  cx.putImageData(idd, 0, 0);
  return cv;
}
/* 找第一帧的实际内容范围，用来把卡片图片裁紧 */
function contentBox(cv, x0, y0, w, h) {
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const d = cx.getImageData(x0, y0, w, h).data;
  let minx = w, miny = h, maxx = -1, maxy = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 16) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  if (maxx < 0) return { x: 0, y: 0, w, h };
  const pad = 4;
  const bx = Math.max(0, minx - pad), by = Math.max(0, miny - pad);
  return {
    x: bx, y: by,
    w: Math.min(w, maxx + pad + 1) - bx,
    h: Math.min(h, maxy + pad + 1) - by,
  };
}

function loadSpriteSheets(onDone) {
  const keys = Object.keys(SHEET_DEFS);
  let left = keys.length;
  const finish = () => { if (--left === 0) { SHEET_READY.done = true; onDone && onDone(); } };
  keys.forEach((key) => {
    const def = SHEET_DEFS[key];
    const img = new Image();
    img.crossOrigin = 'anonymous'; // opaque-origin canvas readback needs runtime CORS
    img.onload = () => {
      try {
        const keyed = keyOutWhite(img);
        const fw = Math.floor(keyed.width / def.cols), fh = Math.floor(keyed.height / def.rows);
        const rows = [], frames = [];
        for (let r = 0; r < def.rows; r++) {
          // 整行画布：给 three.js 做逐帧滚动贴图
          const rowCv = document.createElement('canvas');
          rowCv.width = keyed.width; rowCv.height = fh;
          const rcx = rowCv.getContext('2d');
          rcx.drawImage(keyed, 0, r * fh, keyed.width, fh, 0, 0, keyed.width, fh);
          rows.push(rowCv);
          // 每帧单独导出：给网页用
          const fr = [];
          for (let c = 0; c < def.cols; c++) {
            const box = contentBox(keyed, c * fw, r * fh, fw, fh);
            const one = document.createElement('canvas');
            one.width = box.w; one.height = box.h;
            one.getContext('2d').drawImage(keyed, c * fw + box.x, r * fh + box.y, box.w, box.h, 0, 0, box.w, box.h);
            fr.push(one.toDataURL());
          }
          frames.push(fr);
        }
        SHEETS[key] = { rows, frames, cols: def.cols, cellW: fw, cellH: fh };
      } catch (e) { console.warn('精灵表处理失败：' + key + '（改用备用画法）', e); makeFallbackSheet(key); }
      finish();
    };
    img.onerror = () => { console.warn('精灵表加载失败：' + def.src + '（改用备用画法）'); makeFallbackSheet(key); finish(); };
    img.src = def.src;
  });
}

/* ---- 备用画法：如果精灵表打不开（例如用 file:// 直接打开），
        就现场画一个简易的恐怖剪影，保证游戏照样能玩 ---- */
function makeFallbackSheet(key) {
  const def = SHEET_DEFS[key];
  const CW = 64, CH = 64, cols = def.cols, rows = def.rows;
  const cv = document.createElement('canvas');
  cv.width = CW * cols; cv.height = CH * rows;
  const cx = cv.getContext('2d');
  const palette = {
    hero: ['#3b6ea5', '#e0b48a', '#c0562b'],
    mate: ['#7d5fa8', '#f0d0b0', '#9ad0e0'],
    zombie: ['#6f8a4a', '#a8c07a', '#3a3f33'],
    boss: ['#8a3f5a', '#c88a9a', '#2b2320'],
  };
  const p = palette[key] || palette.zombie;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * CW, y = r * CH;
      const bob = Math.sin((c / cols) * Math.PI * 2) * 3;
      const lean = r === 1 ? Math.sin((c / cols) * Math.PI * 2) * 4 : (r === 2 ? 5 : 0);
      const fade = r === 3 ? 1 - c / cols : 1;
      cx.globalAlpha = Math.max(0.15, fade);
      // 腿
      cx.fillStyle = '#2b2f36';
      cx.fillRect(x + 22 + lean, y + 40, 8, 18);
      cx.fillRect(x + 34 + lean, y + 40, 8, 18);
      // 身体
      cx.fillStyle = p[0];
      cx.fillRect(x + 18 + lean, y + 22 + bob, 28, 22);
      // 手臂（攻击行抬手）
      cx.fillStyle = p[1];
      const armLift = r === 2 ? -10 : 0;
      cx.fillRect(x + 10 + lean, y + 24 + armLift + bob, 8, 20);
      cx.fillRect(x + 46 + lean, y + 24 + armLift + bob, 8, 20);
      // 头
      cx.fillStyle = p[1];
      cx.beginPath(); cx.arc(x + 32 + lean, y + 15 + bob, 11, 0, Math.PI * 2); cx.fill();
      // 眼睛 / 嘴
      cx.fillStyle = r === 3 ? '#777' : '#c0392b';
      cx.fillRect(x + 27 + lean, y + 13 + bob, 4, 3);
      cx.fillRect(x + 34 + lean, y + 13 + bob, 4, 3);
      cx.fillStyle = '#33100f';
      cx.fillRect(x + 28 + lean, y + 20 + bob, 9, 3);
    }
  }
  cx.globalAlpha = 1;
  const frames = [];
  const fw = CW, fh = CH;
  for (let r = 0; r < rows; r++) {
    const row = [];
    const rowCv = document.createElement('canvas');
    rowCv.width = cv.width; rowCv.height = fh;
    rowCv.getContext('2d').drawImage(cv, 0, r * fh, cv.width, fh, 0, 0, cv.width, fh);
    for (let c = 0; c < cols; c++) {
      const one = document.createElement('canvas');
      one.width = fw; one.height = fh;
      one.getContext('2d').drawImage(cv, c * fw, r * fh, fw, fh, 0, 0, fw, fh);
      row.push(one.toDataURL());
    }
    frames.push(row);
  }
  const rowsCv = [];
  for (let r = 0; r < rows; r++) {
    const rowCv = document.createElement('canvas');
    rowCv.width = cv.width; rowCv.height = fh;
    rowCv.getContext('2d').drawImage(cv, 0, r * fh, cv.width, fh, 0, 0, cv.width, fh);
    rowsCv.push(rowCv);
  }
  SHEETS[key] = { rows: rowsCv, frames, cols, cellW: CW, cellH: CH, fallback: true };
}

/* three.js 贴图：一行 = 一个动作，贴图靠 offset 播放 */
function sheetRowTexture(rowCanvas, cols) {
  const tex = new THREE.CanvasTexture(rowCanvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1 / cols, 1);
  tex.offset.set(0, 0);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
/* 每个生物自己的动画播放器 */
function makeSpriteAnim(key, target) {
  const s = SHEETS[key];
  if (!s) return null;
  const rows = s.rows.map((cv) => sheetRowTexture(cv, s.cols));
  const st = {
    key, rows, tex: rows[0], cols: s.cols,
    rowIdx: 0, frame: 0, fps: 7, t: 0,
    acts: { idle: 0, walk: 1, atk: 2, hurt: 3, die: 3 },
    setAct(a) {
      const i = st.acts[a] !== undefined ? st.acts[a] : 0;
      if (i !== st.rowIdx) { st.rowIdx = i; st.rowFrames = []; st.tex = rows[i]; st.frame = 0; }
      if (target && target.material) target.material.map = st.tex;
    },
    update(dt, moving, scaleFps) {
      const fps = (moving ? 9 : 6) * (scaleFps || 1);
      st.t += dt;
      if (st.t > 1 / fps) {
        st.t = 0;
        st.frame = (st.frame + 1) % st.cols;
        st.tex.offset.x = st.frame / st.cols;
      }
    },
  };
  st.setAct('idle');
  return st;
}
