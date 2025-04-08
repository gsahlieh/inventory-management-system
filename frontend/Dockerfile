# /frontend/Dockerfile

# Stage 1: Build dependencies
FROM node:21.7.3-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

#---------------------------------------------------------------------
# Stage 2: Build the application
FROM node:21.7.3-alpine AS builder

# --- Add ARG declarations here ---
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
# Add any other NEXT_PUBLIC_ vars needed at build time
ARG NEXT_PUBLIC_API_BASE_URL

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# --- Add ENV declarations here to make ARGs available to RUN ---
# These ENV lines make the build ARGs available to the subsequent RUN command
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Build the Next.js application
# NEXT_PUBLIC_ variables are baked in here
RUN npm run build

#---------------------------------------------------------------------
# Stage 3: Production image
FROM node:21.7.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
# Don't expose ports here, Docker Compose handles mapping
# EXPOSE 3000 # Not strictly needed when using docker-compose ports

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# You only need to copy build artifacts
COPY --from=builder /app/public ./public
# Copy the standalone output if you configured it, otherwise copy .next
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

# Set the correct command to start the production server
CMD ["npm", "start"]
