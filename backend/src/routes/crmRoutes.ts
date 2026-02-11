/**
 * CRM ROUTES - AGENDEZAP
 * Rotas para visualizar conversas do WhatsApp
 * ✅ COM ENVIO DE MENSAGENS MANUAL
 */

import express from 'express';
import {
  buscarConversasPorEmpresa,
  buscarMensagensConversa,
  buscarEstatisticasConversas
} from '../services/messageLoggerService.js';

const router = express.Router();

// ============================================
// POST /api/crm/send-message
// Enviar mensagem manual pelo CRM
// ============================================

router.post('/send-message', async (req, res) => {
  try {
    const { companyId, clientPhone, message } = req.body;

    console.log(`📤 [CRM] Enviando mensagem para: ${clientPhone}`);

    if (!companyId || !clientPhone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: companyId, clientPhone, message'
      });
    }

    // Importar a Evolution API
    const { evolutionAPI } = await import('../services/whatsapp/evolutionAPI.js');

    try {
      await evolutionAPI.sendTextMessage(companyId, clientPhone, message);

      console.log(`✅ [CRM] Mensagem enviada com sucesso`);

      res.json({
        success: true,
        message: 'Mensagem enviada com sucesso'
      });
    } catch (error: any) {
      console.error('❌ [CRM] Erro ao enviar:', error);

      // Erro específico se WhatsApp não está conectado
      if (error.message.includes('não está conectado')) {
        return res.status(400).json({
          success: false,
          error: 'WhatsApp não está conectado para esta empresa. Conecte primeiro!'
        });
      }

      throw error;
    }
  } catch (error: any) {
    console.error('❌ [CRM] Erro geral:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar mensagem'
    });
  }
});

// ============================================
// GET /api/crm/conversations/:companyId
// Lista todas as conversas de uma empresa
// ============================================

router.get('/conversations/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    console.log(`📊 [CRM] Buscando conversas da empresa: ${companyId}`);

    const conversas = await buscarConversasPorEmpresa(companyId);

    res.json({
      success: true,
      data: conversas
    });
  } catch (error) {
    console.error('❌ Erro ao buscar conversas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar conversas'
    });
  }
});

// ============================================
// GET /api/crm/messages/:companyId/:phone
// Busca todas as mensagens de uma conversa
// ============================================

router.get('/messages/:companyId/:phone', async (req, res) => {
  try {
    const { companyId, phone } = req.params;

    console.log(`📊 [CRM] Buscando mensagens: ${companyId} - ${phone}`);

    const mensagens = await buscarMensagensConversa(companyId, phone);

    res.json({
      success: true,
      data: mensagens
    });
  } catch (error) {
    console.error('❌ Erro ao buscar mensagens:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar mensagens'
    });
  }
});

// ============================================
// GET /api/crm/stats/:companyId
// Estatísticas das conversas
// ============================================

router.get('/stats/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    console.log(`📊 [CRM] Buscando estatísticas: ${companyId}`);

    const stats = await buscarEstatisticasConversas(companyId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas'
    });
  }
});

export default router;
