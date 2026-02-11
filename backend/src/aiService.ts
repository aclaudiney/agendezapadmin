/**
 * AI SERVICE - AGENDEZAP
 * Gerencia chamadas à IA Gemini com contexto estruturado
 * Sistema de validação integrado para melhor UX
 * 
 * ✅ CORRIGIDO ETAPA 1:
 * - IA VÊ horariosDisponiveis e periodosDisponiveis
 * - IA NÃO ignora "hoje/amanhã"
 * - IA MOSTRA horários ao cliente
 * 
 * ✅ CORRIGIDO ETAPA 2:
 * - IA mostra TODOS os horários do período escolhido (não apenas 5)
 * - Transparência total com o cliente
 */

import axios from 'axios';
import { ConversationContext } from './types/conversation.js';
import { tentarAgendar } from './AgendamentoController.js';
import { criarNovoCliente } from './services/clientService.js';
import { salvarContextoConversa } from './services/extractionService.js'; // ✅ IMPORTADO
import { cancelarAgendamento, atualizarAgendamento, adicionarObservacao as addObs } from './services/appointmentService.js';
import { validarDiaAberto } from './services/validationService.js'; // Adicionado para validação precoce de dia aberto

// Memória de chat segregada por empresa e usuário (BACKUP EM MEMÓRIA)
const chatsMemoria: Record<string, any[]> = {};

// ✅ FUNÇÕES DE PERSISTÊNCIA NO BANCO
const carregarHistoricoBanco = async (companyId: string, jid: string) => {
    try {
        const response = await axios.get(`${process.env.SUPABASE_URL}/rest/v1/ai_chat_history`, {
            params: {
                company_id: `eq.${companyId}`,
                client_jid: `eq.${jid}`,
                select: 'role,content',
                order: 'created_at.asc'
            },
            headers: {
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
            }
        });

        const data = response.data;
        if (!data || !Array.isArray(data)) return [];

        return data.map((m: any) => ({
            role: m.role,
            parts: [{ text: m.content }]
        }));
    } catch (error) {
        console.error("❌ Erro ao carregar histórico do banco:", error);
        return [];
    }
};

const salvarMensagemBanco = async (companyId: string, jid: string, role: string, content: string) => {
    try {
        await axios.post(`${process.env.SUPABASE_URL}/rest/v1/ai_chat_history`,
            {
                company_id: companyId,
                client_jid: jid,
                role: role,
                content: content
            },
            {
                headers: {
                    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                }
            }
        );
    } catch (error) {
        console.error("❌ Erro ao salvar mensagem no banco:", error);
    }
};

const excluirHistoricoBanco = async (companyId: string, jid: string) => {
    try {
        await axios.delete(`${process.env.SUPABASE_URL}/rest/v1/ai_chat_history`, {
            params: {
                company_id: `eq.${companyId}`,
                client_jid: `eq.${jid}`
            },
            headers: {
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
            }
        });
    } catch (error) {
        console.error("❌ Erro ao excluir histórico do banco:", error);
    }
};

export const gerarRespostaIA = async (dados: any) => {
    try {
        const memKey = `${dados.companyId}_${dados.jid}`;

        // 1️⃣ CARREGAR HISTÓRICO (BANCO + FALLBACK MEMÓRIA)
        let historico = await carregarHistoricoBanco(dados.companyId, dados.jid);

        if (historico.length === 0 && chatsMemoria[memKey]) {
            historico = chatsMemoria[memKey];
        }

        console.log(`\n[IA] Gerando resposta - Tipo: ${dados.tipoConversa || 'agendar'}`);
        console.log(`   Histórico carregado: ${historico.length} mensagens`);

        // Aumentar histórico para 20 mensagens
        if (historico.length > 20) {
            console.log(`   ✂️ Limitando histórico (Last 20 messages)`);
            historico = historico.slice(-20);
        }

        // 💾 SALVAR MENSAGEM DO CLIENTE IMEDIATAMENTE (Se não for repetida)
        if (dados.mensagem) {
            await salvarMensagemBanco(dados.companyId, dados.jid, 'user', dados.mensagem);
            // Adicionar ao histórico local para o prompt atual
            historico.push({ role: 'user', parts: [{ text: dados.mensagem }] });
        }

        const dadosExtraidos = dados.dadosExtraidos || {};
        let validacoes = dadosExtraidos.validacoes || {}; // Usar 'let' para poder reatribuir

        // --- VALIDAÇÃO INICIAL DE DIA ABERTO (CRÍTICO) ---
        if (dadosExtraidos.data && !validacoes.diaAbertoCalculado) { // Adiciona flag para não recalcular
            const resultadoDiaAberto = await validarDiaAberto(dados.companyId, dadosExtraidos.data);

            validacoes = {
                ...validacoes,
                diaAberto: resultadoDiaAberto.aberto,
                motivoErro: resultadoDiaAberto.motivo,
                diaAbertoCalculado: true // Marca que já foi validado
            };

            // SE O DIA ESTIVER FECHADO, ZERAR QUALQUER SUGESTÃO DE HORÁRIOS
            if (!resultadoDiaAberto.aberto) {
                dadosExtraidos.horariosDisponiveis = [];
                dadosExtraidos.periodosDisponiveis = [];
                dadosExtraidos.horariosPorPeriodo = {};
                dadosExtraidos.erro_fluxo = "DIA_FECHADO"; // Garante que a instrucaoPrioritaria seja ativada
            }
        }
        // --- FIM DA VALIDAÇÃO INICIAL DE DIA ABERTO ---

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
                resumoDadosExtraidos += `✅ DATA DEFINIDA: ${dataFormatada} (${dadosExtraidos.data})\n`;
                resumoDadosExtraidos += `⚠️ IMPORTANTE: Use EXATAMENTE a data ${dataFormatada} para buscar horários. NÃO recalcule "amanhã" se a data já está definida aqui.\n`;
            } else {
                resumoDadosExtraidos += `❓ Data: Não informada\n`;
            }

            if (dadosExtraidos.periodo) resumoDadosExtraidos += `✅ Periodo: ${dadosExtraidos.periodo}\n`;
            if (dadosExtraidos.hora) resumoDadosExtraidos += `✅ Horario: ${dadosExtraidos.hora}\n`;
            if (dadosExtraidos.profissional) resumoDadosExtraidos += `✅ Profissional: ${dadosExtraidos.profissional}\n`;
            if (dadosExtraidos.nome) resumoDadosExtraidos += `✅ Nome: ${dadosExtraidos.nome}\n`;

            if (dadosExtraidos.puloParaAmanha && dadosExtraidos.data) {
                const [anoP, mesP, diaP] = dadosExtraidos.data.split('-');
                const dataPulo = `${diaP}/${mesP}/${anoP}`;
                resumoDadosExtraidos += `\n⚠️ AVISO SISTEMA: O dia original estava esgotado. A data foi ajustada automaticamente para AMANHÃ (${dataPulo}). Avise o cliente.\n`;
            }

            resumoDadosExtraidos += `\n⚠️ NAO PERGUNTE NOVAMENTE sobre dados ja informados!\n`;

            // 🚫 BLOQUEIO DE DIA FECHADO (Solicitado)
            if (dadosExtraidos.data && validacoes && validacoes.diaAberto === false) {
                // CRÍTICO: Informar CLARAMENTE que está fechado 
                resumoDadosExtraidos += `\n🚫 DIA FECHADO!\n`; 
                resumoDadosExtraidos += `❌ Estabelecimento FECHADO em ${dadosExtraidos.data}\n`; 
                resumoDadosExtraidos += `Motivo: ${validacoes.motivoErro || 'Dia de folga'}\n`; 
                resumoDadosExtraidos += `\n⚠️ RESPOSTA OBRIGATÓRIA:\n`; 
                resumoDadosExtraidos += `"Infelizmente estamos fechados neste dia. Posso agendar para [próximo dia aberto]?"\n`; 
                resumoDadosExtraidos += `\n❌ NUNCA DIGA:\n`; 
                resumoDadosExtraidos += `- "não tenho horários"\n`; 
                resumoDadosExtraidos += `- "já estão reservados"\n`; 
                resumoDadosExtraidos += `- "horários esgotados"\n`; 
                resumoDadosExtraidos += `\n✅ SEMPRE EXPLIQUE: Está fechado neste dia!\n`; 
                
                // Limpar horários para forçar IA a não listar 
                dadosExtraidos.horariosDisponiveis = []; 
                dadosExtraidos.periodosDisponiveis = []; 
                dadosExtraidos.horariosPorPeriodo = {}; // Certificar que este também é limpo
            }

            // APENAS LISTAR HORÁRIOS SE O DIA ESTIVER ABERTO
            if (validacoes.diaAberto && dadosExtraidos.horariosDisponiveis && dadosExtraidos.horariosDisponiveis.length > 0) {
                resumoDadosExtraidos += `\n🕐 HORÁRIOS DISPONÍVEIS ${dadosExtraidos.periodo ? `(${dadosExtraidos.periodo})` : ''}:\n`;

                // Se temos estrutura detalhada por período, usa ela (Melhor UX)
                if (dadosExtraidos.horariosPorPeriodo) {
                    const hp = dadosExtraidos.horariosPorPeriodo;
                    const temManha = hp.manha && hp.manha.length > 0;
                    const temTarde = hp.tarde && hp.tarde.length > 0;
                    const temNoite = hp.noite && hp.noite.length > 0;

                    if (temManha || temTarde || temNoite) {
                        resumoDadosExtraidos += `\nPAINEL DE HORÁRIOS (Use para sugerir):\n`;
                        if (temManha) resumoDadosExtraidos += `🌅 MANHÃ (06h-12h): ${hp.manha.join(', ')}\n`;
                        if (temTarde) resumoDadosExtraidos += `☀️ TARDE (12h-18h): ${hp.tarde.join(', ')}\n`;
                        if (temNoite) resumoDadosExtraidos += `🌙 NOITE (18h-23h): ${hp.noite.join(', ')}\n`;
                        resumoDadosExtraidos += `\n⚠️ IMPORTANTE: Sempre pergunte qual PERÍODO o cliente prefere antes de listar tudo!\n`;
                    } else {
                        // Fallback se estrutura vier vazia mas horariosDisponiveis tiver dados
                        const mostrar = dadosExtraidos.horariosDisponiveis.slice(0, 10);
                        resumoDadosExtraidos += mostrar.join(', ') + (dadosExtraidos.horariosDisponiveis.length > 10 ? '...' : '') + '\n';
                    }
                } else {
                    // Fallback antigo
                    const mostrar = dadosExtraidos.horariosDisponiveis.slice(0, 8);
                    resumoDadosExtraidos += mostrar.join(', ') + (dadosExtraidos.horariosDisponiveis.length > 8 ? '...' : '') + '\n';
                }
            } else if (dadosExtraidos.data && dadosExtraidos.profissional) {
                if (dadosExtraidos.periodosDisponiveis && dadosExtraidos.periodosDisponiveis.length > 0) {
                    resumoDadosExtraidos += `\n✅ PERÍODOS COM VAGA: ${dadosExtraidos.periodosDisponiveis.join(', ')}\n`;
                    resumoDadosExtraidos += `⚠️ Sugira estes períodos ao cliente!\n`;
                } else {
                    resumoDadosExtraidos += `\n❌ NENHUM HORÁRIO DISPONÍVEL para este dia!\n`;
                }
            }

            // (Lógica de puloParaAmanha movida para dentro do bloco de data acima)

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

        if (validacoes.horarioPassado) {
            infoValidacao += `\n⏰ HORÁRIO PASSADO! ${validacoes.motivoErro}\n`;
            infoValidacao += `\n🔄 RESET: Esqueça ${dadosExtraidos.hora}. Se cliente perguntar horários, LISTE os válidos.\n`;
            infoValidacao += `❌ NUNCA repita mesma mensagem de erro!\n`;

            if (validacoes.sugestoesHorarios?.length > 0) {
                infoValidacao += `Responda: "Para hoje tenho: ${validacoes.sugestoesHorarios.join(', ')}"\n`;
            }

            dadosExtraidos.hora = undefined; // Limpa hora inválida
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
                            `⚠️ Cliente JÁ DISSE o que quer (serviço/data)!\n   ✅ Comece com: "Olá, tudo bem? Sou ${dados.nomeAgente} da ${dados.nomeLoja}. Com certeza posso te ajudar com isso!"\n   ✅ Depois, prossiga para o próximo passo!` :
                            `✅ Se primeira mensagem: "Olá, tudo bem? Sou ${dados.nomeAgente} aqui da ${dados.nomeLoja}! Como posso te ajudar hoje?"`}

2️⃣ COLETAR SERVIÇO:
   ${dadosExtraidos.servico ? '✅ JÁ TEM - pule esta etapa' : '❌ Pergunte: "Qual serviço você quer agendar?"'}

3️⃣ COLETAR DATA:
   ${dadosExtraidos.data ? '✅ JÁ TEM - pule esta etapa' : '❌ Pergunte: "Para qual dia?"'}

4️⃣ COLETAR PROFISSIONAL (se múltiplos):
   ${dados.eSolo ?
                            '⚠️ Só tem 1 profissional - pule esta etapa' :
                            dadosExtraidos.profissional ?
                                '✅ JÁ TEM - pule esta etapa' :
                                `❌ Pergunte: "Com quem prefere? Temos: ${dados.profissionaisLista}"`}

5️⃣ COLETAR PERÍODO E HORÁRIO (RÍGIDO):

${!dadosExtraidos.periodo ? `
⚠️ PERÍODO NÃO DEFINIDO!

VOCÊ DEVE:
1. NÃO listar horários ainda
2. Perguntar: "Prefere manhã, tarde ou noite?" (Se for hoje, sugira APENAS os períodos que ainda possuem horários disponíveis)
3. AGUARDAR resposta do cliente

HORÁRIOS DISPONÍVEIS POR PERÍODO:
${dadosExtraidos.horariosPorPeriodo ? `
- Manhã: ${dadosExtraidos.horariosPorPeriodo.manha?.length || 0} horários
- Tarde: ${dadosExtraidos.horariosPorPeriodo.tarde?.length || 0} horários
- Noite: ${dadosExtraidos.horariosPorPeriodo.noite?.length || 0} horários
` : 'Não disponível'}

❌ NUNCA faça:
- Listar todos os horários sem saber período
- Perguntar horário específico sem período
` : `
✅ PERÍODO DEFINIDO: ${dadosExtraidos.periodo}

AGORA SIM! Liste os horários de ${dadosExtraidos.periodo}:
${dadosExtraidos.horariosDisponiveis?.join(', ')}

Formato: "Para a ${dadosExtraidos.periodo} tenho: [horários]. Qual prefere?"
`}

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
   - Aguarde "sim" or similar

7️⃣ FINALIZAR:
   - Quando cliente confirmar: use a ferramenta 'confirmar_agendamento'
   - NÃO faça confirmação só em texto!`;
                    break;

                case 'consultar':
                    instrucoesPorTipo = `
📋 FLUXO: CONSULTAR
⚠️ REGRA CRÍTICA: NÃO peça nome nem data! Você já tem os dados no contexto.
1. Filtre os agendamentos abaixo pela data que o cliente pediu (se ele pediu uma):
   Data pedida: ${dadosExtraidos.data || 'Não especificada'}
2. Responda IMEDIATAMENTE: ${dados.temAgendamentos ?
                            `"Oi ${dados.clienteNome}! Vi aqui que você tem:\n${dados.agendamentosProximos.map((a: any) => `- ${a.descricao}`).join('\n')}"` :
                            `"Oi ${dados.clienteNome}! Verifiquei aqui e você não tem agendamentos marcados. Gostaria de agendar?"`}
3. Se houver muitos agendamentos e o cliente pediu um específico, foque nele.`;
                    break;

                case 'cancelar':
                    instrucoesPorTipo = `
📋 FLUXO: CANCELAR
1. Identifique qual agendamento cancelar. Você tem os IDs na seção 'AGENDAMENTOS EXISTENTES'.
2. Se houver múltiplos no mesmo dia (como visto na lista), liste todos claramente com horário e peça para o cliente confirmar qual deles deseja desmarcar.
3. JAMAIS diga que cancelou sem usar a ferramenta 'cancelar_agendamento' e receber 'sucesso'.
4. Após o cliente confirmar qual ID, use 'cancelar_agendamento' com o agendamentoId correto.`;
                    break;

                case 'remarcar':
                    instrucoesPorTipo = `
📋 FLUXO: REMARCAR
1. Identifique o agendamento antigo (o que o cliente quer mudar) e o NOVO HORÁRIO.
2. 🚫 RÍGIDO: SE o cliente disser qual horário quer mudar (ex: "muda o das 11:00"), procure na lista 'AGENDAMENTOS EXISTENTES', pegue o ID e use-o automaticamente. JAMAIS pergunte o ID.
3. Se houver múltiplos agendamentos e ele não especificou qual mudar, liste os horários dele e pergunte "Qual desses você quer mudar?".
4. Com ID e Novo Horário em mãos -> USE 'remarcar_agendamento'.
5. REGRA DE OURO: O horário que o cliente JÁ TEM é dele (não conflita com ele mesmo).`;
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

1️⃣ SAUDAÇÃO INICIAL:
   ${dadosExtraidos.servico || dadosExtraidos.data ?
                            `⚠️ Cliente JÁ DISSE o que quer (serviço/data)!\n   ✅ Comece com: "Olá, tudo bem? Sou ${dados.nomeAgente} da ${dados.nomeLoja}. Com certeza posso te ajudar com isso!"\n   ✅ Depois, prossiga para o próximo passo!` :
                            `✅ Se primeira mensagem: "Olá, tudo bem? Sou ${dados.nomeAgente} aqui da ${dados.nomeLoja}! Como posso te ajudar hoje?"`}

2️⃣ ORDEM DE COLETA (OBRIGATÓRIA):
   Siga EXATAMENTE esta ordem. Não pule etapas nem peça dados adiantados.
   
   1. SERVIÇO: ${dadosExtraidos.servico ? '✅ Já temos' : '❌ Peça: "Qual serviço você deseja realizar?"'}
   2. PROFISSIONAL: ${dados.eSolo ? '✅ Só tem 1 profissional (Solo)' : (dadosExtraidos.profissional ? '✅ Já temos' : '❌ Peça: "Com qual profissional deseja agendar? Temos: ' + dados.profissionaisLista + '"')}
   3. DATA: ${dadosExtraidos.data ? '✅ Já temos' : '❌ Peça: "Para qual dia?"'}
   4. PERÍODO: ${dadosExtraidos.periodo ? '✅ Já temos' : (dadosExtraidos.horariosDisponiveis && dadosExtraidos.horariosDisponiveis.length > 10 ? '❌ Peça: "Prefere manhã, tarde ou noite?"' : '✅ Poucos horários, pode listar direto')}
   5. HORÁRIO: ${dadosExtraidos.hora ? '✅ Já temos' : '❌ Liste os horários disponíveis e peça para escolher um.'}
   6. NOME: ${dadosExtraidos.nome ? '✅ Já temos' : '❌ Peça: "Por último, qual o seu nome?"'}

⚠️ REGRAS CRÍTICAS:
- OBRIGAR PERGUNTA DE PERÍODO: Se houver mais de 10 horários disponíveis para o dia, você DEVE perguntar o período (manhã, tarde ou noite) antes de listar os horários.
- CONFIRMAR DATAS AMBÍGUAS: Se o cliente disser apenas o dia da semana (ex: "sexta"), confirme a data completa no formato DD/MM. Ex: "Para esta sexta-feira, dia 15/05, certo?"
- NÃO RE-PERGUNTAR NOME: Verifique no histórico se o cliente já se apresentou (ex: "Oi, sou o Carlos"). Se o nome já foi extraído ou mencionado, NÃO peça novamente no final do fluxo.

3️⃣ CONFIRMAR (APENAS SE TUDO VÁLIDO):
   ⚠️ ATENÇÃO CRÍTICA: Só peça confirmação se:
   - Tem serviço ✅
   - Tem profissional ✅
   - Tem data ✅
   - Tem período/hora VÁLIDA E DISPONÍVEL ✅
   - Tem nome ✅
   
   ✅ Se TUDO válido:
   - Faça resumo: "Perfeito! Confirmando:\n- [SERVICO]\n- [DD/MM/YYYY] às [HORA]\n- Com [PROF]\n- Cliente: [NOME]\n\nPosso confirmar?"
   - Aguarde "sim" ou similar.

4️⃣ FINALIZAR:
   - Quando cliente confirmar: use a ferramenta 'confirmar_agendamento'.
   - NÃO faça confirmação só em texto!`;
                    break;

                case 'consultar':
                    instrucoesPorTipo = `
📋 FLUXO: CONSULTAR (Novo Cliente)
1. "Verifiquei aqui que não temos nenhum agendamento vinculado a este número."
2. "Gostaria de marcar um horário? Temos [LISTA SERVIÇOS]"`;
                    break;

                default:
                    instrucoesPorTipo = `Responda naturalmente. Se quiser agendar, peça nome só no final!`;
            }
        }

        if (validacoes.diaAberto === false) {
            instrucoesPorTipo += `\n\n⚠️ REGRA CRÍTICA: Se validacoes.diaAberto === false → JAMAIS mostre horários! Responda: "Estamos fechados nesse dia. Pode ser outro dia?"`;
        }

        // ✅ CORREÇÃO (Fluxo 5): Datas Dinâmicas (Ajustado para America/Sao_Paulo)
        const agoraServidor = new Date();
        const formatterLong = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });
        const formatterShort = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
        
        const hojeLocal = new Date(agoraServidor.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const amanhaLocal = new Date(hojeLocal);
        amanhaLocal.setDate(hojeLocal.getDate() + 1);
        
        const diaSemanaHoje = formatterLong.format(hojeLocal);
        const dataHojeStr = formatterShort.format(hojeLocal);
        const diaSemanaAmanha = formatterLong.format(amanhaLocal);
        const dataAmanhaStr = formatterShort.format(amanhaLocal);

        // ✅ CORREÇÃO (Fluxo 1): Instrução Prioritária de Bloqueio
        let instrucaoPrioritaria = "";
        if (dadosExtraidos.erro_fluxo === "DIA_FECHADO" || validacoes.diaAberto === false) {
            const motivo = dadosExtraidos.motivo_fechamento || validacoes.motivoErro || "Estabelecimento fechado";
            instrucaoPrioritaria = `
🚨 INSTRUÇÃO PRIORITÁRIA DE BLOQUEIO (CRÍTICO):
O usuário solicitou uma data que está FECHADA.
MOTIVO: ${motivo}.

❌ PROIBIDO:
- NÃO ofereça horários (não existem).
- NÃO invente disponibilidade.
- NÃO pergunte "qual horário prefere?".

✅ AÇÃO ÚNICA PERMITIDA:
- Informe educadamente que o estabelecimento está fechado neste dia.
- Explique o motivo.
- Pergunte se pode ser no próximo dia útil.
`;
        }

        const instrucoesFinais = `Você é ${dados.nomeAgente} da ${dados.nomeLoja}.
${regraSolo}

${instrucaoPrioritaria}

🕒 CENTRAL DE VERDADE (SISTEMA):
- HOJE: ${diaSemanaHoje}, ${dataHojeStr}
- AMANHÃ: ${diaSemanaAmanha}, ${dataAmanhaStr}
- HORA ATUAL: ${dados.horarioAtual}
- FUSO HORÁRIO: America/Sao_Paulo
⚠️ INSTRUÇÃO RÍGIDA: Use ESTA data como referência absoluta.

${contextoCliente}

🛠️ SERVIÇOS DISPONÍVEIS:
${listaServicos}

👥 PROFISSIONAIS:
${dados.profissionaisLista}

${resumoDadosExtraidos}

${infoValidacao}

⭐ IDENTIFICAÇÃO (RÍGIDO):
1. O TELEFONE DO CLIENTE É A SUA IDENTIDADE ÚNICA.
2. Se os dados mostram 'Cliente REGISTRADO', JAMAIS peça nome, telefone ou qualquer confirmação de quem ele é.
3. Se o cliente perguntar sobre "meus horários", responda IMEDIATAMENTE com os dados que você já tem no contexto. NÃO peça para ele confirmar o nome ou a data primeiro.

⭐ AGENDAMENTOS EXISTENTES (SITUAÇÃO ATUAL):
${dados.temAgendamentos ?
                `⚠️ O cliente JÁ TEM estes agendamentos:
${dados.agendamentosProximos.map((a: any) => `- ID: ${a.id} | ${a.descricao}`).join('\n')}
✅ Use estas informações para responder consultas ou pedidos de cancelamento/mudança imediatamente!
🚫 RÍGIDO: JAMAIS peça o "ID" para o cliente. Se ele disser "o das 11:00", você deve olhar na lista acima, achar o ID correspondente e usar na ferramenta automaticamente.` :
                `✅ O cliente não possui agendamentos pendentes vinculados a este número.`}

⭐ PERSONALIDADE & ESTILO:
1. 🎭 ATENDENTE DE ELITE:
   - Você é o melhor atendente do mundo: educado, ágil e proativo.
   - Sua meta é FECHAR o agendamento da forma mais fácil possível.
   
2. 💬 COMUNICAÇÃO PROATIVA (REGRAS DE OURO - ✅ CORRIGIDO):
   - Se o cliente disse o DIA mas não a HORA:
     ✅ Veja periodosDisponiveis. Se tiver vários, pergunte qual prefere.
     ✅ Se só tiver UM período com vaga, já diga: "Para esse dia tenho vagas só à [Tarde], qual horário fica melhor para você?"
   
   - Se o cliente escolheu um PERÍODO (ex: "de tarde"):
     ✅ MOSTRE TODOS OS HORÁRIOS DISPONÍVEIS desse período
     ✅ Formato sugerido:
       • Até 12 horários: liste todos separados por vírgula
         Exemplo: "Para a tarde tenho: 12:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00, 17:30. Qual prefere?"
       • Mais de 12 horários: agrupe por hora ou mostre em blocos
         Exemplo: "Para a tarde tenho várias opções: 12h (12:00, 12:30), 13h (13:00, 13:30), 14h (14:00, 14:30)... Quer que eu liste todos ou prefere escolher uma faixa de horário?"
     
     ❌ NUNCA limite a 5 horários
     ❌ NUNCA omita horários disponíveis
     ✅ TRANSPARÊNCIA TOTAL com o cliente
   
   - Se o sistema deu 'puloParaAmanha', informe ao cliente gentilmente.
   
3. ✅ REGRAS CRÍTICAS:
   - REGRA DE OURO: JAMAIS diga "Cancelado", "Agendado" ou "Confirmado" se você não tiver usado a ferramenta (tool) correspondente com sucesso. Mentir sobre uma ação é falha grave.
   - REAGENDAMENTO: Se o cliente citar um horário que ele JÁ POSSUI (ex: "não vou conseguir às 9") e pedir outro (ex: "pode ser às 11?"), você deve tratar como REMARCAR, identificando o ID do antigo e coletando o novo.
   - NUNCA diga que é um robô, IA ou assistente virtual. Se perguntarem se você é humano, responda de forma sutil e simpática como: "Sou o assistente digital aqui da ${dados.nomeLoja}, focado em cuidar dos agendamentos para ninguém ficar sem horário! 😊".
   - Mantenha sempre a polidez: se o cliente for direto ao ponto, ainda assim use a saudação "Olá, tudo bem?" para manter a cordialidade.
   - NUNCA invente horários. Use apenas os fornecidos.
   - Respostas objetivas (máx 4-5 linhas quando listar horários).
   - Se houver múltiplos profissionais e o cliente não escolheu, pergunte se tem preferência ou pode ser "qualquer um".

4. 🛡️ REGRA CRÍTICA DE VALIDAÇÃO (SEGURANÇA):
   - 1. Cliente pede horário → VOCÊ VALIDA se está na lista de DISPONÍVEIS.
   - 2. Se DISPONÍVEL → Segue para confirmação.
   - 3. Se NÃO DISPONÍVEL ou NÃO LISTADO → DIGA IMEDIATAMENTE: "Esse horário já está ocupado" e sugira os próximos.
   - 4. NUNCA, em hipótese alguma, confirme um horário que não foi validado como disponível.
   - 5. Se o horário for de fechamento (ex: fecha 18h), 18:00 é PERMITIDO (se durar 30min).

${instrucoesPorTipo}

🎯 PROMPT CUSTOMIZADO:
${dados.promptBase || 'Seja prestativo e cordial.'}

💡 DICAS FINAIS:
- Se tiene horariosDisponiveis → MOSTRE TODOS do período escolhido!
- Se tem periodosDisponiveis → Sugira e pergunte a preferência!
- Seja o mais natural possível, evite listas longas demais só quando realmente necessário.
- TRANSPARÊNCIA é a chave: nunca esconda opções do cliente!`;

        console.log(`   System prompt preparado (${instrucoesFinais.length} chars)`);

        // 2️⃣ SALVAR MENSAGEM DO USUÁRIO
        await salvarMensagemBanco(dados.companyId, dados.jid, "user", dados.mensagem);

        // Atualizar memória local para redundância
        if (!chatsMemoria[memKey]) chatsMemoria[memKey] = [];
        chatsMemoria[memKey].push({
            role: "user",
            parts: [{ text: dados.mensagem }]
        });

        console.log(`   Chamando Gemini API (v1beta)...`);
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                // ✅ NOVO: Usar o campo oficial de instruções do sistema!
                system_instruction: {
                    parts: [{ text: instrucoesFinais }]
                },
                contents: [
                    ...historico,
                    {
                        role: "user",
                        parts: [{ text: dados.mensagem }]
                    }
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

        const geminiData = response.data as any;
        const part = geminiData?.candidates?.[0]?.content?.parts?.[0];
        if (!part) {
            return "Ops, não consegui gerar uma resposta agora. Pode tentar novamente?";
        }

        if (part.functionCall) {
            console.log(`   Function call detectado: ${part.functionCall.name}`);

            const resultado = await processarFunctionCall(
                part.functionCall.name,
                part.functionCall.args,
                dados
            );

            const msgFinal = resultado.mensagem.trim();

            // 3️⃣ SALVAR RESPOSTA DO MODELO (FUNCTION CALL)
            await salvarMensagemBanco(dados.companyId, dados.jid, "assistant", msgFinal);

            if (!chatsMemoria[memKey]) chatsMemoria[memKey] = [];
            chatsMemoria[memKey].push({
                role: "assistant",
                parts: [{ text: msgFinal }]
            });

            return msgFinal;
        }

        const textoIA = (part.text || "Como posso ajudar?").trim();

        // 3️⃣ SALVAR RESPOSTA DO MODELO (TEXTO)
        await salvarMensagemBanco(dados.companyId, dados.jid, "assistant", textoIA);

        if (!chatsMemoria[memKey]) chatsMemoria[memKey] = [];
        chatsMemoria[memKey].push({
            role: "assistant",
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

        // ✅ VALIDAÇÃO FINAL: Revalidar se dia está aberto (CRÍTICO)
        // Isso impede agendamento mesmo se a IA ignorar o aviso
        try {
            const dataObj = new Date(dataFormatada + 'T12:00:00-03:00'); // Fuso horário seguro
            const diaSemana = dataObj.getDay();
            const diasNomes = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
            const nomeDia = diasNomes[diaSemana];

            console.log(`   🛡️ Validação Final para ${nomeDia} (${dataFormatada})...`);

            const { data: settings } = await axios.get(
                `${process.env.SUPABASE_URL}/rest/v1/configuracoes`,
                {
                    params: { company_id: `eq.${dados.companyId}`, select: 'dias_abertura' },
                    headers: {
                        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
                        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
                    }
                }
            );

            if (settings?.[0]?.dias_abertura?.[nomeDia] === false) {
                 console.log(`🚫 BLOQUEIO FINAL: Tentou agendar em dia fechado (${nomeDia})!`);
                 return {
                    mensagem: `Ops! Notei aqui que estamos fechados às ${nomeDia}s. Que tal escolher outro dia?`,
                    sucesso: false
                 };
            }
        } catch (err) {
            console.error('Erro na validação final:', err);
            // Se der erro na validação, seguimos para tentarAgendar que tem suas próprias validações
        }

        console.log(`   Chamando tentarAgendar...`);

        // 🔒 SEGURANÇA: Validar disponibilidade novamente (caso IA tenha alucinado)
        if (args.profissional && args.data && args.hora) {
            const { validarHorarioDisponivel } = await import('./services/appointmentService.js');
            const validacao = await validarHorarioDisponivel(
                dados.companyId,
                // Precisamos buscar o ID do profissional pelo nome se não vier no args (args geralmente tem nome)
                // Mas tentarAgendar resolve isso. Vamos confiar no tentarAgendar,
                // MAS vamos garantir que datas não sejam inventadas.
                // A melhor validação é no AgendamentoController.
                // Vamos passar a responsabilidade para o AgendamentoController ser RÍGIDO.
                // Mas aqui, vamos garantir que a DATA bata com a extraída!
                "" as any, // placeholder, na verdade vamos só validar data
                args.data,
                args.hora
            );

            // Se a data confirmada pela IA for diferente da data extraída no contexto
            // e o usuário NÃO pediu explicitamente outra data na última mensagem...
            if (dados.dadosExtraidos && dados.dadosExtraidos.data) {
                if (dados.dadosExtraidos.data !== dataFormatada) {
                    console.warn(`⚠️ ALERTA DE SEGURANÇA: IA tentou agendar para ${dataFormatada} mas contexto dizia ${dados.dadosExtraidos.data}`);
                    console.warn(`🔒 FORÇANDO data do contexto: ${dados.dadosExtraidos.data}`);

                    // 🔒 CORREÇÃO AUTOMÁTICA: Usar a data que foi validada e extraída pelo sistema!
                    dataFormatada = dados.dadosExtraidos.data;

                    // Revalidar com a data correta
                    const revalidacao = await validarHorarioDisponivel(
                        dados.companyId,
                        "" as any,
                        dataFormatada, // Data correta (06/02)
                        args.hora
                    );

                    if (!revalidacao.disponivel) {
                        return {
                            mensagem: `Ops! Verifiquei aqui e o horário das ${args.hora} no dia ${dataFormatada.split('-').reverse().join('/')} acabou de ser ocupado. Pode ser em outro horário?`,
                            sucesso: false
                        };
                    }
                }
            }
        }

        // ✅ VALIDAÇÃO FINAL (Solicitada)
        // 1) Dia aberto / dentro do funcionamento
        const diaFinal = await validarDiaAberto(dados.companyId, dataFormatada, args.hora);
        if (!diaFinal.aberto) {
            return {
                mensagem: JSON.stringify({
                    erro: "estabelecimento_fechado",
                    motivo: diaFinal.motivo || "Estamos fechados neste dia.",
                    instrucao: "Avise o cliente que está fechado e peça para escolher outro dia."
                }),
                sucesso: false
            };
        }

        // 2) Disponibilidade do horário (ocupado)
        const { validarHorarioDisponivel } = await import('./services/appointmentService.js');
        const validacaoFinal = await validarHorarioDisponivel(dados.companyId, "" as any, dataFormatada, args.hora);

        if (!validacaoFinal.disponivel) {
            return {
                mensagem: JSON.stringify({
                    erro: "horario_ocupado",
                    motivo: validacaoFinal.motivo || `Horário ${args.hora} indisponível.`,
                    instrucao: "Avise o cliente que o horário está ocupado e ofereça as alternativas disponíveis no contexto."
                }),
                sucesso: false
            };
        }

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

        // ⚠️ VERIFICAR RESULTADO ESPECÍFICO:
        if (resultadoAgendamento.status === 'pedir_nome') {
            return {
                mensagem: 'Preciso do seu nome completo para confirmar o agendamento.',
                sucesso: false
            };
        }

        if (resultadoAgendamento.status === 'erro') {
            console.error('❌ ERRO AO SALVAR:', resultadoAgendamento);
            return {
                mensagem: 'Tive um problema técnico ao salvar seu agendamento. Pode tentar novamente em alguns instantes?',
                sucesso: false
            };
        }

        if (resultadoAgendamento.status === 'ocupado') {
             return {
                 mensagem: resultadoAgendamento.mensagem || 'Horário ocupado.',
                 sucesso: false
             };
        }

        if (resultadoAgendamento.status === 'sucesso') {
            console.log(`   Agendamento criado com sucesso!`);

            // ✅ LIMPAR CONTEXTO (CRÍTICO)
            // Impede que a IA continue lembrando do agendamento antigo na próxima interação
            console.log(`🧹 Limpando contexto da conversa...`);
            salvarContextoConversa(dados.companyId, dados.jid, {
                servico: null,
                data: null,
                hora: null,
                periodo: null,
                profissional: null,
                nome: null,
                horariosDisponiveis: [],
                periodosDisponiveis: []
            });

            const res = resultadoAgendamento as any;

            const [ano, mes, dia] = res.data.split('-');
            const dataFormatadaMostra = `${dia}/${mes}/${ano}`;
            const nomeClienteFinal = args.nomeCliente || dados.clienteNome || 'Cliente';

            // ✅ LIMPEZA DE MEMÓRIA (RESET DE INTENÇÃO)
            const memKey = `${dados.companyId}_${dados.jid}`;
            chatsMemoria[memKey] = [{
                role: "system",
                parts: [{ text: `[RESUMO DE MEMÓRIA]: O último agendamento foi realizado com sucesso: ${res.servico} em ${dataFormatadaMostra} às ${res.hora}. O contexto anterior foi arquivado para evitar confusão.` }]
            }];
            
            // Opcional: Limpar histórico do banco também se desejar, mas o reset em memória já ajuda o "contexto imediato"
            // await excluirHistoricoBanco(dados.companyId, dados.jid); // Descomente se quiser limpar TOTAL

            return {
                mensagem: `✅ Agendamento realizado ${nomeClienteFinal}!\n\n📋 ${res.servico}\n📅 ${dataFormatadaMostra} às ${res.hora}\n👤 ${res.profissional}\n\nAté logo! 👋`,
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
        const resultado = await cancelarAgendamento(args.agendamentoId, dados.companyId, args.motivo);

        if (resultado.status === 'sucesso') {
            return {
                mensagem: '✅ Agendamento cancelado com sucesso! Se precisar de algo mais, é só falar.',
                sucesso: true
            };
        }

        return {
            mensagem: `❌ Não consegui cancelar: ${resultado.mensagem}`,
            sucesso: false
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
        console.log(`\n🔄 [REMARCAR] Iniciando processo para ID: ${args.agendamentoId}`);

        if (!args.agendamentoId) {
            return {
                mensagem: "❌ Erro: Não identifiquei qual agendamento você quer mudar. Pode me confirmar o horário antigo?",
                sucesso: false
            };
        }

        // --- BUSCAR DADOS DO AGENDAMENTO ORIGINAL ---
        const agendamentoOriginal = (dados.agendamentosCompletos || []).find((a: any) => String(a.id) === String(args.agendamentoId));

        if (!agendamentoOriginal) {
            console.log(`   ❌ Agendamento ${args.agendamentoId} não encontrado no contexto.`);
            return {
                mensagem: "❌ Não encontrei esse agendamento nos meus registros. Pode confirmar o horário?",
                sucesso: false
            };
        }

        console.log(`   ✅ Original: ${agendamentoOriginal.servico} (${agendamentoOriginal.data} ${agendamentoOriginal.hora})`);

        // --- DEFINIR NOVOS DADOS (com fallback para o original) ---
        let novadata = args.novadata || agendamentoOriginal.data;
        let novahora = args.novahora;
        let servico = agendamentoOriginal.servico;
        let profissional = agendamentoOriginal.profissional;

        if (!novahora) {
            return {
                mensagem: "❌ Para qual horário você gostaria de mudar?",
                sucesso: false
            };
        }

        // Formatação de data
        let dataFormatada = novadata;
        if (novadata && novadata.includes('/')) {
            const [dia, mes, ano] = novadata.split('/');
            dataFormatada = `${ano}-${mes}-${dia}`;
        }

        // 1. Tentar criar o NOVO agendamento primeiro (pra garantir a vaga)
        console.log(`   Step 1: Criando novo agendamento (${dataFormatada} às ${novahora})...`);
        const resultadoNovo = await tentarAgendar(
            {
                servico,
                data: dataFormatada,
                hora: novahora,
                profissional
            },
            dados.companyId,
            dados.clienteId,
            dados.jid
        );

        if (resultadoNovo.status !== 'sucesso') {
            console.log(`   ❌ Falha ao criar novo: ${resultadoNovo.mensagem}`);
            return {
                mensagem: `❌ Não consegui marcar para este novo horário: ${resultadoNovo.mensagem}`,
                sucesso: false
            };
        }

        // 2. Se deu certo, CANCELAR o antigo
        console.log(`   Step 2: Novo OK! Cancelando antigo ID: ${args.agendamentoId}...`);
        const resultadoCancel = await cancelarAgendamento(args.agendamentoId, dados.companyId, 'Remarcado pelo cliente');

        if (resultadoCancel.status !== 'sucesso') {
            console.log(`   ⚠️ Novo criado, mas falha ao cancelar antigo: ${resultadoCancel.mensagem}`);
            // Aqui temos um "sucesso parcial". Vamos informar, mas tecnicamente a vaga nova foi garantida.
            return {
                mensagem: `✅ Novo horário agendado para ${novahora}!\n\n⚠️ Mas tive um erro ao desmarcar o antigo (${agendamentoOriginal.hora}). Por favor, peça ao atendente para remover o horário antigo manualmente.`,
                sucesso: true
            };
        }

        const [ano, mes, dia] = dataFormatada.split('-');
        return {
            mensagem: `✅ Reagendamento realizado com sucesso!\n\n❌ O horário das ${agendamentoOriginal.hora} foi cancelado.\n✅ O novo horário é dia ${dia}/${mes} às ${novahora}.\n\nAté logo!`,
            sucesso: true
        };

    } catch (error) {
        console.error(`❌ Erro processarRemarcarAgendamento:`, error);
        return {
            mensagem: '❌ Desculpe, tive um erro técnico ao processar seu reagendamento. Pode tentar novamente?',
            sucesso: false
        };
    }
};

const processarAdicionarObservacao = async (args: any, dados: any) => {
    try {
        console.log(`   Adicionando observacao: ${args.observacao.substring(0, 30)}...`);
        const resultado = await addObs(args.agendamentoId, dados.companyId, args.observacao);

        if (resultado.status === 'sucesso') {
            return {
                mensagem: '✅ Observação adicionada ao seu agendamento!',
                sucesso: true
            };
        }

        return {
            mensagem: '❌ Não consegui adicionar a observação.',
            sucesso: false
        };
    } catch (error) {
        console.error(`Erro adicionarObservacao:`, error);
        return {
            mensagem: 'Erro ao adicionar observação',
            sucesso: false
        };
    }
};

export const limparMemoriaChat = async (companyId: string, jid: string) => {
    const memKey = `${companyId}_${jid}`;

    // Limpar Banco
    await excluirHistoricoBanco(companyId, jid);

    // Limpar Memória
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
