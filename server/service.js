/* Facade service — API công khai cho index.js. Chia nhỏ theo domain trong
   services/: auth (phiên), rooms (phòng & thành viên & chat/docs), state
   (bootstrap & lưu trạng thái), focus (giờ học), shop (cửa hàng),
   garden (vườn & hồ sơ thành viên & thống kê). */
const shared = require("./services/shared");
const auth = require("./services/auth");
const rooms = require("./services/rooms");
const focus = require("./services/focus");
const shop = require("./services/shop");
const garden = require("./services/garden");
const state = require("./services/state");

module.exports = {
  ...shared,
  ...auth,
  ...rooms,
  ...focus,
  ...shop,
  ...garden,
  ...state,
};
