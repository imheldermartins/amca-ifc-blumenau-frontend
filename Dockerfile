# Frontend Cub's — build Vite servido por nginx na porta 80.
#
# O nginx também faz proxy de /api/v1 e /socket.io para o backend (ver
# nginx/nginx.conf) — por isso o build NÃO define VITE_CUBS_API_URL:
# o app chama a própria origem e o nginx encaminha (.env.production).
# O .dockerignore exclui o .env local para ele não vazar no bundle.
FROM node:24-alpine AS build

WORKDIR /app

# Produção usa o host dedicado da API; vazio mantém o fallback same-origin em
# desenvolvimento. O socket.io deriva a origem deste mesmo valor.
ARG VITE_CUBS_API_URL
ENV VITE_CUBS_API_URL=${VITE_CUBS_API_URL}

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM nginx:alpine

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
