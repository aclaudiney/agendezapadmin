FROM node:20-slim

WORKDIR /app

# Instala ffmpeg
RUN apt update && apt install -y ffmpeg

COPY package*.json ./
# Instalamos o esbuild
RUN npm install && npm install -g esbuild

COPY . .

RUN mkdir -p sessions

# Mudamos a saída para server.cjs para evitar conflito com "type": "module"
RUN npx esbuild src/server.ts --bundle --platform=node --outfile=dist/server.cjs --external:fsevents --external:canvas --external:ffmpeg-static

EXPOSE 3001

# Agora rodamos o arquivo .cjs
CMD ["node", "dist/server.cjs"]