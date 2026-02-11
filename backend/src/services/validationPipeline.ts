/**
 * VALIDATION PIPELINE - AGENDEZAP
 * Valida ANTES da IA responder para garantir melhor UX
 * Busca horários disponíveis e sugere alternativas automaticamente
 * 
 * ✅ CORRIGIDO: Valida horário no passado ANTES de pedir confirmação
 */

import { ConversationContext } from '../types/conversation.js';
import {
  validarDiaAberto,
  validarHorarioPassado,
  determinarPeriodosDisponiveis
} from './validationService.js';
import {
  validarHorarioDisponivel,
  buscarHorariosDisponiveis
} from './appointmentService.js';

// ============================================
// ✅ NORMALIZADOR: garantir que horários seja sempre string[]
// (Algumas funções retornam { horarios, status, motivo })
// ============================================
const normalizarHorarios = (res: any): string[] => {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.horarios)) return res.horarios;
  return [];
};

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

const filtrarPorPeriodo = (horariosIn: any, periodo: string): string[] => {
  const horarios = normalizarHorarios(horariosIn);
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
  todosHorariosIn: any,
  horarioSolicitado: string,
  quantidade: number = 4
): string[] => {
  const todosHorarios = normalizarHorarios(todosHorariosIn);
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
      const horariosDisponiveisRes = await buscarHorariosDisponiveis(
        contexto.companyId,
        prof.id,
        data,
        duracaoServico
      );

      const horariosDisponiveis = normalizarHorarios(horariosDisponiveisRes);

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
// ✅ CORRIGIDO: Valida horário passado ANTES de tudo
// ============================================

export const validarEEnriquecerContexto = async (
  dadosExtraidos: any,
  contexto: ConversationContext
): Promise<ResultadoValidacao> => {
  try {
    console.log(`\n🔍 [VALIDATION] Validando dados extraídos... (Tipo: ${contexto.tipo})`);

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

    // ✅ VALIDAÇÃO 0: Se for CONSULTA, pula validações rigorosas e retorna tudo como true
    if (contexto.tipo === 'consultar') {
      console.log(`   ℹ️ [VALIDATION] Tipo 'consultar' detectado. Pulando validações de agendamento.`);
      return resultado;
    }

    // ✅ VALIDAÇÃO CRÍTICA 1: HORÁRIO NO PASSADO (ANTES DE TUDO!)
    if (dadosExtraidos.data && dadosExtraidos.hora) {
      console.log(`   ⏰ Verificando se horário já passou...`);

      const horarioValidoTempo = validarHorarioPassado(
        dadosExtraidos.data,
        dadosExtraidos.hora,
        contexto.dataAtual,
        contexto.horarioAtual
      );

      if (!horarioValidoTempo.valido) {
        console.log(`   ❌ Horário no passado detectado!`);
        resultado.validacoes.horarioPassado = true;
        resultado.validacoes.horarioValido = false;
        resultado.validacoes.motivoErro = horarioValidoTempo.motivo;

        // Buscar horários disponíveis FUTUROS
        if (dadosExtraidos.profissional) {
          const profissionalObj = contexto.profissionais.find(
            p => p.nome.toLowerCase() === dadosExtraidos.profissional.toLowerCase()
          );

          if (profissionalObj) {
            const servicoObj = contexto.servicos.find(
              s => s.nome.toLowerCase() === (dadosExtraidos.servico || '').toLowerCase()
            );
            const duracaoServico = servicoObj?.duracao || 30;

            const todosHorariosRes = await buscarHorariosDisponiveis(
              contexto.companyId,
              profissionalObj.id,
              dadosExtraidos.data,
              duracaoServico
            );

            const todosHorarios = normalizarHorarios(todosHorariosRes);

            // Filtrar apenas horários FUTUROS (após hora atual + 1h)
            const horaAtualMinutos = parseInt(contexto.horarioAtual.split(':')[0]) * 60 +
              parseInt(contexto.horarioAtual.split(':')[1]);
            const minutoMinimoFuturo = horaAtualMinutos + 60; // 1 hora de antecedência

            const horariosFuturos = todosHorarios.filter(h => {
              const [hora, min] = h.split(':').map(Number);
              const minutos = hora * 60 + min;
              return minutos > minutoMinimoFuturo;
            });

            resultado.validacoes.sugestoesHorarios = horariosFuturos.slice(0, 4);
          }
        }

        return resultado;
      }
    }

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

    // CASO 4: Só DATA (ou apenas consulta de funcionamento)
    if (dadosExtraidos.data && !dadosExtraidos.hora && !dadosExtraidos.periodo) {
      // ✅ REGRA: Se não tem hora nem serviço, a validação de dia aberto é apenas informativa
      const diaValido = await validarDiaAberto(contexto.companyId, dadosExtraidos.data);
      
      resultado.validacoes.diaAberto = diaValido.aberto;
      
      // Só injeta motivoErro se o dia estiver REALMENTE fechado
      if (!diaValido.aberto) {
        resultado.validacoes.motivoErro = diaValido.motivo;
      }

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
