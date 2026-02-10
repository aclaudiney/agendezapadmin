/**
 * MESSAGE LOGGER SERVICE - AGENDEZAP
 * Salva todas as mensagens do WhatsApp no banco e atualiza a lista de conversas
 */

import { supabase } from '../supabase.js';

// ============================================
// ✅ SALVAR MENSAGEM E ATUALIZAR CONVERSA
// ============================================

export const salvarMensagemWhatsApp = async (dados: {
  companyId: string;
  clientPhone: string;
  clientName?: string;
  messageText: string;
  messageType?: string;
  direction: 'incoming' | 'outgoing';
  extractedData?: any;
  conversationType?: string;
  aiResponse?: string;
}) => {
  try {
    // 1. Inserir a mensagem na tabela de histórico
    const { data: messageData, error: messageError } = await supabase
      .from('whatsapp_messages')
      .insert({
        company_id: dados.companyId,
        client_phone: dados.clientPhone,
        client_name: dados.clientName || 'Cliente WhatsApp',
        message_text: dados.messageText,
        message_type: dados.messageType || 'text',
        direction: dados.direction,
        extracted_data: dados.extractedData || {},
        conversation_type: dados.conversationType || null,
        ai_response: dados.aiResponse || null,
        processed: true
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Erro ao salvar mensagem:', messageError.message);
      return null;
    }

    // 2. ATUALIZAR A TABELA DE CONVERSAS (Para aparecer no CRM)
    // O upsert verifica se já existe uma conversa com esse telefone para essa empresa
    try {
        const { error: convError } = await supabase
          .from('whatsapp_conversations')
          .upsert({
            company_id: dados.companyId,
            client_phone: dados.clientPhone,
            client_name: dados.clientName || 'Cliente WhatsApp',
            last_message_at: new Date(),
            last_incoming_message: dados.direction === 'incoming' ? dados.messageText : undefined,
            last_outgoing_message: dados.direction === 'outgoing' ? dados.messageText : undefined
          }, { 
            onConflict: 'company_id,client_phone' 
          });

        if (convError) {
          if (convError.message.includes('view')) {
             console.warn('⚠️ Aviso: whatsapp_conversations é uma view, ignorando update.');
          } else {
             console.error('❌ Erro ao atualizar whatsapp_conversations:', convError.message);
          }
        }
    } catch (err) {
        console.warn('⚠️ Erro não crítico ao atualizar conversas:', err);
    }

    console.log(`✅ Mensagem e Conversa atualizadas: ${dados.direction}`);
    return messageData;
  } catch (error) {
    console.error('❌ Erro salvarMensagemWhatsApp:', error);
    return null;
  }
};

// ============================================
// BUSCAR CONVERSAS POR EMPRESA
// ============================================

export const buscarConversasPorEmpresa = async (companyId: string) => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('company_id', companyId)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar conversas:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('❌ Erro buscarConversasPorEmpresa:', error);
    return [];
  }
};

// ============================================
// BUSCAR MENSAGENS DE UMA CONVERSA
// ============================================

export const buscarMensagensConversa = async (
  companyId: string,
  clientPhone: string
) => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('company_id', companyId)
      .eq('client_phone', clientPhone)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('❌ Erro buscarMensagensConversa:', error);
    return [];
  }
};

// ============================================
// BUSCAR ESTATÍSTICAS DAS CONVERSAS
// ============================================

export const buscarEstatisticasConversas = async (companyId: string) => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('direction, created_at')
      .eq('company_id', companyId);

    if (error || !data) return { total: 0, incoming: 0, outgoing: 0, today: 0 };

    const hoje = new Date().toISOString().split('T')[0];

    return {
      total: data.length,
      incoming: data.filter(m => m.direction === 'incoming').length,
      outgoing: data.filter(m => m.direction === 'outgoing').length,
      today: data.filter(m => m.created_at && m.created_at.startsWith(hoje)).length
    };
  } catch (error) {
    console.error('❌ Erro estatísticas:', error);
    return { total: 0, incoming: 0, outgoing: 0, today: 0 };
  }
};
