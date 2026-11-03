'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./store');

const SECRET_FILE = path.join(DATA_DIR, '.secret');
const COOKIE = 'np_auth';
const MAX_AGE = 30 * 24 * 3600;
const WINDOW = 60 * 1000;
const LIMIT = 5;

function secret() {
  try {
    const s = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (s.length >= 32) return s;
  } catch (e) {}
  const s = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 });
  } catch (e) {}
  return s;
}

function hashPass(pass, salt) {
  return crypto.scryptSync(String(pass), salt, 32).toString('hex');
}

function makePasscode(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hashPass(pass, salt) };
}

function verifyPass(pass, pc) {
  if (!pc || !pc.salt || !pc.hash) return false;
  try {
    const a = Buffer.from(hashPass(pass, pc.salt), 'hex');
    const b = Buffer.from(pc.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

function tokenFor(pc) {
  return crypto.createHmac('sha256', secret()).update(String(pc.hash)).digest('base64url');
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isAuthed(req, settings) {
  const pc = settings && settings.passcode;
  if (!pc) return true;
  const got = cookies(req)[COOKIE];
  if (!got) return false;
  try {
    const a = Buffer.from(got);
    const b = Buffer.from(tokenFor(pc));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

function cookieHeader(pc) {
  return `${COOKIE}=${tokenFor(pc)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax`;
}

function clearCookieHeader() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

const fails = new Map();

function tooMany(ip) {
  const rec = fails.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.at > WINDOW) {
    fails.delete(ip);
    return false;
  }
  return rec.n >= LIMIT;
}

function noteFail(ip) {
  const rec = fails.get(ip);
  if (!rec || Date.now() - rec.at > WINDOW) fails.set(ip, { at: Date.now(), n: 1 });
  else rec.n++;
}

function clearFail(ip) {
  fails.delete(ip);
}

module.exports = {
  makePasscode,
  verifyPass,
  isAuthed,
  cookieHeader,
  clearCookieHeader,
  tooMany,
  noteFail,
  clearFail
};
