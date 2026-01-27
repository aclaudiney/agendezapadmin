FROM node:20-slim

WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o restante do código
COPY . .

# Força a compilação do TypeScript para gerar a pasta dist
RUN npm run build

# Expõe a porta
EXPOSE 3001

# Comando para iniciar o servidor
CMD ["npm", "run", "start"]