/**
 * MESSAGE HANDLER - AGENDEZAP
 * Recebe mensagem do WhatsApp, limpa, formata e prepara contexto para IA
 * Este é o NODE DE ENTRADA do fluxo!
 * 
 * ✅ CORRIGIDO: Import e chamada da função extrairDadosMensagem
 */

import { ConversationContext, TipoConversa } from '../types/conversation.js';
import { obterDadosClienteParaIA, formatarTelefone } from '../services/clientService.js';
import { buscarAgendamentosCliente, buscarProximoAgendamento } from '../services/appointmentService.js';
import { extrairDadosMensagem as extrairDadosDoTexto } from '../services/extractionService.js'; // ✅ RENOMEADO!
import { validarEEnriquecerContexto } from '../services/validationPipeline.js';
import { db } from '../supabase.js';

// ============================================
// 1️⃣ EXTRAIR E LIMPAR JID (número WhatsApp)
// ============================================

export const extrairTelefoneDoJid = (jid: string): string => {
  try {
    console.log(`\n📱 [EXTRACT JID] Processando JID...`);
    console.log(`   JID original: ${jid}`);

    let telefone = jid.split('@')[0];
    console.log(`   Após remover @: ${telefone}`);
    console.log(`   Comprimento: ${telefone.length} dígitos`);

    if (!telefone.startsWith('55')) {
      console.log(`   ⚠️  Não começa com 55`);
      
      if (telefone.length === 15) {
        console.log(`   ✅ Detectado: número nacional sem país (15 dígitos)`);
        telefone = `55${telefone}`;
        console.log(`   ✅ Adicionado 55: ${telefone}`);
      }
      else if (telefone.length === 10) {
        console.log(`   ✅ Detectado: número antigo (10 dígitos)`);
        telefone = `55${telefone}`;
        console.log(`   ✅ Adicionado 55: ${telefone}`);
      }
    }

    console.log(`   ✅ Telefone final: ${telefone}\n`);
    return telefone;
  } catch (error) {
    console.error('❌ Erro extrairTelefoneDoJid:', error);
    return jid;
  }
};

// ============================================
// 2️⃣ IDENTIFICAR TIPO DE CONVERSA
// ============================================

export const identificarTipoConversa = (mensagem: string): TipoConversa => {
  try {
    const msg = mensagem.toLowerCase().trim();

    // CONSULTAR
    if (
      msg.includes('qual é meu agendamento') ||
      msg.includes('qual meu agendamento') ||
      msg.includes('quando é meu') ||
      msg.includes('próximo agendamento') ||
      msg.includes('meu horário') ||
      msg.includes('que horas é') ||
      msg.includes('me mostra') ||
      msg.includes('consultar agendamento') ||
      msg.includes('ver agendamento') ||
      msg.includes('que dia tenho')
    ) {
      return 'consultar';
    }

    // CANCELAR
    if (
      msg.includes('cancelar') ||
      msg.includes('desmarcar') ||
      msg.includes('quero cancelar') ||
      msg.includes('preciso cancelar') ||
      msg.includes('cancelar meu') ||
      msg.includes('não vou mais')
    ) {
      return 'cancelar';
    }

    // REMARCAR
    if (
      msg.includes('remarcar') ||
      msg.includes('mudar de data') ||
      msg.includes('mudar horário') ||
      msg.includes('trocar de data') ||
      msg.includes('trocar horário') ||
      msg.includes('preciso remarcar') ||
      msg.includes('quer remarcar')
    ) {
      return 'remarcar';
    }

    // ATRASAR
    if (
      msg.includes('vou me atrasar') ||
      msg.includes('vou atrasar') ||
      msg.includes('atrasado') ||
      msg.includes('atraso de') ||
      msg.includes('minutos de atraso') ||
      msg.includes('vou chegar atrasado')
    ) {
      return 'atrasar';
    }

    // COMENTÁRIO
    if (
      msg.includes('observação') ||
      msg.includes('nota') ||
      msg.includes('comentário') ||
      msg.includes('pode deixar registrado') ||
      msg.includes('quer deixar uma nota')
    ) {
      return 'comentario';
    }

    // CONFIRMAÇÃO
    if (
      msg.includes('sim') ||
      msg.includes('pode') ||
      msg.includes('tá bom') ||
      msg.includes('ok') ||
      msg.includes('confirma') ||
      msg.includes('tá certo') ||
      msg.includes('certo')
    ) {
      return 'confirmacao';
    }

    // DEFAULT: AGENDAR
    return 'agendar';
  } catch (error) {
    console.error('❌ Erro identificarTipoConversa:', error);
    return 'agendar';
  }
};

// ============================================
// 3️⃣ MONTAR CONTEXTO COMPLETO
// ============================================

export const montarContextoConversa = async (
  mensagem: string,
  jid: string,
  companyId: string
): Promise<ConversationContext> => {
  try {
    console.log(`\n⚙️  [CONTEXT] Montando contexto...`);

    // 1. EXTRAIR TELEFONE
    const telefone = extrairTelefoneDoJid(jid);
    console.log(`   1️⃣ Telefone extraído: ${telefone}`);

    // 2. IDENTIFICAR TIPO DE CONVERSA
    const tipo = identificarTipoConversa(mensagem);
    console.log(`   2️⃣ Tipo de conversa: ${tipo}`);

    // 3. BUSCAR DADOS DO CLIENTE
    console.log(`   3️⃣ Buscando cliente no banco...`);
    const dadosCliente = await obterDadosClienteParaIA(telefone, companyId);
    console.log(`      Cliente existe: ${dadosCliente.existe}`);
    if (dadosCliente.existe) {
      console.log(`      Nome: ${dadosCliente.nome}`);
    }

    // 4. BUSCAR AGENDAMENTOS DO CLIENTE
    let agendamentos = [];
    if (dadosCliente.existe && dadosCliente.id) {
      console.log(`   4️⃣ Buscando agendamentos...`);
      agendamentos = await buscarAgendamentosCliente(dadosCliente.id, companyId);
      console.log(`      Total: ${agendamentos.length}`);
    }

    // 5. BUSCAR CONFIGURAÇÕES DA EMPRESA
    console.log(`   5️⃣ Buscando configurações da empresa...`);
    const [servicos, profissionais, config, agente] = await Promise.all([
      db.getServicos(companyId),
      db.getProfissionais(companyId),
      db.getConfiguracao(companyId),
      db.getAgenteConfig(companyId)
    ]);
    console.log(`      Serviços: ${servicos.length}`);
    console.log(`      Profissionais: ${profissionais.length}`);

    // 6. DATA E HORA ATUAL
    const agora = new Date();
    const horarioAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const dataAtual = agora.toISOString().split('T')[0]; // YYYY-MM-DD

    // 7. VERIFICAR SE É SOLO (1 único profissional)
    const eSolo = profissionais.length === 1;

    // 8. MONTAR CONTEXTO COMPLETO
    const contexto: ConversationContext = {
      // Identificação
      companyId,
      jid: telefone,

      // Cliente
      cliente: {
        id: dadosCliente.id,
        nome: dadosCliente.nome,
        telefone: dadosCliente.telefone,
        existe: dadosCliente.existe
      },

      // Tipo de conversa
      tipo,

      // Dados da empresa
      nomeAgente: agente?.nome_agente || 'Atendente',
      nomeLoja: config?.nome_estabelecimento || 'Nossa Loja',
      promptBase: agente?.prompt || 'Seja prestativo e cordial.',

      // Serviços e profissionais
      servicos: servicos.map((s: any) => ({
        id: s.id,
        nome: s.nome,
        duracao: s.duracao || 30,
        preco: s.preco || 0
      })),
      profissionais: profissionais.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        especialidade: p.especialidade || ''
      })),
      eSolo,

      // Agendamentos do cliente
      agendamentos: agendamentos.map((a: any) => ({
        id: a.id,
        servico: a.servico,
        profissional: a.profissional,
        data: a.data,
        hora: a.hora,
        status: a.status,
        observacao: a.observacao
      })),

      // Contexto atual da conversa
      mensagem,
      dadosColetados: {},

      // Data/hora
      horarioAtual,
      dataAtual,
      timezone: 'America/Sao_Paulo'
    };

    console.log(`✅ Contexto montado para ${tipo}: ${telefone}\n`);
    return contexto;
  } catch (error) {
    console.error('❌ Erro montarContextoConversa:', error);
    throw error;
  }
};

// ============================================
// 3️⃣B EXTRAIR DADOS DA MENSAGEM (✅ CORRIGIDO!)
// ============================================

export const extrairDadosMensagem = async (
  mensagem: string,
  contexto: ConversationContext
) => {
  try {
    console.log(`\n📊 Extraindo dados da mensagem...`);
    
    // ✅ CHAMA A FUNÇÃO IMPORTADA (renomeada para evitar conflito)
    const dadosExtraidos = await extrairDadosDoTexto(mensagem, contexto);

    return dadosExtraidos;
  } catch (error) {
    console.error('❌ Erro ao extrair dados:', error);
    return {
      servico: null,
      data: null,
      hora: null,
      profissional: null,
      nome: null,
      periodo: null
    };
  }
};

// ============================================
// 3️⃣C VALIDAR E ENRIQUECER DADOS (NOVO!)
// ============================================

export const validarDadosExtraidos = async (
  dadosExtraidos: any,
  contexto: ConversationContext
) => {
  try {
    console.log(`\n🔍 Validando dados extraídos...`);
    
    const dadosValidados = await validarEEnriquecerContexto(
      dadosExtraidos,
      contexto
    );

    return dadosValidados;
  } catch (error) {
    console.error('❌ Erro validarDadosExtraidos:', error);
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

// ============================================
// 4️⃣ PREPARAR DADOS PARA IA
// ============================================

export const prepararDadosParaIA = (contexto: ConversationContext, dadosValidados: any) => {
  try {
    console.log(`\n📊 [PREPARE] Preparando dados para IA...`);

    const resumo = {
      // IDENTIFICAÇÃO
      companyId: contexto.companyId,
      jid: contexto.jid,
      tipoConversa: contexto.tipo,

      // CLIENTE
      clienteNome: contexto.cliente.nome || 'Cliente',
      clienteExiste: contexto.cliente.existe,
      clienteTelefone: contexto.jid,
      clienteId: contexto.cliente.id,

      // EMPRESA
      nomeAgente: contexto.nomeAgente,
      nomeLoja: contexto.nomeLoja,
      promptBase: contexto.promptBase,

      // SERVIÇOS (lista simples)
      servicos: contexto.servicos.map(s => `${s.nome} (${s.duracao}min - R$${s.preco})`),
      profissionaisLista: contexto.profissionais.map(p => p.nome).join(', '),
      eSolo: contexto.eSolo,

      // AGENDAMENTOS DO CLIENTE
      temAgendamentos: contexto.agendamentos.length > 0,
      agendamentosProximos: contexto.agendamentos.length > 0 
        ? contexto.agendamentos.slice(0, 3).map(a => 
            `${a.servico} - ${a.data} às ${a.hora} com ${a.profissional}`
          )
        : [],

      // DATA/HORA
      dataAtual: contexto.dataAtual,
      horarioAtual: contexto.horarioAtual,

      // MENSAGEM DO CLIENTE
      mensagem: contexto.mensagem,

      // DADOS EXTRAÍDOS E VALIDADOS
      dadosExtraidos: dadosValidados
    };

    console.log(`✅ Dados preparados: ${contexto.tipo}\n`);
    return resumo;
  } catch (error) {
    console.error('❌ Erro prepararDadosParaIA:', error);
    return {};
  }
};
