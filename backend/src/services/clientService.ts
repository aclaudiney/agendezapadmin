/**
 * CLIENT SERVICE - AGENDEZAP
 * Busca, cria e atualiza clientes
 */

import { db } from '../supabase.js';
import { Cliente, CriarClienteInput, RespostaBuscaCliente, RespostaCriacaoCliente } from '../types/cliente.js';

// ============================================
// 1️⃣ BUSCAR CLIENTE POR TELEFONE
// ============================================

export const buscarClientePorTelefone = async (
  telefone: string,
  companyId: string
): Promise<RespostaBuscaCliente> => {
  try {
    const cliente = await db.getCliente(telefone, companyId);

    if (!cliente) {
      return {
        encontrado: false,
        mensagem: 'Cliente não encontrado'
      };
    }

    return {
      encontrado: true,
      cliente,
      mensagem: `Cliente ${cliente.nome} encontrado`
    };
  } catch (error) {
    console.error('❌ Erro buscarClientePorTelefone:', error);
    return {
      encontrado: false,
      mensagem: 'Erro ao buscar cliente'
    };
  }
};

// ============================================
// 2️⃣ BUSCAR CLIENTE POR ID
// ============================================

export const buscarClientePorId = async (
  clienteId: string,
  companyId: string
): Promise<Cliente | null> => {
  try {
    const cliente = await db.getClienteById(clienteId, companyId);
    return cliente;
  } catch (error) {
    console.error('❌ Erro buscarClientePorId:', error);
    return null;
  }
};

// ============================================
// 3️⃣ CRIAR NOVO CLIENTE
// ============================================

export const criarNovoCliente = async (
  dados: CriarClienteInput,
  companyId: string
): Promise<RespostaCriacaoCliente> => {
  try {
    // Validar campos obrigatórios
    if (!dados.nome || !dados.telefone) {
      return {
        sucesso: false,
        erro: 'Nome e telefone são obrigatórios'
      };
    }

    // Validar se cliente já existe
    const clienteExistente = await db.getCliente(dados.telefone, companyId);
    if (clienteExistente) {
      return {
        sucesso: false,
        erro: 'Cliente com esse telefone já existe'
      };
    }

    // Criar cliente
    const cliente = await db.criarCliente(
      dados.nome,
      dados.telefone,
      companyId,
      dados.data_nascimento
    );

    if (!cliente) {
      return {
        sucesso: false,
        erro: 'Erro ao criar cliente no banco'
      };
    }

    return {
      sucesso: true,
      cliente,
    };
  } catch (error) {
    console.error('❌ Erro criarNovoCliente:', error);
    return {
      sucesso: false,
      erro: 'Erro ao criar cliente'
    };
  }
};

// ============================================
// 4️⃣ OBTER DADOS DO CLIENTE (simples, pra IA)
// ============================================

export const obterDadosClienteParaIA = async (
  telefone: string,
  companyId: string
): Promise<{
  id: string | null;
  nome: string | null;
  telefone: string;
  existe: boolean;
}> => {
  try {
    const cliente = await db.getCliente(telefone, companyId);

    if (!cliente) {
      return {
        id: null,
        nome: null,
        telefone,
        existe: false
      };
    }

    return {
      id: cliente.id,
      nome: cliente.nome,
      telefone,
      existe: true
    };
  } catch (error) {
    console.error('❌ Erro obterDadosClienteParaIA:', error);
    return {
      id: null,
      nome: null,
      telefone,
      existe: false
    };
  }
};

// ============================================
// 5️⃣ FORMATAR TELEFONE (remove caracteres)
// ============================================

export const formatarTelefone = (telefone: string): string => {
  try {
    // Remove tudo que não é número
    const apenasNumeros = telefone.replace(/\D/g, '');

    // Se começar com 55 (código Brasil), mantém
    if (apenasNumeros.startsWith('55')) {
      return apenasNumeros;
    }

    // Se não começar com 55, adiciona
    return `55${apenasNumeros}`;
  } catch (error) {
    console.error('❌ Erro formatarTelefone:', error);
    return telefone;
  }
};

// ============================================
// 6️⃣ EXTRAIR NOME SIMPLES DO CLIENTE
// ============================================

export const extrairNomeSimples = (nomeCompleto: string): string => {
  try {
    // Pega apenas o primeiro nome
    const partes = nomeCompleto.trim().split(' ');
    return partes[0] || nomeCompleto;
  } catch (error) {
    console.error('❌ Erro extrairNomeSimples:', error);
    return nomeCompleto;
  }
};