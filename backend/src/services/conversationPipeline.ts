/**
 * CONVERSATION PIPELINE - AGENDEZAP
 * Orquestra o fluxo completo da conversa
 * Conecta todos os serviços e roteia pra ação correta
 */

import { ConversationContext, RespostaIA } from '../types/conversation.js';
import { 
  validarDiaAberto, 
  validarDataFutura, 
  validarHorarioDisponivel,
  validarHorarioPassado,
  buscarHorariosDisponiveis,
  validarEspecialidade
} from './validationService.js';
import { 
  criarNovoCliente, 
  buscarClientePorId 
} from './clientService.js';
import { 
  criarAgendamento, 
  buscarAgendamentosCliente,
  cancelarAgendamento,
  atualizarAgendamento,
  adicionarObservacao,
  buscarProximoAgendamento
} from './appointmentService.js';

// ============================================
// 1️⃣ PROCESSAR FLUXO DE AGENDAR
// ============================================

export const processarFluxoAgendar = async (
  contexto: ConversationContext
): Promise<RespostaIA> => {
  try {
    console.log('🎯 Processando fluxo: AGENDAR');

    // Aqui a IA vai fazer o agendamento
    // Por enquanto, retorna instrução pra IA fazer
    return {
      tipo: 'acao',
      mensagem: 'IA: use a ferramenta executar_agendamento com os dados coletados',
      acao: {
        tipo: 'criar',
        dados: contexto
      }
    };
  } catch (error) {
    console.error('❌ Erro processarFluxoAgendar:', error);
    return {
      tipo: 'erro',
      mensagem: 'Erro ao processar agendamento'
    };
  }
};

// ============================================
// 2️⃣ PROCESSAR FLUXO DE CONSULTAR
// ============================================

export const processarFluxoConsultar = async (
  contexto: ConversationContext
): Promise<RespostaIA> => {
  try {
    console.log('🎯 Processando fluxo: CONSULTAR');

    // Se cliente não existe
    if (!contexto.cliente.existe) {
      return {
        tipo: 'texto',
        mensagem: 'Desculpa, não encontrei agendamento seu no sistema. Quer agendar agora?'
      };
    }

    // Buscar agendamentos do cliente
    const agendamentos = contexto.agendamentos;

    if (agendamentos.length === 0) {
      return {
        tipo: 'texto',
        mensagem: `${contexto.cliente.nome}, você não tem nenhum agendamento futuro no momento. Quer marcar um?`
      };
    }

    // Mostrar próximos agendamentos
    const proximoAgendamento = agendamentos[0];
    let resposta = `Opa ${contexto.cliente.nome}! 📅\n\nSeu próximo agendamento:\n`;
    resposta += `${proximoAgendamento.servico} - ${proximoAgendamento.data} às ${proximoAgendamento.hora}\n`;
    resposta += `Com: ${proximoAgendamento.profissional}`;

    if (agendamentos.length > 1) {
      resposta += `\n\nVocê tem mais ${agendamentos.length - 1} agendamento(s) marcado(s).`;
    }

    return {
      tipo: 'texto',
      mensagem: resposta
    };
  } catch (error) {
    console.error('❌ Erro processarFluxoConsultar:', error);
    return {
      tipo: 'erro',
      mensagem: 'Erro ao consultar agendamentos'
    };
  }
};

// ============================================
// 3️⃣ PROCESSAR FLUXO DE CANCELAR
// ============================================

export const processarFluxoCancelar = async (
  contexto: ConversationContext
): Promise<RespostaIA> => {
  try {
    console.log('🎯 Processando fluxo: CANCELAR');

    // Se cliente não existe
    if (!contexto.cliente.existe) {
      return {
        tipo: 'texto',
        mensagem: 'Não encontrei agendamento seu para cancelar.'
      };
    }

    // Se não tem agendamentos
    if (contexto.agendamentos.length === 0) {
      return {
        tipo: 'texto',
        mensagem: 'Você não tem agendamentos para cancelar.'
      };
    }

    // Buscar o próximo agendamento
    const proximoAgendamento = contexto.agendamentos[0];

    // Retornar instrução pra IA confirmar
    return {
      tipo: 'acao',
      mensagem: `Confirmando cancelamento de ${proximoAgendamento.servico} em ${proximoAgendamento.data} às ${proximoAgendamento.hora}?`,
      acao: {
        tipo: 'deletar',
        dados: {
          agendamentoId: proximoAgendamento.id,
          clienteId: contexto.cliente.id
        }
      }
    };
  } catch (error) {
    console.error('❌ Erro processarFluxoCancelar:', error);
    return {
      tipo: 'erro',
      mensagem: 'Erro ao cancelar agendamento'
    };
  }
};

// ============================================
// 4️⃣ PROCESSAR FLUXO DE REMARCAR
// ============================================

export const processarFluxoRemarcar = async (
  contexto: ConversationContext
): Promise<RespostaIA> => {
  try {
    console.log('🎯 Processando fluxo: REMARCAR');

    // Se cliente não existe
    if (!contexto.cliente.existe) {
      return {
        tipo: 'texto',
        mensagem: 'Não encontrei agendamento seu para remarcar.'
      };
    }

    // Se não tem agendamentos
    if (contexto.agendamentos.length === 0) {
      return {
        tipo: 'texto',
        mensagem: 'Você não tem agendamentos para remarcar.'
      };
    }

    // Buscar o próximo agendamento
    const proximoAgendamento = contexto.agendamentos[0];

    // Retornar instrução pra IA coletar novo dia/hora
    return {
      tipo: 'acao',
      mensagem: `Entendi! Vamos remarcar seu ${proximoAgendamento.servico} de ${proximoAgendamento.data} às ${proximoAgendamento.hora}.\n\nPara quando você quer remarcar?`,
      acao: {
        tipo: 'atualizar',
        dados: {
          agendamentoId: proximoAgendamento.id,
          clienteId: contexto.cliente.id
        }
      }
    };
  } catch (error) {
    console.error('❌ Erro processarFluxoRemarcar:', error);
    return {
      tipo: 'erro',
      mensagem: 'Erro ao remarcar agendamento'
    };
  }
};

// ============================================
// 5️⃣ PROCESSAR FLUXO DE ATRASAR
// ============================================

export const processarFluxoAtrasar = async (
  contexto: ConversationContext
): Promise<RespostaIA> => {
  try {
    console.log('🎯 Processando fluxo: ATRASAR');

    // Se cliente não existe
    if (!contexto.cliente.existe) {
      return {
        tipo: 'texto',
        mensagem: 'Não encontrei agendamento seu.'
      };
    }

    // Se não tem agendamentos
    if (contexto.agendamentos.length === 0) {
      return {
        tipo: 'texto',
        mensagem: 'Você não tem agendamentos para hoje.'
      };
    }

    // Buscar agendamento de HOJE
    const agendamentoHoje = contexto.agendamentos.find(a => a.data === contexto.dataAtual);

    if (!agendamentoHoje) {
      return {
        tipo: 'texto',
        mensagem: 'Você não tem agendamento para hoje.'
      };
    }

    // Extrair minutos de atraso da mensagem
    const regex = /(\d+)\s*min/i;
    const match = contexto.mensagem.match(regex);
    const minutosAtraso = match ? parseInt(match[1]) : 15;

    // Validar tolerância de 15 min
    if (minutosAtraso > 15) {
      return {
        tipo: 'texto',
        mensagem: `Opa, só conseguimos tolerar até 15 minutos de atraso. Você prefere:\n\n1) Tentar chegar em até 15 minutos\n2) Cancelar e remarcar para outro horário`
      };
    }

    // Registrar aviso de atraso
    return {
      tipo: 'acao',
      mensagem: `✅ Recebemos seu aviso! Você tem até 15 minutos de tolerância. Até logo!`,
      acao: {
        tipo: 'atualizar',
        dados: {
          agendamentoId: agendamentoHoje.id,
          observacao: `Cliente avisa: pode atrasar ${minutosAtraso} minutos`
        }
      }
    };
  } catch (error) {
    console.error('❌ Erro processarFluxoAtrasar:', error);
    return {
      tipo: 'erro',
      mensagem: 'Erro ao registrar atraso'
    };
  }
};

// ============================================
// 6️⃣ PROCESSAR FLUXO DE COMENTÁRIO
// ============================================

export const processarFluxoComentario = async (
  contexto: ConversationContext
): Promise<RespostaIA> => {
  try {
    console.log('🎯 Processando fluxo: COMENTÁRIO');

    // Se cliente não existe
    if (!contexto.cliente.existe) {
      return {
        tipo: 'texto',
        mensagem: 'Não encontrei agendamento seu para adicionar comentário.'
      };
    }

    // Se não tem agendamentos
    if (contexto.agendamentos.length === 0) {
      return {
        tipo: 'texto',
        mensagem: 'Você não tem agendamentos.'
      };
    }

    // Buscar próximo agendamento
    const proximoAgendamento = contexto.agendamentos[0];

    // Registrar comentário
    return {
      tipo: 'acao',
      mensagem: `✅ Anotado! Seu comentário foi registrado no agendamento de ${proximoAgendamento.data}.`,
      acao: {
        tipo: 'atualizar',
        dados: {
          agendamentoId: proximoAgendamento.id,
          observacao: contexto.mensagem
        }
      }
    };
  } catch (error) {
    console.error('❌ Erro processarFluxoComentario:', error);
    return {
      tipo: 'erro',
      mensagem: 'Erro ao adicionar comentário'
    };
  }
};

// ============================================
// 7️⃣ PROCESSAR FLUXO DE CONFIRMAÇÃO
// ============================================

export const processarFluxoConfirmacao = async (
  contexto: ConversationContext
): Promise<RespostaIA> => {
  try {
    console.log('🎯 Processando fluxo: CONFIRMAÇÃO');

    // Confirmação é uma resposta a algo
    // Será tratado no contexto anterior
    return {
      tipo: 'texto',
      mensagem: 'Entendido! ✅'
    };
  } catch (error) {
    console.error('❌ Erro processarFluxoConfirmacao:', error);
    return {
      tipo: 'erro',
      mensagem: 'Erro ao processar confirmação'
    };
  }
};

// ============================================
// 8️⃣ ROTEAR PARA O FLUXO CORRETO
// ============================================

export const rotearFluxo = async (contexto: ConversationContext): Promise<RespostaIA> => {
  try {
    console.log(`\n🔄 Roteando para: ${contexto.tipo}`);

    switch (contexto.tipo) {
      case 'agendar':
        return await processarFluxoAgendar(contexto);
      case 'consultar':
        return await processarFluxoConsultar(contexto);
      case 'cancelar':
        return await processarFluxoCancelar(contexto);
      case 'remarcar':
        return await processarFluxoRemarcar(contexto);
      case 'atrasar':
        return await processarFluxoAtrasar(contexto);
      case 'comentario':
        return await processarFluxoComentario(contexto);
      case 'confirmacao':
        return await processarFluxoConfirmacao(contexto);
      default:
        return await processarFluxoAgendar(contexto);
    }
  } catch (error) {
    console.error('❌ Erro rotearFluxo:', error);
    return {
      tipo: 'erro',
      mensagem: 'Erro ao rotear fluxo'
    };
  }
};