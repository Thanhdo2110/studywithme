# StudyWithMe — một image duy nhất phục vụ cả frontend tĩnh và REST API.
FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine

ENV NODE_ENV=production \
    TZ=Asia/Ho_Chi_Minh \
    PORT=3000

# tzdata để mốc "hôm nay" của heatmap/chuỗi ngày đúng giờ Việt Nam.
RUN apk add --no-cache tzdata

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server ./server
COPY tests ./tests
COPY assets ./assets
COPY README.md LICENSE ./
COPY *.html ./

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(function(r){process.exit(r.ok?0:1)}).catch(function(){process.exit(1)})"

CMD ["node", "server/index.js"]
