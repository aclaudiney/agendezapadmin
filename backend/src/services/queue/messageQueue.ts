import Queue from 'bull';
import 'dotenv/config';

// Configuração do Redis
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null
};

// Criar fila
export const messageQueue = new Queue('messages', {
    redis: redisConfig,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false
    }
});

// Logs de conexão do Redis (Silenciados em dev para evitar spam se o Redis estiver offline)
messageQueue.on('error', (error) => {
    // console.error('❌ [Redis/Queue] Erro na conexão:', error.message);
});

// Múltiplos workers para performance
messageQueue.process(50, async (job) => {
    return await processMessage(job.data, job.id);
});

// Monitoramento da fila
messageQueue.on('completed', (job) => {
    console.log(`✅ Job ${job.id} concluído em ${job.finishedOn - job.processedOn}ms`);
});

messageQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} falhou:`, err.message);
});
export async function processMessage(data: any, jobId: string | number = 'direct') {
    try {
        const { companyId, phone, message: messageText, messageData: msg } = data;
        const pushName = msg?.pushName || null;
        const jid = `${phone}@s.whatsapp.net`;

        console.log(`\n---------------------------------------------------------`);
        console.log(`📩 MENSAGEM RECEBIDA [${jobId}]:`);
        console.log(`   Empresa: ${companyId}`);
        console.log(`   Cliente: ${phone}`);
        console.log(`   Texto: "${messageText}"`);
        console.log(`---------------------------------------------------------\n`);

        // Importação dinâmica para evitar Dependência Circular se algum handler importar a fila
        const {
            montarContextoConversa,
            prepararDadosParaIA,
            extrairTelefoneDoJid,
            extrairDadosMensagem,
            validarDadosExtraidos
        } = await import('../../handlers/messageHandler.js');
        const { gerarRespostaIA } = await import('../../aiService.js');
        const { salvarMensagemWhatsApp } = await import('../messageLoggerService.js');
        const { evolutionAPI } = await import('../whatsapp/evolutionAPI.js');

        // 1️⃣ MONTAR CONTEXTO COMPLETO
        const contexto = await montarContextoConversa(messageText, jid, companyId);
        console.log(`   [${jobId}] ✅ Contexto montado - Tipo: ${contexto.tipo}`);

        // 2️⃣ EXTRAIR DADOS DA MENSAGEM
        const dadosExtraidos = await extrairDadosMensagem(messageText, contexto);

        // 3️⃣ VALIDAR E ENRIQUECER
        const dadosValidados = await validarDadosExtraidos(dadosExtraidos, contexto);

        // 💾 SALVAR MENSAGEM DO CLIENTE NO BANCO
        await salvarMensagemWhatsApp({
            companyId,
            clientPhone: phone,
            clientName: contexto.cliente.nome || pushName || 'Cliente WhatsApp',
            messageText: messageText,
            messageType: 'text',
            direction: 'incoming',
            extractedData: dadosValidados,
            conversationType: contexto.tipo
        });

        // 🚨 BLOQUEAR IA SE DIA FECHADO
        if (dadosValidados.validacoes && dadosValidados.validacoes.diaAberto === false) {
            const motivo = dadosValidados.validacoes.motivoErro || "Estamos fechados neste dia.";
            const mensagemBloqueio = `${motivo}\n\nQuer agendar para outro dia?`;

            await evolutionAPI.sendTextMessage(companyId, phone, mensagemBloqueio);

            await salvarMensagemWhatsApp({
                companyId,
                clientPhone: phone,
                messageText: mensagemBloqueio,
                messageType: 'text',
                direction: 'outgoing',
                conversationType: contexto.tipo
            });

            return { success: true, blocked: true };
        }

        // 5️⃣ PREPARAR DADOS PARA IA
        const dadosParaIA = prepararDadosParaIA(contexto, dadosValidados);

        // 6️⃣ CHAMAR IA PARA GERAR RESPOSTA
        const telefone = extrairTelefoneDoJid(jid);
        const respostaIA = await gerarRespostaIA({
            ...dadosParaIA,
            companyId,
            phone: telefone,
            message: messageText,
            dadosExtraidos: dadosValidados
        });

        // 7️⃣ ENVIAR RESPOSTA
        if (respostaIA) {
            console.log(`\n---------------------------------------------------------`);
            console.log(`📤 RESPOSTA ENVIADA [${jobId}]:`);
            console.log(`   Empresa: ${companyId}`);
            console.log(`   Cliente: ${phone}`);
            console.log(`   Texto: "${respostaIA.substring(0, 100)}${respostaIA.length > 100 ? '...' : ''}"`);
            console.log(`---------------------------------------------------------\n`);

            await evolutionAPI.sendTextMessage(companyId, phone, respostaIA);

            await salvarMensagemWhatsApp({
                companyId,
                clientPhone: phone,
                clientName: contexto.cliente.nome || pushName || 'Cliente WhatsApp',
                messageText: respostaIA,
                messageType: 'text',
                direction: 'outgoing',
                conversationType: contexto.tipo,
                aiResponse: respostaIA
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error(`❌ Erro ao processar [${jobId}]:`, error.message);
        throw error; // Retenta
    }
}

/**
 * Adicionar mensagem na fila para processamento
 */
export async function addMessageToQueue(
    companyId: string,
    phone: string,
    message: string,
    messageData: any
) {
    await messageQueue.add({
        companyId,
        phone,
        message,
        messageData
    }, {
        priority: 1 // Prioridade normal
    });
}
