import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ OBJETO CENTRALIZADO DE BANCO DE DADOS
// Todas as funções aqui têm company_id para multi-tenant
export const db = {
    // ============================================
    // 👥 FUNÇÕES DE CLIENTES
    // ============================================

    async getCliente(telefone: string, companyId: string) {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('telefone', telefone)
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .maybeSingle();

            if (error) {
                console.error("❌ Erro getCliente:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico getCliente:", error.message);
            return null;
        }
    },

    async getClienteById(clienteId: string, companyId: string) {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', clienteId)
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .single();

            if (error) {
                console.error("❌ Erro getClienteById:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico getClienteById:", error.message);
            return null;
        }
    },

    async criarCliente(nome: string, telefone: string, companyId: string, dataNascimento?: string) {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .insert([{
                    nome,
                    telefone,
                    company_id: companyId, // ✅ MULTI-TENANT
                    data_nascimento: dataNascimento || null,
                    created_at: new Date()
                }])
                .select()
                .single();

            if (error) {
                console.error("❌ Erro criarCliente:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico criarCliente:", error.message);
            return null;
        }
    },

    async listarClientes(companyId: string) {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .order('created_at', { ascending: false });

            if (error) {
                console.error("❌ Erro listarClientes:", error.message);
                return [];
            }

            return data || [];
        } catch (error: any) {
            console.error("❌ Erro crítico listarClientes:", error.message);
            return [];
        }
    },

    // ============================================
    // 👔 FUNÇÕES DE PROFISSIONAIS
    // ============================================

    async getProfissionais(companyId: string) {
        try {
            const { data, error } = await supabase
                .from('profissionais')
                .select('*')
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .order('nome', { ascending: true });

            if (error) {
                console.error("❌ Erro getProfissionais:", error.message);
                return [];
            }

            return data || [];
        } catch (error: any) {
            console.error("❌ Erro crítico getProfissionais:", error.message);
            return [];
        }
    },

    async getProfissionalById(profissionalId: string, companyId: string) {
        try {
            const { data, error } = await supabase
                .from('profissionais')
                .select('*')
                .eq('id', profissionalId)
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .single();

            if (error) {
                console.error("❌ Erro getProfissionalById:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico getProfissionalById:", error.message);
            return null;
        }
    },

    async criarProfissional(nome: string, companyId: string, telefone?: string, especialidade?: string) {
        try {
            const { data, error } = await supabase
                .from('profissionais')
                .insert([{
                    nome,
                    company_id: companyId, // ✅ MULTI-TENANT
                    telefone: telefone || null,
                    especialidade: especialidade || null,
                    created_at: new Date()
                }])
                .select()
                .single();

            if (error) {
                console.error("❌ Erro criarProfissional:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico criarProfissional:", error.message);
            return null;
        }
    },

    // ============================================
    // 🔧 FUNÇÕES DE SERVIÇOS
    // ============================================

    async getServicos(companyId: string) {
        try {
            const { data, error } = await supabase
                .from('servicos')
                .select('*')
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .order('nome', { ascending: true });

            if (error) {
                console.error("❌ Erro getServicos:", error.message);
                return [];
            }

            return data || [];
        } catch (error: any) {
            console.error("❌ Erro crítico getServicos:", error.message);
            return [];
        }
    },

    async getServicoById(servicoId: string, companyId: string) {
        try {
            const { data, error } = await supabase
                .from('servicos')
                .select('*')
                .eq('id', servicoId)
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .single();

            if (error) {
                console.error("❌ Erro getServicoById:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico getServicoById:", error.message);
            return null;
        }
    },

    async criarServico(nome: string, companyId: string, preco?: number, duracao?: number) {
        try {
            const { data, error } = await supabase
                .from('servicos')
                .insert([{
                    nome,
                    company_id: companyId, // ✅ MULTI-TENANT
                    preco: preco || 0,
                    duracao_minutos: duracao || 30,
                    created_at: new Date()
                }])
                .select()
                .single();

            if (error) {
                console.error("❌ Erro criarServico:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico criarServico:", error.message);
            return null;
        }
    },

    // ============================================
    // 📅 FUNÇÕES DE AGENDAMENTOS
    // ============================================

    async getAgendamentos(companyId: string, filtros?: any) {
        try {
            let query = supabase
                .from('agendamentos')
                .select('*')
                .eq('company_id', companyId); // ✅ MULTI-TENANT

            if (filtros?.profissionalId) {
                query = query.eq('profissional_id', filtros.profissionalId);
            }

            if (filtros?.clienteId) {
                query = query.eq('cliente_id', filtros.clienteId);
            }

            if (filtros?.data) {
                query = query.eq('data_agendamento', filtros.data);
            }

            if (filtros?.status) {
                query = query.eq('status', filtros.status);
            }

            const { data, error } = await query.order('data_agendamento', { ascending: true });

            if (error) {
                console.error("❌ Erro getAgendamentos:", error.message);
                return [];
            }

            return data || [];
        } catch (error: any) {
            console.error("❌ Erro crítico getAgendamentos:", error.message);
            return [];
        }
    },

    async getAgendamentoById(agendamentoId: string, companyId: string) {
        try {
            const { data, error } = await supabase
                .from('agendamentos')
                .select('*')
                .eq('id', agendamentoId)
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .single();

            if (error) {
                console.error("❌ Erro getAgendamentoById:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico getAgendamentoById:", error.message);
            return null;
        }
    },

    async criarAgendamento(agendamento: any, companyId: string) {
        try {
            const { data, error } = await supabase
                .from('agendamentos')
                .insert([{
                    ...agendamento,
                    company_id: companyId, // ✅ MULTI-TENANT
                    status: agendamento.status || 'pendente',
                    created_at: new Date()
                }])
                .select()
                .single();

            if (error) {
                console.error("❌ Erro criarAgendamento:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico criarAgendamento:", error.message);
            return null;
        }
    },

    async atualizarAgendamento(agendamentoId: string, companyId: string, atualizacoes: any) {
        try {
            const { data, error } = await supabase
                .from('agendamentos')
                .update({
                    ...atualizacoes,
                    updated_at: new Date()
                })
                .eq('id', agendamentoId)
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .select()
                .single();

            if (error) {
                console.error("❌ Erro atualizarAgendamento:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico atualizarAgendamento:", error.message);
            return null;
        }
    },

    async cancelarAgendamento(agendamentoId: string, companyId: string) {
        try {
            const { data, error } = await supabase
                .from('agendamentos')
                .update({
                    status: 'cancelado',
                    updated_at: new Date()
                })
                .eq('id', agendamentoId)
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .select()
                .single();

            if (error) {
                console.error("❌ Erro cancelarAgendamento:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico cancelarAgendamento:", error.message);
            return null;
        }
    },

    // ============================================
    // ⚙️ FUNÇÕES DE CONFIGURAÇÃO
    // ============================================

    async getConfiguracao(companyId: string) {
        try {
            const { data, error } = await supabase
                .from('configuracoes')
                .select('*')
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .single();

            if (error) {
                console.error("❌ Erro getConfiguracao:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico getConfiguracao:", error.message);
            return null;
        }
    },

    async atualizarConfiguracao(companyId: string, configuracao: any) {
        try {
            const { data, error } = await supabase
                .from('configuracoes')
                .upsert({
                    company_id: companyId, // ✅ MULTI-TENANT
                    ...configuracao,
                    updated_at: new Date()
                }, { onConflict: 'company_id' })
                .select()
                .single();

            if (error) {
                console.error("❌ Erro atualizarConfiguracao:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico atualizarConfiguracao:", error.message);
            return null;
        }
    },

    // ============================================
    // 🤖 FUNÇÕES DE CONFIGURAÇÃO DE AGENTE IA
    // ============================================

    async getAgenteConfig(companyId: string) {
        try {
            const { data, error } = await supabase
                .from('agente_config')
                .select('*')
                .eq('company_id', companyId) // ✅ MULTI-TENANT
                .single();

            if (error) {
                console.error("❌ Erro getAgenteConfig:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico getAgenteConfig:", error.message);
            return null;
        }
    },

    async atualizarAgenteConfig(companyId: string, config: any) {
        try {
            const { data, error } = await supabase
                .from('agente_config')
                .upsert({
                    company_id: companyId, // ✅ MULTI-TENANT
                    ...config,
                    updated_at: new Date()
                }, { onConflict: 'company_id' })
                .select()
                .single();

            if (error) {
                console.error("❌ Erro atualizarAgenteConfig:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico atualizarAgenteConfig:", error.message);
            return null;
        }
    },

    // ============================================
    // 🏢 FUNÇÕES DE EMPRESAS (SUPERADMIN)
    // ============================================

    async getEmpresa(companyId: string) {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (error) {
                console.error("❌ Erro getEmpresa:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico getEmpresa:", error.message);
            return null;
        }
    },

    async listarEmpresas() {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("❌ Erro listarEmpresas:", error.message);
                return [];
            }

            return data || [];
        } catch (error: any) {
            console.error("❌ Erro crítico listarEmpresas:", error.message);
            return [];
        }
    },

    async criarEmpresa(nome: string, descricao?: string, whatsappNumber?: string, setupFee: number = 0, monthlyFee: number = 0) {
        try {
            const { data, error } = await supabase
                .from('companies')
                .insert([{
                    name: nome,
                    descricao: descricao || null,
                    whatsapp_number: whatsappNumber || null,
                    setup_fee: setupFee,
                    monthly_fee: monthlyFee,
                    subscription_status: 'active',
                    active: true,
                    created_at: new Date()
                }])
                .select()
                .single();

            if (error) {
                console.error("❌ Erro criarEmpresa:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico criarEmpresa:", error.message);
            return null;
        }
    },

    async atualizarEmpresa(companyId: string, atualizacoes: any) {
        try {
            const { data, error } = await supabase
                .from('companies')
                .update({
                    ...atualizacoes,
                    updated_at: new Date()
                })
                .eq('id', companyId)
                .select()
                .single();

            if (error) {
                console.error("❌ Erro atualizarEmpresa:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico atualizarEmpresa:", error.message);
            return null;
        }
    },

    // ✅ DELETAR EMPRESA - CORRIGIDO (SEM .select())
    async desativarEmpresa(companyId: string) {
        try {
            console.log('🗑️ TENTANDO DELETAR EMPRESA:', companyId);

            const { error } = await supabase
                .from('companies')
                .delete()
                .eq('id', companyId);

            console.log('📊 Response error:', error);

            if (error) {
                console.error("❌ ERRO DETALHADO DO SUPABASE:", JSON.stringify(error, null, 2));
                return null;
            }

            console.log('✅ EMPRESA DELETADA COM SUCESSO!');
            return { success: true, message: "Empresa deletada com sucesso" };
        } catch (error: any) {
            console.error("❌ ERRO CRÍTICO desativarEmpresa:", error);
            return null;
        }
    },

    // ============================================
    // 📊 FUNÇÕES DE SESSÃO WHATSAPP
    // ============================================

    async getSessionaWhatsApp(companyId: string) {
        try {
            const { data, error } = await supabase
                .from('whatsapp_sessions')
                .select('*')
                .eq('company_id', companyId)
                .single();

            if (error) {
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro getSessionaWhatsApp:", error.message);
            return null;
        }
    },

    async atualizarSessionWhatsApp(companyId: string, status: string, qrCode?: string) {
        try {
            const { data, error } = await supabase
                .from('whatsapp_sessions')
                .upsert({
                    company_id: companyId,
                    status: status,
                    qr_code: qrCode || null,
                    updated_at: new Date()
                }, { onConflict: 'company_id' })
                .select()
                .single();

            if (error) {
                console.error("❌ Erro atualizarSessionWhatsApp:", error.message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("❌ Erro crítico atualizarSessionWhatsApp:", error.message);
            return null;
        }
    }
};