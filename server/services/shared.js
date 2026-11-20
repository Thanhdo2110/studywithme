/* Dùng chung giữa các domain service — hằng số, serializer, helper nhỏ.
   KHÔNG chứa nghiệp vụ. Thứ tự require: shared -> auth -> rooms -> focus/shop/garden -> state. */
const path = require("node:path");

const U = require("../util");

async function totalsFor(queryable, userId, days) {
  const from = U.iso(U.addDays(new Date(), -(days - 1)));
  const { rows } = await queryable.query(
    "SELECT COALESCE(SUM(seconds), 0)::int AS seconds FROM focus_daily WHERE user_id = $1 AND day >= $2",
    [userId, from]
  );
  return Math.round(Number(rows[0].seconds || 0) / 60);
}

/* -------------------------------------------------------------------------- */
/* Hồ sơ                                                                       */
/* -------------------------------------------------------------------------- */

function serializeProfile(user) {
  return {
    name: user.name,
    grade: user.grade,
    exam: user.exam,
    examDate: user.exam_date,
    targetSchool: user.target_school,
    currentSchool: user.current_school,
    gender: user.gender,
    goalHours: user.goal_hours,
    avatar: user.avatar,
    accent: user.accent,
    theme: user.theme,
    bio: user.bio,
    stars: user.stars,
    streak: user.streak,
    reminders: Boolean(user.reminders),
    sounds: Boolean(user.sounds),
    heartbeat: Boolean(user.heartbeat),
  };
}

function serializeAccount(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isGuest: Boolean(user.is_guest),
    createdAt: user.created_at,
  };
}
module.exports = {
  SESSION_TTL: 30 * 24 * 3600 * 1000,
  PRESENCE_WINDOW: 5 * 60 * 1000,
  MEMBER_TTL: 2 * 60 * 1000,
  FOCUS_KEY_TTL: 3600,
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.resolve(__dirname, "..", "..", "uploads"),
  totalsFor,
  serializeProfile,
  serializeAccount,
};
