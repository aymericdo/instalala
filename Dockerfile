FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src
RUN mkdir -p /app/output /app/public-images && chown node:node /app/output /app/public-images

USER node

CMD ["node", "src/scheduler.js"]
