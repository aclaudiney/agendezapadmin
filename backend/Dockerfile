FROM node:20-slim

WORKDIR /app

# Instala ffmpeg e dependências básicas
RUN apt update && apt install -y ffmpeg

COPY package*.json ./
# Instala o ts-node globalmente para não ter erro de comando
RUN npm install && npm install -g ts-node typescript

COPY . .

RUN mkdir -p sessions

# Expõe a porta que você configurou no Easypanel
EXPOSE 3001

# O segredo está aqui: usamos o loader do ts-node para o Node entender arquivos .ts
CMD ["node", "--loader", "ts-node/esm", "src/server.ts"]