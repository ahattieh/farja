// صندوق الفرجة — private relay between the TV and the parents' phone.
// One Durable Object per pairing code ("room"). Free Cloudflare plan is enough.
//   POST /r/<room>/c            body = command JSON     -> queued for the TV
//   GET  /r/<room>/c?after=N    long-poll new commands   (after=-1 -> just the current number)
//   POST /r/<room>/b/<key>      body = JSON              -> latest value for key (s = status, r = report)
//   GET  /r/<room>/b/<key>?since=T  long-poll a value newer than T
//   GET  /r/<room>/ws?role=tv|phone  WebSocket: commands pushed to the TV, status pushed to phones.
//        The room hibernates between messages, so an open app costs no Durable Object time.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, CORS) });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const p = url.pathname.split('/').filter(Boolean);
    if (p[0] !== 'r' || !/^[a-z0-9]{16,40}$/.test(p[1] || '')) return json({ ok: true, app: 'farja-relay' });
    const stub = env.ROOM.get(env.ROOM.idFromName(p[1]));
    const res = await stub.fetch(req);
    return res;
  },
};

export class Room {
  constructor(state) {
    this.state = state;
    this.loaded = false;
    this.cmds = [];
    this.seq = 0;
    this.boxes = {};
    this.waitC = [];
    this.waitB = {};
    // keepalive pings are answered without waking the room
    try { state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch (e) {}
  }
  broadcast(tag, msg) {
    const s = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets(tag)) {
      try { ws.send(s); } catch (e) {}
    }
  }
  openSocket(url) {
    const role = url.searchParams.get('role') === 'tv' ? 'tv' : 'phone';
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, [role]);
    if (role === 'tv') {
      const after = +url.searchParams.get('after');
      server.send(JSON.stringify({ type: 'c', seq: this.seq, cmds: after >= 0 ? this.cmds.filter((c) => c.seq > after) : [] }));
    } else if (this.boxes.s) {
      server.send(JSON.stringify({ type: 'b', key: 's', t: this.boxes.s.t, data: this.boxes.s.data }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage() {}
  webSocketClose(ws, code) {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch (e) {}
  }
  webSocketError() {}
  async load() {
    if (this.loaded) return;
    const m = await this.state.storage.get(['cmds', 'seq', 'boxes']);
    this.cmds = m.get('cmds') || [];
    this.seq = m.get('seq') || 0;
    this.boxes = m.get('boxes') || {};
    this.loaded = true;
  }
  wait(list, sec) {
    return new Promise((res) => {
      const t = setTimeout(() => { const i = list.indexOf(res); if (i >= 0) list.splice(i, 1); res(); }, sec * 1000);
      list.push(() => { clearTimeout(t); res(); });
    });
  }
  async fetch(req) {
    await this.load();
    const url = new URL(req.url);
    const p = url.pathname.split('/').filter(Boolean);
    const wait = Math.max(0, Math.min(25, +url.searchParams.get('wait') || 0));
    if (p[2] === 'ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 426);
      return this.openSocket(url);
    }
    if (p[2] === 'c') {
      if (req.method === 'POST') {
        const data = (await req.text()).slice(0, 4000);
        this.seq++;
        const cmd = { seq: this.seq, data, t: Date.now() };
        this.cmds.push(cmd);
        this.cmds = this.cmds.filter((c) => Date.now() - c.t < 5 * 60 * 1000).slice(-30);
        await this.state.storage.put({ cmds: this.cmds, seq: this.seq });
        this.waitC.splice(0).forEach((f) => f());
        this.broadcast('tv', { type: 'c', seq: this.seq, cmds: [cmd] });
        return json({ ok: true, seq: this.seq });
      }
      const after = +url.searchParams.get('after');
      if (!(after >= 0)) return json({ seq: this.seq, cmds: [] });
      let out = this.cmds.filter((c) => c.seq > after);
      if (!out.length && wait) {
        await this.wait(this.waitC, wait);
        out = this.cmds.filter((c) => c.seq > after);
      }
      return json({ seq: this.seq, cmds: out });
    }
    if (p[2] === 'b' && /^[a-z]{1,8}$/.test(p[3] || '')) {
      const key = p[3];
      const list = this.waitB[key] || (this.waitB[key] = []);
      if (req.method === 'POST') {
        const data = (await req.text()).slice(0, 16000);
        this.boxes[key] = { t: Date.now(), data };
        await this.state.storage.put('boxes', this.boxes);
        list.splice(0).forEach((f) => f());
        this.broadcast('phone', { type: 'b', key, t: this.boxes[key].t, data });
        return json({ ok: true });
      }
      const since = +url.searchParams.get('since') || 0;
      let b = this.boxes[key];
      if ((!b || b.t <= since) && wait) {
        await this.wait(list, wait);
        b = this.boxes[key];
      }
      return json(b && b.t > since ? b : { t: 0 });
    }
    return json({ error: 'not found' }, 404);
  }
}
