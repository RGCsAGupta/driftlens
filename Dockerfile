FROM node:24.15.0-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.15.0-alpine AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG DRIFTLENS_BUILD_SHA
RUN test "$(printf '%s' "$DRIFTLENS_BUILD_SHA" | grep -Ec '^[0-9a-f]{40}$')" -eq 1
ENV DRIFTLENS_BUILD_SHA=$DRIFTLENS_BUILD_SHA
RUN npm run build

FROM node:24.15.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DRIFTLENS_DATA_DIR=/data
ARG DRIFTLENS_BUILD_SHA
ENV DRIFTLENS_BUILD_SHA=$DRIFTLENS_BUILD_SHA

RUN addgroup --system --gid 10001 nodejs \
  && adduser --system --uid 10001 --ingroup nodejs nextjs \
  && install -d -o nextjs -g nodejs -m 0750 /data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER 10001:10001
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
