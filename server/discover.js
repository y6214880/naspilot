'use strict';

const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { fetchOnce } = require('./probe');
const { NON_WEB } = require('./docker');

const SKIP_PORTS = new Set([
  ...NON_WEB,
  1, 7, 9, 19, 23, 123, 135, 137, 138, 161, 389, 427, 631, 873, 1900, 5353, 5355, 6000, 6611, 9001, 9091
]);

const WEB_HINTS = new Set([
  80, 443, 3000, 4000, 4200, 5000, 5173, 5666, 7000, 7860, 8000, 8008, 8080, 8081, 8088, 8090,
  8096, 8123, 8181, 8200, 8443, 8880, 8888, 8899, 8989, 9000, 9090, 9080, 10000, 15672, 32400
]);

function procBases(hostProc) {
  const base = hostProc || '/host/proc';
  return [
    path.join(base, '1'),
    base,
    '/proc'
  ];
}

function parseProc(file, found) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return false;
  }
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(/\s+/);
    if (cols.length < 4) continue;
    const local = cols[1];
    if (cols[3] !== '0A') continue;
    const portHex = local.split(':')[1];
    if (!portHex) continue;
    const port = parseInt(portHex, 16);
    if (!port || port > 65535) continue;
    if (SKIP_PORTS.has(port)) continue;
    found.add(port);
  }
  return true;
}

function scanListeningPorts(hostProc) {
  const bases = procBases(hostProc);
  const found = new Set();
  const sources = [];
  for (const b of bases) {
    let hit = false;
    hit = parseProc(path.join(b, 'net', 'tcp'), found) || hit;
    hit = parseProc(path.join(b, 'net', 'tcp6'), found) || hit;
    if (hit) sources.push(b);
    if (hit && b.endsWith(path.sep + '1')) break;
  }
  return {
    ports: [...found].sort((a, b) => a - b),
    source: sources[0] || bases[0],
    sources,
    selfOnly: sources.length > 0 && sources.every((s2) => s2 === '/proc'),
    readable: found.size > 0
  };
}

let probeHostCache = null;
async function resolveProbeHost(host, override) {
  if (override) return override;
  if (probeHostCache) return probeHostCache;
  try {
    await dns.promises.lookup('host.docker.internal');
    probeHostCache = 'host.docker.internal';
    return probeHostCache;
  } catch (e) {
  }
  probeHostCache = host || '127.0.0.1';
  return probeHostCache;
}

function resetProbeHost() {
  probeHostCache = null;
}

const JUNK_TITLE =
  /^(?:[2-5]\d\d)(?:\s|$)|bad request|not found|forbidden|unauthorized|method not allowed|internal server error|bad gateway|gateway time-?out|service (?:unavailable|temporarily)|the plain http request|moved permanently|temporary redirect|permanent redirect|welcome to nginx|apache\d?(?: default page)?|test page for|iis windows server|default (?:web )?page|index of \/|it works!|site not found|nothing here|coming soon|error|无法访问|禁止访问|页面不存在|错误/i;

const TLS_PORTS = new Set([443, 8443, 9443, 6443, 8006]);

function cleanTitle(t) {
  return String(t || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function isJunkTitle(title) {
  const t = cleanTitle(title);
  if (t.length < 2) return true;
  return JUNK_TITLE.test(t);
}

async function fetchPage(url, depth = 0) {
  const r = await fetchOnce(url, 2000);
  const loc = r.location || '';
  if (r.code >= 300 && r.code < 400 && loc && depth < 2) {
    let next = '';
    try {
      next = new URL(loc, url).toString();
    } catch (e) {
      next = '';
    }
    if (next) return fetchPage(next, depth + 1);
  }
  return { ...r, url };
}

function shape(port, url, r) {
  const title = cleanTitle(r.title);
  const isHtml = /html/i.test(r.contentType || '') || /<html|<title/i.test(r.html || '');
  const ok = r.code > 0 && r.code < 400 && isHtml && !isJunkTitle(title);
  return {
    port,
    url,
    ok,
    code: r.code,
    ms: r.ms,
    title: ok ? title : '',
    junk: ok ? '' : title || (r.code ? `HTTP ${r.code}` : r.error || '无响应'),
    hint: (r.html || '').slice(0, 300)
  };
}

async function identify(port, host, scheme = '') {
  const hostname = host || '127.0.0.1';
  const first = scheme || (TLS_PORTS.has(port) ? 'https' : 'http');
  const base = (s) => `${s}://${hostname}:${port}/`;
  const r = await fetchPage(base(first));
  const tlsMismatch = r.code === 400 && /plain HTTP request/i.test(r.html || '');
  if (tlsMismatch || r.code === 0) {
    const other = first === 'https' ? 'http' : 'https';
    const r2 = await fetchPage(base(other));
    if (r2.code > 0 && r2.code < 400) return shape(port, base(other), r2);
  }
  return shape(port, base(first), r);
}

async function scan(hostProc, { host = '', exclude = [], limit = 64, override = '' } = {}) {
  const scanResult = scanListeningPorts(hostProc);
  const probeHost = await resolveProbeHost(host, override);
  const hosts = [...new Set([probeHost, override, '127.0.0.1'].filter(Boolean))];
  const skip = new Set([...exclude, ...SKIP_PORTS]);
  const candidates = scanResult.ports
    .filter((p) => !skip.has(p))
    .sort((a, b) => (WEB_HINTS.has(b) ? 1 : 0) - (WEB_HINTS.has(a) ? 1 : 0) || a - b)
    .slice(0, limit);
  const results = [];
  const queue = [...candidates];

  async function worker() {
    while (queue.length) {
      const port = queue.shift();
      for (const h of hosts) {
        try {
          const r = await identify(port, h);
          if (r.ok && r.code > 0) {
            results.push(r);
            break;
          }
          if (h === hosts[hosts.length - 1]) results.push(r);
        } catch (e) {
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, candidates.length || 1) }, worker));
  results.sort((a, b) => a.port - b.port);

  const web = results.filter((r) => r.ok && r.code > 0 && r.code !== 404);
  const unknown = results.filter((r) => !(r.ok && r.code > 0 && r.code !== 404));

  return {
    readable: scanResult.readable,
    selfOnly: scanResult.selfOnly,
    source: scanResult.source,
    sources: scanResult.sources,
    probeHost,
    total: scanResult.ports.length,
    scanned: results.length,
    services: web,
    silent: unknown
  };
}

module.exports = { scan, scanListeningPorts, identify, fetchPage, resolveProbeHost, resetProbeHost, isJunkTitle, SKIP_PORTS };
