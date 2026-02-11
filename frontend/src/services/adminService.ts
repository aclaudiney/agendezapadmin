import axios from 'axios';
import { supabase } from './supabaseClient';

import { API_URL } from '../config/api';

export const adminService = {
  // ✅ LISTAR TODAS AS EMPRESAS (DIRETO SUPABASE)
  async listarEmpresas() {
    try {
      const { data: companies, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar status do WhatsApp (opcional/async via backend se necessário)
      const companiesComStatus = await Promise.all(
        companies.map(async (company: any) => {
          try {
            const { data: session } = await supabase
              .from('whatsapp_sessions')
              .select('status, qr_code')
              .eq('company_id', company.id)
              .maybeSingle();

            return {
              ...company,
              whatsapp_status: session?.status || 'disconnected',
              whatsapp_qr: session?.qr_code || null
            };
          } catch (e) {
            return { ...company, whatsapp_status: 'error' };
          }
        })
      );

      return { success: true, companies: companiesComStatus };
    } catch (error) {
      console.error('❌ Erro ao listar empresas:', error);
      throw error;
    }
  },

  // ✅ OBTER EMPRESA ESPECÍFICA (DIRETO SUPABASE)
  async getEmpresa(companyId: string) {
    try {
      const { data: empresa, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) throw error;

      const [config, agente, session, clientes, profissionais, servicos] = await Promise.all([
        supabase.from('configuracoes').select('*').eq('company_id', companyId).maybeSingle(),
        supabase.from('agente_config').select('*').eq('company_id', companyId).maybeSingle(),
        supabase.from('whatsapp_sessions').select('*').eq('company_id', companyId).maybeSingle(),
        supabase.from('clientes').select('id').eq('company_id', companyId),
        supabase.from('profissionais').select('id').eq('company_id', companyId),
        supabase.from('servicos').select('id').eq('company_id', companyId)
      ]);

      return {
        success: true,
        empresa: {
          ...empresa,
          configuracao: config.data,
          agente: agente.data,
          whatsapp_status: session.data?.status || 'disconnected',
          whatsapp_qr: session.data?.qr_code || null,
          stats: {
            total_clientes: clientes.data?.length || 0,
            total_profissionais: profissionais.data?.length || 0,
            total_servicos: servicos.data?.length || 0
          }
        }
      };
    } catch (error) {
      console.error('❌ Erro ao buscar empresa:', error);
      throw error;
    }
  },

  // ✅ FUNÇÃO AUXILIAR: GERAR SLUG
  gerarSlug(nome: string) {
    return nome
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  },

  // ✅ CRIAR NOVA EMPRESA (DIRETO SUPABASE)
  async criarEmpresa(nome: string, descricao?: string, whatsappNumber?: string, setupFee: number = 0, monthlyFee: number = 0) {
    try {
      const slug = this.gerarSlug(nome);

      // 1. Inserir Empresa
      const { data: empresa, error } = await supabase
        .from('companies')
        .insert([{
          name: nome,
          slug,
          descricao,
          whatsapp_number: whatsappNumber,
          setup_fee: setupFee,
          monthly_fee: monthlyFee,
          subscription_status: 'active',
          active: true,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // 2. Criar Usuário (Migrado do Backend)
      const email = `${slug}@agendezap.com`;
      const senha = '123';
      const { error: errorUser } = await supabase
        .from('usuarios')
        .insert([{
          email,
          senha,
          role: 'empresa',
          company_id: empresa.id,
          nome,
          created_at: new Date().toISOString()
        }]);

      if (errorUser) console.error('Erro ao criar usuário:', errorUser);

      // 3. Criar Configuração Padrão (Migrado do Backend)
      await supabase.from('configuracoes').insert([{
        company_id: empresa.id,
        nome_estabelecimento: nome,
        hora_abertura: '09:00',
        hora_fechamento: '18:00',
        intervalo_agendamento: 30,
        dias_funcionamento: [1, 2, 3, 4, 5],
        created_at: new Date().toISOString()
      }]);

      // 4. Criar Agente Padrão (Migrado do Backend)
      await supabase.from('agente_config').insert([{
        company_id: empresa.id,
        nome_agente: `Atendente ${nome}`,
        prompt: `Você é um assistente de agendamento profissional para ${nome}. Seja educado, conciso e helpful.`,
        created_at: new Date().toISOString()
      }]);

      return {
        success: true,
        empresa,
        credenciais: { email, senha }
      };
    } catch (error) {
      console.error('❌ Erro ao criar empresa:', error);
      throw error;
    }
  },

  // ✅ ATUALIZAR EMPRESA (DIRETO SUPABASE)
  async atualizarEmpresa(companyId: string, dados: any) {
    try {
      const { data, error } = await supabase
        .from('companies')
        .update({
          ...(dados.nome && { name: dados.nome }),
          ...(dados.descricao && { descricao: dados.descricao }),
          ...(dados.whatsappNumber && { whatsapp_number: dados.whatsappNumber }),
          ...(dados.active !== undefined && { active: dados.active }),
          ...(dados.setupFee !== undefined && { setup_fee: dados.setupFee }),
          ...(dados.monthlyFee !== undefined && { monthly_fee: dados.monthlyFee }),
          ...(dados.subscriptionStatus && { subscription_status: dados.subscriptionStatus }),
          updated_at: new Date().toISOString()
        })
        .eq('id', companyId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, empresa: data };
    } catch (error) {
      console.error('❌ Erro ao atualizar empresa:', error);
      throw error;
    }
  },

  // ✅ DELETAR EMPRESA (Limpando tudo manualmente para evitar erros de FK)
  async desativarEmpresa(companyId: string) {
    try {
      console.log('🗑️ Iniciando processo de deleção completa da empresa:', companyId);

      // 1. Tentar desconectar WhatsApp no backend (silenciosamente)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        await fetch(`${API_URL}/whatsapp/logout/${companyId}`, {
          method: 'POST',
          signal: controller.signal,
          mode: 'no-cors'
        }).catch(() => { });
        clearTimeout(timeoutId);
      } catch (e) {
        // Ignora totalmente
      }

      // 2. DELETAR DADOS RELACIONADOS (Ordem importa para FKs)
      console.log('   - Limpando tabelas vinculadas...');

      const tabelas = [
        'financeiro',
        'agendamentos',
        'whatsapp_messages',
        'whatsapp_conversations',
        'whatsapp_sessions',
        'agente_config',
        'configuracoes',
        'profissionais',
        'servicos',
        'clientes',
        'usuarios'
      ];

      for (const tabela of tabelas) {
        console.log(`     > Liberando registros de ${tabela}...`);
        try {
          const { error: tableError } = await supabase
            .from(tabela)
            .delete()
            .eq('company_id', companyId);

          if (tableError) {
            console.warn(`     ⚠️ Supabase retornou erro em ${tabela}:`, tableError);

            // ESTRATÉGIA DE CONTORNO PARA ERRO 500 em whatsapp_conversations
            // Se falhar em massa, tenta buscar IDs e deletar um por um
            if (tabela === 'whatsapp_conversations') {
              console.log(`     🔄 Tentando estratégia granular para ${tabela} (apenas IDs)...`);
              // Simplificado: apenas ID para evitar erro 400 se coluna client_phone não existir/for restrita
              const { data: itens } = await supabase.from(tabela).select('id').eq('company_id', companyId);

              if (itens && itens.length > 0) {
                console.log(`        Encontrados ${itens.length} itens. Deletando individualmente...`);
                for (const item of itens) {
                  try {
                    await supabase.from(tabela).delete().eq('id', item.id);
                  } catch (e) {
                    console.error('Erro delete item:', e);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error(`     ❌ Erro de exceção ao deletar de ${tabela}:`, e);
        }
      }

      // 3. Deletar a Empresa por último
      console.log('   - Removendo registro da empresa...');
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (error) {
        console.error('❌ Erro Supabase ao deletar empresa:', error);

        // Diagnóstico rápido
        let diagnostic = "";
        try {
          const { data: rem } = await supabase.from('whatsapp_conversations').select('id').eq('company_id', companyId).limit(1);
          if (rem && rem.length > 0) diagnostic = " (Existem conversas vinculadas que o Supabase não permitiu deletar - Erro 500)";
        } catch (e) { }

        throw new Error(`Falha ao remover registro final da empresa: ${error.message}${diagnostic}`);
      }

      console.log('✅ Empresa e todos os dados relacionados removidos com sucesso!');
      return { success: true, message: 'Empresa deletada com sucesso' };
    } catch (error: any) {
      console.error('❌ Erro ao desativar empresa:', error);
      throw error;
    }
  },

  // ✅ CONECTAR WHATSAPP (Via Backend)
  async conectarWhatsApp(companyId: string, name: string) {
    try {
      const response = await axios.post(`${API_URL}/whatsapp/connect/${companyId}`, { name });
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao conectar WhatsApp:', error);
      throw error;
    }
  },

  // ✅ DESCONECTAR WHATSAPP (Via Backend)
  async desconectarWhatsApp(companyId: string) {
    try {
      const response = await axios.post(`${API_URL}/whatsapp/logout/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao desconectar WhatsApp:', error);
      throw error;
    }
  },

  // ✅ GET STATUS SESSÃO WHATSAPP (Via Backend para Sincronização Real-time)
  async getStatusWhatsApp(companyId: string) {
    try {
      const response = await axios.get(`${API_URL}/whatsapp/status/${companyId}`);
      return {
        status: response.data?.status || 'disconnected',
        qr_code: response.data?.qr || null,
        updated_at: response.data?.updated_at
      };
    } catch (error) {
      console.error('❌ Erro ao buscar status WhatsApp:', error);
      // Fallback pro banco se o backend falhar
      const { data } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      return {
        status: data?.status || 'disconnected',
        qr_code: data?.qr_code || null,
        updated_at: data?.updated_at
      };
    }
  },

  // ✅ GET ANALYTICS: VENDAS POR CATEGORIA (DIRETO SUPABASE)
  async getSalesByCategory(companyId?: string) {
    try {
      let query = supabase
        .from('agendamentos')
        .select('id, servicos!inner(nome)')
        .eq('status', 'confirmado');

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data: agendamentos, error } = await query;

      if (error) throw error;

      const categorias: Record<string, number> = {
        'Cabelo': 0,
        'Barba': 0,
        'Pele': 0,
        'Combo': 0,
        'Outros': 0
      };

      agendamentos?.forEach((ag: any) => {
        const nome = ag.servicos?.nome?.toLowerCase() || '';
        if (nome.includes('combo') || (nome.includes('cabelo') && nome.includes('barba'))) {
          categorias['Combo']++;
        } else if (nome.includes('cabelo') || nome.includes('corte') || nome.includes('cortar')) {
          categorias['Cabelo']++;
        } else if (nome.includes('barba')) {
          categorias['Barba']++;
        } else if (nome.includes('pele') || nome.includes('limpeza')) {
          categorias['Pele']++;
        } else {
          categorias['Outros']++;
        }
      });

      return Object.entries(categorias)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));
    } catch (error) {
      console.error('❌ Erro ao buscar analytics:', error);
      throw error;
    }
  },

  // ✅ CRM: BUSCAR CONVERSAS (DIRETO SUPABASE)
  async buscarConversasCRM(companyId: string) {
    try {
      const response = await axios.get(`${API_URL}/api/crm/conversations/${companyId}`);
      return response.data?.data || [];
    } catch (error) {
      console.error('❌ Erro CRM Conversas:', error);
      throw error;
    }
  },

  // ✅ CRM: BUSCAR MENSAGENS (DIRETO SUPABASE)
  async buscarMensagensCRM(companyId: string, clientPhone: string) {
    try {
      const response = await axios.get(`${API_URL}/api/crm/messages/${companyId}/${clientPhone}`);
      const data = response.data?.data || [];
      console.log(`✅ [CRM] ${data.length} mensagens encontradas.`);
      return data;
    } catch (error) {
      console.error('❌ Erro CRM Mensagens:', error);
      throw error;
    }
  },

  // ✅ CRM: ESTATÍSTICAS (DIRETO SUPABASE)
  async buscarEstatisticasCRM(companyId: string) {
    try {
      console.log(`📊 [CRM] Buscando estatísticas para empresa: ${companyId}`);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('direction, created_at')
        .eq('company_id', companyId);

      if (error) {
        console.error('❌ Erro Supabase CRM Stats:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ Nenhuma mensagem encontrada para calcular estatísticas.');
        return { total: 0, incoming: 0, outgoing: 0, today: 0 };
      }

      const hoje = new Date().toISOString().split('T')[0];

      const stats = {
        total: data.length,
        incoming: data.filter(m => m.direction === 'incoming').length,
        outgoing: data.filter(m => m.direction === 'outgoing').length,
        today: data.filter(m => m.created_at && m.created_at.startsWith(hoje)).length
      };

      console.log('✅ [CRM] Estatísticas calculadas:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Erro CRM Stats:', error);
      throw error;
    }
  },

  // ✅ CRM: ENVIAR MENSAGEM (VIA BACKEND)
  async enviarMensagemCRM(companyId: string, clientPhone: string, message: string) {
    try {
      const response = await axios.post(`${API_URL}/api/crm/send-message`, {
        companyId,
        clientPhone,
        message
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem CRM:', error);
      throw error;
    }
  }
};
