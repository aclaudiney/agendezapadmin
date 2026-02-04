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
  periodo?: string
): Promise<string[]> => {
  try {
    console.log(`\n🕐 [HORÁRIOS] Buscando disponibilidade...`);
    console.log(`   Company: ${companyId}`);
    console.log(`   Profissional: ${profissionalNome}`);
    console.log(`   Data: ${data}`);
    console.log(`   Período: ${periodo || 'todos'}`);

    // ✅ CORREÇÃO: Adicionando a query que estava faltando
    // 1️⃣ BUSCAR HORÁRIO DE FUNCIONAMENTO DA EMPRESA
    const { data: config, error: configError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (configError || !config) {
      console.log(`   ❌ Erro ao buscar config: ${configError?.message}`);
      return [];
    }

    // Determinar dia da semana
    const dataObj = new Date(data + 'T00:00:00');
    const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const diaSemana = diasSemana[dataObj.getDay()];

    console.log(`   📅 Dia da semana: ${diaSemana}`);

    // Buscar horários do dia
    const horarios = config.horarios_funcionamento?.[diaSemana];
    
    if (!horarios || !horarios.aberto) {
      console.log(`   ❌ Empresa fechada neste dia`);
      return [];
    }

    const { inicio, fim } = horarios;
    console.log(`   ⏰ Horário funcionamento: ${inicio} - ${fim}`);

    // 2️⃣ GERAR TODOS OS HORÁRIOS POSSÍVEIS (30 em 30 min)
    const todosHorarios: string[] = [];
    let [horaInicio, minInicio] = inicio.split(':').map(Number);
    const [horaFim, minFim] = fim.split(':').map(Number);

    let horaAtual = horaInicio;
    let minAtual = minInicio;

    while (horaAtual < horaFim || (horaAtual === horaFim && minAtual < minFim)) {
      const horaStr = String(horaAtual).padStart(2, '0');
      const minStr = String(minAtual).padStart(2, '0');
      todosHorarios.push(`${horaStr}:${minStr}`);

      minAtual += 30;
      if (minAtual >= 60) {
        minAtual = 0;
        horaAtual++;
      }
    }

    console.log(`   ✅ Horários base gerados: ${todosHorarios.length}`);

    // 3️⃣ FILTRAR POR PERÍODO (se fornecido)
    let horariosFiltrados = todosHorarios;

    if (periodo) {
      horariosFiltrados = todosHorarios.filter(h => {
        const [hora] = h.split(':').map(Number);
        
        if (periodo === 'manhã') return hora >= 6 && hora < 12;
        if (periodo === 'tarde') return hora >= 12 && hora < 18;
        if (periodo === 'noite') return hora >= 18 && hora <= 23;
        
        return true;
      });

      console.log(`   🕐 Filtrado por ${periodo}: ${horariosFiltrados.length} horários`);
    }

    // 4️⃣ SE FOR HOJE, FILTRAR HORÁRIOS QUE JÁ PASSARAM
    const hoje = new Date().toISOString().split('T')[0];
    
    if (data === hoje) {
      const agora = new Date();
      const horaAtualNum = agora.getHours();
      const minAtualNum = agora.getMinutes();

      horariosFiltrados = horariosFiltrados.filter(h => {
        const [hora, min] = h.split(':').map(Number);
        
        // Só incluir se for pelo menos 1h depois da hora atual
        if (hora > horaAtualNum + 1) return true;
        if (hora === horaAtualNum + 1 && min >= minAtualNum) return true;
        
        return false;
      });

      console.log(`   ⏰ Filtrado por hora atual (${horaAtualNum}:${minAtualNum}): ${horariosFiltrados.length} horários`);
    }

    // 5️⃣ BUSCAR AGENDAMENTOS JÁ EXISTENTES
    const { data: agendamentos, error: agendError } = await supabase
      .from('appointments')
      .select('horario')
      .eq('company_id', companyId)
      .eq('data', data)
      .eq('profissional', profissionalNome)
      .in('status', ['confirmado', 'pendente']);

    if (agendError) {
      console.log(`   ⚠️ Erro ao buscar agendamentos: ${agendError.message}`);
    }

    const horariosOcupados = agendamentos?.map(a => a.horario) || [];
    console.log(`   📌 Horários ocupados: ${horariosOcupados.length}`);

    // 6️⃣ FILTRAR HORÁRIOS OCUPADOS
    const horariosLivres = horariosFiltrados.filter(h => !horariosOcupados.includes(h));

    console.log(`   ✅ Horários disponíveis: ${horariosLivres.length}`);
    console.log(`   Lista: ${horariosLivres.join(', ')}`);

    return horariosLivres;

  } catch (error) {
    console.error('❌ Erro ao buscar horários disponíveis:', error);
    return [];
  }
};

// ============================================
// ✅ NOVO: VERIFICAR PERÍODOS DISPONÍVEIS
// ============================================

const verificarPeriodosDisponiveis = async (
  companyId: string,
  profissionalNome: string,
  data: string
): Promise<string[]> => {
  try {
    console.log(`\n📊 [PERÍODOS] Verificando disponibilidade...`);

    const periodosDisponiveis: string[] = [];

    // Verificar manhã
    const horariosManha = await buscarHorariosDisponiveis(companyId, profissionalNome, data, 'manhã');
    if (horariosManha.length > 0) {
      periodosDisponiveis.push('manhã');
    }

    // Verificar tarde
    const horariosTarde = await buscarHorariosDisponiveis(companyId, profissionalNome, data, 'tarde');
    if (horariosTarde.length > 0) {
      periodosDisponiveis.push('tarde');
    }

    // Verificar noite
    const horariosNoite = await buscarHorariosDisponiveis(companyId, profissionalNome, data, 'noite');
    if (horariosNoite.length > 0) {
      periodosDisponiveis.push('noite');
    }

    console.log(`   ✅ Períodos com vaga: ${periodosDisponiveis.join(', ') || 'nenhum'}`);

    return periodosDisponiveis;

  } catch (error) {
    console.error('❌ Erro ao verificar períodos disponíveis:', error);
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
  const hoje = new Date(contexto.dataAtual);
  
  // Hoje
  if (msgLower.match(/\bhoje\b/)) {
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    console.log(`   ✅ Data extraída: hoje (${ano}-${mes}-${dia})`);
    return `${ano}-${mes}-${dia}`;
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
    const dia = parseInt(matchDia[1]);
    if (dia >= 1 && dia <= 31) {
      let mes = hoje.getMonth() + 1;
      let ano = hoje.getFullYear();
      
      // Se o dia já passou este mês, assumir mês que vem
      if (dia < hoje.getDate()) {
        mes++;
        if (mes > 12) {
          mes = 1;
          ano++;
        }
      }
      
      const diaStr = String(dia).padStart(2, '0');
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
  
  // Formato HH:MM ou HH
  const match = msgLower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:h|hs|horas?|hrs?)?\b/);
  if (match) {
    const hora = parseInt(match[1]);
    const minuto = match[2] ? parseInt(match[2]) : 0;
    
    if (hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59) {
      const horaStr = String(hora).padStart(2, '0');
      const minStr = String(minuto).padStart(2, '0');
      console.log(`   ✅ Horário extraído: ${horaStr}:${minStr}`);
      return `${horaStr}:${minStr}`;
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
    if (!dadosAcumulados.data) {
      const dataExtraida = extrairData(mensagem, contexto);
      if (dataExtraida) {
        dadosAcumulados.data = dataExtraida;
      } else {
        console.log(`   ❌ Nenhuma data encontrada`);
      }
    }

    // EXTRAIR HORA
    if (!dadosAcumulados.hora) {
      const horaExtraida = extrairHora(mensagem);
      if (horaExtraida) {
        dadosAcumulados.hora = horaExtraida;
      } else {
        console.log(`   ❌ Nenhum horário encontrado`);
      }
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

    // ✅ BUSCAR HORÁRIOS DISPONÍVEIS (se tiver data e profissional)
    if (dadosAcumulados.data && dadosAcumulados.profissional) {
      
      // Se tem período específico, buscar horários daquele período
      if (dadosAcumulados.periodo) {
        dadosAcumulados.horariosDisponiveis = await buscarHorariosDisponiveis(
          contexto.companyId,
          dadosAcumulados.profissional,
          dadosAcumulados.data,
          dadosAcumulados.periodo
        );
      }
      
      // Buscar períodos disponíveis (sempre útil para a IA)
      dadosAcumulados.periodosDisponiveis = await verificarPeriodosDisponiveis(
        contexto.companyId,
        dadosAcumulados.profissional,
        dadosAcumulados.data
      );
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
