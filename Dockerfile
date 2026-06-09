# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# The frontend only needs to know where the Node API lives.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json bun.lockb* package-lock.json* ./
RUN if [ -f bun.lockb ]; then \
      npm i -g bun && bun install; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

COPY . .
RUN npm run build

# --- runtime stage (nginx) ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
