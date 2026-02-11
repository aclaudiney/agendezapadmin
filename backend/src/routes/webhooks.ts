import { Router } from 'express';
import { addMessageToQueue, processMessage, messageQueue } from '../services/queue/messageQueue.js';
import { supabase } from '../supabase.js';

const router = Router();

// ==================== WEBHOOK DA EVOLUTION API ====================

/**
 * Endpoint para receber webhooks da Evolution API
 * Formato: /webhooks/evolution/:companyId
 */
router.post('/evolution/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { event, instance, data } = req.body;

        console.log(`📨 [WEBHOOK] Evento: ${event} | Empresa: ${companyId}`);

        // Responder imediatamente (não bloqueia Evolution API)
        res.status(200).json({ success: true });

        // Processar de forma assíncrona para não atrasar a resposta ao webhook
        setImmediate(async () => {
            try {
                switch (event) {
                    case 'qrcode.updated':
                        await handleQRCodeUpdate(companyId, data);
                        break;

                    case 'connection.update':
                        await handleConnectionUpdate(companyId, data);
                        break;

                    case 'messages.upsert':
                        await handleIncomingMessage(companyId, data);
                        break;

                    case 'messages.update':
                        await handleMessageUpdate(companyId, data);
                        break;

                    default:
                        console.log(`⚠️ Evento não tratado: ${event}`);
                }
            } catch (error: any) {
                console.error(`❌ Erro ao processar webhook ${event} para ${companyId}:`, error.message);
            }
        });

    } catch (error: any) {
        console.error('❌ Erro no webhook receiver:', error);
        // Mesmo em erro, respondemos 200 para a Evolution API não ficar retentando se for erro de processamento nosso
        res.status(200).json({ success: false, error: error.message });
    }
});

// ==================== HANDLERS ====================

/**
 * Atualiza o QR Code no banco de dados
 */
async function handleQRCodeUpdate(companyId: string, data: any) {
    const qrCode = data.qrcode?.base64 || data.base64;
    if (!qrCode) return;

    console.log(`📱 [${companyId}] QR Code atualizado`);

    try {
        await supabase.from('whatsapp_sessions').upsert({
            company_id: companyId,
            status: 'qrcode',
            qr_code: qrCode,
            updated_at: new Date()
        }, { onConflict: 'company_id' });
    } catch (error: any) {
        console.error(`❌ Erro ao salvar QR Code para ${companyId}:`, error.message);
    }
}

/**
 * Atualiza o status da conexão no banco de dados
 */
async function handleConnectionUpdate(companyId: string, data: any) {
    const status = data.state || data.status;
    console.log(`🔌 [${companyId}] Conexão: ${status}`);

    try {
        // Mapear status da Evolution para nosso padrão
        let dbStatus = 'disconnected';
        if (status === 'open' || status === 'connected') dbStatus = 'connected';
        else if (status === 'connecting') dbStatus = 'connecting';

        await supabase.from('whatsapp_sessions').upsert({
            company_id: companyId,
            status: dbStatus,
            qr_code: null, // Limpa o QR se conectou ou desconectou
            updated_at: new Date()
        }, { onConflict: 'company_id' });
    } catch (error: any) {
        console.error(`❌ Erro ao atualizar status para ${companyId}:`, error.message);
    }
}

/**
 * Processa mensagens recebidas e envia para a fila
 */
async function handleIncomingMessage(companyId: string, data: any) {
    try {
        const messages = data.messages || [data];

        // 0️⃣ Limpeza automática de pausas expiradas
        await supabase.from('ai_pause_control')
            .delete()
            .lt('paused_until', new Date().toISOString());

        for (const msg of messages) {
            const fromMe = msg.key?.fromMe || false;
            const clientJid = msg.key?.remoteJid;
            
            // Ignorar mensagens de grupo
            if (clientJid?.endsWith('@g.us')) continue;

            const phone = clientJid?.replace('@s.whatsapp.net', '');
            const messageText = msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.audioMessage?.caption || '';

            if (!messageText) continue;

            // 1️⃣ MENSAGEM DO DONO (fromMe) → Pausar IA por 3min
            if (fromMe) {
                const pausarAte = new Date(Date.now() + 3 * 60 * 1000); // +3min
                
                await supabase.from('ai_pause_control').upsert({
                    company_id: companyId,
                    client_jid: clientJid,
                    paused_until: pausarAte.toISOString()
                }, { onConflict: 'company_id,client_jid' });
                
                // Salvar no histórico para preservar contexto
                await supabase.from('ai_chat_history').insert({
                    company_id: companyId,
                    client_jid: clientJid,
                    role: 'assistant',
                    content: messageText
                });
                
                console.log(`👤 [${companyId}] Dono enviou msg → IA pausada por 3min para ${phone}`);
                continue; // Não processar com IA
            }

            // 2️⃣ MENSAGEM DO CLIENTE → Verificar se IA está pausada
            const { data: pausa } = await supabase
                .from('ai_pause_control')
                .select('paused_until')
                .eq('company_id', companyId)
                .eq('client_jid', clientJid)
                .maybeSingle();
            
            if (pausa && new Date(pausa.paused_until) > new Date()) {
                // IA pausada: salvar no histórico mas NÃO responder
                await supabase.from('ai_chat_history').insert({
                    company_id: companyId,
                    client_jid: clientJid,
                    role: 'user',
                    content: messageText
                });
                
                console.log(`⏸️ [${companyId}] IA pausada para ${phone} até ${pausa.paused_until}`);
                continue; // Não processar
            }

            console.log(`📥 [${companyId}] Mensagem de ${phone}: ${messageText.substring(0, 50)}...`);

            // Tentar adicionar na fila, se o Redis falhar, processa direto (fallback para dev)
            try {
                // Checar se o redis está conectado de forma simples (bull expõe o client)
                const isRedisConnected = (messageQueue.client as any)?.status === 'ready';

                if (isRedisConnected) {
                    await addMessageToQueue(companyId, phone!, messageText, msg);
                } else {
                    console.log(`⚠️ [Queue] Redis Offline - Processando mensagem diretamente...`);
                    // Não aguardar (fire and forget) para não travar o webhook
                    processMessage({ companyId, phone, message: messageText, messageData: msg });
                }
            } catch (err) {
                console.warn(`⚠️ [Queue] Erro ao adicionar na fila, processando direto...`);
                processMessage({ companyId, phone, message: messageText, messageData: msg });
            }
        }
    } catch (error: any) {
        console.error(`❌ Erro ao processar mensagem recebida para ${companyId}:`, error.message);
    }
}

/**
 * Trata atualizações de mensagens (lida, deletada, etc)
 */
async function handleMessageUpdate(companyId: string, data: any) {
    // TODO: Implementar se necessário (ex: marcar como lido no CRM)
    // console.log(`🔄 [${companyId}] Mensagem atualizada`);
}

export default router;
