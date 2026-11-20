/* Giờ học hợp lệ: credit chống gian lận (Redis) + cộng focus_daily. */
const U = require("../util");
const { FOCUS_KEY_TTL, totalsFor } = require("./shared");
const { getRoom } = require("./rooms");
const DB = require("../db");

/* Focus + Study Stars                                                         */
/* -------------------------------------------------------------------------- */

/* Credit nằm trong Redis: sống sót khi restart app và dùng chung giữa các
   instance. Mỗi giây trôi qua sinh ~1,25 giây công, tối đa 300 giây mỗi lần. */
async function consumeFocusCredit(kv, userId, seconds) {
  const key = `swm:focus:${userId}`;
  const now = Date.now();
  const raw = await kv.get(key);

  let bucket = null;
  if (raw) {
    try {
      bucket = JSON.parse(raw);
    } catch {
      bucket = null;
    }
  }
  if (!bucket || !Number.isFinite(Number(bucket.at)) || !Number.isFinite(Number(bucket.credit))) {
    bucket = { at: now - 60000, credit: 60 };
  }

  const elapsed = Math.max(0, (now - Number(bucket.at)) / 1000);
  bucket.credit = Math.min(300, Number(bucket.credit) + elapsed * 1.25 + 1);
  const used = Math.max(0, Math.min(seconds, bucket.credit, 300));
  bucket.credit = Number(bucket.credit) - used;
  bucket.at = now;

  await kv.set(key, JSON.stringify({ at: bucket.at, credit: bucket.credit }), { EX: FOCUS_KEY_TTL });
  return Math.floor(used);
}

async function todayMinutes(queryable, userId) {
  const { rows } = await queryable.query("SELECT seconds FROM focus_daily WHERE user_id = $1 AND day = $2", [
    userId,
    U.todayISO(),
  ]);
  return Math.round(Number(rows[0] ? rows[0].seconds : 0) / 60);
}

async function focusSnapshot(queryable, userId) {
  const fresh = (await queryable.query("SELECT * FROM users WHERE id = $1", [userId])).rows[0];
  return {
    awardedSeconds: 0,
    awardedStars: 0,
    stars: fresh.stars,
    streak: fresh.streak,
    todayMinutes: await todayMinutes(queryable, userId),
    totalMinutes: await totalsFor(queryable, userId, 90),
  };
}

async function awardFocus(ctx, user, { seconds, roomId }) {
  const requested = U.clampInt(seconds, 0, 300, 0);
  if (!requested) return focusSnapshot(ctx.pool, user.id);

  const used = await consumeFocusCredit(ctx.kv, user.id, requested);
  if (!used) return focusSnapshot(ctx.pool, user.id);

  const room = roomId ? await getRoom(ctx, user, roomId) : null;
  const subject = room ? room.subject : "toan";
  const now = new Date();
  const day = U.iso(now);
  const hour = String(now.getHours());

  const client = await ctx.pool.connect();
  let afterSeconds = 0;
  let awardedStars = 0;
  let streak = 0;
  let todayValue = 0;
  let totalMinutes = 0;

  try {
    await client.query("BEGIN");

    const row = (
      await client.query("SELECT * FROM focus_daily WHERE user_id = $1 AND day = $2 FOR UPDATE", [user.id, day])
    ).rows[0];

    const readJson = (value) => {
      if (!value) return {};
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }
      return value;
    };

    const bySubject = readJson(row && row.by_subject);
    const byHour = readJson(row && row.by_hour);
    const beforeSeconds = row ? Number(row.seconds) : 0;
    afterSeconds = beforeSeconds + used;
    bySubject[subject] = (bySubject[subject] || 0) + used;
    byHour[hour] = (byHour[hour] || 0) + used;

    await client.query(
      `INSERT INTO focus_daily (user_id, day, seconds, by_subject, by_hour) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, day) DO UPDATE SET seconds = excluded.seconds,
         by_subject = excluded.by_subject, by_hour = excluded.by_hour`,
      [user.id, day, afterSeconds, JSON.stringify(bySubject), JSON.stringify(byHour)]
    );

    const beforeMinutes = Math.floor(beforeSeconds / 60);
    const afterMinutes = Math.floor(afterSeconds / 60);
    awardedStars = Math.max(0, afterMinutes - beforeMinutes);

    if (awardedStars) {
      await client.query("UPDATE users SET stars = stars + $1 WHERE id = $2", [awardedStars, user.id]);
    }

    streak = await DB.computeStreak(client, user.id);
    await client.query("UPDATE users SET streak = $1 WHERE id = $2", [streak, user.id]);

    await client.query("COMMIT");
    todayValue = Math.round(afterSeconds / 60);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  totalMinutes = await totalsFor(ctx.pool, user.id, 90);
  const fresh = (await ctx.pool.query("SELECT * FROM users WHERE id = $1", [user.id])).rows[0];

  return {
    awardedSeconds: used,
    awardedStars,
    stars: fresh.stars,
    streak,
    todayMinutes: todayValue,
    totalMinutes,
    day,
    subject,
  };
}
module.exports = { consumeFocusCredit, todayMinutes, focusSnapshot, awardFocus };
