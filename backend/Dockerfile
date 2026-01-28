FROM node:20-slim

WORKDIR /app

# Instala ffmpeg
RUN apt update && apt install -y ffmpeg

COPY package*.json ./
# Instalamos o esbuild que é 100x mais rápido e ignora erros de tipo
RUN npm install && npm install -g esbuild

COPY . .

RUN mkdir -p sessions

# Compila o código transformando TS em JS de forma bruta (ignora erros de tipo)
RUN npx esbuild src/server.ts --bundle --platform=node --outfile=dist/server.js --external:fsevents --external:canvas --external:ffmpeg-static

EXPOSE 3001

# Agora rodamos o arquivo JS puro, sem loaders experimentais
CMD ["node", "dist/server.js"]