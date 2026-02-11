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
    const { companyId, phone, message: messageText, messageData: msg } = data;
    const jid = `${phone}@s.whatsapp.net`;

    console.log(`⚙️ Processando mensagem [${jobId}]: ${companyId} - ${phone}`);

    try {
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
            clientName: contexto.cliente.nome || 'Cliente WhatsApp',
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
            return { success: true, blocked: 'closed' };
        }

        // 4️⃣ ATALHO: CONSULTAR AGENDAMENTOS (sem IA)
        // ✅ CORREÇÃO: Só entra aqui se for uma intenção clara de consulta de agendamento PRÓPRIO.
        // Se a mensagem contiver "horário" ou "funciona", deixamos a IA responder com os horários da loja.
        const msgLower = messageText.toLowerCase();
        const perguntandoSobreLoja = msgLower.includes('horário') || msgLower.includes('horario') || msgLower.includes('funciona') || msgLower.includes('aberto');

        if (contexto.tipo === 'consultar' && !perguntandoSobreLoja) {
            // ... (Lógica de consulta simplificada ou chamar handler)
            // Por agora, vamos deixar a IA tratar se for mais complexo, 
            // ou replicar a lógica do whatsapp.ts aqui
            // Replicando lógica do whatsapp.ts:
            const dataAlvo = dadosValidados?.data || null;
            const hoje = contexto.dataAtual;

            const formatarDataBR = (yyyyMmDd: string) => {
                const [a, m, d] = String(yyyyMmDd).split('-');
                return `${d}/${m}/${a}`;
            };

            let ags = (contexto.agendamentos || []).filter((a: any) => a?.data && a.data >= hoje);
            if (dataAlvo) ags = ags.filter((a: any) => a.data === dataAlvo);

            if (ags.length > 0) {
                const linhas = ags.slice(0, 10).map((a: any) => `- ${a.servico} — ${formatarDataBR(a.data)} às ${a.hora}`);
                const msgConsulta = `Oi ${contexto.cliente.nome || 'Ney'}! 😊\nPara os próximos dias, você tem:\n${linhas.join('\n')}`;

                await evolutionAPI.sendTextMessage(companyId, phone, msgConsulta);
                await salvarMensagemWhatsApp({
                    companyId,
                    clientPhone: phone,
                    messageText: msgConsulta,
                    messageType: 'text',
                    direction: 'outgoing',
                    conversationType: contexto.tipo
                });
                return { success: true, action: 'consultar' };
            }
        }

        // 5️⃣ PREPARAR DADOS PARA IA
        const dadosParaIA = prepararDadosParaIA(contexto, dadosValidados);

        // 6️⃣ CHAMAR IA PARA GERAR RESPOSTA
        const telefone = extrairTelefoneDoJid(jid);
        const respostaIA = await gerarRespostaIA({
            ...dadosParaIA,
            companyId,
            jid: telefone,
            mensagem: messageText,
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

        // 7️⃣ ENVIAR RESPOSTA
        if (respostaIA) {
            await evolutionAPI.sendTextMessage(companyId, phone, respostaIA);

            await salvarMensagemWhatsApp({
                companyId,
                clientPhone: phone,
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
