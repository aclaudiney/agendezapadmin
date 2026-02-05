import axios from 'axios';

import { API_URL } from '../config/api';

export const adminService = {
  // ✅ LISTAR TODAS AS EMPRESAS
  async listarEmpresas() {
    try {
      const response = await axios.get(`${API_URL}/admin/companies`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao listar empresas:', error);
      throw error;
    }
  },

  // ✅ OBTER EMPRESA ESPECÍFICA
  async getEmpresa(companyId: string) {
    try {
      const response = await axios.get(`${API_URL}/admin/companies/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar empresa:', error);
      throw error;
    }
  },

  // ✅ CRIAR NOVA EMPRESA
  async criarEmpresa(nome: string, descricao?: string, whatsappNumber?: string, setupFee: number = 0, monthlyFee: number = 0) {
    try {
      const response = await axios.post(`${API_URL}/admin/companies`, {
        nome,
        descricao,
        whatsappNumber,
        setupFee,
        monthlyFee
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao criar empresa:', error);
      throw error;
    }
  },

  // ✅ ATUALIZAR EMPRESA
  async atualizarEmpresa(companyId: string, dados: any) {
    try {
      const response = await axios.put(`${API_URL}/admin/companies/${companyId}`, dados);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao atualizar empresa:', error);
      throw error;
    }
  },

  // ✅ DELETAR EMPRESA
  async desativarEmpresa(companyId: string) {
    try {
      const response = await axios.delete(`${API_URL}/admin/companies/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao desativar empresa:', error);
      throw error;
    }
  },

  // ✅ CONECTAR WHATSAPP
  async conectarWhatsApp(companyId: string, name: string) {
    try {
      const response = await axios.post(`${API_URL}/connect/${companyId}`, { name });
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao conectar WhatsApp:', error);
      throw error;
    }
  },

  // ✅ DESCONECTAR WHATSAPP
  async desconectarWhatsApp(companyId: string) {
    try {
      const response = await axios.post(`${API_URL}/disconnect/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao desconectar WhatsApp:', error);
      throw error;
    }
  },

  // ✅ GET STATUS SESSÃO WHATSAPP
  async getStatusWhatsApp(companyId: string) {
    try {
      const response = await axios.get(`${API_URL}/session/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar status WhatsApp:', error);
      throw error;
    }
  },

  // ✅ GET ANALYTICS
  async getSalesByCategory() {
    try {
      const response = await axios.get(`${API_URL}/api/admin/analytics/sales-by-category`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar analytics:', error);
      throw error;
    }
  }
};