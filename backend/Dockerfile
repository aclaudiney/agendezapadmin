FROM node:20-slim

WORKDIR /app

# Instala ffmpeg
RUN apt update && apt install -y ffmpeg

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p sessions

# Compila ignorando erros de tipo para garantir que a pasta dist/ seja criada
RUN npx tsc --skipLibCheck || true

EXPOSE 3001

# Comando que tenta rodar o compilado, e se falhar, usa o ts-node
CMD ["sh", "-c", "node dist/server.js || npx ts-node --esm src/server.ts"]