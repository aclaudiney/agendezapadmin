/**
 * EXTRACTION SERVICE - AGENDEZAP
 * Extrai dados das mensagens do cliente (serviço, data, hora, etc)
 * 
 * ✅ CORRIGIDO: Mantém contexto da conversa (não esquece dados anteriores)
 * ✅ NOVO: Busca horários disponíveis no banco
 * ✅ NOVO: Filtra horários que já passaram (hora atual)
 */

import { ConversationContext } from '../types/conversation.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ MEMÓRIA DE DADOS EXTRAÍDOS POR USUÁRIO
const dadosConversaMemoria: Record<string, any> = {};

// ============================================
// ✅ NOVO: SALVAR CONTEXTO MANUALMENTE
// ============================================
export const salvarContextoConversa = (
  companyId: string,
  jid: string,
  dados: any
) => {
  const memKey = `${companyId}_${jid}`;
  // Manter dados anteriores se não vierem no novo objeto
  const anteriores = dadosConversaMemoria[memKey] || {};
  
  dadosConversaMemoria[memKey] = {
    ...anteriores,
    ...dados
  };
  
  console.log(`💾 [MEMORY] Contexto atualizado manualmente para ${memKey}`);
};

// ============================================
// SINÔNIMOS DE SERVIÇOS
// ============================================

const SINONIMOS_SERVICOS: Record<string, string[]> = {
  'cabelo': ['cabelo', 'cortar', 'corta', 'corte', 'cortado', 'aparar', 'apara'],
  'barba': ['barba', 'barbear', 'barbeiro', 'aparar barba', 'fazer barba'],
  'pele': ['pele', 'limpeza de pele', 'tratamento', 'facial', 'skincare'],
  'combo': ['combo', 'tudo', 'completo', 'pacote', 'cabelo e barba']
};

// ============================================
// ✅ NOVO: BUSCAR HORÁRIOS DISPONÍVEIS
// ============================================

const buscarHorariosDisponiveis = async (
  companyId: string,
  profissionalNome: string,
  data: string,
  profissionais: any[], // ✅ ADICIONADO
  periodo?: string
): Promise<{ horarios: string[], periodosEstruturados?: any, status?: string, motivo?: string }> => {
  try {
    console.log(`\n🕐 [HORÁRIOS] Buscando disponibilidade...`);
    console.log(`   Company: ${companyId}`);
    console.log(`   Profissional: ${profissionalNome}`);
    console.log(`   Data: ${data}`);
    console.log(`   Período: ${periodo || 'todos'}`);

    // Importar nova função
    const { buscarHorariosLivresPorProfissional } = await import('./appointmentService.js');

    // Buscar profissional
    const profissional = profissionais.find((p: any) =>
      p.nome.toLowerCase().includes(profissionalNome.toLowerCase())
    );

    if (!profissional) {
      console.log(`   ❌ Profissional não encontrado: ${profissionalNome}`);
      return { horarios: [] };
    }

    // Buscar horários com a nova função (já filtra passados e separa por período)
    const resultado = await buscarHorariosLivresPorProfissional(
      companyId,
      profissional.id,
      data,
      30 // duração padrão
    );

    // ✅ VERIFICAR SE ESTÁ FECHADO
    if (resultado.status === 'fechado') {
        console.log(`   🚫 Dia fechado: ${resultado.motivo}`);
        return { 
            horarios: [], 
            status: 'fechado', 
            motivo: resultado.motivo 
        };
    }

    // Filtrar por período se especificado
    let horariosRetorno: string[] = [];
    if (periodo === 'manhã') {
      horariosRetorno = resultado.periodos.manha;
    } else if (periodo === 'tarde') {
      horariosRetorno = resultado.periodos.tarde;
    } else if (periodo === 'noite') {
      horariosRetorno = resultado.periodos.noite;
    } else {
      horariosRetorno = resultado.horarios; // Todos os horários
    }

    console.log(`   ✅ ${horariosRetorno.length} horários disponíveis`);
    return {
      horarios: horariosRetorno,
      periodosEstruturados: resultado.periodos,
      status: 'aberto'
    };

  } catch (error) {
    console.error('❌ Erro buscarHorariosDisponiveis:', error);
    return { horarios: [] };
  }
};


// ============================================
// ✅ NOVO: VERIFICAR PERÍODOS DISPONÍVEIS
// ============================================

const verificarPeriodosDisponiveis = async (
  companyId: string,
  data: string,
  profissionais: any[]
): Promise<string[]> => {
  try {
    console.log(`\n📅 [PERIODOS] Verificando períodos disponíveis para ${data}...`);

    // Importar nova função de busca geral
    const { buscarHorariosLivresGeral } = await import('./appointmentService.js');

    const resultado = await buscarHorariosLivresGeral(
      companyId,
      data,
      30
    );

    const periodosLivres: string[] = [];
    if (resultado.periodosUnificados.manha.length > 0) periodosLivres.push('manhã');
    if (resultado.periodosUnificados.tarde.length > 0) periodosLivres.push('tarde');
    if (resultado.periodosUnificados.noite.length > 0) periodosLivres.push('noite');

    console.log(`   ✅ Períodos livres: ${periodosLivres.join(', ')}`);
    return periodosLivres;
  } catch (error) {
    console.error('❌ Erro verificarPeriodosDisponiveis:', error);
    return [];
  }
};


// ============================================
// EXTRAIR SERVIÇO
// ============================================

const extrairServico = async (
  mensagem: string,
  contexto: ConversationContext
): Promise<string | null> => {
  const msgLower = mensagem.toLowerCase();

  // 1. Verificar match exato com serviços do banco
  for (const servico of contexto.servicos) {
    if (msgLower.includes(servico.nome.toLowerCase())) {
      return servico.nome;
    }
  }

  // 2. Verificar sinônimos (hardcoded por enquanto)
  for (const [chave, sinonimos] of Object.entries(SINONIMOS_SERVICOS)) {
    if (sinonimos.some(s => msgLower.includes(s))) {
      // Tentar encontrar o serviço correspondente no banco
      const servicoBanco = contexto.servicos.find(s => 
        s.nome.toLowerCase().includes(chave)
      );
      if (servicoBanco) return servicoBanco.nome;
    }
  }

  return null;
};

// ============================================
// EXTRAIR DATA
// ============================================

const extrairData = (
  mensagem: string,
  contexto: ConversationContext
): string | null => {
  const msgLower = mensagem.toLowerCase();
  const hoje = new Date();
  
  // Hoje
  if (msgLower.match(/\bhoje\b/)) {
    console.log(`   ✅ Data extraída: hoje (${contexto.dataAtual})`);
    return contexto.dataAtual;
  }

  // Amanhã
  if (msgLower.match(/\bamanhã\b|amanha/)) {
    const amanha = new Date();
    // Ajustar para America/Sao_Paulo antes de adicionar um dia
    const dataLocal = new Date(amanha.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    dataLocal.setDate(dataLocal.getDate() + 1);

    const ano = dataLocal.getFullYear();
    const mes = String(dataLocal.getMonth() + 1).padStart(2, '0');
    const dia = String(dataLocal.getDate()).padStart(2, '0');
    console.log(`   ✅ Data extraída: amanhã (${ano}-${mes}-${dia})`);
    return `${ano}-${mes}-${dia}`;
  }

  // Dia específico (ex: dia 15, dia 20)
  const matchDia = msgLower.match(/\bdia\s+(\d{1,2})\b/);
  if (matchDia) {
    const diaAlvo = parseInt(matchDia[1]);
    if (diaAlvo >= 1 && diaAlvo <= 31) {
      const [anoH, mesH, diaH] = contexto.dataAtual.split('-').map(Number);
      let mes = mesH;
      let ano = anoH;

      // Se o dia já passou este mês, assumir mês que vem
      if (diaAlvo < diaH) {
        mes++;
        if (mes > 12) {
          mes = 1;
          ano++;
        }
      }

      const diaStr = String(diaAlvo).padStart(2, '0');
      const mesStr = String(mes).padStart(2, '0');
      return `${ano}-${mesStr}-${diaStr}`;
    }
  }

  // Data no formato DD/MM ou DD/MM/YYYY
  const matchData = msgLower.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (matchData) {
    const dia = parseInt(matchData[1]);
    const mes = parseInt(matchData[2]);
    let ano = matchData[3] ? parseInt(matchData[3]) : hoje.getFullYear();

    if (ano < 100) ano += 2000;

    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      const diaStr = String(dia).padStart(2, '0');
      const mesStr = String(mes).padStart(2, '0');
      return `${ano}-${mesStr}-${diaStr}`;
    }
  }

  return null;
};

// ============================================
// EXTRAIR HORA
// ============================================

const extrairHora = (mensagem: string): string | null => {
  const msgLower = mensagem.toLowerCase();

  // 1️⃣ Padrões prioritários (indicam o horário DESEJADO)
  // Permite palavras entre o verbo e o horário (ex: "marcar pra mim as 11")
  const patternsPrioritarios = [
    /\b(?:para|pro|pode\s+ser|marcar|mudar|agendar)(?:[^0-9]*?)(?:as\s+)?(?:horario\s+das\s+)?(\d{1,2})(?::(\d{2}))?\b/i,
    /\bas\s+(\d{1,2})(?::(\d{2}))?\b/i
  ];

  for (const pattern of patternsPrioritarios) {
    const match = msgLower.match(pattern);
    if (match) {
      const hora = parseInt(match[1]);
      const minuto = match[2] ? parseInt(match[2]) : 0;
      if (hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59) {
        return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
      }
    }
  }

  // 2️⃣ Fallback: Pegar o ÚLTIMO horário mencionado (geralmente o destino em "de X para Y")
  const allMatches = Array.from(msgLower.matchAll(/\b(\d{1,2})(?::(\d{2}))?\b/g));
  if (allMatches.length > 0) {
    const lastMatch = allMatches[allMatches.length - 1];
    const hora = parseInt(lastMatch[1]);
    const minuto = lastMatch[2] ? parseInt(lastMatch[2]) : 0;

    if (hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59) {
      return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
    }
  }

  return null;
};

// ============================================
// EXTRAIR PROFISSIONAL
// ============================================

const extrairProfissional = (
  mensagem: string,
  contexto: ConversationContext
): string | null => {
  const msgLower = mensagem.toLowerCase();

  for (const prof of contexto.profissionais) {
    const nomeLower = prof.nome.toLowerCase();

    // Match exato ou parcial
    if (msgLower.includes(nomeLower)) {
      return prof.nome;
    }

    // Variações (ex: "com João" → "João")
    const patterns = [
      new RegExp(`\\bcom\\s+${nomeLower}\\b`),
      new RegExp(`\\b${nomeLower}\\b`)
    ];

    for (const pattern of patterns) {
      if (pattern.test(msgLower)) {
        return prof.nome;
      }
    }
  }

  return null;
};

// ============================================
// EXTRAIR NOME
// ============================================

const extrairNome = (mensagem: string): string | null => {
  // Padrões que indicam nome completo
  const patterns = [
    /(?:me chamo|sou|meu nome é|nome:?)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)+)/i,
    /^([A-ZÀ-Ÿ][a-zà-ÿ]+\s+[A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)$/
  ];

  for (const pattern of patterns) {
    const match = mensagem.match(pattern);
    if (match && match[1]) {
      const nome = match[1].trim();
      // Verificar se tem pelo menos nome e sobrenome
      if (nome.split(' ').length >= 2) {
        return nome;
      }
    }
  }

  return null;
};

// ============================================
// EXTRAIR PERÍODO
// ============================================

const extrairPeriodo = (mensagem: string): string | null => {
  const msgLower = mensagem.toLowerCase();

  if (msgLower.match(/\bmanhã\b|matinal|matutino|de manhã/)) {
    return 'manhã';
  }

  if (msgLower.match(/\btarde\b|vespertino|de tarde/)) {
    return 'tarde';
  }

  if (msgLower.match(/\bnoite\b|noturno|de noite/)) {
    return 'noite';
  }

  return null;
};

// ============================================
// ✅ FUNÇÃO PRINCIPAL: EXTRAIR DADOS (COM MEMÓRIA + HORÁRIOS!)
// ============================================

export const extrairDadosMensagem = async (
  mensagem: string,
  contexto: ConversationContext
): Promise<any> => {
  try {
    console.log(`\n📊 [EXTRACTION] Extraindo dados da mensagem...`);
    console.log(`   Mensagem: "${mensagem}"`);

    // ✅ CHAVE ÚNICA POR USUÁRIO
    const memKey = `${contexto.companyId}_${contexto.jid}`;

    // ✅ RECUPERAR DADOS ANTERIORES (se existir)
    let dadosAcumulados = dadosConversaMemoria[memKey] || {
      servico: null,
      data: null,
      hora: null,
      periodo: null,
      profissional: null,
      nome: null,
      horariosDisponiveis: [],
      periodosDisponiveis: []
    };

    // Mostrar dados anteriores (se tiver)
    const temDadosAnteriores = Object.values(dadosAcumulados).some(v =>
      v !== null && (Array.isArray(v) ? v.length > 0 : true)
    );

    if (temDadosAnteriores) {
      console.log(`\n   📝 Dados anteriores da conversa:`);
      if (dadosAcumulados.servico) console.log(`      Serviço: ${dadosAcumulados.servico}`);
      if (dadosAcumulados.data) console.log(`      Data: ${dadosAcumulados.data}`);
      if (dadosAcumulados.hora) console.log(`      Hora: ${dadosAcumulados.hora}`);
      if (dadosAcumulados.profissional) console.log(`      Profissional: ${dadosAcumulados.profissional}`);
      if (dadosAcumulados.nome) console.log(`      Nome: ${dadosAcumulados.nome}`);
      if (dadosAcumulados.periodo) console.log(`      Período: ${dadosAcumulados.periodo}`);
    }

    // EXTRAIR SERVIÇO
    if (!dadosAcumulados.servico) {
      console.log(`\n   🔍 Procurando serviço...`);
      console.log(`      Disponíveis: ${contexto.servicos.map(s => s.nome).join(', ')}`);

      const servicoEncontrado = await extrairServico(mensagem, contexto);
      if (servicoEncontrado) {
        dadosAcumulados.servico = servicoEncontrado;
        console.log(`   ✅ Serviço encontrado: ${servicoEncontrado}`);
      } else {
        console.log(`   ⚠️ Serviço não encontrado na extração`);
      }
    }

    // EXTRAIR DATA
    const dataExtraida = extrairData(mensagem, contexto);
    if (dataExtraida) {
      dadosAcumulados.data = dataExtraida;
      console.log(`   ✅ Data atualizada: ${dataExtraida}`);
    }

    // EXTRAIR HORA
    const horaExtraida = extrairHora(mensagem);
    if (horaExtraida) {
      dadosAcumulados.hora = horaExtraida;
      console.log(`   ✅ Horário atualizado: ${horaExtraida}`);
    }

    // EXTRAIR PROFISSIONAL
    if (!dadosAcumulados.profissional) {
      console.log(`   🔍 Procurando profissional...`);
      const profissionalEncontrado = extrairProfissional(mensagem, contexto);
      if (profissionalEncontrado) {
        dadosAcumulados.profissional = profissionalEncontrado;
      }
    }

    // Se não tem profissional, usar o único disponível (solo)
    if (!dadosAcumulados.profissional && contexto.profissionais.length === 1) {
      dadosAcumulados.profissional = contexto.profissionais[0].nome;
      console.log(`   ✅ Profissional único: ${dadosAcumulados.profissional}`);
    }

    // EXTRAIR NOME
    if (!dadosAcumulados.nome) {
      const nomeExtraido = extrairNome(mensagem);
      if (nomeExtraido) {
        dadosAcumulados.nome = nomeExtraido;
        console.log(`   ✅ Nome extraído: ${nomeExtraido}`);
      }
    }

    // EXTRAIR PERÍODO
    const periodoExtraido = extrairPeriodo(mensagem);
    if (periodoExtraido) {
      dadosAcumulados.periodo = periodoExtraido;
      console.log(`   ✅ Período extraído: ${periodoExtraido}`);
    }

    // ✅ BUSCAR HORÁRIOS DISPONÍVEIS (se tiver data)
    if (dadosAcumulados.data) { 

      // 🔄 AJUSTE: Se a data for HOJE e já passou do horário de funcionamento, sugerir AMANHÃ
      const agora = new Date();
      const [diaH, mesH, anoH] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora).split('/');
      const hojeStr = `${anoH}-${mesH}-${diaH}`;

      // Se temos profissional, podemos verificar horários exatos
      if (dadosAcumulados.profissional) {
        if (dadosAcumulados.data === hojeStr) {
          const resHoje = await buscarHorariosDisponiveis(
            contexto.companyId,
            dadosAcumulados.profissional,
            dadosAcumulados.data,
            contexto.profissionais
          );

          // Se hoje não tem mais nada, pula para amanhã automaticamente
          if (resHoje.horarios.length === 0) {
            console.log(`   ⚠️ Hoje está esgotado. Verificando amanhã...`);
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            const [diaA, mesA, anoA] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(amanha).split('/');
            const amanhaStr = `${anoA}-${mesA}-${diaA}`;
            
            // Só pula se a mensagem não foi explícita sobre "hoje"
            // Se o usuário disse "hoje", devemos retornar vazio mesmo para ele saber que não tem
            if (!mensagem.toLowerCase().includes('hoje')) {
                dadosAcumulados.data = amanhaStr;
                dadosAcumulados.puloParaAmanha = true; // Flag para avisar usuário
                console.log(`   ✅ Pulo automático para amanhã: ${amanhaStr}`);
            }
          }
        }

        const res = await buscarHorariosDisponiveis(
          contexto.companyId,
          dadosAcumulados.profissional,
          dadosAcumulados.data,
          contexto.profissionais,
          dadosAcumulados.periodo
        );
        dadosAcumulados.horariosDisponiveis = res.horarios;
        if (res.periodosEstruturados) {
            dadosAcumulados.horariosPorPeriodo = res.periodosEstruturados;
        }

        // ✅ SE FECHADO, REGISTRAR VALIDAÇÃO
        if (res.status === 'fechado') {
             dadosAcumulados.validacoes = {
                 ...(dadosAcumulados.validacoes || {}),
                 diaAberto: false,
                 motivoErro: res.motivo
             };
        }
      } 
      // Se não temos profissional, verificamos períodos gerais
      else {
        const periodosLivres = await verificarPeriodosDisponiveis(
          contexto.companyId,
          dadosAcumulados.data,
          contexto.profissionais
        );
        dadosAcumulados.periodosDisponiveis = periodosLivres;
        
        // Também buscar horários gerais (sem filtro de profissional) para adiantar
        // Isso ajuda se o usuário já disse horário mas não profissional
        if (dadosAcumulados.hora) {
            // Se já tem hora, vamos validar se ela existe em algum profissional
            // Mas isso é feito na validação. Aqui só extraímos.
        }
      }
    }

    // ✅ ATUALIZAR MEMÓRIA
    dadosConversaMemoria[memKey] = dadosAcumulados;

    return dadosAcumulados;

  } catch (error) {
    console.error('❌ Erro extrairDadosMensagem:', error);
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
