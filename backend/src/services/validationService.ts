/**
 * VALIDATION SERVICE - AGENDEZAP
 * Valida datas, horários, dias fechados, disponibilidade, etc
 * 
 * ✅ CORRIGIDO:
 * - Timezone UTC → Brasil
 * - Busca de horários usa horario_segunda, horario_terca, etc
 */

import { supabase } from '../supabase.js';

// ============================================
// 1️⃣ VALIDAR SE DIA TÁ ABERTO + HORÁRIO DENTRO DA ABERTURA
// ============================================

export const validarDiaAberto = async (
  companyId: string,
  data: string, // YYYY-MM-DD
  hora?: string // HH:MM (opcional)
): Promise<{ aberto: boolean; motivo?: string }> => {
  try {
    // Buscar configuração
    const { data: config, error } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error || !config) {
      return { aberto: false, motivo: 'Configuração não encontrada' };
    }

    // ✅ CORRIGIDO: Converter data YYYY-MM-DD para dia da semana COM TIMEZONE BRASIL
    const dataObj = new Date(`${data}T12:00:00-03:00`); // Força horário Brasil
    const diaSemana = dataObj.getDay(); // ✅ Usa .getDay() em vez de .getUTCDay()

    // Nomes dos dias
    const nomesDia = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const nomesDiaIngles = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

    // Buscar horário específico do dia (horario_segunda, horario_terca, etc)
    const horarioDoDia = config[`horario_${nomesDiaIngles[diaSemana]}`];

    console.log(`   🕐 Validando dia: ${nomesDia[diaSemana]} (${data})`);
    console.log(`      Horário do dia: ${horarioDoDia}`);

    // ✅ CRÍTICO: Se tá "FECHADO", retorna erro
    if (horarioDoDia === 'FECHADO' || !horarioDoDia) {
      return {
        aberto: false,
        motivo: `Desculpa, estamos fechados às ${nomesDia[diaSemana]}s.`
      };
    }

    // ✅ CRÍTICO (NOVO): Verificar dias_abertura (JSON)
    if (config.dias_abertura) {
      const nomeDiaSemAcento = nomesDiaIngles[diaSemana]; // segunda, terca...
      if (config.dias_abertura[nomeDiaSemAcento] === false) {
         return {
           aberto: false,
           motivo: `Desculpa, estamos fechados às ${nomesDia[diaSemana]}s.`
         };
      }
    }

    // ✅ VALIDAR SE HORÁRIO TÁ DENTRO DA ABERTURA (se informado)
    if (hora) {
      console.log(`   ⏰ Validando horário: ${hora}`);

      const [horaAbertura, minAbertura] = horarioDoDia.split('-')[0].split(':').map(Number);
      const [horaFechamento, minFechamento] = horarioDoDia.split('-')[1].split(':').map(Number);
      const [horaAgendamento, minAgendamento] = hora.split(':').map(Number);

      const minutoAbertura = horaAbertura * 60 + minAbertura;
      const minutoFechamento = horaFechamento * 60 + minFechamento;
      const minutoAgendamento = horaAgendamento * 60 + minAgendamento;

      console.log(`      Abertura: ${horarioDoDia.split('-')[0]} (${minutoAbertura} min)`);
      console.log(`      Horário solicitado: ${hora} (${minutoAgendamento} min)`);
      console.log(`      Fechamento: ${horarioDoDia.split('-')[1]} (${minutoFechamento} min)`);

      // Se horário tá ANTES da abertura ou DEPOIS do fechamento
      if (minutoAgendamento < minutoAbertura) {
        return {
          aberto: false,
          motivo: `Desculpa, abrimos às ${horarioDoDia.split('-')[0]} nesse dia. Escolha um horário após esse.`
        };
      }

      if (minutoAgendamento >= minutoFechamento) {
        return {
          aberto: false,
          motivo: `Desculpa, fechamos às ${horarioDoDia.split('-')[1]} nesse dia. Escolha um horário antes disso.`
        };
      }

      console.log(`      ✅ Horário dentro do funcionamento`);
    }

    console.log(`   ✅ Dia e horário válidos`);
    return { aberto: true };
  } catch (error) {
    console.error('❌ Erro validarDiaAberto:', error);
    return { aberto: false, motivo: 'Erro ao validar' };
  }
};

// ============================================
// 2️⃣ VALIDAR SE DATA TÁ DENTRO DOS 30 DIAS
// ============================================

export const validarDataFutura = (
  dataAgendamento: string, // YYYY-MM-DD
  dataAtual: string // YYYY-MM-DD
): { valida: boolean; motivo?: string } => {
  try {
    const agendamento = new Date(`${dataAgendamento}T00:00:00`);
    const hoje = new Date(`${dataAtual}T00:00:00`);

    // Calcular diferença em dias
    const diferença = Math.floor((agendamento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    // Não pode agendar no passado
    if (diferença < 0) {
      return { valida: false, motivo: 'Data já passou' };
    }

    // Máximo 30 dias
    if (diferença > 30) {
      return { valida: false, motivo: 'Máximo 30 dias de antecedência' };
    }

    return { valida: true };
  } catch (error) {
    console.error('❌ Erro validarDataFutura:', error);
    return { valida: false, motivo: 'Erro ao validar data' };
  }
};

// ============================================
// 3️⃣ VALIDAR HORÁRIO DISPONÍVEL + DENTRO DA ABERTURA
// ============================================

export const validarHorarioDisponivel = async (
  companyId: string,
  profissionalId: string,
  data: string, // YYYY-MM-DD
  hora: string, // HH:MM
  duracaoServico: number // minutos
): Promise<{ disponivel: boolean; motivo?: string }> => {
  try {
    // ✅ PRIMEIRO: Validar se tá dentro do horário de funcionamento
    const { data: config } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (!config) {
      return { disponivel: false, motivo: 'Configuração não encontrada' };
    }

    // ✅ CORRIGIDO: Converter data pra dia da semana COM TIMEZONE
    const dataObj = new Date(`${data}T12:00:00-03:00`);
    const diaSemana = dataObj.getDay();
    const nomesDiaIngles = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const horarioDoDia = config[`horario_${nomesDiaIngles[diaSemana]}`];

    if (horarioDoDia === 'FECHADO' || !horarioDoDia) {
      return { disponivel: false, motivo: 'Estabelecimento fechado nesse dia' };
    }

    // Validar se hora tá dentro do horário de abertura/fechamento
    const [horaAbertura, minAbertura] = horarioDoDia.split('-')[0].split(':').map(Number);
    const [horaFechamento, minFechamento] = horarioDoDia.split('-')[1].split(':').map(Number);
    const [horaAgendamento, minAgendamento] = hora.split(':').map(Number);

    const minutoAbertura = horaAbertura * 60 + minAbertura;
    const minutoFechamento = horaFechamento * 60 + minFechamento;
    const minutoAgendamento = horaAgendamento * 60 + minAgendamento;
    const minutoTermino = minutoAgendamento + duracaoServico;

    console.log(`   ⏰ Validando horário dentro da abertura:`);
    console.log(`      Abre: ${horaAbertura}:${String(minAbertura).padStart(2, '0')} (${minutoAbertura} min)`);
    console.log(`      Fecha: ${horaFechamento}:${String(minFechamento).padStart(2, '0')} (${minutoFechamento} min)`);
    console.log(`      Solicitado: ${hora} (${minutoAgendamento}-${minutoTermino} min)`);

    // Se horário começa ANTES da abertura
    if (minutoAgendamento < minutoAbertura) {
      const horaAberturaFormatada = `${String(horaAbertura).padStart(2, '0')}:${String(minAbertura).padStart(2, '0')}`;
      return {
        disponivel: false,
        motivo: `Desculpa, abrimos às ${horaAberturaFormatada} nesse dia.`
      };
    }

    // Se horário termina DEPOIS do fechamento
    if (minutoTermino > minutoFechamento) {
      const horaFechamentoFormatada = `${String(horaFechamento).padStart(2, '0')}:${String(minFechamento).padStart(2, '0')}`;
      return {
        disponivel: false,
        motivo: `Desculpa, fechamos às ${horaFechamentoFormatada} nesse dia. Esse horário não cabe.`
      };
    }

    console.log(`   ✅ Horário dentro do funcionamento`);

    // ✅ SEGUNDO: Validar conflitos com outros agendamentos
    const { data: agendamentos, error } = await supabase
      .from('agendamentos')
      .select('hora_agendamento')
      .eq('profissional_id', profissionalId)
      .eq('data_agendamento', data)
      .eq('company_id', companyId)
      .neq('status', 'cancelado');

    if (error) {
      return { disponivel: false, motivo: 'Erro ao validar horário' };
    }

    // Verificar se algum agendamento conflita
    for (const agend of agendamentos || []) {
      const [agendHoras, agendMinutos] = agend.hora_agendamento.split(':').map(Number);
      const agendEmMinutos = agendHoras * 60 + agendMinutos;

      // Se o novo agendamento se sobrepõe
      if (minutoAgendamento < agendEmMinutos + 30 && minutoTermino > agendEmMinutos) {
        return { disponivel: false, motivo: `Horário ${hora} tá ocupado. Escolha outro.` };
      }
    }

    console.log(`   ✅ Horário disponível`);
    return { disponivel: true };
  } catch (error) {
    console.error('❌ Erro validarHorarioDisponivel:', error);
    return { disponivel: false, motivo: 'Erro ao validar' };
  }
};

// ============================================
// 4️⃣ VALIDAR SE HORÁRIO TÁ NO PASSADO (HOJE)
// ============================================

export const validarHorarioPassado = (
  data: string, // YYYY-MM-DD
  hora: string, // HH:MM
  dataAtual: string, // YYYY-MM-DD
  horarioAtual: string // HH:MM
): { valido: boolean; motivo?: string } => {
  try {
    // Se for outro dia, tá ok
    if (data !== dataAtual) {
      return { valido: true };
    }

    // Se for hoje, validar horário
    const [horasAtual, minutosAtual] = horarioAtual.split(':').map(Number);
    const [horasAgendamento, minutosAgendamento] = hora.split(':').map(Number);

    const minutoAtual = horasAtual * 60 + minutosAtual;
    const minutoAgendamento = horasAgendamento * 60 + minutosAgendamento;

    // ✅ CRÍTICO: Horário precisa ser pelo menos 1 hora no futuro
    const minutoMinimoFuturo = minutoAtual + 60; // 1 hora de antecedência

    if (minutoAgendamento <= minutoMinimoFuturo) {
      return {
        valido: false,
        motivo: `Horário ${hora} já passou ou é muito próximo. Escolha um horário com pelo menos 1 hora de antecedência.`
      };
    }

    return { valido: true };
  } catch (error) {
    console.error('❌ Erro validarHorarioPassado:', error);
    return { valido: false, motivo: 'Erro ao validar' };
  }
};

// ============================================
// 4️⃣B DETERMINAR PERÍODOS DISPONÍVEIS (DINÂMICO BASEADO NA HORA)
// ============================================

export const determinarPeriodosDisponiveis = async (
  companyId: string,
  dataAgendamento: string, // YYYY-MM-DD
  dataAtual: string, // YYYY-MM-DD
  horarioAtual: string // HH:MM
): Promise<{ periodos: string[]; motivo?: string }> => {
  try {
    // Se não for hoje, oferece tudo baseado na hora de fechamento
    if (dataAgendamento !== dataAtual) {
      // Buscar hora de fechamento
      const { data: config } = await supabase
        .from('configuracoes')
        .select('hora_fechamento')
        .eq('company_id', companyId)
        .single();

      const horaFechamento = parseInt(config?.hora_fechamento?.split(':')[0] || '18');
      const periodos: string[] = [];

      // Períodos: manhã (6-12), tarde (12-18), noite (18-22)
      if (horaFechamento > 6) periodos.push('manhã');
      if (horaFechamento > 12) periodos.push('tarde');
      if (horaFechamento > 18) periodos.push('noite');

      if (periodos.length === 0) {
        return {
          periodos: ['manhã'],
          motivo: 'Apenas manhã está disponível nesse dia'
        };
      }

      return { periodos };
    }

    // ✅ SE FOR HOJE, determina DINAMICAMENTE por hora atual
    const [horas, minutos] = horarioAtual.split(':').map(Number);
    const minutoAtual = horas * 60 + minutos;

    // Buscar hora de fechamento
    const { data: config } = await supabase
      .from('configuracoes')
      .select('hora_fechamento')
      .eq('company_id', companyId)
      .single();

    const horaFechamento = parseInt(config?.hora_fechamento?.split(':')[0] || '18');

    // Períodos: manhã (6-12), tarde (12-18), noite (18-22)
    const periodos: string[] = [];

    // Manhã: 06:00-12:00 (só se fecha DEPOIS de 12)
    if (minutoAtual < 12 * 60 && horaFechamento > 12) {
      periodos.push('manhã');
    }

    // Tarde: 12:00-18:00 (só se fecha DEPOIS de 18)
    if (minutoAtual < 18 * 60 && horaFechamento > 18) {
      periodos.push('tarde');
    }

    // Noite: 18:00-22:00 (só se fecha DEPOIS de 22 ou bem tarde)
    if (minutoAtual < 22 * 60 && horaFechamento > 20) {
      periodos.push('noite');
    }

    if (periodos.length === 0) {
      return {
        periodos: [],
        motivo: 'Infelizmente não há horários disponíveis hoje. Gostaria de agendar para amanhã?'
      };
    }

    return { periodos };
  } catch (error) {
    console.error('❌ Erro determinarPeriodosDisponiveis:', error);
    return { periodos: ['manhã', 'tarde', 'noite'] };
  }
};

// ============================================
// 5️⃣ BUSCAR HORÁRIOS DISPONÍVEIS (de um profissional)
// ✅ CORRIGIDO: Agora usa horario_segunda, horario_terca, etc
// ============================================

export const buscarHorariosDisponiveis = async (
  companyId: string,
  profissionalId: string,
  data: string, // YYYY-MM-DD
  duracaoServico: number // minutos
): Promise<string[]> => {
  try {
    // Buscar configuração
    const { data: config } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (!config) return [];

    // ✅ CORRIGIDO: Pegar dia da semana COM TIMEZONE
    const dataObj = new Date(`${data}T12:00:00-03:00`);
    const diaSemana = dataObj.getDay();
    const nomesDiaIngles = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const horarioDoDia = config[`horario_${nomesDiaIngles[diaSemana]}`];

    if (horarioDoDia === 'FECHADO' || !horarioDoDia) return [];

    // Buscar agendamentos já existentes
    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('hora_agendamento')
      .eq('profissional_id', profissionalId)
      .eq('data_agendamento', data)
      .eq('company_id', companyId)
      .neq('status', 'cancelado');

    // ✅ CORREÇÃO: Formatar horários ocupados para HH:MM (removendo segundos se houver)
    // E arredondar para baixo para bloquear o slot da grade (ex: 17:01 vira 17:00)
    const horariosOcupados = (agendamentos || []).map((a: any) => {
      if (typeof a.hora_agendamento !== 'string') return a.hora_agendamento;
      const [h, m] = a.hora_agendamento.split(':').map(Number);
      const mArredondado = m >= 30 ? 30 : 0;
      return `${String(h).padStart(2, '0')}:${String(mArredondado).padStart(2, '0')}`;
    });

    // ✅ CORRIGIDO: Usar horarioDoDia (ex: "09:00-18:00")
    const [horaAbertura, minAbertura] = horarioDoDia.split('-')[0].split(':').map(Number);
    const [horaFechamento, minFechamento] = horarioDoDia.split('-')[1].split(':').map(Number);

    const horarios: string[] = [];
    let hora = horaAbertura;
    let min = minAbertura;

    while (hora < horaFechamento || (hora === horaFechamento && min < minFechamento)) {
      const horarioFormatado = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      // Verificar se há tempo suficiente até o fechamento
      const minutosFim = horaFechamento * 60 + minFechamento;
      const minutosAgora = hora * 60 + min + duracaoServico;

      if (minutosAgora <= minutosFim && !horariosOcupados.includes(horarioFormatado)) {
        horarios.push(horarioFormatado);
      }

      min += 30;
      if (min >= 60) {
        min = 0;
        hora += 1;
      }
    }

    return horarios;
  } catch (error) {
    console.error('❌ Erro buscarHorariosDisponiveis:', error);
    return [];
  }
};

// ============================================
// 6️⃣ VALIDAR SE PROFISSIONAL SABE O SERVIÇO
// ============================================

export const validarEspecialidade = (
  profissional: any,
  nomeServico: string
): { valido: boolean; motivo?: string } => {
  try {
    // Se profissional não tem especialidade definida, ele sabe tudo
    if (!profissional.especialidade) {
      return { valido: true };
    }

    // Verificar se a especialidade contém o serviço
    const especialidades = profissional.especialidade.toLowerCase();
    const servico = nomeServico.toLowerCase();

    if (especialidades.includes(servico)) {
      return { valido: true };
    }

    return {
      valido: false,
      motivo: `${profissional.nome} não faz ${nomeServico}`
    };
  } catch (error) {
    console.error('❌ Erro validarEspecialidade:', error);
    return { valido: false, motivo: 'Erro ao validar' };
  }
};
