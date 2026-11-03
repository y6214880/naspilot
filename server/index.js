'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const claims = require('./claims');
const { guessGroup } = require('./store');
const docker = require('./docker');
const sync = require('./sync');
const discover = require('./discover');
const probe = require('./probe');
const monitor = require('./monitor');
const icon = require('./icon');
const auth = require('./auth');

const PORT = Number(process.env.PORT || 8899);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const VERSION = (require(path.join(__dirname, '..', 'package.json')).version) || '0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

let lastDiscover = { at: 0, count: 0, services: [] };

function publicSettings(s) {
  const { passcode, ...rest } = s || {};
  return rest;
}

function clientIp(req) {
  return String(req.socket.remoteAddress || '');
}

function json(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('JSON 解析失败'));
      }
    });
    req.on('error', reject);
  });
}

function hostOf(req, settings) {
  if (settings.hostOverride) return settings.hostOverride.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const raw = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return String(raw).split(':')[0];
}

const TLS_PORTS = new Set([443, 5667, 6443, 8006, 8443, 9443]);

function normalizeUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  if (v.startsWith('//')) return 'http:' + v;
  const m = v.match(/^[^/?#:]+:(\d{1,5})(?:[/?#]|$)/);
  const port = m ? Number(m[1]) : 80;
  return (TLS_PORTS.has(port) ? 'https://' : 'http://') + v;
}

const LOOPBACK_HOST = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|host\.docker\.internal|\[::1\])(:\d+)?(\/|$)/i;

function resolveUrl(app, host) {
  const raw = String(app.url || '').trim();
  const loop = LOOPBACK_HOST.test(raw);
  if ((!raw || loop) && app.port && host) {
    const scheme = /^https:/i.test(raw) ? 'https' : app.scheme === 'https' ? 'https' : 'http';
    return rehost(raw, host, app.port, scheme);
  }
  if (loop) return '';
  return normalizeUrl(raw);
}

function publicApp(app, host, lastVisit) {
  return {
    id: app.id,
    name: app.name,
    desc: app.desc || '',
    url: resolveUrl(app, host),
    icon: app.icon || '',
    groupId: app.groupId || 'other',
    tags: app.tags || [],
    pinned: !!app.pinned,
    hidden: !!app.hidden,
    source: app.source || 'manual',
    containerId: app.containerId || '',
    containerName: app.containerName || '',
    state: app.state || '',
    port: app.port || null,
    missing: !!app.missing,
    order: app.order || 0,
    lastVisit: lastVisit[app.id] || 0,
    clicks: 0,
    canControl: app.source === 'docker' && !!app.containerId
  };
}

function isAutoApp(a) {
  if (a.source === 'manual' && a.autoName !== true) return false;
  return true;
}

function sameService(a, b) {
  if (a.id === b.id) return false;
  if (a.port && b.port && Number(a.port) === Number(b.port) && claims.urlPath(a.url) === claims.urlPath(b.url)) return true;
  const na = claims.normName(a.name);
  const nb = claims.normName(b.name);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const short = na.length <= nb.length ? na : nb;
  const long = short === na ? nb : na;
  return short.length >= 4 && long.includes(short);
}

function dedupeApps(cfg) {
  let changed = false;
  const kept = [];
  for (const a of cfg.apps) {
    const idx = kept.findIndex((k) => sameService(k, a));
    if (idx < 0) { kept.push(a); continue; }
    const k = kept[idx];
    const aManual = a.autoName === false;
    const kManual = k.autoName === false;
    if (aManual && !kManual) { kept[idx] = a; changed = true; continue; }
    if (!aManual && kManual) { changed = true; continue; }
    if (aManual && kManual) { kept.push(a); continue; }
    const aDocker = a.source === 'docker';
    const kDocker = k.source === 'docker';
    if (aDocker && !kDocker) { kept[idx] = a; changed = true; continue; }
    if (!aDocker && kDocker) { changed = true; continue; }
    if ((Number(a.port) || 99999) < (Number(k.port) || 99999)) { kept[idx] = a; changed = true; continue; }
    changed = true;
  }
  cfg.apps = kept;
  return changed;
}

function autoCleanDiscovered(cfg, host) {
  let changed = false;
  cfg.apps = cfg.apps.filter((a) => {
    if (a.deleted) return true;
    if (!a.port) {
      const guess = claims.portFromUrl(a.url);
      if (guess) {
        a.port = guess;
        changed = true;
      }
    }
    if (a.source === 'docker' && a.autoName !== false && /nasp[il]+ot/i.test(a.name)) {
      changed = true;
      return false;
    }
    if (a.autoName === false) return true;
    if (discover.isJunkTitle(a.name)) {
      const autoLike = isAutoApp(a) || !a.url;
      if (autoLike) {
        changed = true;
        return false;
      }
      return true;
    }
    if (a.port && host && (!a.url || LOOPBACK_HOST.test(a.url) || a.urlFromDocker)) {
      const fixed = rehost(a.url, host, a.port, /^https:/i.test(a.url) ? 'https' : a.scheme || 'http');
      if (fixed !== a.url) {
        a.url = fixed;
        changed = true;
      }
    }
    if (a.source !== 'manual' && a.groupManual !== true && (!a.groupId || a.groupId === 'other')) {
      const g = guessGroup(a.name, a.desc);
      if (g && g !== a.groupId) {
        a.groupId = g;
        changed = true;
      }
    }
    return true;
  });
  if (dedupeApps(cfg)) changed = true;
  return changed;
}

function stateSnapshot(req) {
  const cfg = store.load();
  const host = hostOf(req, cfg.settings);
  if (autoCleanDiscovered(cfg, host)) store.save();
  const lastVisit = store.lastVisitMap();
  const clicks = cfg.stats.clicks || {};
  const apps = cfg.apps
    .filter((a) => !a.deleted)
    .map((a, i) => {
      const out = publicApp(a, host, lastVisit);
      out.clicks = clicks[a.id] || 0;
      out.order = typeof a.order === 'number' ? a.order : i;
      return out;
    })
    .sort((a, b) => a.order - b.order);

  return {
    version: VERSION,
    author: '小余',
    qq: '6214880',
    host,
    settings: publicSettings(cfg.settings),
    hasPass: !!cfg.settings.passcode,
    groups: [...cfg.groups].sort((a, b) => (a.order || 0) - (b.order || 0)),
    apps,
    docker: {
      enabled: cfg.settings.dockerEnabled,
      lastSync: cfg.meta.lastSync || 0,
      running: apps.filter((a) => a.source === 'docker' && !a.missing && a.state === 'running').length,
      total: apps.filter((a) => a.source === 'docker' && !a.missing).length
    },
    discover: {
      at: lastDiscover.at,
      count: claims.countUnclaimed(cfg.apps, lastDiscover.services)
    }
  };
}

function pageAddress(rawHost, port, scheme) {
  const host = String(rawHost || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim();
  const s = scheme === 'https' ? 'https' : 'http';
  const keepPort = !((s === 'http' && port === 80) || (s === 'https' && port === 443));
  return `${s}://${host}${keepPort ? ':' + port : ''}/`;
}

const SYS_APPS = [
  {
    name: '相册',
    group: 'media',
    keys: /相册|照片|图片|影像|photo|album|gallery/i,
    paths: ['/p', '/photos', '/photo', '/album', '/v/photos'],
    trusted: ['/p']
  },
  {
    name: '音乐',
    group: 'media',
    keys: /音乐|听歌|歌单|music|audio/i,
    paths: ['/music', '/v/music', '/audio'],
    trusted: ['/music']
  },
  {
    name: '文件',
    group: 'tool',
    keys: /文件|网盘|file|drive/i,
    paths: ['/files', '/v/files'],
    trusted: []
  }
];

async function probeSystemApps(port, hostname, baseTitle, scheme) {
  const sc = scheme === 'https' ? 'https' : 'http';
  const base = `${sc}://${hostname}:${port}`;
  const jobs = [];
  for (const app of SYS_APPS) for (const p of app.paths) jobs.push({ app, p });
  const hits = await Promise.all(
    jobs.map(async ({ app, p }) => {
      let r;
      try {
        r = await discover.fetchPage(base + p);
      } catch (e) {
        return null;
      }
      if (!r || !r.code || r.code >= 400) return null;
      const t = String(r.title || '').replace(/\s+/g, ' ').trim().slice(0, 28);
      if (!t || discover.isJunkTitle(t)) return null;
      const sameAsHome = !!baseTitle && t === baseTitle;
      let landed = p;
      try {
        landed = new URL(r.url).pathname.replace(/\/+$/, '') || '/';
      } catch (e) {
        landed = p;
      }
      const stayed = landed === p.replace(/\/+$/, '') || landed.startsWith(p.replace(/\/+$/, '') + '/');
      const trusted = (app.trusted || []).includes(p) && stayed && !sameAsHome;
      if (!trusted) {
        if (sameAsHome) return null;
        if (!app.keys.test(t)) return null;
      }
      return { name: app.name, group: app.group, path: p, scheme: sc, title: t };
    })
  );
  return SYS_APPS.map((app) => hits.find((h) => h && h.name === app.name)).filter(Boolean);
}

function rehost(raw, host, port, scheme) {
  const base = pageAddress(host, port, scheme);
  const sub = claims.urlPath(raw);
  return sub && sub !== '/' ? base.replace(/\/$/, '') + sub : base;
}

async function enrichDiscovered(cfg, result) {
  const known = new Set(
    cfg.apps.filter((a) => !a.deleted).map((a) => Number(a.port) || claims.portFromUrl(a.url)).filter(Boolean)
  );
  const knownNames = new Set(cfg.apps.filter((a) => !a.deleted).map((a) => claims.normName(a.name)).filter(Boolean));
  const merged = [];
  const byTitle = new Map();
  for (const s of result.services) {
    const key = String(s.title || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!key) { merged.push({ ...s, claimed: known.has(s.port) }); continue; }
    const hit = byTitle.get(key);
    if (!hit) {
      const item = { ...s, ports: [s.port], claimed: known.has(s.port) };
      byTitle.set(key, item);
      merged.push(item);
      continue;
    }
    hit.ports.push(s.port);
    if (Number(s.ms) < Number(hit.ms)) {
      hit.port = s.port;
      hit.ms = s.ms;
      hit.code = s.code;
    }
    hit.claimed = hit.claimed && known.has(s.port);
  }
  const services = merged;
  services.forEach((s) => {
    const byPort = (s.ports || [s.port]).some((p) => known.has(p));
    const key = claims.normName(s.title);
    s.claimed = byPort || (!!key && knownNames.has(key));
  });
  const FNOS_NAME = /飞牛|fnos|fnnas/i;
  const knownFnos = cfg.apps.find((a) => !a.deleted && a.port && FNOS_NAME.test(a.name));
  const fnos =
    services.find((s) => FNOS_NAME.test(s.title || '')) ||
    (knownFnos ? { port: knownFnos.port, title: knownFnos.name, scheme: knownFnos.scheme } : null);
  if (fnos) {
    let subs = [];
    try {
      const sc = fnos.scheme || (/^https:/i.test(fnos.url || '') ? 'https' : 'http');
      subs = await probeSystemApps(fnos.port, result.probeHost, fnos.title, sc);
    } catch (e) {
      subs = [];
    }
    for (const sub of subs) {
      const subPath = sub.path.replace(/\/+$/, '') || '/';
      const taken = cfg.apps.some((a) => !a.deleted && claims.urlPath(a.url) === subPath);
      if (taken) continue;
      services.push({
        port: fnos.port,
        url: `${sub.scheme}://${result.probeHost}:${fnos.port}${sub.path}`,
        ok: true,
        code: 200,
        ms: 0,
        title: sub.name,
        path: sub.path,
        scheme: sub.scheme,
        group: sub.group,
        ports: [fnos.port],
        sub: true,
        claimed: false
      });
    }
  }
  return services;
}

async function collectDiscovered(rawHost) {
  const cfg = store.load();
  const st = cfg.settings;
  const usedPorts = cfg.apps.filter((a) => !a.deleted).map((a) => Number(a.port) || claims.portFromUrl(a.url)).filter(Boolean);
  const result = await discover.scan(st.hostProc, {
    host: st.hostOverride || 'host.docker.internal',
    override: st.hostOverride || '',
    exclude: [...usedPorts, PORT]
  });
  if (!result.readable || result.selfOnly) {
    return {
      ok: false,
      added: 0,
      error: result.selfOnly
        ? '只读到容器自己的端口，宿主机 /proc 没挂对（compose 需要 - /proc:/host/proc:ro）'
        : '读不到宿主机端口表，检查 /proc 挂载'
    };
  }
  const used = new Set(usedPorts);
  const seenNames = new Set(cfg.apps.map((a) => claims.normName(a.name)).filter((n) => n.length >= 4));
  const now = Date.now();
  let added = 0;
  const services = await enrichDiscovered(cfg, result);
  for (const item of services) {
    const title = (item.title || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    if (!title || /nasp[il]+ot/i.test(title)) continue;
    const itemPath = claims.urlPath(item.url) || '/';
    const subPath = itemPath !== '/';
    const dup = cfg.apps.some(
      (a) =>
        !a.deleted &&
        (Number(a.port) === Number(item.port) || claims.portFromUrl(a.url) === Number(item.port)) &&
        claims.urlPath(a.url) === itemPath
    );
    if (dup) continue;
    if (!subPath && used.has(item.port)) continue;
    const key = claims.normName(title);
    if (seenNames.has(key)) continue;
    const clash = [...seenNames].some((n) => n.length >= 4 && (key.includes(n) || n.includes(key)));
    if (clash) continue;
    seenNames.add(key);
    const name = title;
    const scheme = /^https:/i.test(item.url || '') ? 'https' : 'http';
    const pageHost = String(rawHost || '').split(':')[0] || st.hostOverride || '127.0.0.1';
    const base = pageAddress(pageHost, item.port, scheme).replace(/\/$/, '');
    cfg.apps.push({
      id: subPath ? `dc_${item.port}_${itemPath.replace(/\//g, '-').replace(/^-/, '')}` : `dc_${item.port}`,
      name,
      desc: subPath ? `自动发现 · 端口 ${item.port}${itemPath}` : `自动发现 · 端口 ${item.port}`,
      icon: '',
      url: subPath ? base + itemPath : pageAddress(pageHost, item.port, scheme),
      port: item.port,
      scheme,
      groupId: guessGroup(name),
      tags: [],
      pinned: false,
      hidden: false,
      source: 'discover',
      autoName: true,
      createdAt: now
    });
    used.add(item.port);
    added += 1;
  }
  if (added) {
    store.save();
    lastDiscover = { at: Date.now(), services: [] };
  }
  return { ok: true, added, scanned: result.scanned, ports: result.total, probeHost: result.probeHost };
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function handle(req, res, url) {
  const cfg = store.load();
  const method = req.method.toUpperCase();
  const p = url.pathname;
  const host = hostOf(req, cfg.settings);

  if (p === '/api/auth' && method === 'GET') {
    return json(res, 200, { enabled: !!cfg.settings.passcode, authed: auth.isAuthed(req, cfg.settings) });
  }

  if (p === '/api/auth' && method === 'POST') {
    if (!cfg.settings.passcode) return json(res, 400, { ok: false, error: '还没有设置访问密码' });
    const ip = clientIp(req);
    if (auth.tooMany(ip)) return json(res, 429, { ok: false, error: '试错次数太多，等一分钟再来' });
    const body = await readBody(req);
    if (!auth.verifyPass(String(body.password || ''), cfg.settings.passcode)) {
      auth.noteFail(ip);
      return json(res, 401, { ok: false, error: '密码不对' });
    }
    auth.clearFail(ip);
    res.setHeader('Set-Cookie', auth.cookieHeader(cfg.settings.passcode));
    return json(res, 200, { ok: true });
  }

  if (p === '/api/auth' && method === 'DELETE') {
    res.setHeader('Set-Cookie', auth.clearCookieHeader());
    return json(res, 200, { ok: true });
  }

  if (p === '/api/meta' && method === 'GET') {
    return json(res, 200, { name: 'NasPilot', version: VERSION, author: '小余', qq: '6214880', blog: 'https://www.52stu.com', node: process.version });
  }

  if (p.startsWith('/api/') && !auth.isAuthed(req, cfg.settings)) {
    return json(res, 401, { ok: false, error: '需要访问密码', locked: true });
  }

  if (p === '/api/passcode' && method === 'POST') {
    const body = await readBody(req);
    const pass = String(body.password == null ? '' : body.password);
    if (!pass) {
      delete cfg.settings.passcode;
      store.save(true);
      res.setHeader('Set-Cookie', auth.clearCookieHeader());
      return json(res, 200, { ok: true, enabled: false });
    }
    if (pass.length < 4) return json(res, 400, { ok: false, error: '密码至少 4 位' });
    if (pass.length > 64) return json(res, 400, { ok: false, error: '密码最多 64 位' });
    cfg.settings.passcode = auth.makePasscode(pass);
    store.save(true);
    res.setHeader('Set-Cookie', auth.cookieHeader(cfg.settings.passcode));
    return json(res, 200, { ok: true, enabled: true });
  }

  if (p === '/api/state' && method === 'GET') {
    return json(res, 200, stateSnapshot(req));
  }

  if (p === '/api/settings' && method === 'PATCH') {
    const body = await readBody(req);
    const keep = cfg.settings.passcode;
    cfg.settings = { ...cfg.settings, ...body };
    delete cfg.settings.wallpaper;
    if (keep) cfg.settings.passcode = keep;
    else delete cfg.settings.passcode;
    store.save(true);
    return json(res, 200, { ok: true, settings: publicSettings(cfg.settings) });
  }

  if (p === '/api/apps' && method === 'POST') {
    const body = await readBody(req);
    if (!body.name) return json(res, 400, { ok: false, error: '请填写名称' });
    const port = Number(body.port) || claims.portFromUrl(body.url) || null;
    const wantedPath = claims.urlPath(body.url);
    if (port && cfg.apps.some((a) => !a.deleted && Number(a.port) === port && claims.urlPath(a.url) === wantedPath)) {
      return json(res, 409, { ok: false, error: `端口 ${port} 已经收录过了` });
    }
    const app = {
      id: newId('app'),
      name: String(body.name).slice(0, 60),
      desc: String(body.desc || '').slice(0, 160),
      url: normalizeUrl(body.url),
      icon: String(body.icon || ''),
      groupId: body.groupId || guessGroup(body.name, body.desc),
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 6) : [],
      pinned: !!body.pinned,
      hidden: !!body.hidden,
      source: body.source || 'manual',
      order: cfg.apps.length,
      createdAt: Date.now()
    };
    if (port) {
      app.port = port;
      app.scheme = body.scheme || (/^https:/i.test(app.url) ? 'https' : 'http');
    }
    cfg.apps.push(app);
    store.save(true);
    return json(res, 200, { ok: true, app: publicApp(app, host, store.lastVisitMap()) });
  }

  const appMatch = p.match(/^\/api\/apps\/([\w-]+)$/);
  if (appMatch && appMatch[1] !== 'reorder') {
    const app = cfg.apps.find((a) => a.id === appMatch[1]);
    if (!app) return json(res, 404, { ok: false, error: '应用不存在' });
    if (method === 'PATCH') {
      const body = await readBody(req);
      const fields = ['name', 'desc', 'url', 'icon', 'groupId', 'tags', 'pinned', 'hidden'];
      for (const f of fields) {
        if (body[f] !== undefined) app[f] = body[f];
      }
      if (body.name !== undefined) app.autoName = false;
      if (body.desc !== undefined) app.autoDesc = false;
      if (body.url !== undefined) {
        app.urlFromDocker = false;
        const p = claims.portFromUrl(body.url);
        if (p) app.port = p;
      }
      if (body.groupId !== undefined) app.groupManual = true;
      store.save(true);
      return json(res, 200, { ok: true, app: publicApp(app, host, store.lastVisitMap()) });
    }
    if (method === 'DELETE') {
      store.removeApp(app.id);
      return json(res, 200, { ok: true });
    }
  }

  if (p === '/api/apps/reorder' && method === 'POST') {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    ids.forEach((id, i) => {
      const app = cfg.apps.find((a) => a.id === id);
      if (app) app.order = i;
    });
    store.save(true);
    return json(res, 200, { ok: true });
  }

  if (p === '/api/groups' && method === 'POST') {
    const body = await readBody(req);
    if (!body.name) return json(res, 400, { ok: false, error: '请填写分组名' });
    const group = { id: newId('g'), name: String(body.name).slice(0, 20), order: cfg.groups.length };
    cfg.groups.push(group);
    store.save(true);
    return json(res, 200, { ok: true, group });
  }

  const groupMatch = p.match(/^\/api\/groups\/([\w-]+)$/);
  if (groupMatch) {
    const gid = groupMatch[1];
    const group = cfg.groups.find((g) => g.id === gid);
    if (!group) return json(res, 404, { ok: false, error: '分组不存在' });
    if (method === 'PATCH') {
      const body = await readBody(req);
      if (body.name) group.name = String(body.name).slice(0, 20);
      if (typeof body.order === 'number') group.order = body.order;
      store.save(true);
      return json(res, 200, { ok: true, group });
    }
    if (method === 'DELETE') {
      if (cfg.groups.length <= 1) return json(res, 400, { ok: false, error: '至少保留一个分组' });
      cfg.groups = cfg.groups.filter((g) => g.id !== gid);
      const fallback = cfg.groups[0].id;
      cfg.apps.forEach((a) => {
        if (a.groupId === gid) a.groupId = fallback;
      });
      store.save(true);
      return json(res, 200, { ok: true });
    }
  }

  if (p === '/api/docker/sync' && method === 'POST') {
    const result = await sync.sync(cfg, host);
    return json(res, 200, { ...result, state: stateSnapshot(req) });
  }

  if (p === '/api/docker/containers' && method === 'GET') {
    try {
      const list = await docker.list(cfg.settings.dockerSocket);
      return json(res, 200, { ok: true, containers: list });
    } catch (err) {
      return json(res, 200, { ok: false, error: err.message, containers: [] });
    }
  }

  const dockerAct = p.match(/^\/api\/docker\/([\w-]+)\/(start|stop|restart)$/);
  if (dockerAct && method === 'POST') {
    if (!cfg.settings.dockerControl) return json(res, 403, { ok: false, error: '未开启容器控制' });
    const app = cfg.apps.find((a) => a.id === dockerAct[1]);
    if (!app || !app.containerId) return json(res, 404, { ok: false, error: '找不到容器' });
    try {
      await docker.action(cfg.settings.dockerSocket, app.containerId, dockerAct[2]);
      await new Promise((r) => setTimeout(r, 600));
      await sync.sync(cfg, host);
      return json(res, 200, { ok: true, state: stateSnapshot(req) });
    } catch (err) {
      return json(res, 500, { ok: false, error: err.message || '操作失败' });
    }
  }

  if (p === '/api/maintenance/clean' && method === 'POST') {
    const before = cfg.apps.length;
    const removed = [];
    const fixed = [];
    cfg.apps = cfg.apps.filter((a) => {
      if (a.source !== 'discover') return true;
      if (discover.isJunkTitle(a.name)) {
        removed.push(a.name);
        return false;
      }
      if (!a.url && a.port) {
        a.url = pageAddress(host, a.port, a.scheme || 'http');
        fixed.push(a.name);
      }
      return true;
    });
    if (removed.length || fixed.length) store.save();
    return json(res, 200, {
      ok: true,
      removed: removed.length,
      fixed: fixed.length,
      names: removed.slice(0, 8),
      total: cfg.apps.length,
      before
    });
  }

  if (p === '/api/discover/collect' && method === 'POST') {
    try {
      const body = await readBody(req).catch(() => ({}));
      const r = await collectDiscovered(body.host || host);
      return json(res, 200, r);
    } catch (err) {
      return json(res, 500, { ok: false, error: err.message || '收录失败' });
    }
  }

  if (p === '/api/discover' && method === 'GET') {
    if (!cfg.settings.discoverEnabled) {
      return json(res, 200, { ok: false, error: '未启用端口发现', services: [], silent: [], count: 0 });
    }
    const usedPorts = cfg.apps.filter((a) => !a.deleted).map((a) => Number(a.port) || claims.portFromUrl(a.url)).filter(Boolean);
    const result = await discover.scan(cfg.settings.hostProc, {
      host: host,
      exclude: [...usedPorts, PORT]
    });
    if (!result.readable || result.selfOnly) {
      return json(res, 200, {
        ok: false,
        error: result.readable
          ? `只读到 NasPilot 容器自己的端口（${result.source}）。宿主机 /proc 没挂对：确认 compose 有 - /proc:/host/proc:ro，或在设置里改挂载路径。`
          : `读不到宿主机端口表（${result.source}）。请确认 compose 已把 /proc 挂到 /host/proc，或在设置里改挂载路径。`,
        readable: false,
        selfOnly: !!result.selfOnly,
        source: result.source,
        services: [],
        silent: [],
        scanned: 0,
        count: lastDiscover.count
      });
    }
    const services = await enrichDiscovered(cfg, result);
    lastDiscover = { at: Date.now(), count: 0, services };
    lastDiscover.count = claims.countUnclaimed(cfg.apps, lastDiscover.services);
    return json(res, 200, { ok: result.readable, ...result, services, count: lastDiscover.count });
  }

  if (p === '/api/monitor' && method === 'GET') {
    if (cfg.settings.monitorEnabled === false) {
      return json(res, 200, { ok: false, disabled: true, error: '未启用系统监控' });
    }
    const d = await monitor.get(cfg.settings.hostProc, cfg.settings.hostRoot);
    return json(res, 200, d);
  }

  if (p === '/api/health' && method === 'GET') {
    const ids = String(url.searchParams.get('ids') || '').split(',').filter(Boolean);
    const targets = cfg.apps
      .filter((a) => !a.hidden && (ids.length ? ids.includes(a.id) : true))
      .map((a) => ({ id: a.id, url: resolveUrl(a, host) }))
      .filter((t) => t.url);
    const health = await probe.probeMany(targets);
    return json(res, 200, { ok: true, at: Date.now(), health });
  }

  const visitMatch = p.match(/^\/api\/visit\/([\w-]+)$/);
  if (visitMatch && method === 'POST') {
    store.recordVisit(visitMatch[1]);
    return json(res, 200, { ok: true });
  }

  if (p === '/api/stats' && method === 'GET') {
    const cfg2 = store.load();
    const clicks = cfg2.stats.clicks || {};
    const visits = cfg2.stats.visits || [];
    const now = new Date();
    const range = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = d.getTime();
      range.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        start,
        count: 0,
        apps: new Map()
      });
    }
    const nameOf = new Map(cfg2.apps.map((a) => [a.id, a.name]));
    const first = range[0].start;
    for (const v of visits) {
      const t = Number(v.t);
      let idx = Math.floor((t - first) / 86400000);
      if (!Number.isFinite(idx)) continue;
      if (idx < 0) idx = 0;
      if (idx > range.length - 1) idx = range.length - 1;
      while (idx < range.length - 1 && t >= range[idx].start + 86400000) idx += 1;
      while (idx > 0 && t < range[idx].start) idx -= 1;
      const slot = range[idx];
      if (t < slot.start || t >= slot.start + 86400000) continue;
      const name = nameOf.get(v.id) || '已删除的入口';
      slot.count += 1;
      slot.apps.set(name, (slot.apps.get(name) || 0) + 1);
    }
    const days = range.map((d) => ({
      label: d.label,
      date: d.date,
      count: d.count,
      apps: [...d.apps.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }))
    }));
    const top = cfg2.apps
      .map((a) => ({ id: a.id, name: a.name, count: clicks[a.id] || 0 }))
      .filter((a) => a.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    return json(res, 200, {
      ok: true,
      total: visits.length,
      today: visits.filter((v) => v.t >= new Date().setHours(0, 0, 0, 0)).length,
      days,
      top
    });
  }

  if (p === '/api/export' && method === 'GET') {
    const body = JSON.stringify(cfg, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="naspilot-backup-${new Date().toISOString().slice(0, 10)}.json"`
    });
    return res.end(body);
  }

  if (p === '/api/import' && method === 'POST') {
    const body = await readBody(req);
    if (!body || !Array.isArray(body.apps)) return json(res, 400, { ok: false, error: '备份文件格式不正确' });
    const merged = store.normalize(body);
    Object.assign(cfg, merged);
    store.save(true);
    return json(res, 200, { ok: true, count: merged.apps.length });
  }

  if (p === '/api/icon' && method === 'GET') {
    const origin = icon.originOf(url.searchParams.get('u'));
    if (!origin) return json(res, 400, { ok: false, error: '地址不合法' });
    const refresh = url.searchParams.get('r') === '1';
    const hit = await icon.fetchIcon(origin, { refresh });
    if (!hit) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end('');
    }
    res.writeHead(200, {
      'Content-Type': hit.type,
      'Content-Length': hit.buf.length,
      'Cache-Control': 'public, max-age=3600'
    });
    return res.end(hit.buf);
  }

  if (p === '/api/ping' && method === 'POST') {
    const body = await readBody(req);
    const target = String(body.url || '').trim();
    if (!target) return json(res, 400, { ok: false, error: '先填写地址' });
    const r = await probe.probe(target, { force: true, timeout: 6000 });
    return json(res, 200, {
      ok: !!r.ok,
      code: r.code || 0,
      ms: r.ms || 0,
      error: r.error || '',
      title: r.title || '',
      contentType: r.contentType || ''
    });
  }

  if (p === '/api/icons/clear' && method === 'POST') {
    icon.clearCache();
    return json(res, 200, { ok: true });
  }

  console.log(`[404] ${method} ${p}`);
  return json(res, 404, { ok: false, error: '接口不存在' });
}

function serveStatic(req, res, url) {
  const reqPath = url.pathname === '/favicon.ico' ? '/favicon.svg' : url.pathname;
  let filePath = path.join(PUBLIC_DIR, reqPath === '/' ? 'index.html' : decodeURIComponent(reqPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  const isHtml = ext === '.html';
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': isHtml || path.basename(filePath) === 'sw.js' ? 'no-cache' : 'public, max-age=600'
  });
  if (isHtml) {
    const html = fs.readFileSync(filePath, 'utf8');
    res.end(html.split('__VERSION__').join(VERSION));
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    try {
      await handle(req, res, url);
    } catch (err) {
      console.error('[api]', url.pathname, err.message);
      if (!res.headersSent) json(res, 500, { ok: false, error: err.message });
    }
    return;
  }
  try {
    serveStatic(req, res, url);
  } catch (err) {
    res.writeHead(500);
    res.end('Error');
  }
});

server.listen(PORT, HOST, () => {
  const cfg = store.load();
  const host0 = cfg.settings.hostOverride || '';
  if (autoCleanDiscovered(cfg, host0)) store.save();
  console.log('');
  console.log('  NasPilot  v' + VERSION + '   作者：小余  QQ 6214880');
  console.log('  ─────────────────────────────');
  console.log(`  面板地址   http://<本机IP>:${PORT}`);
  console.log(`  数据目录   ${store.DATA_DIR}`);
  console.log(`  Docker     ${cfg.settings.dockerEnabled ? cfg.settings.dockerSocket : '未启用'}`);
  console.log('');

  if (cfg.settings.autoDiscover && cfg.settings.discoverEnabled) {
    setTimeout(() => {
      collectDiscovered()
        .then((r) => {
          if (r.added) console.log(`  自动发现   新增 ${r.added} 个服务（${r.scanned} 个端口已探测）`);
        })
        .catch(() => {});
    }, 15000);
    const minutes = Number(cfg.settings.discoverInterval) || 0;
    if (minutes > 0) {
      setInterval(() => {
        collectDiscovered().catch(() => {});
      }, Math.max(5, minutes) * 60000);
    }
  }
});
