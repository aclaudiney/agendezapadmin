import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- AJUSTE PARA O AMBIENTE DO SERVIDOR ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Criar pasta logs se não existir
// Ele sobe um nível (..) para sair da 'dist' ou 'src' e criar a pasta na raiz
const logsDir = path.resolve(__dirname, '..', 'logs');

if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (err) {
        console.error("Erro ao criar pasta de logs:", err);
    }
}

export const logMensagem = (dados: any) => {
    const timestamp = new Date().toISOString();
    const logData = {
        timestamp,
        ...dados
    };

    // Salvar em arquivo JSON com a data do dia
    const dataHoje = new Date().toISOString().split('T')[0];
    const nomeArquivo = path.join(logsDir, `mensagens-${dataHoje}.json`);
    
    try {
        let conteudo: any[] = [];
        if (fs.existsSync(nomeArquivo)) {
            const arquivoAntigo = fs.readFileSync(nomeArquivo, 'utf-8');
            conteudo = JSON.parse(arquivoAntigo);
        }
        conteudo.push(logData);
        fs.writeFileSync(nomeArquivo, JSON.stringify(conteudo, null, 2));
    } catch (error) {
        console.error("Erro ao salvar log no arquivo:", error);
    }

    // Também mostrar no console para você ver no Easypanel
    console.log("\n📨 ========== MENSAGEM RECEBIDA ==========");
    console.log(`Cliente: ${dados.numeroCorreto || 'Desconhecido'}`);
    console.log(`Texto: ${dados.mensagem}`);
    console.log("========================================\n");
};