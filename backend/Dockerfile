FROM node:20

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p sessions

# Limpa o dist antigo e tenta compilar
RUN rm -rf dist && npx tsc --skipLibCheck || true

EXPOSE 3001

# Tenta rodar pelo arquivo compilado, se falhar, tenta rodar via ts-node diretamente
CMD ["sh", "-c", "node dist/server.js || npx ts-node src/server.ts"]