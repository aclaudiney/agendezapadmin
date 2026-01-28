FROM node:20

WORKDIR /app

# Instala dependências de sistema necessárias para o Baileys/Canvas (opcional mas seguro)
RUN apt-get update && apt-get install -y ffmpeg

COPY package*.json ./
RUN npm install

COPY . .

# Cria a pasta de sessões para garantir que o Docker tenha permissão de escrita
RUN mkdir -p sessions

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start"]