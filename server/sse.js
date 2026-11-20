/* ==========================================================================
   StudyWithMe — SSE hub
   Quản lý các kết nối EventSource theo phòng: ping giữ kết nối, presence
   broadcast (một query cho cả phòng), đóng kết nối khi phòng giải tán.
   ========================================================================== */

function createSseHub({ pool, service }) {
  const streams = new Map(); // roomId -> Set<client>

  const sse =  {
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
          service.updatePresence(pool, roomId, user.id).catch(() => {});
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
      const base = await service.membersFor(pool, room, null);
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

  /* Số kết nối SSE đang mở của một người — chống cạn socket khi mở
     hàng trăm tab hoặc script tự nối lại vô hạn. */
  sse.countForUser = function countForUser(userId) {
    let n = 0;
    streams.forEach((set) =>
      set.forEach((client) => {
        if (client.userId === userId) n += 1;
      })
    );
    return n;
  };

  return sse;
}

module.exports = { createSseHub };
