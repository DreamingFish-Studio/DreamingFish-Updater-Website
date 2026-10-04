/*
 * DreamingFish Updater 宣传片 · 时间轴引擎
 * 每一帧都只由时间 t 决定（没有 CSS 动画、没有随机数），所以可以任意拖动进度、暂停、
 * 以及逐帧导出成视频。画布固定 1920 × 1080，按窗口大小等比缩放。
 */
(() => {
  'use strict';

  // 第 03 章（版本直达）比初版多了 EXT 秒；它之后的场景沿用原来的内部时间，渲染时整体顺延 EXT
  const EXT = 5, SHIFT_FROM = 52.5;
  const DUR = 117.5 + EXT;
  const CHAPTERS = [
    [0, '序章'], [10, '梦鱼更新器'], [17.5, '玩家体验'], [30, '专属界面'], [40, '直达最新'],
    [57.5, '服主管理端'], [70, '维护方式'], [82.5, '安全与原子性'], [97.5, '更多能力'], [110, '开始使用'],
  ];
  const HUD_CH = [
    [17.5, '01', '玩家体验'], [30, '02', '个性化'], [40, '03', '任意版本直达最新'], [57.5, '04', '服主管理端'],
    [70, '05', '维护方式'], [82.5, '06', '安全与原子性'], [97.5, '07', '更多能力'],
  ];
  const HUD_END = 107.5;

  const qs = new URLSearchParams(location.search);
  const MODE = qs.has('render') ? 'render' : qs.has('record') ? 'record' : 'play';
  // 背景着色器的分辨率倍数（默认 960 × 540；导出 2K 时传 ?bg=1.333 让背景更清晰）
  const BGQ = Math.min(2, Math.max(0.5, parseFloat(qs.get('bg')) || 1));
  document.body.classList.add(MODE);

  // ---------------------------------------------------------------- 工具
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    lin: x => x,
    inQ: x => x * x,
    outQ: x => 1 - (1 - x) * (1 - x),
    inC: x => x * x * x,
    outC: x => 1 - Math.pow(1 - x, 3),
    ioC: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outX: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    ioS: x => -(Math.cos(Math.PI * x) - 1) / 2,
    outB: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const P = (t, a, b, e = E.outC) => e(clamp((t - a) / (b - a)));
  const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function kf(t, f, e = E.ioC) {
    if (t <= f[0][0]) return f[0][1];
    for (let i = 1; i < f.length; i++) {
      if (t <= f[i][0]) {
        const [t0, v0] = f[i - 1], [t1, v1] = f[i];
        const p = t1 === t0 ? 1 : e((t - t0) / (t1 - t0));
        return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], p)) : lerp(v0, v1, p);
      }
    }
    return f[f.length - 1][1];
  }
  function S(el, o) {
    if (!el) return;
    let tr = '';
    if (o.x || o.y || o.z) tr += `translate3d(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px,${(o.z || 0).toFixed(1)}px)`;
    if (o.rx) tr += ` rotateX(${o.rx.toFixed(2)}deg)`;
    if (o.ry) tr += ` rotateY(${o.ry.toFixed(2)}deg)`;
    if (o.rz) tr += ` rotate(${o.rz.toFixed(2)}deg)`;
    if (o.s !== undefined && o.s !== 1) tr += ` scale(${o.s.toFixed(4)})`;
    if (o.sx !== undefined) tr += ` scaleX(${o.sx.toFixed(4)})`;
    el.style.transform = tr || 'none';
    if (o.o !== undefined) {
      const v = clamp(o.o);
      el.style.opacity = v >= 0.999 ? '1' : v.toFixed(3);
      el.style.visibility = v <= 0.001 ? 'hidden' : '';
    }
    if (o.b !== undefined) el.style.filter = o.b > 0.05 ? `blur(${o.b.toFixed(2)}px)` : 'none';
  }
  const setText = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s; } };
  const setHTML = (el, s) => { if (el._h !== s) { el._h = s; el.innerHTML = s; } };

  // 逐字拆分，用于逐字入场
  const GRAD = [[46, 232, 223], [176, 108, 255]];
  function split(el) {
    if (el._ch) return el._ch;
    const out = [];
    (function walk(n) {
      for (const c of Array.from(n.childNodes)) {
        if (c.nodeType === 3) {
          if (!c.textContent.trim()) continue;
          const f = document.createDocumentFragment();
          for (const ch of c.textContent.replace(/\s+/g, ' ')) {
            const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; f.appendChild(s); out.push(s);
          }
          c.replaceWith(f);
        } else if (c.nodeType === 1) {
          if (c.classList.contains('ch')) out.push(c); else walk(c);
        }
      }
    })(el);
    el._ch = out;
    return out;
  }
  function chars(el, t, t0, o = {}) {
    const cs = split(el);
    const st = o.st ?? 0.04, d = o.d ?? 0.75, dy = o.dy ?? 46, bl = o.bl ?? 10, e = o.e || E.outX;
    for (let i = 0; i < cs.length; i++) {
      const p = P(t, t0 + i * st, t0 + i * st + d, e);
      const c = cs[i].style;
      c.opacity = p >= 0.999 ? '1' : p.toFixed(3);
      c.transform = p >= 0.999 ? 'none' : `translate3d(0,${((1 - p) * dy).toFixed(1)}px,0)`;
      c.filter = bl && p < 0.98 ? `blur(${((1 - p) * bl).toFixed(1)}px)` : 'none';
    }
  }
  function fadeIn(el, t, t0, d = 0.7, dy = 30, e = E.outC) {
    const p = P(t, t0, t0 + d, e); S(el, { y: (1 - p) * dy, o: p }); return p;
  }
  function cursor(el, t, path, clicks, tIn, tOut) {
    const x = kf(t, path.map(p => [p[0], p[1]])), y = kf(t, path.map(p => [p[0], p[2]]));
    let press = 0, rip = -1;
    for (const c of clicks) { press = Math.max(press, bump(t, c, 0.12)); if (t >= c && t < c + 0.6) rip = (t - c) / 0.6; }
    const o = P(t, tIn, tIn + 0.25) * (1 - P(t, tOut, tOut + 0.3));
    S(el, { x: x - 8, y: y - 4, s: 1 - 0.16 * press, o });
    const r = el.firstElementChild;
    if (rip >= 0) S(r, { s: lerp(0.3, 1.7, E.outC(rip)), o: 1 - rip }); else S(r, { o: 0 });
  }
  function localPos(el, root, fx = 0.5, fy = 0.5) {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return [x + el.offsetWidth * fx, y + el.offsetHeight * fy];
  }
  const bez = (x0, y0, cx, cy, x1, y1, u) => [
    (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1,
    (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1,
  ];
  const mixHex = (a, b, p) => {
    const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], p))).join(',')})`;
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  // 像素风头像（Minecraft 皮肤脸）
  function pixelFace(seed) {
    const r = rng(seed * 9973 + 17);
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const g = c.getContext('2d');
    const skins = ['#f2c9a0', '#d9a477', '#a8714a', '#f5d6b8', '#8d5a3b'];
    const hairs = ['#3b2414', '#1d1d1d', '#c48a3a', '#6b3f1f', '#e6e0d0', '#7a2f2f', '#2e4a7a', '#4a2a5e'];
    g.fillStyle = skins[Math.floor(r() * skins.length)]; g.fillRect(0, 0, 8, 8);
    g.fillStyle = hairs[Math.floor(r() * hairs.length)]; g.fillRect(0, 0, 8, 2); g.fillRect(0, 2, 1, 2); g.fillRect(7, 2, 1, 2);
    if (r() > 0.5) g.fillRect(1, 2, 2, 1); else g.fillRect(5, 2, 2, 1);
    g.fillStyle = '#fff'; g.fillRect(1, 4, 2, 1); g.fillRect(5, 4, 2, 1);
    g.fillStyle = ['#3a5bd9', '#2f8f4e', '#6b3f1f', '#7a3fd0'][Math.floor(r() * 4)]; g.fillRect(2, 4, 1, 1); g.fillRect(5, 4, 1, 1);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(3, 5, 2, 1);
    g.fillStyle = '#6b3a2a'; g.fillRect(2, 6, 4, 1);
    return c.toDataURL();
  }

  // ---------------------------------------------------------------- 内容数据
  const CHAT = [
    [0.45, '小鱼干', '服主，我进不去服务器了', 1],
    [1.15, '阿涛', '又要重新下整合包吗？2.8 个 G……', 2],
    [1.85, '冰糖雪梨', '删哪个模组？能不能说清楚点', 3],
    [2.4, 'Steve_07', '覆盖完直接崩了', 4],
    [2.85, '夜航', '我改好的配置怎么又没了', 5],
    [3.2, '小鱼干', '版本不一致，被服务器踢出来了', 1],
    [3.5, '阿涛', '@服主 在吗', 2],
    [3.74, '冰糖雪梨', '@服主', 3],
    [3.95, 'Steve_07', '@服主 @服主', 4],
    [4.13, '夜航', '同问，进不去', 5],
    [4.29, '木木', '+1', 6],
    [4.43, '小鱼干', '？？？', 1],
    [4.56, 'Kiri', '进不去 +1', 7],
    [4.67, '阿涛', '@服主', 2],
    [4.77, '木木', '在吗在吗', 6],
    [4.86, 'Kiri', '@服主', 7],
    [4.94, '冰糖雪梨', '服主人呢', 3],
    [5.02, '夜航', '@服主', 5],
    [5.09, 'Steve_07', '？', 4],
    [5.16, '木木', '@服主', 6],
  ];
  const ERRS = [
    [2.05, '✕', '缺少前置模组：create ≥ 6.0', 60, 170, -3, ''],
    [2.95, '!', '模组列表与服务器不一致', 1360, 300, 2, 'warn'],
    [3.6, '✕', '解压失败：压缩包已损坏', 50, 760, 2, ''],
    [4.2, '✕', 'Game crashed · exit code 1', 1290, 610, -2, ''],
    [4.62, '!', '连接已断开：Mod rejections', 1180, 880, 3, 'warn'],
    [4.85, '✕', '找不到 mods/jei-19.21.0.jar', 90, 470, -4, ''],
  ];
  // 玩家端窗口：文案与状态都取自 player-ui 的真实界面（阶段名、进度卡、备份提示、启动提示）
  const THEMES = [
    {
      brand: '梦鱼服', img: 'assets/cover-dreamhaven.png', acc: '#2ee8df', acc2: '#b06cff',
      kicker: '欢迎来到', title: '梦屿', sub: '灾变之后，仍然有人在这里守望。', nav: ['主页', '新闻', '玩法介绍', '关于更新器'],
      news: ['最新新闻 · 2026.07.30', '初识梦屿：灯还亮着', '一座让普通人安心生活的梦屿，一片仍在等待的外缘带，以及一名选择最后离开的线路维护员。', '查看全文 ›'],
      sum: null, state: '正在检查更新', pct: '--', detail: '正在连接更新服务', dl: '正在计算变更', note: '',
      music: '周杰伦  爱琴海', player: '__HanHanYu__', label: '模组服', labelSub: '梦屿',
    },
    {
      brand: '机巧方舟', img: 'assets/cover-technical.png', acc: '#ffa45c', acc2: '#ffd27a',
      kicker: '欢迎来到', title: '机巧方舟', sub: '让每一台机器，都成为世界的一部分。', nav: ['主页', '工程周报', '蓝图中心', '关于更新器'],
      news: ['工程周报 · 第 38 期', '全物品仓储区正式启用', '新增参观路线与公共材料领取点，欢迎带着蓝图来交流。', '查看工程记录 ›'],
      sum: ['版本 R38', '生电模组与公共蓝图已更新', '安装 / 更新 12 项  ·  本地停用 1 项'],
      state: '更新已经完成', pct: '100%', detail: 'Minecraft 正在继续启动', dl: '已下载 31.2 MB', note: '',
      music: '齿轮与蒸汽', player: 'Redstone_07', label: '生电服', labelSub: '机巧方舟',
    },
    {
      brand: '橡木原野', img: 'assets/cover-vanilla.png', acc: '#a6e36b', acc2: '#f4d36b',
      kicker: '原版生存', title: '橡木原野', sub: '慢慢盖房子，也慢慢认识新朋友。', nav: ['主页', '村庄公告', '世界地图', '关于更新器'],
      news: ['村庄公告 · 今天', '河岸集市今晚开放', '带上你收获的作物，来交换新的故事。', '查看公告 ›'],
      sum: null, state: '已是最新版本', pct: '100%', detail: 'Minecraft 正在继续启动', dl: '本地文件已验证',
      note: '保留了你修改过的 1 个配置；另有 2 个玩家自选模组已保留  ›',
      music: '原野晨曲', player: 'Steve', label: '原版服', labelSub: '橡木原野',
    },
    {
      brand: '余烬防线', img: 'assets/cover-zombie.png', acc: '#ff7a50', acc2: '#ffb35c',
      kicker: '灾变生存', title: '余烬防线', sub: '天黑之前，守住最后一道防线。', nav: ['主页', '行动简报', '据点地图', '关于更新器'],
      news: ['行动简报 · 第 12 夜', '东区补给站已收复', '夜间尸潮规模上调，请结伴行动。', '查看简报 ›'],
      sum: ['版本 2.3', '尸潮规则与据点物资已调整', '安装 / 更新 6 项  ·  删除 1 项'],
      state: '更新已经完成', pct: '100%', detail: 'Minecraft 正在继续启动', dl: '已下载 12.4 MB', note: '',
      music: '最后一夜', player: 'Survivor_42', label: '灾变服', labelSub: '余烬防线',
    },
  ];
  const DL_FILES = [
    'mods/create-1.21.1-6.0.4.jar', 'mods/dreamhaven-quests-2.0.jar', 'mods/jei-19.21.2.jar', 'config/dreamhaven/quests.json',
    'resourcepacks/DreamHaven-UI.zip', 'mods/sodium-0.6.5.jar', 'mods/sophisticatedbackpacks-3.23.jar', 'kubejs/server_scripts/rules.js',
  ];
  // 第 03 章：整合包 1.0 → 1.7 期间发生的事
  const VERS = ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7'];
  const VCARDS = [
    [1, '#5ee59a', '新增', '加入 机械动力', 'Create 6.0 与 6 个附属模组'],
    [2, '#ff6b78', '删除', '移除 OptiFine', '和 Sodium 冲突，进服就崩'],
    [3, '#b06cff', '可选', '光影、远景设为可选', '显卡带不动的玩家可以关'],
    [4, '#ff6b78', '报错', 'JEI 新版本报错', '部分玩家一进游戏就崩溃'],
    [5, '#f4c26b', '撤回', '撤回 JEI 问题版本', '退回上一个稳定版'],
    [6, '#f4c26b', '冲突', '整合包加入小地图', '和玩家自己装的重复了'],
    [7, '#2ee8df', '修正', '修正任务配置', '所有人必须保持一致'],
  ];
  const VC_T = VCARDS.map((c, k) => 41.6 + k * 0.8);
  const ICONS = {
    refresh: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M17.8 3.5v3.6h-3.6M6.2 20.5v-3.6h3.6"/>',
    cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.2 4.7 4.7 0 0 0 7 18.5z"/>',
    offline: '<path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 12a9.5 9.5 0 0 1 13 0M8.6 15.4a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1.2"/><path d="M3.5 3.5l17 17"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    cube: '<path d="M12 2.8 20 7.2v9.6l-8 4.4-8-4.4V7.2z"/><path d="M4 7.2l8 4.4 8-4.4M12 11.6v9.6"/>',
    ok: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.2l2.7 2.7L16.2 9"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
    code: '<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>',
    shield: '<path d="M12 2.8 19.5 6v5.6c0 4.6-3.2 8.2-7.5 9.6-4.3-1.4-7.5-5-7.5-9.6V6z"/><path d="M8.6 12.2l2.4 2.4 4.6-4.8"/>',
    down: '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 16.5v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5"/>',
    hash: '<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15.5M4 15h15.5"/>',
    archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1"/><path d="M5 8.5v10A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-10M10 12.5h4"/>',
    log: '<path d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h5"/>',
    swap: '<path d="M4.5 8.5h13l-3.5-3.5M19.5 15.5h-13l3.5 3.5"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.6 2.6 5-5.2"/>',
  };
  const TILES = [
    ['#2ee8df', 'refresh', '玩家端自动更新', '界面和功能升级，<br>玩家端自己完成'],
    ['#b06cff', 'cloud', '外部托管与 CDN', 'WebDAV · OSS<br>S3 · R2'],
    ['#f4c26b', 'offline', '离线也能进游戏', '更新服务暂时离线，<br>仍可用上次验证的版本'],
    ['#5ee59a', 'play', '无缝接入启动器', 'PCL · HMCL<br>照常点击启动'],
    ['#ff9b6a', 'cube', '主流加载器', 'Forge · NeoForge<br>Fabric'],
    ['#2ee8df', 'ok', '开箱即用', '自带运行环境，<br>无需另装 Java'],
    ['#b06cff', 'book', '保姆级教程', '从部署到首次启动，<br>每一步都写清楚'],
    ['#f4c26b', 'code', '开源', 'AGPL-3.0 许可，<br>代码完全公开'],
  ];
  const PIPE = [
    ['shield', '验证签名', 'Ed25519 ✓'], ['down', '下载到暂存区', 'staging/'], ['hash', '校验文件', 'SHA-256 ✓'],
    ['archive', '备份旧文件', 'backups/'], ['log', '写入事务日志', 'journal'], ['swap', '替换并复查', 'verify'], ['check', '提交', 'COMMIT'],
  ];
  const HASH = '9f2c7a41e0b3d5c8a1f64e27b9d03c5e8a7f1b2c4d6e8f0a1b3c5d7e9f02e81a';

  // ---------------------------------------------------------------- 构建
  const R = {};   // 元素引用
  const POS = {}; // 预先量好的局部坐标
  let msgs = [], errs = [], wins = [], labels = [], tilesArr = [], pipeNodes = [];
  const VT = {};

  function build() {
    // 群聊
    const list = $('#chat-list');
    msgs = CHAT.map(([t, name, text, seed]) => {
      const m = document.createElement('div');
      m.className = 'msg';
      m.innerHTML = `<i class="avatar"></i><div class="msg-body"><b>${name}</b><p>${text}</p></div>`;
      m.firstElementChild.style.backgroundImage = `url(${pixelFace(seed)})`;
      list.appendChild(m);
      return { el: m, t, h: 0 };
    });
    $$('.acct-face').forEach(e => { e.style.backgroundImage = `url(${pixelFace(+e.dataset.seed)})`; });
    const errBox = $('#errs');
    errs = ERRS.map(([t, ic, text, x, y, r, cls]) => {
      const e = document.createElement('div');
      e.className = 'err ' + cls;
      e.innerHTML = `<i>${ic}</i><span>${text}</span>`;
      errBox.appendChild(e);
      return { el: e, t, x, y, r };
    });
    R.typingDots = $$('#chat-typing i');

    // 玩家端窗口
    const stack = $('#pw-stack');
    const labBox = $('#pw-labels');
    wins = THEMES.map((th, i) => {
      const w = document.createElement('div');
      w.className = 'pw';
      w.style.setProperty('--acc', th.acc);
      w.style.setProperty('--acc2', th.acc2);
      const sum = th.sum || ['版本 1.7', '新增守望者任务线，优化远景渲染与更新提示', '安装 / 更新 8 项  ·  备份 1 项'];
      w.innerHTML = `<div class="pw-clip">
        <img class="pw-bg" src="${th.img}" alt="">
        <div class="pw-shade"></div><div class="pw-wash"></div>
        <div class="pw-welcome"><span>${th.kicker}</span><strong>${th.title}</strong><p>${th.sub}</p></div>
        <div class="pw-news"><div class="m">${th.news[0]}</div><h3>${th.news[1]}</h3><p>${th.news[2]}</p><a>${th.news[3]}</a></div>
        <div class="pw-upd">
          <div class="pw-sum"${th.sum || i === 0 ? '' : ' style="display:none"'}><div class="v">${sum[0]}</div><div class="c">${sum[1]}</div><div class="n">${sum[2]}</div></div>
          <div class="pw-prog"><div class="pw-ph"><strong class="st">${th.state}</strong><b class="pct">${th.pct}</b></div>
            <span class="pw-detail">${th.detail}</span><div class="pw-track"><i></i></div>
            <div class="pw-links"><span class="dl">${th.dl}</span><span>更新记录  ›</span><span>运行记录  ›</span><span>本地文件  ›</span></div>
            <div class="pw-note"${th.note || i === 0 ? '' : ' style="display:none"'}>${th.note}</div></div>
        </div>
        <div class="pw-music"><span class="mn">♪</span><span class="mc"><span class="ml">音乐</span><span class="mt">${th.music}</span></span><span class="mg">⌃</span><span class="mp"></span></div>
        <div class="pw-id"><i></i><div><small>当前玩家</small><strong>${th.player}</strong></div></div>
        <div class="pw-ver">DreamingFish Updater 0.2.0</div>
        <div class="pw-launch"><div><i>✓</i><span class="pw-launch-t">Minecraft 已开始启动 · 12 秒后自动关闭</span></div></div>
        <div class="pw-title"><div class="pw-brand"><b>${th.brand}</b><span>DreamingFish</span></div>
          <nav class="pw-nav">${th.nav.map((n, k) => `<span${k ? '' : ' class="on"'}>${n}</span>`).join('')}</nav>
          <div class="pw-ctl"><i class="g-min"></i><i class="g-max"></i><i class="g-x"><i></i><i></i></i></div></div>
        <i class="pw-rim"></i>
        <i class="wipe-edge"></i>
      </div>`;
      stack.appendChild(w);
      const lab = document.createElement('div');
      lab.className = 'pw-label';
      lab.style.setProperty('--acc', th.acc);
      lab.innerHTML = `<i></i>${th.label}<span>· ${th.labelSub}</span>`;
      labBox.appendChild(lab);
      labels.push(lab);
      const r = {
        el: w, clip: $('.pw-clip', w), bg: $('.pw-bg', w), sum: $('.pw-sum', w), note: $('.pw-note', w),
        launch: $('.pw-launch', w), launchT: $('.pw-launch-t', w),
        st: $('.st', w), pct: $('.pct', w), detail: $('.pw-detail', w), bar: $('.pw-track i', w), dl: $('.dl', w), edge: $('.wipe-edge', w),
      };
      S(r.launch, { o: 0 });
      if (i > 0) r.bar.style.transform = 'scaleX(1)';
      return r;
    });

    // 版本轨道 1.0 → 1.7
    const root = $('#vt-root');
    VT.TY = 480; VT.NX = i => 260 + i * 200;
    const TY = VT.TY, NX = VT.NX;
    VT.track = svgEl('path', { d: `M190 ${TY} H1730`, stroke: 'rgba(255,248,220,.22)', 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none', pathLength: 1 }, root);
    VT.lit = svgEl('path', { d: `M${NX(0)} ${TY} H${NX(7)}`, stroke: 'url(#litg)', 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none', opacity: 0.85 }, root);
    VT.links = VCARDS.map(([i]) => svgEl('path', {
      d: `M${NX(i)} ${TY + 22} V${i % 2 ? 540 : 710}`, stroke: 'rgba(255,248,220,.28)', 'stroke-width': 2, 'stroke-dasharray': '4 6', fill: 'none',
    }, root));
    VT.arc = { x0: NX(2), x1: NX(7), c: [(NX(2) + NX(7)) / 2, TY - 330] };
    VT.arcEl = svgEl('path', { d: `M${VT.arc.x0} ${TY} Q${VT.arc.c[0]} ${VT.arc.c[1]} ${VT.arc.x1} ${TY}`, stroke: 'url(#arcg)', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round', filter: 'url(#aglow)', pathLength: 1 }, root);
    VT.parts = [0, 1, 2, 3].map(() => svgEl('circle', { r: 6, fill: '#fff8dc', filter: 'url(#aglow)' }, root));
    VT.glow = svgEl('circle', { cx: NX(7), cy: TY, r: 50, fill: 'rgba(46,232,223,.16)' }, root);
    VT.burst = svgEl('circle', { cx: NX(7), cy: TY, r: 30, fill: 'none', stroke: '#2ee8df', 'stroke-width': 4 }, root);
    VT.nodes = []; VT.labels = [];
    VERS.forEach((v, i) => {
      const latest = i === 7;
      VT.nodes.push(svgEl('circle', { cx: NX(i), cy: TY, r: latest ? 24 : 15, fill: '#0b1216', stroke: latest ? '#2ee8df' : 'rgba(255,248,220,.55)', 'stroke-width': latest ? 5 : 3.5 }, root));
      const tx = svgEl('text', { x: NX(i), y: TY - (latest ? 46 : 36), 'text-anchor': 'middle', class: 'vt-label' + (latest ? ' latest' : '') }, root);
      tx.textContent = v;
      VT.labels.push(tx);
    });
    VT.tag = svgEl('text', { x: NX(7) + 40, y: TY + 10, class: 'vt-tag' }, root);
    VT.tag.textContent = '最新';
    VT.token = svgEl('circle', { r: 12, fill: '#fff8dc', filter: 'url(#aglow)' }, root);
    // 每个版本的变化卡片：奇数版本在上一排、偶数版本在下一排
    const vbox = $('#vcards');
    VT.cards = VCARDS.map(([i, c, tag, title, sub]) => {
      const el = document.createElement('div');
      el.className = 'vcard';
      el.style.setProperty('--c', c);
      el.innerHTML = `<div class="vc-top"><b>${VERS[i]}</b><em>${tag}</em></div><h4>${title}</h4><p>${sub}</p>`;
      vbox.appendChild(el);
      return { el, i, x: NX(i) - 190, y: i % 2 ? 540 : 710 };
    });
    $$('.vchip-face').forEach(e => { e.style.backgroundImage = `url(${pixelFace(1)})`; });

    // 安全流水线
    const pipe = $('#pipe');
    pipe.insertAdjacentHTML('beforeend', '<i class="pipe-line"></i><i class="pipe-fill" id="pipe-fill"></i>');
    pipeNodes = PIPE.map(([ic, name, code], i) => {
      const n = document.createElement('div');
      n.className = 'pn';
      n.style.left = 180 + i * 260 + 'px';
      n.innerHTML = `<div class="pn-c"><i class="pn-ring"></i><svg viewBox="0 0 24 24">${ICONS[ic]}</svg></div><b>${name}</b><code>${code}</code>`;
      pipe.appendChild(n);
      return { el: n, c: $('.pn-c', n), ring: $('.pn-ring', n), svg: $('svg', n), b: $('b', n), code: $('code', n), state: '' };
    });

    // 能力卡片
    const tb = $('#tiles');
    tilesArr = TILES.map(([c, ic, title, text], i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = col * 444, y = row * 354;
      const el = document.createElement('div');
      el.className = 'tile';
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.setProperty('--c', c);
      el.innerHTML = `<div class="tile-f"><div class="t-ic"><svg viewBox="0 0 24 24">${ICONS[ic]}</svg></div><h4>${title}</h4><p>${text}</p><i class="tile-glow"></i></div>
        <div class="tile-b" style="background-position:${-(84 + x)}px ${-(266 + y)}px"></div>`;
      tb.appendChild(el);
      return { el, col, row, glow: $('.tile-glow', el) };
    });

    // 引用
    Object.assign(R, {
      s0: $('#s0'), chat: $('#chat'), typing: $('#chat-typing'),
      hook: $('#hook'), hl1: $('.hook-l1'), hl2: $('.hook-l2'),
      rays: $('#rays'), lockup: $('#lockup'), logoBig: $('#logo-big'), wm: $$('#wordmark span'), cn: $('#cn-name'),
      pills: $('#pills'), pillSpans: $$('#pills span'), pillDots: $$('#pills i'), logoSub: $('#logo-sub'),
      lgFrame: $('.lg-frame'), lgBody: $('.lg-body'), lgBelly: $('.lg-belly'), lgGill: $('.lg-gill'), lgEye: $('.lg-eye'), lgFill: $('.lg-fill'),
      s2copy: $('#s2-copy'), s2kick: $('#s2-copy .kicker'), s2l1: $('#s2-l1'), s2l2: $('#s2-l2'), s2feats: $$('#s2-feats li'),
      launcher: $('#launcher'), launchBtn: $('#launch-btn'), curLaunch: $('#cur-launch'),
      s3top: $('#s3-top'), s3kick: $('#s3-top .kicker'), s3h: $('#s3-h'), s3sub: $('#s3-sub'),
      s4: $('#s4'), s4top: $('#s4-top'), s4kick: $('#s4-kicker'), s4h: [$('#s4-h1'), $('#s4-h2'), $('#s4-h3')], vtrack: $('#vtrack'),
      vchip: $('#vchip'), vchipNote: $('#vchip-note'), vrider: $('#vrider'), vmiss: $('#vmiss'),
      plan: $('#plan'), planRows: $$('#plan-rows .plan-row'), pfA: $('#pf-a'), pfB: $('#pf-b'), pfC: $('#pf-c'), planFoot: $('#plan-foot'),
      s5copy: $('#s5-copy'), s5kick: $('#s5-copy .kicker'), s5l1: $('#s5-l1'), s5l2: $('#s5-l2'), steps: $$('#s5-steps li'), s5chips: $$('#s5-chips span'),
      ffiles: $$('#fly-files .ffile'), admin: $('#admin'), admToast: $('#adm-toast'), admToast2: $('#adm-toast2'), admScan: $('#adm-scan'), admSpin: $('#adm-spin'),
      admScanLabel: $('#adm-scan span'), admTime: $('#adm-check-time'), admMetrics: $$('#adm-metrics b'), admRows: $$('#adm-rows .adm-tr'),
      admEmpty: $('#adm-empty'), admBulk: $('#adm-bulk'), admBadge: $('#adm-badge'), admScroll: $('#adm-scroll'), admRm: $('#adm-rm'),
      admSide: $('.adm-side'), admWork: $('.adm-work'), admModal: $('#adm-modal'), admDialog: $('#adm-dialog'), admConfirm: $('#adm-confirm'),
      admPub: $('#adm-pub'), admPubLabel: $('#adm-pub-label'), admStamp: $('#adm-stamp'), stampCard: $('#adm-stamp .stamp-card'), stampCheck: $('#adm-stamp .stamp-check'),
      curAdmin: $('#cur-admin'),
      s6top: $('#s6-top'), s6kick: $('#s6-top .kicker'), s6l1: $('#s6-l1'), s6l2: $('#s6-l2'), pcards: $$('#pcards .pcard'),
      s6copy: $('#s6-copy'), s6bl1: $('#s6b-l1'), s6bl2: $('#s6b-l2'), s6feats: $$('#s6-feats li'), s6foot: $('#s6-foot'),
      local: $('#local'), locInner: $('#local .loc-inner'), opt0: $('#opt-0'), opt0st: $('#opt-0-st'), opt0reset: $('#opt-0-reset'), sw0: $('#sw-0'),
      tabFiles: $('#tab-files'), tabBk: $('#tab-bk'), pgFiles: $('#pg-files'), pgBk: $('#pg-bk'),
      bk0: $('#bk-0'), bk0btn: $('#bk-0-btn'), curLocal: $('#cur-local'),
      s7: $('#s7'), s7head: $('#s7-head'), s7kick: $('#s7-kicker'), s7l1: $('#s7-l1'), s7l2: $('#s7-l2'), pipe: $('#pipe'), pipeFill: $('#pipe-fill'),
      hashEl: $('#hash'), hashV: $('#hash-v'), hashOk: $('#hash-ok'),
      fail: $('#fail'), failGlitch: $('#fail-glitch'), failB: $('#fail-glitch b'), failSub: $('#fail-sub'),
      rcChip: $('#rc-chip'), rcLine: $('#rc-line'), rcBig: $('#rc-big'),
      verdict: $('#verdict'), vdl1: $('#vd-l1'), vdl2: $('#vd-l2'), vdSub: $('#vd-sub'),
      s8top: $('#s8-top'), s8kick: $('#s8-top .kicker'), s8h: $('#s8-h'),
      endBg: $('#end-bg'), endImg: $('#end-bg img'), endShade: $('#end-shade'), endBrand: $('#end-brand'),
      endL1: $('#end-l1'), endL2: $('#end-l2'), endRows: $$('#end-info p'), endBgm: $('#end-bgm'),
      hud: $('#hud'), hudN: $('#hud-n'), hudSegs: $$('#hud-segs i'),
      flash: $('#flash'), stage: $('#stage'),
    });

    // 渐变字
    for (const em of $$('.grad-ch')) {
      const cs = split(em);
      cs.forEach((c, i) => {
        const k = cs.length > 1 ? i / (cs.length - 1) : 0;
        c.style.color = `rgb(${GRAD[0].map((v, j) => Math.round(lerp(v, GRAD[1][j], k))).join(',')})`;
      });
    }
    [R.hl1, R.hl2, R.cn, R.s2l1, R.s2l2, R.s3h, ...R.s4h, R.s5l1, R.s5l2, R.s6l1, R.s6l2, R.s6bl1, R.s6bl2,
      R.s7l1, R.s7l2, R.vdl1, R.vdl2, R.s8h, R.endL1, R.endL2].forEach(split);

    [R.lgFrame, R.lgBody, R.lgBelly, R.lgGill].forEach(e => { e.style.strokeDasharray = '1 1'; });
    VT.lit.setAttribute('pathLength', 1);
    [VT.track, VT.lit, VT.arcEl].forEach(e => { e.style.strokeDasharray = '1 1'; });
  }

  function measure() {
    msgs.forEach(m => { m.h = m.el.offsetHeight + 18; });
    POS.launch = localPos(R.launchBtn, R.launcher);
    // 管理端：按“检查完成、移除提示条展开”后的版面量坐标
    R.admBulk.style.display = '';
    POS.scan = localPos(R.admScan, R.admin);
    POS.rm = localPos(R.admRm, R.admin, 0.62);
    POS.pub = localPos(R.admPub, R.admin);
    POS.confirm = localPos(R.admConfirm, R.admin);
    POS.admScroll = Math.max(0, R.admScroll.offsetHeight - R.admScroll.parentNode.offsetHeight);
    // 本地管理面板内部按 1.4 倍放大
    const k = 1.4, sc = ([x, y]) => [x * k, y * k];
    POS.sw0 = sc(localPos(R.sw0, R.locInner));
    POS.tabBk = sc(localPos(R.tabBk, R.locInner));
    POS.bk = sc(localPos(R.bk0btn, R.locInner, 0.4));
    R.ffiles.forEach(f => { f._w = f.offsetWidth; });
    // 版本轨道上的玩家标签（两种文字宽度不同）
    POS.chipW = R.vchip.offsetWidth;
    R.vchipNote.textContent = '已更新到 1.7';
    POS.chipW2 = R.vchip.offsetWidth;
    R.vchipNote.textContent = '上次停在 1.2'; R.vchipNote._t = '上次停在 1.2';
  }

  // ---------------------------------------------------------------- 背景着色器
  let gl = null; const U = {};
  const FS = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uI; uniform vec3 uA; uniform vec3 uB; uniform float uRays; uniform vec2 uF; uniform float uGlow;
float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1.,0.)), u.x), mix(h21(i+vec2(0.,1.)), h21(i+vec2(1.,1.)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++){ v += a * n2(p); p = m * p; a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT;
  vec2 q = vec2(fbm(p * 1.25 + vec2(0., t * .035)), fbm(p * 1.25 + vec2(5.2, -t * .03)));
  vec2 r = vec2(fbm(p * 1.6 + 2.3 * q + vec2(1.7, 9.2) + t * .045), fbm(p * 1.6 + 2.3 * q + vec2(8.3, 2.8) - t * .04));
  float f = fbm(p * 1.4 + 2.1 * r);
  vec3 col = vec3(.008, .018, .024);
  float band = smoothstep(.5, .95, f);
  vec3 tint = mix(uA, uB, smoothstep(.25, .75, r.x));
  col += tint * band * band * .6 * uI;
  float fil = 1. - abs(sin(f * 7. + r.y * 5. + t * .22));
  col += mix(uA, uB, uv.x) * pow(fil, 24.) * .12 * uI * (.35 + band);
  float ang = (p.x - .25) / (1.35 - p.y);
  float rays = n2(vec2(ang * 7., t * .12)) * n2(vec2(ang * 19. + 3., t * .09 + 4.));
  col += mix(uA, vec3(1.), .35) * rays * rays * smoothstep(-.7, .55, p.y) * .32 * uRays;
  for (int k = 0; k < 2; k++){
    float fk = float(k);
    float sc = 7. + 5. * fk;
    vec2 mp = p * sc + vec2(t * .05 * (fk + 1.), -t * (.18 + .1 * fk));
    vec2 id = floor(mp); vec2 fp = fract(mp) - .5;
    float hh = h21(id + fk * 17.);
    vec2 o = vec2(sin(t * .6 + hh * 40.), cos(t * .5 + hh * 23.)) * .28;
    float d = length(fp - o);
    float m = smoothstep(.07, 0., d) * step(.82, hh);
    col += mix(uA, uB, hh) * m * (.55 - .2 * fk) * (.4 + uI * .6);
  }
  vec2 fp2 = (uF - .5) * vec2(uRes.x / uRes.y, 1.);
  col += mix(uA, uB, .3) * exp(-length(p - fp2) * 3.) * uGlow;
  float v = smoothstep(1.3, .25, length(p * vec2(.82, 1.05)));
  col *= mix(.3, 1., v);
  col += (h21(gl_FragCoord.xy) - .5) / 255.;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`;
  function initGL() {
    const cv = $('#bg');
    cv.width = Math.round(960 * BGQ); cv.height = Math.round(540 * BGQ);
    try { gl = cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) { cv.style.background = 'radial-gradient(ellipse at 50% 40%, #0d2a2c, #05090b 70%)'; return; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uT', 'uI', 'uA', 'uB', 'uRays', 'uF', 'uGlow'].forEach(n => { U[n] = gl.getUniformLocation(pr, n); });
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(U.uRes, cv.width, cv.height);
  }
  const CY = [0.18, 0.91, 0.87], PU = [0.69, 0.42, 1.0], RD = [1.0, 0.25, 0.32], GN = [0.37, 0.9, 0.6];
  const BG_I = [[0, 0.3], [5.44, 0.42], [5.45, 0], [9.2, 0.03], [10.0, 1.25], [11.6, 0.85], [17, 0.8], [18, 0.68], [77.5, 0.68], [78.4, 0.3], [84.35, 0.3], [84.45, 0.8], [85.9, 0.5], [86.2, 0.3], [88.8, 0.3], [89.3, 0.9], [92.4, 0.9], [92.6, 1.05], [103, 0.95], [104.4, 0.5]];
  const BG_A = [[0, CY], [2.0, CY], [4.5, RD], [5.45, RD], [5.46, CY], [84.35, CY], [84.45, RD], [86.0, RD], [86.6, GN], [88.2, GN], [88.9, CY]];
  const BG_B = [[0, PU], [3.5, PU], [5.4, [0.8, 0.2, 0.4]], [5.46, PU], [84.35, PU], [84.45, [0.6, 0.05, 0.15]], [86.0, [0.6, 0.05, 0.15]], [86.6, PU]];
  const BG_RAYS = [[0, 0], [9.8, 0], [10.6, 1], [16.8, 1], [17.8, 0.25], [77.5, 0.25], [78.3, 0], [89, 0], [89.6, 0.55], [92.4, 0.55], [92.6, 0.8], [104, 0.5]];
  const BG_GLOW = [[0, 0], [9.5, 0], [10.0, 1.4], [11.4, 0.45], [16.8, 0.45], [17.7, 0], [84.35, 0], [84.45, 0.9], [85.8, 0.5], [86.2, 0]];
  const BG_F = [[0, [0.5, 0.7]], [80, [0.5, 0.7]], [84, [0.5, 0.5]]];
  function drawBG(t) {
    if (!gl) return;
    const a = kf(t, BG_A), b = kf(t, BG_B), f = kf(t, BG_F, E.lin);
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uI, kf(t, BG_I, E.ioS));
    gl.uniform3f(U.uA, a[0], a[1], a[2]);
    gl.uniform3f(U.uB, b[0], b[1], b[2]);
    gl.uniform1f(U.uRays, kf(t, BG_RAYS, E.ioS));
    gl.uniform2f(U.uF, f[0], f[1]);
    gl.uniform1f(U.uGlow, kf(t, BG_GLOW, E.ioS));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------------------------------------------------------------- 各场景
  function rS0(t) {
    const pin = P(t, 0, 0.7);
    const k = P(t, 3.4, 5.45, E.inC), sh = P(t, 3.8, 5.45, E.inQ) * 16, fr = Math.floor(t * 30);
    S(R.s0, { x: (hash(fr) - 0.5) * 2 * sh, y: (hash(fr + 9.1) - 0.5) * 2 * sh, s: (1 + 0.12 * k) * DRIFT });
    S(R.chat, { y: (1 - pin) * 40, o: pin, b: P(t, 4.6, 5.45, E.inQ) * 4 });
    let acc = 0;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i], a = clamp((t - m.t) / 0.32), e = E.outC(a);
      S(m.el, { y: -acc + (1 - e) * 26, s: lerp(0.9, 1, E.outB(a)), o: a > 0 ? clamp(a * 2.2) : 0 });
      acc += m.h * e;
    }
    S(R.typing, { o: P(t, 1.5, 1.9) });
    R.typingDots.forEach((d, i) => { d.style.transform = `translateY(${(-7 * Math.max(0, Math.sin(t * 9 - i * 0.7))).toFixed(1)}px)`; });
    const jit = P(t, 4.0, 5.45, E.inQ) * 6;
    errs.forEach(e => {
      const a = clamp((t - e.t) / 0.35), pop = E.outB(a);
      S(e.el, { x: e.x + (hash(fr + e.t * 7) - 0.5) * jit, y: e.y + (1 - pop) * 30, rz: e.r, s: lerp(0.7, 1, pop), o: a > 0 ? clamp(a * 3) : 0 });
    });
  }

  function rS0b(t) {
    chars(R.hl1, t, 5.9, { st: 0.07, d: 0.9, dy: 34, bl: 14 });
    chars(R.hl2, t, 7.3, { st: 0.06, d: 0.9, dy: 34, bl: 14 });
    const x = P(t, 9.2, 10.1, E.inC);
    S(R.hook, { s: 1 + x * 0.2, o: 1 - x, b: x * 22 });
  }

  function rS1(t) {
    const dash = (el, a, b) => {
      const p = P(t, a, b, E.ioC);
      el.style.strokeDasharray = p >= 0.999 ? 'none' : '1 1';
      el.style.strokeDashoffset = (1 - p).toFixed(4);
    };
    dash(R.lgFrame, 9.95, 11.0); dash(R.lgBody, 10.05, 11.25); dash(R.lgBelly, 10.4, 11.4); dash(R.lgGill, 11.15, 11.7);
    R.lgFrame.style.fillOpacity = P(t, 10.5, 11.4).toFixed(3);
    R.lgFill.style.opacity = P(t, 10.9, 11.8).toFixed(3);
    R.lgEye.style.transform = `scale(${Math.max(0, P(t, 11.45, 11.95, E.outB)).toFixed(3)})`;
    const lp = P(t, 9.95, 11.9, E.outX);
    S(R.logoBig, { s: lerp(0.72, 1, lp), y: (1 - lp) * 20 });
    R.wm.forEach((w, k) => {
      const p = P(t, 11.5 + k * 0.22, 12.35 + k * 0.22, E.outX);
      w.style.clipPath = `inset(-30% ${((1 - p) * 100).toFixed(2)}% -30% -5%)`;
      S(w, { x: (1 - p) * -24, o: p > 0 ? 1 : 0 });
    });
    chars(R.cn, t, 12.45, { st: 0.09, d: 0.8, dy: 18, bl: 8 });
    const x = P(t, 16.85, 17.65, E.inC);
    const PT = [13.75, 14.375, 15.0];
    R.pillSpans.forEach((sp, k) => S(sp, { s: lerp(0.5, 1, P(t, PT[k], PT[k] + 0.55, E.outB)), o: P(t, PT[k], PT[k] + 0.25) }));
    R.pillDots.forEach((d, k) => S(d, { s: Math.max(0, P(t, PT[k] + 0.3, PT[k] + 0.6, E.outB)), o: P(t, PT[k] + 0.3, PT[k] + 0.5) }));
    S(R.pills, { y: x * 60, o: 1 - x });
    const sp = P(t, 15.45, 16.25);
    S(R.logoSub, { y: (1 - sp) * 24 + x * 60, o: sp * (1 - x) });
    S(R.rays, { rz: t * 5, s: lerp(0.5, 1, P(t, 10.0, 12.5)), o: P(t, 10.0, 11.4) * (1 - P(t, 16.7, 17.5)) * 0.9 });
    S(R.lockup, { s: 1 + x * 1.1, o: 1 - x, b: x * 16, y: -x * 40 });
  }

  function rS2(t) {
    const ex = P(t, 28.3, 29.1, E.inC);
    S(R.s2copy, { x: -80 * ex, o: 1 - ex });
    fadeIn(R.s2kick, t, 17.7, 0.7, 20);
    chars(R.s2l1, t, 17.85, { st: 0.05, d: 0.8, dy: 60, bl: 12 });
    chars(R.s2l2, t, 18.3, { st: 0.05, d: 0.8, dy: 60, bl: 12 });
    const FT = [20.5, 22.6, 24.8];
    R.s2feats.forEach((li, k) => {
      const p = P(t, FT[k], FT[k] + 0.8, E.outX);
      S(li, { x: (1 - p) * -50, o: p });
      S(li.firstElementChild, { s: 1 + 0.9 * bump(t, FT[k] + 0.15, 0.35) });
    });
    const li = P(t, 17.6, 18.5), lo = P(t, 19.35, 19.95, E.inC);
    S(R.launcher, { y: (1 - li) * 60, s: lerp(0.95, 1, li) * (1 + lo * 0.12), o: li * (1 - lo), b: lo * 10 });
    R.launchBtn.style.filter = `brightness(${(1 + 0.14 * P(t, 18.9, 19.05)).toFixed(3)})`;
    S(R.launchBtn, { s: 1 - 0.045 * bump(t, 19.17, 0.12) });
    const [bx, by] = POS.launch;
    cursor(R.curLaunch, t, [[17.9, 700, 640], [18.15, 700, 640], [19.0, bx + 30, by + 14]], [19.15], 17.95, 19.4);
  }

  // 玩家端窗口：S2 中右侧展示 → S3 居中堆叠、主题擦除切换 → 2×2 展开
  const STACK = { cx: 960, cy: 650, s: 0.86 };
  const W0 = { cx: 1318, cy: 592, s: 0.9, ry: 7 };
  const GRID = [[656, 470], [1264, 470], [656, 828], [1264, 828]], GS = 0.45;
  const WIPES = [0, 31.6, 32.85, 34.1];
  function rPW(t) {
    for (let i = 0; i < 4; i++) {
      const w = wins[i];
      let cx, cy, s, ry = 0, rz = 0, o = 1, b = 0;
      if (i === 0) {
        const a = P(t, 19.45, 20.6, E.outX), m = P(t, 28.4, 29.9, E.ioC);
        cx = lerp(lerp(1380, W0.cx, a), STACK.cx, m);
        cy = lerp(lerp(620, W0.cy, a), STACK.cy, m) + Math.sin(t * 0.9) * 5 * (1 - m);
        s = lerp(lerp(0.5, W0.s, a), STACK.s, m);
        ry = lerp(lerp(30, W0.ry, a), 0, m);
        o = clamp(a * 2.5); b = (1 - a) * 14;
      } else {
        cx = STACK.cx; cy = STACK.cy; s = STACK.s; o = t >= WIPES[i] ? 1 : 0;
      }
      const f = P(t, 35.6 + i * 0.07, 36.75 + i * 0.07, E.outX);
      if (f > 0) {
        const g = GRID[i];
        cx = lerp(cx, g[0], f); cy = lerp(cy, g[1], f); s = lerp(s, GS, f);
        rz = Math.sin(f * Math.PI) * (i % 2 ? 2.5 : -2.5);
      }
      const lift = bump(t, 37.4 + i * 0.38, 0.42);
      s *= 1 + 0.035 * lift;
      const e = P(t, 39.3, 40.2, E.inC);
      s *= 1 - 0.08 * e; o *= 1 - e; cy += 30 * e;
      S(w.el, { x: cx - 960, y: cy - 540, s, ry, rz, o, b });
      w.bg.style.transform = `scale(${(1.08 - 0.06 * P(t, 19.5, 40, E.lin)).toFixed(4)})`;

      // 擦除切换
      if (i > 0) {
        const wp = P(t, WIPES[i], WIPES[i] + 0.6, E.ioC);
        if (wp >= 1) { w.clip.style.clipPath = 'none'; S(w.edge, { o: 0 }); }
        else {
          const X = lerp(-25, 125, wp);
          w.clip.style.clipPath = `polygon(0% 0%, ${X.toFixed(2)}% 0%, ${(X - 25).toFixed(2)}% 100%, 0% 100%)`;
          w.edge.style.left = `calc(${(X - 12.5).toFixed(2)}% - 5px)`;
          w.edge.style.transform = 'rotate(23.45deg)';
          w.edge.style.opacity = Math.sin(Math.PI * wp).toFixed(3);
          w.edge.style.visibility = '';
        }
      }

      // 标签
      const lab = labels[i];
      const lo = P(t, 36.6 + i * 0.1, 37.0 + i * 0.1) * (1 - P(t, 39.3, 39.9));
      const g = GRID[i];
      S(lab, { x: g[0] - 288 + 22, y: g[1] + 171 - 22 - 60 - 6 * lift, o: lo });
    }

    // 主窗口的更新过程：阶段名、进度文字都按玩家端的真实流程
    const w = wins[0];
    let st, pct, detail, dl, bar = 0;
    if (t < 20.4) { st = '正在检查更新'; pct = '--'; detail = '正在连接更新服务'; dl = '正在计算变更'; }
    else if (t < 23.5) {
      const p = P(t, 20.4, 23.5, E.ioS);
      st = '正在下载更新'; bar = p * 0.94;
      detail = DL_FILES[Math.min(DL_FILES.length - 1, Math.floor(p * DL_FILES.length))];
      dl = `${(p * 48.6).toFixed(1)} MB / 48.6 MB`;
    } else if (t < 24.1) {
      st = '正在安装更新'; bar = 0.94 + 0.04 * P(t, 23.5, 24.1, E.lin); detail = '正在备份本地副本并安装文件'; dl = '48.6 MB / 48.6 MB';
    } else if (t < 24.6) {
      const p = P(t, 24.1, 24.6, E.lin);
      st = '正在完成校验'; bar = 0.98 + 0.02 * p; detail = DL_FILES[Math.min(DL_FILES.length - 1, Math.floor(p * DL_FILES.length))]; dl = '48.6 MB / 48.6 MB';
    } else { st = '更新已经完成'; bar = 1; detail = 'Minecraft 正在继续启动'; dl = '已下载 48.6 MB'; }
    if (pct === undefined) pct = Math.round(bar * 100) + '%';
    setText(w.st, st); setText(w.pct, pct); setText(w.detail, detail); setText(w.dl, dl);
    if (t < 20.4) {
      // 还不知道要下载多少时，进度条来回扫动
      const u = (((t - 19.45) / 1.4) % 1 + 1) % 1;
      w.bar.style.transform = `translateX(${lerp(-35, 100, E.ioS(u)).toFixed(2)}%) scaleX(.35)`;
    } else w.bar.style.transform = `scaleX(${Math.max(0.0001, bar).toFixed(4)})`;
    // 完成后：本次更新摘要、备份提示、启动提示
    const sp = P(t, 24.7, 25.15, E.outC);
    w.sum.style.display = sp > 0 ? '' : 'none';
    S(w.sum, { y: (1 - sp) * 14, o: sp });
    const np = P(t, 24.95, 25.35);
    w.note.style.display = np > 0 ? '' : 'none';
    setText(w.note, '已将 1 个本地文件移入备份；另有 2 个玩家自选模组已保留  ›');
    S(w.note, { o: np });
    const tp = P(t, 25.2, 25.62, E.outC), tq = P(t, 28.4, 28.8);
    S(w.launch, { y: (1 - tp) * -8, o: tp * (1 - tq) });
    setText(w.launchT, `Minecraft 已开始启动 · ${Math.max(1, 12 - Math.floor(Math.max(0, t - 25.2)))} 秒后自动关闭`);
  }

  function rS3(t) {
    const e = P(t, 39.3, 40.1, E.inC);
    S(R.s3top, { y: -30 * e, o: 1 - e });
    fadeIn(R.s3kick, t, 30.05, 0.6, 16);
    chars(R.s3h, t, 30.2, { st: 0.04, d: 0.75, dy: 40, bl: 10 });
    const sp = P(t, 30.9, 31.6);
    S(R.s3sub, { y: (1 - sp) * 20, o: sp * (1 - P(t, 35.5, 35.9)) });
  }

  // 第 03 章：1.0 → 1.7 每个版本都有变化 → 停在 1.2 的玩家 → 一步直达 1.7，汇成一份更新计划
  function rS4(t) {
    const out = P(t, 56.8, 57.4, E.inC);
    S(R.s4, { s: DRIFT * (1 + 0.02 * out), o: 1 - out });
    fadeIn(R.s4kick, t, 40.1, 0.6, 16);
    chars(R.s4h[0], t, 40.25, { st: 0.045, d: 0.75, dy: 40, bl: 10 });
    const o1 = P(t, 47.3, 47.62, E.inC);
    S(R.s4h[0], { y: -26 * o1, o: 1 - o1, b: o1 * 10 });
    chars(R.s4h[1], t, 47.5, { st: 0.045, d: 0.7, dy: 40, bl: 10 });
    const o2 = P(t, 48.78, 49.08, E.inC);
    S(R.s4h[1], { y: -26 * o2, o: 1 - o2, b: o2 * 10 });
    chars(R.s4h[2], t, 49.0, { st: 0.05, d: 0.75, dy: 40, bl: 10 });

    const TY = VT.TY, NX = VT.NX;
    VT.track.style.strokeDashoffset = (1 - P(t, 40.6, 41.4, E.ioC)).toFixed(4);
    VT.nodes.forEach((n, i) => {
      const p = P(t, 40.75 + i * 0.07, 41.25 + i * 0.07, E.outB);
      const pulse = i === 7 ? bump(t, 50.0, 0.45) : 0;
      n.setAttribute('r', (Math.max(0, p) * (i === 7 ? 24 : 15) * (1 + 0.35 * pulse)).toFixed(2));
      VT.labels[i].style.opacity = P(t, 40.9 + i * 0.07, 41.3 + i * 0.07).toFixed(3);
      const k = i - 1;
      if (i > 0 && i < 7) n.style.stroke = t >= VC_T[k] - 0.05 ? VCARDS[k][1] : '';
    });

    // 整合包一路发到 1.7（光点逐个版本前进）
    let tx = NX(0);
    for (let k = 0; k < VCARDS.length; k++) tx = lerp(tx, NX(k + 1), P(t, VC_T[k] - 0.45, VC_T[k] - 0.05, E.ioC));
    VT.token.setAttribute('cx', tx.toFixed(1)); VT.token.setAttribute('cy', TY);
    VT.token.style.opacity = (P(t, 41.0, 41.3) * (1 - P(t, 47.2, 47.6))).toFixed(3);
    VT.lit.style.strokeDashoffset = (1 - (tx - NX(0)) / (NX(7) - NX(0))).toFixed(4);
    VT.lit.style.opacity = (0.85 * P(t, 41.0, 41.3) * (1 - P(t, 47.2, 47.8))).toFixed(3);

    // 版本变化卡片
    VT.cards.forEach((cd, k) => {
      const a = P(t, VC_T[k], VC_T[k] + 0.6, E.outB), a0 = clamp(P(t, VC_T[k], VC_T[k] + 0.25));
      let x = cd.x, y = cd.y + (1 - a) * 30, s = lerp(0.85, 1, clamp(a)), o = a0;
      if (k === 3 && t >= VC_T[3]) {
        // 1.4 报错：卡片抖一下
        const sh = 9 * (1 - P(t, VC_T[3], VC_T[3] + 0.55));
        x += (hash(Math.floor(t * 30)) - 0.5) * 2 * sh;
      }
      // 停在 1.2 的玩家已经有 1.1、1.2 的内容；错过的 1.3–1.7 依次亮一下
      const dim = k < 2 ? P(t, 47.9, 48.3) : 0;
      o *= 1 - 0.7 * dim;
      const hl = k >= 2 ? bump(t, 48.25 + (k - 2) * 0.13, 0.26) : 0;
      s *= 1 + 0.05 * hl;
      const c = P(t, 50.45 + k * 0.05, 51.1 + k * 0.05, E.inC);
      if (c > 0) {
        if (k < 2) o *= 1 - c;
        else { x = lerp(x, 770, c); y = lerp(y, 600, c); s *= lerp(1, 0.35, c); o *= 1 - c; }
      }
      S(cd.el, { x, y, s, o });
      cd.el.style.boxShadow = hl > 0.01
        ? `0 0 ${(46 * hl).toFixed(0)}px color-mix(in srgb, ${VCARDS[k][1]} 65%, transparent), 0 22px 54px rgba(0,0,0,.45)` : '';
      VT.links[k].style.opacity = (a0 * (1 - 0.7 * dim) * (1 - P(t, 50.3, 50.7))).toFixed(3);
    });

    // 玩家：上次停在 1.2
    if (t < 50.2) {
      R.vchip.classList.remove('done'); setText(R.vchipNote, '上次停在 1.2');
      const drop = P(t, 47.75, 48.25, E.outB);
      S(R.vchip, { x: NX(2) - POS.chipW / 2, y: TY - 156 - (1 - drop) * 60, o: clamp(P(t, 47.75, 47.95)) * (1 - P(t, 48.95, 49.15)) });
    } else {
      R.vchip.classList.add('done'); setText(R.vchipNote, '已更新到 1.7');
      const p = P(t, 50.2, 50.6, E.outB);
      S(R.vchip, { x: NX(7) - POS.chipW2 / 2, y: TY - 184 + (1 - p) * 20, s: lerp(0.8, 1, p), o: clamp(P(t, 50.2, 50.35)) });
    }
    S(R.vmiss, { x: NX(2) + POS.chipW / 2 + 26, y: TY - 137, o: P(t, 48.3, 48.6) * (1 - P(t, 48.9, 49.1)) });

    // 一条弧线直达 1.7
    const A = VT.arc, ad = P(t, 49.1, 50.0, E.ioC);
    VT.arcEl.style.strokeDashoffset = (1 - ad).toFixed(4);
    VT.arcEl.style.opacity = (1 - 0.4 * P(t, 51, 52)).toFixed(3);
    const [rx, ry] = bez(A.x0, TY, A.c[0], A.c[1], A.x1, TY, ad);
    S(R.vrider, { x: rx - 25, y: ry - 25, s: 1 + 0.25 * Math.sin(Math.PI * ad), o: clamp(P(t, 49.05, 49.2)) * (1 - P(t, 50.0, 50.2)) });
    VT.parts.forEach((pt, k) => {
      const u = (((t - 50.0) * 0.45 + k / 4) % 1 + 1) % 1;
      const [px, py] = bez(A.x0, TY, A.c[0], A.c[1], A.x1, TY, u);
      pt.setAttribute('cx', px.toFixed(1)); pt.setAttribute('cy', py.toFixed(1));
      pt.style.opacity = (P(t, 50.0, 50.4) * Math.sin(Math.PI * u)).toFixed(3);
    });
    const bt = clamp((t - 50.0) / 0.8);
    VT.burst.setAttribute('r', (24 + 96 * E.outC(bt)).toFixed(1));
    VT.burst.style.opacity = t >= 50.0 && bt < 1 ? (1 - bt).toFixed(3) : '0';
    const pulse = bump(t, 50.0, 0.6);
    VT.glow.setAttribute('r', ((46 + 50 * pulse) * P(t, 41.2, 41.7)).toFixed(2));
    VT.glow.style.opacity = (0.55 + 0.45 * pulse).toFixed(3);
    VT.tag.style.opacity = P(t, 41.3, 41.7).toFixed(3);

    // 汇总成玩家端“本次更新”里看到的一份计划
    const pin = P(t, 50.9, 51.6, E.outX);
    S(R.plan, { y: (1 - pin) * 50, o: pin, s: lerp(0.97, 1, pin) });
    R.planRows.forEach((r, k) => { const p = P(t, 51.65 + k * 0.4, 52.15 + k * 0.4, E.outX); S(r, { x: (1 - p) * -30, o: p }); });
    S(R.planFoot, { y: (1 - P(t, 54.1, 54.5)) * 14, o: P(t, 54.1, 54.4) });
    const fp = P(t, 54.25, 55.0, E.outC);
    setText(R.pfA, Math.round(1284 * fp).toLocaleString('en-US'));
    setText(R.pfB, String(Math.round(9 * fp)));
    setText(R.pfC, (48.6 * fp).toFixed(1) + ' MB');
  }

  // 管理端（检查并发布页）
  function rS5(t) {
    const ex = P(t, 64.6, 65.3, E.inC);
    S(R.s5copy, { x: -80 * ex, o: 1 - ex });
    fadeIn(R.s5kick, t, 52.6, 0.6, 16);
    chars(R.s5l1, t, 52.75, { st: 0.05, d: 0.8, dy: 60, bl: 12 });
    chars(R.s5l2, t, 53.2, { st: 0.05, d: 0.8, dy: 60, bl: 12 });
    const ACT = [54.0, 56.0, 60.0];
    R.steps.forEach((li, k) => {
      const ap = P(t, 53.6 + k * 0.12, 54.2 + k * 0.12);
      const on = P(t, ACT[k], ACT[k] + 0.3), off = k < 2 ? P(t, ACT[k + 1], ACT[k + 1] + 0.3) : 0;
      const level = 0.38 + 0.62 * on - 0.3 * off;
      S(li, { x: (1 - ap) * -40, o: ap * level });
      const num = li.firstElementChild, act = on - off;
      num.style.background = act > 0.5 ? '#2ee8df' : 'transparent';
      num.style.color = act > 0.5 ? '#041213' : off > 0.5 ? '#2ee8df' : '';
      num.style.borderColor = act > 0.5 || off > 0.5 ? '#2ee8df' : '';
      num.style.boxShadow = act > 0.5 ? '0 0 26px rgba(46,232,223,.55)' : 'none';
      setText(num, off > 0.5 ? '✓' : String(k + 1));
    });
    R.s5chips.forEach((c, k) => fadeIn(c, t, 63.0 + k * 0.15, 0.5, 16));

    const a = P(t, 52.9, 53.95, E.outX), ae = P(t, 64.6, 65.3, E.inC);
    S(R.admin, { x: (1 - a) * 260, ry: lerp(24, 6, a), s: lerp(0.9, 1, a) * (1 - 0.04 * ae), o: clamp(a * 2) * (1 - ae), b: (1 - a) * 12 });

    R.ffiles.forEach((f, k) => {
      const t0 = 54.25 + k * 0.18, u = P(t, t0, t0 + 0.95, E.ioC);
      const x0 = 980 + k * 300, y0 = 1130 + k * 10, x1 = 1240 + k * 40, y1 = 480 + k * 30;
      const [px, py] = bez(x0, y0, (x0 + x1) / 2, 780, x1, y1, u);
      S(f, { x: px - (f._w || 300) / 2, y: py, s: lerp(1, 0.55, u), rz: lerp(-8 + k * 4, 0, u), o: u <= 0 ? 0 : u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15 });
    });

    const tp = P(t, 55.25, 55.6, E.outC), to = P(t, 57.9, 58.3);
    S(R.admToast, { y: (1 - tp) * 16, o: tp * (1 - to) });
    // 检查整合包内容
    S(R.admScan, { s: 1 - 0.06 * bump(t, 56.82, 0.12) });
    const scanning = t >= 56.8 && t < 57.4;
    R.admSpin.style.display = scanning ? 'block' : 'none';
    R.admSpin.style.transform = `rotate(${(t * 720) % 360}deg)`;
    setText(R.admScanLabel, scanning ? '正在检查…' : '↻ 检查整合包内容');
    setText(R.admTime, t >= 57.4 ? '检查于 2026/10/03 20:14 · 共 1,284 个文件，2.6 GiB · 移除的文件都已决定' : '尚未检查');
    const mp = P(t, 57.4, 58.2);
    R.admMetrics.forEach(b => {
      if (t < 57.4) { setText(b, '--'); return; }
      const v = parseFloat(b.dataset.v), unit = b.dataset.unit || '';
      setText(b, (v % 1 ? (v * mp).toFixed(1) : String(Math.round(v * mp))) + unit);
    });
    // 有移除的文件时才出现的提示条（和真实页面一样直接出现，再淡入）
    R.admBulk.style.display = t >= 57.4 ? '' : 'none';
    S(R.admBulk, { o: P(t, 57.4, 57.7) });
    S(R.admEmpty, { o: 1 - P(t, 57.3, 57.45) });
    R.admRows.forEach((r, k) => { const rp = P(t, 57.6 + k * 0.17, 58.1 + k * 0.17); S(r, { x: (1 - rp) * 30, o: rp }); });
    S(R.admBadge, { s: lerp(0.6, 1, P(t, 57.5, 57.85, E.outB)), o: P(t, 57.5, 57.7) });
    // 移除的文件已经决定好怎么处理：鼠标停在下拉框上
    const hv = P(t, 58.55, 58.75) * (1 - P(t, 59.5, 59.7));
    R.admRm.style.borderColor = hv > 0.5 ? '#35d8d0' : '';
    R.admRm.style.boxShadow = hv > 0.5 ? '0 0 0 3px rgba(53,216,208,.16)' : '';
    // 页面向下滚到“发布新版本”
    const SC = POS.admScroll * P(t, 59.3, 59.95, E.ioC);
    R.admScroll.style.transform = `translateY(${(-SC).toFixed(1)}px)`;
    // 发布 → 确认对话框 → 已发布
    S(R.admPub, { s: 1 - 0.06 * bump(t, 60.32, 0.12) });
    const md = P(t, 60.4, 60.62) * (1 - P(t, 61.48, 61.65));
    S(R.admModal, { o: md });
    S(R.admDialog, { s: lerp(0.95, 1, P(t, 60.4, 60.7, E.outB)), y: (1 - P(t, 60.4, 60.7)) * 10 });
    const blur = md > 0.01 ? `blur(${(3 * md).toFixed(2)}px) brightness(${(1 - 0.25 * md).toFixed(3)})` : 'none';
    R.admSide.style.filter = blur; R.admWork.style.filter = blur;
    S(R.admConfirm, { s: 1 - 0.06 * bump(t, 61.42, 0.12) });
    setText(R.admPubLabel, '发布整合包');
    const t2 = P(t, 61.55, 61.9, E.outC);
    S(R.admToast2, { y: (1 - t2) * 16, o: t2 });
    const [sx, sy] = POS.scan, [rmx, rmy] = POS.rm, [px, py] = POS.pub, [cx, cy] = POS.confirm;
    const pubY = py - POS.admScroll;
    cursor(R.curAdmin, t, [[56.0, 980, 640], [56.05, 980, 640], [56.65, sx, sy + 6], [57.3, sx, sy + 6], [58.55, rmx, rmy + 4], [59.4, rmx, rmy + 4],
      [60.15, px, pubY + 6], [60.75, px, pubY + 6], [61.25, cx, cy + 6]], [56.8, 60.3, 61.4], 56.0, 62.0);
    S(R.admStamp, { o: P(t, 61.75, 62.05) });
    const st = P(t, 61.8, 62.3, E.outB);
    S(R.stampCard, { s: lerp(0.6, 1, st), o: clamp(P(t, 61.8, 62.05)) });
    S(R.stampCheck, { s: Math.max(0, P(t, 62.0, 62.4, E.outB)) });
  }

  // 玩家端可选内容的开关
  function setSwitch(el, v) {
    el.style.borderColor = mixHex('#3d4446', '#2ee8df', v);
    el.style.background = `rgba(${Math.round(lerp(255, 46, v))},${Math.round(lerp(255, 232, v))},${Math.round(lerp(255, 223, v))},${lerp(0.08, 0.38, v).toFixed(3)})`;
    const k = el.firstElementChild;
    k.style.transform = `translateX(${(v * 20).toFixed(2)}px)`;
    k.style.background = v > 0.5 ? '#2ee8df' : 'rgba(255,248,220,.62)';
  }
  function rS6(t) {
    const ax = P(t, 70.6, 71.1, E.inC);
    S(R.s6top, { y: -30 * ax, o: 1 - ax });
    fadeIn(R.s6kick, t, 65.1, 0.6, 16);
    chars(R.s6l1, t, 65.2, { st: 0.045, d: 0.75, dy: 44, bl: 10 });
    chars(R.s6l2, t, 65.75, { st: 0.045, d: 0.75, dy: 44, bl: 10 });
    R.pcards.forEach((c, k) => {
      const p = P(t, 66.0 + k * 0.45, 66.9 + k * 0.45, E.outX), q = P(t, 70.6 + k * 0.07, 71.2 + k * 0.07, E.inC);
      S(c, { y: (1 - p) * 90 + q * 80, rx: (1 - p) * 28 - q * 10, o: clamp(p * 1.6) * (1 - q) });
    });
    const bx = P(t, 76.8, 77.4, E.inC);
    S(R.s6copy, { x: -60 * bx, o: (t >= 71 ? 1 : 0) * (1 - bx) });
    chars(R.s6bl1, t, 71.2, { st: 0.06, d: 0.8, dy: 60, bl: 12 });
    chars(R.s6bl2, t, 71.45, { st: 0.05, d: 0.8, dy: 60, bl: 12 });
    const FT = [72.0, 73.0, 74.2];
    R.s6feats.forEach((li, k) => {
      const p = P(t, FT[k], FT[k] + 0.8, E.outX);
      S(li, { x: (1 - p) * -50, o: p });
      S(li.firstElementChild, { s: 1 + 0.9 * bump(t, FT[k] + 0.15, 0.35) });
    });
    fadeIn(R.s6foot, t, 75.6, 0.8, 20);
    const lp = P(t, 71.3, 72.2, E.outX);
    S(R.local, { x: (1 - lp) * 220, ry: lerp(22, 6, lp), s: lerp(0.92, 1, lp) * (1 - 0.04 * bx), o: clamp(lp * 2) * (1 - bx), b: (1 - lp) * 10 });
    // 关掉“光影与美化”
    const v = 1 - P(t, 72.58, 72.78, E.ioC);
    setSwitch(R.sw0, v);
    R.opt0.classList.toggle('off', v < 0.5);
    setText(R.opt0st, v < 0.5 ? '已关闭  ·  你的选择（服主默认开启）' : '已开启  ·  跟随服主默认');
    R.opt0reset.style.display = v < 0.5 ? 'block' : 'none';
    // 切到“备份与恢复”
    const tab = t >= 73.58;
    R.tabFiles.classList.toggle('on', !tab); R.tabBk.classList.toggle('on', tab);
    S(R.pgFiles, { o: 1 - P(t, 73.6, 73.75) });
    const bp = P(t, 73.68, 73.95, E.outC);
    S(R.pgBk, { y: (1 - bp) * 8, o: bp });
    // 放回游戏
    const done = t >= 74.88;
    setText(R.bk0btn, done ? '已放回 · 刚刚' : '放回游戏');
    R.bk0btn.classList.toggle('restored', done);
    const hl = bump(t, 75.2, 0.55);
    R.bk0.style.background = `rgba(46,232,223,${(0.12 * hl).toFixed(3)})`;
    S(R.bk0btn, { s: 1 - 0.06 * bump(t, 74.86, 0.12) });
    const [ax0, ay0] = POS.sw0, [tbx, tby] = POS.tabBk, [bkx, bky] = POS.bk;
    cursor(R.curLocal, t, [[72.0, 560, 700], [72.05, 560, 700], [72.45, ax0, ay0 + 4], [72.9, ax0, ay0 + 4], [73.45, tbx, tby + 4], [74.0, tbx, tby + 4], [74.75, bkx, bky + 4]], [72.56, 73.56, 74.86], 72.0, 76.4);
  }

  const PSTYLE = {
    idle: { c: 'rgba(255,248,220,.2)', bg: '#090e11', ic: 'rgba(255,248,220,.5)', b: 'rgba(255,248,220,.55)', code: 'rgba(255,248,220,.4)', glow: 'none' },
    lit: { c: '#2ee8df', bg: '#0b2729', ic: '#2ee8df', b: '#fff8dc', code: '#2ee8df', glow: '0 0 36px rgba(46,232,223,.5)' },
    active: { c: '#2ee8df', bg: '#0a1b1d', ic: '#fff8dc', b: '#fff8dc', code: 'rgba(255,248,220,.7)', glow: '0 0 24px rgba(46,232,223,.35)' },
    fail: { c: '#ff6b78', bg: '#2e1016', ic: '#ff6b78', b: '#ff9aa4', code: '#ff6b78', glow: '0 0 40px rgba(255,107,120,.6)' },
    green: { c: '#5ee59a', bg: '#0d2a1d', ic: '#5ee59a', b: '#fff8dc', code: '#5ee59a', glow: '0 0 30px rgba(94,229,154,.45)' },
  };
  function rS7(t) {
    const kIn = P(t, 77.55, 78.15);
    S(R.s7kick, { y: (1 - kIn) * 16, o: kIn * (1 - P(t, 79.5, 79.9)) });
    chars(R.s7l1, t, 77.7, { st: 0.08, d: 0.8, dy: 50, bl: 12 });
    chars(R.s7l2, t, 78.15, { st: 0.05, d: 0.8, dy: 50, bl: 12 });
    const up = P(t, 79.6, 80.4, E.ioC), hx = P(t, 88.5, 88.95, E.inC);
    S(R.s7head, { y: -380 * up, s: lerp(1, 0.56, up), o: 1 - hx });

    const shake = 22 * (1 - P(t, 84.4, 85.3)) * (t >= 84.4 && t < 85.3 ? 1 : 0), fr = Math.floor(t * 30);
    S(R.s7, { x: (hash(fr) - 0.5) * 2 * shake, y: (hash(fr + 4.4) - 0.5) * 2 * shake, s: DRIFT });

    const pin = P(t, 79.9, 80.5);
    S(R.pipe, { y: (1 - pin) * 30, o: pin * (1 - hx) });
    const LIT = i => 80.6 + i * 0.625, FAIL = 84.4, RW = 86.3;
    pipeNodes.forEach((n, i) => {
      const ni = P(t, 79.95 + i * 0.06, 80.5 + i * 0.06);
      let state = 'idle';
      if (i <= 4 && t >= LIT(i)) state = 'lit';
      if (i === 5 && t >= 83.725 && t < FAIL) state = 'active';
      if (i === 5 && t >= FAIL && t < RW) state = 'fail';
      if (i <= 5 && t >= RW + (5 - i) * 0.15) state = 'green';
      if (state !== n.state) {
        n.state = state;
        const s = PSTYLE[state];
        n.c.style.borderColor = s.c; n.c.style.background = s.bg; n.c.style.boxShadow = s.glow;
        n.svg.style.stroke = s.ic; n.b.style.color = s.b; n.code.style.color = s.code;
      }
      const pop = i <= 4 ? bump(t, LIT(i) + 0.05, 0.25) : i === 5 ? bump(t, FAIL + 0.05, 0.3) + bump(t, RW + 0.05, 0.25) : 0;
      S(n.el, { y: (1 - ni) * 24, o: ni });
      S(n.c, { s: 1 + 0.16 * pop });
      S(n.ring, { rz: t * 240, o: state === 'active' ? 1 : 0 });
    });
    const fill = kf(t, [[80.6, 0], [81.225, 1 / 6], [81.85, 2 / 6], [82.475, 3 / 6], [83.1, 4 / 6], [83.725, 5 / 6], [86.3, 5 / 6], [87.2, 0]], E.ioS);
    R.pipeFill.style.transform = `scaleX(${Math.max(0.0001, fill).toFixed(4)})`;
    R.pipeFill.style.background = t >= FAIL && t < RW ? '#ff6b78' : t >= RW ? '#5ee59a' : '';

    const hp = P(t, 81.3, 81.7), hq = P(t, 84.35, 84.5);
    S(R.hashEl, { y: (1 - hp) * 16, o: hp * (1 - hq) });
    if (hp > 0 && hq < 1) {
      const res = Math.floor(64 * P(t, 81.5, 82.7, E.lin)), f2 = Math.floor(t * 30);
      let tail = '';
      for (let i = res; i < 64; i++) tail += '0123456789abcdef'[Math.floor(hash(i * 13.1 + f2) * 16)];
      setHTML(R.hashV, HASH.slice(0, res) + (tail ? `<u>${tail}</u>` : ''));
      const ok = P(t, 82.75, 83.05, E.outB);
      S(R.hashOk, { s: lerp(0.6, 1, ok), o: clamp(P(t, 82.75, 82.95)) });
    }

    const fo = P(t, 84.4, 84.45) * (1 - P(t, 85.85, 86.15));
    S(R.fail, { o: fo });
    if (fo > 0) {
      const f3 = Math.floor(t * 24), g1 = hash(f3), g2 = hash(f3 + 3.3), g3 = hash(f3 + 8.8);
      const calm = P(t, 84.4, 85.5);
      const amp = 1 - calm * 0.75;
      const a1 = Math.floor(g1 * 70), h1 = 8 + Math.floor(g2 * 26);
      const a2 = Math.floor(g3 * 70), h2 = 6 + Math.floor(g1 * 20);
      R.failB.style.setProperty('--gx1', `${((g2 - 0.5) * 60 * amp).toFixed(1)}px`);
      R.failB.style.setProperty('--gx2', `${((g3 - 0.5) * -60 * amp).toFixed(1)}px`);
      R.failB.style.setProperty('--gc1', `${a1}% 0 ${Math.max(0, 100 - a1 - h1)}% 0`);
      R.failB.style.setProperty('--gc2', `${a2}% 0 ${Math.max(0, 100 - a2 - h2)}% 0`);
      S(R.failGlitch, { x: (hash(f3 + 7) - 0.5) * 24 * amp, s: 1 + 0.08 * (1 - P(t, 84.4, 84.8)) });
      fadeIn(R.failSub, t, 84.7, 0.5, 16);
    }

    const rc = P(t, 85.95, 86.3), rx = P(t, 88.5, 88.95, E.inC);
    S(R.rcChip, { y: (1 - rc) * 16, o: rc * (1 - rx) });
    const l1 = P(t, 86.15, 86.5);
    S(R.rcLine, { y: (1 - l1) * 16, o: l1 * (1 - P(t, 87.25, 87.45)) });
    const big = P(t, 87.4, 87.95, E.outB);
    S(R.rcBig, { s: lerp(0.7, 1, big), o: clamp(P(t, 87.4, 87.6)) * (1 - rx) });

    chars(R.vdl1, t, 89.05, { st: 0.06, d: 0.8, dy: 50, bl: 12 });
    chars(R.vdl2, t, 89.6, { st: 0.06, d: 0.8, dy: 50, bl: 12 });
    const vs = P(t, 90.4, 91.1), vx = P(t, 92.0, 92.7, E.inC);
    S(R.vdSub, { y: (1 - vs) * 20, o: vs });
    S(R.verdict, { s: 1 + vx * 0.15, o: 1 - vx, b: vx * 12 });
  }

  function rS8(t) {
    const tx = P(t, 102.2, 102.7, E.inC);
    S(R.s8top, { y: -30 * tx, o: 1 - tx });
    fadeIn(R.s8kick, t, 92.6, 0.6, 16);
    chars(R.s8h, t, 92.7, { st: 0.045, d: 0.75, dy: 40, bl: 10 });
    tilesArr.forEach((tl, i) => {
      const A = 93.0 + i * 1.15;
      const p = P(t, A, A + 0.8, E.outX);
      const F = 102.45 + (tl.col + tl.row) * 0.09, f = P(t, F, F + 0.75, E.ioC);
      S(tl.el, { y: (1 - p) * 70, rx: (1 - p) * -26, ry: 180 * f, o: clamp(p * 1.8), s: 1 + 0.03 * Math.sin(f * Math.PI) });
      tl.glow.style.opacity = (P(t, A, A + 0.3) * (1 - P(t, A + 1.15, A + 1.6))).toFixed(3);
    });
  }

  function rS9(t) {
    S(R.endBg, { o: P(t, 103.6, 104.25, E.lin) });
    R.endImg.style.transform = `scale(${(1 + 0.075 * P(t, 104.25, 117.5, E.lin)).toFixed(4)})`;
    S(R.endShade, { o: P(t, 104.2, 105.4, E.ioS) });
    const bp = P(t, 105.2, 106.0, E.outX);
    S(R.endBrand, { y: (1 - bp) * 24, o: bp });
    chars(R.endL1, t, 106.0, { st: 0.055, d: 0.8, dy: 50, bl: 12 });
    chars(R.endL2, t, 107.1, { st: 0.055, d: 0.8, dy: 50, bl: 12 });
    R.endRows.forEach((r, k) => fadeIn(r, t, 108.6 + k * 0.2, 0.7, 18));
    fadeIn(R.endBgm, t, 109.6, 0.8, 10);
  }

  // 闪光：[时间, 峰值, 颜色, 起, 落]
  const FLASHES = [
    [2.05, 0.1, '#ff3040', 0.02, 0.35], [3.6, 0.1, '#ff3040', 0.02, 0.35], [4.2, 0.12, '#ff3040', 0.02, 0.35], [4.85, 0.14, '#ff3040', 0.02, 0.35],
    [9.95, 0.5, '#bff8f4', 0.15, 0.9], [19.2, 0.1, '#ffffff', 0.03, 0.35], [44.0, 0.12, '#ff3040', 0.02, 0.35], [50.0, 0.2, '#bff8f4', 0.04, 0.6],
    [61.8, 0.22, '#9bf0c0', 0.05, 0.6],
    [84.4, 0.6, '#ff2a40', 0.02, 0.6], [87.4, 0.16, '#7cf0b0', 0.05, 0.5], [89.0, 0.18, '#ffffff', 0.04, 0.5], [92.5, 0.32, '#ffffff', 0.05, 0.6], [105.0, 0.12, '#fff1cc', 0.05, 0.8],
  ];
  // 第 03 章之后的时间点整体顺延
  const shiftKF = arr => arr.forEach(f => { if (f[0] >= SHIFT_FROM) f[0] += EXT; });
  [FLASHES, BG_I, BG_A, BG_B, BG_RAYS, BG_GLOW, BG_F].forEach(shiftKF);
  function rGlobal(t) {
    drawBG(t);
    let fo = 0, fc = '#ffffff';
    for (const [ft, pk, col, a, d] of FLASHES) {
      if (t < ft - a || t > ft + d) continue;
      const v = t < ft ? pk * (t - (ft - a)) / a : pk * Math.pow(1 - (t - ft) / d, 2);
      if (v > fo) { fo = v; fc = col; }
    }
    const eb = P(t, DUR - 1.3, DUR, E.ioS);
    if (eb > fo) { fo = eb; fc = '#000000'; }
    R.flash.style.opacity = fo.toFixed(3);
    R.flash.style.background = fc;

    S(R.hud, { o: P(t, 17.6, 18.4) * (1 - P(t, HUD_END - 0.2, HUD_END + 0.4)) });
    let idx = -1;
    for (let i = 0; i < HUD_CH.length; i++) if (t >= HUD_CH[i][0]) idx = i;
    setText(R.hudN, idx >= 0 ? HUD_CH[idx][1] : '01');
    R.hudSegs.forEach((seg, i) => {
      const a = HUD_CH[i][0], b = HUD_CH[i + 1] ? HUD_CH[i + 1][0] : HUD_END;
      const f = clamp((t - a) / (b - a));
      seg.firstElementChild.style.transform = `scaleX(${f.toFixed(4)})`;
      seg.style.opacity = i === idx ? '1' : i < idx ? '.75' : '.45';
    });
  }

  // [id, 起, 止, 绘制函数, 顺延]：s5 之后的场景沿用原来的内部时间，播放时整体晚 EXT 秒
  const SCENES = [
    ['s0', 0, 5.45, rS0, 0], ['s0b', 5.45, 10.3, rS0b, 0], ['s1', 9.6, 17.7, rS1, 0], ['s2', 17.4, 30.2, rS2, 0],
    ['s-pw', 19.4, 40.4, rPW, 0], ['s3', 29.9, 40.4, rS3, 0], ['s4', 39.9, 57.8, rS4, 0], ['s5', 52.3, 65.4, rS5, EXT],
    ['s6', 64.8, 77.8, rS6, EXT], ['s7', 77.3, 92.8, rS7, EXT], ['s8', 92.3, 104.4, rS8, EXT], ['s9', 103.5, 118, rS9, EXT],
  ].map(([id, a, b, fn, sh]) => ({ el: document.getElementById(id), a, b, fn, sh, on: null }));

  // 每个场景都有一个很慢的推镜，让停留的画面也在“呼吸”
  const OWN_TRANSFORM = new Set(['s0', 's4', 's7', 's8']);
  let DRIFT = 1;
  function renderFrame(t) {
    for (const s of SCENES) {
      const st = t - s.sh;
      const on = st >= s.a && st < s.b;
      if (on !== s.on) { s.el.style.display = on ? '' : 'none'; s.on = on; }
      if (!on) continue;
      DRIFT = 1 + 0.03 * clamp((st - s.a) / (s.b - s.a));
      if (!OWN_TRANSFORM.has(s.el.id)) s.el.style.transform = `scale(${DRIFT.toFixed(4)})`;
      s.fn(st);
    }
    rGlobal(t);
  }

  // ---------------------------------------------------------------- 播放控制
  let T = 0, playing = false, lastPerf = 0;
  const audio = { ctx: null, buffer: null, src: null, gain: null, muted: false, c0: 0, t0: 0, el: null, elOk: false };
  let scorePromise = null;
  const SOUNDTRACK = 'assets/soundtrack-original.mp3';

  function ensureAudioCtx() {
    if (audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.gain = audio.ctx.createGain();
    audio.gain.gain.value = audio.muted ? 0 : 1;
    audio.gain.connect(audio.ctx.destination);
  }
  function startAudio() {
    if (audio.elOk) {
      if (!playing) return;
      try { audio.el.currentTime = Math.min(T, audio.el.duration || T); } catch (e) { /* 尚未就绪 */ }
      audio.el.muted = audio.muted;
      const p = audio.el.play(); if (p && p.catch) p.catch(() => {});
      return;
    }
    if (!audio.ctx || !audio.buffer || !playing) return;
    stopAudio();
    const s = audio.ctx.createBufferSource();
    s.buffer = audio.buffer; s.connect(audio.gain);
    s.start(0, Math.min(T, audio.buffer.duration - 0.01));
    audio.src = s; audio.c0 = audio.ctx.currentTime; audio.t0 = T;
  }
  function stopAudio() {
    if (audio.elOk) audio.el.pause();
    if (audio.src) { try { audio.src.stop(); } catch (e) { /* 已停止 */ } audio.src.disconnect(); audio.src = null; }
  }
  function play() {
    if (T >= DUR - 0.05) T = 0;
    ensureAudioCtx();
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    playing = true; lastPerf = performance.now();
    startAudio(); ui();
  }
  function pause() { playing = false; stopAudio(); ui(); }
  function seek(t) { T = clamp(t, 0, DUR); if (playing) startAudio(); renderFrame(T); ui(); }
  function loop(now) {
    if (playing) {
      T += Math.min((now - lastPerf) / 1000, 0.1);
      if (audio.elOk && !audio.el.paused && audio.el.readyState >= 2) {
        const at = audio.el.currentTime;
        if (Math.abs(at - T) > 0.12) T = at; else T += (at - T) * 0.08;
      } else if (audio.src) {
        const at = audio.t0 + (audio.ctx.currentTime - audio.c0);
        if (Math.abs(at - T) > 0.06) T = at; else T += (at - T) * 0.1;
      }
      if (T >= DUR) { T = DUR; playing = false; stopAudio(); }
      renderFrame(T); ui();
    }
    lastPerf = now;
    requestAnimationFrame(loop);
  }

  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function chapterAt(t) { let c = CHAPTERS[0]; for (const ch of CHAPTERS) if (t >= ch[0]) c = ch; return c; }
  function ui() {
    if (MODE === 'render') return;
    setText($('#c-play'), playing ? '❚❚' : '▶');
    setText($('#c-time'), `${fmt(T)} / ${fmt(DUR)}`);
    setText($('#c-chap'), chapterAt(T)[1]);
    $('#c-fill').style.width = (T / DUR * 100).toFixed(2) + '%';
    if (document.activeElement !== $('#c-seek')) $('#c-seek').value = Math.round(T / DUR * 1000);
    setText($('#c-mute'), audio.muted ? '✕' : '♪');
  }
  function setupControls() {
    const marks = $('#c-marks');
    CHAPTERS.slice(1).forEach(([t]) => { const i = document.createElement('i'); i.style.left = (t / DUR * 100) + '%'; marks.appendChild(i); });
    $('#c-play').onclick = () => (playing ? pause() : play());
    $('#c-seek').oninput = e => seek(e.target.value / 1000 * DUR);
    $('#c-mute').onclick = toggleMute;
    $('#c-full').onclick = toggleFull;
    let idleTimer = 0;
    const wake = () => {
      $('#controls').classList.remove('idle');
      document.body.style.cursor = '';
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { if (playing) { $('#controls').classList.add('idle'); document.body.style.cursor = 'none'; } }, 2200);
    };
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); if (posterOpen()) startFromPoster(); else playing ? pause() : play(); }
      else if (k === 'arrowright') { const n = CHAPTERS.find(c => c[0] > T + 0.05); seek(n ? n[0] : DUR); }
      else if (k === 'arrowleft') { const cur = chapterAt(T), i = CHAPTERS.indexOf(cur); seek(T - cur[0] > 1.5 || i === 0 ? cur[0] : CHAPTERS[i - 1][0]); }
      else if (k === 'r') { seek(0); if (!playing) play(); }
      else if (k === 'f') toggleFull();
      else if (k === 'm') toggleMute();
      else if (k === 'h') document.body.classList.toggle('hide-ui');
      else return;
      wake();
    });
  }
  function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.gain) audio.gain.gain.value = audio.muted ? 0 : 1;
    if (audio.el) audio.el.muted = audio.muted;
    ui();
  }
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
  }
  const posterOpen = () => !$('#poster').classList.contains('hide');
  function startFromPoster() {
    if ($('#play-btn').disabled) return;
    ensureAudioCtx();
    $('#poster').classList.add('hide');
    if (MODE === 'record') {
      document.body.classList.add('started');
      document.body.style.cursor = 'none';
      seek(0);
      setTimeout(play, 2000);
    } else { seek(0); play(); }
  }

  function layout() {
    const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    R.stage.style.zoom = k;
  }

  // ---------------------------------------------------------------- 启动
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  async function boot() {
    build();
    initGL();
    const label = $('#play-label');
    if (label) label.textContent = '正在加载字体…';
    await withTimeout(Promise.all([400, 500, 700, 900].map(w => document.fonts.load(`${w} 40px HMOS`, '梦鱼更新器 DreamingFish 1.7'))), 15000);
    await withTimeout(document.fonts.ready, 5000);
    const imgs = THEMES.map(th => th.img);
    await withTimeout(Promise.all(imgs.map(src => { const im = new Image(); im.src = src; return im.decode().catch(() => {}); })), 15000);
    await withTimeout(Promise.all($$('img').map(im => (im.decode ? im.decode().catch(() => {}) : null))), 10000);
    measure();
    layout();
    window.addEventListener('resize', layout);
    renderFrame(0);
    if (MODE !== 'render') {
      setupControls(); ui();
      requestAnimationFrame(loop);
      if (label) label.textContent = '正在加载配乐…';
      const enable = () => {
        const btn = $('#play-btn');
        if (!btn.disabled) return;
        btn.disabled = false;
        label.textContent = MODE === 'record' ? '开始录制（2 秒后自动播放）' : '播放宣传片';
        btn.onclick = startFromPoster;
      };
      // 优先使用预先渲染好的配乐文件；文件缺失时退回到浏览器内实时合成（较慢）
      const el = new Audio();
      el.preload = 'auto';
      audio.el = el;
      el.addEventListener('canplaythrough', () => { audio.elOk = true; enable(); }, { once: true });
      el.addEventListener('error', () => {
        console.warn('[film] 找不到 ' + SOUNDTRACK + '，改为实时合成配乐');
        if (label) label.textContent = '正在生成配乐（约 1–2 分钟）…';
        const t0 = performance.now();
        scorePromise = window.buildScore ? window.buildScore(48000) : Promise.reject(new Error('no score'));
        scorePromise.then(buf => {
          audio.buffer = buf;
          console.info(`[film] 配乐生成完成，用时 ${((performance.now() - t0) / 1000).toFixed(1)} 秒`);
          if (playing) startAudio();
        }).catch(err => console.warn('[film] 配乐不可用：', err)).finally(enable);
      }, { once: true });
      el.src = SOUNDTRACK;
      setTimeout(() => { if (el.readyState >= 3) { audio.elOk = true; enable(); } }, 4000);
    }
  }
  const ready = boot();

  // 逐帧导出接口（tools/render.mjs 使用）
  window.__film = {
    duration: DUR,
    chapters: CHAPTERS,
    ready,
    seek(t) { T = t; renderFrame(t); return true; },
    state: () => ({ T, playing, fileAudio: audio.elOk, audioTime: audio.el ? audio.el.currentTime : null, audioPaused: audio.el ? audio.el.paused : null }),
    // songB64：可选，背景歌曲文件（mp3 等）的 base64；不传则渲染原创配乐版
    async wavBase64(songB64) {
      let song = null;
      if (songB64) {
        const bin = atob(songB64), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        song = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(u8.buffer);
      }
      const buf = await window.buildScore(48000, song ? { song } : undefined);
      const bytes = new Uint8Array(window.encodeWav(buf));
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
})();
