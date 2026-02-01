/**
 * APPOINTMENT SERVICE - AGENDEZAP
 * Cria, cancela, remarcar e consulta agendamentos
 */

import { db, supabase } from '../supabase.js';
import { 
  Agendamento, 
  CriarAgendamentoInput, 
  AtualizarAgendamentoInput, 
  RespostaAgendamento,
  AgendamentoDoCliente
} from '../types/agendamento.js';

// ============================================
// 1️⃣ CRIAR AGENDAMENTO
// ============================================

export const criarAgendamento = async (
  dados: CriarAgendamentoInput,
  companyId: string
): Promise<RespostaAgendamento> => {
  try {
    // Validar campos obrigatórios
    if (!dados.cliente_id || !dados.servico_id || !dados.profissional_id || !dados.data_agendamento || !dados.hora_agendamento) {
      return {
        status: 'erro',
        mensagem: 'Dados incompletos para criar agendamento'
      };
    }

    // Criar agendamento no banco
    const { data, error } = await supabase
      .from('agendamentos')
      .insert([{
        cliente_id: dados.cliente_id,
        servico_id: dados.servico_id,
        profissional_id: dados.profissional_id,
        data_agendamento: dados.data_agendamento,
        hora_agendamento: dados.hora_agendamento,
        company_id: companyId,
        status: 'confirmado',
        origem: 'whatsapp',
        observacao: dados.observacao || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error || !data) {
      console.error('❌ Erro Supabase:', error);
      return {
        status: 'erro',
        mensagem: 'Erro ao criar agendamento no banco'
      };
    }

    return {
      status: 'sucesso',
      mensagem: 'Agendamento criado com sucesso',
      agendamento: data
    };
  } catch (error) {
    console.error('❌ Erro criarAgendamento:', error);
    return {
      status: 'erro',
      mensagem: 'Erro ao criar agendamento'
    };
  }
};

// ============================================
// 2️⃣ BUSCAR AGENDAMENTOS DO CLIENTE
// ============================================

export const buscarAgendamentosCliente = async (
  clienteId: string,
  companyId: string
): Promise<AgendamentoDoCliente[]> => {
  try {
    const { data: agendamentos, error } = await supabase
      .from('agendamentos')
      .select(`
        id,
        data_agendamento,
        hora_agendamento,
        status,
        observacao,
        servicos:servico_id(nome, duracao),
        profissionais:profissional_id(nome)
      `)
      .eq('cliente_id', clienteId)
      .eq('company_id', companyId)
      .neq('status', 'cancelado')
      .order('data_agendamento', { ascending: true });

    if (error || !agendamentos) {
      return [];
    }

    // Formatar resposta
    return agendamentos.map((a: any) => {
      // Calcular hora de término
      const [hora, minuto] = a.hora_agendamento.split(':').map(Number);
      const duracao = a.servicos?.duracao || 30;
      const minutoTermino = minuto + duracao;
      const horaTermino = hora + Math.floor(minutoTermino / 60);
      const minutoFinal = minutoTermino % 60;

      return {
        id: a.id,
        servico: a.servicos?.nome || 'Serviço',
        profissional: a.profissionais?.nome || 'Profissional',
        data: a.data_agendamento,
        hora: a.hora_agendamento,
        horario_termino: `${String(horaTermino).padStart(2, '0')}:${String(minutoFinal).padStart(2, '0')}`,
        status: a.status,
        observacao: a.observacao
      };
    });
  } catch (error) {
    console.error('❌ Erro buscarAgendamentosCliente:', error);
    return [];
  }
};

// ============================================
// 3️⃣ BUSCAR AGENDAMENTO PRÓXIMO DO CLIENTE
// ============================================

export const buscarProximoAgendamento = async (
  clienteId: string,
  companyId: string
): Promise<AgendamentoDoCliente | null> => {
  try {
    const agendamentos = await buscarAgendamentosCliente(clienteId, companyId);
    
    if (agendamentos.length === 0) {
      return null;
    }

    // Retorna o primeiro (mais próximo)
    return agendamentos[0];
  } catch (error) {
    console.error('❌ Erro buscarProximoAgendamento:', error);
    return null;
  }
};

// ============================================
// 4️⃣ CANCELAR AGENDAMENTO
// ============================================

export const cancelarAgendamento = async (
  agendamentoId: string,
  companyId: string,
  observacao?: string
): Promise<RespostaAgendamento> => {
  try {
    // Buscar agendamento antes de cancelar
    const { data: agendamento } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('id', agendamentoId)
      .eq('company_id', companyId)
      .single();

    if (!agendamento) {
      return {
        status: 'erro',
        mensagem: 'Agendamento não encontrado'
      };
    }

    // Atualizar status pra cancelado
    const { error } = await supabase
      .from('agendamentos')
      .update({
        status: 'cancelado',
        observacao: observacao || agendamento.observacao,
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamentoId)
      .eq('company_id', companyId);

    if (error) {
      return {
        status: 'erro',
        mensagem: 'Erro ao cancelar agendamento'
      };
    }

    return {
      status: 'sucesso',
      mensagem: 'Agendamento cancelado com sucesso',
      agendamento: { ...agendamento, status: 'cancelado' }
    };
  } catch (error) {
    console.error('❌ Erro cancelarAgendamento:', error);
    return {
      status: 'erro',
      mensagem: 'Erro ao cancelar agendamento'
    };
  }
};

// ============================================
// 5️⃣ ATUALIZAR AGENDAMENTO
// ============================================

export const atualizarAgendamento = async (
  agendamentoId: string,
  companyId: string,
  dados: AtualizarAgendamentoInput
): Promise<RespostaAgendamento> => {
  try {
    // Validar que tem pelo menos um campo pra atualizar
    if (!dados.data_agendamento && !dados.hora_agendamento && !dados.status && !dados.observacao) {
      return {
        status: 'erro',
        mensagem: 'Nenhum dado para atualizar'
      };
    }

    // Atualizar
    const { data: agendamento, error } = await supabase
      .from('agendamentos')
      .update({
        ...(dados.data_agendamento && { data_agendamento: dados.data_agendamento }),
        ...(dados.hora_agendamento && { hora_agendamento: dados.hora_agendamento }),
        ...(dados.status && { status: dados.status }),
        ...(dados.observacao && { observacao: dados.observacao }),
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamentoId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error || !agendamento) {
      return {
        status: 'erro',
        mensagem: 'Erro ao atualizar agendamento'
      };
    }

    return {
      status: 'sucesso',
      mensagem: 'Agendamento atualizado com sucesso',
      agendamento
    };
  } catch (error) {
    console.error('❌ Erro atualizarAgendamento:', error);
    return {
      status: 'erro',
      mensagem: 'Erro ao atualizar agendamento'
    };
  }
};

// ============================================
// 6️⃣ ADICIONAR OBSERVAÇÃO AO AGENDAMENTO
// ============================================

export const adicionarObservacao = async (
  agendamentoId: string,
  companyId: string,
  observacao: string
): Promise<RespostaAgendamento> => {
  try {
    const { data: agendamento, error } = await supabase
      .from('agendamentos')
      .update({
        observacao,
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamentoId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error || !agendamento) {
      return {
        status: 'erro',
        mensagem: 'Erro ao adicionar observação'
      };
    }

    return {
      status: 'sucesso',
      mensagem: 'Observação adicionada com sucesso',
      agendamento
    };
  } catch (error) {
    console.error('❌ Erro adicionarObservacao:', error);
    return {
      status: 'erro',
      mensagem: 'Erro ao adicionar observação'
    };
  }
};

// ============================================
// 7️⃣ BUSCAR HORÁRIOS DISPONÍVEIS
// ============================================

export const buscarHorariosDisponiveis = async (
  companyId: string,
  profissionalId: string,
  data: string,
  duracao: number
): Promise<string[]> => {
  try {
    const { data: config } = await supabase
      .from('configuracoes')
      .select('hora_abertura, hora_fechamento')
      .eq('company_id', companyId)
      .single();

    if (!config) return [];

    const { data: ocupados } = await supabase
      .from('agendamentos')
      .select('hora_agendamento')
      .eq('profissional_id', profissionalId)
      .eq('data_agendamento', data)
      .eq('company_id', companyId)
      .neq('status', 'cancelado');

    const horariosOcupados = (ocupados || []).map((a: any) => a.hora_agendamento);

    const [horaAbertura, minAbertura] = (config.hora_abertura || '09:00').split(':').map(Number);
    const [horaFechamento, minFechamento] = (config.hora_fechamento || '18:00').split(':').map(Number);

    const horarios: string[] = [];
    let hora = horaAbertura;
    let min = minAbertura;

    while (hora < horaFechamento || (hora === horaFechamento && min < minFechamento)) {
      const horarioFormatado = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      
      const minutosFim = horaFechamento * 60 + minFechamento;
      const minutosAgora = hora * 60 + min + duracao;

      if (minutosAgora <= minutosFim && !horariosOcupados.includes(horarioFormatado)) {
        horarios.push(horarioFormatado);
      }

      min += 30;
      if (min >= 60) {
        min = 0;
        hora += 1;
      }
    }

    return horarios;
  } catch (error) {
    console.error('❌ Erro buscarHorariosDisponiveis:', error);
    return [];
  }
};