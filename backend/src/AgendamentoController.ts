/**
 * AGENDAMENTO CONTROLLER - AGENDEZAP
 * Funções auxiliares e handler de agendamentos
 */

import { db, supabase } from "./supabase.js";
import { criarAgendamento, buscarHorariosDisponiveis, validarHorarioDisponivel as validarHorarioDisponivel2 } from "./services/appointmentService.js";
import { criarNovoCliente } from "./services/clientService.js";
import { validarDiaAberto, validarDataFutura } from "./services/validationService.js";
import { CriarAgendamentoInput } from "./types/agendamento.js";

// ============================================
// 1️⃣ FUNÇÃO PRINCIPAL: TENTAR AGENDAR
// ============================================

export const tentarAgendar = async (
  args: any,
  companyId: string,
  clienteId?: string,
  telefone?: string
) => {
  try {
    console.log('📝 [AGENDAR] Tentando agendar...');
    console.log(`   Serviço: ${args.servico}`);
    console.log(`   Data: ${args.data}`);
    console.log(`   Hora: ${args.hora}`);
    console.log(`   Profissional: ${args.profissional}`);

    // --- CONVERSÃO DE DATA ---
    let dataFormatada = args.data;
    if (args.data.includes('/')) {
      const [dia, mes, ano] = args.data.split('/');
      dataFormatada = `${ano}-${mes}-${dia}`;
    }

    console.log(`   Data formatada: ${dataFormatada}`);

    // --- BUSCAR PROFISSIONAL E SERVIÇO ---
    const profissionais = await db.getProfissionais(companyId);
    const servicos = await db.getServicos(companyId);

    const prf = profissionais.find((p: any) =>
      p.nome.toLowerCase().includes(args.profissional.toLowerCase())
    );
    const srv = servicos.find((s: any) =>
      s.nome.toLowerCase().includes(args.servico.toLowerCase())
    );

    if (!prf) {
      console.log(`❌ Profissional ${args.profissional} não encontrado`);
      return {
        status: "erro",
        mensagem: `Profissional ${args.profissional} não encontrado.`
      };
    }

    console.log(`✅ Profissional encontrado: ${prf.nome}`);

    // --- VALIDAR DIA ABERTO ---
    const diaAberto = await validarDiaAberto(companyId, dataFormatada);
    if (!diaAberto.aberto) {
      console.log(`❌ Dia fechado: ${diaAberto.motivo}`);
      return {
        status: "erro",
        mensagem: `Desculpa, estamos fechados nesse dia. ${diaAberto.motivo}`
      };
    }

    console.log(`✅ Dia aberto`);

    // --- VALIDAR DATA FUTURA ---
    const hoje = new Date().toISOString().split('T')[0];
    const dataValida = validarDataFutura(dataFormatada, hoje);
    if (!dataValida.valida) {
      console.log(`❌ Data inválida: ${dataValida.motivo}`);
      return {
        status: "erro",
        mensagem: dataValida.motivo || "Data inválida"
      };
    }

    console.log(`✅ Data válida`);

    // --- VALIDAR HORÁRIO DISPONÍVEL ---
    const duracao = srv?.duracao || 30;
    const horarioDisponivel = await validarHorarioDisponivel2(
      companyId,
      prf.id,
      dataFormatada,
      args.hora,
      duracao
    );

    if (!horarioDisponivel.disponivel) {
      console.log(`❌ Horário ocupado: ${horarioDisponivel.motivo}`);
      return {
        status: "ocupado",
        profissional: prf.nome,
        mensagem: horarioDisponivel.motivo
      };
    }

    console.log(`✅ Horário disponível`);

    // --- VERIFICAR SE CLIENTE EXISTE ---
    if (!clienteId) {
      console.log(`⚠️  Cliente não existe, pedindo nome...`);
      return {
        status: "pedir_nome",
        dados: { ...args, data: dataFormatada }
      };
    }

    console.log(`✅ Cliente encontrado: ${clienteId}`);

    // --- CRIAR AGENDAMENTO ---
    const novoAgendamento: CriarAgendamentoInput = {
      cliente_id: clienteId,
      servico_id: srv?.id || '',
      profissional_id: prf.id,
      data_agendamento: dataFormatada,
      hora_agendamento: args.hora
    };

    console.log(`🔄 Criando agendamento no banco...`);
    const resultado = await criarAgendamento(novoAgendamento, companyId);

    if (resultado.status === 'erro') {
      console.log(`❌ Erro ao criar: ${resultado.mensagem}`);
      return resultado;
    }

    console.log(`✅ Agendamento criado com sucesso!`);
    return {
      status: "sucesso",
      profissional: prf.nome,
      servico: srv?.nome || args.servico,
      data: dataFormatada,
      hora: args.hora,
      agendamento: resultado.agendamento
    };
  } catch (error) {
    console.error("❌ Erro tentarAgendar:", error);
    return {
      status: "erro",
      mensagem: "Erro ao processar agendamento"
    };
  }
};

// ============================================
// 2️⃣ CRIAR CLIENTE (auxiliar)
// ============================================

export const criarCliente = async (
  nome: string,
  telefone: string,
  companyId: string,
  dataNascimento?: string
) => {
  try {
    console.log(`📝 Criando cliente: ${nome}`);

    const resultado = await criarNovoCliente(
      {
        nome,
        telefone,
        data_nascimento: dataNascimento
      },
      companyId
    );

    if (resultado.sucesso && resultado.cliente) {
      console.log(`✅ Cliente criado: ${resultado.cliente.id}`);
      return resultado.cliente;
    } else {
      console.log(`❌ Erro ao criar cliente: ${resultado.erro}`);
      return null;
    }
  } catch (error) {
    console.error("❌ Erro criarCliente:", error);
    return null;
  }
};

// ============================================
// 3️⃣ BUSCAR HORÁRIOS DISPONÍVEIS (auxiliar)
// ============================================

export const getHorariosDisponiveis = async (
  profissionalId: string,
  dataAgendamento: string,
  companyId: string
): Promise<string[]> => {
  try {
    console.log(`🕐 Buscando horários disponíveis...`);
    console.log(`   Profissional: ${profissionalId}`);
    console.log(`   Data: ${dataAgendamento}`);

    const horarios = await buscarHorariosDisponiveis(
      companyId,
      profissionalId,
      dataAgendamento,
      30 // duração padrão
    );

    console.log(`✅ ${horarios.length} horários disponíveis`);
    return horarios;
  } catch (error) {
    console.error("❌ Erro getHorariosDisponiveis:", error);
    return [];
  }
};

// ============================================
// 4️⃣ FUNÇÃO LEGACY (compatibilidade)
// ============================================

export const processarFluxoAgendamento = async (
  texto: string,
  telefone: string,
  companyId: string
) => {
  // Esta função foi refatorada!
  // Agora o fluxo usa: messageHandler → conversationPipeline → aiService
  console.log('⚠️ processarFluxoAgendamento é legacy!');
  console.log('Use o novo fluxo: messageHandler → conversationPipeline → aiService');
  return "Sistema em atualização. Use o novo fluxo!";
};