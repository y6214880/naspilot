'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

const cache = new Map();
const TTL = 20 * 1000;

function fetchOnce(url, timeout = 2500) {
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    const done = (payload) => {
      if (settled) return;
      settled = true;
      resolve({ ...payload, ms: Date.now() - started });
    };

    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return done({ ok: false, code: 0, error: 'URL 格式错误', title: '' });
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout,
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'NasPilot/1.0', Accept: 'text/html,*/*' }
      },
      (res) => {
        let body = '';
        const limit = 32 * 1024;
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (body.length < limit) body += chunk;
        });
        res.on('end', () => {
          const titleMatch = body.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i);
          done({
            ok: res.statusCode < 500,
            code: res.statusCode,
            title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '',
            contentType: String(res.headers['content-type'] || ''),
            location: String(res.headers.location || ''),
            server: String(res.headers.server || ''),
            html: body.slice(0, 2000)
          });
        });
        res.on('error', () => done({ ok: false, code: res.statusCode || 0, title: '' }));
      }
    );

    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => done({ ok: false, code: 0, error: err.code || 'error', title: '' }));
    req.end();
  });
}

async function probe(url, { force = false, timeout = 2500 } = {}) {
  if (!url) return { ok: false, ms: 0, code: 0, error: '未配置地址' };
  const hit = cache.get(url);
  if (!force && hit && Date.now() - hit.at < TTL) return hit;
  const result = await fetchOnce(url, timeout);
  const record = { ...result, at: Date.now() };
  if (result.code !== 0) cache.set(url, record);
  return record;
}

async function probeMany(urls, concurrency = 6) {
  const out = {};
  const queue = [...urls];
  async function worker() {
    while (queue.length) {
      const { id, url } = queue.shift();
      try {
        const r = await probe(url);
        out[id] = { ok: r.ok, ms: r.ms, code: r.code, error: r.error || '' };
      } catch (e) {
        out[id] = { ok: false, ms: 0, code: 0, error: e.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
  return out;
}

module.exports = { probe, probeMany, fetchOnce };
