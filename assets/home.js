/* DreamingFish Updater · 官网首页动效（原生 JS，无依赖） */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const root = document.documentElement;
  const reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");
  const wideMQ = matchMedia("(min-width: 901px)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let reduce = reduceMQ.matches;
  let vh = innerHeight;
  let vw = innerWidth;

  /* ---------- 启动：字体就绪后再播放首屏入场 ---------- */
  const ready = () => root.classList.add("is-ready");
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, wait(1400)]).then(ready);
  } else ready();

  /* ---------- 拆字 ---------- */
  const brand = $(".hero-brand");
  if (brand) {
    const parts = $$("[data-split]", brand);
    const n = parts.reduce((sum, p) => sum + [...p.textContent].length, 0);
    let i = 0;
    parts.forEach((p) => {
      const chars = [...p.textContent];
      p.textContent = "";
      chars.forEach((c) => {
        const s = document.createElement("span");
        s.className = "ch";
        s.textContent = c;
        s.style.setProperty("--i", i++);
        s.style.setProperty("--n", n);
        p.appendChild(s);
      });
    });
  }

  const highlights = $$("[data-highlight]").map((el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          [...child.textContent].forEach((c) => {
            if (!c.trim()) { frag.appendChild(document.createTextNode(c)); return; }
            const s = document.createElement("span");
            s.className = "hl";
            s.textContent = c;
            s.style.setProperty("--i", i++);
            frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") walk(child);
      });
    };
    walk(el);
    el.style.setProperty("--n", i);
    return el;
  });

  /* ---------- 跑马灯：复制轨道实现无缝循环 ---------- */
  $$("[data-marquee]").forEach((row) => {
    const track = $(".marquee-track", row);
    const copy = track.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    row.appendChild(copy);
  });

  /* ---------- 出现动画 ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); revealIO.unobserve(e.target); }
    });
  }, { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  $$("[data-reveal]").forEach((el) => revealIO.observe(el));

  /* ---------- 导航 ---------- */
  const nav = $("[data-nav]");
  const navLinks = $$("[data-nav-links] a[href^='#']");
  const navPill = $("[data-nav-pill]");
  const navSections = navLinks.map((a) => document.getElementById(a.getAttribute("href").slice(1)));
  let activeNav = -1;
  const setNav = (idx) => {
    if (idx === activeNav) return;
    activeNav = idx;
    navLinks.forEach((a, i) => a.classList.toggle("is-active", i === idx));
    if (!navPill) return;
    if (idx < 0) { navPill.style.opacity = "0"; return; }
    const a = navLinks[idx];
    navPill.style.opacity = "1";
    navPill.style.width = `${a.offsetWidth}px`;
    navPill.style.transform = `translateX(${a.offsetLeft}px)`;
  };

  const menuBtn = $("[data-menu-toggle]");
  const sheet = $("[data-menu-sheet]");
  const setMenu = (open) => {
    sheet.classList.toggle("is-open", open);
    sheet.setAttribute("aria-hidden", String(!open));
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    $("use", menuBtn).setAttribute("href", open ? "#i-x" : "#i-menu");
    document.body.style.overflow = open ? "hidden" : "";
  };
  menuBtn?.addEventListener("click", () => setMenu(!sheet.classList.contains("is-open")));
  $$("a", sheet).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet.classList.contains("is-open")) setMenu(false); });

  const progressBar = $("[data-scroll-progress]");

  /* ---------- 首屏：滚动驱动的设备升起 ---------- */
  const hero = $("[data-hero]");
  const heroArt = $("[data-hero-art]");
  const device = $("[data-hero-device]");
  const chips = $$("[data-chip]");
  const heroState = { p: 0, tp: 0, mx: 0, my: 0, tmx: 0, tmy: 0 };
  const pinActive = () => wideMQ.matches && !reduce;

  if (hero && finePointer) {
    hero.addEventListener("pointermove", (e) => {
      heroState.tmx = e.clientX / vw - .5;
      heroState.tmy = e.clientY / vh - .5;
      kick();
    });
    hero.addEventListener("pointerleave", () => { heroState.tmx = 0; heroState.tmy = 0; kick(); });
  }

  const renderHero = () => {
    if (!hero) return false;
    const pin = pinActive();
    const total = hero.offsetHeight - vh;
    heroState.tp = pin && total > 0 ? clamp(-hero.getBoundingClientRect().top / total) : 0;
    const k = .14;
    heroState.p += (heroState.tp - heroState.p) * k;
    heroState.mx += (heroState.tmx - heroState.mx) * .08;
    heroState.my += (heroState.tmy - heroState.my) * .08;
    if (Math.abs(heroState.tp - heroState.p) < .0004) heroState.p = heroState.tp;
    const p = heroState.p;

    hero.style.setProperty("--hp", p.toFixed(4));
    if (heroArt) {
      heroArt.style.translate = `${(-heroState.mx * 26).toFixed(2)}px ${(-heroState.my * 18 + p * 40).toFixed(2)}px`;
    }

    if (pin && device) {
      const e = easeOut(range(p, 0, .6));
      const h = device.offsetHeight;
      const s0 = .74;
      const peek = clamp(vh * .2, 110, 210);
      const y0 = vh / 2 - peek + (h * s0) / 2;
      device.style.setProperty("--dev-y", `${lerp(y0, 18, e).toFixed(2)}px`);
      device.style.setProperty("--dev-rx", `${lerp(34, 0, e).toFixed(3)}deg`);
      device.style.setProperty("--dev-s", lerp(s0, 1, e).toFixed(4));
      device.style.setProperty("--dev-ry", `${(heroState.mx * 5 * e).toFixed(3)}deg`);
      chips.forEach((chip, i) => {
        const t = easeOut(range(p, .52 + i * .06, .72 + i * .06));
        chip.style.setProperty("--chip-o", t.toFixed(3));
        chip.style.setProperty("--chip-y", `${lerp(40, 0, t).toFixed(2)}px`);
        chip.style.setProperty("--chip-s", lerp(.9, 1, t).toFixed(3));
        chip.style.translate = `${(heroState.mx * (i % 2 ? -14 : 14)).toFixed(2)}px ${(heroState.my * 10).toFixed(2)}px`;
      });
    } else if (device) {
      ["--dev-y", "--dev-rx", "--dev-s", "--dev-ry"].forEach((v) => device.style.removeProperty(v));
    }
    return heroState.p !== heroState.tp || Math.abs(heroState.tmx - heroState.mx) > .001 || Math.abs(heroState.tmy - heroState.my) > .001;
  };

  /* ---------- 粒子光点 ---------- */
  const motes = (() => {
    const canvas = $("[data-motes]");
    if (!canvas || reduce) return null;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = 1, raf = 0, running = false;
    let parts = [];
    const make = (initial) => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10,
      r: .6 + Math.random() * 1.9,
      vy: -(.08 + Math.random() * .32),
      ph: Math.random() * Math.PI * 2,
      sp: .004 + Math.random() * .01,
      warm: Math.random() > .32,
      a: .25 + Math.random() * .55,
    });
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(clamp(w * h / 18000, 24, 90));
      parts = Array.from({ length: count }, () => make(true));
    };
    const frame = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const ox = -heroState.mx * 40, oy = -heroState.my * 26;
      for (const m of parts) {
        m.ph += m.sp;
        m.y += m.vy;
        m.x += Math.sin(m.ph) * .25;
        if (m.y < -10) Object.assign(m, make(false));
        const flick = .55 + Math.sin(m.ph * 3) * .45;
        const alpha = m.a * flick;
        const x = m.x + ox * (m.r / 2.5), y = m.y + oy * (m.r / 2.5);
        const c = m.warm ? "255,206,150" : "120,240,232";
        const g = ctx.createRadialGradient(x, y, 0, x, y, m.r * 5);
        g.addColorStop(0, `rgba(${c},${alpha})`);
        g.addColorStop(.25, `rgba(${c},${alpha * .45})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, m.r * 5, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    resize();
    return {
      resize,
      start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
      stop() { running = false; cancelAnimationFrame(raf); },
    };
  })();
  if (motes) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? motes.start() : motes.stop())).observe($(".hero-sticky"));
  }

  /* ---------- 更新流程：滚动叙事 ---------- */
  const story = $("[data-story]");
  const storySteps = story ? $$(".story-step", story) : [];
  const storyFrames = story ? Object.fromEntries($$("[data-frame]", story).map((img) => [img.dataset.frame, img])) : {};
  const storyNo = $("[data-story-no]");
  const storyLabel = $("[data-story-label]");
  const stepNames = ["比较本地文件", "下载变化内容", "暂存并校验", "异常时恢复", "继续启动游戏"];
  let storyActive = -1, storyFrame = "";
  const showFrame = (name) => {
    if (name === storyFrame) return;
    const next = storyFrames[name];
    const prev = storyFrames[storyFrame];
    Object.values(storyFrames).forEach((img) => { if (img !== next && img !== prev) img.classList.remove("is-active", "is-prev"); });
    if (prev) { prev.classList.remove("is-active"); prev.classList.add("is-prev"); }
    next.classList.add("is-active");
    storyFrame = name;
  };
  const renderStory = () => {
    if (!story) return;
    const mid = vh * .52;
    let active = 0;
    storySteps.forEach((s, i) => { if (s.getBoundingClientRect().top < mid) active = i; });
    const r1 = storySteps[1].getBoundingClientRect();
    const t = clamp((mid - r1.top) / r1.height);
    const name = ["checking", t < .22 ? "dl-10" : t < .46 ? "dl-40" : t < .7 ? "dl-70" : "dl-100", "verifying", "installing", "complete"][active];
    showFrame(name);
    if (active !== storyActive) {
      storyActive = active;
      storySteps.forEach((s, i) => s.classList.toggle("is-active", i === active));
      if (storyNo) storyNo.textContent = String(active + 1).padStart(2, "0");
      if (storyLabel) storyLabel.textContent = stepNames[active];
    }
    const first = storySteps[0].getBoundingClientRect();
    const last = storySteps[storySteps.length - 1].getBoundingClientRect();
    const sp = clamp((mid - first.top) / (last.top + last.height * .35 - first.top));
    story.style.setProperty("--story-p", sp.toFixed(4));
  };

  /* ---------- 宣传片封面放大 ---------- */
  const filmStage = $("[data-film-stage]");
  const renderFilm = () => {
    if (!filmStage || reduce) return;
    const r = filmStage.getBoundingClientRect();
    const t = easeOut(range(vh - r.top, 0, vh * .85));
    filmStage.style.setProperty("--fs", lerp(.86, 1, t).toFixed(4));
  };

  /* ---------- 视差 ---------- */
  const parallax = $$("[data-parallax]").map((el) => ({ el, f: parseFloat(el.dataset.parallax) || 0 }));
  const renderParallax = () => {
    if (reduce) return;
    parallax.forEach(({ el, f }) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const c = r.top + r.height / 2 - vh / 2;
      el.style.translate = `0 ${(c * -f).toFixed(1)}px`;
    });
  };

  const renderHighlights = () => {
    highlights.forEach((el) => {
      const r = el.getBoundingClientRect();
      const p = clamp((vh * .88 - r.top) / (vh * .88 - vh * .4 + r.height));
      el.style.setProperty("--hl", reduce ? 1 : p.toFixed(4));
    });
  };

  const renderChrome = () => {
    const y = scrollY;
    nav?.classList.toggle("is-scrolled", y > 24);
    const max = document.documentElement.scrollHeight - vh;
    if (progressBar) progressBar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    const line = vh * .36;
    let idx = -1;
    navSections.forEach((sec, i) => {
      if (!sec) return;
      const r = sec.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) idx = i;
    });
    setNav(idx);
  };

  /* ---------- 渲染循环：滚动或指针变化时运行，静止后自动停止 ---------- */
  let rafId = 0;
  const loop = () => {
    rafId = 0;
    renderChrome();
    const heroMoving = renderHero();
    renderStory();
    renderFilm();
    renderParallax();
    renderHighlights();
    if (heroMoving) kick();
  };
  function kick() { if (!rafId) rafId = requestAnimationFrame(loop); }
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", () => {
    vh = innerHeight; vw = innerWidth;
    motes?.resize();
    activeNav = -2;
    kick();
  });
  reduceMQ.addEventListener?.("change", () => { reduce = reduceMQ.matches; kick(); });
  wideMQ.addEventListener?.("change", kick);
  kick();

  /* ---------- 卡片聚光与磁吸按钮 ---------- */
  if (finePointer) {
    $$(".spot").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
    $$(".magnetic").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${(dx * .18).toFixed(1)}px ${(dy * .28).toFixed(1)}px`;
      });
      el.addEventListener("pointerleave", () => { el.style.translate = ""; });
    });
    $$("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        el.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
      });
      el.addEventListener("pointerleave", () => { el.style.removeProperty("--ry"); el.style.removeProperty("--rx"); });
    });
  }

  /* ---------- 视口内才运行的循环动画 ---------- */
  const whenVisible = (el, onEnter, onLeave) => {
    if (!el) return;
    new IntersectionObserver(([e]) => (e.isIntersecting ? onEnter() : onLeave()), { threshold: .25 }).observe(el);
  };

  /* ---------- 版本直达：弧线长度 ---------- */
  const arc = $(".vj-arc");
  if (arc) {
    const len = arc.getTotalLength();
    arc.style.strokeDasharray = `${len}`;
    arc.style.strokeDashoffset = reduce ? "0" : `${len}`;
    const card = arc.closest("[data-reveal]");
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      arc.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1) .35s";
      arc.style.strokeDashoffset = "0";
      io.disconnect();
    }, { threshold: .3 });
    io.observe(card || arc);
  }

  /* ---------- 模组开关 ---------- */
  const mods = $("[data-mods]");
  if (mods) {
    const hint = $("[data-mods-hint]");
    const toastEl = $("[data-mods-toast]");
    const idle = toastEl.textContent;
    const warn = $("[data-mods-warn]", mods);
    let toastTimer = 0;
    const swap = (msg, on) => {
      hint.classList.add("is-swap");
      setTimeout(() => { toastEl.textContent = msg; hint.classList.toggle("is-msg", on); hint.classList.remove("is-swap"); }, 180);
    };
    const toast = (msg) => {
      swap(msg, true);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => swap(idle, false), 3200);
    };
    const set = (sw, on) => {
      sw.classList.toggle("is-on", on);
      sw.setAttribute("aria-checked", String(on));
      sw.closest(".mod-item").classList.toggle("is-off", !on);
    };
    $$(".switch", mods).forEach((sw) => {
      set(sw, sw.classList.contains("is-on"));
      sw.addEventListener("click", () => {
        const item = sw.closest(".mod-item");
        const name = $("strong", item).textContent;
        if (sw.classList.contains("is-locked")) {
          sw.classList.remove("shake"); void sw.offsetWidth; sw.classList.add("shake");
          warn.classList.remove("flash"); void warn.offsetWidth; warn.classList.add("flash");
          toast("服务器强制同步的模组不能在本机关闭");
          return;
        }
        const on = !sw.classList.contains("is-on");
        set(sw, on);
        toast(item.classList.contains("is-player")
          ? `「${name}」已${on ? "启用" : "停用"} · 玩家自选模组，不受服务器影响`
          : `「${name}」已${on ? "启用" : "停用"} · 选择只保存在这台电脑上`);
      });
    });
    $("[data-mods-reset]", mods)?.addEventListener("click", () => {
      $$(".switch[data-default]", mods).forEach((sw) => set(sw, sw.dataset.default === "on"));
      toast("已恢复整合包默认状态");
    });
  }

  /* ---------- 管理端：自动演示发布流程 ---------- */
  const admin = $("[data-admin]");
  if (admin) {
    const frames = $$("[data-admin-view] img", admin);
    const steps = $$("[data-admin-step]", admin);
    const stepsWrap = $(".admin-steps", admin);
    const cursor = $("[data-admin-cursor]", admin);
    const ring = $("[data-admin-ring]", admin);
    const title = $("[data-admin-title]", admin);
    const titles = ["管理内容", "检查并发布", "检查并发布", "检查并发布", "检查并发布"];
    // 光标点击位置（相对截图的百分比）：侧栏“检查并发布” → 版本输入框 → 发布整合包 → 确认发布
    const targets = [[5.8, 21.9], [36, 64.2], [93.7, 54.6], [61.9, 60.7], [78, 86]];
    const durations = [2600, 2600, 2600, 2300, 3400];
    let cur = -1, timers = [], playing = false;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const showFrameAt = (i) => {
      frames.forEach((f, k) => {
        f.classList.remove("is-prev");
        if (k === cur && k !== i) f.classList.add("is-prev");
        f.classList.toggle("is-active", k === i);
      });
      later(() => frames.forEach((f, k) => { if (k !== i) f.classList.remove("is-prev"); }), 700);
    };
    const go = (i) => {
      clear();
      showFrameAt(i);
      cur = i;
      title.textContent = titles[i];
      steps.forEach((b, k) => {
        b.classList.toggle("is-done", k < i);
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", String(k === i));
      });
      void stepsWrap.offsetWidth;
      steps[i].style.setProperty("--dur", `${durations[i]}ms`);
      steps[i].classList.add("is-active");
      if (reduce || !playing) { cursor.classList.remove("show"); return; }
      const [x, y] = targets[i];
      cursor.classList.add("show");
      later(() => { cursor.style.left = `${x}%`; cursor.style.top = `${y}%`; }, 60);
      if (i < frames.length - 1) {
        later(() => {
          cursor.classList.add("press");
          ring.style.left = `${x}%`; ring.style.top = `${y}%`;
          ring.classList.remove("go"); void ring.offsetWidth; ring.classList.add("go");
        }, durations[i] - 900);
        later(() => cursor.classList.remove("press"), durations[i] - 720);
      }
      later(() => go((i + 1) % frames.length), durations[i]);
    };
    steps.forEach((b, k) => b.addEventListener("click", () => { playing = true; stepsWrap.classList.remove("is-paused"); go(k); }));
    go(0);
    whenVisible(admin, () => {
      if (playing) return;
      playing = true;
      stepsWrap.classList.remove("is-paused");
      go(cur < 0 ? 0 : cur);
    }, () => {
      playing = false;
      clear();
      stepsWrap.classList.add("is-paused");
      cursor.classList.remove("show");
    });
    stepsWrap.classList.add("is-paused");
  }

  /* ---------- 主题切换：斜切擦除 ---------- */
  const themes = $("[data-themes]");
  if (themes) {
    const btns = $$("[data-theme-btn]", themes);
    const wins = $$("[data-theme-window] img", themes);
    const bgs = $$(".brand-bg img", themes);
    const sweep = $(".theme-sweep", themes);
    const pills = $(".theme-pills", themes);
    const dur = 5200;
    let cur = 0, timer = 0, playing = false;
    const schedule = () => { clearTimeout(timer); if (playing && !reduce) timer = setTimeout(() => show((cur + 1) % wins.length), dur); };
    const show = (i) => {
      if (i !== cur) {
        const prev = cur;
        wins.forEach((w, k) => { w.classList.remove("is-prev", "wipe"); if (k !== i && k !== prev) w.classList.remove("is-active"); });
        wins[prev].classList.remove("is-active");
        wins[prev].classList.add("is-prev");
        void wins[i].offsetWidth;
        wins[i].classList.add("is-active");
        if (!reduce) {
          wins[i].classList.add("wipe");
          sweep.classList.remove("go"); void sweep.offsetWidth; sweep.classList.add("go");
        }
        bgs.forEach((b, k) => b.classList.toggle("is-active", k === i));
        cur = i;
      }
      btns.forEach((b, k) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", String(k === i));
      });
      void pills.offsetWidth;
      btns[i].style.setProperty("--dur", `${dur}ms`);
      btns[i].classList.add("is-active");
      schedule();
    };
    btns.forEach((b, k) => b.addEventListener("click", () => { playing = true; pills.classList.remove("is-paused"); show(k); }));
    whenVisible(themes, () => { playing = true; pills.classList.remove("is-paused"); show(cur); }, () => { playing = false; clearTimeout(timer); pills.classList.add("is-paused"); });
    pills.classList.add("is-paused");
  }

  /* ---------- 传输完整性：哈希校验演示 ---------- */
  const obj = $("[data-object]");
  if (obj) {
    const hashEl = $("[data-hash]", obj);
    const bar = $("[data-object-bar]", obj);
    const ok = $("[data-object-ok]", obj);
    const status = $("[data-object-status]", obj);
    const finalHash = "sha256/8f4c…d91a";
    const hex = "0123456789abcdef";
    const rnd = (n) => Array.from({ length: n }, () => hex[(Math.random() * 16) | 0]).join("");
    let running = false, raf = 0, token = 0;
    const cycle = async () => {
      const my = ++token;
      while (running && my === token) {
        ok.classList.remove("show");
        status.textContent = "声明大小与响应范围检查";
        const t0 = performance.now();
        await new Promise((resolve) => {
          const tick = (now) => {
            if (!running || my !== token) return resolve();
            const t = clamp((now - t0) / 1800);
            bar.style.setProperty("--ob", easeInOut(t).toFixed(4));
            hashEl.textContent = `sha256/${rnd(4)}…${rnd(4)}`;
            if (t < 1) raf = requestAnimationFrame(tick); else resolve();
          };
          raf = requestAnimationFrame(tick);
        });
        if (!running || my !== token) return;
        status.textContent = "计算内容哈希";
        for (let k = 0; k <= finalHash.length; k++) {
          if (!running || my !== token) return;
          hashEl.textContent = finalHash.slice(0, k) + (k < finalHash.length ? rnd(Math.min(4, finalHash.length - k)) : "");
          await wait(34);
        }
        status.textContent = "与发布清单一致，提升为可安装对象";
        ok.classList.add("show");
        await wait(2600);
        if (!running || my !== token) return;
        bar.style.setProperty("--ob", "0");
        await wait(300);
      }
    };
    if (reduce) { bar.style.setProperty("--ob", "1"); ok.classList.add("show"); }
    else whenVisible(obj, () => { if (!running) { running = true; cycle(); } }, () => { running = false; token++; cancelAnimationFrame(raf); });
  }

  /* ---------- 原子安装：事务状态机（每隔一轮模拟一次断电） ---------- */
  const atomic = $("[data-atomic]");
  if (atomic) {
    const states = $$("[data-state]", atomic);
    const log = $("[data-atomic-log]", atomic);
    const fill = $("[data-atomic-fill]", atomic);
    let running = false, token = 0, round = 0, line = 0;
    const setState = (i, fail = false) => {
      states.forEach((s, k) => {
        s.classList.toggle("is-done", k < i);
        s.classList.toggle("is-current", k === i && !fail);
        s.classList.toggle("is-fail", k === i && fail);
      });
      atomic.style.setProperty("--af", i < 0 ? 0 : ((i + 1) / states.length).toFixed(3));
    };
    const push = (tag, text, cls = "") => {
      const li = document.createElement("li");
      if (cls) li.className = cls;
      line += 1;
      li.innerHTML = `<span class="t">${String(line).padStart(2, "0")}</span><b>${tag}</b>`;
      li.appendChild(document.createTextNode(text));
      log.appendChild(li);
      while (log.children.length > 7) log.firstElementChild.remove();
    };
    const normal = [
      ["BACKED_UP", "已备份本轮涉及的文件与可信元数据"],
      ["COMMITTING", "替换 mods/dreamingfish-world.jar"],
      ["VERIFYING", "重新校验已安装文件：SHA-256 一致"],
      ["COMMITTED", "保存可信状态，清理事务日志"],
    ];
    const run = async () => {
      const my = ++token;
      const alive = () => running && my === token;
      while (alive()) {
        const failRound = round % 2 === 1;
        round += 1;
        atomic.classList.remove("is-failing");
        push("START", "开始安装 · 目标版本 1.3", "warn");
        await wait(700); if (!alive()) return;
        for (let i = 0; i < normal.length; i++) {
          setState(i);
          push(normal[i][0], normal[i][1], i === 3 ? "ok" : "");
          await wait(1050); if (!alive()) return;
          if (failRound && i === 1) {
            atomic.classList.add("is-failing");
            setState(1, true);
            atomic.classList.remove("glitch"); void atomic.offsetWidth; atomic.classList.add("glitch");
            push("CRASH", "进程意外退出（模拟断电）", "err");
            await wait(1300); if (!alive()) return;
            push("RECOVER", "下次启动：读取事务日志，发现未完成提交", "warn");
            setState(0, true);
            await wait(1100); if (!alive()) return;
            push("RECOVER", "从备份恢复旧文件与发布元数据", "warn");
            setState(-1);
            await wait(1100); if (!alive()) return;
            push("RESTORED", "实例已回到更新前的状态，不留下半套更新", "ok");
            atomic.classList.remove("is-failing");
            break;
          }
        }
        await wait(2200); if (!alive()) return;
        setState(-1);
        await wait(400);
      }
    };
    if (reduce) { setState(3); normal.forEach(([a, b]) => push(a, b)); }
    else whenVisible(atomic, () => { if (!running) { running = true; run(); } }, () => { running = false; token++; });
  }

  /* ---------- 宣传片弹窗 ---------- */
  const modal = $("[data-film-modal]");
  const video = $("[data-film-video]");
  $$("[data-film-open]").forEach((b) => b.addEventListener("click", () => {
    if (!modal || typeof modal.showModal !== "function") {
      window.open($("source", video).src, "_blank", "noopener");
      return;
    }
    modal.showModal();
    video.play().catch(() => {});
  }));
  $("[data-film-close]")?.addEventListener("click", () => modal.close());
  modal?.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
  modal?.addEventListener("close", () => video.pause());
})();
