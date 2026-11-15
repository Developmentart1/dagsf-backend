FROM node:20-alpine

WORKDIR /app

# Cliente de PostgreSQL para depuracion
RUN apk add --no-cache postgresql-client

COPY package*.json ./
# npm ci exige package-lock.json; fallback a npm install si aun no existe
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
