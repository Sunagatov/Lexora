FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=https://lexora.zuf.uk
ARG VITE_PAGE_SIZES=10,20,50,100
ARG VITE_DEFAULT_PAGE_SIZE=20
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_PAGE_SIZES=$VITE_PAGE_SIZES
ENV VITE_DEFAULT_PAGE_SIZE=$VITE_DEFAULT_PAGE_SIZE
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
