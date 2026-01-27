import express from 'express';
import cors from 'cors';
import { connectToWhatsApp, getStatus, desconectarWhatsApp } from './whatsapp.js';

const app = express();
app.use(cors());
app.use(express.json());

// Rota para o seu sistema React saber o status do Zap e pegar o QR Code
app.get('/whatsapp/status', (req, res) => {
    res.json(getStatus());
});

// Rota para desconectar o WhatsApp pelo sistema
app.post('/whatsapp/logout', async (req, res) => {
    try {
        await desconectarWhatsApp();
        res.json({ message: 'Sessão encerrada com sucesso', status: 'disconnected' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao desconectar', error: String(error) });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Backend AgendeZap rodando em http://localhost:${PORT}`);
    
    // Inicia o motor do WhatsApp automaticamente
    connectToWhatsApp();
});