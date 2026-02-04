import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { connectToWhatsApp, initAllSessions, desconectarWhatsApp } from './whatsapp.js';
import { db, supabase } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';
import crmRoutes from './routes/crmRoutes.js'; // ✅ ADICIONADO!

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ✅ ROTAS CRM - ADICIONAR LOGO APÓS express.json()
app.use('/api/crm', crmRoutes); // ✅ NOVO!

// ✅ INTERFACE PARA TIPAR REQ.PARAMS CORRETAMENTE
interface RequestWithCompanyId extends Request {
  params: { companyId: string };
  empresa?: any;
}

interface RequestWithCompanyAndClientId extends Request {
  params: { companyId: string; clienteId: string };
}

interface RequestWithCompanyAndAgendamentoId extends Request {
  params: { companyId: string; agendamentoId: string };
}

// ✅ FUNÇÃO GERAR SLUG
const gerarSlug = (nome: string): string => {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
};

// ============================================
// 🔐 MIDDLEWARE - VERIFICAR SE EMPRESA ESTÁ ATIVA
// ============================================

const verificarEmpresaAtiva = async (req: RequestWithCompanyId, res: Response, next: NextFunction) => {
  const { companyId } = req.params;
  
  if (!companyId) {
    return next();
  }

  try {
    const empresa = await db.getEmpresa(companyId);
    
    if (!empresa) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    // ❌ SE EMPRESA ESTÁ BLOQUEADA
    if (!empresa.active) {
      return res.status(403).json({ 
        error: "Empresa bloqueada",
        message: "Esta empresa foi desativada e não pode acessar o sistema",
        bloqueada: true
      });
    }

    req.empresa = empresa;
    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// ✅ ROTA VERIFICAR SE EMPRESA ESTÁ ATIVA
// ============================================

app.get('/verify-company/:companyId', async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;
    
    console.log('🔍 [VERIFY-COMPANY] Requisição recebida:', companyId);

    try {
        const empresa = await db.getEmpresa(companyId);
        
        console.log('🔍 [VERIFY-COMPANY] Empresa encontrada:', empresa?.name);
        
        if (!empresa) {
            console.log('❌ [VERIFY-COMPANY] Empresa não encontrada');
            return res.status(404).json({ 
                error: "Empresa não encontrada",
                ativa: false
            });
        }

        // ❌ SE EMPRESA ESTÁ BLOQUEADA
        if (!empresa.active) {
            console.log('❌ [VERIFY-COMPANY] Empresa bloqueada');
            return res.status(403).json({ 
                error: "Empresa bloqueada",
                message: "Esta empresa foi desativada e não pode acessar o sistema",
                ativa: false,
                bloqueada: true
            });
        }

        // ✅ EMPRESA ATIVA
        console.log('✅ [VERIFY-COMPANY] Sucesso! Empresa ativa');
        res.json({
            success: true,
            ativa: true,
            empresa: {
                id: empresa.id,
                name: empresa.name,
                active: empresa.active
            }
        });
    } catch (error: any) {
        console.error('❌ [VERIFY-COMPANY] Erro:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 🤖 ROTAS WHATSAPP (MULTI-TENANT) - CORRIGIDO
// ============================================

// ✅ INICIAR CONEXÃO WHATSAPP
app.post('/whatsapp/connect/:companyId', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const empresa = req.empresa;
        console.log(`📱 Iniciando conexão WhatsApp para: ${empresa.name}`);

        await connectToWhatsApp(companyId, empresa.name);
        
        res.json({
            success: true,
            message: `Iniciando conexão para ${empresa.name}`,
            company_id: companyId,
            status: 'connecting'
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Erro ao iniciar conexão" });
    }
});

// ✅ VERIFICAR STATUS DA CONEXÃO
app.get('/whatsapp/status/:companyId', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const session = await db.getSessionaWhatsApp(companyId);
        
        if (!session) {
            return res.json({
                status: 'disconnected',
                qr: null,
                message: "Sem sessão ativa"
            });
        }

        res.json({
            status: session.status,
            qr: session.qr_code || null,
            updated_at: session.updated_at
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ DESCONECTAR WHATSAPP (LOGOUT)
app.post('/whatsapp/logout/:companyId', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const empresa = req.empresa;
        console.log(`🚪 Desconectando WhatsApp para: ${empresa.name}`);

        await desconectarWhatsApp(companyId);
        
        res.json({
            success: true,
            message: `Sessão ${companyId} encerrada e limpa.`,
            status: 'disconnected'
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Erro ao desconectar" });
    }
});

// ROTAS ANTIGAS (mantidas para compatibilidade)
app.post('/connect/:companyId', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;
    const { name } = req.body;

    try {
        const empresa = req.empresa;

        await connectToWhatsApp(companyId, name || empresa.name);
        res.json({
            success: true,
            message: `Iniciando conexão para ${empresa.name}`,
            company_id: companyId
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Erro ao iniciar conexão" });
    }
});

app.post('/disconnect/:companyId', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        await desconectarWhatsApp(companyId);
        res.json({
            success: true,
            message: `Sessão ${companyId} encerrada e limpa.`
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Erro ao desconectar" });
    }
});

app.get('/session/:companyId', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const session = await db.getSessionaWhatsApp(companyId);
        
        if (!session) {
            return res.json({
                status: 'disconnected',
                qr_code: null,
                message: "Sem sessão ativa"
            });
        }

        res.json({
            status: session.status,
            qr_code: session.qr_code || null,
            updated_at: session.updated_at
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 🏢 ROTAS SUPERADMIN - EMPRESAS
// ============================================

app.get('/admin/companies', async (req: Request, res: Response) => {
    try {
        const companies = await db.listarEmpresas();
        
        const companiesComStatus = await Promise.all(
            companies.map(async (company: any) => {
                const session = await db.getSessionaWhatsApp(company.id);
                return {
                    ...company,
                    whatsapp_status: session?.status || 'disconnected',
                    whatsapp_qr: session?.qr_code || null
                };
            })
        );

        res.json({
            success: true,
            total: companiesComStatus.length,
            companies: companiesComStatus
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/admin/companies/:companyId', async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const empresa = await db.getEmpresa(companyId);
        
        if (!empresa) {
            return res.status(404).json({ error: "Empresa não encontrada" });
        }

        const [config, agente, session, clientes, profissionais, servicos] = await Promise.all([
            db.getConfiguracao(companyId),
            db.getAgenteConfig(companyId),
            db.getSessionaWhatsApp(companyId),
            db.listarClientes(companyId),
            db.getProfissionais(companyId),
            db.getServicos(companyId)
        ]);

        res.json({
            success: true,
            empresa: {
                ...empresa,
                configuracao: config,
                agente: agente,
                whatsapp_status: session?.status || 'disconnected',
                whatsapp_qr: session?.qr_code || null,
                stats: {
                    total_clientes: clientes.length,
                    total_profissionais: profissionais.length,
                    total_servicos: servicos.length
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ CRIAR NOVA EMPRESA - COM USUÁRIO E CREDENCIAIS
app.post('/admin/companies', async (req: Request, res: Response) => {
    const { nome, descricao, whatsappNumber } = req.body;

    try {
        if (!nome) {
            return res.status(400).json({ error: "Nome da empresa é obrigatório" });
        }

        // ✅ GERAR SLUG
        const slug = gerarSlug(nome);

        // ✅ INSERIR EMPRESA
        const { data: empresa, error } = await supabase
            .from('companies')
            .insert([{
                name: nome,
                slug: slug,
                active: true,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error || !empresa) {
            console.error('❌ Erro ao criar empresa:', error);
            return res.status(500).json({ error: "Erro ao criar empresa no banco" });
        }

        // ✅ CRIAR USUÁRIO PARA A EMPRESA
        const email = `${slug}@agendezap.com`;
        const senha = '123';
        
        console.log('👤 Criando usuário para empresa:', email);
        
        const { data: usuario, error: erroUsuario } = await supabase
            .from('usuarios')
            .insert([{
                email: email,
                senha: senha,
                role: 'empresa',
                company_id: empresa.id,
                nome: nome,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (erroUsuario) {
            console.error('❌ Erro ao criar usuário:', erroUsuario);
        } else {
            console.log('✅ Usuário criado com sucesso!');
        }

        // ✅ CRIAR CONFIGURAÇÃO PADRÃO
        const configPadrao = {
            nome_estabelecimento: nome,
            hora_abertura: '09:00',
            hora_fechamento: '18:00',
            intervalo_agendamento: 30,
            dias_funcionamento: [1, 2, 3, 4, 5]
        };

        await db.atualizarConfiguracao(empresa.id, configPadrao);

        // ✅ CRIAR AGENTE PADRÃO
        const agentePadrao = {
            nome_agente: `Atendente ${nome}`,
            prompt: `Você é um assistente de agendamento profissional para ${nome}. Seja educado, conciso e helpful.`
        };

        await db.atualizarAgenteConfig(empresa.id, agentePadrao);

        // ✅ RETORNAR COM CREDENCIAIS
        res.status(201).json({
            success: true,
            message: "Empresa criada com sucesso",
            empresa: {
                ...empresa,
                configuracao: configPadrao,
                agente: agentePadrao
            },
            credenciais: {
                email: email,
                senha: senha,
                message: "Guarde essas credenciais para acessar o painel"
            }
        });
    } catch (error: any) {
        console.error('❌ Erro criarEmpresa:', error);
        res.status(500).json({ error: error.message || "Erro ao criar empresa" });
    }
});

app.put('/admin/companies/:companyId', async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;
    const { nome, descricao, whatsappNumber, active } = req.body;

    try {
        const atualizacoes: any = {};
        if (nome) atualizacoes.name = nome;
        if (descricao) atualizacoes.descricao = descricao;
        if (whatsappNumber) atualizacoes.whatsapp_number = whatsappNumber;
        if (active !== undefined) atualizacoes.active = active;

        const empresa = await db.atualizarEmpresa(companyId, atualizacoes);

        if (!empresa) {
            return res.status(404).json({ error: "Empresa não encontrada" });
        }

        res.json({
            success: true,
            message: "Empresa atualizada com sucesso",
            empresa
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ DELETAR EMPRESA - DELETA USUÁRIOS PRIMEIRO
app.delete('/admin/companies/:companyId', async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        console.log('🗑️ Iniciando exclusão da empresa:', companyId);

        // ✅ DESCONECTAR WHATSAPP
        try {
            await desconectarWhatsApp(companyId);
            console.log('✅ WhatsApp desconectado');
        } catch (e) {
            console.log("⚠️ WhatsApp já desconectado");
        }

        // ✅ DELETAR USUÁRIOS DA EMPRESA PRIMEIRO
        console.log('🗑️ Deletando usuários da empresa...');
        const { error: erroUsuarios } = await supabase
            .from('usuarios')
            .delete()
            .eq('company_id', companyId);

        if (erroUsuarios) {
            console.error('❌ Erro ao deletar usuários:', erroUsuarios);
        } else {
            console.log('✅ Usuários deletados!');
        }

        // ✅ DEPOIS DELETAR A EMPRESA
        console.log('🗑️ Deletando empresa...');
        const { error: erroEmpresa } = await supabase
            .from('companies')
            .delete()
            .eq('id', companyId);

        if (erroEmpresa) {
            console.error('❌ Erro ao deletar empresa:', erroEmpresa);
            return res.status(500).json({ error: "Erro ao deletar empresa" });
        }

        console.log('✅ Empresa deletada com sucesso!');

        res.json({
            success: true,
            message: "Empresa e seus usuários foram deletados com sucesso"
        });
    } catch (error: any) {
        console.error('❌ Erro crítico:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ⚙️ ROTAS CONFIGURAÇÃO (MULTI-TENANT)
// ============================================

app.get('/companies/:companyId/config', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const config = await db.getConfiguracao(companyId);

        if (!config) {
            return res.status(404).json({ error: "Configuração não encontrada" });
        }

        res.json({ success: true, config });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/companies/:companyId/config', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;
    const configuracao = req.body;

    try {
        const config = await db.atualizarConfiguracao(companyId, configuracao);

        if (!config) {
            return res.status(500).json({ error: "Erro ao atualizar configuração" });
        }

        res.json({
            success: true,
            message: "Configuração atualizada com sucesso",
            config
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 🤖 ROTAS CONFIGURAÇÃO DE AGENTE (MULTI-TENANT)
// ============================================

app.get('/companies/:companyId/agent-config', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const config = await db.getAgenteConfig(companyId);

        if (!config) {
            return res.status(404).json({ error: "Configuração de agente não encontrada" });
        }

        res.json({ success: true, config });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/companies/:companyId/agent-config', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;
    const { nomeAgente, prompt } = req.body;

    try {
        const atualizacoes: any = {};
        if (nomeAgente) atualizacoes.nome_agente = nomeAgente;
        if (prompt) atualizacoes.prompt = prompt;

        const config = await db.atualizarAgenteConfig(companyId, atualizacoes);

        if (!config) {
            return res.status(500).json({ error: "Erro ao atualizar configuração de agente" });
        }

        res.json({
            success: true,
            message: "Configuração de agente atualizada com sucesso",
            config
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 👥 ROTAS CLIENTES (MULTI-TENANT)
// ============================================

app.get('/companies/:companyId/clientes', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const clientes = await db.listarClientes(companyId);
        res.json({ success: true, total: clientes.length, clientes });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/companies/:companyId/clientes/:clienteId', verificarEmpresaAtiva, async (req: RequestWithCompanyAndClientId, res: Response) => {
    const { companyId, clienteId } = req.params;

    try {
        const cliente = await db.getClienteById(clienteId, companyId);

        if (!cliente) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }

        res.json({ success: true, cliente });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 👔 ROTAS PROFISSIONAIS (MULTI-TENANT)
// ============================================

app.get('/companies/:companyId/profissionais', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const profissionais = await db.getProfissionais(companyId);
        res.json({ success: true, total: profissionais.length, profissionais });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/companies/:companyId/profissionais', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;
    const { nome, telefone, especialidade } = req.body;

    try {
        if (!nome) {
            return res.status(400).json({ error: "Nome do profissional é obrigatório" });
        }

        const profissional = await db.criarProfissional(nome, companyId, telefone, especialidade);

        if (!profissional) {
            return res.status(500).json({ error: "Erro ao criar profissional" });
        }

        res.status(201).json({
            success: true,
            message: "Profissional criado com sucesso",
            profissional
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 🔧 ROTAS SERVIÇOS (MULTI-TENANT)
// ============================================

app.get('/companies/:companyId/servicos', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const servicos = await db.getServicos(companyId);
        res.json({ success: true, total: servicos.length, servicos });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/companies/:companyId/servicos', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;
    const { nome, preco, duracao } = req.body;

    try {
        if (!nome) {
            return res.status(400).json({ error: "Nome do serviço é obrigatório" });
        }

        const servico = await db.criarServico(nome, companyId, preco, duracao);

        if (!servico) {
            return res.status(500).json({ error: "Erro ao criar serviço" });
        }

        res.status(201).json({
            success: true,
            message: "Serviço criado com sucesso",
            servico
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 📅 ROTAS AGENDAMENTOS (MULTI-TENANT)
// ============================================

app.get('/companies/:companyId/agendamentos', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;
    const { profissionalId, clienteId, data, status } = req.query;

    try {
        const filtros = {
            profissionalId: profissionalId as string,
            clienteId: clienteId as string,
            data: data as string,
            status: status as string
        };

        const agendamentos = await db.getAgendamentos(companyId, filtros);
        res.json({ success: true, total: agendamentos.length, agendamentos });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/companies/:companyId/agendamentos/:agendamentoId', verificarEmpresaAtiva, async (req: RequestWithCompanyAndAgendamentoId, res: Response) => {
    const { companyId, agendamentoId } = req.params;

    try {
        const agendamento = await db.getAgendamentoById(agendamentoId, companyId);

        if (!agendamento) {
            return res.status(404).json({ error: "Agendamento não encontrado" });
        }

        res.json({ success: true, agendamento });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/companies/:companyId/agendamentos/:agendamentoId/cancel', verificarEmpresaAtiva, async (req: RequestWithCompanyAndAgendamentoId, res: Response) => {
    const { companyId, agendamentoId } = req.params;

    try {
        const agendamento = await db.cancelarAgendamento(agendamentoId, companyId);

        if (!agendamento) {
            return res.status(404).json({ error: "Agendamento não encontrado" });
        }

        res.json({
            success: true,
            message: "Agendamento cancelado com sucesso",
            agendamento
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 🚀 INICIALIZAÇÃO DO SERVIDOR
// ============================================

app.listen(PORT, async () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 AGENDEZAP BACKEND - ONLINE`);
    console.log(`📊 Porta: ${PORT}`);
    console.log(`🏗️  Modo: MULTI-TENANT (até 1000 empresas)`);
    console.log(`${'='.repeat(60)}\n`);

    console.log("🔄 Restaurando sessões WhatsApp...\n");
    await initAllSessions();

    console.log(`\n✅ Servidor pronto! Acesse em: http://localhost:${PORT}`);
    console.log(`📋 Rotas disponíveis:`);
    console.log(`   - Verificar Empresa: GET /verify-company/:companyId`);
    console.log(`   - WhatsApp Status: GET /whatsapp/status/:companyId`);
    console.log(`   - WhatsApp Connect: POST /whatsapp/connect/:companyId`);
    console.log(`   - WhatsApp Logout: POST /whatsapp/logout/:companyId`);
    console.log(`   - SuperAdmin: GET /admin/companies`);
    console.log(`   - Criar Empresa: POST /admin/companies`);
    console.log(`   - CRM Conversas: GET /api/crm/conversations/:companyId`); // ✅ NOVO!
    console.log(`   - CRM Mensagens: GET /api/crm/messages/:companyId/:phone`); // ✅ NOVO!
    console.log(`   - CRM Stats: GET /api/crm/stats/:companyId\n`); // ✅ NOVO!
});
