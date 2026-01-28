import express from 'express';
import cors from 'cors';
import 'dotenv/config';
// ✅ ADICIONADO .js (Obrigatório para Node ESM)
import { connectToWhatsApp, initAllSessions, desconectarWhatsApp } from './whatsapp.js';
import { db, supabase } from './supabase.js'; 
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

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
const verificarEmpresaAtiva = async (req: any, res: any, next: any) => {
  const { companyId } = req.params;
  
  if (!companyId) return next();

  try {
    const empresa = await db.getEmpresa(companyId);
    
    if (!empresa) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

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
// ✅ ROTAS (VERSÃO LIMPA E CORRIGIDA)
// ============================================

app.get('/verify-company/:companyId', async (req, res) => {
    const { companyId } = req.params;
    try {
        const empresa = await db.getEmpresa(companyId);
        if (!empresa) return res.status(404).json({ error: "Não encontrada", ativa: false });
        if (!empresa.active) return res.status(403).json({ error: "Bloqueada", ativa: false, bloqueada: true });

        res.json({
            success: true,
            ativa: true,
            empresa: { id: empresa.id, name: empresa.name, active: empresa.active }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/whatsapp/connect/:companyId', verificarEmpresaAtiva, async (req, res) => {
    const { companyId } = req.params;
    try {
        const empresa = req.empresa;
        console.log(`📱 Iniciando conexão WhatsApp para: ${empresa.name}`);
        await connectToWhatsApp(companyId, empresa.name);
        res.json({ success: true, message: `Iniciando conexão para ${empresa.name}`, status: 'connecting' });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Erro ao iniciar conexão" });
    }
});

app.get('/whatsapp/status/:companyId', verificarEmpresaAtiva, async (req, res) => {
    const { companyId } = req.params;
    try {
        const session = await db.getSessionaWhatsApp(companyId);
        if (!session) return res.json({ status: 'disconnected', qr: null });
        res.json({ status: session.status, qr: session.qr_code || null, updated_at: session.updated_at });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/whatsapp/logout/:companyId', verificarEmpresaAtiva, async (req, res) => {
    const { companyId } = req.params;
    try {
        await desconectarWhatsApp(companyId);
        res.json({ success: true, status: 'disconnected' });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Erro ao desconectar" });
    }
});

// ============================================
// 🏢 ROTAS SUPERADMIN
// ============================================

app.get('/admin/companies', async (req, res) => {
    try {
        const companies = await db.listarEmpresas();
        const companiesComStatus = await Promise.all(
            companies.map(async (company: any) => {
                const session = await db.getSessionaWhatsApp(company.id);
                return { ...company, whatsapp_status: session?.status || 'disconnected' };
            })
        );
        res.json({ success: true, companies: companiesComStatus });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/admin/companies', async (req, res) => {
    const { nome } = req.body;
    try {
        if (!nome) return res.status(400).json({ error: "Nome obrigatório" });
        const slug = gerarSlug(nome);
        const { data: empresa, error } = await supabase.from('companies').insert([{ name: nome, slug, active: true, created_at: new Date().toISOString() }]).select().single();

        if (error || !empresa) throw new Error("Erro ao criar empresa no banco");

        const email = `${slug}@agendezap.com`;
        const senha = '123';
        await supabase.from('usuarios').insert([{ email, senha, role: 'empresa', company_id: empresa.id, nome, created_at: new Date().toISOString() }]);

        await db.atualizarConfiguracao(empresa.id, { nome_estabelecimento: nome, hora_abertura: '09:00', hora_fechamento: '18:00' });
        await db.atualizarAgenteConfig(empresa.id, { nome_agente: `Atendente ${nome}`, prompt: `Você é um assistente profissional para ${nome}.` });

        res.status(201).json({ success: true, empresa, credenciais: { email, senha } });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 👥 ROTAS NEGÓCIO (CRUD)
// ============================================

app.get('/companies/:companyId/clientes', verificarEmpresaAtiva, async (req, res) => {
    try { res.json({ success: true, clientes: await db.listarClientes(req.params.companyId) }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/companies/:companyId/profissionais', verificarEmpresaAtiva, async (req, res) => {
    try { res.json({ success: true, profissionais: await db.getProfissionais(req.params.companyId) }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/companies/:companyId/servicos', verificarEmpresaAtiva, async (req, res) => {
    try { res.json({ success: true, servicos: await db.getServicos(req.params.companyId) }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/companies/:companyId/agendamentos', verificarEmpresaAtiva, async (req, res) => {
    try { res.json({ success: true, agendamentos: await db.getAgendamentos(req.params.companyId, req.query as any) }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// 🚀 INICIALIZAÇÃO DO SERVIDOR
// ============================================

app.listen(PORT, async () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 AGENDEZAP BACKEND - ONLINE`);
    console.log(`📊 Porta: ${PORT}`);
    console.log(`🏗️  Modo: MULTI-TENANT`);
    console.log(`${'='.repeat(60)}\n`);

    console.log("🔄 Restaurando sessões WhatsApp...\n");
    await initAllSessions();

    console.log(`\n✅ Servidor pronto! Acesse em: http://localhost:${PORT}`);
    console.log(`📋 Rotas disponíveis:`);
    console.log(`   - Verificar Empresa: GET /verify-company/:companyId`);
    console.log(`   - WhatsApp Status:   GET /whatsapp/status/:companyId`);
    console.log(`   - WhatsApp Connect:  POST /whatsapp/connect/:companyId`);
    console.log(`   - WhatsApp Logout:   POST /whatsapp/logout/:companyId`);
    console.log(`   - SuperAdmin:        GET /admin/companies`);
    console.log(`   - Criar Empresa:     POST /admin/companies\n`);
});