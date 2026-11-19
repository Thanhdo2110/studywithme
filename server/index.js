"use strict";

/* ==========================================================================
   StudyWithMe — HTTP server (REST API + SSE + frontend tĩnh)
   Postgres cho dữ liệu, Redis cho phiên/rate limit/credit focus.
   ========================================================================== */

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const { URL } = require("node:url");

const DB = require("./db");
const S = require("./service");
const U = require("./util");
const { createKv } = require("./kv");

const gzip = promisify(zlib.gzip);

const ROOT = path.resolve(__dirname, "..");
const COOKIE = "swm_sid";
const MAX_BODY = 2 * 1024 * 1024;
const MAX_UPLOAD = 10 * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, "uploads");
const AUTH_LIMIT = 40;
const AUTH_WINDOW = 300;
/* Mỗi IP chỉ được sinh tối đa chừng này tài khoản khách mỗi giờ. Bot không
   giữ cookie sẽ tạo một khách + ~420 dòng dữ liệu mẫu cho mỗi lượt tải trang. */
const GUEST_LIMIT = 120;
const GUEST_WINDOW = 3600;
const GUEST_RETENTION_DAYS = Number(process.env.GUEST_RETENTION_DAYS) || 14;

/* Font của giao diện tải từ Google Fonts nên phải mở đúng hai domain đó,
   không dùng wildcard. */
const CSP =
  "default-src 'self'; img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "script-src 'self' 'unsafe-inline'; connect-src 'self'; " +
  "font-src 'self' data: https://fonts.gstatic.com; " +
  "frame-ancestors 'self'; base-uri 'self'; form-action 'self'";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const BLOCKED_PREFIXES = ["/server/", "/tests/", "/data/", "/.git/"];
const BLOCKED_FILES = ["/package.json", "/package-lock.json", "/.env", "/README.md", "/Dockerfile", "/docker-compose.yml"];

/* -------------------------------------------------------------------------- */
/* Tiện ích HTTP                                                               */
/* -------------------------------------------------------------------------- */

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function acceptsGzip(req) {
  return String(req.headers["accept-encoding"] || "").toLowerCase().includes("gzip");
}

async function sendBody(req, res, status, type, body, extraHeaders) {
  if (res.writableEnded) return;
  let buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  securityHeaders(res);
  res.setHeader("Content-Type", type);

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  }

  if (buffer.length >= 1024 && acceptsGzip(req)) {
    buffer = await gzip(buffer);
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Vary", "Accept-Encoding");
  }

  res.setHeader("Content-Length", buffer.length);
  res.statusCode = status;
  res.end(req.method === "HEAD" ? undefined : buffer);
}

function sendJSON(req, res, status, data, extraHeaders) {
  return sendBody(req, res, status, "application/json; charset=utf-8", JSON.stringify(data), {
    "Cache-Control": "no-store",
    ...(extraHeaders || {}),
  });
}

function sendError(req, res, status, message, code) {
  return sendJSON(req, res, status, { error: message, code: code || undefined });
}

function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const index = part.indexOf("=");
      if (index < 0) return;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (key) out[key] = decodeURIComponent(value);
    });
  return out;
}

/* Chỉ gắn Secure khi thật sự chạy HTTPS để không phá dev qua http://LAN-IP. */
function isSecureRequest(req) {
  if (req.socket && req.socket.encrypted) return true;
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  return forwarded === "https";
}

function sessionCookie(req, token, maxAge) {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/* Chặn CSRF dựa trên Origin cho các request ghi dữ liệu. */
function sameOriginRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Nội dung gửi lên quá lớn."), { status: 413, code: "BODY_TOO_LARGE" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object") {
          return reject(Object.assign(new Error("JSON không hợp lệ."), { status: 400 }));
        }
        resolve(parsed);
      } catch {
        reject(Object.assign(new Error("JSON không hợp lệ."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function readRawBody(req, maxSize) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(Object.assign(new Error("Tệp tải lên vượt quá 10 MB."), { status: 413, code: "FILE_TOO_LARGE" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  const boundary = boundaryMatch && (boundaryMatch[1] || boundaryMatch[2]);
  if (!boundary) throw Object.assign(new Error("Dữ liệu tải lên không hợp lệ."), { status: 400, code: "INVALID_MULTIPART" });

  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  let file = null;
  let start = 0;

  while (true) {
    const first = buffer.indexOf(delimiter, start);
    if (first < 0) break;
    let next = buffer.indexOf(delimiter, first + delimiter.length);
    if (next < 0) break;

    let part = buffer.subarray(first + delimiter.length, next);
    if (part.length >= 2 && part[0] === 13 && part[1] === 10) part = part.subarray(2);
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) part = part.subarray(0, part.length - 2);

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd >= 0) {
      const headerText = part.subarray(0, headerEnd).toString("utf8");
      const body = part.subarray(headerEnd + 4);
      const nameMatch = /(?:^|;)\s*name="([^"]+)"/i.exec(headerText);
      const filenameMatch = /(?:^|;)\s*filename="([^"]*)"/i.exec(headerText);
      const name = nameMatch ? nameMatch[1] : "";
      if (filenameMatch) {
        const originalName = path.basename(filenameMatch[1].replace(/\\\\/g, "/"));
        const contentTypeMatch = /^Content-Type:\s*(.+)$/im.exec(headerText);
        file = {
          name: originalName,
          type: contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream",
          buffer: body,
        };
      } else if (name) {
        fields[name] = body.toString("utf8").trim();
      }
    }
    start = next;
  }
  return { fields, file };
}

/* Sau nginx, địa chỉ socket là IP của container proxy: chỉ tin
   X-Forwarded-For khi TRUST_PROXY=1 (backend không lộ ra ngoài). */
function clientIp(req) {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || "local";
}

/* -------------------------------------------------------------------------- */
/* Server                                                                      */
/* -------------------------------------------------------------------------- */

async function createApp(options = {}) {
  const databaseUrl =
    options.databaseUrl || process.env.DATABASE_URL || "postgres://swm:swm@localhost:5433/swm";

  await fsp.mkdir(UPLOAD_DIR, { recursive: true });

  const pool = DB.createPool({ connectionString: databaseUrl, ...(options.pool || {}) });
  await DB.initDatabase(pool);

  const kv = options.kv || (await createKv(options.redisUrl === undefined ? process.env.REDIS_URL : options.redisUrl));
  const ctx = { pool, kv };

  /* Container backend chạy SERVE_STATIC=false; trình duyệt lấy giao diện từ
     container frontend (nginx). Bamboo test vẫn bật để kiểm tra file tĩnh. */
  const serveStaticEnabled =
    options.serveStatic !== undefined ? Boolean(options.serveStatic) : process.env.SERVE_STATIC !== "false";

  const streams = new Map(); // roomId -> Set<client>

  const sse = {
    add(roomId, res, user) {
      if (!streams.has(roomId)) streams.set(roomId, new Set());
      const client = { res, userId: user.id, timer: null };
      let ticks = 0;
      client.timer = setInterval(() => {
        try {
          res.write(": ping\n\n");
        } catch {
          /* ignore */
        }
        ticks += 1;
        /* Giữ last_seen tươi cho người còn mở trang, khoảng 75 giây một lần. */
        if (ticks % 3 === 0) {
          S.updatePresence(pool, roomId, user.id).catch(() => {});
        }
      }, 25000);
      streams.get(roomId).add(client);
      return client;
    },
    remove(roomId, client) {
      const set = streams.get(roomId);
      if (!set) return;
      set.delete(client);
      if (client.timer) clearInterval(client.timer);
      if (!set.size) streams.delete(roomId);
    },
    send(roomId, event, data) {
      const set = streams.get(roomId);
      if (!set) return;
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      set.forEach((client) => {
        try {
          client.res.write(payload);
        } catch {
          /* ignore */
        }
      });
    },
    /* Một query cho cả phòng thay vì một query cho mỗi client. */
    async broadcastPresence(roomId) {
      const set = streams.get(roomId);
      if (!set || !set.size) return;
      const room = (await pool.query("SELECT * FROM rooms WHERE id = $1", [roomId])).rows[0];
      if (!room) return;
      const base = await S.membersFor(pool, room, null);
      set.forEach((client) => {
        const members = base.map((member) => ({ ...member, me: member.id === client.userId }));
        try {
          client.res.write(`event: presence\ndata: ${JSON.stringify({ members })}\n\n`);
        } catch {
          /* ignore */
        }
      });
    },
    closeAll() {
      streams.forEach((set) => {
        set.forEach((client) => {
          if (client.timer) clearInterval(client.timer);
          try {
            client.res.end();
          } catch {
            /* ignore */
          }
        });
      });
      streams.clear();
    },
    /* Đóng mọi kết nối SSE của một phòng đã bị giải tán. */
    closeRoom(roomId) {
      const set = streams.get(roomId);
      if (!set) return;
      set.forEach((client) => {
        if (client.timer) clearInterval(client.timer);
        try {
          client.res.end();
        } catch {
          /* ignore */
        }
      });
      streams.delete(roomId);
    },
  };

  async function resolveUser(req) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE];
    const user = token ? await S.userByToken(ctx, token) : null;
    if (user && Date.now() - Number(user.last_seen || 0) > 60000) {
      user.last_seen = Date.now();
      DB.touchUser(pool, user.id).catch((err) => console.error("[StudyWithMe] touch", err.message));
    }
    return { user, token: user ? token : null };
  }

  async function ensureUser(req, res) {
    const current = await resolveUser(req);
    if (current.user) return current;

    if (!(await guestBudget(req))) return { user: null, token: null };

    const user = await S.ensureGuest(ctx);
    const token = await S.createSession(ctx, user.id);
    res.setHeader("Set-Cookie", sessionCookie(req, token, Math.floor(S.SESSION_TTL / 1000)));
    return { user, token };
  }

  async function guestBudget(req) {
    const key = `swm:rl:guest:${clientIp(req)}`;
    const count = await ctx.kv.incr(key);
    if (count === 1) await ctx.kv.expire(key, GUEST_WINDOW);
    if (count > GUEST_LIMIT) {
      console.warn(`[StudyWithMe] vượt hạn mức tạo khách cho ${clientIp(req)} (${count}/giờ).`);
      return false;
    }
    return true;
  }

  async function allowAuth(req) {
    const key = `swm:rl:auth:${clientIp(req)}`;
    const count = await ctx.kv.incr(key);
    if (count === 1) await ctx.kv.expire(key, AUTH_WINDOW);
    return count <= AUTH_LIMIT;
  }

  /* Tạo phòng và vào phòng chỉ dành cho tài khoản đã đăng ký — khách phải
     đăng ký (hoặc đăng nhập) trước. */
  function denyGuest(req, res, user) {
    if (!user || !user.is_guest) return false;
    sendError(
      req,
      res,
      403,
      "Bạn cần đăng ký tài khoản để tạo và vào phòng học.",
      "REGISTRATION_REQUIRED"
    );
    return true;
  }

  /* ------------------------------- API ---------------------------------- */

  async function handleApi(req, res, url) {
    const pathname = url.pathname;
    const method = req.method || "GET";

    if (pathname === "/api/health" && method === "GET") {
      try {
        await DB.pingDatabase(pool);
        await ctx.kv.ping();
        return sendJSON(req, res, 200, { ok: true, db: "up", kv: kv.kind });
      } catch (err) {
        console.error("[StudyWithMe] health", err.message);
        return sendJSON(req, res, 503, { ok: false, error: "dependency unavailable" });
      }
    }

    /* Bootstrap script -------------------------------------------------- */
    if (pathname === "/api/bootstrap.js" && method === "GET") {
      const { user } = await ensureUser(req, res);
      /* Không có phiên (vượt hạn mức tạo khách): trả null để giao diện chạy ở
         chế độ xem thử, không ghi dữ liệu. */
      if (!user) {
        return sendBody(req, res, 200, "text/javascript; charset=utf-8", "window.__SWM_BOOTSTRAP__ = null;", {
          "Cache-Control": "no-store",
        });
      }
      const payload = await S.bootstrapPayload(ctx, user);
      const json = JSON.stringify(payload).replace(/</g, "\\u003c");
      return sendBody(req, res, 200, "text/javascript; charset=utf-8", `window.__SWM_BOOTSTRAP__ = ${json};`, {
        "Cache-Control": "no-store",
      });
    }

    /* Auth -------------------------------------------------------------- */
    if (pathname === "/api/auth/register" && method === "POST") {
      if (!(await allowAuth(req))) {
        return sendError(req, res, 429, "Quá nhiều lần thử. Vui lòng đợi vài phút.", "TOO_MANY_ATTEMPTS");
      }
      const body = await readBody(req);
      const name = U.cleanText(body.name, 60);
      const email = U.cleanText(body.email, 160).toLowerCase();
      const password = String(body.password || "");

      if (name.length < 2) return sendError(req, res, 400, "Hãy nhập họ tên của bạn.", "BAD_NAME");
      if (!U.validEmail(email)) return sendError(req, res, 400, "Email chưa đúng định dạng.", "BAD_EMAIL");
      if (password.length < 6) return sendError(req, res, 400, "Mật khẩu cần ít nhất 6 ký tự.", "WEAK_PASSWORD");

      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length) {
        return sendError(req, res, 409, "Email này đã có tài khoản. Hãy đăng nhập.", "EMAIL_TAKEN");
      }

      const current = await resolveUser(req);
      const user =
        current.user && current.user.is_guest
          ? await S.upgradeGuest(ctx, current.user, { name, email, password })
          : await S.createAccount(ctx, { name, email, password });
      const token = await S.createSession(ctx, user.id);

      return sendJSON(
        req,
        res,
        201,
        { account: S.serializeAccount(user), redirect: "dashboard.html" },
        { "Set-Cookie": sessionCookie(req, token, Math.floor(S.SESSION_TTL / 1000)) }
      );
    }

    if (pathname === "/api/auth/login" && method === "POST") {
      if (!(await allowAuth(req))) {
        return sendError(req, res, 429, "Quá nhiều lần thử. Vui lòng đợi vài phút.", "TOO_MANY_ATTEMPTS");
      }
      const body = await readBody(req);
      const email = U.cleanText(body.email, 160).toLowerCase();
      const password = String(body.password || "");
      const found = (await pool.query("SELECT * FROM users WHERE email = $1", [email])).rows[0];
      if (!found || found.is_guest || !found.pass_hash) {
        return sendError(req, res, 401, "Email hoặc mật khẩu chưa đúng.", "BAD_CREDENTIALS");
      }
      if (!(await U.verifyPassword(password, found.pass_salt, found.pass_hash))) {
        return sendError(req, res, 401, "Email hoặc mật khẩu chưa đúng.", "BAD_CREDENTIALS");
      }
      const token = await S.createSession(ctx, found.id);
      return sendJSON(
        req,
        res,
        200,
        { account: S.serializeAccount(found), redirect: "dashboard.html" },
        { "Set-Cookie": sessionCookie(req, token, Math.floor(S.SESSION_TTL / 1000)) }
      );
    }

    if (pathname === "/api/auth/guest" && method === "POST") {
      const current = await resolveUser(req);
      if (current.user) {
        return sendJSON(req, res, 200, {
          account: S.serializeAccount(current.user),
          redirect: "dashboard.html",
        });
      }
      if (!(await guestBudget(req))) {
        return sendError(req, res, 429, "Quá nhiều phiên khách từ địa chỉ này. Vui lòng thử lại sau.", "TOO_MANY_ATTEMPTS");
      }
      const user = await S.ensureGuest(ctx);
      const token = await S.createSession(ctx, user.id);
      return sendJSON(
        req,
        res,
        200,
        { account: S.serializeAccount(user), redirect: "dashboard.html" },
        { "Set-Cookie": sessionCookie(req, token, Math.floor(S.SESSION_TTL / 1000)) }
      );
    }

    if (pathname === "/api/auth/logout" && method === "POST") {
      const current = await resolveUser(req);
      if (current.token) await S.destroySession(ctx, current.token);
      return sendJSON(req, res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req, "", 0) });
    }

    /* Từ đây cần phiên đăng nhập --------------------------------------- */
    const { user, token } = await resolveUser(req);
    if (!user) return sendError(req, res, 401, "Bạn cần đăng nhập để tiếp tục.", "UNAUTHENTICATED");

    if (pathname === "/api/me" && method === "GET") {
      return sendJSON(req, res, 200, await S.bootstrapPayload(ctx, user));
    }

    if (pathname === "/api/me/state" && (method === "PUT" || method === "POST")) {
      const body = await readBody(req);
      return sendJSON(req, res, 200, await S.saveState(ctx, user, body));
    }

    if (pathname === "/api/me/rooms" && method === "GET") {
      return sendJSON(req, res, 200, { rooms: await S.myRoomsFor(ctx, user) });
    }

    if (pathname === "/api/me/reset" && method === "POST") {
      await S.destroySession(ctx, token);
      const fresh = await DB.resetUser(pool, user);
      const next = await S.createSession(ctx, fresh.id);
      return sendJSON(
        req,
        res,
        200,
        { ok: true, account: S.serializeAccount(fresh) },
        { "Set-Cookie": sessionCookie(req, next, Math.floor(S.SESSION_TTL / 1000)) }
      );
    }

    if (pathname === "/api/stats" && method === "GET") {
      const days = U.clampInt(url.searchParams.get("days"), 7, 400, 90);
      return sendJSON(req, res, 200, await S.statsFor(ctx, user, days));
    }

    const uploadMatch = /^\/api\/uploads\/([A-Za-z0-9_-]{1,80})$/.exec(pathname);
    if (uploadMatch && method === "GET") {
      const doc = await S.getDoc(pool, uploadMatch[1]);
      if (!doc) return sendError(req, res, 404, "Không tìm thấy tài liệu.", "DOC_NOT_FOUND");
      const room = await S.getRoom(ctx, user, doc.room_id);
      if (!room) return sendError(req, res, 404, "Không tìm thấy phòng.", "ROOM_NOT_FOUND");
      if (room.created_by !== user.id && !(await S.isMember(pool, room.id, user.id))) {
        return sendError(req, res, 403, "Bạn cần tham gia phòng để mở tài liệu.", "NOT_ROOM_MEMBER");
      }
      await fsp.mkdir(UPLOAD_DIR, { recursive: true });
      const entries = await fsp.readdir(UPLOAD_DIR);
      const fileName = entries.find((name) => name.startsWith(`${doc.id}.`));
      if (!fileName) return sendError(req, res, 404, "Tệp không còn tồn tại.", "FILE_NOT_FOUND");
      const buffer = await fsp.readFile(path.join(UPLOAD_DIR, fileName));
      const extension = path.extname(fileName).toLowerCase();
      const mime = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".txt": "text/plain; charset=utf-8",
        ".csv": "text/csv; charset=utf-8",
        ".zip": "application/zip",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }[extension] || "application/octet-stream";
      const safeTitle = String(doc.id).replace(/[^A-Za-z0-9_-]/g, "");
      securityHeaders(res);
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Content-Disposition", `inline; filename="${safeTitle}${extension}"`);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.statusCode = 200;
      res.end(buffer);
      return;
    }

    /* Phòng ------------------------------------------------------------- */
    if (pathname === "/api/rooms" && method === "GET") {
      return sendJSON(req, res, 200, { rooms: await S.roomList(ctx, user) });
    }

    if (pathname === "/api/rooms" && method === "POST") {
      if (denyGuest(req, res, user)) return;
      const body = await readBody(req);
      const name = U.cleanText(body.name, 90);
      const subject = U.cleanText(body.subject, 40) || "toan";
      const type = Object.prototype.hasOwnProperty.call(U.ROOM_TYPES, body.type) ? body.type : "community";
      const topic = U.cleanText(body.topic, 160);

      if (type !== "solo" && name.length < 2) {
        return sendError(req, res, 400, "Hãy đặt tên cho phòng học (ít nhất 2 ký tự).", "BAD_ROOM_NAME");
      }

      const room = await S.createRoom(ctx, user, { name, subject, type, topic });
      return sendJSON(req, res, 201, { room });
    }

    const docDeleteMatch = /^\/api\/rooms\/([A-Za-z0-9_-]{1,80})\/docs\/([A-Za-z0-9_-]{1,80})$/.exec(pathname);
    if (docDeleteMatch && method === "DELETE") {
      const roomId = docDeleteMatch[1];
      const docId = docDeleteMatch[2];
      const room = await S.getRoom(ctx, user, roomId);
      if (!room) return sendError(req, res, 404, "Không tìm thấy phòng học.", "ROOM_NOT_FOUND");
      const result = await S.deleteDoc(ctx, room, user, docId);
      sse.send(room.id, "docs", { docs: await S.roomDocs(pool, room.id) });
      return sendJSON(req, res, 200, result);
    }

    const roomMatch = /^\/api\/rooms\/([A-Za-z0-9_-]{1,80})(\/[a-z]+)?$/.exec(pathname);
    if (roomMatch) {
      const roomId = roomMatch[1];
      const sub = roomMatch[2] || "";
      const room = await S.getRoom(ctx, user, roomId);
      if (!room) return sendError(req, res, 404, "Không tìm thấy phòng học.", "ROOM_NOT_FOUND");

      if (sub === "" && method === "GET") {
        await S.updatePresence(pool, room.id, user.id);
        const [view, members, messages, docs, notebook] = await Promise.all([
          S.roomView(pool, room, user),
          S.membersFor(pool, room, user.id),
          S.roomMessages(pool, room.id, user),
          S.roomDocs(pool, room.id),
          S.roomNotebook(pool, room.id, user.id),
        ]);
        return sendJSON(req, res, 200, { room: view, members, messages, docs, notebook });
      }

      /* Giải tán nhóm (chỉ chủ phòng) — xoá phòng và mọi dữ liệu đi kèm. */
      if (sub === "" && method === "DELETE") {
        await S.deleteRoom(ctx, room, user);
        sse.send(room.id, "closed", { roomId: room.id, by: user.name });
        sse.closeRoom(room.id);
        return sendJSON(req, res, 200, { ok: true, roomId: room.id });
      }

      if (sub === "/join" && method === "POST") {
        if (denyGuest(req, res, user)) return;
        const joined = await S.joinRoom(ctx, room, user);
        await sse.broadcastPresence(room.id);
        const [members, messages, docs, notebook] = await Promise.all([
          S.membersFor(pool, room, user.id),
          S.roomMessages(pool, room.id, user),
          S.roomDocs(pool, room.id),
          S.roomNotebook(pool, room.id, user.id),
        ]);
        return sendJSON(req, res, 200, { room: joined, members, messages, docs, notebook });
      }

      if (sub === "/messages" && method === "POST") {
        if (room.type === "solo") {
          return sendError(req, res, 400, "Phòng cá nhân dùng sổ nháp thay cho chat.", "SOLO_NO_CHAT");
        }
        if (room.created_by !== user.id && !(await S.isMember(pool, room.id, user.id))) {
          return sendError(req, res, 403, "Bạn cần vào phòng trước khi gửi tin nhắn.", "NOT_ROOM_MEMBER");
        }
        const body = await readBody(req);
        const text = U.cleanText(body.text, 600);
        if (!text) return sendError(req, res, 400, "Tin nhắn không được để trống.", "EMPTY_MESSAGE");
        const message = await S.addMessage(ctx, room, user, text);
        sse.send(room.id, "message", { ...message, me: false });
        return sendJSON(req, res, 201, { message });
      }

      if (sub === "/docs" && method === "POST") {
        /* Chỉ chủ phòng hoặc thành viên đang trong phòng mới ghim tài liệu. */
        if (room.created_by !== user.id && !(await S.isMember(pool, room.id, user.id))) {
          return sendError(req, res, 403, "Chỉ thành viên trong phòng mới ghim được tài liệu.", "NOT_ROOM_MEMBER");
        }
        let body = {};
        let file = null;
        if (String(req.headers["content-type"] || "").startsWith("multipart/form-data")) {
          const raw = await readRawBody(req, MAX_UPLOAD);
          const parsed = parseMultipart(raw, req.headers["content-type"]);
          body = parsed.fields;
          file = parsed.file;
        } else {
          body = await readBody(req);
        }
        const title = U.cleanText(body.title, 140) || U.cleanText(file && file.name, 140);
        if (!title) return sendError(req, res, 400, "Hãy nhập tên tài liệu.", "BAD_DOC");
        if (file) {
          const allowed = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|txt|zip|png|jpe?g|webp|gif)$/i.test(file.name);
          if (!allowed) return sendError(req, res, 400, "Định dạng tệp không được hỗ trợ.", "INVALID_FILE_TYPE");
          if (!file.buffer.length) return sendError(req, res, 400, "Tệp tải lên đang trống.", "EMPTY_FILE");
        }
        let uploadedUrl = U.cleanText(body.url, 400);
        const doc = await S.addDoc(ctx, room, user, {
          title,
          meta: U.cleanText(body.meta, 80) || (file ? `${file.type} · ${Math.max(1, Math.round(file.buffer.length / 1024))} KB` : "Tài liệu"),
          url: uploadedUrl,
          file,
        });
        sse.send(room.id, "docs", { docs: await S.roomDocs(pool, room.id) });
        return sendJSON(req, res, 201, { doc });
      }

      if (sub === "/leave" && method === "POST") {
        await S.leaveRoom(ctx, room, user);
        await sse.broadcastPresence(room.id);
        return sendJSON(req, res, 200, { ok: true });
      }
    }

    /* Sự kiện thời gian thực -------------------------------------------- */
    if (pathname === "/api/events" && method === "GET") {
      const roomId = url.searchParams.get("room") || "";
      const room = await S.getRoom(ctx, user, roomId);
      if (!room) return sendError(req, res, 404, "Không tìm thấy phòng học.", "ROOM_NOT_FOUND");
      await S.joinRoom(ctx, room, user);

      securityHeaders(res);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.statusCode = 200;
      res.write("retry: 3000\n\n");

      const client = sse.add(room.id, res, user);
      const members = await S.membersFor(pool, room, user.id);
      res.write(`event: presence\ndata: ${JSON.stringify({ members })}\n\n`);
      await sse.broadcastPresence(room.id);
      req.on("close", () => sse.remove(room.id, client));
      return;
    }

    /* Focus -------------------------------------------------------------- */
    if (pathname === "/api/focus" && method === "POST") {
      const body = await readBody(req);
      const roomId = U.cleanText(body.roomId, 80);
      const room = roomId ? await S.getRoom(ctx, user, roomId) : null;
      if (room) await S.updatePresence(pool, room.id, user.id);
      const result = await S.awardFocus(ctx, user, { seconds: body.seconds, roomId: room ? room.id : "" });
      if (result.awardedSeconds && room) {
        sse.send(room.id, "focus", {
          userId: user.id,
          name: user.name,
          todayMinutes: result.todayMinutes,
        });
        await sse.broadcastPresence(room.id);
      }
      return sendJSON(req, res, 200, result);
    }

    /* Shop --------------------------------------------------------------- */
    if (pathname === "/api/shop" && method === "GET") {
      return sendJSON(req, res, 200, await S.shopState(ctx, user));
    }

    if (pathname === "/api/shop/buy" && method === "POST") {
      const body = await readBody(req);
      const result = await S.buyItem(ctx, user, U.cleanText(body.id, 40));
      return sendJSON(req, res, 200, result);
    }

    return sendError(req, res, 404, "API không tồn tại.", "NOT_FOUND");
  }

  /* ----------------------------- Static -------------------------------- */

  const staticCache = new Map();

  function safeStatic(urlPath) {
    let pathname;
    try {
      pathname = decodeURIComponent(urlPath);
    } catch {
      return null;
    }
    if (pathname === "/") pathname = "/index.html";
    if (pathname.endsWith("/")) pathname += "index.html";
    if (BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
    if (BLOCKED_FILES.includes(pathname)) return null;
    if (pathname.split("/").some((part) => part.startsWith("."))) return null;
    const resolved = path.resolve(ROOT, `.${pathname}`);
    if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
    return resolved;
  }

  async function serveStatic(req, res, filePath, { html = false } = {}) {
    const stat = await fsp.stat(filePath);
    const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;

    securityHeaders(res);
    res.setHeader("ETag", etag);
    /* Không cache mù: trình duyệt luôn hỏi lại, server trả 304 khi chưa đổi. */
    res.setHeader("Cache-Control", html ? "no-cache" : "public, max-age=0, must-revalidate");

    if (req.headers["if-none-match"] === etag) {
      res.statusCode = 304;
      res.end();
      return;
    }

    const key = `${filePath}:${stat.mtimeMs}`;
    let entry = staticCache.get(key);
    if (!entry) {
      entry = {
        raw: await fsp.readFile(filePath),
        gz: null,
        type: MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      };
      if (staticCache.size > 80) staticCache.clear();
      staticCache.set(key, entry);
    }

    res.setHeader("Content-Type", entry.type);
    let buffer = entry.raw;
    if (entry.raw.length >= 1024 && acceptsGzip(req)) {
      if (!entry.gz) entry.gz = await gzip(entry.raw);
      buffer = entry.gz;
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
    }
    res.setHeader("Content-Length", buffer.length);
    res.statusCode = 200;
    res.end(req.method === "HEAD" ? undefined : buffer);
  }

  /* ----------------------------- Router -------------------------------- */

  async function handle(req, res) {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      if (req.method !== "GET" && req.method !== "HEAD" && !sameOriginRequest(req)) {
        return sendError(req, res, 403, "Yêu cầu không cùng nguồn gốc.", "BAD_ORIGIN");
      }
      return handleApi(req, res, url);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendError(req, res, 405, "Phương thức không được hỗ trợ.", "METHOD_NOT_ALLOWED");
    }

    if (!serveStaticEnabled) {
      return sendError(
        req,
        res,
        404,
        "Backend chỉ phục vụ /api. Giao diện được phục vụ bởi container frontend.",
        "NOT_FOUND"
      );
    }

    const filePath = safeStatic(url.pathname);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return sendBody(
        req,
        res,
        404,
        "text/html; charset=utf-8",
        '<!doctype html><html lang="vi"><meta charset="utf-8"><title>Không tìm thấy — StudyWithMe</title>' +
          '<body style="font-family:system-ui;background:#111110;color:#eee;display:grid;place-items:center;height:100vh;margin:0">' +
          '<div style="text-align:center"><h1 style="font-size:22px">404</h1>' +
          '<p style="color:#959590">Trang bạn tìm không tồn tại.</p>' +
          '<a style="color:#6ad86c" href="/">Về trang chủ</a></div></body></html>'
      );
    }

    return serveStatic(req, res, filePath, { html: path.extname(filePath).toLowerCase() === ".html" });
  }

  let inFlight = 0;

  const server = http.createServer((req, res) => {
    inFlight += 1;
    handle(req, res)
      .catch((err) => {
      const status = err && err.status ? err.status : 500;
      if (status >= 500) console.error("[StudyWithMe]", err);
      if (res.headersSent) {
        try {
          res.end();
        } catch {
          /* ignore */
        }
        return;
      }
      /* Không trả chi tiết lỗi nội bộ (SQL, stack) ra ngoài. */
        const message = status >= 500 ? "Lỗi máy chủ. Vui lòng thử lại sau." : err.message;
        return sendError(req, res, status, message, status >= 500 ? "INTERNAL" : err.code).catch(() => {
          try {
            res.end();
          } catch {
            /* ignore */
          }
        });
      })
      .finally(() => {
        inFlight -= 1;
      });
  });

  const cleanupTimer = setInterval(async () => {
    try {
      const removed = await DB.purgeStaleGuests(pool, GUEST_RETENTION_DAYS);
      if (removed) console.log(`[StudyWithMe] đã dọn ${removed} tài khoản khách không hoạt động.`);
    } catch (err) {
      console.error("[StudyWithMe] cleanup", err.message);
    }
  }, 6 * 3600 * 1000);
  cleanupTimer.unref();

  const close = () =>
    new Promise((resolve) => {
      clearInterval(cleanupTimer);
      sse.closeAll();
      server.close(async () => {
        /* Chờ các handler còn đang chạy xong trước khi đóng pool, tránh
           "Cannot use a pool after calling end". */
        const deadline = Date.now() + 3000;
        while (inFlight > 0 && Date.now() < deadline) {
          await new Promise((next) => setTimeout(next, 25));
        }
        try {
          await pool.end();
        } catch {
          /* ignore */
        }
        try {
          await kv.close();
        } catch {
          /* ignore */
        }
        resolve();
      });
    });

  return { server, pool, kv, ctx, close, databaseUrl, kvKind: kv.kind };
}

/* -------------------------------------------------------------------------- */

function describeDatabase(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}:${url.port || 5432}${url.pathname}`;
  } catch {
    return "database";
  }
}

async function main() {
  const app = await createApp();
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "0.0.0.0";

  app.server.listen(port, host, () => {
    const shown = host === "0.0.0.0" ? "localhost" : host;
    console.log(`\n  StudyWithMe đang chạy tại http://${shown}:${port}`);
    console.log(`  Postgres: ${describeDatabase(app.databaseUrl)}`);
    console.log(`  Khoá phiên: ${app.kvKind}\n  Nhấn Ctrl+C để dừng.\n`);
  });

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    app.close().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[StudyWithMe] không khởi động được:", err.message);
    process.exit(1);
  });
}

module.exports = { createApp, ROOT };
