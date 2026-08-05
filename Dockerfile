FROM node:20-alpine AS builder

WORKDIR /app

# Install client dependencies and build
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/

# Copy built client
COPY --from=builder /app/client/dist ./client/dist

# PM2 for cluster mode
COPY package*.json ./
COPY ecosystem.config.js ./
RUN npm install pm2 -g

ENV NODE_ENV=production
EXPOSE 5000

# Run with PM2 cluster mode (uses all CPU cores)
CMD ["pm2-runtime", "ecosystem.config.js"]
