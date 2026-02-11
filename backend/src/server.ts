import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { db, supabase } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import crmRoutes from './routes/crmRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import { FollowUpService } from './services/followUpService.js';
import { evolutionAPI } from './services/whatsapp/evolutionAPI.js';
import evolutionWebhooks from './routes/webhooks.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ✅ ROTAS CRM & WEBHOOKS
app.use('/api/crm', crmRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/follow-up', followUpRoutes);
app.use('/webhooks', evolutionWebhooks);

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

const verificarSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    const configuredKey = process.env.SUPER_ADMIN_API_KEY;
    if (!configuredKey) {
        return res.status(503).json({ error: 'Super Admin não configurado' });
    }

    const headerKey = req.header('x-super-admin-key');
    const authorization = req.header('authorization');
    const bearerToken = authorization?.toLowerCase().startsWith('bearer ')
        ? authorization.slice('bearer '.length)
        : undefined;

    const providedKey = headerKey || bearerToken;
    if (!providedKey || providedKey !== configuredKey) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    next();
};

// ============================================
// 🤖 ROTAS WHATSAPP (EVOLUTION API)
// ============================================

// ✅ INICIAR CONEXÃO WHATSAPP
app.post('/whatsapp/connect/:companyId', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const empresa = req.empresa;
        console.log(`📱 Solicitando criação de instância Evolution para: ${empresa.name}`);

        // 1. Garante que a instância existe
        const createResult = await evolutionAPI.createInstance(companyId, empresa.name);
        console.log(`✅ Resultado createInstance:`, createResult.success ? 'Sucesso' : `Erro: ${createResult.error}`);

        if (!createResult.success && !(createResult as any).alreadyExists) {
            return res.status(500).json({ error: createResult.error });
        }

        // 2. Conecta a instância para gerar o QR Code
        console.log(`🔌 Iniciando conexão para ${companyId}...`);
        const connectResult = await evolutionAPI.connectInstance(companyId);
        console.log(`✅ Resultado connectInstance:`, connectResult.success ? 'Sucesso' : `Erro: ${connectResult.error}`);

        if (!connectResult.success) {
            console.error(`❌ Falha ao conectar: ${connectResult.error}`);
            return res.status(500).json({
                error: connectResult.error,
                message: "Instância criada mas falhou ao conectar"
            });
        }

        // 3. Salva o código de pareamento no banco para gerar QR Code depois
        const pairingCode = (connectResult.data as any)?.code || (connectResult.data as any)?.pairingCode;
        if (pairingCode) {
            console.log(`💾 Salvando código de pareamento no banco...`);
            await supabase.from('whatsapp_sessions').upsert({
                company_id: companyId,
                status: 'connecting',
                qr_code: pairingCode, // Salva o código de pareamento aqui
                updated_at: new Date()
            }, { onConflict: 'company_id' });
        }

        res.json({
            success: true,
            message: `Conexão iniciada para ${empresa.name}. Aguarde o QR Code.`,
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
        // 1. Sempre pergunta pra Evolution primeiro (Fonte da Verdade)
        const result = await evolutionAPI.getConnectionStatus(companyId);

        if (result.success) {
            const state = result.state === 'open' || result.state === 'connected' ? 'connected' : result.state;

            // Sincroniza com o banco se o status mudou
            const session = await db.getSessionaWhatsApp(companyId);
            if (!session || session.status !== state) {
                await supabase.from('whatsapp_sessions').upsert({
                    company_id: companyId,
                    status: state,
                    qr_code: state === 'connected' ? null : (session?.qr_code || null),
                    updated_at: new Date()
                }, { onConflict: 'company_id' });
            }

            // Se não está conectado, aguarda o QR Code vir via webhook
            let qr = null;
            if (state !== 'connected') {
                // Busca o QR Code salvo no banco (que veio via webhook)
                const session = await db.getSessionaWhatsApp(companyId);
                const savedQR = session?.qr_code;

                // Verifica se é um QR Code em Base64 (começa com "data:image")
                if (savedQR && savedQR.startsWith('data:image')) {
                    qr = savedQR;
                    console.log(`✅ QR Code Base64 encontrado no banco`);
                } else if (savedQR) {
                    console.log(`⚠️ Código de pareamento encontrado, aguardando QR Code via webhook...`);
                    qr = null; // Não tenta converter, espera o webhook
                } else {
                    console.log(`⚠️ Nenhum QR Code encontrado, aguardando webhook...`);
                }
            }

            return res.json({
                status: state,
                qr: qr,
                message: "Status sincronizado com Evolution API",
                updated_at: new Date().toISOString()
            });
        }

        // 2. Fallback pro banco se a Evolution falhar (instância não existe, etc)
        const session = await db.getSessionaWhatsApp(companyId);
        res.json({
            status: session?.status || 'disconnected',
            qr: session?.qr_code || null,
            updated_at: session?.updated_at,
            error_evolution: result.error
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/whatsapp/delete-instance/:companyId', verificarSuperAdmin, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const empresa = await db.getEmpresa(companyId);
        if (!empresa) {
            return res.status(404).json({ error: "Empresa não encontrada" });
        }

        console.log(`🧨 Removendo instância Evolution para: ${empresa.name} (${companyId})`);

        const logoutResult = await evolutionAPI.logoutInstance(companyId);
        if (!logoutResult.success) {
            console.warn(`⚠️ Falha ao desconectar instância antes de deletar (${companyId}): ${logoutResult.error}`);
        }

        const deleteResult = await evolutionAPI.deleteInstance(companyId);
        if (!deleteResult.success) {
            return res.status(502).json({ error: deleteResult.error || 'Falha ao deletar instância na Evolution API' });
        }

        await supabase.from('whatsapp_sessions').delete().eq('company_id', companyId);
        await supabase.from('whatsapp_messages').delete().eq('company_id', companyId);
        const convDelete = await supabase.from('whatsapp_conversations').delete().eq('company_id', companyId);
        if (convDelete.error && !String(convDelete.error.message || '').toLowerCase().includes('view')) {
            console.warn(`⚠️ Falha ao limpar whatsapp_conversations (${companyId}): ${convDelete.error.message}`);
        }

        res.json({
            success: true,
            message: `Instância ${companyId} removida definitivamente.`,
            status: 'deleted'
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Erro ao deletar instância" });
    }
});

// ✅ DESCONECTAR WHATSAPP (LOGOUT)
app.post('/whatsapp/logout/:companyId', verificarEmpresaAtiva, async (req: RequestWithCompanyId, res: Response) => {
    const { companyId } = req.params;

    try {
        const empresa = req.empresa;
        console.log(`🚪 Desconectando Evolution API para: ${empresa.name}`);

        const logoutResult = await evolutionAPI.logoutInstance(companyId);
        if (!logoutResult.success) {
            console.warn(`⚠️ Falha ao desconectar instância (${companyId}): ${logoutResult.error}`);
        }

        const updateResult = await supabase.from('whatsapp_sessions')
            .update({
                status: 'disconnected',
                updated_at: new Date()
            })
            .eq('company_id', companyId)
            .select('company_id');

        if (updateResult.error) {
            console.warn(`⚠️ Falha ao atualizar whatsapp_sessions (${companyId}): ${updateResult.error.message}`);
        }

        if (!updateResult.data || updateResult.data.length === 0) {
            const insertResult = await supabase.from('whatsapp_sessions').insert({
                company_id: companyId,
                status: 'disconnected',
                updated_at: new Date()
            });
            if (insertResult.error) {
                console.warn(`⚠️ Falha ao inserir whatsapp_sessions (${companyId}): ${insertResult.error.message}`);
            }
        }

        res.json({
            success: true,
            message: `WhatsApp desconectado para ${empresa.name}.`,
            status: 'disconnected',
            warning: logoutResult.success ? undefined : logoutResult.error
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Erro ao desconectar" });
    }
});

// ... (Rest of routes: admin, configs, clientes, etc. remain the same)

// ✅ INICIALIZAR TODAS AS SESSOES (Restaurar)
const initAllEvolutionInstances = async () => {
    try {
        const { data: companies, error } = await supabase
            .from('companies')
            .select('id, name')
            .eq('active', true);

        if (error) {
            console.error("Erro ao buscar empresas no Supabase:", error);
            return;
        }

        if (companies && companies.length > 0) {
            console.log(`Verificando/Restaurando ${companies.length} instâncias na Evolution...\n`);
            for (const c of companies) {
                try {
                    // Pequeno delay para não sobrecarregar a API da Evolution em massa
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Tenta criar a instância (se não existir)
                    const res = await evolutionAPI.createInstance(c.id, c.name);

                    // Garante que o Webhook está apontando para o servidor configurado no .env
                    await evolutionAPI.setWebhook(c.id);

                    if ((res as any).alreadyExists) {
                        console.log(`- ${c.name}: Pronto (Instância ativa)`);
                    } else {
                        console.log(`- ${c.name}: Criada e configurada com sucesso`);
                    }
                } catch (e: any) {
                    console.error(`- Erro ao inicializar ${c.name}:`, e.message);
                }
            }
            console.log(`\n✅ Sincronização de instâncias concluída.`);
        }
    } catch (error) {
        console.error('Erro ao inicializar sessoes:', error);
    }
};

// ... (app.listen at the end)

app.listen(PORT, async () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 AGENDEZAP BACKEND - ONLINE`);
    console.log(`📊 Porta: ${PORT}`);
    console.log(`🏗️  Modo: EVOLUTION API (até 1000 empresas)`);
    console.log(`${'='.repeat(60)}\n`);

    console.log("🔄 Verificando empresas ativas...\n");
    await initAllEvolutionInstances();

    console.log(`\n✅ Servidor pronto! Acesse em: http://localhost:${PORT}`);
    // ... rest of console logs
});
