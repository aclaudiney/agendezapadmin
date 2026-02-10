/**
 * WHATSAPP SERVICE - AGENDEZAP
 * Gerencia conexoes WhatsApp, recebe mensagens e integra com IA
 * 
 * ✅ CORRIGIDO: Suporte a mensagens de áudio (Groq Whisper)
 * ✅ NOVO: Função enviarMensagemManual para CRM
 * ✅ CORRIGIDO: Usa remoteJidAlt para pegar número real
 * ✅ CORRIGIDO: Status da sessão atualiza corretamente
 */

import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    WASocket,
    downloadMediaMessage
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
import { converterAudioParaTexto } from './audioService.js';
import { salvarMensagemWhatsApp } from './services/messageLoggerService.js';

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
// EXPORTAR SESSIONS PARA ACESSO EXTERNO (CRM)
// ============================================
export { sessions };

// ============================================
// FUNÇÃO: ENVIAR MENSAGEM MANUAL (PARA CRM)
// ============================================
export const enviarMensagemManual = async (
    companyId: string, 
    clientPhone: string, 
    message: string
) => {
    console.log(`📤 [MANUAL CRM] Enviando para ${clientPhone} da empresa ${companyId}`);
    
    const session = sessions.get(companyId);
    
    if (!session || !session.sock || session.status !== 'connected') {
        throw new Error('WhatsApp não está conectado para esta empresa');
    }

    // Formatar JID
    const jid = `${clientPhone}@s.whatsapp.net`;
    
    try {
        // Enviar mensagem
        await session.sock.sendMessage(jid, { text: message });
        console.log(`✅ [MANUAL CRM] Mensagem enviada com sucesso`);
        
        // Salvar no banco
        await salvarMensagemWhatsApp({
            companyId,
            clientPhone,
            messageText: message,
            messageType: 'text',
            direction: 'outgoing',
            conversationType: 'manual_crm'
        });
        
        console.log(`💾 [MANUAL CRM] Mensagem salva no banco`);
        return true;
    } catch (error) {
        console.error(`❌ [MANUAL CRM] Erro ao enviar:`, error);
        throw error;
    }
};

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

        // ✅ QUANDO CONECTA - ATUALIZAR STATUS (ESSENCIAL PARA O CRM!)
        if (connection === 'open') {
            await updateDatabaseStatus(companyId, 'connected', null);
            
            // ✅ ATUALIZAR STATUS DA SESSÃO NO MAP
            const session = sessions.get(companyId);
            if (session) {
                session.status = 'connected';
            }
            
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
            
            // ✅ PRIORIZAR remoteJidAlt (número REAL) > remoteJid > participant
            let jid = (msg.key as any).remoteJidAlt || msg.key.remoteJid || msg.key.participant;
            
            if (!jid) {
                console.log(`   ❌ NENHUM JID VÁLIDO ENCONTRADO!`);
                return;
            }
            
            // ✅ EXTRAIR NÚMERO LIMPO
            let numeroLimpo = jid.split('@')[0];
            
            // Se é grupo, pegar participant
            if (jid.includes('@g.us') && msg.key.participant) {
                numeroLimpo = msg.key.participant.split('@')[0];
            }
            
            console.log(`   📞 JID: ${jid} | Número: ${numeroLimpo}`);

            // ============================================
            // ✅ EXTRAIR TEXTO DA MENSAGEM (COM SUPORTE A ÁUDIO!)
            // ============================================
            let textoRecebido = '';
            let tipoMensagemOrigem = 'text';

            // TEXTO SIMPLES
            if (msg.message.conversation) {
                textoRecebido = msg.message.conversation;
            }
            // TEXTO ESTENDIDO
            else if (msg.message.extendedTextMessage?.text) {
                textoRecebido = msg.message.extendedTextMessage.text;
            }
            // ✅ ÁUDIO
            else if (msg.message.audioMessage) {
                tipoMensagemOrigem = 'audio';
                console.log(`   🎙️ Mensagem de áudio detectada`);
                
                try {
                    const buffer = await downloadMediaMessage(
                        msg,
                        'buffer',
                        {},
                        {
                            logger: console as any,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );

                    const tempDir = path.join(__dirname, '..', 'temp');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }

                    const audioPath = path.join(tempDir, `audio_${Date.now()}.ogg`);
                    fs.writeFileSync(audioPath, buffer);

                    const resultado = await converterAudioParaTexto(audioPath);

                    if (resultado.sucesso && resultado.texto) {
                        textoRecebido = resultado.texto;
                        console.log(`   ✅ Áudio convertido: "${textoRecebido}"`);
                    } else {
                        console.error(`   ❌ Erro ao converter áudio: ${resultado.erro}`);
                        await sock.sendMessage(jid, { 
                            text: 'Desculpa, não consegui entender o áudio. Pode digitar a mensagem?' 
                        });
                        return;
                    }
                } catch (audioError) {
                    console.error(`   ❌ Erro ao processar áudio:`, audioError);
                    await sock.sendMessage(jid, { 
                        text: 'Ops, tive um problema com o áudio. Pode tentar de novo ou digitar?' 
                    });
                    return;
                }
            }

            // Se não tem texto
            if (!textoRecebido) {
                console.log(`   ⚠️ Tipo de mensagem não suportado`);
                return;
            }

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

            // 3️⃣ VALIDAR E ENRIQUECER
            const dadosValidados = await validarDadosExtraidos(dadosExtraidos, contexto);
            console.log(`   ✅ Dados validados`);

            // 💾 SALVAR MENSAGEM DO CLIENTE NO BANCO
            await salvarMensagemWhatsApp({
                companyId,
                clientPhone: numeroLimpo,
                clientName: contexto.cliente.nome || 'Cliente WhatsApp',
                messageText: textoRecebido,
                messageType: tipoMensagemOrigem,
                direction: 'incoming',
                extractedData: dadosValidados,
                conversationType: contexto.tipo
            });
            console.log(`   💾 Mensagem do cliente salva no CRM`);

            // 🚨 CORREÇÃO 1: BLOQUEAR IA SE DIA FECHADO (PRIORIDADE MÁXIMA)
            if (dadosValidados.validacoes && dadosValidados.validacoes.diaAberto === false) {
                 console.log(`🚫 BLOQUEIO IA: Dia fechado (${dadosValidados.validacoes.motivoErro})`);
                 
                 const motivo = dadosValidados.validacoes.motivoErro || "Estamos fechados neste dia.";
                 const mensagemBloqueio = `${motivo}\n\nQuer agendar para outro dia?`;

                 await delay(1000);
                 await sock.sendMessage(jid, { text: mensagemBloqueio });
                 
                 // Salvar resposta
                 await salvarMensagemWhatsApp({
                    companyId,
                    clientPhone: numeroLimpo,
                    clientName: contexto.cliente.nome || 'Cliente WhatsApp',
                    messageText: mensagemBloqueio,
                    messageType: 'text',
                    direction: 'outgoing',
                    conversationType: contexto.tipo
                 });

                 // LIMPAR contexto COMPLETO para evitar loop
                 try {
                    const { salvarContextoConversa } = await import('./services/extractionService.js');
                    const dadosLimpos = {
                        servico: null,
                        data: null,
                        hora: null,
                        periodo: null,
                        puloParaAmanha: false
                    };
                    salvarContextoConversa(companyId, jid, dadosLimpos);
                    console.log(`   🧹 Contexto TOTALMENTE limpo devido a dia fechado`);
                 } catch (e) {
                     console.error('Erro ao limpar contexto:', e);
                 }
                 
                 return; // ⛔ PARAR AQUI - NÃO CHAMAR IA!
            }

            // 4️⃣ ATALHO: CONSULTAR AGENDAMENTOS (sem IA) — evita IDs, evita datas invertidas e filtra por data
            if (contexto.tipo === 'consultar') {
                const dataAlvo = dadosValidados?.data || null; // YYYY-MM-DD (ex: 2026-02-11)
                const hoje = contexto.dataAtual;

                const formatarDataBR = (yyyyMmDd: string) => {
                    const [a, m, d] = String(yyyyMmDd).split('-');
                    if (!a || !m || !d) return yyyyMmDd;
                    return `${d}/${m}/${a}`;
                };

                const formatarHoraHHMM = (hhmmss: string) => {
                    if (!hhmmss) return '';
                    const parts = String(hhmmss).split(':');
                    return parts.length >= 2 ? `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}` : hhmmss;
                };

                // Filtrar apenas futuros (>= hoje) e, se houver dataAlvo, filtrar por ela
                let ags = (contexto.agendamentos || []).filter((a: any) => a?.data && a.data >= hoje);
                if (dataAlvo) ags = ags.filter((a: any) => a.data === dataAlvo);

                // Ordenar por data/hora
                ags.sort((a: any, b: any) => {
                    const da = `${a.data}T${formatarHoraHHMM(a.hora)}:00`;
                    const db = `${b.data}T${formatarHoraHHMM(b.hora)}:00`;
                    return da.localeCompare(db);
                });

                const dataLabel = dataAlvo ? formatarDataBR(dataAlvo) : 'os próximos dias';

                let mensagemConsulta = '';
                if (ags.length === 0) {
                    mensagemConsulta = `Oi ${contexto.cliente.nome || 'Ney'}! 😊\nNão encontrei agendamentos para ${dataLabel}. Quer marcar um horário?`;
                } else {
                    const linhas = ags.slice(0, 10).map((a: any) => {
                        const dataBR = formatarDataBR(a.data);
                        const horaBR = formatarHoraHHMM(a.hora);
                        return `- ${a.servico} — ${dataBR} às ${horaBR} com ${a.profissional}`;
                    });
                    mensagemConsulta = `Oi ${contexto.cliente.nome || 'Ney'}! 😊\nPara ${dataLabel}, você tem:\n${linhas.join('\n')}`;
                }

                await delay(1000);
                await sock.sendMessage(jid, { text: mensagemConsulta });

                await salvarMensagemWhatsApp({
                    companyId,
                    clientPhone: numeroLimpo,
                    clientName: contexto.cliente.nome || 'Cliente WhatsApp',
                    messageText: mensagemConsulta,
                    messageType: 'text',
                    direction: 'outgoing',
                    conversationType: contexto.tipo
                });

                console.log(`   ✅ Consulta respondida sem IA (filtrada por data)`);
                return;
            }

            // 4️⃣ VERIFICAR SE TEVE ERRO CRÍTICO (Outros erros)
            const validacoes = dadosValidados.validacoes;

            if (validacoes && validacoes.horarioPassado && validacoes.motivoErro) {
                console.log(`   ⚠️ Erro de validação: ${validacoes.motivoErro}`);
                await delay(1000);
                await sock.sendMessage(jid, { text: validacoes.motivoErro });
                
                // Salvar resposta de erro
                await salvarMensagemWhatsApp({
                    companyId,
                    clientPhone: numeroLimpo,
                    clientName: contexto.cliente.nome || 'Cliente WhatsApp',
                    messageText: validacoes.motivoErro,
                    messageType: 'text',
                    direction: 'outgoing',
                    conversationType: contexto.tipo
                });

                // 🔑 LIMPAR hora inválida do contexto (Solicitado)
                try {
                    const { salvarContextoConversa } = await import('./services/extractionService.js');
                    
                    // Limpar hora mantendo outros dados
                    const dadosLimpos = {
                        ...dadosValidados,
                        hora: null
                    };

                    salvarContextoConversa(companyId, jid, dadosLimpos);
                    console.log(`   🧹 Contexto limpo (hora removida) para evitar loop`);
                } catch (e) {
                    console.error('Erro ao limpar contexto:', e);
                }

                return;
            }

            // 5️⃣ PREPARAR DADOS PARA IA
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
                servicos: (dadosParaIA as any).servicos,
                profissionaisLista: (dadosParaIA as any).profissionaisLista,
                eSolo: (dadosParaIA as any).eSolo,
                dadosExtraidos: dadosValidados
            });

            console.log(`   ✅ Resposta gerada`);

            // 7️⃣ ENVIAR RESPOSTA
            if (respostaIA) {
                await delay(1000);
                await sock.sendMessage(jid, { text: respostaIA });
                console.log(`   ✅ Mensagem enviada!`);

                // 💾 SALVAR RESPOSTA DA IA NO BANCO
                await salvarMensagemWhatsApp({
                    companyId,
                    clientPhone: numeroLimpo,
                    clientName: contexto.cliente.nome || 'Cliente WhatsApp',
                    messageText: respostaIA,
                    messageType: 'text',
                    direction: 'outgoing',
                    conversationType: contexto.tipo,
                    aiResponse: respostaIA
                });
                console.log(`   💾 Resposta da IA salva no CRM\n`);
            }

        } catch (error) {
            console.error(`\n❌ Erro na mensagem [${companyName}]:`, error);
            
            try {
                const jidFallback = msg.key.remoteJid || msg.key.participant || '';
                
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
