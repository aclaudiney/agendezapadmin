/**
 * TIPOS DE AGENDAMENTO - AGENDEZAP
 * Define a estrutura completa de um agendamento
 */

// ============================================
// 1️⃣ STATUS DO AGENDAMENTO
// ============================================

export type StatusAgendamento = 
  | 'confirmado' 
  | 'pendente' 
  | 'cancelado';

// ============================================
// 2️⃣ AGENDAMENTO COMPLETO (banco de dados)
// ============================================

export interface Agendamento {
  id: string;
  company_id: string;
  cliente_id: string;
  servico_id: string;
  profissional_id: string;
  data_agendamento: string; // YYYY-MM-DD
  hora_agendamento: string; // HH:MM:SS
  status: StatusAgendamento;
  origem: 'whatsapp' | 'web' | 'app';
  created_at: string; // ISO timestamp
  forma_pagamento?: string;
  valor_pago?: number;
  data_pagamento?: string;
  observacao?: string; // Campo novo - comentários do cliente
}

// ============================================
// 3️⃣ AGENDAMENTO PARA CRIAR (input)
// ============================================

export interface CriarAgendamentoInput {
  cliente_id: string;
  servico_id: string;
  profissional_id: string;
  data_agendamento: string; // YYYY-MM-DD
  hora_agendamento: string; // HH:MM
  observacao?: string;
}

// ============================================
// 4️⃣ AGENDAMENTO PARA ATUALIZAR (input)
// ============================================

export interface AtualizarAgendamentoInput {
  data_agendamento?: string;
  hora_agendamento?: string;
  status?: StatusAgendamento;
  observacao?: string;
}

// ============================================
// 5️⃣ RESPOSTA DE VALIDAÇÃO DE HORÁRIO
// ============================================

export interface ValidacaoHorario {
  disponivel: boolean;
  horario: string; // HH:MM
  profissional_id: string;
  profissional_nome: string;
  data: string; // YYYY-MM-DD
  duracao_servico: number; // minutos
  motivo_indisponivel?: string; // se não disponível
}

// ============================================
// 6️⃣ RESPOSTA DE AGENDAMENTO
// ============================================

export interface RespostaAgendamento {
  status: 'sucesso' | 'ocupado' | 'pedir_nome' | 'erro';
  mensagem: string;
  agendamento?: Agendamento;
  horarios_sugeridos?: ValidacaoHorario[];
  dados?: any;
}

// ============================================
// 7️⃣ AGENDAMENTOS DO CLIENTE (pra consulta)
// ============================================

export interface AgendamentoDoCliente {
  id: string;
  servico: string;
  profissional: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  horario_termino: string; // HH:MM (calculado pela duração)
  status: StatusAgendamento;
  observacao?: string;
}