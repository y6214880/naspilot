'use strict';

function urlPath(u) {
  const m = String(u || '').match(/^https?:\/\/[^/?#]+([^?#]*)/i);
  const p = m ? m[1] || '/' : '/';
  return p.replace(/\/+$/, '') || '/';
}

function portFromUrl(u) {
  const raw = String(u || '');
  const m = raw.match(/^https?:\/\/[^/?#]+?:(\d{1,5})(?:[/?#]|$)/i);
  if (m) {
    const n = Number(m[1]);
    return n > 0 && n <= 65535 ? n : 0;
  }
  if (/^https:\/\//i.test(raw)) return 443;
  if (/^http:\/\//i.test(raw)) return 80;
  const bare = raw.match(/^[^/?#:]+:(\d{1,5})(?:[/?#]|$)/);
  const n = bare ? Number(bare[1]) : 0;
  return n > 0 && n <= 65535 ? n : 0;
}

function normName(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[\s\-_·:：,，.。/\\|()[\]【】"'!？?]+/g, '');
}

function normPath(u) {
  const raw = String(u || '');
  const p = /^https?:\/\//i.test(raw) ? urlPath(raw) : raw.split(/[?#]/)[0] || '/';
  return String(p || '/').replace(/\/+$/, '') || '/';
}

function countUnclaimed(apps, services) {
  const list = Array.isArray(services) ? services : [];
  if (!list.length) return 0;
  const live = (Array.isArray(apps) ? apps : []).filter((a) => !a.deleted);
  const knownPorts = new Set(live.map((a) => Number(a.port) || portFromUrl(a.url)).filter(Boolean));
  const knownNames = new Set(live.map((a) => normName(a.name)).filter(Boolean));
  const knownPaths = new Set(live.filter((a) => a.url).map((a) => normPath(a.url)));
  let n = 0;
  for (const s of list) {
    if (s.sub) {
      if (!knownPaths.has(normPath(s.path || '/'))) n += 1;
      continue;
    }
    const byPort = (s.ports || [s.port]).some((p) => knownPorts.has(Number(p)));
    const key = normName(s.title);
    if (!(byPort || (!!key && knownNames.has(key)))) n += 1;
  }
  return n;
}

module.exports = { urlPath, portFromUrl, normName, normPath, countUnclaimed };
