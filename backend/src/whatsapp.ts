/**
 * WHATSAPP SERVICE - AGENDEZAP
 * Gerencia conexoes WhatsApp, recebe mensagens e integra com IA
 */

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
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { 
    montarContextoConversa, 
    prepararDadosParaIA, 
    extrairTelefoneDoJid,
    extrairDadosMensagem,
    validarDadosExtraidos
} from './handlers/messageHandler.js';
import { gerarRespostaIA } from './aiService.js';

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

// ============================================
// 1. ATUALIZAR STATUS NO BANCO
// ============================================

const updateDatabaseStatus = async (companyId: string, status: string, qr: string | null = null) => {
    try {
        await supabase.from('whatsapp_sessions').upsert({ 
            company_id: companyId, 
            status: status, 
            qr_code: qr, 
            updated_at: new Date() 
        }, { onConflict: 'company_id' });
    } catch (err) { 
        console.error("Erro ao atualizar banco:", err); 
    }
};

// ============================================
// 2. DESCONECTAR WHATSAPP
// ============================================

export const desconectarWhatsApp = async (companyId: string) => {
    console.log(`\n[${companyId}] Solicitando desconexao total...`);
    const session = sessions.get(companyId);
    
    if (session && session.sock) {
        try {
            await session.sock.logout();
            session.sock.end(undefined);
        } catch (e) { 
            console.log(`   (socket ja fechado)`); 
        }
    }

    sessions.delete(companyId);

    const companyPath = path.join(baseDocsPath, companyId);
    if (fs.existsSync(companyPath)) {
        fs.rmSync(companyPath, { recursive: true, force: true });
        console.log(`Pasta de sessao removida.`);
    }

    await updateDatabaseStatus(companyId, 'disconnected', null);
    console.log(`[${companyId}] Desconectado e pronto para nova conexao.`);
};

// ============================================
// 3. CONECTAR AO WHATSAPP
// ============================================

export const connectToWhatsApp = async (companyId: string, companyName: string = "Empresa") => {
    console.log(`- Iniciando robo para: ${companyName}`);
    
    const companyPath = path.join(baseDocsPath, companyId);
    if (!fs.existsSync(companyPath)) {
        fs.mkdirSync(companyPath, { recursive: true });
    }

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

    // ============================================
    // OUVIR UPDATES DE CONEXAO
    // ============================================
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            const qrBase64 = await QRCode.toDataURL(qr);
            await updateDatabaseStatus(companyId, 'qrcode', qrBase64);
            console.log(`[${companyName}] Novo QR Code gerado.`);
        }

        if (connection === 'open') {
            await updateDatabaseStatus(companyId, 'connected', null);
            console.log(`[${companyName}] Conectado com sucesso!`);
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log(`[${companyName}] Conexao fechada (${statusCode}). Reconectando...`);
                await delay(3000);
                connectToWhatsApp(companyId, companyName);
            } else {
                console.log(`[${companyName}] Desconectado pelo usuario. Nao reconectando.`);
                await desconectarWhatsApp(companyId);
            }
        }
    });

    // ============================================
    // OUVIR MENSAGENS RECEBIDAS
    // ============================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        
        if (!msg.message || msg.key.fromMe) return;

        try {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`[MSG RECEBIDA] De: ${companyName}`);
            console.log(`${'='.repeat(80)}`);
            
            // SELECIONAR MELHOR JID
            let jid = msg.key.remoteJidAlt || msg.key.remoteJid || msg.key.participant;
            
            if (!jid) {
                console.log(`   ❌ NENHUM JID ENCONTRADO!`);
                return;
            }
            
            console.log(`   JID: ${jid}`);

            const textoRecebido = msg.message.conversation 
                || msg.message.extendedTextMessage?.text 
                || "";

            console.log(`   Texto: ${textoRecebido}`);
            console.log(`${'='.repeat(80)}\n`);

            // ============================================
            // PIPELINE DE PROCESSAMENTO
            // ============================================

            // 1️⃣ MONTAR CONTEXTO COMPLETO
            const contexto = await montarContextoConversa(textoRecebido, jid, companyId);
            console.log(`   ✅ Contexto montado - Tipo: ${contexto.tipo}`);

            // 2️⃣ EXTRAIR DADOS DA MENSAGEM
            const dadosExtraidos = await extrairDadosMensagem(textoRecebido, contexto);
            console.log(`   ✅ Dados extraídos`);

            // 3️⃣ VALIDAR E ENRIQUECER (NOVO!)
            const dadosValidados = await validarDadosExtraidos(dadosExtraidos, contexto);
            console.log(`   ✅ Dados validados`);

            // 4️⃣ VERIFICAR SE TEVE ERRO CRÍTICO
            const validacoes = dadosValidados.validacoes;
            
            if (validacoes && !validacoes.diaAberto && validacoes.motivoErro) {
                // Dia fechado ou fora de funcionamento
                console.log(`   ⚠️ Erro de validação: ${validacoes.motivoErro}`);
                await delay(1000);
                await sock.sendMessage(jid, { text: validacoes.motivoErro });
                return;
            }

            if (validacoes && validacoes.horarioPassado && validacoes.motivoErro) {
                // Horário no passado
                console.log(`   ⚠️ Erro de validação: ${validacoes.motivoErro}`);
                await delay(1000);
                await sock.sendMessage(jid, { text: validacoes.motivoErro });
                return;
            }

            // 5️⃣ PREPARAR DADOS PARA IA (com validações incluídas)
            const dadosParaIA = prepararDadosParaIA(contexto, dadosValidados);
            console.log(`   ✅ Dados preparados para IA`);

            // 6️⃣ CHAMAR IA PARA GERAR RESPOSTA
            console.log(`   🤖 Chamando IA...`);
            await sock.sendPresenceUpdate('composing', jid);
            
            const telefone = extrairTelefoneDoJid(jid);
            
            const respostaIA = await gerarRespostaIA({
                ...dadosParaIA,
                companyId,
                jid: telefone,
                mensagem: textoRecebido,
                tipoConversa: contexto.tipo,
                clienteNome: contexto.cliente.nome,
                clienteExiste: contexto.cliente.existe,
                clienteId: contexto.cliente.id,
                nomeAgente: contexto.nomeAgente,
                nomeLoja: contexto.nomeLoja,
                promptBase: contexto.promptBase,
                servicos: dadosParaIA.servicos,
                profissionaisLista: dadosParaIA.profissionaisLista,
                eSolo: dadosParaIA.eSolo,
                dadosExtraidos: dadosValidados
            });

            console.log(`   ✅ Resposta gerada`);
            console.log(`   Resposta: ${respostaIA.substring(0, 80)}...`);

            // 7️⃣ ENVIAR RESPOSTA
            if (respostaIA) {
                await delay(1000);
                await sock.sendMessage(jid, { text: respostaIA });
                console.log(`   ✅ Mensagem enviada!\n`);
            }

        } catch (error) {
            console.error(`\n❌ Erro na mensagem [${companyName}]:`, error);
            
            try {
                const jidFallback = msg.key.remoteJidAlt 
                    || msg.key.remoteJid 
                    || '';
                
                if (jidFallback) {
                    await sock.sendMessage(jidFallback, { 
                        text: 'Ops, nosso sistema está com problema. Pode tentar em alguns minutos?' 
                    });
                }
            } catch (e) {
                console.error('Erro ao enviar mensagem de erro:', e);
            }
        }
    });
};

// ============================================
// 4. INICIALIZAR TODAS AS SESSOES
// ============================================

export const initAllSessions = async () => {
    try {
        const { data: companies, error } = await supabase
            .from('companies')
            .select('id, name')
            .eq('active', true);

        if (error) {
            console.error("Erro ao buscar empresas no Supabase:", error);
            return;
        }

        if (companies && companies.length > 0) {
            console.log(`Restaurando ${companies.length} instancias...\n`);
            for (const c of companies) {
                await delay(1500);
                connectToWhatsApp(c.id, c.name);
            }
        } else {
            console.log("Nenhuma empresa ativa encontrada para conectar.");
        }
    } catch (error) {
        console.error('Erro ao inicializar sessoes:', error);
    }
};