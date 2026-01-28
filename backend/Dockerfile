FROM node:20-slim

# Instala dependências necessárias para o Baileys e FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libnss3 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libcups2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia apenas os arquivos de dependências primeiro (otimiza o cache do Docker)
COPY package*.json ./
RUN npm install

# Copia o restante do código
COPY . .

# Cria a pasta de sessões
RUN mkdir -p sessions

# Compila o projeto (TSC puro)
# Removi o "|| true" porque queremos que o build FALHE se houver erro real, 
# evitando que você suba um código quebrado sem saber.
RUN npx tsc --skipLibCheck

EXPOSE 3001

# Rodamos sempre o código compilado (mais rápido e gasta menos RAM)
CMD ["node", "dist/server.js"]