import axios from 'axios';

// ✅ MEMÓRIA DE CHAT SEGREGADA POR EMPRESA E USUÁRIO
const chatsMemoria: Record<string, any[]> = {};

export const gerarRespostaIA = async (dados: any) => {
    try {
        // ✅ CHAVE ÚNICA: company_id + jid (número WhatsApp)
        // Isso garante que cada conversa por empresa seja isolada
        const memKey = `${dados.companyId}_${dados.jid}`;
        
        if (!chatsMemoria[memKey]) {
            chatsMemoria[memKey] = [];
        }

        // --- INSTRUÇÕES DINÂMICAS POR EMPRESA ---
        const regraSolo = dados.eSolo
            ? `Empresa SOLO. Único profissional: ${dados.profissionais[0].nome}. NUNCA ofereça outros.`
            : `Equipe: ${dados.profissionais.map((p: any) => p.nome).join(", ")}.`;

        const listaServicos = dados.servicos
            .map((s: any) => `- ${s.nome}`)
            .join('\n');

        const instrucoes = `Você é ${dados.nomeAgente} da ${dados.nomeLoja}. ${regraSolo}
Hoje é ${new Date().toLocaleDateString('pt-BR')}.

SERVIÇOS DISPONÍVEIS:
${listaServicos}

REGRAS OBRIGATÓRIAS:
1. Para agendar, SEMPRE use 'executar_agendamento'.
2. Formate a data SEMPRE como DD/MM/YYYY no prompt, mas internamente como YYYY-MM-DD.
3. Se o agendamento der 'sucesso', responda com ✅ e parabenize o cliente.
4. Se der 'ocupado', sugira OUTRO horário para o MESMO profissional.
5. Se pedir nome e não tiver cliente, peça nome completo.
6. Seja amigável, profissional e breve.

PROMPT CUSTOMIZADO DA EMPRESA:
${dados.promptBase || 'Seja prestativo e cordial.'}`;

        // --- ADICIONAR MENSAGEM DO USUÁRIO À MEMÓRIA ---
        chatsMemoria[memKey].push({
            role: "user",
            parts: [{ text: dados.textoUsuario }]
        });

        // --- CHAMAR GEMINI COM CONTEXTO ---
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: instrucoes }]
                    },
                    ...chatsMemoria[memKey]
                ],
                tools: [
                    {
                        function_declarations: [
                            {
                                name: "executar_agendamento",
                                description: "Verifica disponibilidade e grava o agendamento no sistema",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        servico: {
                                            type: "STRING",
                                            description: "Nome do serviço desejado"
                                        },
                                        data: {
                                            type: "STRING",
                                            description: "Data em formato YYYY-MM-DD"
                                        },
                                        hora: {
                                            type: "STRING",
                                            description: "Horário em formato HH:MM"
                                        },
                                        profissional: {
                                            type: "STRING",
                                            description: "Nome do profissional"
                                        }
                                    },
                                    required: ["servico", "data", "hora", "profissional"]
                                }
                            }
                        ]
                    }
                ]
            }
        );

        // --- PROCESSAR RESPOSTA ---
        const part = response.data.candidates[0].content.parts[0];

        // ✅ SE FOR FUNCTION CALL (AGENDAMENTO)
        if (part.functionCall) {
            const res = await dados.tentarAgendar(part.functionCall.args);

            // ✅ AGENDAMENTO SUCESSO
            if (res.status === "sucesso") {
                // Limpar memória após sucesso (nova conversa)
                delete chatsMemoria[memKey];

                return `✅ **Agendamento Confirmado!**\n\n📅 Data: ${res.data}\n⏰ Horário: ${res.hora}\n💇 Profissional: ${res.profissional}\n🔧 Serviço: ${res.servico}\n\nAté logo! 😊`;
            }

            // ❌ HORÁRIO OCUPADO
            if (res.status === "ocupado") {
                const resposta = `⏰ O horário das ${part.functionCall.args.hora} com ${res.profissional} está ocupado.\n\nQue tal outro horário?`;
                
                // Adicionar resposta da IA à memória
                chatsMemoria[memKey].push({
                    role: "model",
                    parts: [{ text: resposta }]
                });

                return resposta;
            }

            // 👤 PRECISA DO NOME DO CLIENTE
            if (res.status === "pedir_nome") {
                const resposta = `✅ Ótimo! O horário das ${res.dados.hora} está disponível!\n\nQual seu nome completo para finalizarmos o agendamento?`;
                
                // Adicionar resposta da IA à memória
                chatsMemoria[memKey].push({
                    role: "model",
                    parts: [{ text: resposta }]
                });

                return resposta;
            }

            // 🔴 ERRO GERAL
            if (res.status === "erro") {
                const resposta = `❌ Oops! ${res.mensagem}\n\nPode tentar outro horário?`;
                
                chatsMemoria[memKey].push({
                    role: "model",
                    parts: [{ text: resposta }]
                });

                return resposta;
            }
        }

        // ✅ SE FOR RESPOSTA EM TEXTO (NÃO AGENDAMENTO)
        const textoIA = part.text || "Como posso ajudar?";

        // Adicionar resposta da IA à memória para contexto futuro
        chatsMemoria[memKey].push({
            role: "model",
            parts: [{ text: textoIA }]
        });

        // ⚠️ LIMITAR HISTÓRICO PARA NÃO EXPLODIR TOKENS
        // Manter apenas as últimas 10 mensagens
        if (chatsMemoria[memKey].length > 20) {
            chatsMemoria[memKey] = chatsMemoria[memKey].slice(-20);
        }

        return textoIA;

    } catch (error: any) {
        console.error("❌ ERRO NA IA:", error.message);
        return "Estou com uma instabilidade. Tente novamente em instantes. 🔧";
    }
};

// ✅ FUNÇÃO PARA LIMPAR MEMÓRIA (útil pra debug)
export const limparMemoriaChat = (companyId: string, jid: string) => {
    const memKey = `${companyId}_${jid}`;
    if (chatsMemoria[memKey]) {
        delete chatsMemoria[memKey];
        console.log(`🗑️ Memória de chat limpa: ${memKey}`);
    }
};

// ✅ FUNÇÃO PARA VER STATUS DA MEMÓRIA (debug)
export const getStatusMemoria = () => {
    return {
        totalChats: Object.keys(chatsMemoria).length,
        chats: Object.keys(chatsMemoria)
    };
};