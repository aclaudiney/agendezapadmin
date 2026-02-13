/**
 * APPOINTMENT SERVICE - AGENDEZAP
 * Cria, cancela, remarcar e consulta agendamentos
 * 
 * ✅ CORRIGIDO: buscarHorariosDisponiveis agora usa horario_segunda/terca/etc
 */

import { db, supabase } from '../supabase.js';
import { NotificationService } from './notificationService.js';
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
        status: 'pendente',
        origem: 'whatsapp',
        observacao: dados.observacao || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error || !data) {
      console.error('❌ Erro Supabase:', error);

      // Tratamento específico para erro de concorrência (UNIQUE constraint 23505)
      if (error?.code === '23505') {
        const proximos = await buscarHorariosLivresPorProfissional(companyId, dados.profissional_id, dados.data_agendamento);
        return {
          status: 'ocupado',
          mensagem: 'HORARIO_OCUPADO_AGORA',
          proximosHorarios: proximos.horarios.slice(0, 3)
        };
      }

      return {
        status: 'erro',
        mensagem: 'Erro ao criar agendamento no banco'
      };
    }

    // 🔔 NOTIFICAR PROFISSIONAL
    NotificationService.notifyProfessionalNewAppointment(companyId, data.id).catch(err => 
      console.error('⚠️ Erro em background ao notificar profissional:', err)
    );

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
        observacao: observacao || agendamento.observacao
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
        ...(dados.observacao && { observacao: dados.observacao })
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
// ✅ CORRIGIDO: Agora retorna status de fechado
// ============================================

export const buscarHorariosDisponiveis = async (
  companyId: string,
  profissionalId: string,
  data: string,
  duracao: number
): Promise<{ horarios: string[], status: 'aberto' | 'fechado' | 'erro', motivo?: string }> => {
  try {
    // 1️⃣ VALIDAÇÃO DE DIA FECHADO (configuracoes)
    // Prioridade máxima: verificar se a empresa abre neste dia da semana
    const { data: settings } = await supabase
      .from('configuracoes')
      .select('dias_abertura')
      .eq('company_id', companyId)
      .single();

    const dataObjCheck = new Date(`${data}T12:00:00-03:00`);
    const diaSemanaCheck = dataObjCheck.getDay();
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const nomeDia = dias[diaSemanaCheck];

    console.log(`🔍 Validando dia ${nomeDia} (${data})...`);

    if (settings?.dias_abertura && settings.dias_abertura[nomeDia] === false) {
      console.log(`🚫 BLOQUEADO: Empresa fechada às ${nomeDia}s (dias_abertura=false)`);
      return {
        horarios: [],
        status: 'fechado',
        motivo: `Estamos fechados às ${nomeDia}s.`
      };
    }

    // 2️⃣ BUSCAR CONFIGURAÇÃO DE HORÁRIOS (configuracoes)
    // ✅ CORRIGIDO: Buscar configuração completa
    const { data: config } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (!config) return { horarios: [], status: 'erro', motivo: 'Configuração não encontrada' };

    // Compatibilidade com lógica antiga
    if (config.dias_abertura && config.dias_abertura[nomeDia] === false) {
      return {
        horarios: [],
        status: 'fechado',
        motivo: `Estamos fechados às ${nomeDia}s.`
      };
    }

    // ✅ CORRIGIDO: Pegar dia da semana COM TIMEZONE
    const dataObj = new Date(`${data}T12:00:00-03:00`);
    const diaSemana = dataObj.getDay();
    const nomesDiaIngles = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const horarioDoDia = config[`horario_${nomesDiaIngles[diaSemana]}`];

    if (horarioDoDia === 'FECHADO' || !horarioDoDia) {
      return {
        horarios: [],
        status: 'fechado',
        motivo: `Estamos fechados às ${nomeDia}s.`
      };
    }

    const { data: ocupados } = await supabase
      .from('agendamentos')
      .select('hora_agendamento')
      .eq('profissional_id', profissionalId)
      .eq('data_agendamento', data)
      .eq('company_id', companyId)
      .neq('status', 'cancelado');

    // ✅ CORREÇÃO: Normalizar horários ocupados (HH:MM, HH:MM:SS) e também arredondar pra grade 30/30
    const horariosOcupadosSet = new Set<string>();

    for (const a of (ocupados || []) as any[]) {
      const raw = a?.hora_agendamento;
      if (typeof raw !== 'string') continue;

      // 1) Normalização direta (primeiros 5 chars) -> "HH:MM"
      const hhmm = raw.trim().slice(0, 5);
      if (/^\d{2}:\d{2}$/.test(hhmm)) {
        horariosOcupadosSet.add(hhmm);

        // 2) Arredondamento pra grade (00/30) - proteção extra
        const [h, m] = hhmm.split(':').map(Number);
        const mArredondado = m >= 30 ? 30 : 0;
        const arred = `${String(h).padStart(2, '0')}:${String(mArredondado).padStart(2, '0')}`;
        horariosOcupadosSet.add(arred);
      }
    }

    const horariosOcupados = Array.from(horariosOcupadosSet);
    console.log(`   🧱 Ocupados encontrados: ${horariosOcupados.length}`);

    // ✅ CORRIGIDO: Usar horarioDoDia (ex: "09:00-18:00")
    const [horaAbertura, minAbertura] = horarioDoDia.split('-')[0].split(':').map(Number);
    const [horaFechamento, minFechamento] = horarioDoDia.split('-')[1].split(':').map(Number);

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

    // 🚨 CORREÇÃO 3: FILTRAR APENAS HORÁRIOS FUTUROS
    const agora = new Date();
    // Ajuste simples para data local YYYY-MM-DD
    const hoje = agora.toISOString().split('T')[0];

    let horariosFinais = horarios;

    if (data === hoje) {
      const horaAtual = agora.getHours();
      const minutoAtual = agora.getMinutes();
      const horarioMinimo = horaAtual + 1; // 1h antecedência

      horariosFinais = horarios.filter(horario => {
        const [h, m] = horario.split(':').map(Number);
        return h > horarioMinimo || (h === horarioMinimo && m > minutoAtual);
      });

      console.log(`⏰ Filtrado para hoje: ${horariosFinais.length} horários futuros (de ${horarios.length})`);
    }

    return { horarios: horariosFinais, status: 'aberto' };
  } catch (error) {
    console.error('❌ Erro buscarHorariosDisponiveis:', error);
    return { horarios: [], status: 'erro', motivo: 'Erro interno' };
  }
};

// ============================================
// 8️⃣ BUSCAR HORÁRIOS LIVRES POR PROFISSIONAL
// ✅ NOVO: Filtra por profissional + períodos + remove passados
// ============================================

export const buscarHorariosLivresPorProfissional = async (
  companyId: string,
  profissionalId: string,
  data: string,
  duracao: number = 30
): Promise<{
  horarios: string[];
  periodos: {
    manha: string[];
    tarde: string[];
    noite: string[];
  };
  status: 'aberto' | 'fechado' | 'erro';
  motivo?: string;
}> => {
  try {
    // 1. Buscar horários disponíveis do profissional
    const resultado = await buscarHorariosDisponiveis(companyId, profissionalId, data, duracao);

    if (resultado.status === 'fechado') {
      return {
        horarios: [],
        periodos: { manha: [], tarde: [], noite: [] },
        status: 'fechado',
        motivo: resultado.motivo
      };
    }

    const todosHorarios = resultado.horarios;

    // 2. Filtrar horários passados
    const agora = new Date();
    const hojeStr = agora.toISOString().split('T')[0];

    const horariosValidos = todosHorarios.filter(h => {
      if (data !== hojeStr) return true; // Dia futuro, todos válidos

      const [hora, min] = h.split(':').map(Number);
      const dataHora = new Date(data + 'T' + h + ':00-03:00');

      // ✅ CORRIGIDO: Filtrar com 1h de antecedência (lead time)
      // Se agora é 16:00, só mostra horários a partir das 17:00
      const dataHoraLimite = new Date(agora.getTime() + 60 * 60 * 1000);

      return dataHora > dataHoraLimite;
    });

    // 3. Separar por período
    const periodos = {
      manha: horariosValidos.filter(h => {
        const hora = parseInt(h.split(':')[0]);
        return hora >= 6 && hora < 12;
      }),
      tarde: horariosValidos.filter(h => {
        const hora = parseInt(h.split(':')[0]);
        return hora >= 12 && hora < 18;
      }),
      noite: horariosValidos.filter(h => {
        const hora = parseInt(h.split(':')[0]);
        return hora >= 18;
      })
    };

    return {
      horarios: horariosValidos,
      periodos,
      status: 'aberto'
    };
  } catch (error) {
    console.error('❌ Erro buscarHorariosLivresPorProfissional:', error);
    return {
      horarios: [],
      periodos: { manha: [], tarde: [], noite: [] },
      status: 'erro'
    };
  }
};

// ============================================
// 9️⃣ BUSCAR HORÁRIOS LIVRES GERAL (TODOS PROFISSIONAIS)
// ✅ NOVO: Retorna horários disponíveis de qualquer profissional
// ============================================

export const buscarHorariosLivresGeral = async (
  companyId: string,
  data: string,
  duracao: number = 30
): Promise<{
  horariosPorProfissional: Array<{
    profissionalId: string;
    profissionalNome: string;
    horarios: string[];
    periodos: {
      manha: string[];
      tarde: string[];
      noite: string[];
    };
  }>;
  horariosUnificados: string[];
  periodosUnificados: {
    manha: string[];
    tarde: string[];
    noite: string[];
  };
}> => {
  try {
    // 1. Buscar todos os profissionais da empresa
    const { data: profissionais } = await supabase
      .from('profissionais')
      .select('id, nome')
      .eq('company_id', companyId);

    if (!profissionais || profissionais.length === 0) {
      return {
        horariosPorProfissional: [],
        horariosUnificados: [],
        periodosUnificados: { manha: [], tarde: [], noite: [] }
      };
    }

    // 2. Buscar horários de cada profissional
    const horariosPorProfissional = await Promise.all(
      profissionais.map(async (prof) => {
        const resultado = await buscarHorariosLivresPorProfissional(
          companyId,
          prof.id,
          data,
          duracao
        );

        return {
          profissionalId: prof.id,
          profissionalNome: prof.nome,
          horarios: resultado.horarios,
          periodos: resultado.periodos
        };
      })
    );

    // 3. Unificar horários (qualquer profissional disponível)
    const horariosSet = new Set<string>();
    horariosPorProfissional.forEach(prof => {
      prof.horarios.forEach(h => horariosSet.add(h));
    });

    const horariosUnificados = Array.from(horariosSet).sort();

    // 4. Separar por período
    const periodosUnificados = {
      manha: horariosUnificados.filter(h => {
        const hora = parseInt(h.split(':')[0]);
        return hora >= 6 && hora < 12;
      }),
      tarde: horariosUnificados.filter(h => {
        const hora = parseInt(h.split(':')[0]);
        return hora >= 12 && hora < 18;
      }),
      noite: horariosUnificados.filter(h => {
        const hora = parseInt(h.split(':')[0]);
        return hora >= 18;
      })
    };

    return {
      horariosPorProfissional,
      horariosUnificados,
      periodosUnificados
    };
  } catch (error) {
    console.error('❌ Erro buscarHorariosLivresGeral:', error);
    return {
      horariosPorProfissional: [],
      horariosUnificados: [],
      periodosUnificados: { manha: [], tarde: [], noite: [] }
    };
  }
};

// ============================================
// 🔟 VALIDAR HORÁRIO DISPONÍVEL
// ✅ NOVO: Valida ANTES de confirmar agendamento
// ============================================

export const validarHorarioDisponivel = async (
  companyId: string,
  profissionalId: string,
  data: string,
  hora: string,
  duracao: number = 30
): Promise<{
  disponivel: boolean;
  motivo?: string;
}> => {
  try {
    // 1. Buscar horários disponíveis
    const resultado = await buscarHorariosDisponiveis(
      companyId,
      profissionalId,
      data,
      duracao
    );

    if (resultado.status === 'fechado') {
      return {
        disponivel: false,
        motivo: resultado.motivo || 'Estabelecimento fechado'
      };
    }

    const horariosDisponiveis = resultado.horarios;

    // 2. Verificar se horário está na lista
    if (!horariosDisponiveis.includes(hora)) {
      return {
        disponivel: false,
        motivo: 'Horário não disponível ou já ocupado'
      };
    }

    // 3. Verificar se não está no passado
    const agora = new Date();
    const dataAgendamento = new Date(`${data}T${hora}:00-03:00`);

    if (dataAgendamento <= agora) {
      return {
        disponivel: false,
        motivo: 'Horário já passou'
      };
    }

    return { disponivel: true };
  } catch (error) {
    console.error('❌ Erro validarHorarioDisponivel:', error);
    return {
      disponivel: false,
      motivo: 'Erro ao validar horário'
    };
  }
};
