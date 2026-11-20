/* Vườn học tập: cây & thú cưng, thẻ hồ sơ thành viên, thống kê. */
const U = require("../util");
const DB = require("../db");
const { serializeProfile, totalsFor } = require("./shared");

/* -------------------------------------------------------------------------- */
/* Thống kê                                                                    */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Vườn học tập — cây trồng & thú cưng                                        */
/* -------------------------------------------------------------------------- */

function emptyGarden() {
  return { plant: null, pet: null, plants: {}, pets: {} };
}

function normalizeGarden(raw) {
  const garden = emptyGarden();
  if (!raw || typeof raw !== "object") return garden;
  const plantIds = new Set(U.GARDEN_PLANTS.map((item) => item.id));
  const petIds = new Set(U.GARDEN_PETS.map((item) => item.id));

  garden.plant = plantIds.has(raw.plant) ? raw.plant : null;
  garden.pet = petIds.has(raw.pet) ? raw.pet : null;

  const levels = (source, ids) => {
    const out = {};
    if (!source || typeof source !== "object") return out;
    ids.forEach((id) => {
      const level = Number(source[id]);
      if (Number.isFinite(level) && level >= 1) out[id] = Math.min(U.GARDEN_MAX_LEVEL, Math.floor(level));
    });
    return out;
  };
  garden.plants = levels(raw.plants, plantIds);
  garden.pets = levels(raw.pets, petIds);
  return garden;
}

async function gardenFor(pool, userId) {
  const { rows } = await pool.query("SELECT data FROM gardens WHERE user_id = $1", [userId]);
  return normalizeGarden(rows[0] ? rows[0].data : null);
}

/* Hồ sơ công khai của một thành viên — cho thẻ hồ sơ khi bấm avatar trong
   phòng. Chỉ trả trường công khai, kèm vườn (loại cây/thú + cấp) để trang
   trí nền hoa. */
async function memberProfile(ctx, userId) {
  if (!/^[\w-]{3,64}$/.test(String(userId || ""))) {
    const err = new Error("Thành viên không hợp lệ.");
    err.status = 400;
    err.code = "BAD_USER_ID";
    throw err;
  }
  const { rows } = await ctx.pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  const user = rows[0];
  if (!user) {
    const err = new Error("Không tìm thấy thành viên này.");
    err.status = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }
  const garden = await gardenFor(ctx.pool, user.id);
  const p = serializeProfile(user);
  return {
    id: user.id,
    name: p.name,
    avatar: p.avatar,
    grade: p.grade,
    exam: p.exam,
    examDate: p.examDate,
    targetSchool: p.targetSchool,
    currentSchool: p.currentSchool,
    gender: p.gender,
    bio: p.bio,
    stars: p.stars,
    streak: p.streak,
    totalFocus: await totalsFor(ctx.pool, user.id, 90),
    garden: {
      plant: garden.plant,
      plantLevel: garden.plant ? (garden.plants[garden.plant] || 1) : 0,
      pet: garden.pet,
      petLevel: garden.pet ? (garden.pets[garden.pet] || 1) : 0,
    },
  };
}

async function gardenState(ctx, user) {
  return { garden: await gardenFor(ctx.pool, user.id), stars: user.stars, catalog: U.gardenCatalog() };
}

function gardenListFor(kind) {
  if (kind === "plant") return U.GARDEN_PLANTS;
  if (kind === "pet") return U.GARDEN_PETS;
  return null;
}

async function saveGarden(pool, userId, garden, client) {
  const run = client || pool;
  await run.query(
    `INSERT INTO gardens (user_id, data, updated_at) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (user_id) DO UPDATE SET data = $2::jsonb, updated_at = $3`,
    [userId, JSON.stringify(garden), Date.now()]
  );
}

async function chooseCompanion(ctx, user, kind, id) {
  const list = gardenListFor(kind);
  if (!list) {
    const err = new Error("Loại đồng hành không hợp lệ.");
    err.status = 400;
    err.code = "INVALID_KIND";
    throw err;
  }
  if (!list.some((item) => item.id === id)) {
    const err = new Error("Không tìm thấy lựa chọn này.");
    err.status = 404;
    err.code = "GARDEN_NOT_FOUND";
    throw err;
  }

  const garden = await gardenFor(ctx.pool, user.id);
  const levels = kind === "plant" ? garden.plants : garden.pets;
  if (!levels[id]) levels[id] = 1;
  if (kind === "plant") garden.plant = id;
  else garden.pet = id;

  await saveGarden(ctx.pool, user.id, garden);
  return { garden, stars: user.stars };
}

async function tendGarden(ctx, user, kind, id) {
  const list = gardenListFor(kind);
  if (!list || !list.some((item) => item.id === id)) {
    const err = new Error("Không tìm thấy cây trồng hoặc thú cưng này.");
    err.status = 404;
    err.code = "GARDEN_NOT_FOUND";
    throw err;
  }

  const client = await ctx.pool.connect();
  let garden = null;
  let stars = 0;
  let nextLevel = 0;
  let cost = 0;
  try {
    await client.query("BEGIN");

    const row = await client.query("SELECT data FROM gardens WHERE user_id = $1 FOR UPDATE", [user.id]);
    garden = normalizeGarden(row.rows[0] ? row.rows[0].data : null);
    if (garden[kind] !== id) {
      const err = new Error("Hãy chọn đồng hành này trước khi chăm sóc.");
      err.status = 409;
      err.code = "NOT_SELECTED";
      throw err;
    }

    const levels = kind === "plant" ? garden.plants : garden.pets;
    const level = levels[id] || 1;
    if (level >= U.GARDEN_MAX_LEVEL) {
      const err = new Error("Đồng hành đã đạt cấp cao nhất rồi.");
      err.status = 409;
      err.code = "MAX_LEVEL";
      throw err;
    }

    cost = (kind === "plant" ? U.GARDEN_COSTS : U.GARDEN_PET_COSTS)[level - 1];
    const paid = await client.query(
      "UPDATE users SET stars = stars - $1 WHERE id = $2 AND stars >= $1 RETURNING stars",
      [cost, user.id]
    );
    if (!paid.rows.length) {
      const err = new Error(`Cần thêm ${(cost - Number(user.stars || 0)).toLocaleString("vi-VN")} ★ để chăm sóc tiếp.`);
      err.status = 402;
      err.code = "NOT_ENOUGH_STARS";
      throw err;
    }

    nextLevel = level + 1;
    levels[id] = nextLevel;
    await saveGarden(ctx.pool, user.id, garden, client);
    await client.query("COMMIT");
    stars = Number(paid.rows[0].stars);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { garden, stars, level: nextLevel, cost };
}

async function statsFor(ctx, user, days) {
  const safeDays = U.clampInt(days, 7, 400, 90);
  const summary = await DB.focusSummary(ctx.pool, user.id, safeDays);
  const streak = await DB.computeStreak(ctx.pool, user.id);
  return {
    days: safeDays,
    daily: summary.daily,
    bySubject: summary.bySubject,
    hours: summary.hours,
    totalMinutes: summary.totalMinutes,
    totalSeconds: summary.totalSeconds,
    streak,
  };
}
module.exports = {
  emptyGarden,
  normalizeGarden,
  gardenFor,
  memberProfile,
  gardenState,
  saveGarden,
  chooseCompanion,
  tendGarden,
  statsFor,
};
