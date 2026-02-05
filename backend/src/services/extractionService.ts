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
): Promise<{ horarios: string[], periodosEstruturados?: any }> => {
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
      periodosEstruturados: resultado.periodos
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
  profissionalNome: string,
  data: string,
  profissionais: any[] // ✅ ADICIONADO
): Promise<string[]> => {
  try {
    console.log(`\n📊 [PERÍODOS] Verificando disponibilidade...`);

    const periodosDisponiveis: string[] = [];

    // Verificar manhã
    const resManha = await buscarHorariosDisponiveis(companyId, profissionalNome, data, profissionais, 'manhã');
    if (resManha.horarios.length > 0) {
      periodosDisponiveis.push('manhã');
    }

    // Verificar tarde
    const resTarde = await buscarHorariosDisponiveis(companyId, profissionalNome, data, profissionais, 'tarde');
    if (resTarde.horarios.length > 0) {
      periodosDisponiveis.push('tarde');
    }

    // Verificar noite
    const resNoite = await buscarHorariosDisponiveis(companyId, profissionalNome, data, profissionais, 'noite');
    if (resNoite.horarios.length > 0) {
      periodosDisponiveis.push('noite');
    }

    console.log(`   ✅ Períodos com vaga: ${periodosDisponiveis.join(', ') || 'nenhum'}`);

    return periodosDisponiveis;

  } catch (error) {
    console.error('❌ Erro ao verificar períodos disponíveis:', error);
    return [];
  }
};

// RELAÇÃO DE PERÍODOS E HORÁRIOS PARA IA
export const MAPA_PERIODOS = {
  'manhã': '08:00 às 12:00',
  'tarde': '12:00 às 18:00',
  'noite': '18:00 às 22:00'
};

// ============================================
// EXTRAIR SERVIÇO
// ============================================

const extrairServico = async (
  mensagem: string,
  contexto: ConversationContext
): Promise<string | null> => {
  const msgLower = mensagem.toLowerCase();

  console.log(`   🔎 Procurando sinônimos...`);

  // Tentar encontrar por sinônimos
  for (const [categoria, sinonimos] of Object.entries(SINONIMOS_SERVICOS)) {
    for (const sinonimo of sinonimos) {
      if (msgLower.includes(sinonimo)) {
        console.log(`   ✅ Sinônimo encontrado: "${sinonimo}" (categoria: ${categoria})`);

        // Buscar serviço correspondente no banco
        const servicoEncontrado = contexto.servicos.find(s =>
          s.nome.toLowerCase().includes(categoria)
        );

        if (servicoEncontrado) {
          return servicoEncontrado.nome;
        }
      }
    }
  }

  // Tentar match direto com serviços cadastrados
  for (const servico of contexto.servicos) {
    if (msgLower.includes(servico.nome.toLowerCase())) {
      return servico.nome;
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
  const [anoH, mesH, diaH] = contexto.dataAtual.split('-').map(Number);
  const hoje = new Date(anoH, mesH - 1, diaH);

  // Hoje
  if (msgLower.match(/\bhoje\b/)) {
    return contexto.dataAtual;
  }

  // Amanhã
  if (msgLower.match(/\bamanhã\b|amanha/)) {
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const ano = amanha.getFullYear();
    const mes = String(amanha.getMonth() + 1).padStart(2, '0');
    const dia = String(amanha.getDate()).padStart(2, '0');
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
    if (dadosAcumulados.data) { // REMOVIDO: && dadosAcumulados.profissional

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
            const amanha = new Date(agora);
            amanha.setDate(amanha.getDate() + 1);
            const [diaA, mesA, anoA] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(amanha).split('/');
            const amanhaStr = `${anoA}-${mesA}-${diaA}`;

            console.log(`   ⚠️ Hoje (${hojeStr}) já esgotado ou fechado. Pulando para amanhã (${amanhaStr})...`);
            dadosAcumulados.data = amanhaStr;
            dadosAcumulados.puloParaAmanha = true;
          } else {
            dadosAcumulados.puloParaAmanha = false;
          }
        } else {
          dadosAcumulados.puloParaAmanha = false;
        }

        // Buscar horários disponíveis (seja hoje ou amanhã pulado)
        const resultadoBusca = await buscarHorariosDisponiveis(
          contexto.companyId,
          dadosAcumulados.profissional,
          dadosAcumulados.data,
          contexto.profissionais,
          dadosAcumulados.periodo
        );
        dadosAcumulados.horariosDisponiveis = resultadoBusca.horarios;

        if (resultadoBusca.periodosEstruturados) {
          dadosAcumulados.horariosPorPeriodo = resultadoBusca.periodosEstruturados;
        }

        dadosAcumulados.periodosDisponiveis = await verificarPeriodosDisponiveis(
          contexto.companyId,
          dadosAcumulados.profissional,
          dadosAcumulados.data,
          contexto.profissionais
        );
      }
      // Se NÃO temos profissional, mas temos data HOJE, verifica geral
      else if (dadosAcumulados.data === hojeStr) {
        // Importar verificação geral (ou usar lógica simplificada de períodos)
        const { determinarPeriodosDisponiveis } = await import('./validationService.js');
        const [horaA, minA] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(agora).split(':');

        const periodosHoje = await determinarPeriodosDisponiveis(
          contexto.companyId,
          hojeStr,
          hojeStr,
          `${horaA}:${minA}`
        );

        if (periodosHoje.periodos.length === 0) {
          const amanha = new Date(agora);
          amanha.setDate(amanha.getDate() + 1);
          const [diaA, mesA, anoA] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(amanha).split('/');
          const amanhaStr = `${anoA}-${mesA}-${diaA}`;

          console.log(`   ⚠️ Hoje (${hojeStr}) geral já esgotado. Pulando para amanhã (${amanhaStr})...`);
          dadosAcumulados.data = amanhaStr;
          dadosAcumulados.puloParaAmanha = true;
        } else {
          dadosAcumulados.puloParaAmanha = false;
        }
      } else {
        // Data futura sem profissional
        dadosAcumulados.puloParaAmanha = false;
      }
    }

    // ✅ SALVAR NA MEMÓRIA
    dadosConversaMemoria[memKey] = dadosAcumulados;

    console.log(`\n📊 [EXTRACTION] Dados extraídos (acumulados):`)
    console.log(`   Serviço: ${dadosAcumulados.servico || 'IA vai resolver'}`);
    console.log(`   Data: ${dadosAcumulados.data || 'IA vai perguntar'}`);
    console.log(`   Horário: ${dadosAcumulados.hora || 'IA vai perguntar'}`);
    console.log(`   Período: ${dadosAcumulados.periodo || 'não informado'}`);
    console.log(`   Profissional: ${dadosAcumulados.profissional || 'IA vai resolver'}`);
    console.log(`   Nome: ${dadosAcumulados.nome || 'IA vai perguntar'}`);
    console.log(`   Horários disponíveis: ${dadosAcumulados.horariosDisponiveis?.length || 0}`);
    console.log(`   Períodos disponíveis: ${dadosAcumulados.periodosDisponiveis?.join(', ') || 'nenhum'}`);

    return dadosAcumulados;

  } catch (error) {
    console.error('❌ Erro extrairDadosMensagem:', error);
    return {
      servico: null,
      data: null,
      hora: null,
      periodo: null,
      profissional: null,
      nome: null,
      horariosDisponiveis: [],
      periodosDisponiveis: []
    };
  }
};

// ============================================
// ✅ LIMPAR MEMÓRIA (chamar após confirmar agendamento)
// ============================================

export const limparDadosConversaMemoria = (companyId: string, jid: string) => {
  const memKey = `${companyId}_${jid}`;
  if (dadosConversaMemoria[memKey]) {
    delete dadosConversaMemoria[memKey];
    console.log(`🗑️ [EXTRACTION] Memória de conversa limpa: ${memKey}`);
  }
};

// ============================================
// STATUS DA MEMÓRIA (debug)
// ============================================

export const getStatusMemoriaExtracao = () => {
  return {
    totalConversas: Object.keys(dadosConversaMemoria).length,
    conversas: Object.keys(dadosConversaMemoria)
  };
};
