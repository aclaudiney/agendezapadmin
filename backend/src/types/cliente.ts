/**
 * TIPOS DE CLIENTE - AGENDEZAP
 * Define a estrutura completa de um cliente
 */

// ============================================
// 1️⃣ CLIENTE COMPLETO (banco de dados)
// ============================================

export interface Cliente {
  id: string;
  company_id: string;
  nome: string;
  telefone: string; // 5511999999999 (sem +)
  email?: string;
  data_nascimento?: string; // YYYY-MM-DD
  ativo: boolean;
  created_at: string; // ISO timestamp
}

// ============================================
// 2️⃣ CLIENTE PARA CRIAR (input)
// ============================================

export interface CriarClienteInput {
  nome: string;
  telefone: string; // 5511999999999
  email?: string;
  data_nascimento?: string; // YYYY-MM-DD
}

// ============================================
// 3️⃣ CLIENTE PARA ATUALIZAR (input)
// ============================================

export interface AtualizarClienteInput {
  nome?: string;
  email?: string;
  data_nascimento?: string;
  ativo?: boolean;
}

// ============================================
// 4️⃣ CLIENTE SIMPLIFICADO (pra conversa)
// ============================================

export interface ClienteSimplificado {
  id: string;
  nome: string;
  telefone: string;
  existe: boolean; // true se já cadastrado
}

// ============================================
// 5️⃣ RESPOSTA DE BUSCA DE CLIENTE
// ============================================

export interface RespostaBuscaCliente {
  encontrado: boolean;
  cliente?: Cliente;
  mensagem: string;
}

// ============================================
// 6️⃣ RESPOSTA DE CRIAÇÃO DE CLIENTE
// ============================================

export interface RespostaCriacaoCliente {
  sucesso: boolean;
  cliente?: Cliente;
  erro?: string;
}