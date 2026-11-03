'use strict';

const http = require('http');
const { guessGroup } = require('./store');

const NON_WEB = new Set([
  22, 25, 53, 111, 139, 445, 587, 993, 995, 1080, 2049, 2375, 2376, 3128,
  3306, 3389, 5432, 5672, 6379, 9042, 9092, 11211, 15672, 27017, 61613, 1883, 8883
]);

const WEB_HINTS = new Set([80, 443, 3000, 5000, 8000, 8008, 8080, 8081, 8088, 8090, 8096, 8181, 8443, 8888, 9000, 9090, 9091, 9999, 4000, 4200, 5173, 8880, 9001, 9443]);

function request(socketPath, apiPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path: apiPath,
        method,
        timeout: 5000,
        headers: { Host: 'docker', 'Content-Type': 'application/json' }
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('Docker 响应超时')));
    req.on('error', reject);
    req.end();
  });
}

function pickEndpoint(container) {
  const ports = (container.Ports || []).filter((p) => !p.Type || p.Type === 'tcp');
  const usable = ports.filter(
    (p) => p.PublicPort && !NON_WEB.has(p.PrivatePort) && !NON_WEB.has(p.PublicPort)
  );
  if (!usable.length) return null;
  usable.sort((a, b) => {
    const sa = WEB_HINTS.has(a.PrivatePort) ? 0 : 1;
    const sb = WEB_HINTS.has(b.PrivatePort) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.PrivatePort - b.PrivatePort;
  });
  const pick = usable[0];
  return { port: pick.PublicPort, privatePort: pick.PrivatePort, scheme: pick.PrivatePort === 443 ? 'https' : 'http' };
}

const inspectCache = new Map();
const INSPECT_TTL = 10 * 60 * 1000;

function portsOfExposed(exposed) {
  if (!exposed) return [];
  return Object.keys(exposed)
    .map((k) => {
      const [port, proto] = k.split('/');
      return { port: Number(port), proto: proto || 'tcp' };
    })
    .filter((p) => p.port && p.proto === 'tcp' && !NON_WEB.has(p.port));
}

async function endpointFromInspect(socketPath, containerId) {
  const hit = inspectCache.get(containerId);
  if (hit && Date.now() - hit.at < INSPECT_TTL) return hit.endpoint;
  let endpoint = null;
  try {
    const info = await inspect(socketPath, containerId);
    const mode = (info.HostConfig && info.HostConfig.NetworkMode) || '';
    const exposed = (info.Config && info.Config.ExposedPorts) || {};
    if (mode === 'host') {
      const ports = portsOfExposed(exposed);
      ports.sort((a, b) => (WEB_HINTS.has(b.port) ? 1 : 0) - (WEB_HINTS.has(a.port) ? 1 : 0) || a.port - b.port);
      if (ports.length) {
        endpoint = { port: ports[0].port, privatePort: ports[0].port, scheme: ports[0].port === 443 ? 'https' : 'http', hostNetwork: true };
      }
    }
  } catch (e) {
  }
  inspectCache.set(containerId, { at: Date.now(), endpoint });
  return endpoint;
}

function readLabels(container) {
  const labels = container.Labels || {};
  const get = (k) =>
    labels['naspilot.' + k] || labels['wharf.' + k] || labels['com.naspilot.' + k] || '';
  return {
    hide: ['1', 'true', 'yes'].includes(String(get('hide')).toLowerCase()),
    name: get('name'),
    icon: get('icon'),
    group: get('group'),
    url: get('url'),
    desc: get('desc')
  };
}

async function list(socketPath) {
  const res = await request(socketPath, '/containers/json?all=1');
  if (res.status !== 200) {
    throw new Error(`Docker API 返回 ${res.status}: ${res.body.slice(0, 160)}`);
  }
  const raw = JSON.parse(res.body);
  const enriched = raw.map(async (c) => {
    const name = (c.Names && c.Names[0] ? c.Names[0] : c.Id.slice(0, 12)).replace(/^\//, '');
    const labels = readLabels(c);
    let endpoint = pickEndpoint(c);
    if (!endpoint && c.State === 'running') {
      endpoint = await endpointFromInspect(socketPath, c.Id);
    }
    const image = c.Image || '';
    return {
      id: c.Id,
      shortId: c.Id.slice(0, 12),
      name,
      image,
      state: c.State,
      status: c.Status,
      running: c.State === 'running',
      created: c.Created,
      port: endpoint ? endpoint.port : null,
      privatePort: endpoint ? endpoint.privatePort : null,
      scheme: endpoint ? endpoint.scheme : 'http',
      labels,
      group: labels.group || guessGroup(name, image),
      hasWeb: Boolean(endpoint),
      hostNetwork: Boolean(endpoint && endpoint.hostNetwork)
    };
  });
  return Promise.all(enriched);
}

async function action(socketPath, id, verb) {
  const allowed = { start: 'start', stop: 'stop', restart: 'restart' };
  const api = allowed[verb];
  if (!api) throw new Error('不支持的操作');
  const encoded = encodeURIComponent(id);
  if (verb === 'restart') {
    await request(socketPath, `/containers/${encoded}/restart?t=10`, 'POST');
  } else {
    await request(socketPath, `/containers/${encoded}/${api}`, 'POST');
  }
  return true;
}

async function inspect(socketPath, id) {
  const res = await request(socketPath, `/containers/${encodeURIComponent(id)}/json`);
  if (res.status !== 200) throw new Error('容器信息读取失败');
  return JSON.parse(res.body);
}

module.exports = { list, action, inspect, request, pickEndpoint, NON_WEB };
