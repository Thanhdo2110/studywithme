"use strict";

/* ==========================================================================
   StudyWithMe — tiện ích dùng chung cho server
   ========================================================================== */

const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);

const DAY = 86400000;

const SUBJECT_IDS = ["toan", "ly", "hoa", "anh", "van", "dgnl"];
const ROOM_TYPES = { community: 20, group: 8, solo: 1 };

const MEMBER_POOL = [
  ["Minh Anh", "🌙"], ["Bảo Nam", "🐧"], ["Khánh Linh", "🌿"], ["Gia Huy", "⚡"],
  ["Thu Trang", "🍊"], ["Đức Anh", "🦉"], ["Ngọc Mai", "🌸"], ["Hoàng Long", "🐯"],
  ["Phương Thảo", "☁️"], ["Tuấn Kiệt", "🚀"], ["Hà My", "🫧"], ["Quang Hưng", "🎧"],
  ["Yến Nhi", "🍋"], ["Trung Hiếu", "🧩"], ["Lê Vy", "🌷"], ["Đông Nghi", "🪐"],
  ["Việt Dũng", "🏀"], ["Thanh Hà", "🍵"], ["Công Minh", "🐨"], ["Ánh Tuyết", "❄️"],
];

const SHOP_ITEMS = [
  { id: "winter", name: "Khung Mùa đông", icon: "❄️", price: 400, desc: "Tuyết rơi quanh avatar" },
  { id: "cat", name: "Mèo đồng hành", icon: "🐱", price: 800, desc: "Thú cưng ngồi cạnh khi học" },
  { id: "neon", name: "Khung Neon", icon: "✨", price: 250, desc: "Viền phát sáng dịu mắt" },
];

/* Vườn học tập — cây trồng & thú cưng nuôi bằng Study Star.
   Giá trị id phải khớp với danh mục hiển thị ở assets/js/garden.js. */
const GARDEN_MAX_LEVEL = 6;
/* Chi phí ★ cho từng mức. Thú cưng đắt gấp 3 lần cây trồng —
   nuôi thú là mục tiêu dài hạn, tạo thử thách cho người chơi. */
const GARDEN_COSTS = [30, 60, 100, 150, 220];
const GARDEN_PET_COSTS = GARDEN_COSTS.map((c) => c * 3); // [90, 180, 300, 450, 660]
const GARDEN_PLANTS = [
  { id: "huong-duong", name: "Hướng dương" },
  { id: "hong", name: "Hoa hồng" },
  { id: "anh-dao", name: "Anh đào" },
  { id: "xuong-rong", name: "Xương rồng" },
  { id: "tre", name: "Tre xanh" },
];
const GARDEN_PETS = [
  { id: "meo", name: "Mèo con" },
  { id: "cun", name: "Cún con" },
  { id: "tho", name: "Thỏ trắng" },
  { id: "cu-meo", name: "Cú mèo" },
  { id: "rong", name: "Rồng con" },
];

function gardenCatalog() {
  return { plants: GARDEN_PLANTS, pets: GARDEN_PETS, costs: GARDEN_COSTS, petCosts: GARDEN_PET_COSTS, maxLevel: GARDEN_MAX_LEVEL };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function iso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseISO(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function todayISO() {
  return iso(new Date());
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

/* scrypt chạy trên threadpool của libuv: không chặn event loop như scryptSync. */
async function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const key = await scrypt(String(password), useSalt, 32);
  return { salt: useSalt, hash: Buffer.from(key).toString("hex") };
}

async function verifyPassword(password, salt, expected) {
  try {
    const actual = await scrypt(String(password), salt, 32);
    const want = Buffer.from(String(expected), "hex");
    return actual.length === want.length && crypto.timingSafeEqual(actual, want);
  } catch {
    return false;
  }
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

function cleanText(value, max, { trim = true } = {}) {
  let text = String(value == null ? "" : value);
  text = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  if (trim) text = text.trim();
  return text.slice(0, max);
}

function cleanMultiline(value, max) {
  return cleanText(value, max).replace(/\r\n/g, "\n");
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function validClock(value) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ""));
  return m ? `${m[1]}:${m[2]}` : null;
}

function validDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    date.getFullYear() !== Number(m[1]) ||
    date.getMonth() !== Number(m[2]) - 1 ||
    date.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return m[0];
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Số phút học mẫu cho một ngày — giữ nguyên thuật toán của bản giao diện cũ
   để heatmap và chuỗi ngày trông quen thuộc. */
function seededMinutes(date) {
  const seed = Math.floor(date.getTime() / DAY) + 911;
  const rnd = mulberry32(seed);
  const wd = date.getDay();
  const base = wd === 0 || wd === 6 ? 168 : 108;
  let m = Math.round(base + rnd() * 118 - 34);
  if (rnd() < 0.08) m = 0;
  const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / DAY);
  if (diff >= 0 && diff < 12 && m < 40) m = 42 + Math.floor(rnd() * 30);
  return Math.max(0, Math.min(298, m));
}

const SUBJECT_WEIGHTS = [
  ["toan", 34],
  ["ly", 22],
  ["hoa", 16],
  ["anh", 14],
  ["dgnl", 9],
  ["van", 5],
];

const HOUR_WEIGHTS = [
  [6, 0.7], [7, 0.5], [8, 1.1], [9, 1.4], [10, 1.5], [11, 1.1],
  [12, 0.6], [13, 0.5], [14, 1.0], [15, 1.3], [16, 1.4], [17, 1.1],
  [18, 1.3], [19, 2.0], [20, 2.3], [21, 2.2], [22, 1.6], [23, 0.9],
];

function distribute(total, weights, rnd) {
  const jittered = weights.map(([, w]) => Math.max(0.05, w * (0.7 + rnd() * 0.6)));
  const sum = jittered.reduce((a, b) => a + b, 0);
  const out = {};
  let used = 0;
  weights.forEach(([key], i) => {
    const value = Math.floor((total * jittered[i]) / sum);
    out[key] = value;
    used += value;
  });
  const keys = weights.map(([k]) => k);
  let rest = total - used;
  let i = 0;
  while (rest > 0 && keys.length) {
    out[keys[i % keys.length]] += 1;
    rest -= 1;
    i += 1;
  }
  return out;
}

/* Chia số giây học mẫu thành môn học + khung giờ. */
function splitFocus(seconds, date) {
  if (!seconds) return { bySubject: {}, byHour: {} };
  const seed = Math.floor(date.getTime() / DAY) + 4242;
  const rnd = mulberry32(seed);
  const bySubject = distribute(seconds, SUBJECT_WEIGHTS, rnd);
  const byHour = distribute(seconds, HOUR_WEIGHTS, rnd);
  return { bySubject, byHour };
}

module.exports = {
  DAY,
  SUBJECT_IDS,
  ROOM_TYPES,
  MEMBER_POOL,
  SHOP_ITEMS,
  GARDEN_MAX_LEVEL,
  GARDEN_COSTS,
  GARDEN_PET_COSTS,
  GARDEN_PLANTS,
  GARDEN_PETS,
  gardenCatalog,
  SUBJECT_WEIGHTS,
  HOUR_WEIGHTS,
  pad,
  iso,
  parseISO,
  startOfDay,
  addDays,
  todayISO,
  newId,
  hashPassword,
  verifyPassword,
  validEmail,
  cleanText,
  cleanMultiline,
  clampInt,
  validClock,
  validDate,
  mulberry32,
  seededMinutes,
  splitFocus,
};
