/**
 * EXTRACTION SERVICE - AGENDEZAP
 * Extrai dados (serviço, data, hora, profissional, nome) da mensagem do cliente
 * Usa abordagem HÍBRIDA: extração rápida + IA para casos complexos
 */

// ============================================
// 1️⃣ EXTRAIR SERVIÇO (HÍBRIDO)
// ============================================

export const extrairServico = (
  mensagem: string,
  servicosDisponiveis: string[]
): string | null => {
  try {
    const mensagemLower = mensagem.toLowerCase();
    
    console.log(`   🔍 Procurando serviço...`);
    console.log(`      Disponíveis: ${servicosDisponiveis.join(', ')}`);

    // 1️⃣ TENTAR MATCH EXATO PRIMEIRO (rápido)
    for (const servico of servicosDisponiveis) {
      const servicoLower = servico.toLowerCase();
      
      if (mensagemLower.includes(servicoLower)) {
        console.log(`   ✅ Serviço encontrado (exato): ${servico}`);
        return servico;
      }
    }

    // 2️⃣ SINÔNIMOS PRINCIPAIS (mantém pequeno e eficiente)
    const sinonimosChave = {
      // Tudo relacionado a CABELO
      "cabelo": ["corte", "cortar", "corta", "cabelo", "aparar", "tosa", "raspar", "dar um trato", "tratar cabelo"],
      
      // Tudo relacionado a BARBA
      "barba": ["barba", "fazer barba", "barbear", "aparar barba", "desenhar barba", "modelar", "raspar barba", "trato na barba"],
      
      // Tudo relacionado a PELE/ROSTO
      "pele": ["pele", "limpeza", "hidratação", "facial", "rosto", "tratamento de pele", "esfoliação", "massagem facial"],
      
      // Tudo relacionado a COMBO
      "combo": ["combo", "completo", "pacote", "os dois", "cabelo e barba", "tudo", "kit", "promoção"]
    };

    console.log(`   🔎 Procurando sinônimos...`);

    for (const [chaveCategoria, listaSinonimos] of Object.entries(sinonimosChave)) {
      for (const sinonimo of listaSinonimos) {
        if (mensagemLower.includes(sinonimo)) {
          console.log(`   ✅ Sinônimo encontrado: "${sinonimo}" (categoria: ${chaveCategoria})`);
          
          // Encontrou sinônimo, agora procura serviço que bate com essa categoria
          const servicoEncontrado = servicosDisponiveis.find(s => {
            const servicoBaixo = s.toLowerCase();
            // Procura por palavra-chave da categoria dentro do nome do serviço
            return servicoBaixo.includes(chaveCategoria);
          });

          if (servicoEncontrado) {
            console.log(`   ✅ Serviço extraído (sinônimo): ${servicoEncontrado}`);
            return servicoEncontrado;
          }
        }
      }
    }

    // 3️⃣ NÃO ENCONTROU - deixa pra IA resolver
    console.log(`   ⚠️ Serviço não encontrado na extração`);
    console.log(`      → IA vai tentar entender ou perguntar`);
    return null;

  } catch (error) {
    console.error('❌ Erro extrairServico:', error);
    return null;
  }
};

// ============================================
// 2️⃣ EXTRAIR DATA
// ============================================

export const extrairData = (
  mensagem: string,
  dataAtual: string // YYYY-MM-DD
): string | null => {
  try {
    const mensagemLower = mensagem.toLowerCase();
    const hoje = new Date(dataAtual);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    // Formatar datas
    const formatarData = (date: Date) => date.toISOString().split('T')[0];
    const hojeFormatado = formatarData(hoje);
    const amanhaFormatado = formatarData(amanha);

    // Nomes dos dias
    const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

    // ✅ HOJE / AGORA
    if (
      mensagemLower.includes('hoje') ||
      mensagemLower.includes('agora') ||
      mensagemLower.includes('neste dia') ||
      mensagemLower.includes('esse dia')
    ) {
      console.log(`   ✅ Data extraída: hoje (${hojeFormatado})`);
      return hojeFormatado;
    }

    // ✅ AMANHÃ
    if (
      mensagemLower.includes('amanhã') ||
      mensagemLower.includes('amanha') ||
      mensagemLower.includes('próximo dia') ||
      mensagemLower.includes('proximo dia') ||
      mensagemLower.includes('dia que vem')
    ) {
      console.log(`   ✅ Data extraída: amanhã (${amanhaFormatado})`);
      return amanhaFormatado;
    }

    // ✅ DIAS DA SEMANA (segunda, terça, etc)
    for (let i = 0; i < diasSemana.length; i++) {
      if (mensagemLower.includes(diasSemana[i])) {
        // Encontrar próxima ocorrência desse dia
        let dataProxima = new Date(hoje);
        const diaAtual = hoje.getDay();
        let diasAdicionar = (i - diaAtual + 7) % 7;
        
        // Se é hoje, busca próxima semana
        if (diasAdicionar === 0) diasAdicionar = 7;
        
        dataProxima.setDate(dataProxima.getDate() + diasAdicionar);
        const dataFormatada = formatarData(dataProxima);
        console.log(`   ✅ Data extraída: ${diasSemana[i]} (${dataFormatada})`);
        return dataFormatada;
      }
    }

    // ✅ FORMATO DD/MM/YYYY ou DD-MM-YYYY
    const regexData = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
    const matchData = mensagem.match(regexData);
    if (matchData) {
      const dia = matchData[1].padStart(2, '0');
      const mes = matchData[2].padStart(2, '0');
      const ano = matchData[3];
      const dataFormatada = `${ano}-${mes}-${dia}`;
      console.log(`   ✅ Data extraída: ${dataFormatada}`);
      return dataFormatada;
    }

    console.log(`   ❌ Nenhuma data encontrada`);
    return null;
  } catch (error) {
    console.error('❌ Erro extrairData:', error);
    return null;
  }
};

// ============================================
// 3️⃣ EXTRAIR HORÁRIO
// ============================================

export const extrairHorario = (mensagem: string): string | null => {
  try {
    const mensagemLower = mensagem.toLowerCase();

    // ✅ FORMATO: "às 15" ou "às 15h" ou "15 horas"
    const regexAshora = /às\s+(\d{1,2})\s*(h|horas|hrs)?/i;
    const match1 = mensagemLower.match(regexAshora);
    if (match1) {
      const hora = match1[1].padStart(2, '0');
      const horario = `${hora}:00`;
      console.log(`   ✅ Horário extraído (padrão "às X"): ${horario}`);
      return horario;
    }

    // ✅ FORMATO: "15h" ou "15 horas" ou "15hrs"
    const regexHora = /(\d{1,2})\s*(h|horas|hrs)/i;
    const match2 = mensagemLower.match(regexHora);
    if (match2) {
      const hora = match2[1].padStart(2, '0');
      const horario = `${hora}:00`;
      console.log(`   ✅ Horário extraído (padrão "X horas"): ${horario}`);
      return horario;
    }

    // ✅ FORMATO: "15:30" ou "1530"
    const regexHoraMinuto = /(\d{1,2}):?(\d{2})/;
    const match3 = mensagemLower.match(regexHoraMinuto);
    if (match3) {
      const hora = match3[1].padStart(2, '0');
      const minuto = match3[2] ? match3[2].padStart(2, '0') : '00';
      const horario = `${hora}:${minuto}`;
      console.log(`   ✅ Horário extraído (padrão "HH:MM"): ${horario}`);
      return horario;
    }

    console.log(`   ❌ Nenhum horário encontrado`);
    return null;
  } catch (error) {
    console.error('❌ Erro extrairHorario:', error);
    return null;
  }
};

// ============================================
// 4️⃣ EXTRAIR PROFISSIONAL
// ============================================

export const extrairProfissional = (
  mensagem: string,
  profissionaisDisponiveis: string[]
): string | null => {
  try {
    const mensagemLower = mensagem.toLowerCase();

    console.log(`   🔍 Procurando profissional...`);

    // 1️⃣ MATCH EXATO
    for (const prof of profissionaisDisponiveis) {
      const profLower = prof.toLowerCase();
      
      if (mensagemLower.includes(profLower)) {
        console.log(`   ✅ Profissional encontrado: ${prof}`);
        return prof;
      }
    }

    // 2️⃣ NÃO ENCONTROU - deixa pra IA
    console.log(`   ⚠️ Profissional não encontrado na extração`);
    return null;

  } catch (error) {
    console.error('❌ Erro extrairProfissional:', error);
    return null;
  }
};

// ============================================
// 5️⃣ EXTRAIR NOME (para cliente novo)
// ============================================

export const extrairNome = (mensagem: string): string | null => {
  try {
    // Procura por padrões explícitos
    const regexNome1 = /meu nome é\s+([a-záàâãéèêíïóôõöúçñ\s]+)/i;
    const regexNome2 = /sou (?:o|a)\s+([a-záàâãéèêíïóôõöúçñ\s]+)/i;
    const regexNome3 = /me chamo\s+([a-záàâãéèêíïóôõöúçñ\s]+)/i;
    const regexNome4 = /(?:pode me chamar de|chamar de)\s+([a-záàâãéèêíïóôõöúçñ\s]+)/i;

    const match1 = mensagem.match(regexNome1);
    if (match1) {
      const nome = match1[1].trim().split(/\s+/).slice(0, 2).join(' ');
      console.log(`   ✅ Nome extraído: ${nome}`);
      return nome;
    }

    const match2 = mensagem.match(regexNome2);
    if (match2) {
      const nome = match2[1].trim().split(/\s+/).slice(0, 2).join(' ');
      console.log(`   ✅ Nome extraído: ${nome}`);
      return nome;
    }

    const match3 = mensagem.match(regexNome3);
    if (match3) {
      const nome = match3[1].trim().split(/\s+/).slice(0, 2).join(' ');
      console.log(`   ✅ Nome extraído: ${nome}`);
      return nome;
    }

    const match4 = mensagem.match(regexNome4);
    if (match4) {
      const nome = match4[1].trim().split(/\s+/).slice(0, 2).join(' ');
      console.log(`   ✅ Nome extraído: ${nome}`);
      return nome;
    }

    console.log(`   ❌ Nenhum nome encontrado`);
    return null;
  } catch (error) {
    console.error('❌ Erro extrairNome:', error);
    return null;
  }
};

// ============================================
// 6️⃣ EXTRAIR PERÍODO (manhã, tarde, noite)
// ============================================

export const extrairPeriodo = (mensagem: string): string | null => {
  try {
    const mensagemLower = mensagem.toLowerCase();

    if (
      mensagemLower.includes('manhã') ||
      mensagemLower.includes('manha') ||
      mensagemLower.includes('de manhã') ||
      mensagemLower.includes('cedo') ||
      mensagemLower.includes('início do dia')
    ) {
      console.log(`   ✅ Período extraído: manhã`);
      return 'manhã';
    }

    if (
      mensagemLower.includes('tarde') ||
      mensagemLower.includes('de tarde') ||
      mensagemLower.includes('à tarde') ||
      mensagemLower.includes('depois do meio-dia')
    ) {
      console.log(`   ✅ Período extraído: tarde`);
      return 'tarde';
    }

    if (
      mensagemLower.includes('noite') ||
      mensagemLower.includes('de noite') ||
      mensagemLower.includes('à noite') ||
      mensagemLower.includes('mais tarde') ||
      mensagemLower.includes('fim do dia')
    ) {
      console.log(`   ✅ Período extraído: noite`);
      return 'noite';
    }

    console.log(`   ❌ Nenhum período encontrado`);
    return null;
  } catch (error) {
    console.error('❌ Erro extrairPeriodo:', error);
    return null;
  }
};

// ============================================
// 7️⃣ FUNÇÃO PRINCIPAL: EXTRAIR TUDO
// ============================================

export const extrairDados = async (
  mensagem: string,
  servicosDisponiveis: string[],
  profissionaisDisponiveis: string[],
  dataAtual: string
) => {
  try {
    console.log(`\n📊 [EXTRACTION] Extraindo dados da mensagem...`);
    console.log(`   Mensagem: "${mensagem}"\n`);

    const dados = {
      servico: extrairServico(mensagem, servicosDisponiveis),
      data: extrairData(mensagem, dataAtual),
      hora: extrairHorario(mensagem),
      profissional: extrairProfissional(mensagem, profissionaisDisponiveis),
      nome: extrairNome(mensagem),
      periodo: extrairPeriodo(mensagem)
    };

    console.log(`\n📊 [EXTRACTION] Dados extraídos:`);
    console.log(`   Serviço: ${dados.servico || 'IA vai resolver'}`);
    console.log(`   Data: ${dados.data || 'IA vai perguntar'}`);
    console.log(`   Horário: ${dados.hora || 'IA vai perguntar'}`);
    console.log(`   Período: ${dados.periodo || 'não informado'}`);
    console.log(`   Profissional: ${dados.profissional || 'IA vai resolver'}`);
    console.log(`   Nome: ${dados.nome || 'IA vai perguntar'}\n`);

    return dados;
  } catch (error) {
    console.error('❌ Erro extrairDados:', error);
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