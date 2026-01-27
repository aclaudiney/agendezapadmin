import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    ConnectionState,
    downloadMediaMessage
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { Boom } from '@hapi/boom';
import 'dotenv/config';
import { processarMensagemIA } from './aiService.js'; 
import { logMensagem } from './logger.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sock: any;
let qrCodeImage: string | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

const docsPath = path.resolve(__dirname, '..', 'sessions');
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const messageBuffer = new Map<string, { text: string, keys: any[], totalAudioDuration: number, timer: NodeJS.Timeout }>();
const BUFFER_TIME = 16000; 

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// 🔍 FUNÇÃO PARA EXTRAIR O NÚMERO CORRETO
const extrairNumeroCorreto = (msg: any): string => {
    try {
        // Tenta pegar de remoteJidAlt (número CORRETO)
        if (msg.key.remoteJidAlt) {
            const numero = msg.key.remoteJidAlt.replace('@s.whatsapp.net', '').replace('@g.us', '');
            console.log(`✅ Número extraído de remoteJidAlt: ${numero}`);
            return numero;
        }
        
        // Se não tiver remoteJidAlt, tenta remoteJid
        if (msg.key.remoteJid) {
            // Se for LID, tenta extrair de outro lugar
            if (msg.key.remoteJid.includes('@lid')) {
                console.warn(`⚠️ Aviso: usando LID como fallback: ${msg.key.remoteJid}`);
                return msg.key.remoteJid.replace('@lid', '').replace('@s.whatsapp.net', '');
            }
            const numero = msg.key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
            console.log(`✅ Número extraído de remoteJid: ${numero}`);
            return numero;
        }
        
        console.error("❌ Não consegui extrair o número!");
        return "";
    } catch (error) {
        console.error("❌ Erro ao extrair número:", error);
        return "";
    }
};

// 🗑️ FUNÇÃO PARA LIMPAR SESSÃO E RECONECTAR
const limparSessao = async () => {
    try {
        if (fs.existsSync(docsPath)) {
            fs.rmSync(docsPath, { recursive: true, force: true });
            console.log('🗑️ Sessão deletada com sucesso!');
        }
        qrCodeImage = null;
        connectionStatus = 'disconnected';
        console.log('✅ Sistema pronto para novo QR Code');
        
        // 🔄 RECONECTAR AUTOMATICAMENTE APÓS LIMPAR
        await delay(2000);
        console.log('🔄 Gerando novo QR Code...');
        await connectToWhatsApp();
    } catch (error) {
        console.error('❌ Erro ao limpar sessão:', error);
    }
};

async function analisarImagem(msg: any) {
    try {
        console.log("📸 Baixando e preparando imagem para IA...");
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        const base64Image = buffer.toString('base64');
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.2-90b-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Descreva de forma curta e clara o que você vê nesta imagem. Se for um comprovante, identifique valor e data. Se for um objeto, diga o que é." },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ]
                }
            ],
            temperature: 0.5,
            max_tokens: 300
        }, {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }
        });
        if (response.data && response.data.choices) {
            console.log("✅ Descrição da imagem concluída com sucesso.");
            return response.data.choices[0].message.content;
        }
        return "[Imagem recebida]";
    } catch (error: any) {
        console.error("❌ Erro na Visão:", error.message);
        return "[Erro ao processar imagem]";
    }
}

async function transcreverAudio(msg: any) {
    try {
        console.log("🎙️ Transcrevendo áudio...");
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        const formData = new FormData();
        formData.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'pt');
        const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
            headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${GROQ_API_KEY}` },
        });
        return response.data.text;
    } catch (error) {
        console.error("❌ Erro na transcrição:", error);
        return "[Áudio recebido]";
    }
}

export const connectToWhatsApp = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(docsPath);
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['AgendeZap', 'Chrome', '1.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid?.includes('@g.us')) return;

        const jid = msg.key.remoteJid || "";
        let incomingContent = "";
        let currentAudioSeconds = 0;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        if (text) incomingContent += text;

        if (msg.message.audioMessage) {
            currentAudioSeconds = msg.message.audioMessage.seconds || 0;
            const transcricao = await transcreverAudio(msg);
            incomingContent += ` [Áudio: ${transcricao}]`;
        }

        if (msg.message.imageMessage) {
            const descricao = await analisarImagem(msg);
            incomingContent += ` [Imagem: ${descricao}]`;
        }

        if (!incomingContent && currentAudioSeconds === 0) return;

        if (messageBuffer.has(jid)) {
            const current = messageBuffer.get(jid)!;
            clearTimeout(current.timer);
            const newText = (current.text + " " + incomingContent).trim();
            const newKeys = [...current.keys, msg.key];
            const newDuration = current.totalAudioDuration + currentAudioSeconds;
            const newTimer = setTimeout(() => processFinalMessage(jid, newText, newKeys, newDuration, msg), BUFFER_TIME);
            messageBuffer.set(jid, { text: newText, keys: newKeys, totalAudioDuration: newDuration, timer: newTimer });
        } else {
            const newTimer = setTimeout(() => processFinalMessage(jid, incomingContent, [msg.key], currentAudioSeconds, msg), BUFFER_TIME);
            messageBuffer.set(jid, { text: incomingContent, keys: [msg.key], totalAudioDuration: currentAudioSeconds, timer: newTimer });
        }
    });

    async function processFinalMessage(jid: string, fullText: string, allKeys: any[], audioDuration: number, msg: any) {
        messageBuffer.delete(jid);
        try {
            // 🔍 EXTRAIR NÚMERO CORRETO
            const numeroCorreto = extrairNumeroCorreto(msg);

            // 🔍 LOG DETALHADO - TODOS OS DADOS DA MENSAGEM
            logMensagem({
                evento: 'mensagem.recebida',
                jid: jid,
                remoteJid: msg.key.remoteJid,
                remoteJidAlt: msg.key.remoteJidAlt,
                numeroCorreto: numeroCorreto,
                participant: msg.key.participant,
                fromMe: msg.key.fromMe,
                timestamp: msg.messageTimestamp,
                mensagem: fullText,
                audioDuration: audioDuration,
                messageKeys: allKeys.map(k => ({ id: k.id, participant: k.participant })),
                // Dados completos da mensagem
                messageObject: {
                    key: msg.key,
                    messageTimestamp: msg.messageTimestamp,
                    status: msg.status,
                    message: {
                        conversation: msg.message.conversation,
                        extendedTextMessage: msg.message.extendedTextMessage,
                        audioMessage: msg.message.audioMessage ? '✅ Audio presente' : '❌ Sem audio',
                        imageMessage: msg.message.imageMessage ? '✅ Imagem presente' : '❌ Sem imagem'
                    }
                }
            });

            await delay(Math.floor(Math.random() * 3000) + 3000);
            await sock.readMessages(allKeys);
            console.log("👀 Conversa lida");

            if (audioDuration > 0) {
                for (const key of allKeys) {
                    await sock.sendReceipt(jid, key.participant, [key.id], 'played');
                }
                console.log(`🔵 Ouvindo áudio (${audioDuration}s)...`);
                await delay(audioDuration * 1000);
            }

            await delay(2000);
            await sock.sendPresenceUpdate('composing', jid);
            
            // CHAMADA PARA A IA REAL (Gemini) - USANDO NÚMERO CORRETO
            const resposta = await processarMensagemIA(fullText, numeroCorreto);
            
            await delay(resposta.length * 70);
            await sock.sendMessage(jid, { text: resposta });
            await sock.sendPresenceUpdate('paused', jid);
            console.log("✅ Resposta humanizada da IA enviada.");

        } catch (e) { console.error("Erro no processamento final:", e); }
    }

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrCodeImage = await QRCode.toDataURL(qr);
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            
            // 🗑️ SE FOR LOGOUT (desconectar intencional), LIMPA SESSÃO
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('📴 Logout detectado! Limpando sessão...');
                await limparSessao();
            } else {
                // 🔄 SE FOR DESCONEXÃO ACIDENTAL, RECONECTA
                console.log('⚠️ Desconexão acidental detectada. Reconectando...');
                connectionStatus = 'disconnected';
                await delay(5000); // Aguarda 5 segundos antes de reconectar
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('\n✅ Robô Online com Olhos e Ouvidos!');
            connectionStatus = 'connected';
            qrCodeImage = null;
        }
    });
};

// 🗑️ FUNÇÃO PÚBLICA PARA DESCONECTAR E LIMPAR
export const desconectarWhatsApp = async () => {
    try {
        if (sock) {
            await sock.logout();
            console.log('📴 WhatsApp desconectado');
        }
        await limparSessao();
    } catch (error) {
        console.error('❌ Erro ao desconectar:', error);
    }
};

export const getStatus = () => ({ status: connectionStatus, qr: qrCodeImage });