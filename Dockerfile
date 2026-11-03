# NasPilot · 作者：小余  QQ 6214880
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8899 \
    NASPLOT_DATA=/app/data

COPY package.json ./
COPY server ./server
COPY public ./public

RUN mkdir -p /app/data && chmod -R 755 /app

EXPOSE 8899

HEALTHCHECK --interval=30s --timeout=4s --start-period=8s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8899/api/meta >/dev/null 2>&1 || exit 1

CMD ["node", "server/index.js"]
