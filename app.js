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
// Tablets and phones: no remote, the kids tap and swipe. Rows and pages scroll natively then.
var TOUCH = "ontouchstart" in window || navigator.maxTouchPoints > 0 || /[?&]touch\b/.test(location.search);
if (TOUCH) document.documentElement.classList.add("touch");
var QS = new URLSearchParams(location.search);
var DEMO = QS.has("demo");
var VERSION = "3.2.0";
var EDITION = "personal";
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
const settings = Object.assign({ hideShorts: false, autoNext: true, dailyLimit: 0, eyeBreak: 20, reward: true }, store.get("settings", {}));
const saveSettings = () => store.set("settings", settings);
const KID_COLORS = ["#ff5d73", "#ffd23f", "#2ec98b", "#9b5de5", "#ff9f1c", "#19c3c3"];
let kids = store.get("kids", []);
let kidId = store.get("kid", kids[0] ? kids[0].id : "main");
if (!kids.some((k) => k.id === kidId)) kidId = kids[0] ? kids[0].id : "main";
const pk = (k) => kidId === "main" ? k : "kid." + kidId + "." + k;
function curKid() {
  return kids.find((k) => k.id === kidId) || null;
}
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
  takeRemoteExtra(j);
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
    if (DEMO) {
      takeRemoteExtra({ channels: DEMO_CH.map((c, i) => ({ id: "UCdemo" + i, cat: ["quran", "learn", "stories", "songs", "fun"][i % 5] })), picks: [{ id: "UCdemo2-v4", title: "اختيار بابا: قصة قبل النوم", ch: "UCdemo2", chTitle: DEMO_CH[2][0], thumb: demoThumb(140, 4), dur: 320 }, { id: "PICKext1", title: "فيديو من برّا القنوات بعته بابا", ch: "UCother", chTitle: "قناة ثانية", thumb: demoThumb(20, 9), dur: 200 }], blocked: [] });
      return DEMO_CH.map((c) => c[0]);
    }
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
    allChannels = out;
    applyKidFilter();
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
  allChannels = out;
  applyKidFilter();
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
const visible = (list) => list.filter((v) => !(settings.hideShorts && v.dur > 0 && v.dur <= 60) && !isBlocked(v.id));
const LIMITS = [0, 15, 30, 45, 60, 90, 120, 180];
function todayStr() {
  const d = /* @__PURE__ */ new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
let usage = store.get(pk("usage"), null);
function getUsage() {
  if (!usage || usage.date !== todayStr()) {
    usage = { date: todayStr(), sec: 0, bonus: 0, warned: 0 };
    store.set(pk("usage"), usage);
  }
  return usage;
}
function saveUsage() {
  store.set(pk("usage"), usage);
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
  const u = getUsage();
  u.sec += sec;
  if (Date.now() - usageSaveAt > 5e3) {
    usageSaveAt = Date.now();
    saveUsage();
  }
  if (!limitOn()) return;
  const left = remainingSec();
  if (left <= 0) {
    saveUsage();
    timeUp();
    return;
  }
  if (left <= 60 && u.warned < 2) {
    u.warned = 2;
    saveUsage();
    showWarn("باقي دقيقة وحدة! خلّصوا الفيديو على مهل", "soft");
  } else if (left <= 300 && u.warned < 1) {
    u.warned = 1;
    saveUsage();
    showWarn("باقي 5 دقايق على وقت الفرجة", "soft");
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
  else if (!locked && name !== "prayer" && name !== "bedtime" && name !== "pin" && name !== "settings" && name !== "locked" && prayerBlocking()) {
    name = "prayer";
    renderPrayerScreen(prayerBlocking());
  } else if (!locked && name !== "bedtime" && name !== "prayer" && name !== "pin" && name !== "settings" && name !== "locked" && !schedAllowed()) {
    name = "bedtime";
    renderBedtime();
  }
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === name));
  current = name;
  if (TOUCH && name !== "home" && !(history.state && history.state.farja)) {
    try {
      history.pushState({ farja: 1 }, "");
    } catch (e) {
    }
  }
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
  if (TOUCH) return;
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
  if (TOUCH) return;
  slideRow(el);
  if (el.closest && el.closest("#home-rows")) {
    homeScrollTo(el);
    return;
  }
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
function buildFeed(max, only) {
  const lists = (only || channels).map((c) => visible(feedData[c.id] || []).slice().sort((x, y) => (y.at || 0) - (x.at || 0)).map((v) => Object.assign({}, v, { ch: c })));
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
  const meta = [(row === "feed" || row === "search" || row === "cont" || row === "favs" || row === "picks" || /^cat:/.test(row)) && v.ch ? esc(v.ch.title) : "", row === "cont" ? "باقي " + fmtTime(Math.max(0, v.dur - v.pos)) : ageText(v.at)].filter(Boolean).join(" · ");
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
  const kn = curKid() && kids.length ? " يا " + curKid().name : "";
  if (!heroEl || !document.body.contains(heroEl)) heroDefault();
  renderRail();
  const notice = $("#notice");
  if (!DEMO && !CFG.apiKey && !CFG.api) {
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
  if (homeView !== "all") {
    box.innerHTML = renderHomeView();
    return;
  }
  const cont = continueList();
  if (cont.length) {
    rowLists.cont = cont.map((h) => Object.assign({}, h, { ch: channels.find((c) => h.ch && c.id === h.ch.id) || h.ch }));
    html += rowHTML("كمّل المشاهدة", rowLists.cont.map((v, i) => videoCard(v, "cont", i, false)).join(""));
  }
  const picks = picksList();
  if (picks.length) {
    rowLists.picks = picks;
    html += rowHTML(catTitle("picks", "اختيار بابا وماما"), picks.map((v, i) => videoCard(v, "picks", i, true)).join(""), "picks-row");
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
  const chBubble = (c, row) => '<button class="f ch" data-id="'.concat(esc(c.id), '" data-key="').concat(row, ":").concat(esc(c.id), '"><span class="av"><img src="').concat(esc(c.thumb), '" alt="">').concat(isFavCh(c.id) ? '<i class="ch-heart">❤</i>' : "", '</span><span class="nm">').concat(esc(c.title), "</span></button>");
  const favChs = channels.filter((c) => isFavCh(c.id));
  if (favChs.length) html = html.replace(/(<section class="hrow[^"]*"><h2>الجديد من قنواتكم)/, rowHTML("قنواتي المفضلة ❤", favChs.map((c) => chBubble(c, "fch")).join(""), "chans") + "$1");
  if (haveAny) CATS.forEach((cat) => {
    const inCat = channels.filter((c) => catOf(c.id) === cat.k);
    if (!inCat.length) return;
    const list = buildFeed(24, inCat);
    if (!list.length) return;
    const key = "cat:" + cat.k;
    rowLists[key] = list;
    html += rowHTML(catTitle(cat.k, cat.n), list.map((v, i) => videoCard(v, key, i, false)).join(""), "cat-row");
  });
  html += rowHTML("كل القنوات", channels.map((c) => chBubble(c, "ch")).join(""), "chans");
  favChs.concat(channels.filter((c) => !isFavCh(c.id))).forEach((c) => {
    const list = visible(feedData[c.id] || []).slice(0, 12).map((v) => Object.assign({}, v, { ch: c }));
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
    if (changed) enforceChannels();
    if (changed && current === "home") rerenderHomeKeepFocus();
    refreshHomeData();
  });
}
function enforceChannels() {
  const pv = playList[playIdx];
  if (current === "player" && curVid && !(pv && pv.parentOk) && !channelAllowed(videoChannelId(pv))) {
    closePlayer();
    show("home");
    renderHome();
    focusHome(true);
    toast("هالقناة انشالت من القنوات المسموحة");
  }
  if (current === "channel" && chs && !channelAllowed(chs.ch.id)) {
    show("home");
    renderHome();
    focusHome(true);
  }
  if (current === "search") renderSearch();
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
  renderFavChBtn();
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
let hist = store.get(pk("hist"), []);
let favs = store.get(pk("favs"), []);
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
  store.set(pk("hist"), hist);
}
let favCh = store.get(pk("favCh"), []);
function isFavCh(id) {
  return favCh.indexOf(id) >= 0;
}
function toggleFavCh() {
  if (!chs) return;
  const id = chs.ch.id;
  if (isFavCh(id)) {
    favCh = favCh.filter((x) => x !== id);
    toast("انشالت من قنواتي المفضلة");
  } else {
    favCh = [id].concat(favCh);
    toast("صارت من قنواتي المفضلة ❤");
  }
  store.set(pk("favCh"), favCh);
  renderFavChBtn();
}
function renderFavChBtn() {
  const b = $("#ch-fav");
  if (!b || !chs) return;
  const on = isFavCh(chs.ch.id);
  b.classList.toggle("on", on);
  b.querySelector("span").textContent = on ? "من قنواتي المفضلة" : "أضف لقنواتي المفضلة";
}
function channelAllowed(id) {
  return !!id && channels.some((c) => c.id === id);
}
function videoChannelId(v) {
  return v && v.ch && v.ch.id || /^c:/.test(playFrom) && playFrom.slice(2) || playFrom === "channel" && chs && chs.ch && chs.ch.id || null;
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
  store.set(pk("favs"), favs);
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
    if (adUntil) this._s(-1);
    this.timer = setInterval(() => {
      if (Date.now() < adUntil) return;
      if (this.st === -1) this._s(1);
      if (QS.has("demomid") && this.t >= 5 && !this.midDone) {
        this.midDone = true;
        this._s(2);
        setTimeout(() => {
          if (this.vid) this._s(1);
          this.midUntil = 0;
        }, 5e3);
        this.midUntil = Date.now() + 5e3;
      }
      if (this.midUntil && Date.now() < this.midUntil) return;
      if (this._realAd()) return;
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
  _realAd() {
    // ?demoreal: ads like the real TV — state 1, clock running on the ad's own duration
    if (!QS.has("demoreal") || this.st !== 1) return null;
    if (!this.preAt) this.preAt = Date.now();
    const pre = (Date.now() - this.preAt) / 1e3;
    if (pre < 6) return { t: pre, d: 15 };
    if (this.t >= 12 && !this.midAt) this.midAt = Date.now();
    if (this.midAt) {
      const m = (Date.now() - this.midAt) / 1e3;
      if (m < 6) return { t: m, d: 20 };
    }
    return null;
  }
  getCurrentTime() {
    const a = this._realAd();
    if (a) return a.t;
    return this.t;
  }
  getDuration() {
    const a = this._realAd();
    if (a) return a.d;
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
  if (!schedAllowed()) {
    goBedtime();
    return;
  }
  if (prayerBlocking()) {
    goPrayer(prayerBlocking());
    return;
  }
  if (isBlocked(v.id)) {
    toast("هالفيديو مش مسموح");
    return;
  }
  if (!v.parentOk && !channelAllowed(videoChannelId(v))) {
    toast("هالقناة مش بالقنوات المسموحة");
    if (current === "player") closePlayer();
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
    if (pState === 1 && !adMode) {
      const pv = playList[playIdx];
      logTick(0.5, pv);
      breakTick(0.5);
      rewardTick(0.5, videoChannelId(pv));
    }
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
  } else if ((s === 3 || s === -1) && !adMode) spinner(true);
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
// End screen: suggestions like YouTube's, only from the approved channels.
// The first tile is the next video in the list (auto-plays after a countdown).
let endSugs = [], endSel = 0, endNextIdx = -1;
function buildSuggestions(cur) {
  const seen = {};
  seen[cur.id] = 1;
  const watched = {};
  hist.forEach((h) => { if (h.dur && h.pos >= h.dur - 20) watched[h.id] = 1; });
  const out = [];
  const add = (v) => { if (v && !seen[v.id] && out.length < 8) { seen[v.id] = 1; out.push(v); } };
  const next = playList[playIdx + 1];
  if (next) add(next);
  const chId = videoChannelId(cur);
  const ch = channels.find((c) => c.id === chId);
  const fresh = (list) => list.filter((v) => !watched[v.id]);
  if (ch) fresh(visible(feedData[ch.id] || [])).slice(0, 3).forEach((v) => add(Object.assign({}, v, { ch })));
  const others = channels.filter((c) => c.id !== chId).sort((x, y) => (isFavCh(y.id) ? 1 : 0) - (isFavCh(x.id) ? 1 : 0));
  for (let round = 0; out.length < 8 && round < 4; round++) {
    others.forEach((c) => { const v = fresh(visible(feedData[c.id] || []))[round]; if (v) add(Object.assign({}, v, { ch: c })); });
  }
  if (ch) visible(feedData[ch.id] || []).forEach((v) => add(Object.assign({}, v, { ch })));
  return out;
}
function onEnded() {
  histSave(true, true);
  const cur = playList[playIdx] || {};
  endSugs = buildSuggestions(cur);
  endNextIdx = playList[playIdx + 1] && endSugs[0] && endSugs[0].id === playList[playIdx + 1].id ? 0 : -1;
  if (!endSugs.length) { closePlayer(); return; }
  $("#end-grid").innerHTML = endSugs.map((v, i) =>
    '<button class="es" data-es="' + i + '"><span class="th"><img src="' + esc(v.thumb) + '" alt="">' + (v.dur ? '<span class="dur">' + fmtTime(v.dur) + "</span>" : "") + (i === endNextIdx ? '<span class="es-next">التالي</span>' : "") + '</span><span class="tt">' + esc(v.title) + '</span><span class="meta">' + esc(v.ch && v.ch.title || "") + "</span></button>"
  ).join("");
  endSel = 0;
  endMark();
  hideOSD();
  $("#p-end").classList.remove("hidden");
  clearInterval(endT);
  endT = setInterval(() => {}, 1e9);
  if (settings.autoNext && endNextIdx === 0) {
    endCount = 8;
    endLabel();
    clearInterval(endT);
    endT = setInterval(() => {
      endCount--;
      endLabel();
      if (endCount <= 0) endPlay(0);
    }, 1e3);
  } else { endCount = -1; endLabel(); }
  try { remoteNotify(); } catch (e) {}
}
function endLabel() {
  $("#end-lbl").innerHTML = endCount > 0 ? "الفيديو التالي بعد <b>" + endCount + "</b>" : "شو بدك تشوف كمان؟";
}
function endStopCountdown() {
  if (endCount > 0) { endCount = -1; clearInterval(endT); endT = setInterval(() => {}, 1e9); endLabel(); }
}
function endMark() {
  Array.prototype.forEach.call(document.querySelectorAll("#end-grid .es"), (b, i) => b.classList.toggle("sel", i === endSel));
}
function endPlay(i) {
  const v = endSugs[i];
  if (!v) return;
  clearEnd();
  if (i === endNextIdx) { playAt(playIdx + 1); return; }
  const rest = visible(feedData[v.ch.id] || []).filter((x) => x.id !== v.id).map((x) => Object.assign({}, x, { ch: v.ch }));
  playFrom = "c:" + v.ch.id;
  playList = [v].concat(rest);
  playAt(0);
}
function endKey(code) {
  const cols = 4;
  if (code >= 37 && code <= 40) {
    endStopCountdown();
    if (code === 37) endSel = Math.min(endSugs.length - 1, endSel + 1);
    if (code === 39) endSel = Math.max(0, endSel - 1);
    if (code === 40 && endSel + cols < endSugs.length) endSel += cols;
    if (code === 38 && endSel - cols >= 0) endSel -= cols;
    endMark();
    return;
  }
  if (code === 13 || code === 415 || code === 32) { endPlay(endSel); return; }
  if (isBack(code)) closePlayer();
}
(function () {
  const g = document.getElementById("end-grid");
  if (!g) return;
  g.addEventListener("click", (e) => { const b = e.target.closest(".es"); if (b) endPlay(+b.getAttribute("data-es")); });
  g.addEventListener("mousemove", (e) => { const b = e.target.closest(".es"); if (b && +b.getAttribute("data-es") !== endSel) { endStopCountdown(); endSel = +b.getAttribute("data-es"); endMark(); } });
})();
function clearEnd() {
  clearInterval(endT);
  endT = null;
  $("#p-end").classList.add("hidden");
}
function closePlayer() {
  endBreak(false);
  saveLog();
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
let pausedSince = 0;
const PAUSE_LIMIT = 15 * 60 * 1e3;
function reclaimFocus() {
  try {
    window.focus();
  } catch (e) {
  }
  const sh = $("#shield");
  try {
    sh.focus({ preventScroll: true });
  } catch (e) {
    sh.focus();
  }
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
    wePaused = true;
    player.pauseVideo();
    flash("pause");
  } else {
    wePaused = false;
    player.playVideo();
    flash("play");
  }
}
let adMode = false, adLastT = -1, adFrozenAt = 0;
let contentOk = false, contentTicks = 0, lastContentT = 0, playStartAt = 0, lastSeekAt = 0;
// YouTube's own Skip button lives inside its player and can't be pressed from our page, and
// reloading the video just brings the ad back. So our big button opens a window on YouTube's
// Skip corner (zoomed, framed in yellow) for this ad only, so it can be pressed with the remote pointer.
let adShowSkip = false;
function adSkip() {
  if (!adMode || adShowSkip) return;
  adShowSkip = true;
  $("#player").classList.remove("full");
  try {
    const f = $("#yt-wrap iframe");
    if (f) f.focus();
  } catch (e) {
  }
}
// Experiment: the first time a real ad shows in a video, throw the whole YouTube player away and
// build a fresh one at the same second. Only once per video, so it can never loop.
let freshTried = null, adLog = [];
function adNote(msg) {
  adLog.push(new Date().toTimeString().slice(0, 8) + " " + msg);
  adLog = adLog.slice(-25);
  if (REMOTE_ON && RELAY) relayPub("l", { v: VERSION, log: adLog }).catch(() => {
  });
}
function adFreshPlayer(why) {
  const v = playList[playIdx];
  if (!v || freshTried === v.id) return false;
  freshTried = v.id;
  const at = Math.floor(lastContentT || 0) || (histGet(v.id) && histGet(v.id).pos > 20 ? Math.floor(histGet(v.id).pos) : 0);
  adNote("ad (" + why + ") in " + v.id + " -> fresh player at " + at + "s");
  try {
    player.destroy();
  } catch (e) {
  }
  player = null;
  playerReady = null;
  if (!document.getElementById("yt")) {
    const d = document.createElement("div");
    d.id = "yt";
    $("#yt-wrap").appendChild(d);
  }
  contentOk = false;
  contentTicks = 0;
  playStartAt = Date.now();
  adLastT = -1;
  adFrozenAt = 0;
  ensurePlayer().then((p) => {
    if (curVid !== v.id || current !== "player") return;
    if (at) p.loadVideoById({ videoId: v.id, startSeconds: at });
    else p.loadVideoById(v.id);
  }).catch(() => {
  });
  return true;
}
function resetAdWatch() {
  freshTried = null;
  contentOk = false;
  contentTicks = 0;
  lastContentT = 0;
  playStartAt = Date.now();
  adLastT = -1;
  adFrozenAt = 0;
  unstartedAt = 0;
  oddSince = 0;
  adForced = false;
  wePaused = false;
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
let unstartedAt = 0;
let wePaused = false, oddSince = 0, adForced = false, adForcedAt = 0;
function forceAd() {
  adForced = true;
  adForcedAt = Date.now();
  adLastT = -1;
  setAd(true);
}
function watchForAd() {
  const g = adSignals();
  let ps = pState;
  try {
    const r = player.getPlayerState();
    if (typeof r === "number") ps = r;
  } catch (e) {
  }
  let odd = false;
  if (ps === -1 || ps === 3 || ps === 5) odd = true;
  if (ps === 2 && !wePaused) odd = true;
  if (ps === 1) {
    if (Math.abs(g.t - adLastT) < 0.05) {
      if (!adFrozenAt) adFrozenAt = Date.now();
    } else {
      adFrozenAt = 0;
      adLastT = g.t;
    }
    if (adFrozenAt && Date.now() - adFrozenAt > 2500) odd = true;
  } else adFrozenAt = 0;
  oddSince = odd ? oddSince || Date.now() : 0;
  const limit = ps === 3 ? 3500 : ps === 2 ? 1500 : 1200;
  let isAd = oddSince && Date.now() - oddSince > limit || g.durMismatch;
  if (adForced) {
    const moving = ps === 1 && !adFrozenAt && Date.now() - adForcedAt > 3e3;
    if (moving) adForced = false;
    else isAd = true;
  }
  // Keep the screen covered from the start until we are sure the real video is playing
  // (moving clock, YouTube's duration equals the video's own duration), so pre-roll ads never show.
  const moving = ps === 1 && !adFrozenAt;
  if (!contentOk) {
    if (moving && !g.durMismatch && g.t > 0.2) {
      if (++contentTicks >= 3) contentOk = true;
    } else contentTicks = 0;
    if (!contentOk && Date.now() - playStartAt < 25e3 && !(ps === 2 && wePaused)) isAd = true;
  }
  // mid-roll: YouTube's clock jumps back to the ad's own 0:00
  if (contentOk && ps === 1 && lastContentT > 8 && g.t < lastContentT - 5 && Date.now() - lastSeekAt > 3e3) isAd = true;
  if (contentOk && moving && !g.durMismatch && !isAd) lastContentT = Math.max(lastContentT, g.t);
  if (ps === 2 && wePaused || ps === 0) {
    isAd = false;
    adForced = false;
  }
  // a real ad (not just "still loading"): the clock runs on a different duration, or jumped back
  // on the real TV a pre-roll ad keeps YouTube's state at -1 ("unstarted") while it plays
  const stuckStart = !contentOk && (ps === -1 || ps === 5) && Date.now() - playStartAt > 4e3;
  const realAd = ps === 1 && (g.durMismatch || contentOk && lastContentT > 8 && g.t < lastContentT - 5 && Date.now() - lastSeekAt > 3e3) || stuckStart;
  // (2.6.3 experiment: rebuilding the player did not stop YouTube's ads on the real TV, so it is off)
  if (false && realAd && Date.now() - playStartAt > 1500) {
    const v0 = playList[playIdx];
    if (v0 && freshTried !== v0.id) {
      if (!adMode) setAd(true);
      adFreshPlayer(stuckStart ? "state " + ps : g.durMismatch ? "dur " + Math.round(g.d) + "s" : "jump t=" + Math.round(g.t));
      return;
    }
    if (v0 && !adMode) adNote("ad came back in " + v0.id + " after fresh player; covering until it ends");
  }
  if (isAd && !adMode) {
    setAd(true);
    adNote("cover on: state " + ps + " t=" + g.t.toFixed(1) + " d=" + Math.round(g.d) + " exp=" + g.exp + (contentOk ? "" : " (start)"));
  } else if (!isAd && adMode) {
    adNote("cover off: state " + ps + " t=" + g.t.toFixed(1) + " d=" + Math.round(g.d));
    setAd(false);
    if (freshTried) adNote("video back at " + Math.round(g.t) + "s");
  }
  if (adMode) {
    const left = g.durMismatch && g.d > g.t ? Math.ceil(g.d - g.t) : 0;
    const txt = left > 0 && left < 400 ? "الفيديو راجع بعد " + left + " ثانية" : "";
    const el = $("#ad-left");
    if (el && el.textContent !== txt) el.textContent = txt;
  }
  if (dbgOn) renderDebug(g, ps);
}
let dbgOn = false, dbgKeys = [];
function toggleDebug() {
  dbgOn = !dbgOn;
  $("#dbg").classList.toggle("hidden", !dbgOn);
  if (dbgOn) renderDebug(adSignals());
}
const ytInfo = {}, ytKeysSeen = {};
let tline = [];
window.addEventListener("message", (ev) => {
  if (!/youtube\.com$/.test(String(ev.origin).replace(/^https?:\/\//, "").replace(/^www\./, "www.").split(":")[0])) return;
  let d = ev.data;
  try {
    if (typeof d === "string") d = JSON.parse(d);
  } catch (e) {
    return;
  }
  if (!d || typeof d !== "object") return;
  const info = d.info && typeof d.info === "object" ? d.info : null;
  ytKeysSeen["ev:" + d.event] = (ytKeysSeen["ev:" + d.event] || 0) + 1;
  if (info) Object.keys(info).forEach((k) => {
    const v = info[k];
    ytInfo[k] = typeof v === "object" ? JSON.stringify(v).slice(0, 80) : v;
    ytKeysSeen[k] = (ytKeysSeen[k] || 0) + 1;
  });
});
setInterval(() => {
  if (current !== "player" || !player) return;
  let t = 0, ps = "";
  try {
    t = player.getCurrentTime();
    ps = player.getPlayerState();
  } catch (e) {
  }
  tline.push((+t).toFixed(1) + "/" + ps);
  if (tline.length > 10) tline.shift();
}, 1e3);
function renderDebug(g, ps) {
  let vd = {}, extra = "";
  try {
    vd = player.getVideoData() || {};
  } catch (e) {
  }
  const q = (f) => {
    try {
      const r = player[f] ? player[f]() : "-";
      return typeof r === "object" ? JSON.stringify(r).slice(0, 60) : r;
    } catch (e) {
      return "err";
    }
  };
  extra = "loaded=" + q("getVideoLoadedFraction") + "  rate=" + q("getPlaybackRate") + "  quality=" + q("getPlaybackQuality") + "  levels=" + q("getAvailableQualityLevels") + "\nurl=" + q("getVideoUrl");
  const skip = { currentTime: 1, currentTimeLastUpdated_: 1, videoBytesLoaded: 1, videoLoadedFraction: 1, mediaReferenceTime: 1, progressState: 1 };
  const infoTxt = Object.keys(ytInfo).filter((k) => !skip[k]).map((k) => k + "=" + String(ytInfo[k]).slice(0, 40)).join("  ");
  $("#dbg").textContent = "v" + VERSION + "  state=" + pState + "  polled=" + ps + "  wePaused=" + wePaused + "  ad=" + adMode + "\nt=" + g.t.toFixed(2) + "  dur=" + g.d.toFixed(1) + "  expected=" + g.exp + "  id=" + curVid + "/" + vd.video_id + "\ntimeline(t/state, 1s): " + tline.join("  ") + "\n" + extra + "\nyt: " + infoTxt.slice(0, 700) + "\nprogressState=" + String(ytInfo.progressState || "").slice(0, 120);
}
let adMuted = false;
function setAd(on) {
  if (adMode === on) return;
  adMode = on;
  $("#player").classList.toggle("ad", on);
  if (!on) adShowSkip = false;
  $("#player").classList.toggle("full", on && settings.adCover !== "skip" && !adShowSkip);
  $("#p-ad").classList.toggle("hidden", !on);
  if (on) {
    hideOSD();
    spinner(false);
    setTimeout(() => {
      if (adMode && $("#ad-skip")) try {
        $("#ad-skip").focus();
      } catch (e) {
      }
    }, 50);
    try {
      if (player && !player.isMuted()) {
        player.mute();
        adMuted = true;
      }
    } catch (e) {
    }
  } else if (adMuted) {
    $("#ad-left").textContent = "";
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
    lastSeekAt = Date.now();
    lastContentT = 0;
    player.seekTo(t, true);
    updateOSD(t, dur);
  } catch (e) {
    return;
  }
  const el = $("#p-seek");
  el.textContent = (d > 0 ? "تقديم " : "ترجيع ") + Math.abs(d) + " ثواني";
  el.className = "p-seek on " + (d > 0 ? "fwd" : "rew");
  try {
    const dd = player.getDuration() || 0;
    if (dd) {
      showSeekPreview(clamp(player.getCurrentTime() / dd, 0, 1));
      clearTimeout(window._spT);
      window._spT = setTimeout(hideSeekPreview, 1200);
    }
  } catch (x) {
  }
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
  updatePbButtons();
  if (pbFocus >= 0) ms = 0;
  clearTimeout(osdT);
  if (ms) osdT = setTimeout(() => {
    if (pState === 1) hideOSD();
  }, ms);
}
function hideOSD() {
  clearTimeout(osdT);
  $("#osd").classList.remove("on");
  pbClear();
}
let prevImgKey = "";
function trackPos(e) {
  const tr = $("#osd-track");
  const r = tr.getBoundingClientRect();
  return clamp((e.clientX - r.left) / r.width, 0, 1);
}
function showSeekPreview(p) {
  const v = playList[playIdx];
  if (!v) return;
  let dur = 0;
  try {
    dur = player.getDuration() || v.dur || 0;
  } catch (e) {
    dur = v.dur || 0;
  }
  const box = $("#seek-prev");
  box.style.left = p * 100 + "%";
  $("#seek-prev-t").textContent = fmtTime(p * dur);
  const n = p < 0.375 ? 1 : p < 0.625 ? 2 : 3;
  const key = v.id + n;
  if (key !== prevImgKey) {
    prevImgKey = key;
    const img = $("#seek-prev-img");
    if (DEMO) {
      img.removeAttribute("src");
      img.style.background = "hsl(" + (n * 90 + 30) + ",70%,55%)";
    } else {
      img.onerror = () => {
        img.onerror = null;
        img.src = "https://i.ytimg.com/vi/" + v.id + "/" + n + ".jpg";
      };
      img.src = "https://i.ytimg.com/vi/" + v.id + "/mq" + n + ".jpg";
    }
  }
  box.classList.add("on");
}
function hideSeekPreview() {
  $("#seek-prev").classList.remove("on");
}
function initPointer() {
  const sh = $("#shield");
  sh.addEventListener("mousemove", () => {
    if (current === "player" && !adMode) showOSD(pState === 1 ? 3500 : 0);
  });
  sh.addEventListener("click", () => {
    reclaimFocus();
    if (!adMode) showOSD(pState === 1 ? 3500 : 0);
  });
  $("#osd-btns").addEventListener("click", (e) => {
    const b = e.target.closest(".pbtn");
    if (b) {
      pbAction(b.getAttribute("data-pb"));
      reclaimFocus();
    }
  });
  $("#osd-btns").addEventListener("mousemove", () => showOSD(0));
  const tr = $("#osd-track");
  tr.addEventListener("mousemove", (e) => {
    showOSD(pState === 1 ? 4e3 : 0);
    showSeekPreview(trackPos(e));
  });
  tr.addEventListener("mouseleave", hideSeekPreview);
  tr.addEventListener("click", (e) => {
    const p = trackPos(e);
    try {
      const d = player.getDuration() || 0;
      if (d) {
        lastSeekAt = Date.now();
        lastContentT = 0;
        player.seekTo(p * d, true);
        updateOSD(p * d, d);
        adLastT = -1;
        adFrozenAt = 0;
      }
    } catch (x) {
    }
    reclaimFocus();
  });
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
function pbAction(k) {
  switch (k) {
    case "back":
      closePlayer();
      return;
    case "prev":
      if (playIdx > 0) playAt(playIdx - 1);
      else seekBy(-1e6);
      break;
    case "rew":
      seekBy(-10);
      break;
    case "play":
      togglePlay();
      break;
    case "fwd":
      seekBy(10);
      break;
    case "next":
      if (playList[playIdx + 1]) playAt(playIdx + 1);
      else toast("ما في فيديو بعده");
      break;
    case "fav":
      toggleFav();
      break;
    case "speed":
      cycleSpeed();
      break;
    case "cc":
      toggleCaptions();
      break;
    case "ad":
      forceAd();
      hideOSD();
      return;
  }
  updatePbButtons();
  showOSD(pState === 1 ? 5e3 : 0);
}
function updatePbButtons() {
  const playing = pState === 1 || pState === 3;
  const pb = $("#pb-play");
  pb.querySelector("svg").innerHTML = playing ? '<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>' : '<path d="M8 5l12 7-12 7z" fill="currentColor"/>';
  pb.querySelector("span").textContent = playing ? "إيقاف" : "تشغيل";
  const v = curVid && playList[playIdx];
  $("#pb-fav").classList.toggle("on", !!(v && isFav(v.id)));
  $("#pb-speed .pb-txt").textContent = SPEEDS[speedIdx] + "x";
  $("#pb-cc").classList.toggle("on", ccOn);
  $('[data-pb="next"]').classList.toggle("dim", !playList[playIdx + 1]);
}
let pbFocus = -1;
function pbButtons() {
  return $$("#osd-btns .pbtn");
}
function pbSet(i) {
  const bs = pbButtons();
  pbFocus = clamp(i, 0, bs.length - 1);
  bs.forEach((b, j) => b.classList.toggle("sel", j === pbFocus));
  updatePbButtons();
  showOSD(0);
}
function pbClear() {
  pbFocus = -1;
  pbButtons().forEach((b) => b.classList.remove("sel"));
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
  if (inBreak) {
    if (isBack(code)) closePlayer();
    return;
  }
  if (adMode && (code === 13 || code === 415 || code === 417)) {
    adSkip();
    return;
  }
  if (endT) {
    endKey(code);
    return;
  }
  if (!$("#p-err").classList.contains("hidden")) {
    if (isBack(code)) closePlayer();
    return;
  }
  if (pbFocus >= 0) {
    if (code === 37) {
      pbSet(pbFocus - 1);
      return;
    }
    if (code === 39) {
      pbSet(pbFocus + 1);
      return;
    }
    if (code === 38) {
      pbClear();
      showOSD(pState === 1 ? 3500 : 0);
      return;
    }
    if (code === 13) {
      pbAction(pbButtons()[pbFocus].getAttribute("data-pb"));
      return;
    }
    if (code === 40) return;
    if (isBack(code)) {
      pbClear();
      hideOSD();
      return;
    }
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
        wePaused = false;
        player.playVideo();
        flash("play");
      }
      break;
    case 19:
      if (player) {
        wePaused = true;
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
      pbSet(pbButtons().findIndex((b) => b.getAttribute("data-pb") === "play"));
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
    case 404:
      forceAd();
      break;
    // green = 'there's an ad' helper
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
  renderKidsSettings();
  $("#ch-count").textContent = allChannels.length;
  const list = $("#ch-list");
  if (!allChannels.length) list.innerHTML = '<p class="none">ما في قنوات لسا.</p>';
  else list.innerHTML = allChannels.map(
    (c) => '<div class="row"><img src="'.concat(esc(c.thumb), '" alt=""><div class="info"><b>').concat(esc(c.title), "</b><span>").concat(c.source === "file" ? "من ملف القنوات" : "انضافت من التلفزيون", '</span></div><button class="f btn cat-btn" data-cat="').concat(esc(c.id), '">').concat(catOf(c.id) ? catTitle(catOf(c.id), catName(catOf(c.id))) : "تصنيف", '</button><button class="f btn danger" data-del="').concat(esc(c.id), '">حذف</button></div>')
  ).join("");
  renderSchedSettings();
  renderCatSettings();
  renderPrayerSettings();
  $("#calm-val").textContent = settings.calm ? "آخر " + settings.calm + " دقيقة" : "مطفي";
  $("#eb-val").textContent = settings.eyeBreak ? "كل " + settings.eyeBreak + " دقيقة" : "مطفي";
  $("#adc-val").textContent = settings.adCover === "skip" ? "خلّي زر التخطي ظاهر" : "غطّي كل الشاشة";
  renderKidChans();
  $("#restore-btn").classList.toggle("hidden", !removedIds().length);
  $$(".tog[data-k]").forEach((t) => t.classList.toggle("on", !!settings[t.getAttribute("data-k")]));
  renderTimeSettings();
  $("#set-foot").innerHTML = "نسخة " + VERSION + (DEMO ? " · وضع التجربة" : "") + " · الاتصال: " + (CFG.apiKey || CFG.api || DEMO ? '<span style="color:var(--teal)">مضبوط</span>' : '<span style="color:var(--coral)">ناقص</span>');
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
  if (!allChannels.some((c) => c.id === ch.id)) {
    allChannels.push(Object.assign({}, keep, { source: "tv" }));
    applyKidFilter();
  }
  addResults = [];
  $("#add-in").value = "";
  $("#add-res").innerHTML = "";
  renderSettings();
  toast("انضافت «" + ch.title + "»");
  if (!catOf(ch.id)) guessCat(ch).then((k) => {
    if (!k) return;
    const l = store.get("catLocal", {});
    l[ch.id] = k;
    store.set("catLocal", l);
    applyKidFilter();
    if (current === "settings") renderSettings();
    toast("«" + ch.title + "» انصنّفت: " + catName(k));
  });
  focusEl($("#add-in"));
}
function removeChannel(id) {
  const ch = allChannels.find((c) => c.id === id);
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
  enforceChannels();
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
    case "bedtime":
    case "prayer":
      break;
    case "kids":
      show("home");
      renderHome();
      focusHome(true);
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
  const state = locked ? "locked" : current === "bedtime" ? "bedtime" : current === "prayer" ? "prayer" : inBreak ? "break" : current === "player" ? adMode ? "ad" : pState === 1 ? "playing" : pState === 2 ? "paused" : "loading" : current === "timeup" ? "timeup" : "browsing";
  return {
    v: 1,
    ver: VERSION,
    t: Date.now(),
    state,
    screen: current,
    kid: curKid() ? curKid().name : "",
    video: v ? { id: v.id, title: v.title, ch: v.ch && v.ch.title || chs && chs.ch && chs.ch.title || "", thumb: v.thumb } : null,
    pos,
    dur,
    watched: Math.floor(u.sec / 60),
    left: limitOn() ? Math.ceil(remainingSec() / 60) : null,
    limit: settings.dailyLimit || 0,
    hasNext: !!(v && playList[playIdx + 1]),
    catOff: settings.catOff || [],
    cats: CATS.filter((cc) => allChannels.some((x) => catOf(x.id) === cc.k)).map((cc) => cc.k),
    chans: allChannels.slice(0, 60).map((c) => [c.id, c.title.slice(0, 40), c.uploads, catOf(c.id), c.thumb || ""]),
    picks: (remoteExtra.picks || []).slice(0, 20).map((p) => [p.id, String(p.title || "").slice(0, 60)]),
    blocked: store.get("blockedLocal", []).slice(-30).map((b) => [b.id, String(b.title || "").slice(0, 60)]),
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
let limitedUntil = 0;
function publishStatus(force) {
  if (Date.now() < limitedUntil) return;
  const st = statusObj();
  const key = JSON.stringify(Object.assign({}, st, { t: 0, pos: 0, recent: 0 }));
  if (!force && key === lastSent) return;
  if (!force && Date.now() - lastSentAt < 8e3) {
    clearTimeout(notifyT);
    notifyT = setTimeout(() => publishStatus(false), 8e3 - (Date.now() - lastSentAt));
    return;
  }
  lastSent = key;
  lastSentAt = Date.now();
  try {
    relayPub("s", st).then((r) => {
      if (r.status === 429) limitedUntil = Date.now() + 30 * 60 * 1e3;
    }).catch(() => {
    });
  } catch (e) {
  }
}
const seenCmd = {};
let sseAliveAt = Date.now();
let cmdSource = null;
function listenRemote() {
  if (!REMOTE_ON) return;
  if (RELAY) {
    sseAliveAt = Date.now();
    pollGen++;
    pollCmds(pollGen);
    return;
  }
  if (!window.EventSource) return;
  try {
    if (cmdSource) cmdSource.close();
  } catch (e) {
  }
  sseAliveAt = Date.now();
  cmdSource = new EventSource(NTFY + "/" + topic("c") + "/sse");
  ["open", "keepalive"].forEach((t) => cmdSource.addEventListener(t, () => {
    sseAliveAt = Date.now();
  }));
  cmdSource.onerror = () => {
    if (cmdSource && cmdSource.readyState === 2) setTimeout(listenRemote, 5e3);
  };
  cmdSource.onmessage = (ev) => {
    let m, c;
    try {
      m = JSON.parse(ev.data);
      c = JSON.parse(m.message);
    } catch (e) {
      return;
    }
    handleCmd(c);
  };
}
function onRemote(c) {
  if (onRemoteExtra(c)) {
    remoteNotify(true);
    return;
  }
  const inPlayer = current === "player" && player;
  switch (c.cmd) {
    case "ping":
      break;
    case "pause":
      if (inPlayer) {
        wePaused = true;
        try {
          player.pauseVideo();
        } catch (e) {
        }
        flash("pause");
      }
      break;
    case "play":
      if (inPlayer) {
        wePaused = false;
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
    case "adhelp":
      if (current === "player") forceAd();
      break;
    case "adskip":
      if (current === "player" && adMode) adSkip();
      break;
    case "reloadChannels":
      lastListLoad = 0;
      refreshChannelsSoon();
      break;
    case "playVideo": {
      if (locked || !c.id) break;
      const approvedCh = channels.find((x) => x.id === c.ch);
      const ch = approvedCh || { id: c.ch || "", title: String(c.chTitle || "") };
      const v = { id: String(c.id), title: String(c.title || ""), thumb: c.thumb || "https://i.ytimg.com/vi/" + c.id + "/hqdefault.jpg", dur: +c.dur || 0, at: +c.at || 0, ch, parentOk: !approvedCh };
      const rest = approvedCh ? visible(feedData[ch.id] || []).filter((x) => x.id !== v.id).map((x) => Object.assign({}, x, { ch })) : [];
      if (current === "player") closePlayer();
      playFrom = "remote";
      playList = [v].concat(rest);
      playAt(0);
      if (!approvedCh) showRemoteMsg("فيديو من ماما وبابا ❤");
      break;
    }
  }
  remoteNotify(true);
}
function publishStatusClosed() {
  try {
    relayPub("s", { v: 1, t: Date.now(), state: "closed" }).catch(() => {
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
function kidAvatar(k, big) {
  if (k.av && AVATARS[k.av]) return '<span class="kid-av av-animal'.concat(big ? " big" : "", '" style="background:').concat(esc(k.color), '"><svg viewBox="0 0 64 64">').concat(AVATARS[k.av], "</svg></span>");
  const letter = esc((k.name || "?").trim().charAt(0));
  return '<span class="kid-av'.concat(big ? " big" : "", '" style="background:').concat(esc(k.color), '"><b>').concat(letter, '</b><i class="kid-eyes"></i></span>');
}
function renderKidChip() {
  const b = $("#kid-btn");
  const k = curKid();
  b.classList.toggle("hidden", kids.length < 2);
  if (k) b.innerHTML = kidAvatar(k, false) + "<span>" + esc(k.name) + "</span>";
}
function switchKid(id) {
  if (usage) saveUsage();
  if (current === "player") closePlayer();
  kidId = id;
  store.set("kid", id);
  usage = store.get(pk("usage"), null);
  hist = store.get(pk("hist"), []);
  favs = store.get(pk("favs"), []);
  favCh = store.get(pk("favCh"), []);
  applyKidFilter();
  lastFocus.homeKey = null;
  homeFocusPending = true;
  renderKidChip();
  show("home");
  renderHome();
  focusHome(true);
  const k = curKid();
  if (k) toast("أهلين " + k.name + "!");
  remoteNotify(true);
}
function openKids() {
  const grid = $("#kids-grid");
  grid.innerHTML = kids.map(
    (k) => '<button class="f kid" data-kid="'.concat(esc(k.id), '">').concat(kidAvatar(k, true), '<span class="kid-nm">').concat(esc(k.name), "</span></button>")
  ).join("");
  show("kids");
  focusEl($('#kids-grid .kid[data-kid="' + kidId + '"]') || $("#kids-grid .kid"));
}
function renderKidsSettings() {
  const box = $("#kid-list");
  if (!kids.length) box.innerHTML = '<p class="none">ما في أسماء لسا. ضيف اسم كل ولد حتى يصير إله مفضلة ووقت خاص فيه.</p>';
  else box.innerHTML = kids.map((k) => {
    const u = store.get(k.id === "main" ? "usage" : "kid." + k.id + ".usage", null);
    const mins = u && u.date === todayStr() ? Math.floor(u.sec / 60) : 0;
    return '<div class="row">'.concat(kidAvatar(k, false), '<div class="info"><b>').concat(esc(k.name), "</b><span>اليوم اتفرج ").concat(mins, ' دقيقة</span></div><button class="f btn" data-kav="').concat(esc(k.id), '">شكل</button><button class="f btn" data-kcolor="').concat(esc(k.id), '">لون</button><button class="f btn" data-kch-open="').concat(esc(k.id), '">قنواته</button><button class="f btn danger" data-kdel="').concat(esc(k.id), '">حذف</button></div>');
  }).join("");
  $("#kid-count").textContent = kids.length;
}
function addKid() {
  const inp = $("#kid-in");
  const name = inp.value.trim().slice(0, 20);
  if (!name) {
    focusEl(inp);
    return;
  }
  const id = kids.length ? "k" + Date.now().toString(36) : "main";
  kids.push({ id, name, color: KID_COLORS[kids.length % KID_COLORS.length] });
  store.set("kids", kids);
  if (kids.length === 1) {
    kidId = id;
    store.set("kid", id);
  }
  inp.value = "";
  renderKidsSettings();
  renderKidChip();
  toast("انضاف «" + name + "»");
  focusEl(inp);
}
function delKid(id) {
  const k = kids.find((x) => x.id === id);
  if (!k || !confirmTwice("kdel" + id)) {
    toast("اضغط حذف مرة ثانية للتأكيد");
    return;
  }
  kids = kids.filter((x) => x.id !== id);
  store.set("kids", kids);
  if (id !== "main") ["usage", "hist", "favs", "favCh"].forEach((x) => store.del("kid." + id + "." + x));
  if (kidId === id) {
    kidId = kids[0] ? kids[0].id : "main";
    store.set("kid", kidId);
    usage = store.get(pk("usage"), null);
    hist = store.get(pk("hist"), []);
    favs = store.get(pk("favs"), []);
    favCh = store.get(pk("favCh"), []);
    applyKidFilter();
  }
  if (kchKid === id) kchKid = null;
  renderKidsSettings();
  renderKidChans();
  renderKidChip();
  toast("انحذف «" + k.name + "»");
  focusEl($("#kid-list [data-kdel]") || $("#kid-in"));
}
let confirmKey = "", confirmAt = 0;
function confirmTwice(key) {
  const ok = confirmKey === key && Date.now() - confirmAt < 4e3;
  confirmKey = ok ? "" : key;
  confirmAt = Date.now();
  return ok;
}
function cycleKidColor(id) {
  const k = kids.find((x) => x.id === id);
  if (!k) return;
  k.color = KID_COLORS[(KID_COLORS.indexOf(k.color) + 1) % KID_COLORS.length];
  store.set("kids", kids);
  renderKidsSettings();
  renderKidChip();
  focusEl($('#kid-list [data-kcolor="' + id + '"]'));
}
/* =========================================================
   Farja+ (2.5): parent extras, schedule, health, reports, relay
   Plain ES2015 (old webOS browsers): no async/await, no ?. / ??
   ========================================================= */

/* ---------- categories, dad's picks, blocked videos (from channels.json + this TV) ---------- */
let remoteExtra = store.get("remoteExtra", { cats: {}, picks: [], blocked: [] });
const CAT_ICONS = {
  quran: '<svg viewBox="0 0 24 24"><path d="M3 5c3-1 6-1 9 1v14c-3-2-6-2-9-1z" fill="#2ec98b"/><path d="M21 5c-3-1-6-1-9 1v14c3-2 6-2 9-1z" fill="#19a774"/><path d="M12 6v14" stroke="#fff" stroke-width="1.2"/></svg>',
  learn: '<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="7" fill="#ffd23f"/><path d="M9 17h6v3H9z" fill="#ff9f1c"/><path d="M10 10l2 2 3-4" stroke="#1f1d5a" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  stories: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="14" height="18" rx="3" fill="#9b5de5"/><rect x="7" y="3" width="2" height="18" fill="#7b3fc4"/><path d="M12 9l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 11.3l2-.3z" fill="#ffd23f"/></svg>',
  songs: '<svg viewBox="0 0 24 24"><path d="M9 17V5l11-2v12" stroke="#ff5d73" stroke-width="2.4" fill="none"/><circle cx="6.5" cy="17.5" r="3" fill="#ff5d73"/><circle cx="17.5" cy="15.5" r="3" fill="#ff5d73"/></svg>',
  fun: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="6" ry="7" fill="#19c3c3"/><path d="M12 16l-1 2h2z" fill="#19c3c3"/><path d="M12 18c0 2-2 2-2 4" stroke="#19c3c3" stroke-width="1.4" fill="none"/><ellipse cx="10" cy="7" rx="1.5" ry="2.4" fill="#fff" opacity=".5"/></svg>',
  picks: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" fill="#ff5d73"/></svg>',
};
const CATS = [
  { k: "quran", n: "قرآن" },
  { k: "learn", n: "تعليمي" },
  { k: "stories", n: "قصص" },
  { k: "songs", n: "أناشيد" },
  { k: "fun", n: "ترفيه" },
];
const EDU_CATS = ["quran", "learn"];
function catName(k) {
  const c = CATS.find((x) => x.k === k);
  return c ? c.n : "بدون تصنيف";
}
function catTitle(k, n) {
  return '<i class="cat-ic">' + (CAT_ICONS[k] || "") + "</i>" + esc(n);
}
function catOf(chId) {
  const l = store.get("catLocal", {});
  return l[chId] != null ? l[chId] : remoteExtra.cats && remoteExtra.cats[chId] || "";
}
function cycleCat(chId) {
  const l = store.get("catLocal", {});
  const keys = [""].concat(CATS.map((c) => c.k));
  l[chId] = keys[(keys.indexOf(catOf(chId)) + 1) % keys.length];
  store.set("catLocal", l);
}
let blockedCache = null;
function blockedMap() {
  if (blockedCache) return blockedCache;
  blockedCache = {};
  (remoteExtra.blocked || []).concat(store.get("blockedLocal", [])).forEach((b) => {
    const id = b && typeof b === "object" ? b.id : b;
    if (id) blockedCache[id] = 1;
  });
  return blockedCache;
}
function isBlocked(id) {
  return !!blockedMap()[id];
}
function blockLocal(id, title) {
  if (!id || isBlocked(id)) return;
  const l = store.get("blockedLocal", []);
  l.push({ id, title: String(title || "").slice(0, 80) });
  store.set("blockedLocal", l.slice(-300));
  blockedCache = null;
  favs = favs.filter((f) => f.id !== id);
  store.set(pk("favs"), favs);
  hist = hist.filter((h) => h.id !== id);
  store.set(pk("hist"), hist);
  if (current === "player" && curVid === id) {
    closePlayer();
    showRemoteMsg("هالفيديو انحظر بطلب من الأهل");
  } else if (current === "home") rerenderHomeKeepFocus();
}
function takeRemoteExtra(j) {
  if (!j || Array.isArray(j)) return;
  const cats = {};
  (j.channels || []).forEach((x) => {
    if (x && typeof x === "object" && x.id && x.cat) cats[x.id] = String(x.cat);
  });
  remoteExtra = {
    cats,
    picks: Array.isArray(j.picks) ? j.picks.slice(0, 40) : [],
    blocked: Array.isArray(j.blocked) ? j.blocked.slice(0, 500) : [],
  };
  blockedCache = null;
  store.set("remoteExtra", remoteExtra);
}
function picksList() {
  return (remoteExtra.picks || []).filter((p) => p && p.id && !isBlocked(p.id)).map((p) => {
    const ch = allChannels.find((c) => c.id === p.ch) || { id: p.ch || "", title: p.chTitle || "" };
    return { id: p.id, title: p.title || "", thumb: p.thumb || "https://i.ytimg.com/vi/" + p.id + "/hqdefault.jpg", dur: +p.dur || 0, at: +p.at || 0, ch, parentOk: true };
  });
}

/* ---------- per-kid channels ---------- */
let allChannels = [];
function kidHidden(k) {
  k = k || curKid();
  return k && Array.isArray(k.hide) ? k.hide : [];
}
function applyKidFilter() {
  const h = kidHidden();
  const off = settings.catOff || [];
  const calm = typeof calmActive === "function" && calmActive();
  channels = allChannels.filter((c) => h.indexOf(c.id) < 0 && off.indexOf(catOf(c.id)) < 0 && (!calm || CALM_CATS.indexOf(catOf(c.id)) >= 0));
}
function setCatOff(list) {
  settings.catOff = (list || []).filter((k) => CATS.some((c) => c.k === k));
  saveSettings();
  applyKidFilter();
  enforceChannels();
  if (current === "home") {
    if (/^cat:/.test(homeView) && settings.catOff.indexOf(homeView.slice(4)) >= 0) homeView = "all";
    rerenderHomeKeepFocus();
  }
}
function renderCatSettings() {
  const off = settings.catOff || [];
  $("#cat-togs").innerHTML = CATS.map((c) => {
    const n = allChannels.filter((x) => catOf(x.id) === c.k).length;
    return '<button class="f tog cat-tog' + (off.indexOf(c.k) < 0 ? " on" : "") + '" data-catoff="' + c.k + '"><span>' + catTitle(c.k, c.n) + " <small>(" + n + ' قناة)</small></span><i class="sw"></i></button>';
  }).join("");
}
/* guess a channel's category from YouTube's own data (video categories of its latest uploads) */
const YT_CAT = { "27": "learn", "28": "learn", "26": "learn", "10": "songs", "1": "stories", "24": "fun", "23": "fun", "20": "fun", "15": "fun", "17": "fun", "19": "fun", "22": "fun" };
function guessCat(ch) {
  if (/قرآن|القرآن|القران|قران|quran|qur'?an|تلاوة|تجويد/i.test(ch.title || "")) return Promise.resolve("quran");
  
  if (DEMO || !CFG.apiKey || !ch.uploads) return Promise.resolve("");
  return yt("playlistItems", { part: "contentDetails", playlistId: ch.uploads, maxResults: 12 }).then((j) => {
    const ids = (j.items || []).map((i) => i.contentDetails && i.contentDetails.videoId).filter(Boolean);
    if (!ids.length) return "";
    return yt("videos", { part: "snippet", id: ids.join(",") }).then((v) => {
      const count = {};
      let quran = 0;
      (v.items || []).forEach((it) => {
        const sn = it.snippet || {};
        if (/قرآن|القرآن|القران|سورة|تلاوة|quran|surah/i.test(sn.title || "")) quran++;
        const k = YT_CAT[sn.categoryId];
        if (k) count[k] = (count[k] || 0) + 1;
      });
      if (quran >= 4) return "quran";
      let best = "", bn = 0;
      Object.keys(count).forEach((k) => {
        if (count[k] > bn) {
          best = k;
          bn = count[k];
        }
      });
      return best;
    });
  }).catch(() => "");
}
let kchKid = null;
function renderKidChans() {
  const box = $("#kid-chans");
  const k = kids.find((x) => x.id === kchKid);
  if (!k) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  const h = kidHidden(k);
  box.classList.remove("hidden");
  box.innerHTML = '<div class="kch-head">' + kidAvatar(k, false) + "<b>قنوات " + esc(k.name) + '</b><button class="f btn ghost" data-kch-close="1">تمّ</button></div><p class="muted">اضغط على القناة لتخفيها أو تظهرها لـ' + esc(k.name) + " بس. القنوات الجديدة بتظهر للكل.</p>" +
    allChannels.map((c) => '<button class="f tog kch' + (h.indexOf(c.id) < 0 ? " on" : "") + '" data-kch="' + esc(c.id) + '"><span><img src="' + esc(c.thumb) + '" alt="">' + esc(c.title) + '</span><i class="sw"></i></button>').join("");
}
function toggleKidChan(chId) {
  const k = kids.find((x) => x.id === kchKid);
  if (!k) return;
  const h = kidHidden(k).slice();
  const i = h.indexOf(chId);
  if (i >= 0) h.splice(i, 1);
  else h.push(chId);
  k.hide = h;
  store.set("kids", kids);
  if (k.id === kidId) {
    applyKidFilter();
    enforceChannels();
  }
  renderKidChans();
  focusEl($('#kid-chans [data-kch="' + chId + '"]'));
}

/* ---------- kid avatars (animals) ---------- */
const AVATARS = {
  cat: '<path d="M14 18l4-12 8 9M50 18l-4-12-8 9" fill="#fff"/><circle cx="32" cy="36" r="20" fill="#fff"/><circle cx="25" cy="34" r="3" fill="#1f1d5a"/><circle cx="39" cy="34" r="3" fill="#1f1d5a"/><path d="M29 41l3 2 3-2" stroke="#1f1d5a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M14 40h8M42 40h8" stroke="#1f1d5a" stroke-width="1.5"/>',
  bear: '<circle cx="16" cy="18" r="7" fill="#c8874a"/><circle cx="48" cy="18" r="7" fill="#c8874a"/><circle cx="32" cy="35" r="20" fill="#c8874a"/><ellipse cx="32" cy="42" rx="9" ry="7" fill="#f3d2a8"/><circle cx="25" cy="31" r="3" fill="#1f1d5a"/><circle cx="39" cy="31" r="3" fill="#1f1d5a"/><circle cx="32" cy="39" r="3" fill="#1f1d5a"/>',
  bunny: '<ellipse cx="23" cy="13" rx="5" ry="12" fill="#fff"/><ellipse cx="41" cy="13" rx="5" ry="12" fill="#fff"/><ellipse cx="23" cy="14" rx="2.4" ry="8" fill="#ffb3c1"/><ellipse cx="41" cy="14" rx="2.4" ry="8" fill="#ffb3c1"/><circle cx="32" cy="38" r="18" fill="#fff"/><circle cx="26" cy="36" r="2.6" fill="#1f1d5a"/><circle cx="38" cy="36" r="2.6" fill="#1f1d5a"/><path d="M30 42h4l-2 2z" fill="#ff5d73"/>',
  panda: '<circle cx="15" cy="17" r="7" fill="#1f1d5a"/><circle cx="49" cy="17" r="7" fill="#1f1d5a"/><circle cx="32" cy="35" r="20" fill="#fff"/><ellipse cx="24" cy="33" rx="5" ry="6" fill="#1f1d5a"/><ellipse cx="40" cy="33" rx="5" ry="6" fill="#1f1d5a"/><circle cx="25" cy="33" r="1.8" fill="#fff"/><circle cx="39" cy="33" r="1.8" fill="#fff"/><ellipse cx="32" cy="42" rx="3" ry="2" fill="#1f1d5a"/>',
  fox: '<path d="M10 10l12 14H12zM54 10L42 24h10z" fill="#ff8a3d"/><path d="M12 24h40L32 54z" fill="#ff8a3d"/><path d="M20 34l12 20 12-20-12 6z" fill="#fff"/><circle cx="24" cy="31" r="2.8" fill="#1f1d5a"/><circle cx="40" cy="31" r="2.8" fill="#1f1d5a"/><circle cx="32" cy="50" r="2.6" fill="#1f1d5a"/>',
  owl: '<path d="M14 14l8 8M50 14l-8 8" stroke="#8a5a3c" stroke-width="5" stroke-linecap="round"/><ellipse cx="32" cy="36" rx="20" ry="21" fill="#8a5a3c"/><circle cx="24" cy="32" r="8" fill="#fff"/><circle cx="40" cy="32" r="8" fill="#fff"/><circle cx="24" cy="32" r="3.5" fill="#1f1d5a"/><circle cx="40" cy="32" r="3.5" fill="#1f1d5a"/><path d="M29 40h6l-3 5z" fill="#ffd23f"/>',
  frog: '<circle cx="21" cy="20" r="8" fill="#2ec98b"/><circle cx="43" cy="20" r="8" fill="#2ec98b"/><ellipse cx="32" cy="38" rx="21" ry="16" fill="#2ec98b"/><circle cx="21" cy="20" r="4" fill="#fff"/><circle cx="43" cy="20" r="4" fill="#fff"/><circle cx="21" cy="20" r="2" fill="#1f1d5a"/><circle cx="43" cy="20" r="2" fill="#1f1d5a"/><path d="M22 42q10 7 20 0" stroke="#1f1d5a" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
};
const AV_KEYS = Object.keys(AVATARS);
function cycleKidAvatar(id) {
  const k = kids.find((x) => x.id === id);
  if (!k) return;
  const keys = [""].concat(AV_KEYS);
  k.av = keys[(keys.indexOf(k.av || "") + 1) % keys.length];
  store.set("kids", kids);
  renderKidsSettings();
  renderKidChip();
  focusEl($('#kid-list [data-kav="' + id + '"]'));
}

/* ---------- allowed hours (schedule) ---------- */
const DEF_SCHED = { on: false, wd: [16 * 60, 19 * 60], we: [10 * 60, 20 * 60] };
function sched() {
  if (!settings.sched) settings.sched = JSON.parse(JSON.stringify(DEF_SCHED));
  return settings.sched;
}
function fmtClock(m) {
  m = (m + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  const h12 = h % 12 || 12;
  return h12 + ":" + pad2(mm) + (h < 12 ? " الصبح" : h < 17 ? " الظهر" : " المسا");
}
function todayWindow() {
  const d = new Date();
  const we = d.getDay() === 5 || d.getDay() === 6; // Friday, Saturday
  const w = sched()[we ? "we" : "wd"];
  return { from: w[0], to: w[1], now: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 };
}
function schedOverride() {
  return Date.now() < (store.get("schedOverride", 0) || 0);
}
function schedAllowed() {
  if (!sched().on || schedOverride()) return true;
  const w = todayWindow();
  return w.now >= w.from && w.now < w.to;
}
function schedLeftSec() {
  if (!sched().on) return Infinity;
  if (schedOverride()) return Math.max(0, (store.get("schedOverride", 0) - Date.now()) / 1e3);
  const w = todayWindow();
  if (w.now < w.from || w.now >= w.to) return 0;
  return (w.to - w.now) * 60;
}
function renderBedtime() {
  const w = todayWindow();
  const before = w.now < w.from;
  $("#bt-title").textContent = before ? "لسا ما إجا وقت الفرجة" : "وقت النوم والراحة";
  $("#bt-msg").textContent = before ? "الفرجة بتبلش الساعة " + fmtClock(w.from) + ". العبوا واقرأوا شوي!" : "خلص وقت الفرجة لليوم. تصبحوا على خير، وبكرة منكمّل!";
  $("#bedtime").classList.toggle("morning", before);
}
function goBedtime() {
  if (current === "player") {
    try {
      histSave(true);
      player.pauseVideo();
      player.stopVideo();
    } catch (e) {
    }
    clearInterval(tickT);
    clearInterval(guardT);
    curVid = null;
    hideOSD();
    clearEnd();
    endBreak(false);
  }
  renderBedtime();
  show("bedtime");
  focusEl($('[data-act="bt-parent"]'));
}
function schedStep(path, delta) {
  const s = sched();
  const p = path.split(".");
  const arr = s[p[0]];
  const i = +p[1];
  let v = arr[i] + delta;
  if (i === 0) v = clamp(v, 0, arr[1] - 30);
  else v = clamp(v, arr[0] + 30, 24 * 60);
  arr[i] = v;
  saveSettings();
  renderSchedSettings();
}
function renderSchedSettings() {
  const s = sched();
  $("#sched-tog").classList.toggle("on", !!s.on);
  $("#sched-rows").classList.toggle("dim", !s.on);
  ["wd.0", "wd.1", "we.0", "we.1"].forEach((k) => {
    const p = k.split(".");
    $('[data-schv="' + k + '"]').textContent = fmtClock(s[p[0]][+p[1]]);
  });
  const ov = schedOverride();
  $("#sched-ov").textContent = ov ? "مفتوح مؤقتاً لحد " + fmtClock(Math.round((new Date(store.get("schedOverride", 0)).getHours()) * 60 + new Date(store.get("schedOverride", 0)).getMinutes())) : "";
}

/* ---------- gentle warnings before the time runs out ---------- */
let warnT = null;
function showWarn(text, kind) {
  const el = $("#warn");
  $("#warn-text").textContent = text;
  el.className = "warn on" + (kind ? " " + kind : "");
  clearTimeout(warnT);
  warnT = setTimeout(() => el.classList.remove("on"), 7e3);
}
let lastCountdown = -1;
function stopLeftSec() {
  return Math.min(remainingSec(), schedLeftSec());
}
function warnTick() {
  const sLeft = schedLeftSec();
  const lLeft = remainingSec();
  const left = Math.min(sLeft, lLeft);
  const watching = current === "player" && curVid;
  // schedule: warn even when browsing
  if (sched().on && !schedOverride() && isFinite(sLeft)) {
    const key = todayStr() + ":" + todayWindow().to;
    const st = store.get("schedWarn", {});
    const lvl = st.key === key ? st.lvl : 0;
    if (sLeft > 0 && sLeft <= 300 && lvl < 1) {
      store.set("schedWarn", { key, lvl: 1 });
      showWarn("باقي 5 دقايق وبيخلص وقت الفرجة. خلّصوا الفيديو على مهل", "soft");
    } else if (sLeft > 0 && sLeft <= 60 && lvl < 2) {
      store.set("schedWarn", { key, lvl: 2 });
      showWarn("باقي دقيقة وحدة. يلا نجهز للنوم!", "soft");
    }
  }
  if (current !== "bedtime" && current !== "pin" && current !== "settings" && !locked && !schedAllowed()) {
    goBedtime();
    return;
  }
  // last seconds: a friendly countdown in the corner of the player
  const cd = $("#p-count");
  if (watching && left <= 10 && left > 0) {
    const n = Math.ceil(left);
    if (n !== lastCountdown) {
      lastCountdown = n;
      cd.textContent = n;
      cd.classList.add("on");
    }
  } else if (lastCountdown !== -1) {
    lastCountdown = -1;
    cd.classList.remove("on");
  }
}

/* ---------- eye break ---------- */
const BREAK_OPTS = [0, 15, 20, 30];
const BREAK_LEN = 60;
let contWatch = 0, lastWatchAt = 0, breakT = null, breakLeft = 0, inBreak = false;
const BREAK_TIPS = ["طلّع على شي بعيد من الشباك", "غمّض عيونك وعدّ لـ 10", "قوم تمطّع وارفع إيديك لفوق", "رمّش 10 مرات بسرعة", "اشرب شوية مي"];
function breakTick(dt) {
  if (!settings.eyeBreak) return;
  if (Date.now() - lastWatchAt > 5 * 60 * 1e3) contWatch = 0;
  lastWatchAt = Date.now();
  contWatch += dt;
  if (!inBreak && contWatch >= settings.eyeBreak * 60) startBreak();
}
function startBreak() {
  inBreak = true;
  contWatch = 0;
  wePaused = true;
  try {
    player.pauseVideo();
  } catch (e) {
  }
  hideOSD();
  breakLeft = BREAK_LEN;
  $("#p-break").classList.remove("hidden");
  let tip = 0;
  const paint = () => {
    $("#br-count").textContent = breakLeft;
    if (breakLeft % 12 === 0) $("#br-tip").textContent = BREAK_TIPS[tip++ % BREAK_TIPS.length];
    $("#br-ring").style.strokeDashoffset = String(283 * (1 - breakLeft / BREAK_LEN));
  };
  paint();
  clearInterval(breakT);
  breakT = setInterval(() => {
    breakLeft--;
    paint();
    if (breakLeft <= 0) endBreak(true);
  }, 1e3);
  remoteNotify();
}
function endBreak(resume) {
  if (!inBreak) return;
  inBreak = false;
  clearInterval(breakT);
  $("#p-break").classList.add("hidden");
  if (resume && current === "player" && player) {
    wePaused = false;
    try {
      player.playVideo();
    } catch (e) {
    }
    toast("برافو! يلا نكمّل");
  }
}

/* ---------- reward time for Quran / learning videos ---------- */
function rewardTick(dt, chId) {
  if (!settings.reward || !limitOn()) return;
  if (EDU_CATS.indexOf(catOf(chId)) < 0) return;
  const u = getUsage();
  u.edu = (u.edu || 0) + dt;
  u.rew = u.rew || 0;
  if (u.edu >= (u.rew + 1) * 600 && u.rew < 6) {
    u.rew++;
    u.bonus += 5;
    u.warned = 0;
    saveUsage();
    showWarn("برافو! كسبت 5 دقايق زيادة لأنك حضرت شي مفيد", "star");
  }
}

/* ---------- watch log (for the parents' report) ---------- */
let wlog = store.get("wlog", {});
let wlogDirty = 0;
function logTick(dt, v) {
  const day = todayStr();
  const d = wlog[day] || (wlog[day] = {});
  const k = d[kidId] || (d[kidId] = { s: 0, c: {}, v: {} });
  k.s += dt;
  const chId = videoChannelId(v) || "";
  if (chId) k.c[chId] = (k.c[chId] || 0) + dt;
  if (v && v.id) {
    const e = k.v[v.id] || (k.v[v.id] = [0, String(v.title || "").slice(0, 60), String(v.ch && v.ch.title || "").slice(0, 40)]);
    e[0] += dt;
  }
  if (++wlogDirty >= 30) saveLog();
}
function saveLog() {
  wlogDirty = 0;
  const days = Object.keys(wlog).sort();
  while (days.length > 8) delete wlog[days.shift()];
  Object.keys(wlog).forEach((day) => Object.keys(wlog[day]).forEach((kid) => {
    const vv = wlog[day][kid].v;
    const ids = Object.keys(vv);
    if (ids.length > 40) ids.sort((a, b) => vv[b][0] - vv[a][0]).slice(40).forEach((id) => delete vv[id]);
  }));
  store.set("wlog", wlog);
}
function buildReport(days) {
  days = clamp(+days || 1, 1, 7);
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    dates.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
  }
  const kidList = kids.length ? kids : [{ id: "main", name: "" }];
  const chTitle = (id) => {
    const c = allChannels.find((x) => x.id === id);
    return c ? c.title.slice(0, 40) : "";
  };
  const out = kidList.map((k) => {
    const perDay = dates.map((day) => Math.round((wlog[day] && wlog[day][k.id] ? wlog[day][k.id].s : 0) / 60));
    const chs2 = {}, vids = {};
    dates.forEach((day) => {
      const e = wlog[day] && wlog[day][k.id];
      if (!e) return;
      Object.keys(e.c).forEach((id) => chs2[id] = (chs2[id] || 0) + e.c[id]);
      Object.keys(e.v).forEach((id) => {
        const x = e.v[id];
        if (!vids[id]) vids[id] = [0, x[1], x[2]];
        vids[id][0] += x[0];
      });
    });
    const topC = Object.keys(chs2).sort((a, b) => chs2[b] - chs2[a]).slice(0, 5).map((id) => [chTitle(id) || "قناة", Math.round(chs2[id] / 60), catOf(id)]);
    const topV = Object.keys(vids).sort((a, b) => vids[b][0] - vids[a][0]).slice(0, 6).map((id) => [vids[id][1].slice(0, 50), vids[id][2].slice(0, 30), Math.round(vids[id][0] / 60), id]);
    let edu = 0;
    Object.keys(chs2).forEach((id) => {
      if (EDU_CATS.indexOf(catOf(id)) >= 0) edu += chs2[id];
    });
    return { name: k.name || "", color: k.color || "", total: perDay.reduce((a, b) => a + b, 0), perDay, edu: Math.round(edu / 60), topC, topV };
  });
  return { type: "report", t: Date.now(), days, dates, kids: out };
}

/* ---------- relay: our own Cloudflare Worker if configured, else ntfy.sh ---------- */
const RELAY = String(CFG.relay || "").replace(/\/$/, "");
function relayPub(key, obj) {
  const body = JSON.stringify(obj);
  if (RELAY) return fetch(RELAY + "/r/" + room + "/b/" + key, { method: "POST", body });
  return fetch(NTFY + "/" + topic(key), { method: "POST", body });
}
let cmdAfter = -1, pollGen = 0;
function pollCmds(gen) {
  if (gen !== pollGen) return;
  fetch(RELAY + "/r/" + room + "/c?after=" + cmdAfter + "&wait=20", { cache: "no-store" }).then((r) => r.json()).then((j) => {
    sseAliveAt = Date.now();
    if (gen !== pollGen) return;
    (j.cmds || []).forEach((c) => {
      cmdAfter = Math.max(cmdAfter, c.seq);
      let x = null;
      try {
        x = JSON.parse(c.data);
      } catch (e) {
      }
      if (x) handleCmd(x);
    });
    if (typeof j.seq === "number" && cmdAfter < 0) cmdAfter = j.seq;
    setTimeout(() => pollCmds(gen), 250);
  }).catch(() => {
    if (gen === pollGen) setTimeout(() => pollCmds(gen), 5e3);
  });
}
function handleCmd(c) {
  if (!c || !c.cmd || seenCmd[c.id]) return;
  seenCmd[c.id] = 1;
  if (c.t && Math.abs(Date.now() - c.t) > 2 * 60 * 1e3) return;
  onRemote(c);
}
// Channel / picks management from the parents' phone through the relay (the TV keeps the list).
function cleanChannel(ch) {
  if (!ch || !/^UC[\w-]{22}$/.test(ch.id || "")) return null;
  return {
    id: ch.id,
    title: String(ch.title || "").slice(0, 100),
    thumb: /^https:\/\//.test(ch.thumb || "") ? String(ch.thumb).slice(0, 400) : "",
    uploads: /^UU[\w-]{22}$/.test(ch.uploads || "") ? ch.uploads : "UU" + ch.id.slice(2)
  };
}
function setCatLocal(id, k) {
  const l = store.get("catLocal", {});
  l[id] = CATS.some((x) => x.k === k) ? k : "";
  store.set("catLocal", l);
}
function addChannelLocal(raw, cat) {
  const ch = cleanChannel(raw);
  if (!ch) return;
  store.set("channels", tvChannels().filter((c) => c.id !== ch.id).concat([ch]));
  store.set("removed", removedIds().filter((id) => id !== ch.id));
  rebuildChannelsLocal();
  if (typeof cat === "string") setCatLocal(ch.id, cat);
  else if (!catOf(ch.id)) guessCat(ch).then((k) => {
    if (!k) return;
    setCatLocal(ch.id, k);
    applyKidFilter();
    remoteNotify(true);
  });
  applyKidFilter();
  lastListLoad = 0;
  refreshChannelsSoon();
  if (current === "settings") renderSettings();
  showRemoteMsg("قناة جديدة: " + ch.title);
}
function cleanPick(v) {
  if (!v || !/^[\w-]{11}$/.test(v.id || "")) return null;
  return { id: v.id, title: String(v.title || "").slice(0, 120), thumb: /^https:\/\//.test(v.thumb || "") ? v.thumb : "", ch: /^UC[\w-]{22}$/.test(v.ch || "") ? v.ch : "", chTitle: String(v.chTitle || "").slice(0, 80), dur: +v.dur || 0, at: Date.now() };
}
function onRemoteExtra(c) {
  switch (c.cmd) {
    case "addChannel":
      addChannelLocal(c.ch, c.cat);
      return true;
    case "removeChannel":
      if (c.ch && allChannels.some((x) => x.id === c.ch)) removeChannel(String(c.ch));
      return true;
    case "setCat":
      if (c.ch) {
        setCatLocal(String(c.ch), c.cat);
        applyKidFilter();
        if (current === "home") rerenderHomeKeepFocus();
      }
      return true;
    case "addPick": {
      const p = cleanPick(c.v);
      if (!p) return true;
      remoteExtra.picks = [p].concat((remoteExtra.picks || []).filter((x) => x.id !== p.id)).slice(0, 40);
      store.set("remoteExtra", remoteExtra);
      if (current === "home") rerenderHomeKeepFocus();
      showRemoteMsg("ماما وبابا اختاروا: " + p.title);
      return true;
    }
    case "removePick":
      remoteExtra.picks = (remoteExtra.picks || []).filter((x) => x.id !== c.vid);
      store.set("remoteExtra", remoteExtra);
      if (current === "home") rerenderHomeKeepFocus();
      return true;
    case "report":
      relayPub("r", buildReport(c.days)).catch(() => {
      });
      return true;
    case "block":
      if (c.vid) blockLocal(String(c.vid), c.title);
      return true;
    case "unblock": {
      const l = store.get("blockedLocal", []).filter((b) => b.id !== c.vid);
      store.set("blockedLocal", l);
      blockedCache = null;
      return true;
    }
    case "cats":
      setCatOff(c.off);
      showRemoteMsg("ماما وبابا غيّروا الأقسام المفتوحة");
      return true;
    case "schedOpen":
      store.set("schedOverride", Date.now() + (+c.n || 60) * 60 * 1e3);
      if (current === "bedtime") {
        show("home");
        renderHome();
        focusHome(true);
      }
      showRemoteMsg("ماما وبابا فتحوا الفرجة " + (+c.n || 60) + " دقيقة");
      return true;
  }
  return false;
}


/* ---------- Amira-style home: right icon rail, hero for the focused video, full-screen backdrop ---------- */
let homeView = "all";
const RAIL_IC = {
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.8"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  all: '<svg viewBox="0 0 24 24"><path d="M12 3L2 12h3v8h5v-6h4v6h5v-8h3z" fill="currentColor"/></svg>',
  favs: '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z" fill="#ffd23f"/></svg>',
  chans: '<svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="4" fill="#ff5d73"/><circle cx="17" cy="8" r="4" fill="#2ec98b"/><circle cx="7" cy="17" r="4" fill="#9b5de5"/><circle cx="17" cy="17" r="4" fill="#ffd23f"/></svg>',
  parent: '<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="4.5" y="10" width="15" height="11" rx="3" fill="currentColor"/></svg>',
};
function railIcon(k) {
  if (RAIL_IC[k]) return RAIL_IC[k];
  if (k === "picks") return CAT_ICONS.picks;
  if (/^cat:/.test(k)) return CAT_ICONS[k.slice(4)] || "";
  return "";
}
function renderRail() {
  const items = [["search", "ابحث", "search-btn"], ["all", "الرئيسية"]];
  if (picksList().length) items.push(["picks", "اختيار بابا"]);
  CATS.forEach((c) => {
    if (channels.some((ch) => catOf(ch.id) === c.k)) items.push(["cat:" + c.k, c.n]);
  });
  items.push(["favs", "مفضلتي"], ["chans", "القنوات"], ["parent", "الأهل", "parent-btn"]);
  const a = document.activeElement;
  const had = a && a.closest && a.closest("#rail-items") ? a.id ? "#" + a.id : '#rail-items [data-view="' + a.getAttribute("data-view") + '"]' : null;
  $("#rail-items").innerHTML = items.map((it) => '<button class="f rail-it' + (homeView === it[0] ? " on" : "") + '"' + (it[2] ? ' id="' + it[2] + '"' : ' data-view="' + esc(it[0]) + '"') + '><i class="ri">' + railIcon(it[0]) + "</i><span>" + esc(it[1]) + "</span></button>").join("");
  if (had) focusEl($(had));
}
const chBubble2 = (c, row) => '<button class="f ch" data-id="' + esc(c.id) + '" data-key="' + row + ":" + esc(c.id) + '"><span class="av"><img src="' + esc(c.thumb) + '" alt="">' + (isFavCh(c.id) ? '<i class="ch-heart">❤</i>' : "") + '</span><span class="nm">' + esc(c.title) + "</span></button>";
function channelRows(list, html) {
  list.forEach((c) => {
    const l = visible(feedData[c.id] || []).slice(0, 12).map((v) => Object.assign({}, v, { ch: c }));
    if (!l.length) return;
    const key = "c:" + c.id;
    rowLists[key] = l;
    html.push(rowHTML(esc(c.title), l.map((v, i) => videoCard(v, key, i, false)).join("") + '<button class="f more" data-id="' + esc(c.id) + '" data-key="more:' + esc(c.id) + '"><span class="more-in"><img src="' + esc(c.thumb) + '" alt=""><b>كل فيديوهات القناة</b></span></button>'));
  });
}
function renderHomeView() {
  const html = [];
  const empty = (t) => '<div class="empty dark">' + EMPTY_SVG + "<p>" + t + "</p></div>";
  if (homeView === "picks") {
    const p = picksList();
    rowLists.picks = p;
    if (p.length) html.push(rowHTML(catTitle("picks", "اختيار بابا وماما"), p.map((v, i) => videoCard(v, "picks", i, true)).join("")));
    else html.push(empty("ما في اختيارات لسا."));
  } else if (/^cat:/.test(homeView)) {
    const k = homeView.slice(4);
    const inCat = channels.filter((c) => catOf(c.id) === k);
    const mix = buildFeed(30, inCat);
    const key = "cat:" + k;
    rowLists[key] = mix;
    if (mix.length) html.push(rowHTML(catTitle(k, "الجديد في " + catName(k)), mix.map((v, i) => videoCard(v, key, i, true)).join("")));
    if (inCat.length) html.push(rowHTML("القنوات", inCat.map((c) => chBubble2(c, "ch")).join(""), "chans"));
    channelRows(inCat, html);
    if (!html.length) html.push(empty("ما في فيديوهات هون لسا."));
  } else if (homeView === "favs") {
    const cont = continueList();
    if (cont.length) {
      rowLists.cont = cont.map((h) => Object.assign({}, h, { ch: channels.find((c) => h.ch && c.id === h.ch.id) || h.ch }));
      html.push(rowHTML("كمّل المشاهدة", rowLists.cont.map((v, i) => videoCard(v, "cont", i, false)).join("")));
    }
    const fv = favs.filter((f) => channelAllowed(f.ch && f.ch.id) && !isBlocked(f.id));
    rowLists.favs = fv.map((f) => Object.assign({}, f, { ch: channels.find((c) => f.ch && c.id === f.ch.id) || f.ch }));
    if (fv.length) html.push(rowHTML("مفضلتي ❤", rowLists.favs.map((v, i) => videoCard(v, "favs", i, true)).join("")));
    const fc = channels.filter((c) => isFavCh(c.id));
    if (fc.length) html.push(rowHTML("قنواتي المفضلة", fc.map((c) => chBubble2(c, "fch")).join(""), "chans"));
    if (!html.length) html.push(empty("لسا ما في شي بالمفضلة. اضغط ❤ على أي فيديو أو قناة."));
  } else if (homeView === "chans") {
    const fc = channels.filter((c) => isFavCh(c.id));
    if (fc.length) html.push(rowHTML("قنواتي المفضلة", fc.map((c) => chBubble2(c, "fch")).join(""), "chans"));
    for (let i = 0; i < channels.length; i += 7) html.push(rowHTML(i ? "" : "كل القنوات", channels.slice(i, i + 7).map((c) => chBubble2(c, "ch")).join(""), "chans" + (i ? " no-h" : "")));
  }
  return html.join("");
}
function setView(v) {
  homeView = v;
  lastFocus.homeKey = null;
  heroEl = null;
  renderHome();
  $("#home-rows").style.transform = "";
  if (TOUCH) $("#home-scroll").scrollTop = 0;
  const first = $("#home-rows .f");
  if (first) focusEl(first);
  else focusEl($('#rail-items [data-view="' + v + '"]'));
}

/* hero + backdrop follow the focused card */
let heroV = null, heroEl = null, heroT = null, stageOn = "a", stageUrl = "";
function bigThumb(v) {
  const m = /i\.ytimg\.com\/vi\/([\w-]{11})\//.exec(v.thumb || "") || (/^[\w-]{11}$/.test(v.id) ? [0, v.id] : null);
  return m ? "https://i.ytimg.com/vi/" + m[1] + "/maxresdefault.jpg" : v.thumb || "";
}
function setStage(url, fallback) {
  if (!url || url === stageUrl) return;
  stageUrl = url;
  const apply = (u) => {
    if (stageUrl !== url) return;
    const next = stageOn === "a" ? "b" : "a";
    const el = $("#st-" + next);
    el.style.backgroundImage = 'url("' + u.replace(/"/g, "%22") + '")';
    el.classList.add("on");
    $("#st-" + stageOn).classList.remove("on");
    stageOn = next;
  };
  if (/^data:/.test(url)) {
    apply(url);
    return;
  }
  const im = new Image();
  im.onload = () => apply(im.naturalWidth > 200 || !fallback ? url : fallback);
  im.onerror = () => {
    if (fallback) apply(fallback);
  };
  im.src = url;
}
function fmtAge(v) {
  return v.at ? ageText(v.at) : "";
}
function setHero(v, el) {
  heroV = v;
  heroEl = el;
  const row = el ? el.getAttribute("data-row") || "" : "";
  const cat = v.ch && catOf(v.ch.id);
  $("#hi-chip").innerHTML = (cat ? catTitle(cat, catName(cat)) + " · " : row === "picks" ? catTitle("picks", "اختيار بابا") + " · " : "") + esc(v.ch && v.ch.title || "");
  $("#hi-title").textContent = v.title || "";
  const meta = [];
  if (v.dur) meta.push(fmtTime(v.dur));
  if (row === "cont" && v.dur) meta.push("باقي " + fmtTime(Math.max(0, v.dur - (v.pos || 0))));
  else if (fmtAge(v)) meta.push(fmtAge(v));
  $("#hi-meta").innerHTML = meta.map(esc).join(' <i>•</i> ');
  $("#hi-play").classList.remove("hidden");
  $("#hi-play span").textContent = row === "cont" ? "كمّل" : "شغّل";
  $("#hi-ch").classList.toggle("hidden", !(v.ch && channelAllowed(v.ch.id)));
  $("#hi-fav").classList.remove("hidden");
  $("#hi-fav").classList.toggle("on", isFav(v.id));
  $("#hero").classList.add("show");
  clearTimeout(heroT);
  heroT = setTimeout(() => setStage(bigThumb(v), v.thumb), 220);
}
function setHeroCh(c, el) {
  heroV = { ch: c, isCh: true };
  heroEl = el;
  const cat = catOf(c.id);
  $("#hi-chip").innerHTML = cat ? catTitle(cat, catName(cat)) : "قناة";
  $("#hi-title").textContent = c.title;
  const n = visible(feedData[c.id] || []).filter((v) => v.at && Date.now() - v.at < 7 * 864e5).length;
  $("#hi-meta").textContent = n ? n + " فيديو جديد هالأسبوع" : "";
  $("#hi-play").classList.remove("hidden");
  $("#hi-play span").textContent = "افتح القناة";
  $("#hi-ch").classList.add("hidden");
  $("#hi-fav").classList.add("hidden");
  $("#hero").classList.add("show");
  const first = (feedData[c.id] || [])[0];
  clearTimeout(heroT);
  heroT = setTimeout(() => setStage(first ? bigThumb(first) : c.thumb, first ? first.thumb : ""), 220);
}
function heroDefault() {
  const hr = (/* @__PURE__ */ new Date()).getHours();
  const k = curKid();
  $("#hi-chip").textContent = (hr < 12 ? "صباح الخير" : hr < 17 ? "نهارك سعيد" : "مساء الخير") + (k && kids.length ? " يا " + k.name : "") + "!";
  $("#hi-title").textContent = "شو بدكم تشوفوا اليوم؟";
  $("#hi-meta").textContent = "";
  ["hi-play", "hi-ch", "hi-fav"].forEach((id) => $("#" + id).classList.add("hidden"));
}
function heroFocus(el) {
  if (!el || current !== "home") return;
  const home = $("#home");
  home.classList.toggle("nav-open", !!el.closest("#rail"));
  if (el.closest("#home-rows")) {
    if (el.classList.contains("v")) {
      const v = (rowLists[el.getAttribute("data-row")] || [])[+el.getAttribute("data-i")];
      if (v) setHero(v, el);
    } else if (el.classList.contains("ch") || el.classList.contains("more")) {
      const c = channels.find((x) => x.id === el.getAttribute("data-id"));
      if (c) setHeroCh(c, el);
    }
  }
}
function heroAction(id) {
  if (!heroV) return;
  if (id === "hi-play") {
    if (heroV.isCh) {
      openChannel(heroV.ch.id);
      return;
    }
    if (heroEl && document.body.contains(heroEl)) heroEl.click();
    return;
  }
  if (id === "hi-ch" && heroV.ch) {
    openChannel(heroV.ch.id);
    return;
  }
  if (id === "hi-fav" && !heroV.isCh) {
    const v = heroV;
    if (isFav(v.id)) {
      favs = favs.filter((f) => f.id !== v.id);
      toast("انشال من المفضلة");
    } else {
      favs = [slimVideo(v)].concat(favs).slice(0, 100);
      toast("انضاف للمفضلة ❤");
    }
    store.set(pk("favs"), favs);
    $("#hi-fav").classList.toggle("on", isFav(v.id));
  }
}
function homeScrollTo(el) {
  const rowsBox = $("#home-rows");
  const row = el.closest(".hrow");
  if (!row) return;
  const rows = $$("#home-rows .hrow");
  const first = rows[0];
  const off = Math.max(0, row.offsetTop - first.offsetTop);
  rowsBox.style.transform = "translateY(" + -off + "px)";
  rowsBox.style.webkitTransform = "translateY(" + -off + "px)";
  rows.forEach((r) => r.classList.toggle("past", r.offsetTop < row.offsetTop));
}
function tickClock() {
  const hv = $("#home-ver");
  if (hv && !hv.textContent) hv.textContent = "v" + VERSION;
  const d = new Date();
  const el = $("#clock");
  if (el) el.textContent = pad2(d.getHours() % 12 || 12) + ":" + pad2(d.getMinutes());
}


/* ---------- prayer times: pause the TV at each adhan (computed on the TV, no internet needed) ---------- */
// [name, lat, lng, method]  method "uq" = Umm al-Qura (Fajr 18.5°, Isha 90 min after Maghrib), "mwl" = Fajr 18°, Isha 17°
const PR_CITIES = [["الرياض", 24.7136, 46.6753, "uq"], ["بريدة", 26.326, 43.975, "uq"], ["عنيزة", 26.0843, 43.9935, "uq"], ["جدة", 21.4858, 39.1925, "uq"], ["مكة المكرمة", 21.3891, 39.8579, "uq"], ["المدينة المنورة", 24.5247, 39.5692, "uq"], ["الدمام", 26.4207, 50.0888, "uq"], ["أبها", 18.2164, 42.5053, "uq"], ["تبوك", 28.3835, 36.5662, "uq"], ["عمّان", 31.9539, 35.9106, "mwl"], ["دبي", 25.2048, 55.2708, "mwl"], ["الكويت", 29.3759, 47.9774, "mwl"]];
const PR_NAMES = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
const PR_DURS = [10, 15, 20, 30];
const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
const fixA = (a) => (a % 360 + 360) % 360, fixH = (h) => (h % 24 + 24) % 24;
function prSettings() {
  if (!settings.prayer) settings.prayer = { on: false, city: 1, dur: 15, fajr: false };
  return settings.prayer;
}
function julian(y, m, d) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sunPosition(jd) {
  const D = jd - 2451545;
  const g = fixA(357.529 + 0.98560028 * D);
  const q = fixA(280.459 + 0.98564736 * D);
  const L = fixA(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)));
  const e = 23.439 - 3.6e-7 * D;
  const RA = fixH(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15);
  let eqt = q / 15 - RA;
  eqt = eqt > 12 ? eqt - 24 : eqt < -12 ? eqt + 24 : eqt;
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt };
}
// Prayer times for a date, in minutes after local midnight (uses the TV's own time zone).
function prayerTimes(date, city) {
  const c = PR_CITIES[city] || PR_CITIES[0];
  const lat = c[1], lng = c[2];
  const tz = -date.getTimezoneOffset() / 60;
  const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / 360;
  const sp = sunPosition(jd + 0.5);
  const noon = 12 + tz - lng / 15 - sp.eqt;
  const T = (alt) => deg(Math.acos((Math.sin(rad(alt)) - Math.sin(rad(lat)) * Math.sin(rad(sp.decl))) / (Math.cos(rad(lat)) * Math.cos(rad(sp.decl))))) / 15;
  const asrAlt = deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(lat - sp.decl))))));
  const maghrib = noon + T(-0.833);
  const h = {
    fajr: noon - T(c[3] === "uq" ? -18.5 : -18),
    sunrise: noon - T(-0.833),
    dhuhr: noon + 2 / 60,
    asr: noon + T(asrAlt),
    maghrib,
    isha: c[3] === "uq" ? maghrib + 1.5 : noon + T(-17)
  };
  const out = {};
  Object.keys(h).forEach((k) => out[k] = k === "sunrise" ? Math.floor(h[k] * 60) : Math.ceil(h[k] * 60));
  return out;
}
function prayerState() {
  const ps = prSettings();
  if (!ps.on) return null;
  const d = new Date();
  const nowM = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const t = prayerTimes(d, ps.city);
  let current = null, next = null;
  ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach((k) => {
    if (k === "fajr" && !ps.fajr) return;
    if (nowM >= t[k] && nowM < t[k] + ps.dur) current = { k, start: t[k], end: t[k] + ps.dur };
    if (!next && t[k] > nowM) next = { k, at: t[k] };
  });
  return { current, next, nowM, times: t };
}
function prayerBlocking() {
  const st = prayerState();
  if (!st || !st.current) return null;
  const ov = store.get("prayerOverride", "");
  return ov === todayStr() + ":" + st.current.k ? null : st.current;
}
function renderPrayerScreen(cur) {
  $("#pr-title").textContent = "حان وقت صلاة " + PR_NAMES[cur.k];
  const d = new Date();
  const left = Math.max(1, Math.ceil(cur.end - (d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60)));
  $("#pr-msg").textContent = "يلا نتوضّى ونصلّي. الفرجة بترجع بعد " + left + " دقيقة";
}
function goPrayer(cur) {
  if (current === "player") {
    try {
      histSave(true);
      player.pauseVideo();
      player.stopVideo();
    } catch (e) {
    }
    clearInterval(tickT);
    clearInterval(guardT);
    curVid = null;
    hideOSD();
    clearEnd();
    endBreak(false);
  }
  renderPrayerScreen(cur);
  show("prayer");
  focusEl($('[data-act="pr-parent"]'));
}
function prayerTick() {
  const st = prayerState();
  if (!st) {
    if (current === "prayer") {
      show("home");
      renderHome();
      focusHome(true);
    }
    return;
  }
  if (st.next && st.next.at - st.nowM <= 5 && st.next.at - st.nowM > 4.9) {
    const key = todayStr() + ":" + st.next.k;
    if (store.get("prayerWarn", "") !== key) {
      store.set("prayerWarn", key);
      showWarn("باقي 5 دقايق على أذان " + PR_NAMES[st.next.k], "soft");
    }
  }
  const cur = prayerBlocking();
  if (cur && current !== "prayer" && current !== "pin" && current !== "settings" && !locked) goPrayer(cur);
  else if (cur && current === "prayer") renderPrayerScreen(cur);
  else if (!cur && current === "prayer") {
    show("home");
    renderHome();
    focusHome(true);
    toast("تقبّل الله! يلا نكمّل");
  }
}
function fmtM(m) {
  m = Math.round(m);
  return fmtClock(m).replace(/ (الصبح|الظهر|المسا)$/, "");
}
function renderPrayerSettings() {
  const ps = prSettings();
  $("#pr-tog").classList.toggle("on", !!ps.on);
  $("#pr-city").textContent = (PR_CITIES[ps.city] || PR_CITIES[0])[0];
  $("#pr-dur").textContent = ps.dur + " دقيقة";
  $("#pr-fajr").classList.toggle("on", !!ps.fajr);
  const t = prayerTimes(new Date(), ps.city);
  $("#pr-times").innerHTML = ["fajr", "dhuhr", "asr", "maghrib", "isha"].map((k) => "<span><b>" + PR_NAMES[k] + "</b> " + fmtM(t[k]) + "</span>").join("");
}

/* ---------- calm time: the last minutes before bedtime show only stories and Quran ---------- */
const CALM_OPTS = [0, 30, 45, 60];
const CALM_CATS = ["stories", "quran"];
let calmWas = false;
function calmActive() {
  const m = settings.calm || 0;
  if (!m || !sched().on || schedOverride()) return false;
  const left = schedLeftSec();
  return left > 0 && left <= m * 60 && allChannels.some((c) => CALM_CATS.indexOf(catOf(c.id)) >= 0);
}
function calmTick() {
  const on = calmActive();
  if (on === calmWas) return;
  calmWas = on;
  applyKidFilter();
  enforceChannels();
  if (current === "home") rerenderHomeKeepFocus();
  if (on) showWarn("وقت الهدوء قبل النوم: بس قصص وقرآن", "soft");
}

function onClickPlus(b, act) {
  if (b.id === "ad-skip") {
    adSkip();
    return true;
  }
  if (b.hasAttribute("data-view")) {
    setView(b.getAttribute("data-view"));
    return true;
  }
  if (b.id === "hi-play" || b.id === "hi-ch" || b.id === "hi-fav") {
    heroAction(b.id);
    return true;
  }
  if (b.hasAttribute("data-kav")) {
    cycleKidAvatar(b.getAttribute("data-kav"));
    return true;
  }
  if (b.hasAttribute("data-kch-open")) {
    kchKid = b.getAttribute("data-kch-open");
    renderKidChans();
    focusEl($("#kid-chans [data-kch]") || $("#kid-chans [data-kch-close]"));
    return true;
  }
  if (b.hasAttribute("data-kch-close")) {
    const id = kchKid;
    kchKid = null;
    renderKidChans();
    focusEl($('#kid-list [data-kch-open="' + id + '"]'));
    return true;
  }
  if (b.hasAttribute("data-kch")) {
    toggleKidChan(b.getAttribute("data-kch"));
    return true;
  }
  if (b.hasAttribute("data-cat")) {
    const id = b.getAttribute("data-cat");
    cycleCat(id);
    b.innerHTML = catOf(id) ? catTitle(catOf(id), catName(catOf(id))) : "تصنيف";
    return true;
  }
  if (b.hasAttribute("data-catoff")) {
    const k = b.getAttribute("data-catoff");
    const off = (settings.catOff || []).slice();
    const i = off.indexOf(k);
    if (i >= 0) off.splice(i, 1);
    else off.push(k);
    setCatOff(off);
    renderCatSettings();
    focusEl($('[data-catoff="' + k + '"]'));
    return true;
  }
  if (b.id === "pr-tog" || b.id === "pr-fajr-btn") {
    const ps = prSettings();
    if (b.id === "pr-tog") ps.on = !ps.on;
    else ps.fajr = !ps.fajr;
    saveSettings();
    renderPrayerSettings();
    return true;
  }
  if (b.id === "pr-city-btn") {
    const ps = prSettings();
    ps.city = (ps.city + 1) % PR_CITIES.length;
    saveSettings();
    renderPrayerSettings();
    return true;
  }
  if (b.id === "pr-dur-btn") {
    const ps = prSettings();
    ps.dur = PR_DURS[(PR_DURS.indexOf(ps.dur) + 1) % PR_DURS.length];
    saveSettings();
    renderPrayerSettings();
    return true;
  }
  if (b.id === "calm-btn") {
    settings.calm = CALM_OPTS[(CALM_OPTS.indexOf(settings.calm || 0) + 1) % CALM_OPTS.length];
    saveSettings();
    $("#calm-val").textContent = settings.calm ? "آخر " + settings.calm + " دقيقة" : "مطفي";
    calmTick();
    return true;
  }
  if (act === "pr-parent") {
    const cur = prayerBlocking();
    openPin({ done: () => {
      if (cur) store.set("prayerOverride", todayStr() + ":" + cur.k);
      show("home");
      renderHome();
      focusHome(true);
    }, cancel: () => {
      const c2 = prayerBlocking();
      if (c2) goPrayer(c2);
      else {
        show("home");
        focusHome(true);
      }
    } });
    return true;
  }
  if (b.id === "sched-tog") {
    sched().on = !sched().on;
    saveSettings();
    renderSchedSettings();
    return true;
  }
  if (b.hasAttribute("data-sch")) {
    const p = b.getAttribute("data-sch").split("|");
    schedStep(p[0], +p[1]);
    return true;
  }
  if (b.id === "adc-btn") {
    settings.adCover = settings.adCover === "skip" ? "full" : "skip";
    saveSettings();
    $("#adc-val").textContent = settings.adCover === "skip" ? "خلّي زر التخطي ظاهر" : "غطّي كل الشاشة";
    return true;
  }
  if (b.id === "eb-btn") {
    settings.eyeBreak = BREAK_OPTS[(BREAK_OPTS.indexOf(settings.eyeBreak || 0) + 1) % BREAK_OPTS.length];
    saveSettings();
    $("#eb-val").textContent = settings.eyeBreak ? "كل " + settings.eyeBreak + " دقيقة" : "مطفي";
    return true;
  }
  if (act === "bt-parent") {
    openPin({ done: () => {
      store.set("schedOverride", Date.now() + 60 * 60 * 1e3);
      show("home");
      renderHome();
      focusHome(true);
      toast("انفتحت الفرجة ساعة وحدة");
    }, cancel: () => {
      goBedtime();
    } });
    return true;
  }
  if (b.id === "sched-close") {
    store.set("schedOverride", 0);
    renderSchedSettings();
    toast("رجعت المواعيد متل ما هي");
    return true;
  }
  return false;
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
  if (current === "locked" || current === "bedtime" || current === "prayer") {
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
      if (t.id === "kid-in") addKid();
      else addSearch();
      return;
    }
  }
  const dir = { 37: "left", 38: "up", 39: "right", 40: "down" }[code];
  if (dir) {
    e.preventDefault();
    if (current === "home") homeFocusPending = false;
    if (current === "home" && dir === "down" && t && t.closest && t.closest("#hero")) {
      focusEl(lastFocus.homeKey && $('#home [data-key="' + lastFocus.homeKey + '"]') || heroEl && document.body.contains(heroEl) && heroEl || $("#home-rows .f"));
      return;
    }
    if (current === "home" && dir === "up" && t && t.closest && t.closest("#home-rows") && t.closest(".hrow") === $("#home-rows .hrow")) {
      const hp = $("#hi-play");
      if (hp && !hp.classList.contains("hidden")) {
        focusEl(hp);
        return;
      }
    }
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
  if (onClickPlus(b, act)) return;
  if (b.id === "search-btn") {
    openSearch();
    return;
  }
  if (b.id === "kid-btn") {
    openKids();
    return;
  }
  if (b.hasAttribute("data-kid")) {
    switchKid(b.getAttribute("data-kid"));
    return;
  }
  if (b.id === "kid-add") {
    addKid();
    return;
  }
  if (b.hasAttribute("data-kdel")) {
    delKid(b.getAttribute("data-kdel"));
    return;
  }
  if (b.hasAttribute("data-kcolor")) {
    cycleKidColor(b.getAttribute("data-kcolor"));
    return;
  }
  if (b.id === "ch-fav") {
    toggleFavCh();
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
      playList = visible(activeSrc().all).map((v) => v.ch ? v : Object.assign({}, v, { ch: chs.ch }));
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
  heroFocus(el);
  if (current === "channel" && el.classList && el.classList.contains("v")) {
    const total = $$("#v-grid .v").length;
    if (total - +el.getAttribute("data-i") <= 8) loadMore();
  }
}
function measureRem_() {
}
function measureRem() {
  remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
}
function init() {
  measureRem();
  window.addEventListener("resize", measureRem);
  initPointer();
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
    if (current === "player") setTimeout(reclaimFocus, 0);
  });
  setInterval(() => {
    if (current !== "player") return;
    const a = document.activeElement;
    if (!document.hasFocus() || !a || a.tagName === "IFRAME" || a === document.body) reclaimFocus();
    if (pState === 2) {
      if (!pausedSince) pausedSince = Date.now();
      else if (Date.now() - pausedSince > PAUSE_LIMIT) {
        pausedSince = 0;
        histSave(true);
        closePlayer();
        toast("رجعنا للقائمة لأن الفيديو كان موقّف من زمان");
      }
    } else pausedSince = 0;
  }, 1e3);
  document.addEventListener("webOSRelaunch", () => {
    reclaimFocus();
    if (current === "player" && pState !== 1) {
      showOSD(0);
    }
  });
  window.addEventListener("focus", () => {
    if (current === "player") reclaimFocus();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && current === "player" && player) {
      wePaused = true;
      try {
        player.pauseVideo();
      } catch (e) {
      }
    }
    if (!document.hidden && current === "player") {
      reclaimFocus();
      showOSD(0);
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
  setInterval(warnTick, 1e3);
  window.addEventListener("popstate", () => {
    if (!TOUCH || current === "home") return;
    goBack();
    if (current !== "home") {
      try {
        history.pushState({ farja: 1 }, "");
      } catch (e) {
      }
    }
  });
  setInterval(() => {
    prayerTick();
    calmTick();
  }, 5e3);
  tickClock();
  setInterval(tickClock, 15e3);
  let wheelAt = 0;
  $("#home").addEventListener("wheel", (e) => {
    if (Date.now() - wheelAt < 250 || current !== "home") return;
    wheelAt = Date.now();
    e.preventDefault();
    const a = document.activeElement;
    if (!a || !a.closest("#home-rows")) {
      focusHome(true);
      return;
    }
    moveFocus(e.deltaY > 0 ? "down" : "up");
  });
  window.addEventListener("beforeunload", () => {
    saveLog();
    if (usage) saveUsage();
  });
  $("#sr-input").addEventListener("input", (e) => {
    srQuery = e.target.value;
    clearTimeout(srT);
    srT = setTimeout(renderSearch, 160);
  });
  listenRemote();
  setInterval(() => {
    if (REMOTE_ON && Date.now() - sseAliveAt > 15e4) listenRemote();
  }, 3e4);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      listenRemote();
      remoteNotify(true);
    }
  });
  show("home");
  start();
  if (locked) setLocked(true, lockMsg);
  if (!DEMO && (CFG.apiKey || CFG.api)) loadYTApi().catch(() => {
  });
}
function start() {
  lastListLoad = Date.now();
  channelsLoading = true;
  renderHome();
  focusEl($("#parent-btn"));
  renderKidChip();
  loadChannels().then(() => {
    renderHome();
    if (current === "home") {
      if (kids.length >= 2 && !locked) openKids();
      else focusHome(true);
    }
    return refreshHomeData().then(() => setTimeout(() => buildIndex(), 8e3));
  });
}
init();
