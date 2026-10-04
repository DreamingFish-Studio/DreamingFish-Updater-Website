/*
 * DreamingFish Updater 宣传片 · 配乐
 * 音效和片头音乐由 Web Audio 实时合成，并按画面时间轴（96 BPM，一小节 2.5 秒）离线渲染成一条音轨。
 * 两种用法：
 *   buildScore(48000)                 原创配乐版：全部是程序合成，没有外部素材
 *   buildScore(48000, { song })       歌曲版：从更新器打开开始，用服主配置的启动音乐当背景音乐，
 *                                     合成部分只保留片头和音效，并整体移调到歌曲的调上
 */
(function () {
  'use strict';

  const BEAT = 0.625, BAR = 2.5, S8 = BEAT / 2, S16 = BEAT / 4;
  // 第 03 章比初版长 EXT 秒；它之后的段落沿用原来的时间写法，由 OFF 统一顺延
  const EXT = 5;
  const LEN = 118.5 + EXT;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let TRANS = 0; // 整体移调（半音）
  const mtof = m => 440 * Math.pow(2, (m + TRANS - 69) / 12);

  // 歌曲版：周杰伦《爱琴海》，A 大调，约 68 BPM。
  // 和弦走向 F#m–D–A–E 与配乐的 Bm–G–D–A 同为 vi–IV–I–V，所以配乐整体下移 5 个半音就和歌曲同调，
  // Logo 段落最后停在 E（属和弦），正好接上歌曲开头的 F#m。
  // 歌曲不剪辑：玩家点击“启动游戏”、更新器打开时（片中 19.0 秒）从头连续播放。
  // 第一段副歌在片中约 1:43 结束，宣传内容也在这里收尾；之后歌曲继续铺在片尾页下面，一直放到视频最后，随黑场淡出。
  const SONG_TRANSPOSE = -5;
  const SONG_CFG = {
    at: 19.016,      // 片中开始时间
    from: 0.95,      // 从歌曲的第几秒开始（前面是静音）
    fadeAt: 120.6,   // 随最后的黑场一起淡出（歌曲约 1:43）
    endAt: 122.45,   // 视频结束
    gain: 0.6,
  };
  // “更新中断”时歌曲不停，只是像断电一样变闷、变小；下次启动恢复后回到正常。[开始变闷, 开始恢复, 完全恢复]
  const SONG_MUFFLE = [89.40, 91.15, 92.4];

  // D 大调：vi – IV – I – V
  const CH = {
    Bm: { bass: 35, pad: [59, 62, 66, 69], arp: [71, 74, 78, 81] },
    G: { bass: 31, pad: [55, 59, 62, 66], arp: [67, 71, 74, 78] },
    D: { bass: 38, pad: [57, 62, 64, 66], arp: [69, 74, 76, 78] },
    A: { bass: 33, pad: [57, 61, 64, 69], arp: [69, 73, 76, 81] },
  };
  const LOOP = ['Bm', 'G', 'D', 'A'];
  const ARP = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2];

  window.DF_SCORE_LENGTH = LEN;

  window.buildScore = function (sampleRate, opts) {
    sampleRate = sampleRate || 48000;
    const SONG = (opts && opts.song) || null;
    const MUS = !SONG; // 原创配乐版才合成节奏、和声这些“音乐”部分
    TRANS = SONG ? SONG_TRANSPOSE : 0;
    const ctx = new OfflineAudioContext(2, Math.ceil(LEN * sampleRate), sampleRate);
    const R = rng(20261003);
    let OFF = 0; // 之后写的音符整体顺延的秒数

    const noiseBuf = ctx.createBuffer(1, sampleRate * 3, sampleRate);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }

    function makeIR(sec, decay) {
      const n = Math.floor(sec * sampleRate);
      const b = ctx.createBuffer(2, n, sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 240 ? i / 240 : 1);
      }
      return b;
    }

    // ---------- 节点工具 ----------
    const g = v => { const n = ctx.createGain(); n.gain.value = v === undefined ? 1 : v; return n; };
    const bq = (type, f, q) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q !== undefined) n.Q.value = q; return n; };
    const pan = p => { const n = ctx.createStereoPanner(); n.pan.value = p; return n; };
    const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    function noise(t, dur) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      s.start(t, R() * 2); s.stop(t + dur + 0.05); return s;
    }
    function perc(node, t, a, peak, d) {
      node.gain.setValueAtTime(0.0001, t);
      node.gain.exponentialRampToValueAtTime(peak, t + a);
      node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    // ---------- 总线 ----------
    const out = g(1);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15; comp.knee.value = 10; comp.ratio.value = 3.2; comp.attack.value = 0.005; comp.release.value = 0.22;
    // 母带：切掉笔记本扬声器放不出来的超低频，稍微提亮高频
    const hp = bq('highpass', 32, 0.7);
    const air = bq('highshelf', 6000); air.gain.value = 2.5;
    const mud = bq('peaking', 220, 0.9); mud.gain.value = -1.5;
    // 压缩器之后留 0.6 dB 余量，避免偶发的削波
    const trim = g(0.93);
    out.connect(hp); hp.connect(mud); mud.connect(air); air.connect(comp); comp.connect(trim); trim.connect(ctx.destination);
    out.gain.setValueAtTime(1, 0); out.gain.setValueAtTime(1, 113.6 + EXT); out.gain.linearRampToValueAtTime(0, 118.0 + EXT);

    // 主门：片头硬切与“更新中断”时把音乐整体掐断（混响尾巴一起断）
    const gate = g(1); gate.connect(out);
    const rv = ctx.createConvolver(); rv.buffer = makeIR(3.4, 3);
    const rvOut = g(0.5); rv.connect(rvOut); rvOut.connect(gate);
    const dl = ctx.createDelay(2); dl.delayTime.value = BEAT * 0.75;
    const dfb = g(0.36), dlp = bq('lowpass', 3400);
    dl.connect(dlp); dlp.connect(dfb); dfb.connect(dl);
    const dOut = g(0.45); dlp.connect(dOut); dOut.connect(gate);
    const dRv = g(0.3); dlp.connect(dRv); dRv.connect(rv);
    const drums = g(0.85); drums.connect(gate);
    const music = g(1); music.connect(gate);
    const chaos = g(1); chaos.connect(gate);
    // 音效不经过主门
    const sfx = g(1); sfx.connect(out);
    const rv2 = ctx.createConvolver(); rv2.buffer = makeIR(4.2, 2.6);
    const rv2Out = g(0.55); rv2.connect(rv2Out); rv2Out.connect(out);
    const revFor = bus => (bus === sfx ? rv2 : rv);

    const G = gate.gain;
    G.setValueAtTime(1, 0); G.setValueAtTime(1, 5.44); G.linearRampToValueAtTime(0, 5.46);
    G.setValueAtTime(0, 9.1); G.linearRampToValueAtTime(1, 9.3);
    G.setValueAtTime(1, 84.39 + EXT); G.linearRampToValueAtTime(0, 84.42 + EXT);
    G.setValueAtTime(0, 86.0 + EXT); G.linearRampToValueAtTime(1, 86.15 + EXT);

    // ---------- 乐器 ----------
    const ducks = [];
    function kick(t, v, duck) {
      t += OFF;
      v = v === undefined ? 0.9 : v;
      const o = osc('sine', 150);
      o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11); o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
      const a = g(0); perc(a, t, 0.003, v, 0.42); o.connect(a); a.connect(drums); o.start(t); o.stop(t + 0.5);
      const n = noise(t, 0.03), h = bq('highpass', 2500), ng = g(0);
      perc(ng, t, 0.001, 0.15 * v, 0.018); n.connect(h); h.connect(ng); ng.connect(drums);
      if (duck !== false) ducks.push([t, v]);
    }
    function hat(t, v, open, p) {
      t += OFF;
      const n = noise(t, open ? 0.3 : 0.07), h = bq('highpass', 7800), a = g(0), pn = pan(p || 0);
      perc(a, t, 0.001, v || 0.045, open ? 0.22 : 0.035);
      n.connect(h); h.connect(a); a.connect(pn); pn.connect(drums);
    }
    function clap(t, v) {
      t += OFF;
      v = v || 0.18;
      const n = noise(t, 0.3), b = bq('bandpass', 1500, 0.9), a = g(0);
      [0, 0.011, 0.022].forEach(o => { a.gain.setValueAtTime(v, t + o); a.gain.exponentialRampToValueAtTime(v * 0.2, t + o + 0.009); });
      a.gain.setValueAtTime(v * 0.8, t + 0.033); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.21);
      n.connect(b); b.connect(a); a.connect(drums);
      const s = g(0.3); a.connect(s); s.connect(rv);
    }
    function snare(t, v, bus) {
      t += OFF;
      bus = bus || drums;
      const n = noise(t, 0.2), b = bq('bandpass', 1900, 0.7), a = g(0);
      perc(a, t, 0.001, v, 0.14); n.connect(b); b.connect(a); a.connect(bus);
      const o = osc('triangle', 190), og = g(0); perc(og, t, 0.001, v * 0.6, 0.07); o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.12);
    }
    function crash(t, v) {
      t += OFF;
      const n = noise(t, 2.0), h = bq('highpass', 4800), a = g(0);
      perc(a, t, 0.002, v || 0.1, 1.8); n.connect(h); h.connect(a); a.connect(drums);
      const s = g(0.4); a.connect(s); s.connect(rv);
    }
    function bass(t, m, dur, v) {
      t += OFF;
      const f = mtof(m);
      const o1 = osc('sawtooth', f), o2 = osc('sine', f);
      const lp = bq('lowpass', 900, 3);
      lp.frequency.setValueAtTime(1100, t); lp.frequency.exponentialRampToValueAtTime(220, t + Math.min(dur, 0.3));
      const a = g(0), sa = g(0);
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(v, t + 0.008); a.gain.setValueAtTime(v, t + dur * 0.6); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      sa.gain.setValueAtTime(0.0001, t); sa.gain.exponentialRampToValueAtTime(v * 1.2, t + 0.01); sa.gain.setValueAtTime(v * 1.2, t + dur * 0.6); sa.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o1.connect(lp); lp.connect(a); a.connect(music); o2.connect(sa); sa.connect(music);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function sub(t, m, dur, v, bus) {
      t += OFF;
      const o = osc('sine', mtof(m)), a = g(0);
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(v, t + 0.3); a.gain.setValueAtTime(v, t + dur - 0.3); a.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
      o.connect(a); a.connect(bus || music); o.start(t); o.stop(t + dur + 0.7);
    }
    function pad(t, notes, dur, v, cut, att, rel, bus, cutEnd) {
      t += OFF;
      bus = bus || music; att = att || 0.5; rel = rel || 1.0;
      const lp = bq('lowpass', cut || 1500, 0.6);
      if (cutEnd) { lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(cutEnd, t + dur); }
      const a = g(0);
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(v, t + att); a.gain.setValueAtTime(v, t + dur); a.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
      lp.connect(a); a.connect(bus);
      const s = g(0.45); a.connect(s); s.connect(revFor(bus));
      notes.forEach(m => {
        [-7, 7].forEach((det, k) => {
          const o = osc('sawtooth', mtof(m)); o.detune.value = det + (R() - 0.5) * 4;
          const p = pan(k ? 0.35 : -0.35); o.connect(p); p.connect(lp);
          o.start(t); o.stop(t + dur + rel + 0.1);
        });
      });
    }
    function pluck(t, m, v, cut, dsend, bus, p) {
      t += OFF;
      bus = bus || music; cut = cut || 3800;
      const o = osc('square', mtof(m)), o2 = osc('triangle', mtof(m) * 2);
      const lp = bq('lowpass', cut, 2);
      lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(420, t + 0.22);
      const a = g(0), o2g = g(0.25), pn = pan(p || 0);
      perc(a, t, 0.003, v || 0.07, 0.32);
      o.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(a); a.connect(pn); pn.connect(bus);
      const ds = g(dsend === undefined ? 0.35 : dsend); a.connect(ds); ds.connect(dl);
      o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.4);
    }
    function bell(t, m, v, bus, decay, wet) {
      t += OFF;
      bus = bus || music; decay = decay || 2.6;
      const f = mtof(m);
      const a = g(1); a.connect(bus);
      const s = g(wet === undefined ? 0.6 : wet); a.connect(s); s.connect(revFor(bus));
      [[1, 1, decay], [2.76, 0.3, decay * 0.4], [5.4, 0.1, decay * 0.18], [2, 0.16, decay * 0.6]].forEach(([mul, amp, d]) => {
        const o = osc('sine', f * mul), e = g(0);
        perc(e, t, 0.004, v * amp, d); o.connect(e); e.connect(a); o.start(t); o.stop(t + d + 0.1);
      });
    }
    function riser(t0, t1, v, bus, f0, f1) {
      t0 += OFF; t1 += OFF;
      bus = bus || sfx;
      const n = noise(t0, t1 - t0), b = bq('bandpass', f0 || 300, 3), a = g(0);
      b.frequency.setValueAtTime(f0 || 300, t0); b.frequency.exponentialRampToValueAtTime(f1 || 6000, t1);
      a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(v, t1 - 0.02); a.gain.linearRampToValueAtTime(0, t1);
      n.connect(b); b.connect(a); a.connect(bus);
      const s = g(0.4); a.connect(s); s.connect(revFor(bus));
    }
    function impact(t, v, bus) {
      t += OFF;
      bus = bus || sfx; v = v || 0.9;
      const o = osc('sine', 90);
      o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
      const a = g(0); perc(a, t, 0.004, v, 2.2); o.connect(a); a.connect(bus); o.start(t); o.stop(t + 2.4);
      const n = noise(t, 1.4), lp = bq('lowpass', 1400), na = g(0);
      lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(200, t + 1.2);
      perc(na, t, 0.002, v * 0.45, 1.2); n.connect(lp); lp.connect(na); na.connect(bus);
      const s = g(0.8); na.connect(s); s.connect(revFor(bus));
    }
    function whoosh(t, dur, v, up) {
      t += OFF;
      dur = dur || 0.6; v = v || 0.1; up = up !== false;
      const n = noise(t, dur), b = bq('bandpass', 600, 1.4);
      b.frequency.setValueAtTime(up ? 400 : 3000, t); b.frequency.exponentialRampToValueAtTime(up ? 3200 : 380, t + dur);
      const a = g(0);
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(v, t + dur * 0.55); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const p = pan(0); p.pan.setValueAtTime(-0.6, t); p.pan.linearRampToValueAtTime(0.6, t + dur);
      n.connect(b); b.connect(a); a.connect(p); p.connect(sfx);
      const s = g(0.35); a.connect(s); s.connect(rv2);
    }
    function blip(t, f, v) {
      t += OFF;
      const o = osc('sine', f), a = g(0); perc(a, t, 0.002, v, 0.06);
      o.connect(a); a.connect(sfx); o.start(t); o.stop(t + 0.1);
    }
    function click(t, v) {
      t += OFF;
      v = v || 0.2;
      const o = osc('sine', 2400);
      o.frequency.setValueAtTime(2600, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
      const a = g(0); perc(a, t, 0.001, v, 0.04); o.connect(a); a.connect(sfx); o.start(t); o.stop(t + 0.08);
      const n = noise(t, 0.02), h = bq('highpass', 3000), na = g(0);
      perc(na, t, 0.0005, v * 0.5, 0.012); n.connect(h); h.connect(na); na.connect(sfx);
    }
    function pop(t, m, v) {
      t += OFF;
      const o = osc('sine', mtof(m + 7));
      o.frequency.setValueAtTime(mtof(m + 7), t); o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.05);
      const a = g(0); perc(a, t, 0.002, v, 0.16); o.connect(a); a.connect(chaos); o.start(t); o.stop(t + 0.22);
      const o2 = osc('sine', mtof(m + 12)), a2 = g(0);
      perc(a2, t + 0.05, 0.002, v * 0.5, 0.12); o2.connect(a2); a2.connect(chaos); o2.start(t + 0.05); o2.stop(t + 0.25);
    }
    function buzz(t, v, bus) {
      t += OFF;
      [98, 103.5].forEach(f => {
        const o = osc('square', f), lp = bq('lowpass', 1300), a = g(0);
        a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(v, t + 0.01);
        a.gain.setValueAtTime(v, t + 0.16); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        o.connect(lp); lp.connect(a); a.connect(bus || chaos); o.start(t); o.stop(t + 0.3);
      });
    }
    function chime(t, v, notes) {
      (notes || [86, 90, 93, 98]).forEach((m, i) => bell(t + i * 0.07, m, v * (1 - i * 0.12), sfx, 2.2, 0.7));
    }
    function glitch(t) {
      const tIn = t; t += OFF;
      for (let i = 0; i < 18; i++) {
        const tt = t + R() * 0.55, d = 0.012 + R() * 0.05;
        const o = osc(R() > 0.5 ? 'square' : 'sawtooth', 60 + R() * 1800), a = g(0), p = pan(R() * 1.6 - 0.8);
        a.gain.setValueAtTime(0.0001, tt); a.gain.linearRampToValueAtTime(0.07 + R() * 0.05, tt + 0.002); a.gain.setValueAtTime(0.0001, tt + d);
        o.connect(a); a.connect(p); p.connect(sfx); o.start(tt); o.stop(tt + d + 0.01);
      }
      const n = noise(t, 0.35), na = g(0), b = bq('bandpass', 1200, 0.6);
      perc(na, t, 0.001, 0.26, 0.3); n.connect(b); b.connect(na); na.connect(sfx);
      const o = osc('sawtooth', 300), lp = bq('lowpass', 1500), a = g(0);
      o.frequency.setValueAtTime(320, t + 0.05); o.frequency.exponentialRampToValueAtTime(22, t + 0.9);
      a.gain.setValueAtTime(0.0001, t + 0.05); a.gain.exponentialRampToValueAtTime(0.18, t + 0.07); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      o.connect(lp); lp.connect(a); a.connect(sfx); o.start(t + 0.05); o.stop(t + 1.0);
      impact(tIn, 0.7);
    }
    function rewind(t0, t1) {
      const r0 = t0, r1 = t1; t0 += OFF; t1 += OFF;
      const o = osc('sawtooth', 70), lp = bq('lowpass', 500, 4), a = g(0);
      o.frequency.setValueAtTime(70, t0); o.frequency.exponentialRampToValueAtTime(900, t1);
      lp.frequency.setValueAtTime(500, t0); lp.frequency.exponentialRampToValueAtTime(4000, t1);
      a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(0.05, t1 - 0.05); a.gain.linearRampToValueAtTime(0, t1);
      o.connect(lp); lp.connect(a); a.connect(sfx); o.start(t0); o.stop(t1 + 0.05);
      riser(r0, r1, 0.1, sfx, 3000, 400);
    }
    function drone(t0, t1, m, v, bus, cut) {
      t0 += OFF; t1 += OFF;
      const lp = bq('lowpass', cut, 3), lfo = osc('sine', 0.3), lg = g(cut * 0.4), a = g(0);
      lfo.connect(lg); lg.connect(lp.frequency);
      a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(v, t0 + 1.5); a.gain.setValueAtTime(v, t1 - 0.05); a.gain.linearRampToValueAtTime(0, t1);
      [-6, 6].forEach(d => { const o = osc('sawtooth', mtof(m)); o.detune.value = d; o.connect(lp); o.start(t0); o.stop(t1 + 0.05); });
      lfo.start(t0); lfo.stop(t1 + 0.05); lp.connect(a); a.connect(bus);
    }
    function grooveBar(b, o) {
      const t0 = b * BAR;
      const ch = CH[o.chord || LOOP[(((b - 7) % 4) + 4) % 4]];
      if (o.kick !== false) for (let k = 0; k < 4; k++) kick(t0 + k * BEAT, o.kv || 0.9);
      if (o.clap) { clap(t0 + BEAT, o.cv); clap(t0 + 3 * BEAT, o.cv); }
      for (let k = 1; k < 8; k += 2) hat(t0 + k * S8, o.hv || 0.045, false, 0.15);
      if (o.hats16) for (let k = 1; k < 16; k += 2) hat(t0 + k * S16, 0.016, false, -0.2);
      if (o.openHat) hat(t0 + 3.5 * BEAT, 0.032, true, 0.1);
      if (o.bass !== false) for (let k = 0; k < 8; k++) bass(t0 + k * S8 + 0.01, ch.bass + 12 + (o.bassOct && k % 4 === 3 ? 12 : 0), S8 * 0.9, k % 2 ? 0.17 : 0.12);
      pad(t0, ch.pad, BAR - 0.05, o.pv || 0.03, o.pc || 1400, 0.12, 0.5);
      if (o.arp) for (let k = 0; k < 16; k++) pluck(t0 + k * S16, ch.arp[ARP[k]] + (o.arpUp ? 12 : 0), o.av || 0.035, o.ac || 3000, 0.3, music, k % 2 ? 0.25 : -0.25);
    }

    // ================= 序章 0–5.45：群聊炸锅 =================
    drone(0, 5.6, 35, 0.11, chaos, 260);
    for (let t = S8; t < 5.45; t += S8) hat(t, 0.022 + 0.04 * (t / 5.45), false, Math.round(t / S8) % 2 ? 0.25 : -0.25);
    for (let t = 3.4375; t < 5.45; t += S8) hat(t + S16, 0.022, false, 0);
    [2.5, 3.125, 3.75, 4.0625, 4.375, 4.6875, 5.0, 5.15625, 5.3125].forEach((t, i) => kick(t, 0.32 + i * 0.06, false));
    [0.45, 1.15, 1.85, 2.4, 2.85, 3.2, 3.5, 3.74, 3.95, 4.13, 4.29, 4.43, 4.56, 4.67, 4.77, 4.86, 4.94, 5.02, 5.09, 5.16]
      .forEach((t, i) => pop(t, 74 + (i % 5) * 2 + Math.floor(i / 5) * 2, 0.07));
    [2.05, 2.95, 3.6, 4.2, 4.62, 4.85].forEach(t => buzz(t, 0.06));
    pad(3.0, [59, 60, 65, 66], 2.45, 0.028, 500, 2.2, 0.05, chaos, 3200);
    riser(2.8, 5.45, 0.14, chaos, 300, 5000);

    // ================= 立论 5.9–10 =================
    bell(5.9, 71, 0.1, sfx, 3.5, 0.8); bell(5.9, 59, 0.05, sfx, 3.5, 0.8);
    sub(5.9, 35, 3.6, 0.07, sfx);
    bell(7.3, 66, 0.09, sfx, 3.5, 0.8); bell(7.3, 74, 0.06, sfx, 3.5, 0.8);
    riser(8.0, 9.98, 0.2, sfx, 250, 7000);
    pad(8.2, [59, 62, 66, 71], 1.78, 0.026, 600, 1.7, 0.05, sfx, 4000);

    // ================= Logo 10–17.5 =================
    impact(10.0, 1.0); crash(10.0, 0.11);
    pad(10.0, CH.Bm.pad, 2.5, 0.042, 1200, 0.25, 1.0);
    pad(12.5, CH.G.pad, 2.5, 0.042, 1300, 0.5, 1.0);
    sub(10.0, 35, 2.4, 0.13); sub(12.5, 31, 2.4, 0.13);
    [83, 86, 90, 93, 95, 98, 102].forEach((m, i) => bell(10.05 + i * 0.16, m, 0.045, music, 1.8, 0.7));
    pluck(13.75, 86, 0.085, 4000, 0.5); pluck(14.375, 90, 0.085, 4000, 0.5); pluck(15.0, 93, 0.095, 4000, 0.5);
    if (MUS) {
      pad(15.0, CH.A.pad, 2.5, 0.042, 1500, 0.5, 0.6, music, 3200);
      sub(15.0, 33, 2.4, 0.13);
      [15.0, 15.625, 16.25, 16.875].forEach((t, i) => kick(t, 0.42 + i * 0.12));
      [16.875, 17.03125, 17.1875, 17.34375].forEach((t, i) => snare(t, 0.04 + i * 0.03));
      riser(15.6, 17.45, 0.13, music, 400, 6000);
    } else {
      // 歌曲版：Logo 停在属和弦上，不再往鼓点上推，而是轻轻悬着，等更新器打开后由歌曲接上
      pad(15.0, CH.A.pad, 4.1, 0.03, 1300, 0.5, 0.5, music, 700);
      sub(15.0, 33, 4.0, 0.075);
      riser(15.6, 17.4, 0.07, sfx, 400, 4000);
    }
    whoosh(16.95, 0.55, 0.12);

    // ================= 17.5–40：玩家体验、专属界面 =================
    if (MUS) {
      for (let b = 7; b <= 11; b++) grooveBar(b, { pv: 0.03, pc: 1300, arp: b >= 9, av: 0.028, ac: 2200, hv: 0.04 });
      [29.375, 29.53125, 29.6875, 29.84375].forEach((t, i) => snare(t, 0.04 + i * 0.025));
      for (let b = 12; b <= 18; b++) grooveBar(b, { clap: true, arp: true, av: 0.034, ac: 3200, pv: 0.032, pc: 1700, hats16: b >= 16, openHat: true });
      crash(30, 0.09);
    }

    click(19.15, 0.24); whoosh(19.35, 0.8, MUS ? 0.12 : 0.08);
    chime(24.6, 0.065, [81, 85, 88, 93]);
    whoosh(28.4, 1.2, 0.07);
    [31.6, 32.85, 34.1].forEach(t => whoosh(t, 0.55, 0.08));
    whoosh(35.55, 0.9, 0.11);
    [74, 78, 81, 86].forEach((m, i) => pluck(35.6 + i * 0.07, m, 0.045, 3000, 0.4));
    whoosh(39.3, 0.8, 0.07, false);

    // ================= 第 03 章 40–57.5：每个版本都在变 → 停在 1.2 的玩家 → 一步直达 =================
    whoosh(40.55, 0.9, 0.08);
    for (let i = 0; i < 8; i++) blip(40.78 + i * 0.07, 1700 + i * 140, 0.02);
    const VC_T = [41.6, 42.4, 43.2, 44.0, 44.8, 45.6, 46.4];
    VC_T.forEach((t, k) => {
      blip(t - 0.42, 2400, 0.012);
      if (k === 3) { buzz(t, 0.05, sfx); impact(t, MUS ? 0.22 : 0.15); }
      else pluck(t, [66, 69, 71, 74, 76, 78, 81][k], MUS ? 0.07 : 0.055, 3400, 0.4);
    });
    whoosh(47.3, 0.6, 0.06, false);
    // 47.5–50 抽掉底鼓和贝斯，留一点悬念
    if (MUS) grooveBar(19, { kick: false, bass: false, arp: true, av: 0.022, ac: 1500, pv: 0.034, pc: 900, hv: 0.03 });
    pop(47.8, 74, 0.09);
    for (let k = 0; k < 5; k++) blip(48.25 + k * 0.13, 1300 + k * 160, 0.035);
    whoosh(48.8, 0.5, 0.05, false);
    riser(47.6, 49.98, MUS ? 0.15 : 0.09, MUS ? music : sfx, 300, 7000);
    if (MUS) for (let t = 49.375; t < 49.98; t += S16) snare(t, 0.03 + (t - 49.375) * 0.12);
    [74, 78, 81, 86, 90, 93].forEach((m, i) => bell(49.1 + i * 0.15, m, 0.04, music, 1.4, 0.6));
    // 50.0 落在 1.7：正拍重新进鼓（歌曲版正好是副歌第一拍）
    impact(50.0, MUS ? 0.6 : 0.35); chime(50.0, 0.09, [86, 90, 93, 98]);
    if (MUS) {
      crash(50.0, 0.11);
      for (let b = 20; b <= 22; b++) grooveBar(b, { clap: true, arp: true, arpUp: b === 20, av: 0.034, ac: 3600, pv: 0.034, pc: 1900, hats16: true, openHat: true, bassOct: b >= 21 });
    }
    whoosh(50.45, 0.8, 0.08);
    [81, 83, 86, 88, 90, 93].forEach((m, k) => pluck(51.65 + k * 0.4, m, 0.045, 3400, 0.3));
    for (let k = 0; k < 6; k++) blip(54.25 + k * 0.12, 2200 + k * 140, 0.02);
    chime(55.0, 0.05, [86, 90, 93]);
    whoosh(56.8, 0.7, 0.07, false);

    // ================= 之后的段落：沿用原时间写法，整体顺延 EXT 秒 =================
    OFF = EXT;
    if (MUS) {
      for (let b = 21; b <= 25; b++) grooveBar(b, { clap: true, arp: true, av: 0.034, ac: 3200, pv: 0.032, pc: 1700, hats16: true, openHat: true });
      for (let b = 26; b <= 30; b++) grooveBar(b, { clap: true, arp: true, av: 0.033, ac: 3000, pv: 0.034, pc: 1800, hats16: true, openHat: true, bassOct: true });
      [52.5, 65].forEach(t => crash(t, 0.09));
    }

    // 服主管理端
    whoosh(52.9, 0.9, 0.11);
    [54.25, 54.43, 54.61].forEach(t => whoosh(t, 0.9, 0.05));
    pluck(55.25, 86, 0.05, 3000, 0.4);
    click(56.8, 0.22);
    for (let k = 0; k < 8; k++) blip(57.4 + k * 0.1, 2000 + k * 150, 0.025);
    whoosh(59.3, 0.7, 0.04);
    click(60.3, 0.22); blip(60.45, 1500, 0.03);
    click(61.4, 0.22);
    chime(61.8, 0.1, [86, 90, 93, 98]);
    whoosh(64.6, 0.8, 0.07, false);
    // 维护方式与玩家的选择
    [66.0, 66.45, 66.9].forEach((t, i) => pluck(t, [62, 66, 69][i], 0.065, 2500, 0.35));
    whoosh(70.6, 0.8, 0.07, false); whoosh(71.3, 0.8, 0.09);
    blip(72.58, 1600, 0.06); blip(72.64, 1200, 0.06);
    click(73.56, 0.16);
    click(74.86, 0.2); chime(74.9, 0.045, [81, 86]);
    whoosh(77.0, 0.7, 0.06, false);

    // ================= 安全与原子性 77.5–92.5（实际顺延 EXT） =================
    impact(77.5, MUS ? 0.45 : 0.3);
    if (MUS) {
      kick(77.5, 1.0); crash(77.5, 0.09);
      pad(77.5, [47, 54, 59, 62], 6.9, 0.038, 600, 1.0, 0.1, music, 1400);
      sub(77.5, 35, 6.8, 0.1);
      for (let t = 78.75; t < 84.4; t += S8) hat(t, 0.028 + 0.02 * ((t - 78.75) / 5.65), false, Math.round(t / S8) % 2 ? 0.2 : -0.2);
      [80.0, 81.25, 82.5, 83.125, 83.75, 84.0625].forEach(t => kick(t, 0.7));
    }
    [71, 74, 76, 78, 81].forEach((m, i) => { pluck(80.6 + i * BEAT, m, MUS ? 0.1 : 0.075, 4200, 0.45); bell(80.6 + i * BEAT, m + 12, 0.025, music, 1.2, 0.5); });
    for (let t = 83.725; t < 84.39; t += S16 / 2) pluck(t, 83, (0.03 + (t - 83.725) * 0.1) * (MUS ? 1 : 0.7), 5000, 0.1);
    riser(83.2, 84.38, 0.14, MUS ? music : sfx, 600, 8000);
    glitch(84.4);
    sub(84.6, 31, 1.2, 0.035, sfx);
    click(85.95, 0.14);
    rewind(86.2, 87.3);
    chime(87.4, 0.1, [74, 78, 81, 86]);
    pad(87.4, CH.G.pad, MUS ? 1.6 : 1.9, 0.03, 1200, 0.3, MUS ? 0.4 : 0.25);
    // 宣判句：歌曲版在这一拍把歌接回来
    impact(89.0, MUS ? 0.9 : 0.55);
    if (MUS) {
      crash(89.0, 0.1);
      pad(89.0, CH.D.pad, 1.0, 0.04, 1600, 0.05, 0.3);
      sub(89.0, 38, 1.0, 0.12);
      pad(90.0, CH.A.pad, 2.45, 0.04, 600, 0.2, 0.05, music, 4000);
      for (let k = 0; k < 4; k++) kick(90 + k * BEAT, 0.55 + k * 0.1);
      for (let t = 90; t < 91.25; t += S16) snare(t, 0.025 + (t - 90) * 0.04);
      for (let t = 91.25; t < 92.4; t += S16 / 2) snare(t, 0.07 + (t - 91.25) * 0.11);
      riser(90.0, 92.45, 0.18, music, 300, 9000);
    }

    // ================= 更多能力 92.5–105 =================
    impact(92.5, MUS ? 0.8 : 0.45);
    if (MUS) {
      crash(92.5, 0.13);
      for (let b = 37; b <= 41; b++) grooveBar(b, { clap: true, arp: true, arpUp: b >= 39, av: 0.036, ac: 4200, pv: 0.036, pc: 2400, hats16: true, openHat: true, bassOct: true, kv: 0.95 });
    }
    [78, 81, 83, 86, 88, 90, 93, 95].forEach((m, i) => bell(93.0 + i * 1.15, m, MUS ? 0.055 : 0.035, music, 1.4, 0.5));
    [86, 88, 90, 93, 95, 98, 100, 102, 105].forEach((m, i) => bell(102.6 + i * 0.09, m, MUS ? 0.035 : 0.028, sfx, 1.5, 0.7));
    whoosh(102.55, 1.0, 0.09);

    // ================= 收束 105–117.5 =================
    if (MUS) {
      [104.375, 104.53125, 104.6875, 104.84375].forEach((t, i) => snare(t, 0.05 + i * 0.03));
      impact(105.0, 0.85); crash(105.0, 0.11);
      pad(105.0, [50, 57, 62, 66, 69], 5.0, 0.038, 1600, 0.4, 1.0);
      pad(110.0, [55, 59, 62, 66, 69], 2.5, 0.036, 1500, 0.4, 0.8);
      pad(112.5, [50, 57, 62, 64, 66, 69], 5.0, 0.036, 1300, 0.6, 2.5);
      sub(105.0, 38, 5.0, 0.11); sub(110.0, 31, 2.5, 0.11); sub(112.5, 38, 5.0, 0.11);
      [78, 81, 85, 86].forEach((m, i) => bell(106.0 + i * 0.16, m, 0.055, music, 2.0, 0.7));
      [74, 78, 81, 90].forEach((m, i) => bell(107.1 + i * 0.16, m, 0.055, music, 2.4, 0.7));
      [86, 88, 90].forEach((m, k) => pluck(108.6 + k * 0.2, m, 0.045, 3500, 0.5));
      bell(112.5, 86, 0.065, music, 4.0, 0.9); bell(112.5, 74, 0.045, music, 4.0, 0.9);
    } else {
      // 片尾页下面是歌曲的间奏，只留一声轻的落点和标题出现时的几下铃声
      impact(105.0, 0.35);
      [78, 81, 85, 86].forEach((m, i) => bell(106.0 + i * 0.16, m, 0.035, music, 2.0, 0.7));
      [74, 78, 81, 90].forEach((m, i) => bell(107.1 + i * 0.16, m, 0.035, music, 2.4, 0.7));
      [86, 88, 90].forEach((m, k) => pluck(108.6 + k * 0.2, m, 0.035, 3500, 0.5));
    }

    // 歌曲：原样连续播放，直接进压缩器（不经过配乐的均衡）
    if (SONG) {
      const C = SONG_CFG, [m0, m1, m2] = SONG_MUFFLE;
      const src = ctx.createBufferSource(), env = g(0), dip = g(1), lp = bq('lowpass', 20000, 0.7);
      src.buffer = SONG;
      src.connect(env); env.connect(dip); dip.connect(lp); lp.connect(comp);
      src.start(C.at, C.from, C.endAt - C.at + 0.1);
      env.gain.setValueAtTime(0, C.at); env.gain.linearRampToValueAtTime(C.gain, C.at + 0.08);
      env.gain.setValueAtTime(C.gain, C.fadeAt); env.gain.linearRampToValueAtTime(0, C.endAt);
      // 断电：变闷、变小；恢复时随“倒带”音效回到正常
      lp.frequency.setValueAtTime(20000, m0); lp.frequency.exponentialRampToValueAtTime(380, m0 + 0.08);
      lp.frequency.setValueAtTime(380, m1); lp.frequency.exponentialRampToValueAtTime(20000, m2);
      dip.gain.setValueAtTime(1, m0); dip.gain.linearRampToValueAtTime(0.4, m0 + 0.08);
      dip.gain.setValueAtTime(0.4, m1); dip.gain.linearRampToValueAtTime(1, m2);
    }

    // 底鼓压缩（sidechain 式闪避）
    ducks.sort((a, b) => a[0] - b[0]);
    const M = music.gain; M.setValueAtTime(1, 0);
    for (const [t, v] of ducks) { M.setValueAtTime(1 - 0.5 * Math.min(1, v), t); M.setTargetAtTime(1, t + 0.03, 0.09); }

    return ctx.startRendering();
  };

  // 16-bit PCM WAV 编码（录制/导出 MP4 时使用）
  window.encodeWav = function (buf) {
    const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
    const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
    ws(36, 'data'); data.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return data.buffer;
  };
})();
