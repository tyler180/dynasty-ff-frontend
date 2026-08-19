FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_OIDC_ISSUER=https://auth.k8s.749rmw.com/application/o/dynasty-ff/
ARG NEXT_PUBLIC_OIDC_CLIENT_ID=dynasty-ff-frontend
ARG NEXT_PUBLIC_API_BASE_URL=https://5y8s0du210.execute-api.us-west-2.amazonaws.com
ARG NEXT_PUBLIC_LEAGUE_SEASON=2026
ARG NEXT_PUBLIC_LEAGUE_ID=79286
ARG NEXT_PUBLIC_FRANCHISE_ID=0005
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_OIDC_ISSUER=$NEXT_PUBLIC_OIDC_ISSUER \
    NEXT_PUBLIC_OIDC_CLIENT_ID=$NEXT_PUBLIC_OIDC_CLIENT_ID \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_LEAGUE_SEASON=$NEXT_PUBLIC_LEAGUE_SEASON \
    NEXT_PUBLIC_LEAGUE_ID=$NEXT_PUBLIC_LEAGUE_ID \
    NEXT_PUBLIC_FRANCHISE_ID=$NEXT_PUBLIC_FRANCHISE_ID
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
