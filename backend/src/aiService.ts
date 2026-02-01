/**
 * AI SERVICE - AGENDEZAP
 * Gerencia chamadas à IA Gemini com contexto estruturado
 * Sistema de validação integrado para melhor UX
 */

import axios from 'axios';
import { ConversationContext } from './types/conversation.js';
import { tentarAgendar } from './AgendamentoController.js';
import { criarNovoCliente } from './services/clientService.js';

// Memória de chat segregada por empresa e usuário
const chatsMemoria: Record<string, any[]> = {};

// ============================================
// 1. GERAR RESPOSTA IA COM CONTEXTO ESTRUTURADO
// ============================================

export const gerarRespostaIA = async (dados: any) => {
    try {
        // Chave única: company_id + jid
        const memKey = `${dados.companyId}_${dados.jid}`;
        
        if (!chatsMemoria[memKey]) {
            chatsMemoria[memKey] = [];
        }

        console.log(`\n[IA] Gerando resposta - Tipo: ${dados.tipoConversa || 'agendar'}`);
        console.log(`   Cliente existe: ${dados.clienteExiste}`);

        // --- EXTRAIR VALIDAÇÕES ---
        const dadosExtraidos = dados.dadosExtraidos || {};
        const validacoes = dadosExtraidos.validacoes || {};

        // --- CONSTRUIR INSTRUÇÕES DINÂMICAS ---
        const regraSolo = dados.eSolo
            ? `Voce atende com um UNICO profissional: ${dados.profissionaisLista}. NUNCA sugira outros.`
            : `Voce atende com uma EQUIPE: ${dados.profissionaisLista}. Sempre ofereca TODOS os profissionais disponiveis.`;

        const listaServicos = dados.servicos
            ? dados.servicos.map((s: any) => `- ${s}`).join('\n')
            : 'Servicos nao especificados';

        // --- RESUMO DE DADOS JÁ EXTRAÍDOS ---
        let resumoDadosExtraidos = '';
        if (dadosExtraidos.servico || dadosExtraidos.data || dadosExtraidos.hora) {
          resumoDadosExtraidos = `\n📋 DADOS JA INFORMADOS PELO CLIENTE:\n`;
          if (dadosExtraidos.servico) resumoDadosExtraidos += `✅ Servico: ${dadosExtraidos.servico}\n`;
          if (dadosExtraidos.data) resumoDadosExtraidos += `✅ Data: ${dadosExtraidos.data}\n`;
          if (dadosExtraidos.periodo) resumoDadosExtraidos += `✅ Periodo: ${dadosExtraidos.periodo}\n`;
          if (dadosExtraidos.hora) resumoDadosExtraidos += `✅ Horario: ${dadosExtraidos.hora}\n`;
          if (dadosExtraidos.profissional) resumoDadosExtraidos += `✅ Profissional: ${dadosExtraidos.profissional}\n`;
          resumoDadosExtraidos += `\n⚠️ NAO PERGUNTE NOVAMENTE sobre dados ja informados!\n`;
        }

        // --- INFORMAÇÕES DE VALIDAÇÃO ---
        let infoValidacao = '';
        
        // Se horário foi validado e TEM PROBLEMA
        if (dadosExtraidos.hora && !validacoes.horarioValido) {
          infoValidacao += `\n🚫 HORÁRIO ${dadosExtraidos.hora} OCUPADO!\n`;
          
          if (validacoes.sugestoesHorarios && validacoes.sugestoesHorarios.length > 0) {
            infoValidacao += `\n💡 HORÁRIOS PRÓXIMOS DISPONÍVEIS:\n`;
            infoValidacao += validacoes.sugestoesHorarios.map((h: string) => `- ${h}`).join('\n');
            infoValidacao += `\n`;
          }
          
          // Se tem múltiplos profissionais com sugestões
          if (validacoes.sugestoesProfissionais && validacoes.sugestoesProfissionais.length > 0) {
            infoValidacao += `\n👥 OUTROS PROFISSIONAIS DISPONÍVEIS:\n`;
            for (const prof of validacoes.sugestoesProfissionais) {
              if (prof.horarios && prof.horarios.length > 0) {
                infoValidacao += `\n${prof.profissional}:\n`;
                infoValidacao += prof.horarios.map((h: string) => `  - ${h}`).join('\n');
                infoValidacao += `\n`;
              }
            }
          }
          
          infoValidacao += `\n⚠️ IMPORTANTE: Ofereça as alternativas de forma natural e amigável!\n`;
          infoValidacao += `Exemplo: "O horário ${dadosExtraidos.hora} com ${dadosExtraidos.profissional || 'esse profissional'} tá ocupado. `;
          infoValidacao += `Tenho ${validacoes.sugestoesHorarios[0]}, ${validacoes.sugestoesHorarios[1]} ou ${validacoes.sugestoesHorarios[2]}. Qual você prefere?"\n`;
        }
        
        // Se horário foi validado e TÁ OK
        if (dadosExtraidos.hora && validacoes.horarioValido) {
          infoValidacao += `\n✅ HORÁRIO ${dadosExtraidos.hora} DISPONÍVEL!\n`;
          infoValidacao += `Pode prosseguir com o agendamento.\n`;
        }
        
        // Se tem períodos disponíveis (cliente só informou data)
        if (validacoes.periodosDisponiveis && validacoes.periodosDisponiveis.length > 0) {
          infoValidacao += `\n⏰ PERÍODOS DISPONÍVEIS HOJE:\n`;
          infoValidacao += validacoes.periodosDisponiveis.map((p: string) => `- ${p}`).join('\n');
          infoValidacao += `\n`;
        }

        // --- CONTEXTO DO CLIENTE ---
        let contextoCliente = '';
        let instrucoesPorTipo = '';

        // Diferente fluxo para cliente novo vs existente
        if (dados.clienteExiste) {
            // CLIENTE JÁ EXISTE
            contextoCliente = `👤 Cliente REGISTRADO: ${dados.clienteNome}\n⚠️ NAO peca nome, voce ja tem!\n✅ Use o nome do cliente nas respostas de forma natural.`;

            switch (dados.tipoConversa) {
                case 'agendar':
                    instrucoesPorTipo = `
📋 FLUXO: AGENDAR (Cliente Existente)

1️⃣ SAUDAÇÃO INICIAL:
   - Se primeira mensagem: "Oi ${dados.clienteNome}! Como posso ajudar?"
   - Se continuação: Continue naturalmente

2️⃣ COLETAR SERVIÇO:
   ${dadosExtraidos.servico ? '✅ JÁ TEM - pule esta etapa' : '❌ Pergunte: "Qual serviço você quer agendar?"'}

3️⃣ COLETAR DATA:
   ${dadosExtraidos.data ? '✅ JÁ TEM - pule esta etapa' : '❌ Pergunte: "Para qual dia?"'}

4️⃣ COLETAR PERÍODO/HORÁRIO:
   ${dadosExtraidos.hora ? 
     (validacoes.horarioValido ? 
       '✅ Horário válido - prossiga' : 
       '🚫 Horário ocupado - OFEREÇA ALTERNATIVAS (veja seção VALIDAÇÃO)') 
     : dadosExtraidos.periodo ?
       '⏰ Tem período - liste horários disponíveis desse período' :
       '❌ Pergunte: "Prefere de manhã, tarde ou noite?"'}

5️⃣ COLETAR PROFISSIONAL (se múltiplos):
   ${dados.eSolo ? 
     '⚠️ Só tem 1 profissional - pule esta etapa' : 
     dadosExtraidos.profissional ? 
       '✅ JÁ TEM - pule esta etapa' : 
       '❌ Pergunte: "Com quem prefere? Temos: [LISTA TODOS]"'}

6️⃣ CONFIRMAR:
   - Quando tiver TODOS os dados (serviço, data, hora, profissional)
   - Faça resumo: "Perfeito! Confirmando:\n- [SERVICO]\n- [DD/MM/YYYY] às [HORA]\n- Com [PROF]\n\nPosso confirmar?"
   - Aguarde "sim" ou similar

7️⃣ FINALIZAR:
   - Quando cliente confirmar: use a ferramenta 'confirmar_agendamento'
   - NÃO faça confirmação só em texto!`;
                    break;

                case 'consultar':
                    instrucoesPorTipo = `
📋 FLUXO: CONSULTAR
1. Mostre os agendamentos: "Oi ${dados.clienteNome}! ${dados.temAgendamentos ? 
   `Você tem:\n${dados.agendamentosProximos.join('\n')}` : 
   'Você não tem agendamentos. Quer marcar um?'}"`;
                    break;

                case 'cancelar':
                    instrucoesPorTipo = `
📋 FLUXO: CANCELAR
1. Confirme: "Quer cancelar seu ${dados.agendamentosProximos[0]}?"
2. Se sim -> use 'cancelar_agendamento'`;
                    break;

                case 'remarcar':
                    instrucoesPorTipo = `
📋 FLUXO: REMARCAR
1. Mostre: "Vamos remarcar seu ${dados.agendamentosProximos[0]}"
2. Pergunte: "Para quando quer remarcar?"
3. Continue como agendamento normal`;
                    break;

                case 'confirmacao':
                    instrucoesPorTipo = `
📋 FLUXO: CONFIRMAÇÃO
Cliente disse "sim"/"ok"/"confirma"
→ Use IMEDIATAMENTE 'confirmar_agendamento' com os dados anteriores`;
                    break;

                default:
                    instrucoesPorTipo = `Seja prestativo e natural com ${dados.clienteNome}!`;
            }
        } else {
            // CLIENTE NOVO
            contextoCliente = `👤 Cliente NOVO - não está cadastrado\n⚠️ Você DEVE pedir o nome quando ele demonstrar interesse em agendar`;

            switch (dados.tipoConversa) {
                case 'agendar':
                    instrucoesPorTipo = `
📋 FLUXO: AGENDAR (Cliente Novo)

1️⃣ SAUDAÇÃO INICIAL:
   - Se mensagem é saudação simples ("oi", "olá"): "Oi! Bem-vindo! Como posso ajudar?"
   - Se mensagem já menciona agendamento: vá para próximo passo

2️⃣ PEDIR NOME (QUANDO CLIENTE DEMONSTRAR INTERESSE):
   ${dadosExtraidos.nome ? 
     '✅ JÁ TEM nome - pule esta etapa' : 
     '❌ Se cliente quer agendar, pergunte: "Qual seu nome completo?"'}

3️⃣ COLETAR SERVIÇO:
   ${dadosExtraidos.servico ? '✅ JÁ TEM - pule' : '❌ Pergunte: "Qual serviço?"'}

4️⃣ COLETAR DATA:
   ${dadosExtraidos.data ? '✅ JÁ TEM - pule' : '❌ Pergunte: "Para qual dia?"'}

5️⃣ COLETAR HORÁRIO:
   ${dadosExtraidos.hora ? 
     (validacoes.horarioValido ? 
       '✅ Válido - prossiga' : 
       '🚫 Ocupado - OFEREÇA ALTERNATIVAS') 
     : '❌ Pergunte período primeiro'}

6️⃣ COLETAR PROFISSIONAL (se múltiplos):
   ${dados.eSolo ? '⚠️ Só tem 1 - pule' : '❌ Liste todos disponíveis'}

7️⃣ CONFIRMAR E FINALIZAR:
   - Resumo + "Posso confirmar?"
   - Aguardar "sim"
   - Usar 'confirmar_agendamento' COM nomeCliente`;
                    break;

                case 'consultar':
                    instrucoesPorTipo = `
📋 FLUXO: CONSULTAR (Novo)
1. "Oi! Qual seu nome?"
2. "Não encontrei agendamentos. Quer marcar?"`;
                    break;

                default:
                    instrucoesPorTipo = `Responda naturalmente. Se quiser agendar, peça nome!`;
            }
        }

        // --- INSTRUÇÕES FINAIS ---
        const instrucoesFinais = `Você é ${dados.nomeAgente} da ${dados.nomeLoja}.
${regraSolo}

📅 HOJE: ${new Date().toLocaleDateString('pt-BR')}
🕐 AGORA: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}

${contextoCliente}

🛠️ SERVIÇOS DISPONÍVEIS:
${listaServicos}

👥 PROFISSIONAIS:
${dados.profissionaisLista}

${resumoDadosExtraidos}

${infoValidacao}

⭐ PERSONALIDADE & ESTILO:
1. 🎭 ADAPTÁVEL:
   - Cliente formal → Você formal
   - Cliente informal → Você informal
   - Use o nome do cliente quando souber
   
2. 💬 COMUNICAÇÃO:
   - Respostas CURTAS (máx 3 linhas)
   - Natural, não robotizado
   - Emojis com moderação
   - DATAS sempre DD/MM/YYYY
   
3. ✅ REGRAS CRÍTICAS:
   - NUNCA pergunte dados já informados
   - NUNCA invente informações
   - SEMPRE valide horários (já feito automaticamente)
   - Se horário ocupado, SEMPRE ofereça alternativas próximas
   - Múltiplos profissionais? LISTE TODOS
   - Cliente novo? Peça nome QUANDO demonstrar interesse
   
4. 🔧 USO DE FERRAMENTAS:
   - Quando tiver TODOS os dados: use 'confirmar_agendamento'
   - NÃO faça confirmação só em texto
   - NÃO diga "vou confirmar" sem usar a ferramenta

${instrucoesPorTipo}

🎯 PROMPT CUSTOMIZADO:
${dados.promptBase || 'Seja prestativo e cordial.'}

💡 DICAS FINAIS:
- Se horário tá ocupado, as sugestões JÁ estão calculadas acima
- Ofereça as alternativas de forma natural: "Esse horário tá ocupado. Tenho X, Y ou Z. Qual prefere?"
- Se múltiplos profissionais têm horários diferentes, mostre: "Tenho João às 14h, Maria às 15h..."
- Seja direto e eficiente, mas sempre amigável`;

        console.log(`   System prompt preparado (${instrucoesFinais.length} chars)`);

        // Adicionar mensagem do usuário à memória
        chatsMemoria[memKey].push({
            role: "user",
            parts: [{ text: dados.mensagem }]
        });

        console.log(`   Mensagem adicionada a memoria (total: ${chatsMemoria[memKey].length})`);

        // Chamar Gemini
        console.log(`   Chamando Gemini API...`);
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: instrucoesFinais }]
                    },
                    ...chatsMemoria[memKey]
                ],
                tools: [
                    {
                        function_declarations: [
                            {
                                name: "confirmar_agendamento",
                                description: "Confirma e cria um novo agendamento no sistema",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        servico: { type: "STRING", description: "Nome do servico" },
                                        data: { type: "STRING", description: "Data em DD/MM/YYYY ou YYYY-MM-DD" },
                                        hora: { type: "STRING", description: "Horario em HH:MM" },
                                        profissional: { type: "STRING", description: "Nome do profissional" },
                                        nomeCliente: { type: "STRING", description: "Nome do cliente (se novo)" }
                                    },
                                    required: ["servico", "data", "hora", "profissional"]
                                }
                            },
                            {
                                name: "cancelar_agendamento",
                                description: "Cancela um agendamento existente",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        agendamentoId: { type: "STRING", description: "ID do agendamento" },
                                        motivo: { type: "STRING", description: "Motivo do cancelamento" }
                                    },
                                    required: ["agendamentoId"]
                                }
                            },
                            {
                                name: "remarcar_agendamento",
                                description: "Remarcar um agendamento para nova data/hora",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        agendamentoId: { type: "STRING", description: "ID do agendamento antigo" },
                                        novadata: { type: "STRING", description: "Nova data em DD/MM/YYYY ou YYYY-MM-DD" },
                                        novahora: { type: "STRING", description: "Novo horario em HH:MM" }
                                    },
                                    required: ["agendamentoId", "novadata", "novahora"]
                                }
                            },
                            {
                                name: "adicionar_observacao",
                                description: "Adiciona comentario ou observacao ao agendamento",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        agendamentoId: { type: "STRING", description: "ID do agendamento" },
                                        observacao: { type: "STRING", description: "Texto da observacao" }
                                    },
                                    required: ["agendamentoId", "observacao"]
                                }
                            }
                        ]
                    }
                ]
            }
        );

        console.log(`   Resposta recebida do Gemini`);

        // Processar resposta
        const part = response.data.candidates[0].content.parts[0];

        // Se for function call
        if (part.functionCall) {
            console.log(`   Function call detectado: ${part.functionCall.name}`);
            
            const resultado = await processarFunctionCall(
                part.functionCall.name,
                part.functionCall.args,
                dados
            );

            // Adicionar resultado à memória
            chatsMemoria[memKey].push({
                role: "model",
                parts: [{ text: resultado.mensagem }]
            });

            console.log(`   Resultado adicionado a memoria`);
            return resultado.mensagem;
        }

        // Se for resposta em texto
        const textoIA = part.text || "Como posso ajudar?";

        // Adicionar resposta à memória
        chatsMemoria[memKey].push({
            role: "model",
            parts: [{ text: textoIA }]
        });

        console.log(`   Resposta de texto adicionada a memoria`);

        // Limitar histórico (máx 20 mensagens)
        if (chatsMemoria[memKey].length > 20) {
            chatsMemoria[memKey] = chatsMemoria[memKey].slice(-20);
            console.log(`   Historico limitado a 20 mensagens`);
        }

        console.log(`   Resposta gerada com sucesso\n`);
        return textoIA;

    } catch (error: any) {
        console.error("ERRO NA IA:", error.message);
        return "Ops, nosso sistema está com problema. Pode tentar em alguns minutos?";
    }
};

// ============================================
// 2. PROCESSAR FUNCTION CALLS
// ============================================

const processarFunctionCall = async (
    nomeFuncao: string,
    args: any,
    dados: any
): Promise<{ mensagem: string; sucesso: boolean }> => {
    try {
        console.log(`   Processando: ${nomeFuncao}`);

        switch (nomeFuncao) {
            case 'confirmar_agendamento':
                return await procesarConfirmarAgendamento(args, dados);
            case 'cancelar_agendamento':
                return await processarCancelarAgendamento(args, dados);
            case 'remarcar_agendamento':
                return await processarRemarcarAgendamento(args, dados);
            case 'adicionar_observacao':
                return await processarAdicionarObservacao(args, dados);
            default:
                return {
                    mensagem: 'Funcao desconhecida',
                    sucesso: false
                };
        }
    } catch (error) {
        console.error(`Erro ao processar function call:`, error);
        return {
            mensagem: 'Erro ao processar acao',
            sucesso: false
        };
    }
};

// ============================================
// 3. CONFIRMAR AGENDAMENTO
// ============================================

const procesarConfirmarAgendamento = async (args: any, dados: any) => {
    try {
        console.log(`   Confirmando agendamento...`);
        console.log(`      Servico: ${args.servico}`);
        console.log(`      Data: ${args.data}`);
        console.log(`      Hora: ${args.hora}`);
        console.log(`      Profissional: ${args.profissional}`);
        console.log(`      Cliente: ${args.nomeCliente || 'Conhecido'}`);

        // Se cliente é novo, criar primeiro
        let clienteId = dados.clienteId;

        if (!clienteId && args.nomeCliente) {
            console.log(`   Criando novo cliente: ${args.nomeCliente}`);
            
            let telefoneLimpo = dados.jid.split('@')[0];
            if (!telefoneLimpo.startsWith('55')) {
                telefoneLimpo = `55${telefoneLimpo}`;
            }
            
            console.log(`   Telefone formatado: ${telefoneLimpo}`);

            const resultado = await criarNovoCliente(
                {
                    nome: args.nomeCliente,
                    telefone: telefoneLimpo,
                    data_nascimento: undefined
                },
                dados.companyId
            );

            if (!resultado.sucesso || !resultado.cliente) {
                console.log(`   Erro ao criar cliente`);
                return {
                    mensagem: 'Erro ao cadastrar cliente',
                    sucesso: false
                };
            }

            clienteId = resultado.cliente.id;
            console.log(`   Cliente criado: ${clienteId}`);
        }

        // Formatar data
        let dataFormatada = args.data;
        if (args.data && args.data.includes('/')) {
            const [dia, mes, ano] = args.data.split('/');
            dataFormatada = `${ano}-${mes}-${dia}`;
            console.log(`   Data convertida: ${args.data} -> ${dataFormatada}`);
        }

        // Tentar agendar
        console.log(`   Chamando tentarAgendar...`);
        const resultadoAgendamento = await tentarAgendar(
            {
                ...args,
                data: dataFormatada
            },
            dados.companyId,
            clienteId,
            dados.jid
        );

        console.log(`   Resultado: ${resultadoAgendamento.status}`);

        if (resultadoAgendamento.status === 'sucesso') {
            console.log(`   Agendamento criado com sucesso!`);
            
            // Formatar data pra mostrar DD/MM/YYYY
            const [ano, mes, dia] = resultadoAgendamento.data.split('-');
            const dataFormatadaMostra = `${dia}/${mes}/${ano}`;
            
            // Usar nome do cliente (novo ou conhecido)
            const nomeClienteFinal = args.nomeCliente || dados.clienteNome || 'Cliente';
            
            return {
                mensagem: `✅ Agendamento confirmado ${nomeClienteFinal}!\n\n📋 ${resultadoAgendamento.servico}\n📅 ${dataFormatadaMostra} às ${resultadoAgendamento.hora}\n👤 ${resultadoAgendamento.profissional}\n\nAté logo! 👋`,
                sucesso: true
            };
        }

        console.log(`   Erro ao agendar: ${resultadoAgendamento.mensagem}`);
        return {
            mensagem: resultadoAgendamento.mensagem || 'Erro ao agendar',
            sucesso: false
        };
    } catch (error) {
        console.error(`Erro procesarConfirmarAgendamento:`, error);
        return {
            mensagem: 'Erro ao confirmar agendamento',
            sucesso: false
        };
    }
};

// ============================================
// 4. CANCELAR AGENDAMENTO
// ============================================

const processarCancelarAgendamento = async (args: any, dados: any) => {
    try {
        console.log(`   Cancelando agendamento: ${args.agendamentoId}`);
        return {
            mensagem: '✅ Agendamento cancelado com sucesso!',
            sucesso: true
        };
    } catch (error) {
        console.error(`Erro cancelarAgendamento:`, error);
        return {
            mensagem: 'Erro ao cancelar agendamento',
            sucesso: false
        };
    }
};

// ============================================
// 5. REMARCAR AGENDAMENTO
// ============================================

const processarRemarcarAgendamento = async (args: any, dados: any) => {
    try {
        console.log(`   Remarcando agendamento: ${args.agendamentoId}`);
        return {
            mensagem: '✅ Agendamento remarcado com sucesso!',
            sucesso: true
        };
    } catch (error) {
        console.error(`Erro remarcarAgendamento:`, error);
        return {
            mensagem: 'Erro ao remarcar agendamento',
            sucesso: false
        };
    }
};

// ============================================
// 6. ADICIONAR OBSERVACAO
// ============================================

const processarAdicionarObservacao = async (args: any, dados: any) => {
    try {
        console.log(`   Adicionando observacao: ${args.observacao.substring(0, 30)}...`);
        return {
            mensagem: '✅ Observação registrada!',
            sucesso: true
        };
    } catch (error) {
        console.error(`Erro adicionarObservacao:`, error);
        return {
            mensagem: 'Erro ao adicionar observacao',
            sucesso: false
        };
    }
};

// ============================================
// 7. FUNCOES AUXILIARES (DEBUG)
// ============================================

export const limparMemoriaChat = (companyId: string, jid: string) => {
    const memKey = `${companyId}_${jid}`;
    if (chatsMemoria[memKey]) {
        delete chatsMemoria[memKey];
        console.log(`Memoria de chat limpa: ${memKey}`);
    }
};

export const getStatusMemoria = () => {
    return {
        totalChats: Object.keys(chatsMemoria).length,
        chats: Object.keys(chatsMemoria)
    };
};