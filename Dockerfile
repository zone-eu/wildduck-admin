FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache nginx
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist /usr/share/nginx/html
COPY server ./server
COPY scripts/hash-password.cjs ./scripts/hash-password.cjs
COPY scripts/reset-2fa.cjs ./scripts/reset-2fa.cjs
COPY config ./config
COPY LICENSE LICENSE_ET ./
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 8080
VOLUME ["/app/data"]
ENTRYPOINT ["/entrypoint.sh"]
