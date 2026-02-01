/**
 * VALIDATION PIPELINE - AGENDEZAP
 * Valida ANTES da IA responder para garantir melhor UX
 * Busca horários disponíveis e sugere alternativas automaticamente
 */

import { ConversationContext } from '../types/conversation.js';
import { 
  validarDiaAberto, 
  validarHorarioDisponivel,
  validarHorarioPassado,
  buscarHorariosDisponiveis,
  determinarPeriodosDisponiveis
} from './validationService.js';

// ============================================
// 1️⃣ TIPO DE RETORNO DA VALIDAÇÃO
// ============================================

export interface ResultadoValidacao {
  // Dados originais
  servico: string | null;
  data: string | null;
  hora: string | null;
  profissional: string | null;
  nome: string | null;
  periodo: string | null;

  // Status de validação
  validacoes: {
    diaAberto: boolean;
    horarioValido: boolean;
    horarioPassado: boolean;
    dentroFuncionamento: boolean;
    motivoErro?: string;
    sugestoesHorarios: string[];
    sugestoesProfissionais?: Array<{
      profissional: string;
      horarios: string[];
    }>;
    periodosDisponiveis?: string[];
  };
}

// ============================================
// 2️⃣ FILTRAR HORÁRIOS POR PERÍODO
// ============================================

const filtrarPorPeriodo = (horarios: string[], periodo: string): string[] => {
  const periodoLower = periodo.toLowerCase();
  
  if (periodoLower.includes('manhã') || periodoLower.includes('manha')) {
    return horarios.filter(h => {
      const hora = parseInt(h.split(':')[0]);
      return hora >= 6 && hora < 12;
    });
  }
  
  if (periodoLower.includes('tarde')) {
    return horarios.filter(h => {
      const hora = parseInt(h.split(':')[0]);
      return hora >= 12 && hora < 18;
    });
  }
  
  if (periodoLower.includes('noite')) {
    return horarios.filter(h => {
      const hora = parseInt(h.split(':')[0]);
      return hora >= 18 && hora < 23;
    });
  }
  
  return horarios;
};

// ============================================
// 3️⃣ BUSCAR HORÁRIOS PRÓXIMOS AO SOLICITADO
// ============================================

const buscarHorariosProximos = (
  todosHorarios: string[],
  horarioSolicitado: string,
  quantidade: number = 4
): string[] => {
  if (todosHorarios.length === 0) return [];
  
  const [horaSol, minSol] = horarioSolicitado.split(':').map(Number);
  const minutosSolicitado = horaSol * 60 + minSol;

  const horariosComDistancia = todosHorarios.map(h => {
    const [hora, min] = h.split(':').map(Number);
    const minutos = hora * 60 + min;
    const distancia = Math.abs(minutos - minutosSolicitado);
    return { horario: h, distancia };
  });

  return horariosComDistancia
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, quantidade)
    .map(h => h.horario)
    .sort();
};

// ============================================
// 4️⃣ VALIDAR MÚLTIPLOS PROFISSIONAIS
// ============================================

const validarMultiplosProfissionais = async (
  contexto: ConversationContext,
  data: string,
  hora: string,
  duracaoServico: number
): Promise<Array<{ profissional: string; horarios: string[] }>> => {
  const sugestoes: Array<{ profissional: string; horarios: string[] }> = [];

  for (const prof of contexto.profissionais) {
    const disponivel = await validarHorarioDisponivel(
      contexto.companyId,
      prof.id,
      data,
      hora,
      duracaoServico
    );

    if (disponivel.disponivel) {
      sugestoes.push({
        profissional: prof.nome,
        horarios: [hora]
      });
    } else {
      const horariosDisponiveis = await buscarHorariosDisponiveis(
        contexto.companyId,
        prof.id,
        data,
        duracaoServico
      );

      if (horariosDisponiveis.length > 0) {
        const proximos = buscarHorariosProximos(horariosDisponiveis, hora, 3);
        if (proximos.length > 0) {
          sugestoes.push({
            profissional: prof.nome,
            horarios: proximos
          });
        }
      }
    }
  }

  return sugestoes;
};

// ============================================
// 5️⃣ FUNÇÃO PRINCIPAL: VALIDAR E ENRIQUECER
// ============================================

export const validarEEnriquecerContexto = async (
  dadosExtraidos: any,
  contexto: ConversationContext
): Promise<ResultadoValidacao> => {
  try {
    console.log(`\n🔍 [VALIDATION] Validando dados extraídos...`);

    const resultado: ResultadoValidacao = {
      ...dadosExtraidos,
      validacoes: {
        diaAberto: true,
        horarioValido: true,
        horarioPassado: false,
        dentroFuncionamento: true,
        sugestoesHorarios: [],
        sugestoesProfissionais: [],
        periodosDisponiveis: []
      }
    };

    // CASO 1: DATA + HORA + PROFISSIONAL
    if (dadosExtraidos.hora && dadosExtraidos.data && dadosExtraidos.profissional) {
      console.log(`   📅 Validando: ${dadosExtraidos.data} às ${dadosExtraidos.hora} com ${dadosExtraidos.profissional}`);

      const diaValido = await validarDiaAberto(contexto.companyId, dadosExtraidos.data, dadosExtraidos.hora);
      if (!diaValido.aberto) {
        resultado.validacoes.diaAberto = false;
        resultado.validacoes.dentroFuncionamento = false;
        resultado.validacoes.motivoErro = diaValido.motivo;
        return resultado;
      }

      const horarioValido = validarHorarioPassado(dadosExtraidos.data, dadosExtraidos.hora, contexto.dataAtual, contexto.horarioAtual);
      if (!horarioValido.valido) {
        resultado.validacoes.horarioPassado = true;
        resultado.validacoes.motivoErro = horarioValido.motivo;
        return resultado;
      }

      const profissionalObj = contexto.profissionais.find(p => p.nome.toLowerCase() === dadosExtraidos.profissional.toLowerCase());
      if (!profissionalObj) {
        resultado.validacoes.motivoErro = `Profissional ${dadosExtraidos.profissional} não encontrado`;
        return resultado;
      }

      const servicoObj = contexto.servicos.find(s => s.nome.toLowerCase() === (dadosExtraidos.servico || '').toLowerCase());
      const duracaoServico = servicoObj?.duracao || 30;

      const disponivel = await validarHorarioDisponivel(contexto.companyId, profissionalObj.id, dadosExtraidos.data, dadosExtraidos.hora, duracaoServico);

      if (!disponivel.disponivel) {
        const todosHorarios = await buscarHorariosDisponiveis(contexto.companyId, profissionalObj.id, dadosExtraidos.data, duracaoServico);
        const proximos = buscarHorariosProximos(todosHorarios, dadosExtraidos.hora, 4);

        if (!contexto.eSolo) {
          const sugestoesProfissionais = await validarMultiplosProfissionais(contexto, dadosExtraidos.data, dadosExtraidos.hora, duracaoServico);
          resultado.validacoes.sugestoesProfissionais = sugestoesProfissionais;
        }

        resultado.validacoes.horarioValido = false;
        resultado.validacoes.motivoErro = disponivel.motivo;
        resultado.validacoes.sugestoesHorarios = proximos;
        return resultado;
      }

      return resultado;
    }

    // CASO 2: DATA + HORA (sem profissional)
    if (dadosExtraidos.hora && dadosExtraidos.data && !dadosExtraidos.profissional) {
      const diaValido = await validarDiaAberto(contexto.companyId, dadosExtraidos.data, dadosExtraidos.hora);
      if (!diaValido.aberto) {
        resultado.validacoes.diaAberto = false;
        resultado.validacoes.dentroFuncionamento = false;
        resultado.validacoes.motivoErro = diaValido.motivo;
        return resultado;
      }

      const horarioValido = validarHorarioPassado(dadosExtraidos.data, dadosExtraidos.hora, contexto.dataAtual, contexto.horarioAtual);
      if (!horarioValido.valido) {
        resultado.validacoes.horarioPassado = true;
        resultado.validacoes.motivoErro = horarioValido.motivo;
        return resultado;
      }

      const servicoObj = contexto.servicos.find(s => s.nome.toLowerCase() === (dadosExtraidos.servico || '').toLowerCase());
      const duracaoServico = servicoObj?.duracao || 30;

      const sugestoesProfissionais = await validarMultiplosProfissionais(contexto, dadosExtraidos.data, dadosExtraidos.hora, duracaoServico);
      resultado.validacoes.sugestoesProfissionais = sugestoesProfissionais;
      return resultado;
    }

    // CASO 3: DATA + PERÍODO
    if (dadosExtraidos.periodo && dadosExtraidos.data && !dadosExtraidos.hora) {
      const diaValido = await validarDiaAberto(contexto.companyId, dadosExtraidos.data);
      if (!diaValido.aberto) {
        resultado.validacoes.diaAberto = false;
        resultado.validacoes.motivoErro = diaValido.motivo;
        return resultado;
      }

      const servicoObj = contexto.servicos.find(s => s.nome.toLowerCase() === (dadosExtraidos.servico || '').toLowerCase());
      const duracaoServico = servicoObj?.duracao || 30;

      if (dadosExtraidos.profissional) {
        const profissionalObj = contexto.profissionais.find(p => p.nome.toLowerCase() === dadosExtraidos.profissional.toLowerCase());
        if (profissionalObj) {
          const todosHorarios = await buscarHorariosDisponiveis(contexto.companyId, profissionalObj.id, dadosExtraidos.data, duracaoServico);
          const horariosPeriodo = filtrarPorPeriodo(todosHorarios, dadosExtraidos.periodo);
          resultado.validacoes.sugestoesHorarios = horariosPeriodo.slice(0, 6);
        }
      } else {
        const sugestoesProfissionais: Array<{ profissional: string; horarios: string[] }> = [];
        for (const prof of contexto.profissionais) {
          const todosHorarios = await buscarHorariosDisponiveis(contexto.companyId, prof.id, dadosExtraidos.data, duracaoServico);
          const horariosPeriodo = filtrarPorPeriodo(todosHorarios, dadosExtraidos.periodo);
          if (horariosPeriodo.length > 0) {
            sugestoesProfissionais.push({ profissional: prof.nome, horarios: horariosPeriodo.slice(0, 4) });
          }
        }
        resultado.validacoes.sugestoesProfissionais = sugestoesProfissionais;
      }

      return resultado;
    }

    // CASO 4: Só DATA
    if (dadosExtraidos.data && !dadosExtraidos.hora && !dadosExtraidos.periodo) {
      const periodosDisponiveis = await determinarPeriodosDisponiveis(contexto.companyId, dadosExtraidos.data, contexto.dataAtual, contexto.horarioAtual);
      resultado.validacoes.periodosDisponiveis = periodosDisponiveis.periodos;
      return resultado;
    }

    return resultado;

  } catch (error) {
    console.error('❌ Erro validarEEnriquecerContexto:', error);
    return {
      ...dadosExtraidos,
      validacoes: {
        diaAberto: true,
        horarioValido: true,
        horarioPassado: false,
        dentroFuncionamento: true,
        sugestoesHorarios: [],
        sugestoesProfissionais: [],
        periodosDisponiveis: []
      }
    };
  }
};