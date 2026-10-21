"use strict";
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var CFG = window.FARJA_CONFIG || {};
var QS = new URLSearchParams(location.search);
var DEMO = QS.has("demo");
var VERSION = "1.7.0";
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem("farja." + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("farja." + k, JSON.stringify(v));
    } catch (e) {
    }
  },
  del(k) {
    try {
      localStorage.removeItem("farja." + k);
    } catch (e) {
    }
  }
};
const settings = Object.assign({ hideShorts: false, autoNext: true, dailyLimit: 0 }, store.get("settings", {}));
const saveSettings = () => store.set("settings", settings);
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad2 = (n) => (n < 10 ? "0" : "") + n;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? h + ":" + pad2(m) + ":" + pad2(s) : m + ":" + pad2(s);
}
function parseISODur(iso) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}
function fmtCount(n) {
  n = +n || 0;
  if (n >= 1e6) return Math.round(n / 1e5) / 10 + " مليون";
  if (n >= 1e3) return Math.round(n / 100) / 10 + " ألف";
  return String(n);
}
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i) | 0;
  return "h" + (h >>> 0).toString(36);
}
function pickThumb(t, order) {
  t = t || {};
  for (const k of order) if (t[k] && t[k].url) return t[k].url;
  return "";
}
let toastT = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("on"), 2600);
}
class ApiError extends Error {
  constructor(kind, msg) {
    super(msg || kind);
    this.kind = kind;
  }
}
function errText(e) {
  switch (e && e.kind) {
    case "nokey":
      return "مفتاح YouTube API مش مضبوط. لازم ينضاف بملف config.js.";
    case "quota":
      return "خلصت حصة اليوم من YouTube. جرّبوا بكرة.";
    case "key":
      return "في مشكلة بمفتاح YouTube API. تأكد من إعداداته بـ Google Cloud.";
    case "network":
      return "في مشكلة بالإنترنت. تأكد إن التلفزيون متصل.";
    case "notfound":
      return "ما لقيت هالقناة. تأكد من الاسم أو الرابط.";
    default:
      return "صار خطأ غير متوقع. جرّب مرة ثانية.";
  }
}
function yt(path, params) {
  return __async(this, null, function* () {
    if (!CFG.apiKey) throw new ApiError("nokey");
    const u = new URL("https://www.googleapis.com/youtube/v3/" + path);
    Object.keys(params).forEach((k) => {
      if (params[k] != null && params[k] !== "") u.searchParams.set(k, params[k]);
    });
    u.searchParams.set("key", CFG.apiKey);
    let r;
    try {
      r = yield fetch(u.toString());
    } catch (e) {
      throw new ApiError("network", e.message);
    }
    let j = null;
    try {
      j = yield r.json();
    } catch (e) {
    }
    if (!r.ok) {
      const err = j && j.error;
      const reason = err && err.errors && err.errors[0] && err.errors[0].reason;
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "rateLimitExceeded") throw new ApiError("quota", reason);
      if (r.status === 404 || reason === "playlistNotFound" || reason === "channelNotFound") throw new ApiError("notfound", reason);
      if (r.status === 400 || r.status === 401 || r.status === 403) throw new ApiError("key", err && err.message || reason);
      throw new ApiError("http", "HTTP " + r.status);
    }
    return j;
  });
}
function parseChannelInput(raw) {
  const s = String(raw || "").trim();
  let m;
  if (m = /(UC[\w-]{22})(?![\w-])/.exec(s)) return { id: m[1] };
  if (m = /youtube\.com\/user\/([^\/?#\s]+)/i.exec(s)) return { username: decodeURIComponent(m[1]) };
  if (m = /youtube\.com\/c\/([^\/?#\s]+)/i.exec(s)) return { search: decodeURIComponent(m[1]) };
  if (m = /@([^\/?#\s]+)/.exec(s)) return { handle: "@" + decodeURIComponent(m[1]) };
  if (/^[\w.\-]{3,30}$/.test(s)) return { handle: "@" + s, fallbackSearch: s };
  return { search: s };
}
function toChannel(item) {
  const sn = item.snippet || {};
  const cd = item.contentDetails || {};
  const st = item.statistics || {};
  const rel = cd.relatedPlaylists || {};
  return {
    id: item.id,
    title: sn.title || "",
    thumb: pickThumb(sn.thumbnails, ["medium", "high", "default"]),
    uploads: rel.uploads || "UU" + String(item.id).slice(2),
    subs: st.hiddenSubscriberCount ? null : st.subscriberCount,
    videoCount: st.videoCount
  };
}
const realApi = {
  resolve(input) {
    return __async(this, null, function* () {
      const p = parseChannelInput(input);
      const part = "snippet,contentDetails,statistics";
      if (!p.search) {
        const params = { part };
        if (p.id) params.id = p.id;
        else if (p.handle) params.forHandle = p.handle;
        else if (p.username) params.forUsername = p.username;
        const j = yield yt("channels", params);
        if (j.items && j.items.length) return toChannel(j.items[0]);
        if (!p.fallbackSearch) return null;
        p.search = p.fallbackSearch;
      }
      const sj = yield yt("search", { part: "snippet", type: "channel", q: p.search, maxResults: 1 });
      const hit = sj.items && sj.items[0];
      const id = hit && (hit.snippet && hit.snippet.channelId || hit.id && hit.id.channelId);
      if (!id) return null;
      const j2 = yield yt("channels", { part, id });
      return j2.items && j2.items.length ? toChannel(j2.items[0]) : null;
    });
  },
  search(q) {
    return __async(this, null, function* () {
      const sj = yield yt("search", { part: "snippet", type: "channel", q, maxResults: 6 });
      const ids = (sj.items || []).map((h) => h.snippet && h.snippet.channelId || h.id && h.id.channelId).filter(Boolean);
      if (!ids.length) return [];
      const j = yield yt("channels", { part: "snippet,contentDetails,statistics", id: ids.join(",") });
      const by = {};
      (j.items || []).forEach((it) => {
        by[it.id] = toChannel(it);
      });
      return ids.map((id) => by[id]).filter(Boolean);
    });
  },
  // One page of a channel's uploads, with durations and embeddability.
  videos(ch, pageToken) {
    return realApi.playlistVideos(ch.uploads, pageToken);
  },
  playlists(ch, pageToken) {
    return __async(this, null, function* () {
      const j = yield yt("playlists", { part: "snippet,contentDetails", channelId: ch.id, maxResults: 50, pageToken });
      const lists = (j.items || []).filter((p) => p.contentDetails && p.contentDetails.itemCount > 0).map((p) => ({
        id: p.id,
        title: p.snippet && p.snippet.title || "",
        thumb: pickThumb(p.snippet && p.snippet.thumbnails, ["high", "medium", "standard", "default"]),
        count: p.contentDetails.itemCount
      }));
      return { lists, next: j.nextPageToken || null };
    });
  },
  // One page of any playlist (a channel's uploads is a playlist too), with durations and embeddability.
  playlistVideos(playlistId, pageToken) {
    return __async(this, null, function* () {
      const pl = yield yt("playlistItems", { part: "contentDetails", playlistId, maxResults: 50, pageToken });
      const ids = (pl.items || []).map((i) => i.contentDetails && i.contentDetails.videoId).filter(Boolean);
      if (!ids.length) return { videos: [], next: pl.nextPageToken || null };
      const vj = yield yt("videos", { part: "snippet,contentDetails,status", id: ids.join(","), maxResults: 50 });
      const byId = {};
      (vj.items || []).forEach((v) => {
        byId[v.id] = v;
      });
      const videos = [];
      ids.forEach((id) => {
        const v = byId[id];
        if (!v) return;
        const st = v.status || {};
        const sn = v.snippet || {};
        if (st.embeddable === false) return;
        if (st.privacyStatus && st.privacyStatus !== "public" && st.privacyStatus !== "unlisted") return;
        if (sn.liveBroadcastContent && sn.liveBroadcastContent !== "none") return;
        videos.push({
          id,
          title: sn.title || "",
          thumb: pickThumb(sn.thumbnails, ["high", "medium", "standard", "default"]),
          dur: parseISODur(v.contentDetails && v.contentDetails.duration),
          at: Date.parse(sn.publishedAt) || 0
        });
      });
      return { videos, next: pl.nextPageToken || null };
    });
  }
};
const DEMO_CH = [
  ["حكايات قبل النوم", 262],
  ["أناشيد الحروف", 32],
  ["عالم الحيوانات", 150],
  ["تجارب علمية صغيرة", 196],
  ["رسم وتلوين", 340],
  ["ألغاز وأرقام", 12]
];
const DEMO_TITLES = [
  "الأرنب والسلحفاة — حكاية كاملة",
  "نشيد الحروف من الألف للياء",
  "ليش السما زرقا؟",
  "كيف تنام الزرافة؟",
  "تجربة البركان بالخل والكربونات",
  "نرسم قطة بخطوات سهلة",
  "عدّ للعشرة مع البطة",
  "رحلة إلى قاع المحيط",
  "الفصول الأربعة",
  "أصوات الحيوانات بالمزرعة",
  "قصة النملة المجتهدة",
  "ألوان قوس قزح",
  "نتعلم الأشكال الهندسية",
  "كيف تطير الطيارة؟",
  "أغنية تنظيف الأسنان",
  "الفيل الصغير يضيع"
];
function svgData(svg) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function demoAvatar(hue, letter) {
  return svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('.concat(hue, ',80%,66%)"/><stop offset="1" stop-color="hsl(').concat((hue + 40) % 360, ',70%,48%)"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="150" cy="44" r="30" fill="rgba(255,255,255,.25)"/><text x="100" y="128" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="92" fill="#fff">').concat(letter, "</text></svg>"));
}
function demoThumb(hue, n) {
  const h2 = (hue + 50 + n * 17) % 360;
  return svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('.concat(hue, ',75%,62%)"/><stop offset="1" stop-color="hsl(').concat(h2, ',70%,42%)"/></linearGradient></defs><rect width="480" height="270" fill="url(#g)"/><circle cx="').concat(90 + n * 53 % 300, '" cy="').concat(70 + n * 31 % 120, '" r="').concat(40 + n * 7 % 50, '" fill="rgba(255,255,255,.22)"/><rect x="').concat(280 - n * 29 % 200, '" y="150" width="160" height="90" rx="24" fill="rgba(0,0,0,.18)"/></svg>'));
}
const demoApi = {
  resolve(input) {
    return __async(this, null, function* () {
      yield new Promise((r) => setTimeout(r, 250));
      const i = DEMO_CH.findIndex((c) => c[0] === input || "UCdemo" + DEMO_CH.indexOf(c) === input);
      if (i >= 0) {
        const [title, hue2] = DEMO_CH[i];
        return { id: "UCdemo" + i, title, thumb: demoAvatar(hue2, title.charAt(0)), uploads: "UUdemo" + i, hue: hue2, subs: 12400 * (i + 1) };
      }
      const s = String(input).replace(/^@/, "").trim();
      if (!s || /^x+$/i.test(s)) return null;
      const hue = s.length * 47 % 360;
      return { id: "UCdemo-" + s, title: s, thumb: demoAvatar(hue, s.charAt(0).toUpperCase()), uploads: "UUdemo-" + s, hue, subs: 3200 };
    });
  },
  search(q) {
    return __async(this, null, function* () {
      const out = [];
      for (let i = 0; i < 3; i++) out.push(yield demoApi.resolve(q + (i ? " " + (i + 1) : "")));
      return out.filter(Boolean);
    });
  },
  playlists(ch) {
    return __async(this, null, function* () {
      yield new Promise((r) => setTimeout(r, 350));
      const names = ["الحلقات كاملة", "أغاني الحروف", "قصص قصيرة", "تعلّم الأرقام", "أجمل الحلقات"];
      return {
        lists: names.map((t, i) => ({ id: "PLdemo-" + ch.id + "-" + i, title: t, thumb: demoThumb((ch.hue || 200) + i * 40, i * 3), count: 8 + i * 5, hue: (ch.hue || 200) + i * 40 })),
        next: null
      };
    });
  },
  playlistVideos(plId) {
    return __async(this, null, function* () {
      const m = /^PLdemo-(.+)-(\d+)$/.exec(plId) || [];
      const res = yield demoApi.videos({ id: plId, hue: 120 + (+m[2] || 0) * 40 }, null);
      return { videos: res.videos.slice(0, 8 + (+m[2] || 0) * 5), next: null };
    });
  },
  videos(ch, pageToken) {
    return __async(this, null, function* () {
      yield new Promise((r) => setTimeout(r, 450));
      const page = +(pageToken || 0);
      const hue = ch.hue || 200;
      const videos = [];
      for (let k = 0; k < 24; k++) {
        const n = page * 24 + k;
        videos.push({
          id: ch.id + "-v" + n,
          title: DEMO_TITLES[n % DEMO_TITLES.length] + (n >= DEMO_TITLES.length ? " (" + (Math.floor(n / DEMO_TITLES.length) + 1) + ")" : ""),
          thumb: demoThumb(hue, n),
          dur: n % 5 === 3 ? 45 : 25 + n * 97 % 600,
          at: Date.now() - (n * 2 + hue % 7) * 36e5 * 9
        });
      }
      return { videos, next: page < 2 ? String(page + 1) : null };
    });
  }
};
const api = DEMO ? demoApi : realApi;
let channels = [];
let channelsLoading = true;
let channelsError = null;
const resolved = store.get("resolved", {});
const RESOLVE_TTL = 7 * 24 * 3600 * 1e3;
function tvChannels() {
  return store.get("channels", []);
}
function removedIds() {
  return store.get("removed", []);
}
function ghRepo() {
  if (CFG.githubRepo) return CFG.githubRepo;
  const m = /^([^.]+)\.github\.io$/.exec(location.hostname);
  const repo = location.pathname.split("/").filter(Boolean)[0];
  return m && repo ? m[1] + "/" + repo : null;
}
function parseRemote(j) {
  const list = [];
  (Array.isArray(j) ? j : j && j.channels || []).forEach((x) => {
    if (x && typeof x === "object") {
      const id = String(x.id || x.handle || x.url || "").trim();
      if (!id) return;
      if (/^UC[\w-]{22}$/.test(id) && x.title && x.thumb) {
        resolved[id] = { ch: { id, title: x.title, thumb: x.thumb, uploads: x.uploads || "UU" + id.slice(2) }, at: Date.now() };
      }
      list.push(id);
    } else if (x) list.push(String(x).trim());
  });
  return list;
}
function fetchRemoteList() {
  return __async(this, null, function* () {
    if (DEMO) return DEMO_CH.map((c) => c[0]);
    const repo = ghRepo();
    if (repo) {
      try {
        const r = yield fetch("https://api.github.com/repos/" + repo + "/contents/channels.json?t=" + Date.now(), {
          headers: { Accept: "application/vnd.github.raw+json" },
          cache: "no-store"
        });
        if (r.ok) {
          const list = parseRemote(yield r.json());
          store.set("remoteCopy", list);
          return list;
        }
      } catch (e) {
      }
    }
    try {
      const r = yield fetch("channels.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const list = parseRemote(yield r.json());
      store.set("remoteCopy", list);
      return list;
    } catch (e) {
      return store.get("remoteCopy", []);
    }
  });
}
function loadChannels() {
  return __async(this, null, function* () {
    channelsLoading = true;
    channelsError = null;
    const remote = yield fetchRemoteList();
    const removed = removedIds();
    const out = [];
    const seen = {};
    for (const input of remote) {
      const cached = resolved[input];
      let ch = cached && cached.ch;
      if (!ch || Date.now() - cached.at > RESOLVE_TTL) {
        try {
          const fresh = yield api.resolve(input);
          if (fresh) {
            ch = fresh;
            resolved[input] = { ch: fresh, at: Date.now() };
          }
        } catch (e) {
          if (!ch) channelsError = e;
        }
      }
      if (!ch || seen[ch.id] || removed.indexOf(ch.id) >= 0) continue;
      seen[ch.id] = 1;
      out.push(Object.assign({}, ch, { source: "file" }));
    }
    store.set("resolved", resolved);
    tvChannels().forEach((ch) => {
      if (seen[ch.id]) return;
      seen[ch.id] = 1;
      out.push(Object.assign({}, ch, { source: "tv" }));
    });
    channels = out;
    channelsLoading = false;
  });
}
function rebuildChannelsLocal() {
  const removed = removedIds();
  const out = [];
  const seen = {};
  store.get("remoteCopy", DEMO ? DEMO_CH.map((c) => c[0]) : []).forEach((input) => {
    const c = resolved[input] && resolved[input].ch;
    if (!c || seen[c.id] || removed.indexOf(c.id) >= 0) return;
    seen[c.id] = 1;
    out.push(Object.assign({}, c, { source: "file" }));
  });
  tvChannels().forEach((c) => {
    if (seen[c.id]) return;
    seen[c.id] = 1;
    out.push(Object.assign({}, c, { source: "tv" }));
  });
  channels = out;
}
const VIDEO_TTL = 30 * 60 * 1e3;
const vMem = {};
function getCached(chId) {
  const c = vMem[chId] || store.get("vc2." + chId, null);
  return c && Date.now() - c.at < VIDEO_TTL ? c : null;
}
function putCached(chId, data) {
  vMem[chId] = data;
  store.set("vc2." + chId, { at: data.at, videos: data.videos.slice(0, 50), next: data.videos.length > 50 ? null : data.next });
}
const visible = (list) => list.filter((v) => !(settings.hideShorts && v.dur > 0 && v.dur <= 60));
const LIMITS = [0, 15, 30, 45, 60, 90, 120, 180];
function todayStr() {
  const d = /* @__PURE__ */ new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
let usage = store.get("usage", null);
function getUsage() {
  if (!usage || usage.date !== todayStr()) {
    usage = { date: todayStr(), sec: 0, bonus: 0, warned: 0 };
    store.set("usage", usage);
  }
  return usage;
}
function saveUsage() {
  store.set("usage", usage);
}
function limitOn() {
  return settings.dailyLimit > 0;
}
function remainingSec() {
  if (!limitOn()) return Infinity;
  const u = getUsage();
  return Math.max(0, (settings.dailyLimit + u.bonus) * 60 - u.sec);
}
const fmtMin = (s) => Math.ceil(s / 60) + " دقيقة";
let usageSaveAt = 0;
function addWatch(sec) {
  if (!limitOn()) return;
  const u = getUsage();
  u.sec += sec;
  if (Date.now() - usageSaveAt > 5e3) {
    usageSaveAt = Date.now();
    saveUsage();
  }
  const left = remainingSec();
  if (left <= 0) {
    saveUsage();
    timeUp();
    return;
  }
  if (left <= 60 && u.warned < 2) {
    u.warned = 2;
    saveUsage();
    toast("باقي دقيقة وحدة!");
  } else if (left <= 300 && u.warned < 1) {
    u.warned = 1;
    saveUsage();
    toast("باقي 5 دقايق على وقت الفرجة");
  }
}
function timeUp() {
  clearEnd();
  hideErr();
  clearInterval(tickT);
  clearInterval(guardT);
  try {
    if (player) {
      player.pauseVideo();
      player.stopVideo();
    }
  } catch (e) {
  }
  curVid = null;
  hideOSD();
  spinner(false);
  show("timeup");
  focusEl($('[data-act="tu-home"]'));
}
function renderTimeChip() {
  const chip = $("#time-chip");
  if (!limitOn()) {
    chip.classList.add("hidden");
    return;
  }
  const left = remainingSec();
  chip.textContent = left > 0 ? "باقي " + fmtMin(left) + " فرجة اليوم" : "خلص وقت الفرجة لليوم";
  chip.classList.toggle("low", left < 600);
  chip.classList.remove("hidden");
}
let current = null;
const lastFocus = {};
function show(name) {
  if (locked && name !== "locked" && name !== "pin") name = "locked";
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === name));
  current = name;
  remoteNotify();
}
function isVisible(el) {
  return !!(el.offsetWidth || el.offsetHeight);
}
function focusables() {
  const scr = document.getElementById(current);
  return scr ? $$(".f", scr).filter((el) => !el.disabled && isVisible(el)) : [];
}
function focusEl(el) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch (e) {
    el.focus();
  }
  ensureVisible(el);
}
let remPx = 10;
function slideRow(el) {
  const track = el.closest(".hrow-track");
  if (!track) return;
  const item = el.parentNode === track ? el : el.closest(".hrow-track > *");
  const w = track.clientWidth;
  const pad = 2.4 * remPx;
  let tx = +track.getAttribute("data-tx") || 0;
  const left = item.offsetLeft, right = left + item.offsetWidth;
  if (left < -tx + pad) tx = pad - left;
  else if (right > -tx + w - pad) tx = w - pad - right;
  if (item === track.firstElementChild || tx < 0) tx = 0;
  track.setAttribute("data-tx", tx);
  track.style.transform = "translateX(" + tx + "px)";
  track.style.webkitTransform = "translateX(" + tx + "px)";
}
function ensureVisible(el) {
  slideRow(el);
  const sc = el.closest(".scroll");
  if (!sc) return;
  const firstRow = sc.querySelector(".hrow");
  if (firstRow && firstRow.contains(el)) {
    sc.scrollTop = 0;
    return;
  }
  const er = el.getBoundingClientRect();
  const sr = sc.getBoundingClientRect();
  const pad = sr.height * 0.14;
  const grid = el.closest(".ch-grid, .v-grid");
  if (grid && grid.firstElementChild && Math.abs(grid.firstElementChild.getBoundingClientRect().top - er.top) < 5) {
    sc.scrollTop = 0;
    return;
  }
  if (er.top < sr.top + pad) sc.scrollTop -= sr.top + pad - er.top;
  else if (er.bottom > sr.bottom - pad) sc.scrollTop += er.bottom - (sr.bottom - pad);
}
function moveFocus(dir) {
  const cands = focusables();
  if (!cands.length) return;
  const cur = document.activeElement;
  if (!cur || cands.indexOf(cur) < 0) {
    focusEl(cands[0]);
    return;
  }
  const a = cur.getBoundingClientRect();
  const acx = a.left + a.width / 2, acy = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  cands.forEach((el) => {
    if (el === cur) return;
    const b = el.getBoundingClientRect();
    const bcx = b.left + b.width / 2, bcy = b.top + b.height / 2;
    let primary, orth;
    if (dir === "left" || dir === "right") {
      const tx = a.width * 0.3;
      if (dir === "left" ? bcx >= acx - tx : bcx <= acx + tx) return;
      primary = Math.max(0, dir === "left" ? a.left - b.right : b.left - a.right);
      const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      orth = overlap > 0 ? 0 : Math.abs(bcy - acy);
      if (orth > 0) primary += Math.abs(bcx - acx) * 0.2;
      orth *= 4;
    } else {
      const ty = a.height * 0.3;
      if (dir === "up" ? bcy >= acy - ty : bcy <= acy + ty) return;
      primary = Math.max(0, dir === "up" ? a.top - b.bottom : b.top - a.bottom);
      orth = Math.abs(bcx - acx) * 1.5;
    }
    const score = primary + orth;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  });
  if (best) focusEl(best);
}
const EMPTY_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="14" width="56" height="42" rx="12" fill="var(--card2)"/><path d="M4 26 Q18 24 22 14 L4 14Z" fill="var(--coral)" opacity=".8"/><path d="M60 26 Q46 24 42 14 L60 14Z" fill="var(--coral)" opacity=".8"/><circle cx="25" cy="36" r="3" fill="var(--ink)"/><circle cx="39" cy="36" r="3" fill="var(--ink)"/><path d="M26 46 Q32 42 38 46" stroke="var(--ink)" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';
const feedData = {};
let feedLoading = false;
let rowLists = {};
function ageText(t) {
  if (!t) return "";
  const d = Math.floor((Date.now() - t) / 864e5);
  if (d < 1) return "اليوم";
  if (d < 2) return "مبارح";
  if (d < 7) return "قبل " + d + " أيام";
  if (d < 30) {
    const w = Math.floor(d / 7);
    return w === 1 ? "قبل أسبوع" : "قبل " + w + " أسابيع";
  }
  if (d < 365) {
    const m = Math.floor(d / 30);
    return m === 1 ? "قبل شهر" : "قبل " + m + " شهور";
  }
  const y = Math.floor(d / 365);
  return y === 1 ? "قبل سنة" : "قبل " + y + " سنين";
}
function loadFeed() {
  return __async(this, null, function* () {
    if (feedLoading) return;
    feedLoading = true;
    const todo = channels.filter((c) => {
      const c2 = getCached(c.id);
      if (c2) {
        feedData[c.id] = c2.videos;
        return false;
      }
      return true;
    });
    let i = 0;
    const worker = () => __async(null, null, function* () {
      while (i < todo.length) {
        const ch = todo[i++];
        try {
          const res = yield api.videos(ch, null);
          feedData[ch.id] = res.videos;
          putCached(ch.id, { at: Date.now(), videos: res.videos, next: res.next });
        } catch (e) {
          if (!feedData[ch.id]) feedData[ch.id] = [];
        }
      }
    });
    yield Promise.all([worker(), worker(), worker()]);
    feedLoading = false;
  });
}
function buildFeed(max) {
  const lists = channels.map((c) => visible(feedData[c.id] || []).slice().sort((x, y) => (y.at || 0) - (x.at || 0)).map((v) => Object.assign({}, v, { ch: c })));
  lists.sort((x, y) => (y[0] && y[0].at || 0) - (x[0] && x[0].at || 0));
  const out = [];
  for (let round = 0; out.length < max; round++) {
    let added = false;
    lists.forEach((l) => {
      if (l[round] && out.length < max) {
        out.push(l[round]);
        added = true;
      }
    });
    if (!added) break;
  }
  return out;
}
function videoCard(v, row, i, big) {
  const meta = [(row === "feed" || row === "search" || row === "cont" || row === "favs") && v.ch ? esc(v.ch.title) : "", row === "cont" ? "باقي " + fmtTime(Math.max(0, v.dur - v.pos)) : ageText(v.at)].filter(Boolean).join(" · ");
  return '<button class="f v'.concat(big ? " big" : "", '" data-row="').concat(esc(row), '" data-i="').concat(i, '" data-key="').concat(esc(row + ":" + v.id), '"><span class="th"><img src="').concat(esc(v.thumb), '" alt="">').concat(v.dur ? '<span class="dur">' + fmtTime(v.dur) + "</span>" : "").concat(row !== "cont" && v.at && Date.now() - v.at < 3 * 864e5 ? '<span class="new">جديد</span>' : "").concat(row === "cont" && v.dur ? '<span class="prog"><i style="width:' + Math.min(100, Math.round(v.pos / v.dur * 100)) + '%"></i></span>' : "", '</span><span class="tt">').concat(esc(v.title), "</span>").concat(meta ? '<span class="meta">' + meta + "</span>" : "", "</button>");
}
function skelCards(n, big) {
  let s = "";
  for (let i = 0; i < n; i++) s += '<div class="v skel'.concat(big ? " big" : "", '"><span class="th sk"></span><span class="tt sk"></span></div>');
  return s;
}
function rowHTML(title, inner, extraClass) {
  return '<section class="hrow'.concat(extraClass ? " " + extraClass : "", '"><h2>').concat(title, '</h2><div class="hrow-view"><div class="hrow-track" data-tx="0">').concat(inner, "</div></div></section>");
}
function renderHome() {
  const hr = (/* @__PURE__ */ new Date()).getHours();
  renderTimeChip();
  $("#greet").textContent = hr < 12 ? "صباح الخير!" : hr < 17 ? "نهاركم سعيد!" : "مساء الخير!";
  const notice = $("#notice");
  if (!DEMO && !CFG.apiKey) {
    notice.innerHTML = 'التطبيق محتاج مفتاح <b dir="ltr">YouTube Data API</b> حتى يجيب الفيديوهات. ضيفه بملف <b dir="ltr">config.js</b> (الخطوات بملف README).';
    notice.classList.remove("hidden");
  } else if (channelsError && !channels.length) {
    notice.textContent = errText(channelsError);
    notice.classList.remove("hidden");
  } else notice.classList.add("hidden");
  const box = $("#home-rows");
  rowLists = {};
  if (channelsLoading) {
    let chs2 = "";
    for (let i = 0; i < 6; i++) chs2 += '<div class="ch skel"><span class="av sk"></span><span class="nm sk"></span></div>';
    box.innerHTML = rowHTML("الجديد من قنواتكم", skelCards(4, true)) + rowHTML("القنوات", chs2, "chans");
    return;
  }
  if (!channels.length) {
    box.innerHTML = '<div class="empty">' + EMPTY_SVG + '<p>لسا ما في قنوات هون.</p><p class="muted">خلّي ماما أو بابا يضيفوا قنوات من زر «الأهل».</p></div>';
    return;
  }
  const haveAny = channels.some((c) => feedData[c.id]);
  let html = "";
  const cont = continueList();
  if (cont.length) {
    rowLists.cont = cont.map((h) => Object.assign({}, h, { ch: channels.find((c) => h.ch && c.id === h.ch.id) || h.ch }));
    html += rowHTML("كمّل المشاهدة", rowLists.cont.map((v, i) => videoCard(v, "cont", i, false)).join(""));
  }
  if (haveAny) {
    const feed = buildFeed(30);
    rowLists.feed = feed;
    html += rowHTML("الجديد من قنواتكم", feed.length ? feed.map((v, i) => videoCard(v, "feed", i, true)).join("") : '<p class="muted row-empty">ما في فيديوهات لسا.</p>');
  } else {
    html += rowHTML("الجديد من قنواتكم", skelCards(4, true));
  }
  const fv = favs.filter((f) => channelAllowed(f.ch && f.ch.id));
  if (fv.length) {
    rowLists.favs = fv.map((f) => Object.assign({}, f, { ch: channels.find((c) => f.ch && c.id === f.ch.id) || f.ch }));
    html += rowHTML("مفضلتي ❤", rowLists.favs.map((v, i) => videoCard(v, "favs", i, false)).join(""));
  }
  html += rowHTML("القنوات", channels.map(
    (c) => '<button class="f ch" data-id="'.concat(esc(c.id), '" data-key="ch:').concat(esc(c.id), '"><span class="av"><img src="').concat(esc(c.thumb), '" alt=""></span><span class="nm">').concat(esc(c.title), "</span></button>")
  ).join(""), "chans");
  channels.forEach((c) => {
    const list = visible(feedData[c.id] || []).slice(0, 12);
    if (!list.length) return;
    const key = "c:" + c.id;
    rowLists[key] = list;
    html += rowHTML(esc(c.title), list.map((v, i) => videoCard(v, key, i, false)).join("") + '<button class="f more" data-id="'.concat(esc(c.id), '" data-key="more:').concat(esc(c.id), '"><span class="more-in"><img src="').concat(esc(c.thumb), '" alt=""><b>كل فيديوهات القناة</b></span></button>'));
  });
  box.innerHTML = html;
}
function rerenderHomeKeepFocus() {
  const a = document.activeElement;
  const key = a && a.getAttribute && a.getAttribute("data-key");
  const sc = $("#home .scroll");
  const top = sc.scrollTop;
  renderHome();
  sc.scrollTop = top;
  if (current !== "home") return;
  const el = key && $('#home [data-key="' + key + '"]');
  if (el && !homeFocusPending) focusEl(el);
  else if (homeFocusPending || !a || a === document.body || !$("#home").contains(a)) {
    if ($("#home .hrow .v.f")) homeFocusPending = false;
    focusHome(true);
  }
}
function refreshHomeData() {
  return __async(this, null, function* () {
    yield loadFeed();
    if (current === "home") rerenderHomeKeepFocus();
  });
}
let lastListLoad = 0;
let homeFocusPending = true;
function refreshChannelsSoon() {
  if (Date.now() - lastListLoad < 45e3) return;
  lastListLoad = Date.now();
  const before = channels.map((c) => c.id).join(",");
  loadChannels().then(() => {
    const changed = channels.map((c) => c.id).join(",") !== before;
    if (changed && current === "home") rerenderHomeKeepFocus();
    refreshHomeData();
  });
}
function focusHome(noRefresh) {
  if (!noRefresh) refreshChannelsSoon();
  const k = lastFocus.homeKey;
  const want = k && $('#home [data-key="' + k + '"]') || lastFocus.home && $('#home .ch[data-id="' + lastFocus.home + '"]');
  focusEl(want || $("#home .hrow .v.f") || $("#home .ch.f") || $("#parent-btn"));
}
let chs = null;
let chSeq = 0;
function activeSrc() {
  return chs.tab === "pl" ? chs.pl : chs;
}
function openChannel(id) {
  const ch = channels.find((c) => c.id === id);
  if (!ch) return;
  lastFocus.home = id;
  const a = document.activeElement;
  if (current === "home" && a && a.getAttribute("data-key")) lastFocus.homeKey = a.getAttribute("data-key");
  const seq = ++chSeq;
  chs = { ch, all: [], next: null, loading: true, seq, error: null, tab: "videos", lists: null, pl: null };
  $("#ch-av").src = ch.thumb || "";
  $("#ch-title").textContent = ch.title;
  $("#ch-sub").textContent = "";
  $("#channel-scroll").scrollTop = 0;
  renderTabs();
  show("channel");
  const cached = getCached(ch.id);
  if (cached) {
    chs.all = cached.videos.slice();
    chs.next = cached.next;
    chs.loading = false;
    renderVideos(true);
    focusFirstVideo();
    if (visible(chs.all).length < 12 && chs.next) loadMore();
    return;
  }
  renderVideos(true);
  focusEl($("#channel .back-btn"));
  fetchPage(seq, null, true);
}
function renderTabs() {
  const box = $("#ch-tabs");
  if (chs.tab === "pl") {
    box.innerHTML = '<button class="f tab" data-tab="lists"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>القوائم</button><h2 class="pl-name">'.concat(esc(chs.pl.meta.title), "</h2>");
  } else {
    box.innerHTML = '<button class="f tab'.concat(chs.tab === "videos" ? " on" : "", '" data-tab="videos">كل الفيديوهات</button><button class="f tab').concat(chs.tab === "lists" ? " on" : "", '" data-tab="lists">القوائم</button>');
  }
}
function setTab(tab, plMeta) {
  const seq = chs.seq;
  chs.tab = tab;
  $("#channel-scroll").scrollTop = 0;
  if (tab === "pl") {
    chs.pl = { meta: plMeta, id: plMeta.id, all: [], next: null, loading: true, error: null };
    renderTabs();
    renderVideos(true);
    focusEl($("#ch-tabs .tab"));
    fetchPage(seq, null, true);
    return;
  }
  renderTabs();
  if (tab === "lists") {
    if (!chs.lists) {
      chs.lists = { items: [], next: null, loading: true, error: null };
      fetchLists(seq, null);
    }
    renderLists();
  } else {
    renderVideos(true);
  }
  focusEl($("#ch-tabs .tab.on"));
}
function fetchLists(seq, token) {
  return __async(this, null, function* () {
    const L = chs.lists;
    L.loading = true;
    try {
      const res = yield api.playlists(chs.ch, token);
      if (seq !== chSeq) return;
      L.items = L.items.concat(res.lists);
      L.next = res.next;
      L.error = null;
    } catch (e) {
      if (seq !== chSeq) return;
      L.error = e;
    }
    L.loading = false;
    if (chs.tab === "lists") renderLists();
  });
}
function renderLists() {
  const grid = $("#v-grid");
  const L = chs.lists;
  if (L.loading && !L.items.length) {
    let s = "";
    for (let i = 0; i < 4; i++) s += '<div class="v skel"><span class="th sk"></span><span class="tt sk"></span></div>';
    grid.innerHTML = s;
    return;
  }
  if (L.error && !L.items.length) {
    grid.innerHTML = '<div class="err-box"><p>' + esc(errText(L.error)) + '</p><button class="f btn primary" data-act="retry-lists">جرّب مرة ثانية</button></div>';
    return;
  }
  if (!L.items.length) {
    grid.innerHTML = '<div class="err-box"><p>هالقناة ما عندها قوائم تشغيل.</p></div>';
    return;
  }
  $("#ch-sub").textContent = L.items.length + " قائمة";
  grid.innerHTML = L.items.map(
    (p, i) => '<button class="f v plc" data-pl="'.concat(i, '" data-i="').concat(i, '"><span class="th"><img src="').concat(esc(p.thumb), '" alt=""><span class="pl-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11M4 11h11M4 16h7M17 13l5 3-5 3z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>').concat(p.count, ' فيديو</span></span><span class="tt">').concat(esc(p.title), "</span></button>")
  ).join("");
}
function fetchPage(seq, token, first) {
  return __async(this, null, function* () {
    const src = activeSrc();
    const isPl = src !== chs;
    src.loading = true;
    $("#v-more").classList.toggle("hidden", first);
    try {
      let tries = 0;
      let res;
      do {
        res = isPl ? yield api.playlistVideos(src.id, token) : yield api.videos(chs.ch, token);
        if (seq !== chSeq || activeSrc() !== src) {
          src.loading = false;
          return;
        }
        src.all = src.all.concat(res.videos);
        src.next = res.next;
        token = res.next;
        tries++;
      } while (token && tries < 3 && visible(src.all).length < (first ? 12 : 8));
      src.error = null;
      if (!isPl) putCached(chs.ch.id, { at: Date.now(), videos: chs.all, next: chs.next });
    } catch (e) {
      if (seq !== chSeq || activeSrc() !== src) {
        src.loading = false;
        return;
      }
      src.error = e;
    }
    src.loading = false;
    $("#v-more").classList.add("hidden");
    const a = document.activeElement;
    const hadFocus = current === "channel" && a && (a.classList.contains("back-btn") || a.classList.contains("tab"));
    renderVideos(first);
    if (first && current === "channel" && hadFocus && !isPl && chs.tab === "videos") focusFirstVideo();
    if (first && current === "channel" && isPl && a && a.classList.contains("tab")) focusFirstVideo();
  });
}
function loadMore() {
  if (!chs) return;
  if (chs.tab === "lists") {
    if (chs.lists && !chs.lists.loading && chs.lists.next) fetchLists(chs.seq, chs.lists.next);
    return;
  }
  const src = activeSrc();
  if (src.loading || !src.next) return;
  fetchPage(chs.seq, src.next, false);
}
function renderVideos(full) {
  if (chs.tab === "lists") {
    renderLists();
    return;
  }
  const src = activeSrc();
  const grid = $("#v-grid");
  const list = visible(src.all);
  if (src.loading && !src.all.length) {
    let s = "";
    for (let i = 0; i < 8; i++) s += '<div class="v skel"><span class="th sk"></span><span class="tt sk"></span></div>';
    grid.innerHTML = s;
    return;
  }
  if (src.error && !list.length) {
    grid.innerHTML = '<div class="err-box"><p>' + esc(errText(src.error)) + '</p><button class="f btn primary" data-act="retry">جرّب مرة ثانية</button></div>';
    if (current === "channel") focusEl($('[data-act="retry"]'));
    return;
  }
  if (!list.length) {
    grid.innerHTML = '<div class="err-box"><p>ما في فيديوهات هون.</p></div>';
    return;
  }
  $("#ch-sub").textContent = list.length + (src.next ? "+" : "") + " فيديو";
  const html = (i) => {
    const v = list[i];
    return '<button class="f v" data-i="'.concat(i, '" data-vid="').concat(esc(v.id), '"><span class="th"><img src="').concat(esc(v.thumb), '" alt="">').concat(v.dur ? '<span class="dur">' + fmtTime(v.dur) + "</span>" : "").concat(chs.tab === "pl" ? '<span class="ep">' + (i + 1) + "</span>" : "", '</span><span class="tt">').concat(esc(v.title), "</span></button>");
  };
  const have = full ? 0 : $$(".v[data-vid]", grid).length;
  if (full || have === 0 || have > list.length) {
    let s = "";
    for (let i = 0; i < list.length; i++) s += html(i);
    grid.innerHTML = s;
  } else {
    let s = "";
    for (let i = have; i < list.length; i++) s += html(i);
    grid.insertAdjacentHTML("beforeend", s);
  }
}
function focusFirstVideo() {
  focusEl($("#v-grid .v.f") || $("#ch-tabs .tab") || $("#channel .back-btn"));
}
const IDX_TTL = 24 * 3600 * 1e3;
const IDX_PAGES = 10;
const idxMem = {};
let idxBuilding = false;
let idxProgress = { done: 0, total: 0 };
function getIdx(id) {
  if (!idxMem[id]) idxMem[id] = store.get("idx2." + id, null);
  return idxMem[id];
}
function packVideo(v) {
  const yt2 = "https://i.ytimg.com/vi/" + v.id + "/";
  return [v.id, v.title, v.dur || 0, v.at || 0, v.thumb && v.thumb.indexOf(yt2) !== 0 ? v.thumb : 0];
}
function unpackVideo(it, ch) {
  return { id: it[0], title: it[1], dur: it[2], at: it[3], thumb: it[4] || "https://i.ytimg.com/vi/" + it[0] + "/mqdefault.jpg", ch };
}
function buildIndex(onProgress) {
  return __async(this, null, function* () {
    if (idxBuilding) return;
    idxBuilding = true;
    const list = channels.slice();
    idxProgress = { done: 0, total: list.length };
    for (const ch of list) {
      const cur = getIdx(ch.id);
      if (!cur || Date.now() - cur.at > IDX_TTL) {
        const items = [];
        let token = null, pages = 0;
        try {
          do {
            const res = yield api.videos(ch, token);
            res.videos.forEach((v) => items.push(packVideo(v)));
            token = res.next;
            pages++;
            if (!cur) idxMem[ch.id] = { at: 0, items: items.slice() };
            if (onProgress) onProgress();
          } while (token && pages < IDX_PAGES);
          idxMem[ch.id] = { at: Date.now(), items };
          store.set("idx2." + ch.id, idxMem[ch.id]);
        } catch (e) {
        }
      }
      idxProgress.done++;
      if (onProgress) onProgress();
    }
    idxBuilding = false;
    if (onProgress) onProgress();
  });
}
function norm(s) {
  return String(s || "").toLowerCase().replace(/[ً-ٰٟـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^0-9a-zء-ي ]+/g, " ").replace(/\s+/g, " ").trim();
}
const normCache = {};
function normTitle(id, t) {
  return normCache[id] || (normCache[id] = norm(t));
}
function searchLocal(q) {
  const nq = norm(q);
  if (!nq) return [];
  const terms = nq.split(" ");
  const out = [];
  const seen = {};
  channels.forEach((ch) => {
    const idx = getIdx(ch.id);
    const items = idx && idx.items.length ? idx.items : (feedData[ch.id] || []).map(packVideo);
    const chn = norm(ch.title);
    items.forEach((it) => {
      if (seen[it[0]]) return;
      const t = normTitle(it[0], it[1]);
      const hay = t + " " + chn;
      for (let i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) < 0) return;
      seen[it[0]] = 1;
      const v = unpackVideo(it, ch);
      v.score = (t.indexOf(nq) === 0 ? 3 : 0) + (t.indexOf(nq) >= 0 ? 2 : 0) + (chn.indexOf(nq) >= 0 ? 1 : 0);
      out.push(v);
    });
  });
  out.sort((x, y) => y.score - x.score || (y.at || 0) - (x.at || 0));
  return visible(out).slice(0, 60);
}
let srQuery = "";
let kbMode = "ar";
let srT = null;
const KB = {
  ar: ["ابتثجحخ", "دذرزسشص", "ضطظعغفق", "كلمنهوي", "ةءىؤئ"],
  en: ["abcdefg", "hijklmn", "opqrstu", "vwxyz", "0123456", "789"]
};
const ICON_DEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-6-6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 10l4 4M16 10l-4 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
function renderKb() {
  let html = "";
  KB[kbMode].forEach((row) => {
    html += '<div class="kb-row">';
    for (const ch of row) html += '<button class="f kb-key" data-k="'.concat(esc(ch), '">').concat(esc(ch), "</button>");
    html += "</div>";
  });
  html += '<div class="kb-row kb-ctrl"><button class="f kb-key mic" data-kc="mic" aria-label="بحث بالصوت"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button><button class="f kb-key wide" data-kc="space">مسافة</button>' + '<button class="f kb-key" data-kc="del" aria-label="مسح">'.concat(ICON_DEL, "</button>") + '<button class="f kb-key mode" data-kc="mode">'.concat(kbMode === "ar" ? "ABC" : "أ ب ت", "</button>") + '</div><div class="kb-row kb-ctrl"><button class="f kb-key wide2" data-kc="clear">امسح الكل</button></div>';
  $("#kb").innerHTML = html;
}
function updateSearchBox() {
  const t = $("#sr-input");
  if (t.value !== srQuery) t.value = srQuery;
}
let rec = null;
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const box = $("#sr-voice");
  if (SR) {
    try {
      if (rec) rec.abort();
      rec = new SR();
      rec.lang = kbMode === "ar" ? "ar-SA" : "en-US";
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        let txt = "";
        for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
        srQuery = txt.trim();
        srChanged();
      };
      rec.onend = () => box.classList.remove("on");
      rec.onerror = () => {
        box.classList.remove("on");
        voiceViaKeyboard();
      };
      box.classList.add("on");
      rec.start();
      return;
    } catch (e) {
      box.classList.remove("on");
    }
  }
  voiceViaKeyboard();
}
function voiceViaKeyboard() {
  const inp = $("#sr-input");
  inp.removeAttribute("readonly");
  try {
    inp.focus();
  } catch (e) {
  }
  toast("اضغط زر المايك 🎤 على الريموت واحكي");
}
function srStatus() {
  const el = $("#sr-status");
  if (idxBuilding) el.textContent = "عم نجهّز البحث… " + idxProgress.done + " من " + idxProgress.total + " قنوات";
  else {
    let n = 0;
    channels.forEach((c) => {
      const i = getIdx(c.id);
      n += i ? i.items.length : 0;
    });
    el.textContent = n ? "منبحث بين " + n + " فيديو من قنواتكم" : "";
  }
}
function renderSearch() {
  const grid = $("#sr-grid");
  let list, title;
  if (!norm(srQuery)) {
    list = buildFeed(24);
    title = "جديد من قنواتكم";
  } else {
    list = searchLocal(srQuery);
    title = list.length ? "لقينا " + list.length + (list.length >= 60 ? "+" : "") + " فيديو" : "";
  }
  rowLists.search = list;
  $("#sr-title").textContent = title;
  if (!list.length) {
    grid.innerHTML = '<div class="sr-empty">' + EMPTY_SVG + "<p>" + (idxBuilding ? "لحظة، لسا عم نجهّز البحث…" : "ما لقينا شي، جرّب كلمة ثانية") + "</p></div>";
    return;
  }
  grid.innerHTML = list.map((v, i) => videoCard(v, "search", i, false)).join("");
}
function srChanged() {
  updateSearchBox();
  clearTimeout(srT);
  srT = setTimeout(() => {
    renderSearch();
    $("#search-scroll").scrollTop = 0;
  }, 140);
}
function openSearch() {
  show("search");
  $("#sr-input").setAttribute("readonly", "readonly");
  renderKb();
  updateSearchBox();
  renderSearch();
  srStatus();
  focusEl($(".kb-key[data-k]"));
  buildIndex(() => {
    srStatus();
    if (current === "search" && norm(srQuery)) {
      const a = document.activeElement;
      const inGrid = a && $("#sr-grid").contains(a);
      if (!inGrid) renderSearch();
    }
  });
}
function kbPress(b) {
  const k = b.getAttribute("data-k");
  const c = b.getAttribute("data-kc");
  if (k) srQuery += k;
  else if (c === "space") {
    if (srQuery && srQuery.slice(-1) !== " ") srQuery += " ";
  } else if (c === "del") srQuery = srQuery.slice(0, -1);
  else if (c === "clear") srQuery = "";
  else if (c === "mic") {
    startVoice();
    return;
  } else if (c === "mode") {
    kbMode = kbMode === "ar" ? "en" : "ar";
    renderKb();
    focusEl($('.kb-key[data-kc="mode"]'));
    return;
  }
  srChanged();
}
let hist = store.get("hist", []);
let favs = store.get("favs", []);
let histTick = 0;
let capApplied = false;
function slimVideo(v) {
  const ch = v.ch || chs && chs.ch || null;
  return { id: v.id, title: v.title, thumb: v.thumb, dur: v.dur || 0, at: v.at || 0, ch: ch ? { id: ch.id, title: ch.title } : null };
}
function histGet(id) {
  return hist.find((h) => h.id === id);
}
function histSave(force, ended) {
  const v = curVid && playList[playIdx];
  if (!v) return;
  let pos = 0, dur = v.dur || 0;
  try {
    pos = player.getCurrentTime() || 0;
    dur = player.getDuration() || dur;
  } catch (e2) {
  }
  if (!force && pos < 5) return;
  const e = Object.assign(slimVideo(v), { pos: ended ? dur : Math.floor(pos), dur: Math.floor(dur), seen: Date.now() });
  hist = [e].concat(hist.filter((h) => h.id !== v.id)).slice(0, 40);
  store.set("hist", hist);
}
function channelAllowed(id) {
  return !id || channels.some((c) => c.id === id);
}
function continueList() {
  return hist.filter((h) => channelAllowed(h.ch && h.ch.id) && h.pos > 20 && (!h.dur || h.pos < h.dur - 20)).slice(0, 12);
}
function isFav(id) {
  return favs.some((f) => f.id === id);
}
function toggleFav() {
  const v = curVid && playList[playIdx];
  if (!v) return;
  if (isFav(v.id)) {
    favs = favs.filter((f) => f.id !== v.id);
    toast("انشال من المفضلة");
  } else {
    favs = [slimVideo(v)].concat(favs).slice(0, 100);
    toast("انضاف للمفضلة ❤");
    flash("heart");
  }
  store.set("favs", favs);
  updateFavBadge();
  remoteNotify();
}
function updateFavBadge() {
  const v = curVid && playList[playIdx];
  $("#osd-fav").classList.toggle("on", !!(v && isFav(v.id)));
}
let player = null;
let playerReady = null;
let ytApiReady = null;
let playList = [];
let playFrom = "channel";
let playIdx = -1;
let curVid = null;
let pState = -1;
let osdT = null, flashT = null, seekT = null, tickT = null, guardT = null, endT = null, errT = null;
let endCount = 0;
function loadYTApi() {
  if (ytApiReady) return ytApiReady;
  ytApiReady = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => {
      ytApiReady = null;
      reject(new ApiError("network"));
    };
    document.head.appendChild(s);
  });
  return ytApiReady;
}
function ensurePlayer() {
  if (playerReady) return playerReady;
  if (DEMO) {
    player = new FakePlayer($("#yt"));
    playerReady = Promise.resolve(player);
    return playerReady;
  }
  playerReady = loadYTApi().then(() => new Promise((resolve) => {
    player = new window.YT.Player("yt", {
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        iv_load_policy: 3,
        playsinline: 1,
        cc_load_policy: 0,
        hl: "ar",
        origin: location.origin,
        widget_referrer: location.href
      },
      events: {
        onReady: () => {
          try {
            const f = player.getIframe();
            f.setAttribute("tabindex", "-1");
          } catch (e) {
          }
          resolve(player);
        },
        onStateChange: (e) => onState(e.data),
        onError: (e) => onPlayerError(e.data)
      }
    });
  }));
  playerReady.catch(() => {
    playerReady = null;
  });
  return playerReady;
}
class FakePlayer {
  // demo only: behaves like the bits of YT.Player we use
  constructor(el) {
    el.innerHTML = '<div class="fake"><div class="fake-in"></div></div>';
    this.box = el.firstChild;
    this.t = 0;
    this.d = 0;
    this.st = -1;
    this.timer = null;
    this.vid = null;
  }
  loadVideoById(arg) {
    const id = typeof arg === "object" ? arg.videoId : arg;
    const v = playList.find((x) => x.id === id) || { title: "", dur: 60 };
    this.vid = id;
    this.t = typeof arg === "object" && arg.startSeconds || 0;
    this.d = v.dur;
    const hue = (id.length * 37 + playList.indexOf(v) * 23) % 360;
    this.box.style.background = "linear-gradient(135deg, hsl(" + hue + ",70%,45%), hsl(" + (hue + 60) % 360 + ",65%,28%))";
    this.box.firstChild.textContent = v.title;
    clearInterval(this.timer);
    this._s(3);
    setTimeout(() => {
      if (this.vid === id) this.playVideo();
    }, 500);
  }
  playVideo() {
    clearInterval(this.timer);
    this._s(1);
    const adUntil = QS.has("demoad") && this.t === 0 && !this.adDone ? Date.now() + 5e3 : 0;
    this.adDone = true;
    this.timer = setInterval(() => {
      if (Date.now() < adUntil) return;
      this.t += 0.25;
      if (this.t >= this.d) {
        this.t = this.d;
        clearInterval(this.timer);
        this._s(0);
      }
    }, 250);
  }
  pauseVideo() {
    clearInterval(this.timer);
    this._s(2);
  }
  stopVideo() {
    clearInterval(this.timer);
    this.st = 5;
  }
  mute() {
    this.muted = true;
  }
  unMute() {
    this.muted = false;
  }
  isMuted() {
    return !!this.muted;
  }
  seekTo(s) {
    this.t = clamp(s, 0, this.d);
  }
  getCurrentTime() {
    return this.t;
  }
  getDuration() {
    return this.d;
  }
  getPlayerState() {
    return this.st;
  }
  getVideoData() {
    return { video_id: this.vid };
  }
  _s(s) {
    this.st = s;
    onState(s);
  }
}
function playAt(idx) {
  const v = playList[idx];
  if (!v) return;
  if (remainingSec() <= 0) {
    lastFocus.vid = idx;
    timeUp();
    return;
  }
  if (locked) {
    show("locked");
    return;
  }
  playIdx = idx;
  curVid = v.id;
  pState = -1;
  capApplied = false;
  speedIdx = 0;
  resetAdWatch();
  clearEnd();
  hideErr();
  $("#osd-title").textContent = v.title;
  updateFavBadge();
  updateOSD(0, v.dur);
  spinner(true);
  if (current !== "player") show("player");
  $("#shield").focus();
  showOSD(4e3);
  ensurePlayer().then((p) => {
    if (curVid !== v.id || current !== "player") return;
    const h = histGet(v.id);
    const resume = h && h.pos > 20 && (!h.dur || h.pos < h.dur - 20) ? Math.floor(h.pos) : 0;
    if (resume) {
      p.loadVideoById({ videoId: v.id, startSeconds: resume });
      toast("كمّلنا من " + fmtTime(resume));
    } else p.loadVideoById(v.id);
  }).catch((e) => showErr(errText(e), false));
  startTimers();
}
function startTimers() {
  clearInterval(tickT);
  tickT = setInterval(() => {
    if (!player || current !== "player") return;
    try {
      updateOSD(player.getCurrentTime(), player.getDuration() || (playList[playIdx] || {}).dur);
    } catch (e) {
    }
    if (pState === 1 || pState === 3) addWatch(0.5);
    if (pState === 1 && ++histTick % 20 === 0) histSave();
    watchForAd();
  }, 500);
  clearInterval(guardT);
  if (!DEMO) guardT = setInterval(() => {
    if (!player || pState !== 1) return;
    try {
      const d = player.getVideoData();
      if (d && d.video_id && d.video_id !== curVid) {
        player.stopVideo();
        closePlayer();
      }
    } catch (e) {
    }
  }, 1500);
}
function onState(s) {
  if (s !== pState && (s === 1 || s === 2 || s === 0)) remoteNotify();
  pState = s;
  if (current !== "player") return;
  if (s === 1) {
    spinner(false);
    showOSD(3500);
    if (ccOn && !capApplied) {
      capApplied = true;
      applyCaptions();
    }
  } else if (s === 3 || s === -1) spinner(true);
  else if (s === 2) {
    spinner(false);
    showOSD(0);
  } else if (s === 0) {
    spinner(false);
    onEnded();
  }
}
function onPlayerError(code) {
  spinner(false);
  if (code === 101 || code === 150) showErr("صاحب هالفيديو ما بيسمح بتشغيله خارج يوتيوب.", true);
  else if (code === 153 || code === 152) showErr("يوتيوب رفض تشغيل الفيديو (خطأ " + code + "). لازم يكون التطبيق مفتوح من رابط https، مش من ملف محلي.", false);
  else if (code === 100) showErr("هالفيديو انحذف أو صار خاص.", true);
  else showErr("ما قدرنا نشغّل هالفيديو.", true);
}
function showErr(msg, autoNext) {
  $("#p-err-msg").textContent = msg;
  $("#p-err").classList.remove("hidden");
  clearTimeout(errT);
  if (autoNext && playList[playIdx + 1]) errT = setTimeout(() => playAt(playIdx + 1), 4e3);
}
function hideErr() {
  clearTimeout(errT);
  $("#p-err").classList.add("hidden");
}
function onEnded() {
  histSave(true, true);
  const next = playList[playIdx + 1];
  if (!settings.autoNext || !next) {
    closePlayer();
    return;
  }
  $("#next-img").src = next.thumb;
  $("#next-title").textContent = next.title;
  endCount = 5;
  $("#next-count").textContent = endCount;
  $("#p-end").classList.remove("hidden");
  hideOSD();
  clearInterval(endT);
  endT = setInterval(() => {
    endCount--;
    $("#next-count").textContent = Math.max(0, endCount);
    if (endCount <= 0) {
      clearEnd();
      playAt(playIdx + 1);
    }
  }, 1e3);
}
function clearEnd() {
  clearInterval(endT);
  endT = null;
  $("#p-end").classList.add("hidden");
}
function closePlayer() {
  resetAdWatch();
  if (usage) saveUsage();
  histSave(true);
  clearEnd();
  hideErr();
  clearInterval(tickT);
  clearInterval(guardT);
  try {
    if (player) {
      player.pauseVideo();
      player.stopVideo();
    }
  } catch (e) {
  }
  curVid = null;
  hideOSD();
  spinner(false);
  if (playFrom === "search") {
    show("search");
    focusEl($('#sr-grid .v[data-i="' + playIdx + '"]') || $(".kb-key[data-k]"));
    return;
  }
  if (playFrom !== "channel") {
    show("home");
    rerenderHomeKeepFocus();
    const t = $('#home .v[data-row="' + playFrom + '"][data-i="' + playIdx + '"]');
    focusEl(t || $("#home .hrow .v.f") || $("#parent-btn"));
    return;
  }
  show("channel");
  const tile = $('#v-grid .v[data-i="' + playIdx + '"]');
  focusEl(tile || $("#v-grid .v") || $("#channel .back-btn"));
  if (tile && $$("#v-grid .v").length - playIdx <= 8) loadMore();
}
function togglePlay() {
  if (!player) return;
  let st;
  try {
    st = player.getPlayerState();
  } catch (e) {
    return;
  }
  if (st === 1 || st === 3) {
    player.pauseVideo();
    flash("pause");
  } else {
    player.playVideo();
    flash("play");
  }
}
let adMode = false, adLastT = -1, adFrozenAt = 0;
function resetAdWatch() {
  adLastT = -1;
  adFrozenAt = 0;
  setAd(false);
}
function adSignals() {
  let t = 0, d = 0;
  try {
    t = player.getCurrentTime() || 0;
    d = player.getDuration() || 0;
  } catch (e) {
  }
  const exp = (playList[playIdx] || {}).dur || 0;
  return { t, d, exp, durMismatch: !!(exp && d > 1 && Math.abs(d - exp) > 3) };
}
function watchForAd() {
  if (pState !== 1 && pState !== 3) {
    adFrozenAt = 0;
    if (pState === 2 || pState === 0) return;
  }
  const g = adSignals();
  let frozen = false;
  if (pState === 1) {
    if (Math.abs(g.t - adLastT) < 0.05) {
      if (!adFrozenAt) adFrozenAt = Date.now();
      else if (Date.now() - adFrozenAt > 2e3) frozen = true;
    } else {
      adFrozenAt = 0;
      adLastT = g.t;
    }
  }
  const isAd = g.durMismatch || frozen;
  if (isAd && !adMode) setAd(true);
  else if (!isAd && adMode && !g.durMismatch && adFrozenAt === 0) setAd(false);
  if (dbgOn) renderDebug(g);
}
let dbgOn = false, dbgKeys = [];
function toggleDebug() {
  dbgOn = !dbgOn;
  $("#dbg").classList.toggle("hidden", !dbgOn);
  if (dbgOn) renderDebug(adSignals());
}
function renderDebug(g) {
  let vd = {}, dt = "";
  try {
    vd = player.getVideoData() || {};
  } catch (e) {
  }
  try {
    dt = player.getDebugText ? String(player.getDebugText()).slice(0, 400) : "";
  } catch (e) {
  }
  $("#dbg").textContent = "v" + VERSION + "  state=" + pState + "  ad=" + adMode + "\nt=" + g.t.toFixed(2) + "  dur=" + g.d.toFixed(1) + "  expected=" + g.exp + "  durMismatch=" + g.durMismatch + "\nexpected id=" + curVid + "  reported id=" + vd.video_id + "\ntitle=" + (vd.title || "") + "  author=" + (vd.author || "") + "\n" + dt;
}
let adMuted = false;
function setAd(on) {
  if (adMode === on) return;
  adMode = on;
  $("#player").classList.toggle("ad", on);
  $("#p-ad").classList.toggle("hidden", !on);
  if (on) {
    hideOSD();
    spinner(false);
    try {
      if (player && !player.isMuted()) {
        player.mute();
        adMuted = true;
      }
    } catch (e) {
    }
  } else if (adMuted) {
    adMuted = false;
    try {
      player.unMute();
    } catch (e) {
    }
  }
  remoteNotify();
}
function seekBy(d) {
  adLastT = -1;
  adFrozenAt = 0;
  if (!player) return;
  try {
    const dur = player.getDuration() || 0;
    const t = clamp(player.getCurrentTime() + d, 0, Math.max(0, dur - 1));
    player.seekTo(t, true);
    updateOSD(t, dur);
  } catch (e) {
    return;
  }
  const el = $("#p-seek");
  el.textContent = (d > 0 ? "تقديم " : "ترجيع ") + Math.abs(d) + " ثواني";
  el.className = "p-seek on " + (d > 0 ? "fwd" : "rew");
  clearTimeout(seekT);
  seekT = setTimeout(() => {
    el.className = "p-seek";
  }, 700);
  showOSD(3500);
}
function flash(kind) {
  const el = $("#p-flash");
  el.className = "p-flash on " + kind;
  clearTimeout(flashT);
  flashT = setTimeout(() => {
    el.className = "p-flash " + kind;
  }, 650);
}
function spinner(on) {
  $("#p-spin").classList.toggle("on", on);
}
function showOSD(ms) {
  $("#osd").classList.add("on");
  clearTimeout(osdT);
  if (ms) osdT = setTimeout(() => {
    if (pState === 1) hideOSD();
  }, ms);
}
function hideOSD() {
  clearTimeout(osdT);
  $("#osd").classList.remove("on");
}
function updateOSD(t, d) {
  d = d || 0;
  const pct = d ? clamp(t / d, 0, 1) * 100 : 0;
  $("#osd-fill").style.width = pct + "%";
  $("#osd-knob").style.left = pct + "%";
  $("#osd-cur").textContent = fmtTime(t);
  $("#osd-dur").textContent = fmtTime(d);
}
const SPEEDS = [1, 1.25, 1.5, 0.75];
let speedIdx = 0;
let ccOn = !!store.get("cc", false);
function cycleSpeed() {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  try {
    player.setPlaybackRate(SPEEDS[speedIdx]);
  } catch (e) {
  }
  toast("السرعة: " + SPEEDS[speedIdx] + "x");
  showOSD(3500);
}
function applyCaptions() {
  if (!player || DEMO) return;
  try {
    if (ccOn) {
      player.loadModule("captions");
      player.setOption("captions", "track", { languageCode: "ar" });
    } else {
      player.setOption("captions", "track", {});
      player.unloadModule("captions");
    }
  } catch (e) {
  }
}
function toggleCaptions() {
  ccOn = !ccOn;
  store.set("cc", ccOn);
  applyCaptions();
  toast(ccOn ? "الترجمة: شغّالة (إذا متوفرة للفيديو)" : "الترجمة: مطفية");
}
function playerKey(code) {
  if (code === 48 || code === 96) {
    const now = Date.now();
    dbgKeys = dbgKeys.filter((x) => now - x < 1500).concat(now);
    if (dbgKeys.length >= 3) {
      dbgKeys = [];
      toggleDebug();
    }
    return;
  }
  if (endT) {
    if (code === 13 || code === 415 || code === 32) {
      clearEnd();
      playAt(playIdx + 1);
    } else if (isBack(code)) closePlayer();
    return;
  }
  if (!$("#p-err").classList.contains("hidden")) {
    if (isBack(code)) closePlayer();
    return;
  }
  switch (code) {
    case 13:
    case 32:
    case 463:
      togglePlay();
      break;
    // OK / space / play-pause
    case 415:
      if (player) {
        player.playVideo();
        flash("play");
      }
      break;
    case 19:
      if (player) {
        player.pauseVideo();
        flash("pause");
      }
      break;
    case 37:
    case 412:
      seekBy(-10);
      break;
    // left / rewind
    case 39:
    case 417:
      seekBy(10);
      break;
    // right / fast-forward
    case 38:
    case 403:
      toggleFav();
      break;
    // up / red = favorite
    case 40:
      showOSD(pState === 1 ? 3500 : 0);
      break;
    case 33:
      if (playList[playIdx + 1]) playAt(playIdx + 1);
      break;
    // channel up = next
    case 34:
      if (playIdx > 0) playAt(playIdx - 1);
      break;
    // channel down = previous
    case 413:
      closePlayer();
      break;
    // stop
    case 406:
      cycleSpeed();
      break;
    // blue = speed
    case 405:
      toggleCaptions();
      break;
    // yellow = captions
    default:
      if (isBack(code)) closePlayer();
  }
}
let pin = { buf: "", mode: "enter", first: "", done: null, cancel: null };
function openPin(opts) {
  const has = !!store.get("pin", null);
  pin = { buf: "", mode: opts.change || !has ? "new" : "enter", first: "", done: opts.done, cancel: opts.cancel };
  renderPin("");
  show("pin");
  focusEl($('.key[data-d="1"]'));
}
function renderPin(msg, bad) {
  const titles = { enter: "منطقة الأهل", new: "رقم سري جديد", confirm: "تأكيد الرقم السري" };
  const hints = { enter: "أدخل الرقم السري (4 أرقام)", new: "اختار 4 أرقام ما يعرفها الأولاد", confirm: "أدخل نفس الأرقام مرة ثانية" };
  $("#pin-title").textContent = titles[pin.mode];
  const m = $("#pin-msg");
  m.textContent = msg || hints[pin.mode];
  m.classList.toggle("bad", !!bad);
  $$("#pin-dots i").forEach((d, i) => d.classList.toggle("on", i < pin.buf.length));
}
function pinPress(d) {
  if (d === "del") {
    pin.buf = pin.buf.slice(0, -1);
    renderPin();
    return;
  }
  if (d === "back") {
    if (pin.cancel) pin.cancel();
    return;
  }
  if (pin.buf.length >= 4) return;
  pin.buf += d;
  renderPin();
  if (pin.buf.length === 4) setTimeout(pinSubmit, 180);
}
function pinShake() {
  const dots = $("#pin-dots");
  dots.classList.remove("shake");
  void dots.offsetWidth;
  dots.classList.add("shake");
}
function pinSubmit() {
  const v = pin.buf;
  pin.buf = "";
  if (pin.mode === "enter") {
    if (hash(v) === store.get("pin")) {
      pin.done();
      return;
    }
    pinShake();
    renderPin("رقم غلط، جرّب مرة ثانية", true);
  } else if (pin.mode === "new") {
    pin.first = v;
    pin.mode = "confirm";
    renderPin();
  } else {
    if (v === pin.first) {
      store.set("pin", hash(v));
      toast("انحفظ الرقم السري");
      pin.done();
      return;
    }
    pin.mode = "new";
    pinShake();
    renderPin("الرقمين مش متطابقين، ابدأ من جديد", true);
  }
}
function openSettings() {
  renderSettings();
  renderPairing();
  $("#add-in").value = "";
  $("#add-res").innerHTML = "";
  addResults = [];
  $("#settings-scroll").scrollTop = 0;
  show("settings");
  focusEl($("#add-in"));
}
function renderSettings() {
  $("#ch-count").textContent = channels.length;
  const list = $("#ch-list");
  if (!channels.length) list.innerHTML = '<p class="none">ما في قنوات لسا.</p>';
  else list.innerHTML = channels.map(
    (c) => '<div class="row"><img src="'.concat(esc(c.thumb), '" alt=""><div class="info"><b>').concat(esc(c.title), "</b><span>").concat(c.source === "file" ? "من ملف القنوات" : "انضافت من التلفزيون", '</span></div><button class="f btn danger" data-del="').concat(esc(c.id), '">حذف</button></div>')
  ).join("");
  $("#restore-btn").classList.toggle("hidden", !removedIds().length);
  $$(".tog[data-k]").forEach((t) => t.classList.toggle("on", !!settings[t.getAttribute("data-k")]));
  renderTimeSettings();
  $("#set-foot").innerHTML = "نسخة " + VERSION + (DEMO ? " · وضع التجربة" : "") + " · مفتاح YouTube: " + (CFG.apiKey || DEMO ? '<span style="color:var(--teal)">مضبوط</span>' : '<span style="color:var(--coral)">ناقص</span>');
}
function renderTimeSettings() {
  const u = getUsage();
  $("#limit-val").textContent = limitOn() ? settings.dailyLimit + " دقيقة" : "بدون حد";
  let t = "اليوم اتفرجوا " + Math.floor(u.sec / 60) + " دقيقة";
  if (limitOn()) t += " · باقي " + fmtMin(remainingSec()) + (u.bonus ? " (منها " + u.bonus + " دقيقة إضافية)" : "");
  $("#time-today").textContent = t;
  $("#bonus-btn").classList.toggle("hidden", !limitOn());
}
let addResults = [];
function isDirectInput(q) {
  return /(UC[\w-]{22})|youtube\.com|youtu\.be|^@/.test(q);
}
function addSearch() {
  return __async(this, null, function* () {
    const q = $("#add-in").value.trim();
    const res = $("#add-res");
    if (!q) {
      focusEl($("#add-in"));
      return;
    }
    res.innerHTML = '<p class="res-msg"><span class="dots"><i></i><i></i><i></i></span></p>';
    addResults = [];
    try {
      if (isDirectInput(q)) {
        const ch = yield api.resolve(q);
        if (ch) addResults = [ch];
      } else {
        addResults = yield api.search(q);
      }
      if (current !== "settings") return;
      if (!addResults.length) throw new ApiError("notfound");
      res.innerHTML = addResults.map((ch, i) => {
        const exists = channels.some((c) => c.id === ch.id);
        return '<div class="res"><img src="'.concat(esc(ch.thumb), '" alt=""><div class="info"><b>').concat(esc(ch.title), "</b><span>").concat(ch.subs ? fmtCount(ch.subs) + " مشترك" : "").concat(ch.videoCount ? " · " + fmtCount(ch.videoCount) + " فيديو" : "", "</span></div>") + (exists ? '<span class="muted" style="font-size:2.4rem">موجودة</span>' : '<button class="f btn primary" data-add-i="'.concat(i, '">أضف</button>')) + "</div>";
      }).join("");
      focusEl($("[data-add-i]") || $("#add-in"));
    } catch (e) {
      if (current !== "settings") return;
      res.innerHTML = '<p class="res-msg bad">' + esc(errText(e)) + "</p>";
      focusEl($("#add-in"));
    }
  });
}
function addConfirm(i) {
  const ch = addResults[i];
  if (!ch) return;
  const keep = { id: ch.id, title: ch.title, thumb: ch.thumb, uploads: ch.uploads, hue: ch.hue };
  const list = tvChannels().filter((c) => c.id !== ch.id);
  list.push(keep);
  store.set("channels", list);
  store.set("removed", removedIds().filter((id) => id !== ch.id));
  rebuildChannelsLocal();
  if (!channels.some((c) => c.id === ch.id)) channels.push(Object.assign({}, keep, { source: "tv" }));
  addResults = [];
  $("#add-in").value = "";
  $("#add-res").innerHTML = "";
  renderSettings();
  toast("انضافت «" + ch.title + "»");
  focusEl($("#add-in"));
}
function removeChannel(id) {
  const ch = channels.find((c) => c.id === id);
  if (!ch) return;
  const rows = $$("#ch-list [data-del]");
  const idx = rows.findIndex((b) => b.getAttribute("data-del") === id);
  store.set("channels", tvChannels().filter((c) => c.id !== id));
  if (ch.source === "file") {
    const r = removedIds();
    if (r.indexOf(id) < 0) r.push(id);
    store.set("removed", r);
  }
  store.del("vc2." + id);
  store.del("idx2." + id);
  delete idxMem[id];
  rebuildChannelsLocal();
  renderSettings();
  toast("انحذفت «" + ch.title + "»");
  const after = $$("#ch-list [data-del]");
  focusEl(after[Math.min(idx, after.length - 1)] || $("#add-in"));
}
function isBack(code) {
  return code === 461 || code === 27 || code === 8 || code === 10009;
}
function goBack() {
  switch (current) {
    case "home":
      try {
        if (window.webOS && window.webOS.platformBack) window.webOS.platformBack();
        else window.close();
      } catch (e) {
      }
      break;
    case "channel":
      if (chs && chs.tab === "pl") {
        setTab("lists");
        focusEl($('#v-grid .v[data-pl="' + (chs.lastPl || 0) + '"]') || $("#ch-tabs .tab.on"));
        break;
      }
      chSeq++;
      show("home");
      rerenderHomeKeepFocus();
      focusHome();
      break;
    case "player":
      closePlayer();
      break;
    case "pin":
      if (pin.cancel) pin.cancel();
      break;
    case "timeup":
      show("home");
      renderHome();
      focusHome();
      break;
    case "search":
      show("home");
      focusEl($("#search-btn"));
      break;
    case "settings":
      show("home");
      renderHome();
      focusEl($("#parent-btn"));
      refreshHomeData();
      break;
  }
}
const NTFY = (CFG.ntfy || "https://ntfy.sh").replace(/\/$/, "");
const REMOTE_ON = !DEMO && CFG.remote !== false || QS.has("remote");
let locked = !!store.get("locked", false);
let lockMsg = store.get("lockMsg", "");
function newRoom() {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const r = new Uint8Array(20);
  try {
    window.crypto.getRandomValues(r);
  } catch (e) {
    for (let i = 0; i < r.length; i++) r[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < r.length; i++) out += abc[r[i] % abc.length];
  store.set("room", out);
  return out;
}
let room = store.get("room", null) || newRoom();
const topic = (k) => "farja-" + room + "-" + k;
function remoteLink() {
  const base = location.origin + location.pathname.replace(/[^\/]*$/, "");
  return base + "parent.html#remote=" + room;
}
function statusObj() {
  const v = current === "player" && curVid ? playList[playIdx] : null;
  let pos = 0, dur = 0;
  try {
    if (v && player) {
      pos = Math.floor(player.getCurrentTime() || 0);
      dur = Math.floor(player.getDuration() || v.dur || 0);
    }
  } catch (e) {
  }
  const u = getUsage();
  const state = locked ? "locked" : current === "player" ? adMode ? "ad" : pState === 1 ? "playing" : pState === 2 ? "paused" : "loading" : current === "timeup" ? "timeup" : "browsing";
  return {
    v: 1,
    t: Date.now(),
    state,
    screen: current,
    video: v ? { id: v.id, title: v.title, ch: v.ch && v.ch.title || chs && chs.ch && chs.ch.title || "", thumb: v.thumb } : null,
    pos,
    dur,
    watched: Math.floor(u.sec / 60),
    left: limitOn() ? Math.ceil(remainingSec() / 60) : null,
    limit: settings.dailyLimit || 0,
    hasNext: !!(v && playList[playIdx + 1]),
    recent: (typeof hist !== "undefined" ? hist : []).slice(0, 8).map((h) => ({ title: h.title, ch: h.ch && h.ch.title, at: h.seen || h.at, thumb: h.thumb }))
  };
}
let lastSent = "";
let lastSentAt = 0;
let notifyT = null;
function remoteNotify(force) {
  if (!REMOTE_ON) return;
  clearTimeout(notifyT);
  notifyT = setTimeout(() => publishStatus(force), force ? 0 : 1500);
}
function publishStatus(force) {
  const st = statusObj();
  const key = JSON.stringify(Object.assign({}, st, { t: 0, pos: 0 }));
  if (!force && key === lastSent && Date.now() - lastSentAt < 5 * 60 * 1e3) return;
  if (!force && Date.now() - lastSentAt < 2500) {
    remoteNotify();
    return;
  }
  lastSent = key;
  lastSentAt = Date.now();
  try {
    fetch(NTFY + "/" + topic("s"), { method: "POST", body: JSON.stringify(st) }).catch(() => {
    });
  } catch (e) {
  }
}
const seenCmd = {};
let cmdSource = null;
function listenRemote() {
  if (!REMOTE_ON || !window.EventSource) return;
  try {
    if (cmdSource) cmdSource.close();
  } catch (e) {
  }
  cmdSource = new EventSource(NTFY + "/" + topic("c") + "/sse");
  cmdSource.onmessage = (ev) => {
    let m, c;
    try {
      m = JSON.parse(ev.data);
      c = JSON.parse(m.message);
    } catch (e) {
      return;
    }
    if (!c || !c.cmd || seenCmd[c.id]) return;
    seenCmd[c.id] = 1;
    if (c.t && Math.abs(Date.now() - c.t) > 2 * 60 * 1e3) return;
    onRemote(c);
  };
}
function onRemote(c) {
  const inPlayer = current === "player" && player;
  switch (c.cmd) {
    case "ping":
      break;
    case "pause":
      if (inPlayer) {
        try {
          player.pauseVideo();
        } catch (e) {
        }
        flash("pause");
      }
      break;
    case "play":
      if (inPlayer) {
        try {
          player.playVideo();
        } catch (e) {
        }
        flash("play");
      }
      break;
    case "next":
      if (inPlayer && playList[playIdx + 1]) playAt(playIdx + 1);
      break;
    case "prev":
      if (inPlayer && playIdx > 0) playAt(playIdx - 1);
      break;
    case "back10":
      if (inPlayer) seekBy(-10);
      break;
    case "fwd10":
      if (inPlayer) seekBy(10);
      break;
    case "stop":
      if (current === "player") closePlayer();
      break;
    case "home":
      if (current === "player") closePlayer();
      if (!locked) {
        show("home");
        renderHome();
        focusHome(true);
      }
      break;
    case "lock":
      setLocked(true, c.text || "");
      break;
    case "unlock":
      setLocked(false);
      toast("انفتح التلفزيون");
      break;
    case "close":
      setLocked(false);
      if (current === "player") closePlayer();
      publishStatusClosed();
      setTimeout(() => {
        try {
          if (window.webOS && window.webOS.platformBack) window.webOS.platformBack();
          else window.close();
        } catch (e) {
        }
      }, 400);
      return;
    case "addTime": {
      const u = getUsage();
      u.bonus += +c.n || 15;
      u.warned = 0;
      saveUsage();
      if (current === "timeup") {
        show("home");
        renderHome();
        focusHome(true);
      }
      showRemoteMsg("ماما وبابا عطوكم " + (+c.n || 15) + " دقيقة زيادة!");
      break;
    }
    case "msg":
      if (c.text) showRemoteMsg(String(c.text).slice(0, 140));
      break;
    case "search":
      if (locked || !c.text) break;
      if (current === "player") closePlayer();
      openSearch();
      srQuery = String(c.text).slice(0, 60);
      updateSearchBox();
      renderSearch();
      $("#search-scroll").scrollTop = 0;
      focusEl($("#sr-grid .v.f") || $(".kb-key[data-k]"));
      showRemoteMsg("بحث من الموبايل: «" + srQuery + "»");
      break;
    case "speed":
      if (inPlayer) cycleSpeed();
      break;
    case "cc":
      if (inPlayer) toggleCaptions();
      break;
    case "debug":
      toggleDebug();
      break;
  }
  remoteNotify(true);
}
function publishStatusClosed() {
  try {
    fetch(NTFY + "/" + topic("s"), { method: "POST", body: JSON.stringify({ v: 1, t: Date.now(), state: "closed" }) }).catch(() => {
    });
  } catch (e) {
  }
}
function setLocked(on, msg) {
  locked = !!on;
  lockMsg = on ? msg || "" : "";
  store.set("locked", locked);
  store.set("lockMsg", lockMsg);
  if (locked) {
    if (current === "player") {
      try {
        player.pauseVideo();
        player.stopVideo();
      } catch (e) {
      }
      clearInterval(tickT);
      clearInterval(guardT);
      curVid = null;
      hideOSD();
      clearEnd();
    }
    $("#lock-msg").textContent = lockMsg || "خلّصنا فرجة هلّق. بنرجع بعدين!";
    show("locked");
    focusEl($('[data-act="lock-parent"]'));
  } else if (current === "locked" || current === "pin") {
    show("home");
    renderHome();
    focusHome(true);
  }
}
let msgT = null;
function showRemoteMsg(text) {
  const el = $("#remote-msg");
  $("#remote-msg-text").textContent = text;
  el.classList.add("on");
  clearTimeout(msgT);
  msgT = setTimeout(() => el.classList.remove("on"), 9e3);
}
let qrLib = null;
function loadQrLib() {
  if (window.qrcode) return Promise.resolve();
  if (qrLib) return qrLib;
  qrLib = new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    sc.onload = res;
    sc.onerror = () => {
      qrLib = null;
      rej();
    };
    document.head.appendChild(sc);
  });
  return qrLib;
}
function renderPairing() {
  const link = remoteLink();
  $("#pair-code").textContent = room.slice(0, 5) + "-" + room.slice(5, 10) + "-" + room.slice(10, 15) + "-" + room.slice(15);
  $("#pair-off").classList.toggle("hidden", REMOTE_ON);
  loadQrLib().then(() => {
    const q = window.qrcode(0, "M");
    q.addData(link);
    q.make();
    $("#pair-qr").innerHTML = q.createImgTag(8, 8, "QR");
  }).catch(() => {
    $("#pair-qr").innerHTML = '<img src="parent-qr.svg" alt="">';
  });
}
function onKey(e) {
  const code = e.keyCode;
  const t = document.activeElement;
  const inInput = !!t && t.tagName === "INPUT";
  if (current === "player") {
    e.preventDefault();
    playerKey(code);
    return;
  }
  if (current === "locked") {
    e.preventDefault();
    if (code === 13 && t && t.classList.contains("f")) t.click();
    else if (code >= 37 && code <= 40) moveFocus({ 37: "left", 38: "up", 39: "right", 40: "down" }[code]);
    return;
  }
  if (current === "pin") {
    if (code >= 48 && code <= 57) {
      e.preventDefault();
      pinPress(String(code - 48));
      return;
    }
    if (code >= 96 && code <= 105) {
      e.preventDefault();
      pinPress(String(code - 96));
      return;
    }
  }
  if (current === "search" && !inInput) {
    if (code === 8 && srQuery) {
      e.preventDefault();
      srQuery = srQuery.slice(0, -1);
      srChanged();
      return;
    }
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && code !== 13) {
      e.preventDefault();
      srQuery += e.key === " " ? srQuery && srQuery.slice(-1) !== " " ? " " : "" : e.key;
      srChanged();
      return;
    }
  }
  if (isBack(code) && !(inInput && code === 8)) {
    e.preventDefault();
    goBack();
    return;
  }
  if (inInput) {
    if (code === 37 || code === 39) return;
    if (code === 13) {
      e.preventDefault();
      if (current === "search") {
        t.blur();
        focusEl($("#sr-grid .v.f") || $(".kb-key[data-k]"));
        return;
      }
      addSearch();
      return;
    }
  }
  const dir = { 37: "left", 38: "up", 39: "right", 40: "down" }[code];
  if (dir) {
    e.preventDefault();
    if (current === "home") homeFocusPending = false;
    moveFocus(dir);
    return;
  }
  if (code === 13 && t && t.classList.contains("f")) {
    e.preventDefault();
    t.click();
  }
}
function onClick(e) {
  const b = e.target.closest("button, [data-act]");
  if (!b) return;
  const act = b.getAttribute("data-act");
  if (b.id === "search-btn") {
    openSearch();
    return;
  }
  if (act === "lock-parent") {
    openPin({ done: () => setLocked(false), cancel: () => {
      show("locked");
      focusEl($('[data-act="lock-parent"]'));
    } });
    return;
  }
  if (b.id === "pair-new") {
    room = newRoom();
    renderPairing();
    listenRemote();
    remoteNotify(true);
    toast("انعمل كود جديد. الموبايلات القديمة ما عادت تتحكم");
    return;
  }
  if (b.classList.contains("kb-key")) {
    kbPress(b);
    return;
  }
  if (b.id === "parent-btn") {
    openPin({ done: openSettings, cancel: () => {
      show("home");
      focusEl($("#parent-btn"));
    } });
    return;
  }
  if (act === "back") {
    goBack();
    return;
  }
  if (act === "retry") {
    if (chs && chs.tab === "pl") {
      setTab("pl", chs.pl.meta);
      return;
    }
    const id = chs && chs.ch.id;
    if (id) openChannel(id);
    return;
  }
  if (b.hasAttribute("data-add-i")) {
    addConfirm(+b.getAttribute("data-add-i"));
    return;
  }
  if (act === "tu-home") {
    goBack();
    return;
  }
  if (act === "tu-parent") {
    openPin({ done: openSettings, cancel: () => {
      show("timeup");
      focusEl($('[data-act="tu-parent"]'));
    } });
    return;
  }
  if (b.classList.contains("ch") || b.classList.contains("more")) {
    openChannel(b.getAttribute("data-id"));
    return;
  }
  if (b.hasAttribute("data-tab")) {
    const t = b.getAttribute("data-tab");
    if (t !== chs.tab) setTab(t);
    return;
  }
  if (b.hasAttribute("data-pl")) {
    const i = +b.getAttribute("data-pl");
    chs.lastPl = i;
    setTab("pl", chs.lists.items[i]);
    return;
  }
  if (act === "retry-lists") {
    chs.lists = null;
    setTab("lists");
    return;
  }
  if (b.classList.contains("v")) {
    const row = b.getAttribute("data-row");
    if (row) {
      playFrom = row;
      playList = rowLists[row] || [];
    } else {
      playFrom = "channel";
      playList = visible(activeSrc().all);
    }
    playAt(+b.getAttribute("data-i"));
    return;
  }
  if (b.classList.contains("key")) {
    pinPress(b.getAttribute("data-d"));
    return;
  }
  if (b.id === "add-go") {
    addSearch();
    return;
  }
  if (b.hasAttribute("data-del")) {
    removeChannel(b.getAttribute("data-del"));
    return;
  }
  if (b.id === "restore-btn") {
    store.set("removed", []);
    loadChannels().then(() => {
      renderSettings();
      toast("رجعت كل القنوات");
      focusEl($("#add-in"));
    });
    return;
  }
  if (b.id === "limit-btn") {
    settings.dailyLimit = LIMITS[(LIMITS.indexOf(settings.dailyLimit) + 1) % LIMITS.length];
    saveSettings();
    getUsage().warned = 0;
    saveUsage();
    renderTimeSettings();
    return;
  }
  if (b.id === "bonus-btn") {
    const u = getUsage();
    u.bonus += 15;
    u.warned = 0;
    saveUsage();
    renderTimeSettings();
    toast("انضافت 15 دقيقة لليوم");
    return;
  }
  if (b.id === "reset-usage") {
    const u = getUsage();
    u.sec = 0;
    u.bonus = 0;
    u.warned = 0;
    saveUsage();
    renderTimeSettings();
    toast("تصفّر عدّاد اليوم");
    return;
  }
  if (b.classList.contains("tog")) {
    const k = b.getAttribute("data-k");
    settings[k] = !settings[k];
    saveSettings();
    b.classList.toggle("on", settings[k]);
    return;
  }
  if (b.id === "chg-pin") {
    openPin({ change: true, done: () => {
      show("settings");
      focusEl($("#chg-pin"));
    }, cancel: () => {
      show("settings");
      focusEl($("#chg-pin"));
    } });
  }
}
function onFocusIn(e) {
  const el = e.target;
  if (current === "channel" && el.classList && el.classList.contains("v")) {
    const total = $$("#v-grid .v").length;
    if (total - +el.getAttribute("data-i") <= 8) loadMore();
  }
}
function measureRem() {
  remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
}
function init() {
  measureRem();
  window.addEventListener("resize", measureRem);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("click", onClick);
  document.addEventListener("focusin", onFocusIn);
  let lastMove = 0;
  document.addEventListener("mousemove", () => {
    lastMove = Date.now();
  });
  document.addEventListener("mouseover", (e) => {
    if (Date.now() - lastMove > 150) return;
    const el = e.target.closest && e.target.closest(".f");
    if (el && el !== document.activeElement && current !== "player") {
      try {
        el.focus({ preventScroll: true });
      } catch (x) {
        el.focus();
      }
    }
  });
  window.addEventListener("blur", () => {
    if (current === "player") setTimeout(() => {
      window.focus();
      $("#shield").focus();
    }, 0);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && current === "player" && player) {
      try {
        player.pauseVideo();
      } catch (e) {
      }
    }
  });
  window.addEventListener("online", () => {
    if (current === "home" && !channels.length) start();
  });
  setInterval(() => {
    if (current === "home") {
      renderTimeChip();
      refreshChannelsSoon();
    }
  }, 3e4);
  window.addEventListener("beforeunload", () => {
    if (usage) saveUsage();
  });
  $("#sr-input").addEventListener("input", (e) => {
    srQuery = e.target.value;
    clearTimeout(srT);
    srT = setTimeout(renderSearch, 160);
  });
  listenRemote();
  setInterval(() => {
    if (!document.hidden) remoteNotify(true);
  }, 5 * 60 * 1e3);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      listenRemote();
      remoteNotify(true);
    }
  });
  show("home");
  start();
  if (locked) setLocked(true, lockMsg);
  if (!DEMO && CFG.apiKey) loadYTApi().catch(() => {
  });
}
function start() {
  lastListLoad = Date.now();
  channelsLoading = true;
  renderHome();
  focusEl($("#parent-btn"));
  loadChannels().then(() => {
    renderHome();
    if (current === "home") focusHome(true);
    return refreshHomeData().then(() => setTimeout(() => buildIndex(), 8e3));
  });
}
init();
