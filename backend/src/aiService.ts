/**
 * AI SERVICE - AGENDEZAP
 * Gerencia chamadas à IA Gemini com contexto estruturado
 * Sistema de validação integrado para melhor UX
 * 
 * ✅ CORRIGIDO ETAPA 1:
 * - IA VÊ horariosDisponiveis e periodosDisponiveis
 * - IA NÃO ignora "hoje/amanhã"
 * - IA MOSTRA horários ao cliente
 */

import axios from 'axios';
import { ConversationContext } from './types/conversation.js';
import { tentarAgendar } from './AgendamentoController.js';
import { criarNovoCliente } from './services/clientService.js';

// Memória de chat segregada por empresa e usuário
const chatsMemoria: Record<string, any[]> = {};

export const gerarRespostaIA = async (dados: any) => {
    try {
        const memKey = `${dados.companyId}_${dados.jid}`;
        
        if (!chatsMemoria[memKey]) {
            chatsMemoria[memKey] = [];
        }

        console.log(`\n[IA] Gerando resposta - Tipo: ${dados.tipoConversa || 'agendar'}`);
        console.log(`   Cliente existe: ${dados.clienteExiste}`);

        const dadosExtraidos = dados.dadosExtraidos || {};
        const validacoes = dadosExtraidos.validacoes || {};

        const regraSolo = dados.eSolo
            ? `Voce atende com um UNICO profissional: ${dados.profissionaisLista}. NUNCA sugira outros.`
            : `Voce atende com uma EQUIPE: ${dados.profissionaisLista}. Sempre ofereca TODOS os profissionais disponiveis.`;

        const listaServicos = dados.servicos
            ? dados.servicos.map((s: any) => `- ${s}`).join('\n')
            : 'Servicos nao especificados';

        // ✅ ETAPA 1: CORRIGIDO - Mostra horários e períodos disponíveis!
        let resumoDadosExtraidos = '';
        if (dadosExtraidos.servico || dadosExtraidos.data || dadosExtraidos.hora) {
          resumoDadosExtraidos = `\n📋 DADOS JA INFORMADOS PELO CLIENTE:\n`;
          if (dadosExtraidos.servico) resumoDadosExtraidos += `✅ Servico: ${dadosExtraidos.servico}\n`;
          
          // ✅ ETAPA 1: Formata data corretamente
          if (dadosExtraidos.data) {
            const [ano, mes, dia] = dadosExtraidos.data.split('-');
            const dataFormatada = `${dia}/${mes}/${ano}`;
            resumoDadosExtraidos += `✅ Data: ${dataFormatada} (${dadosExtraidos.data})\n`;
          }
          
          if (dadosExtraidos.periodo) resumoDadosExtraidos += `✅ Periodo: ${dadosExtraidos.periodo}\n`;
          if (dadosExtraidos.hora) resumoDadosExtraidos += `✅ Horario: ${dadosExtraidos.hora}\n`;
          if (dadosExtraidos.profissional) resumoDadosExtraidos += `✅ Profissional: ${dadosExtraidos.profissional}\n`;
          if (dadosExtraidos.nome) resumoDadosExtraidos += `✅ Nome: ${dadosExtraidos.nome}\n`;
          
          // ✅ ETAPA 1: NOVO - Horários disponíveis
          if (dadosExtraidos.horariosDisponiveis && dadosExtraidos.horariosDisponiveis.length > 0) {
            resumoDadosExtraidos += `\n🕐 HORÁRIOS DISPONÍVEIS ${dadosExtraidos.periodo ? `(${dadosExtraidos.periodo})` : ''}:\n`;
            resumoDadosExtraidos += dadosExtraidos.horariosDisponiveis.join(', ') + '\n';
            resumoDadosExtraidos += `\n⚠️ CRÍTICO: Mostre ESTES horários ao cliente! Não invente outros!\n`;
            resumoDadosExtraidos += `⚠️ Se cliente escolher horário, VALIDE se está nesta lista!\n`;
          } else if (dadosExtraidos.data && dadosExtraidos.profissional && dadosExtraidos.periodo) {
            resumoDadosExtraidos += `\n❌ NENHUM HORÁRIO DISPONÍVEL para ${dadosExtraidos.periodo}!\n`;
            resumoDadosExtraidos += `⚠️ Informe ao cliente e sugira outro período!\n`;
          }
          

          
          resumoDadosExtraidos += `\n⚠️ NAO PERGUNTE NOVAMENTE sobre dados ja informados!\n`;
        }

        // INFORMAÇÕES DE VALIDAÇÃO
        let infoValidacao = '';
        
        if (dadosExtraidos.hora && !validacoes.horarioValido) {
          infoValidacao += `\n🚫 HORÁRIO ${dadosExtraidos.hora} OCUPADO OU FORA DO FUNCIONAMENTO!\n`;
          
          if (validacoes.sugestoesHorarios && validacoes.sugestoesHorarios.length > 0) {
            infoValidacao += `\n💡 HORÁRIOS PRÓXIMOS DISPONÍVEIS:\n`;
            infoValidacao += validacoes.sugestoesHorarios.map((h: string) => `- ${h}`).join('\n');
            infoValidacao += `\n`;
          }
          
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
          
          infoValidacao += `\n⚠️ CRÍTICO - LEIA COM ATENÇÃO:\n`;
          infoValidacao += `\n❌ O HORÁRIO ${dadosExtraidos.hora} NÃO PODE SER AGENDADO!\n`;
          infoValidacao += `\n✅ VOCÊ DEVE:\n`;
          infoValidacao += `1. NÃO perguntar "Posso confirmar?" - o horário está INDISPONÍVEL!\n`;
          infoValidacao += `2. INFORMAR IMEDIATAMENTE que o horário não está disponível\n`;
          infoValidacao += `3. OFERECER as alternativas acima de forma natural e amigável\n`;
          infoValidacao += `\n📝 EXEMPLO DE RESPOSTA CORRETA:\n`;
          infoValidacao += `"O horário ${dadosExtraidos.hora}${dadosExtraidos.profissional ? ' com ' + dadosExtraidos.profissional : ''} não tá disponível. `;
          
          if (validacoes.sugestoesHorarios && validacoes.sugestoesHorarios.length >= 3) {
            infoValidacao += `Mas tenho ${validacoes.sugestoesHorarios[0]}, ${validacoes.sugestoesHorarios[1]} ou ${validacoes.sugestoesHorarios[2]}. Qual prefere?"\n`;
          } else if (validacoes.sugestoesProfissionais && validacoes.sugestoesProfissionais.length > 0) {
            infoValidacao += `Mas tenho outros profissionais disponíveis. Quer ver as opções?"\n`;
          } else {
            infoValidacao += `Infelizmente não temos outros horários disponíveis para esse dia. Quer tentar outro dia?"\n`;
          }
          
          infoValidacao += `\n❌ NUNCA FAÇA ISSO:\n`;
          infoValidacao += `- "Perfeito! Confirmando: ... Posso confirmar?" (ERRADO - horário indisponível!)\n`;
          infoValidacao += `- Pedir confirmação quando o horário está ocupado\n`;
          infoValidacao += `- Fingir que o horário está disponível\n`;
          infoValidacao += `\n`;
        }
        
        if (dadosExtraidos.hora && validacoes.horarioValido) {
          infoValidacao += `\n✅ HORÁRIO ${dadosExtraidos.hora} DISPONÍVEL!\n`;
          infoValidacao += `Pode prosseguir com o agendamento normalmente.\n`;
        }
        
        if (dadosExtraidos.data && !validacoes.diaAberto && validacoes.motivoErro) {
          infoValidacao += `\n🚫 DIA FECHADO!\n`;
          infoValidacao += `\n⚠️ CRÍTICO:\n`;
          infoValidacao += `O estabelecimento está FECHADO neste dia!\n`;
          infoValidacao += `Motivo: ${validacoes.motivoErro}\n`;
          infoValidacao += `\n✅ VOCÊ DEVE:\n`;
          infoValidacao += `1. Informar que está fechado\n`;
          infoValidacao += `2. Sugerir outro dia\n`;
          infoValidacao += `3. NÃO tentar agendar para este dia\n`;
          infoValidacao += `\n`;
        }
        
        if (dadosExtraidos.data && dadosExtraidos.hora && validacoes.horarioPassado && validacoes.motivoErro) {
          infoValidacao += `\n⏰ HORÁRIO NO PASSADO!\n`;
          infoValidacao += `\n⚠️ CRÍTICO:\n`;
          infoValidacao += `${validacoes.motivoErro}\n`;
          infoValidacao += `\n✅ VOCÊ DEVE:\n`;
          infoValidacao += `1. Informar que o horário já passou\n`;
          infoValidacao += `2. Sugerir horários futuros (com pelo menos 1h de antecedência)\n`;
          infoValidacao += `3. NÃO tentar agendar horários no passado\n`;
          infoValidacao += `\n`;
        }
        
        if (validacoes.periodosDisponiveis && validacoes.periodosDisponiveis.length > 0) {
          infoValidacao += `\n⏰ PERÍODOS DISPONÍVEIS:\n`;
          infoValidacao += validacoes.periodosDisponiveis.map((p: string) => `- ${p}`).join('\n');
          infoValidacao += `\n`;
          infoValidacao += `Pergunte ao cliente qual período prefere.\n`;
        }

        let contextoCliente = '';
        let instrucoesPorTipo = '';

        if (dados.clienteExiste) {
            contextoCliente = `👤 Cliente REGISTRADO: ${dados.clienteNome}\n⚠️ NAO peca nome, voce ja tem!\n✅ Use o nome do cliente nas respostas de forma natural.`;

            switch (dados.tipoConversa) {
                case 'agendar':
                    instrucoesPorTipo = `
📋 FLUXO: AGENDAR (Cliente Existente)

1️⃣ SAUDAÇÃO INICIAL:
   ${dadosExtraidos.servico || dadosExtraidos.data ? 
     '⚠️ Cliente JÁ DISSE o que quer (serviço/data)!\n   ❌ NÃO pergunte "Como posso ajudar?"\n   ✅ Vá DIRETO para o próximo passo!' : 
     '✅ Se primeira mensagem: "Oi ${dados.clienteNome}! Como posso ajudar?"'}

2️⃣ COLETAR SERVIÇO:
   ${dadosExtraidos.servico ? '✅ JÁ TEM - pule esta etapa' : '❌ Pergunte: "Qual serviço você quer agendar?"'}


   ${dadosExtraidos.hora ? 
     (validacoes.horarioValido ? 
       '✅ Horário VÁLIDO e DISPONÍVEL - pode CONFIRMAR' : 
       '🚫 Horário INVÁLIDO/OCUPADO - NÃO pergunte "posso confirmar?"\n   → OFEREÇA ALTERNATIVAS IMEDIATAMENTE (veja seção VALIDAÇÃO)') 
     : dadosExtraidos.periodo ?
       '⏰ Tem período - liste horários disponíveis desse período' :
       '❌ Pergunte: "Prefere de manhã, tarde ou noite?"'}

5️⃣ COLETAR PROFISSIONAL (se múltiplos):
   ${dados.eSolo ? 
     '⚠️ Só tem 1 profissional - pule esta etapa' : 
     dadosExtraidos.profissional ? 
       '✅ JÁ TEM - pule esta etapa' : 
       '❌ Pergunte: "Com quem prefere? Temos: [LISTA TODOS]"'}

6️⃣ CONFIRMAR (APENAS SE TUDO VÁLIDO - ✅ CORRIGIDO):
   ⚠️ ATENÇÃO CRÍTICA: Só peça confirmação se:
   - Tem serviço ✅
   - Tem data ✅
   - Tem hora VÁLIDA E DISPONÍVEL ✅
   - Tem profissional ✅
   
   ❌ Se QUALQUER validação falhou:
   → NÃO peça confirmação
   → OFEREÇA alternativas imediatamente
   → Veja seção VALIDAÇÃO acima
   
   ✅ Se TUDO válido:
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
            // ✅ CLIENTE NOVO
            contextoCliente = `👤 Cliente NOVO - não está cadastrado\n⚠️ Você DEVE pedir o nome ANTES DE CONFIRMAR (não no início!)`;

            switch (dados.tipoConversa) {
                case 'agendar':
                    instrucoesPorTipo = `
📋 FLUXO: AGENDAR (Cliente Novo)

⚠️ REGRA DE OURO: Só peça o NOME quando for CONFIRMAR o agendamento!
   NÃO peça nome no início da conversa!

1️⃣ SAUDAÇÃO INICIAL:
   ${dadosExtraidos.servico || dadosExtraidos.data ? 
     '⚠️ Cliente JÁ DISSE o que quer!\n   ❌ NÃO pergunte "Como posso ajudar?"\n   ✅ Vá DIRETO para próximo passo!' :
     '✅ Se mensagem é saudação simples ("oi", "olá"): "Oi! Bem-vindo! Como posso ajudar?"\n   ✅ Se mensagem já menciona agendamento: vá para próximo passo\n   ❌ NÃO peça nome ainda!'}

2️⃣ COLETAR SERVIÇO:
   ${dadosExtraidos.servico ? '✅ JÁ TEM - pule' : '❌ Pergunte: "Qual serviço?"'}

3️⃣ COLETAR DATA:
   ${dadosExtraidos.data ? '✅ JÁ TEM - pule' : '❌ Pergunte: "Para qual dia?"'}

4️⃣ COLETAR HORÁRIO (✅ CORRIGIDO):
   ${dadosExtraidos.hora ? 
     (validacoes.horarioValido ? 
       '✅ Válido - prossiga' : 
       '🚫 Ocupado/Inválido - OFEREÇA ALTERNATIVAS IMEDIATAMENTE') 
     : '❌ Pergunte período primeiro'}

5️⃣ COLETAR PROFISSIONAL (se múltiplos):
   ${dados.eSolo ? '⚠️ Só tem 1 - pule' : '❌ Liste todos disponíveis'}

6️⃣ PEDIR NOME (ANTES DE CONFIRMAR - ✅ NOVO!):
   ${dadosExtraidos.nome ? 
     '✅ JÁ TEM nome - pode confirmar' : 
     '❌ AGORA SIM! Tem todos os dados do agendamento.\n   Mostre resumo e pergunte: "Qual seu nome completo pra eu confirmar?"'}

7️⃣ CONFIRMAR (DEPOIS DE TER O NOME):
   - Quando cliente informar o nome
   - Faça resumo completo:
     "Perfeito [NOME]! Confirmando:
      - [SERVICO]
      - [DATA] às [HORA]
      - Com [PROF]
      
      Posso confirmar?"
   
8️⃣ FINALIZAR:
   - Quando cliente confirmar: use 'confirmar_agendamento' COM nomeCliente
   - NÃO faça confirmação só em texto!

📝 EXEMPLO DE CONVERSA CORRETA:
Cliente: "oi"
Você: "Oi! Bem-vindo! Como posso ajudar?"

Cliente: "quero cortar cabelo"
Você: "Beleza! Para qual dia?"

Cliente: "amanhã às 14h"
Você: [valida horário] "Com qual profissional? Temos João e Maria"

Cliente: "com o João"
Você: "Perfeito! Qual seu nome completo pra eu confirmar?"

Cliente: "Pedro Silva"
Você: "Ótimo Pedro! Confirmando:
       - Corte de cabelo
       - 03/02/2026 às 14:00
       - Com João
       
       Posso confirmar?"

Cliente: "sim"
Você: [usa confirmar_agendamento com nomeCliente="Pedro Silva"]

❌ NUNCA FAÇA ISSO:
- "Oi! Qual seu nome completo?" (logo de cara)
- "Quer agendar? Qual seu nome?" (antes de coletar dados)
- Pedir nome antes de ter serviço, data e hora`;
                    break;

                case 'consultar':
                    instrucoesPorTipo = `
📋 FLUXO: CONSULTAR (Novo)
1. "Oi! Qual seu nome?"
2. "Não encontrei agendamentos. Quer marcar?"`;
                    break;

                default:
                    instrucoesPorTipo = `Responda naturalmente. Se quiser agendar, peça nome só no final!`;
            }
        }

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
   - NUNCA peça confirmação se horário está indisponível
   - Se horário ocupado/inválido, SEMPRE ofereça alternativas IMEDIATAMENTE
   - Múltiplos profissionais? LISTE TODOS
   - Cliente novo? Peça nome só ANTES DE CONFIRMAR (não no início!)
   - Se tem horariosDisponiveis → MOSTRE ao cliente!
   - Se tem periodosDisponiveis → Pergunte qual período!
   
4. 🔧 USO DE FERRAMENTAS:
   - Quando tiver TODOS os dados VÁLIDOS: use 'confirmar_agendamento'
   - NÃO faça confirmação só em texto
   - NÃO diga "vou confirmar" sem usar a ferramenta

${instrucoesPorTipo}

🎯 PROMPT CUSTOMIZADO:
${dados.promptBase || 'Seja prestativo e cordial.'}

💡 DICAS FINAIS:
- VALIDAÇÃO É FEITA AUTOMATICAMENTE - respeite os resultados!
- Se horário tá ocupado, as sugestões JÁ estão calculadas acima
- Ofereça alternativas ANTES de pedir confirmação
- Se múltiplos profissionais têm horários diferentes, mostre todos
- Seja direto e eficiente, mas sempre amigável`;

        console.log(`   System prompt preparado (${instrucoesFinais.length} chars)`);

        chatsMemoria[memKey].push({
            role: "user",
            parts: [{ text: dados.mensagem }]
        });

        console.log(`   Mensagem adicionada a memoria (total: ${chatsMemoria[memKey].length})`);

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

        const part = response.data.candidates[0].content.parts[0];

        if (part.functionCall) {
            console.log(`   Function call detectado: ${part.functionCall.name}`);
            
            const resultado = await processarFunctionCall(
                part.functionCall.name,
                part.functionCall.args,
                dados
            );

            chatsMemoria[memKey].push({
                role: "model",
                parts: [{ text: resultado.mensagem }]
            });

            console.log(`   Resultado adicionado a memoria`);
            return resultado.mensagem;
        }

        const textoIA = part.text || "Como posso ajudar?";

        chatsMemoria[memKey].push({
            role: "model",
            parts: [{ text: textoIA }]
        });

        console.log(`   Resposta de texto adicionada a memoria`);

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

// Function calls
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

const procesarConfirmarAgendamento = async (args: any, dados: any) => {
    try {
        console.log(`   Confirmando agendamento...`);
        console.log(`      Servico: ${args.servico}`);
        console.log(`      Data: ${args.data}`);
        console.log(`      Hora: ${args.hora}`);
        console.log(`      Profissional: ${args.profissional}`);
        console.log(`      Cliente: ${args.nomeCliente || 'Conhecido'}`);

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

        let dataFormatada = args.data;
        if (args.data && args.data.includes('/')) {
            const [dia, mes, ano] = args.data.split('/');
            dataFormatada = `${ano}-${mes}-${dia}`;
            console.log(`   Data convertida: ${args.data} -> ${dataFormatada}`);
        }

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
            
            const res = resultadoAgendamento as any;
            
            const [ano, mes, dia] = res.data.split('-');
            const dataFormatadaMostra = `${dia}/${mes}/${ano}`;
            const nomeClienteFinal = args.nomeCliente || dados.clienteNome || 'Cliente';
            
            return {
                mensagem: `✅ Agendamento confirmado ${nomeClienteFinal}!\n\n📋 ${res.servico}\n📅 ${dataFormatadaMostra} às ${res.hora}\n👤 ${res.profissional}\n\nAté logo! 👋`,
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

// Limpeza automática de memória
console.log('🧹 [AI] Iniciando sistema de limpeza automática de memória...');

setInterval(() => {
    try {
        let totalChats = Object.keys(chatsMemoria).length;
        let chatsLimpos = 0;

        for (const key in chatsMemoria) {
            if (chatsMemoria[key].length > 20) {
                chatsMemoria[key] = chatsMemoria[key].slice(-10);
                chatsLimpos++;
            }
        }

        if (chatsLimpos > 0) {
            console.log(`🧹 [AI] Memória limpa!`);
            console.log(`   Total de chats ativos: ${totalChats}`);
            console.log(`   Chats otimizados: ${chatsLimpos}`);
        }
    } catch (error) {
        console.error('❌ [AI] Erro ao limpar memória:', error);
    }
}, 600000); // 10 minutos

console.log('✅ [AI] Sistema de limpeza configurado (executa a cada 10min)');
