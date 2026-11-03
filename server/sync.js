'use strict';

const docker = require('./docker');
const store = require('./store');

function prettify(name) {
  return String(name || '')
    .replace(/^\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function sync(cfg, host) {
  const settings = cfg.settings;
  const result = { ok: false, added: 0, updated: 0, removed: 0, total: 0, error: '' };

  if (!settings.dockerEnabled) {
    result.error = '未启用 Docker 联动';
    return result;
  }

  let containers;
  try {
    containers = await docker.list(settings.dockerSocket);
  } catch (err) {
    result.error = err.code === 'ENOENT' ? '未挂载 Docker 套接字' : err.message;
    return result;
  }

  result.ok = true;
  result.total = containers.length;
  const signature = (list) => list.map((a) => `${a.id}:${a.state || ''}:${a.port || ''}:${a.name}`).join('|');
  const before = signature(cfg.apps);
  const now = Date.now();
  const seen = new Set();

  const selfId = String(process.env.HOSTNAME || '').slice(0, 12);
  for (const c of containers) {
    if (c.labels.hide) continue;
    if (selfId && c.shortId === selfId) continue;
    if (/nasp[il]+ot|wharf/i.test(`${c.name} ${c.image}`)) continue;
    const appId = `dk_${c.shortId}`;
    seen.add(appId);
    let app = cfg.apps.find((a) => a.id === appId || (a.containerId && a.containerId === c.id));

    if (!app) {
      if (!c.hasWeb && !c.labels.url) continue;
      app = {
        id: appId,
        name: c.labels.name || prettify(c.name),
        desc: c.labels.desc || c.image,
        icon: c.labels.icon || '',
        url: c.labels.url || '',
        groupId: c.group,
        tags: [],
        pinned: false,
        hidden: false,
        source: 'docker',
        containerId: c.id,
        containerName: c.name,
        autoName: !c.labels.name,
        createdAt: now
      };
      cfg.apps.push(app);
      result.added += 1;
    } else {
      app.containerId = c.id;
      app.containerName = c.name;
      if (app.autoName !== false && !c.labels.name) app.name = prettify(c.name);
      if (!app.desc || app.autoDesc) {
        app.desc = c.image;
        app.autoDesc = true;
      }
      if (!app.url || app.urlFromDocker) app.url = c.labels.url || '';
      if (app.groupManual !== true && c.group && app.groupId !== c.group) app.groupId = c.group;
      result.updated += 1;
    }

    app.state = c.state;
    app.status = c.status;
    app.port = c.labels.url ? app.port : c.port;
    app.scheme = c.scheme;
    app.privatePort = c.privatePort;
    app.missing = false;
    app.checkedAt = now;
    app.urlFromDocker = !c.labels.url;
  }

  for (const app of cfg.apps) {
    if (app.source === 'docker' && !seen.has(app.id)) {
      app.state = 'removed';
      app.missing = true;
      result.removed += 1;
    }
  }

  cfg.meta.lastSync = now;
  if (signature(cfg.apps) !== before) store.save();
  return result;
}

module.exports = { sync, prettify };
