/* Xác thực & phiên: Redis session, guest, nâng cấp tài khoản. */
const crypto = require("node:crypto");

const U = require("../util");
const DB = require("../db");
const { SESSION_TTL } = require("./shared");

/* -------------------------------------------------------------------------- */
/* Phiên đăng nhập (Redis, TTL tự dọn)                                         */
/* -------------------------------------------------------------------------- */

async function createSession(ctx, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await ctx.kv.set(`swm:sess:${token}`, userId, { EX: Math.floor(SESSION_TTL / 1000) });
  return token;
}

async function destroySession(ctx, token) {
  if (!token) return;
  await ctx.kv.del(`swm:sess:${token}`);
}

async function userByToken(ctx, token) {
  if (!token) return null;
  const userId = await ctx.kv.get(`swm:sess:${token}`);
  if (!userId) return null;
  const { rows } = await ctx.pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  if (!rows[0]) {
    /* Tài khoản đã bị dọn (guest hết hạn) nhưng phiên còn trong Redis. */
    await ctx.kv.del(`swm:sess:${token}`);
    return null;
  }
  return rows[0];
}

async function ensureGuest(ctx) {
  return DB.createUser(ctx.pool, { isGuest: true });
}

async function upgradeGuest(ctx, user, { name, email, password }) {
  const result = await U.hashPassword(password);
  const { rows } = await ctx.pool.query(
    `UPDATE users SET email = $1, pass_hash = $2, pass_salt = $3, name = $4, is_guest = FALSE
     WHERE id = $5 RETURNING *`,
    [email, result.hash, result.salt, name, user.id]
  );
  return rows[0];
}

async function createAccount(ctx, { name, email, password }) {
  return DB.createUser(ctx.pool, { name, email, password, isGuest: false });
}
module.exports = {
  createSession,
  destroySession,
  userByToken,
  ensureGuest,
  upgradeGuest,
  createAccount,
};
