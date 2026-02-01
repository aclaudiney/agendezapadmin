/**
 * TIPOS DE CONVERSA - AGENDEZAP
 * Define os 7 tipos de fluxos de conversa que a IA pode ter
 */

// ============================================
// 1️⃣ TIPOS DOS 7 FLUXOS DE CONVERSA
// ============================================

export type TipoConversa = 
  | 'agendar' 
  | 'consultar' 
  | 'cancelar' 
  | 'remarcar' 
  | 'atrasar' 
  | 'comentario'
  | 'confirmacao';

// ============================================
// 2️⃣ CONTEXTO DE CONVERSA
// ============================================

export interface ConversationContext {
  // IDENTIFICAÇÃO
  companyId: string;
  jid: string; // Número WhatsApp (ex: 5511999999999)
  
  // CLIENTE
  cliente: {
    id: string | null;
    nome: string | null;
    telefone: string;
    existe: boolean;
  };

  // TIPO DE CONVERSA
  tipo: TipoConversa;

  // DADOS DA EMPRESA
  nomeAgente: string;
  nomeLoja: string;
  promptBase: string;

  // SERVIÇOS E PROFISSIONAIS
  servicos: ServicoData[];
  profissionais: ProfissionalData[];
  eSolo: boolean; // true se só tem 1 profissional

  // AGENDAMENTOS DO CLIENTE
  agendamentos: AgendamentoSimplificado[];

  // CONTEXTO ATUAL DA CONVERSA
  mensagem: string;
  dadosColetados?: {
    servico?: string;
    profissional?: string;
    data?: string;
    hora?: string;
    nome?: string;
  };

  // TIMESTAMP
  horarioAtual: string; // HH:MM
  dataAtual: string; // YYYY-MM-DD
  timezone: string; // "America/Sao_Paulo"
}

// ============================================
// 3️⃣ RESPOSTA DA IA
// ============================================

export interface RespostaIA {
  tipo: 'texto' | 'acao' | 'erro';
  mensagem: string;
  acao?: {
    tipo: 'criar' | 'atualizar' | 'deletar' | 'nenhuma';
    dados?: any;
  };
  erro?: {
    codigo: string;
    mensagem: string;
  };
}

// ============================================
// 4️⃣ DADOS SIMPLIFICADOS PARA PASSAR À IA
// ============================================

export interface ServicoData {
  id: string;
  nome: string;
  duracao: number; // em minutos
  preco: number;
}

export interface ProfissionalData {
  id: string;
  nome: string;
  especialidade: string;
}

export interface AgendamentoSimplificado {
  id: string;
  servico: string;
  profissional: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  status: 'confirmado' | 'cancelado' | 'pendente';
  observacao?: string;
}

// ============================================
// 5️⃣ ESTADO DA CONVERSA (pra memória)
// ============================================

export interface EstadoConversa {
  memKey: string; // company_id_jid
  tipo: TipoConversa;
  etapa: 'coleta' | 'resumo' | 'confirmacao' | 'finalizado';
  dados: ConversationContext;
  ultimaMensagem: string;
  ultimaResposta: string;
  timestamp: number;
}