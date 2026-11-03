'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.NASPLOT_DATA || process.env.WHARF_DATA || path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const GROUP_PRESETS = [
  { id: 'media', name: '影音', order: 0 },
  { id: 'download', name: '下载', order: 1 },
  { id: 'tool', name: '工具', order: 2 },
  { id: 'system', name: '系统', order: 3 },
  { id: 'other', name: '其他', order: 4 }
];

const GROUP_RULES = [
  {
    group: 'media',
    keys: [
      'jellyfin', 'emby', 'plex', 'nastool', 'moviepilot', 'tinymediamanager', 'jackett',
      'navidrome', 'audiobookshelf', 'airsonic', 'subsonic', 'funkwhale', 'mstream',
      'calibre', 'kavita', 'komga', 'manga', 'immich', 'photoprism', 'lychee', 'photoview',
      'danmaku', 'bilibili', 'youtube', 'iptv', 'tvbox', 'stream', 'media', 'player',
      'music', 'video', 'photo', 'movie', 'anime', 'cinema',
      '影视', '影音', '相册', '音乐', '视频', '播放', '字幕', '豆瓣', '动漫', '剧集', '追剧'
    ]
  },
  {
    group: 'download',
    keys: [
      'qbit', 'transmission', 'aria2', 'aria-ng', 'deluge', 'sabnzbd', 'nzbget', 'pyload',
      'alist', 'cloudreve', 'filebrowser', 'file browser', 'filegator', 'syncthing', 'rclone',
      'magnet', 'torrent', 'seed', 'usenet', 'youtube-dl', 'yt-dlp',
      '下载', '种子', '迅雷', '磁力', '离线', '网盘挂载'
    ]
  },
  {
    group: 'tool',
    keys: [
      'code-server', 'codeserver', 'code server', 'jupyter', 'gitea', 'gitlab', 'drone', 'woodpecker',
      'vaultwarden', 'bitwarden', 'keepass', 'n8n', 'dify', 'ollama', 'open-webui', 'openwebui',
      'lobe', 'nextchat', 'chatgpt', 'chat', 'clash', 'adguard', 'dns', 'it-tools', 'ittools', 'it tools',
      'excalidraw', 'drawio', 'memos', 'flomo', 'frp', 'tailscale', 'zerotier',
      'panhub', '图床', 'picgo', 'picture bed', '笔记', '密码', '表单', '看板', '记账',
      'panel', 'dashboard', 'homepage', 'sun-panel', 'dashy', 'heimdall', 'flame',
      '导航', '启动台', '面板', '搜索', '网盘', '博客', 'blog', 'wiki', '文档', 'rss', '订阅'
    ]
  },
  {
    group: 'system',
    keys: [
      'portainer', 'watchtower', 'dockge', 'yacht', 'nginx', 'traefik', 'caddy', 'apache',
      'uptime', 'glances', 'netdata', 'prometheus', 'grafana', 'zabbix', 'node-exporter',
      'ssh', 'fnos', '飞牛', '群晖', 'synology', 'qnap', 'truenas', 'unraid', 'proxmox', 'esxi', 'duplicati',
      'openwrt', 'router', '路由', '防火墙', '监控', '系统', '存储', '备份'
    ]
  }
];

function guessGroup(...names) {
  const hay = names.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return 'other';
  for (const rule of GROUP_RULES) {
    if (rule.keys.some((k) => hay.includes(k))) return rule.group;
  }
  return 'other';
}

const DEFAULT_SETTINGS = {
  title: 'NasPilot',
  subtitle: 'LAUNCHPAD',
  theme: 'dark',
  accent: '#e8b45a',
  density: 'standard',
  openInNewTab: true,
  showFooter: true,
  dockerEnabled: true,
  dockerControl: true,
  dockerSocket: '/var/run/docker.sock',
  hostOverride: '',
  discoverEnabled: true,
  autoDiscover: true,
  discoverInterval: 0,
  hostProc: '/host/proc',
  hostRoot: '/host/root',
  probeEnabled: true,
  probeInterval: 30,
  dockerInterval: 60,
  monitorEnabled: true,
  monitorInterval: 2,
  statsEnabled: true,
  onboarded: false
};

let cache = null;
let saveTimer = null;

function emptyConfig() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    groups: GROUP_PRESETS.map((g) => ({ ...g })),
    apps: [],
    stats: { clicks: {}, visits: [] },
    meta: { createdAt: Date.now(), lastSync: 0 }
  };
}

const LEGACY_NAMES = { 飞牛相册: '相册', 飞牛音乐: '音乐', 飞牛文件: '文件' };

function normalize(cfg) {
  const base = emptyConfig();
  const out = {
    ...base,
    ...cfg,
    settings: { ...base.settings, ...(cfg.settings || {}) },
    groups: Array.isArray(cfg.groups) && cfg.groups.length ? cfg.groups : base.groups,
    apps: Array.isArray(cfg.apps) ? cfg.apps : [],
    stats: { clicks: {}, visits: [], ...(cfg.stats || {}) }
  };
  out.apps = out.apps.map((a, i) => ({
    order: i,
    tags: [],
    pinned: false,
    hidden: false,
    source: 'manual',
    ...a
  }));
  out.apps = out.apps.map((a) =>
    a.autoName && LEGACY_NAMES[a.name] ? { ...a, name: LEGACY_NAMES[a.name] } : a
  );
  for (const a of out.apps) if (a.widget) delete a.widget;
  delete out.settings.wallpaper;
  return out;
}

function load() {
  if (cache) return cache;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(CONFIG_FILE)) {
      cache = normalize(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
    } else {
      cache = emptyConfig();
      flush();
    }
  } catch (err) {
    console.error('[store] 配置文件读取失败，使用默认配置:', err.message);
    cache = emptyConfig();
  }
  return cache;
}

function flush() {
  if (!cache) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = CONFIG_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(tmp, CONFIG_FILE);
  } catch (err) {
    console.error('[store] 写入失败:', err.message);
  }
}

function save(immediate = false) {
  if (immediate) {
    clearTimeout(saveTimer);
    saveTimer = null;
    flush();
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}

function removeApp(id) {
  const cfg = load();
  cfg.apps = cfg.apps.filter((a) => a.id !== id);
  delete cfg.stats.clicks[id];
  save();
}

function recordVisit(id) {
  const cfg = load();
  if (!cfg.settings.statsEnabled) return;
  cfg.stats.clicks[id] = (cfg.stats.clicks[id] || 0) + 1;
  cfg.stats.visits.push({ id, t: Date.now() });
  if (cfg.stats.visits.length > 4000) {
    cfg.stats.visits = cfg.stats.visits.slice(-3000);
  }
  save();
}

function lastVisitMap() {
  const cfg = load();
  const map = {};
  for (let i = cfg.stats.visits.length - 1; i >= 0; i--) {
    const v = cfg.stats.visits[i];
    if (!map[v.id]) map[v.id] = v.t;
  }
  return map;
}

module.exports = {
  DATA_DIR,
  CONFIG_FILE,
  GROUP_PRESETS,
  DEFAULT_SETTINGS,
  guessGroup,
  load,
  save,
  flush,
  removeApp,
  recordVisit,
  lastVisitMap,
  emptyConfig,
  normalize
};
