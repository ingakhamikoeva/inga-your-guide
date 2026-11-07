FROM node:22.23.4-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8787
CMD ["node", "index.js"]
