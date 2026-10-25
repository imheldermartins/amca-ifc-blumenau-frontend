# Frontend Cub's — build Vite servido por nginx na porta 80.
# A produção define VITE_CUBS_API_URL para o host dedicado da API; o .dockerignore
# exclui envs locais para que segredos nunca entrem no contexto do build.
FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build

WORKDIR /app

# Produção usa o host dedicado da API; vazio mantém o fallback same-origin em
# desenvolvimento. O socket.io deriva a origem deste mesmo valor.
ARG VITE_CUBS_API_URL
ENV VITE_CUBS_API_URL=${VITE_CUBS_API_URL}

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM nginx:alpine@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
