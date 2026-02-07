import express from 'express';
import { db } from '../supabase.js';
import { FollowUpService } from '../services/followUpService.js';

const router = express.Router();

// ============================================
// 🔔 ROTAS DE FOLLOW-UP
// ============================================

// ✅ OBTER CONFIGURAÇÕES
router.get('/settings/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;

        let settings = await db.getFollowUpSettings(companyId);

        // Se não existir, retorna padrão (ou nulo, frontend trata)
        if (!settings) {
            settings = {
                company_id: companyId,
                is_active: false,
                warning_time: '08:00:00',
                reminder_minutes: 60,
                message_template_warning: 'Olá {cliente_nome}, passando pra lembrar do seu agendamento hoje às {horario} com {profissional}.',
                message_template_reminder: 'Olá {cliente_nome}, seu agendamento é em {minutos} minutos! Estamos te esperando.'
            };
        }

        res.json({ success: true, settings });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ SALVAR CONFIGURAÇÕES
router.post('/settings/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const settings = req.body;

        const updated = await db.updateFollowUpSettings(companyId, settings);

        if (!updated) {
            return res.status(500).json({ error: "Erro ao salvar configurações" });
        }

        res.json({ success: true, settings: updated });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ FORÇAR VERIFICAÇÃO (PARA TESTES)
// POST /api/follow-up/check-now
router.post('/check-now', async (req, res) => {
    try {
        console.log('🔄 [FOLLOW-UP] Verificação manual solicitada via API');
        await FollowUpService.processAllCompanies();
        res.json({ success: true, message: "Verificação de follow-ups iniciada" });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ FORÇAR VERIFICAÇÃO DE EMPRESA ESPECÍFICA
// POST /api/follow-up/check/:companyId
router.post('/check/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log(`🔄 [FOLLOW-UP] Verificação manual solicitada para ${companyId}`);
        await FollowUpService.checkAndSendFollowUps(companyId);
        res.json({ success: true, message: `Verificação iniciada para empresa ${companyId}` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
