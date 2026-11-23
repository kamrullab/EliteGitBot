FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
EXPOSE 5173 8787
CMD ["npm", "run", "dev"]
