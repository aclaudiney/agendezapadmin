import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    WASocket
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { Boom } from '@hapi/boom';
import 'dotenv/config';
import { processarFluxoAgendamento } from './AgendamentoController.js'; 
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Session {
    sock: WASocket | null;
    qr: string | null;
    status: 'disconnected' | 'connecting' | 'connected';
}

const sessions = new Map<string, Session>();
const baseDocsPath = path.resolve(__dirname, '..', 'sessions');
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const updateDatabaseStatus = async (companyId: string, status: string, qr: string | null = null) => {
    try {
        await supabase.from('whatsapp_sessions').upsert({ 
            company_id: companyId, status: status, qr_code: qr, updated_at: new Date() 
        }, { onConflict: 'company_id' });
    } catch (err) { console.error("Erro banco:", err); }
};

// --- FUNÇÃO DE DESCONECTAR (LIMPEZA TOTAL) ---
export const desconectarWhatsApp = async (companyId: string) => {
    console.log(`\n⚠️ [${companyId}] Solicitando desconexão total...`);
    const session = sessions.get(companyId);
    
    if (session && session.sock) {
        try {
            await session.sock.logout();
            session.sock.end(undefined);
        } catch (e) { /* já fechado */ }
    }

    sessions.delete(companyId);

    // LIMPA A PASTA DE SESSÃO (Para o QR Code vir novo na próxima)
    const companyPath = path.join(baseDocsPath, companyId);
    if (fs.existsSync(companyPath)) {
        fs.rmSync(companyPath, { recursive: true, force: true });
        console.log(`🗑️ Pasta de sessão de ${companyId} removida.`);
    }

    await updateDatabaseStatus(companyId, 'disconnected', null);
    console.log(`✅ [${companyId}] Desconectado e pronto para nova conexão.`);
};

export const connectToWhatsApp = async (companyId: string, companyName: string = "Empresa") => {
    console.log(`- Iniciando robô para: ${companyName}`);
    
    const companyPath = path.join(baseDocsPath, companyId);
    if (!fs.existsSync(companyPath)) fs.mkdirSync(companyPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(companyPath);
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: [`AgendeZap - ${companyId}`, 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
    });

    sessions.set(companyId, { sock, qr: null, status: 'connecting' });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            const qrBase64 = await QRCode.toDataURL(qr);
            await updateDatabaseStatus(companyId, 'qrcode', qrBase64);
            console.log(`📸 [${companyName}] Novo QR Code gerado.`);
        }

        if (connection === 'open') {
            await updateDatabaseStatus(companyId, 'connected', null);
            console.log(`✅ [${companyName}] Conectado com sucesso!`);
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log(`🔄 [${companyName}] Conexão fechada (${statusCode}). Reconectando...`);
                connectToWhatsApp(companyId, companyName);
            } else {
                console.log(`🚫 [${companyName}] Desconectado pelo usuário. Não reconectando.`);
                await desconectarWhatsApp(companyId);
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const textoRecebido = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        try {
            await sock.sendPresenceUpdate('composing', jid);
            const respostaIA = await processarFluxoAgendamento(textoRecebido, jid, companyId);
            if (respostaIA) {
                await delay(1000);
                await sock.sendMessage(jid, { text: respostaIA });
            }
        } catch (error) {
            console.error(`❌ Erro na mensagem [${companyName}]:`, error);
        }
    });
};

export const initAllSessions = async () => {
    const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('active', true);

    if (error) {
        console.error("❌ Erro ao buscar empresas no Supabase:", error);
        return;
    }

    if (companies && companies.length > 0) {
        console.log(`🔄 Restaurando ${companies.length} instâncias...`);
        for (const c of companies) {
            await delay(1500);
            connectToWhatsApp(c.id, c.name);
        }
    } else {
        console.log("⚠️ Nenhuma empresa ativa encontrada para conectar.");
    }
};