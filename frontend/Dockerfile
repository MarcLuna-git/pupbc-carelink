# Build context: frontend/.

FROM node:20-alpine AS builder

WORKDIR /app

# Unahin ang package files para reusable ang dependency layer.
COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Build-time ang VITE_* values; ipinapasa sa ARG/ENV bago mag-build.
ARG VITE_API_URL
ARG VITE_APP_NAME
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

# Render ang nagse-set ng PORT.
EXPOSE $PORT

CMD ["sh", "-c", "serve -s dist -l $PORT"]
