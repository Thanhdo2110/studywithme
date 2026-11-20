/* Cửa hàng avatar/frame — mua bằng Study Star. */
const U = require("../util");

/* -------------------------------------------------------------------------- */
/* Cửa hàng                                                                    */
/* -------------------------------------------------------------------------- */

async function shopState(ctx, user) {
  const { rows } = await ctx.pool.query("SELECT item_id FROM owned WHERE user_id = $1", [user.id]);
  return { items: U.SHOP_ITEMS, owned: rows.map((row) => row.item_id), stars: user.stars };
}

async function buyItem(ctx, user, itemId) {
  const item = U.SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item) {
    const err = new Error("Vật phẩm không tồn tại.");
    err.status = 404;
    err.code = "ITEM_NOT_FOUND";
    throw err;
  }

  const client = await ctx.pool.connect();
  let stars = 0;
  try {
    await client.query("BEGIN");

    const owned = await client.query("SELECT 1 AS yes FROM owned WHERE user_id = $1 AND item_id = $2", [
      user.id,
      itemId,
    ]);
    if (owned.rows.length) {
      const err = new Error("Bạn đã sở hữu vật phẩm này.");
      err.status = 409;
      err.code = "ALREADY_OWNED";
      throw err;
    }

    const paid = await client.query(
      "UPDATE users SET stars = stars - $1 WHERE id = $2 AND stars >= $1 RETURNING stars",
      [item.price, user.id]
    );
    if (!paid.rows.length) {
      const err = new Error(`Cần thêm ${(item.price - user.stars).toLocaleString("vi-VN")} ★ để mở khoá.`);
      err.status = 402;
      err.code = "NOT_ENOUGH_STARS";
      throw err;
    }

    await client.query("INSERT INTO owned (user_id, item_id, acquired_at) VALUES ($1, $2, $3)", [
      user.id,
      item.id,
      Date.now(),
    ]);

    await client.query("COMMIT");
    stars = Number(paid.rows[0].stars);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await ctx.pool.query("SELECT item_id FROM owned WHERE user_id = $1", [user.id]);
  return { stars, owned: rows.map((row) => row.item_id), item };
}
module.exports = { shopState, buyItem };
