'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');
const { DATA_DIR } = require('./store');

const DIR = path.join(DATA_DIR, 'icons');
const MAX_BYTES = 200 * 1024;
const MAX_AGE = 24 * 3600 * 1000;
const FAIL_AGE = 5 * 60 * 1000;
const TIMEOUT = 3000;
const CONCURRENCY = 4;

let active = 0;
const queue = [];

function keyOf(origin) {
  return crypto.createHash('sha1').update(origin).digest('hex');
}

function readCache(origin) {
  try {
    const p = paths(origin);
    const st = fs.statSync(p.bin);
    if (Date.now() - st.mtimeMs > MAX_AGE) return null;
    const meta = JSON.parse(fs.readFileSync(p.meta, 'utf8'));
    return { buf: fs.readFileSync(p.bin), type: meta.type || 'image/x-icon' };
  } catch (e) {
    return null;
  }
}

function readFail(origin) {
  try {
    const p = paths(origin);
    const st = fs.statSync(p.fail);
    if (Date.now() - st.mtimeMs > FAIL_AGE) return null;
    return {};
  } catch (e) {
    return null;
  }
}
function writeFail(origin) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const p = paths(origin);
    fs.writeFileSync(p.fail, String(Date.now()));
  } catch (e) {}
}

function paths(origin) {
  const k = keyOf(origin);
  return { bin: path.join(DIR, k + '.bin'), meta: path.join(DIR, k + '.json'), fail: path.join(DIR, k + '.fail') };
}

function writeCache(origin, buf, type) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const p = paths(origin);
    fs.writeFileSync(p.bin, buf);
    fs.writeFileSync(p.meta, JSON.stringify({ type, at: Date.now() }));
  } catch (e) {}
}

function download(url) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return resolve(null);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return resolve(null);

    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname,
        method: 'GET',
        timeout: TIMEOUT,
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'NasPilot/1.0', Accept: 'image/*' }
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return done(null);
        }
        const type = String(res.headers['content-type'] || '').split(';')[0].trim();
        if (!/^image\//i.test(type)) {
          res.resume();
          return done(null);
        }
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            return done(null);
          }
          chunks.push(c);
        });
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (!buf.length) return done(null);
          done({ buf, type });
        });
        res.on('error', () => done(null));
      }
    );
    req.on('timeout', () => {
      req.destroy();
      done(null);
    });
    req.on('error', () => done(null));
    req.end();
  });
}

function run(task) {
  return new Promise((resolve) => {
    const go = () => {
      active++;
      task()
        .then(resolve, () => resolve(null))
        .finally(() => {
          active--;
          const next = queue.shift();
          if (next) next();
        });
    };
    if (active < CONCURRENCY) go();
    else queue.push(go);
  });
}

function dropCache(origin) {
  try {
    const p = paths(origin);
    fs.rmSync(p.bin, { force: true });
    fs.rmSync(p.meta, { force: true });
    fs.rmSync(p.fail, { force: true });
  } catch (e) {}
}

async function fetchIcon(origin, { refresh = false } = {}) {
  if (refresh) dropCache(origin);
  else {
    const hit = readCache(origin);
    if (hit) return hit;
    if (readFail(origin)) return null;
  }
  const out = await run(() => download(origin + '/favicon.ico'));
  if (!out) {
    writeFail(origin);
    return null;
  }
  writeCache(origin, out.buf, out.type);
  return out;
}

function originOf(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch (e) {
    return '';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  return u.origin;
}

function clearCache() {
  try {
    for (const f of fs.readdirSync(DIR)) fs.unlinkSync(path.join(DIR, f));
  } catch (e) {}
}

module.exports = { fetchIcon, originOf, clearCache, dropCache };
