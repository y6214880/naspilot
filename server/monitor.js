'use strict';

const fs = require('fs');
const path = require('path');

let prev = null;
let cache = null;
const MIN_GAP = 900;

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return '';
  }
}

function exists(file) {
  try {
    return fs.existsSync(file);
  } catch (e) {
    return false;
  }
}

function pickBase(hostProc) {
  const base = hostProc || '/host/proc';
  if (exists(path.join(base, 'stat'))) return base;
  if (exists('/proc/stat')) return '/proc';
  return '';
}

function netFile(base) {
  const p1 = path.join(base, '1', 'net', 'dev');
  if (exists(p1)) return p1;
  return path.join(base, 'net', 'dev');
}

function readCpu(base) {
  const text = read(path.join(base, 'stat'));
  if (!text) return null;
  const lines = text.split('\n');
  const line = lines.find((l) => l.indexOf('cpu ') === 0);
  if (!line) return null;
  const n = line.trim().split(/\s+/).slice(1).map(Number);
  if (n.length < 4) return null;
  const idle = (n[3] || 0) + (n[4] || 0);
  const total = n.slice(0, 8).reduce((a, b) => a + (b || 0), 0);
  const cores = lines.filter((l) => /^cpu\d+\s/.test(l)).length || 1;
  return { idle, total, cores };
}

function memInfo(base) {
  const map = {};
  for (const line of read(path.join(base, 'meminfo')).split('\n')) {
    const m = line.match(/^(\w+(?:\(\w+\))?):\s+(\d+)/);
    if (m) map[m[1]] = Number(m[2]) * 1024;
  }
  return map;
}

function readMem(base) {
  const m = memInfo(base);
  const total = m.MemTotal;
  if (!total) return null;
  const avail = m.MemAvailable || m.MemFree || 0;
  const used = Math.max(0, total - avail);
  const cached = Math.max(0, (m.Cached || 0) + (m.SReclaimable || 0) - (m.Shmem || 0));
  const buffers = m.Buffers || 0;
  return { total, used, free: avail, cached, buffers, percent: Math.round((used / total) * 100) };
}

function readSwap(base) {
  const m = memInfo(base);
  const total = m.SwapTotal || 0;
  if (!total) return null;
  const used = Math.max(0, total - (m.SwapFree || 0));
  return { total, used, percent: Math.round((used / total) * 100) };
}

const DISK_RE = /^(sd[a-z]+|hd[a-z]+|vd[a-z]+|xvd[a-z]+|nvme\d+n\d+|mmcblk\d+)$/;
const SKIP_MOUNT = /^\/(snap|var\/lib\/docker|run|dev|proc|sys)(\/|$)/;

function readDisks(base, hostRoot) {
  const p1 = path.join(base, '1', 'mounts');
  const mounts = read(exists(p1) ? p1 : path.join(base, 'mounts'));
  if (!mounts) return [];
  const root = hostRoot || '/host/root';
  if (!exists(root)) return [];
  const seen = new Set();
  const out = [];
  for (const line of mounts.split('\n')) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 3) continue;
    const [dev, mnt, fstype] = cols;
    if (!dev.startsWith('/dev/')) continue;
    if (fstype === 'squashfs') continue;
    if (mnt === '/') {
      if (/^(tmpfs|overlay|rootfs)$/.test(fstype)) continue;
    } else if (SKIP_MOUNT.test(mnt)) {
      continue;
    }
    if (seen.has(mnt)) continue;
    seen.add(mnt);
    let st;
    try {
      st = fs.statfsSync(mnt === '/' ? root : root + mnt);
    } catch (e) {
      continue;
    }
    const bsize = Number(st.bsize) || 0;
    const total = Number(st.blocks) * bsize;
    if (!total) continue;
    const free = Number(st.bavail) * bsize;
    out.push({
      mount: mnt,
      fs: fstype,
      total,
      free,
      used: Math.max(0, total - free),
      percent: Math.round(((total - free) / total) * 100)
    });
  }
  out.sort((a, b) => (a.mount === '/' ? 1 : 0) - (b.mount === '/' ? 1 : 0) || a.mount.localeCompare(b.mount));
  return out;
}

function readDiskIO(base) {
  const text = read(path.join(base, 'diskstats'));
  if (!text) return null;
  let rd = 0;
  let wr = 0;
  for (const line of text.split('\n')) {
    const c = line.trim().split(/\s+/);
    if (c.length < 10) continue;
    if (!DISK_RE.test(c[2])) continue;
    rd += Number(c[5]) || 0;
    wr += Number(c[9]) || 0;
  }
  return { rd, wr };
}

function readNet(base) {
  const lines = read(netFile(base)).split('\n');
  let rx = 0;
  let tx = 0;
  const ifaces = [];
  for (const line of lines) {
    const m = line.match(/^\s*([\w:@.\-]+):\s*(.+)$/);
    if (!m) continue;
    if (m[1] === 'lo') continue;
    const cols = m[2].trim().split(/\s+/).map(Number);
    const r = cols[0] || 0;
    const t = cols[8] || 0;
    if (!r && !t) continue;
    rx += r;
    tx += t;
    ifaces.push(m[1]);
  }
  return { rx, tx, ifaces };
}

function readLoad(base) {
  const v = read(path.join(base, 'loadavg')).trim().split(/\s+/).slice(0, 3).map(Number);
  return v.length === 3 && v.every((x) => !isNaN(x)) ? v : null;
}

function readUptime(base) {
  const v = Number((read(path.join(base, 'uptime')).trim().split(/\s+/)[0] || '').trim());
  return isNaN(v) ? 0 : Math.round(v);
}

function sampleOnce(hostProc, hostRoot) {
  const base = pickBase(hostProc);
  if (!base) return null;
  const at = Date.now();
  const cpu = readCpu(base);
  const net = readNet(base);
  const dio = readDiskIO(base);
  const out = {
    at,
    source: base,
    cpu: null,
    cpuCores: cpu ? cpu.cores : null,
    mem: readMem(base),
    swap: readSwap(base),
    disks: readDisks(base, hostRoot),
    disk: { rd: null, wr: null },
    net: { rx: null, tx: null, rxTotal: net.rx, txTotal: net.tx, ifaces: net.ifaces },
    load: readLoad(base),
    uptime: readUptime(base)
  };
  if (out.load && out.cpuCores) {
    out.loadPercent = Math.round((out.load[0] / out.cpuCores) * 100);
  }
  if (prev && at > prev.at) {
    const dt = (at - prev.at) / 1000;
    if (cpu && prev.cpuTotal) {
      const dTotal = cpu.total - prev.cpuTotal;
      const dIdle = cpu.idle - prev.cpuIdle;
      if (dTotal > 0) out.cpu = Math.max(0, Math.min(100, Math.round((1 - dIdle / dTotal) * 100)));
    }
    if (dt >= 0.2 && prev.rx != null) {
      out.net.rx = Math.max(0, Math.round((net.rx - prev.rx) / dt));
      out.net.tx = Math.max(0, Math.round((net.tx - prev.tx) / dt));
    }
    if (dt >= 0.2 && dio && prev.rd != null) {
      out.disk.rd = Math.max(0, Math.round(((dio.rd - prev.rd) * 512) / dt));
      out.disk.wr = Math.max(0, Math.round(((dio.wr - prev.wr) * 512) / dt));
    }
  }
  prev = {
    at,
    cpuTotal: cpu ? cpu.total : 0,
    cpuIdle: cpu ? cpu.idle : 0,
    rx: net.rx,
    tx: net.tx,
    rd: dio ? dio.rd : null,
    wr: dio ? dio.wr : null
  };
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(hostProc, hostRoot) {
  if (cache && Date.now() - cache.at < MIN_GAP) return cache.data;
  let data = sampleOnce(hostProc, hostRoot);
  if (!data) return { ok: false, error: '读不到宿主机 /proc，确认 compose 挂了 - /proc:/host/proc:ro' };
  if (data.cpu == null) {
    await sleep(400);
    data = sampleOnce(hostProc, hostRoot) || data;
  }
  data.ok = true;
  if (data.source === '/proc') data.local = true;
  cache = { at: Date.now(), data };
  return data;
}

function reset() {
  prev = null;
  cache = null;
}

module.exports = { get, reset };
