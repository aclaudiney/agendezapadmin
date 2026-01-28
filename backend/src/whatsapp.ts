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

// ✅ AJUSTE NO CAMINHO: No Docker, a pasta sessions fica na raiz do app (/app/sessions)
const baseDocsPath = path.resolve(__dirname, '..', 'sessions');

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const updateDatabaseStatus = async (companyId: string, status: string, qr: string | null = null) => {
    try {
        await supabase.from('whatsapp_sessions').upsert({ 
            company_id: companyId, 
            status: status, 
            qr_code: qr, 
            updated_at: new Date() 
        }, { onConflict: 'company_id' });
    } catch (err) { console.error("Erro banco:", err); }
};

export const desconectarWhatsApp = async (companyId: string) => {
    console.log(`\n⚠️ [${companyId}] Solicitando desconexão total...`);
    const session = sessions.get(companyId);
    
    if (session && session.sock) {
        try {
            await session.sock.logout();
            session.sock.end(undefined);
        } catch (e) { /* ignore */ }
    }

    sessions.delete(companyId);

    const companyPath = path.join(baseDocsPath, companyId);
    if (fs.existsSync(companyPath)) {
        // ✅ USANDO rmSync com force para garantir limpeza no Linux
        fs.rmSync(companyPath, { recursive: true, force: true });
        console.log(`🗑️ Pasta de sessão de ${companyId} removida.`);
    }

    await updateDatabaseStatus(companyId, 'disconnected', null);
    console.log(`✅ [${companyId}] Desconectado.`);
};

export const connectToWhatsApp = async (companyId: string, companyName: string = "Empresa") => {
    console.log(`- Iniciando robô para: ${companyName}`);
    
    const companyPath = path.join(baseDocsPath, companyId);
    if (!fs.existsSync(companyPath)) fs.mkdirSync(companyPath, { recursive: true });

    // ✅ O Baileys vai salvar os arquivos JSON aqui dentro
    const { state, saveCreds } = await useMultiFileAuthState(companyPath);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: [`AgendeZap - ${companyId}`, 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000, // ✅ Aumentado para manter conexão estável
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
                // ✅ Pequeno delay antes de reconectar para não sobrecarregar o CPU
                setTimeout(() => connectToWhatsApp(companyId, companyName), 5000);
            } else {
                console.log(`🚫 [${companyName}] Desconectado pelo usuário.`);
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
        console.error("❌ Erro ao buscar empresas:", error);
        return;
    }

    if (companies && companies.length > 0) {
        console.log(`\n🔄 Restaurando ${companies.length} instâncias...`);
        // ✅ Aumentamos o delay para 3 segundos entre empresas para o servidor não "engasgar" no boot
        for (const c of companies) {
            await delay(3000); 
            connectToWhatsApp(c.id, c.name);
        }
    } else {
        console.log("⚠️ Nenhuma empresa ativa encontrada.");
    }
};