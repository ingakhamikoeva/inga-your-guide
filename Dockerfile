# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Build-time переменные (фронту нужны URL и anon-key Supabase)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

COPY package.json bun.lockb* package-lock.json* ./
RUN if [ -f bun.lockb ]; then \
      npm i -g bun && bun install --frozen-lockfile; \
    else \
      npm ci; \
    fi

COPY . .
RUN npm run build

# --- runtime stage (nginx) ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
