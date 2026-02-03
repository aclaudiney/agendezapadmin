/**
 * EXTRACTION SERVICE - AGENDEZAP
 * Extrai dados das mensagens do cliente (serviço, data, hora, etc)
 * 
 * ✅ CORRIGIDO: Mantém contexto da conversa (não esquece dados anteriores)
 */

import { ConversationContext } from '../types/conversation.js';

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
// ✅ FUNÇÃO PRINCIPAL: EXTRAIR DADOS (COM MEMÓRIA!)
// ============================================

export const extrairDadosMensagem = async (
  mensagem: string,
  contexto: ConversationContext
): Promise<any> => {
  try {
    console.log(`\n📊 [EXTRACTION] Extraindo dados da mensagem...`);
    console.log(`   Mensagem: "${mensagem}"`);

    // ✅ CHAVE ÚNICA POR USUÁRIO
    const memKey = `${contexto.companyId}_${contexto.telefone}`;

    // ✅ RECUPERAR DADOS ANTERIORES (se existir)
    let dadosAcumulados = dadosConversaMemoria[memKey] || {
      servico: null,
      data: null,
      hora: null,
      periodo: null,
      profissional: null,
      nome: null
    };

    // Mostrar dados anteriores (se tiver)
    const temDadosAnteriores = Object.values(dadosAcumulados).some(v => v !== null);
    if (temDadosAnteriores) {
      console.log(`\n   📝 Dados anteriores da conversa:`);
      if (dadosAcumulados.servico) console.log(`      Serviço: ${dadosAcumulados.servico}`);
      if (dadosAcumulados.data) console.log(`      Data: ${dadosAcumulados.data}`);
      if (dadosAcumulados.hora) console.log(`      Hora: ${dadosAcumulados.hora}`);
      if (dadosAcumulados.profissional) console.log(`      Profissional: ${dadosAcumulados.profissional}`);
      if (dadosAcumulados.nome) console.log(`      Nome: ${dadosAcumulados.nome}`);
      if (dadosAcumulados.periodo) console.log(`      Período: ${dadosAcumulados.periodo}`);
    }

    // EXTRAIR SERVIÇO (se ainda não tem)
    if (!dadosAcumulados.servico) {
      console.log(`\n   🔍 Procurando serviço...`);
      console.log(`      Disponíveis: ${contexto.servicos.map(s => s.nome).join(', ')}`);
      
      const servicoEncontrado = await extrairServico(mensagem, contexto);
      if (servicoEncontrado) {
        dadosAcumulados.servico = servicoEncontrado;
        console.log(`   ✅ Serviço encontrado: ${servicoEncontrado}`);
      } else {
        console.log(`   ⚠️ Serviço não encontrado na extração`);
        console.log(`      → IA vai tentar entender ou perguntar`);
      }
    } else {
      console.log(`   ✅ Serviço já existe (mantendo): ${dadosAcumulados.servico}`);
    }

    // EXTRAIR DATA (se ainda não tem)
    if (!dadosAcumulados.data) {
      const dataExtraida = extrairData(mensagem, contexto);
      if (dataExtraida) {
        dadosAcumulados.data = dataExtraida;
      } else {
        console.log(`   ❌ Nenhuma data encontrada`);
      }
    } else {
      console.log(`   ✅ Data já existe (mantendo): ${dadosAcumulados.data}`);
    }

    // EXTRAIR HORA (se ainda não tem)
    if (!dadosAcumulados.hora) {
      const horaExtraida = extrairHora(mensagem);
      if (horaExtraida) {
        dadosAcumulados.hora = horaExtraida;
      } else {
        console.log(`   ❌ Nenhum horário encontrado`);
      }
    } else {
      console.log(`   ✅ Horário já existe (mantendo): ${dadosAcumulados.hora}`);
    }

    // EXTRAIR PROFISSIONAL (se ainda não tem)
    if (!dadosAcumulados.profissional) {
      console.log(`   🔍 Procurando profissional...`);
      const profissionalEncontrado = extrairProfissional(mensagem, contexto);
      if (profissionalEncontrado) {
        dadosAcumulados.profissional = profissionalEncontrado;
        console.log(`   ✅ Profissional encontrado: ${profissionalEncontrado}`);
      } else {
        console.log(`   ⚠️ Profissional não encontrado na extração`);
      }
    } else {
      console.log(`   ✅ Profissional já existe (mantendo): ${dadosAcumulados.profissional}`);
    }

    // EXTRAIR NOME (se ainda não tem)
    if (!dadosAcumulados.nome) {
      const nomeExtraido = extrairNome(mensagem);
      if (nomeExtraido) {
        dadosAcumulados.nome = nomeExtraido;
        console.log(`   ✅ Nome extraído: ${nomeExtraido}`);
      } else {
        console.log(`   ❌ Nenhum nome encontrado`);
      }
    } else {
      console.log(`   ✅ Nome já existe (mantendo): ${dadosAcumulados.nome}`);
    }

    // EXTRAIR PERÍODO (sempre tenta, pode mudar)
    const periodoExtraido = extrairPeriodo(mensagem);
    if (periodoExtraido) {
      dadosAcumulados.periodo = periodoExtraido;
      console.log(`   ✅ Período extraído: ${periodoExtraido}`);
    } else if (!dadosAcumulados.periodo) {
      console.log(`   ❌ Nenhum período encontrado`);
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

    return dadosAcumulados;

  } catch (error) {
    console.error('❌ Erro extrairDadosMensagem:', error);
    return {
      servico: null,
      data: null,
      hora: null,
      periodo: null,
      profissional: null,
      nome: null
    };
  }
};

// ============================================
// ✅ LIMPAR MEMÓRIA (chamar após confirmar agendamento)
// ============================================

export const limparDadosConversaMemoria = (companyId: string, telefone: string) => {
  const memKey = `${companyId}_${telefone}`;
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
