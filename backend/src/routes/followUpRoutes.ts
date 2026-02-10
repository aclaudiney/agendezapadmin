import express from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../supabase.js';
import { FollowUpService } from '../services/followUpService.js';
import { sessions } from '../whatsapp.js';

const router = express.Router();

// ✅ STATUS DO WHATSAPP
router.get('/status/:companyId', (req, res) => {
    const { companyId } = req.params;
    const session = sessions.get(companyId);
    res.json({
        success: true,
        status: session?.status || 'disconnected'
    });
});

// ================================
// Persistência simples em arquivo
// ================================
const baseDir = path.resolve(process.cwd(), 'backend', 'logs');
const ensureDir = () => {
  try {
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  } catch {}
};
const getModesFile = (companyId: string) => path.join(baseDir, `followup_modes_${companyId}.json`);
const readModes = (companyId: string) => {
  ensureDir();
  const file = getModesFile(companyId);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const writeModes = (companyId: string, modes: any[]) => {
  ensureDir();
  const file = getModesFile(companyId);
  try {
    fs.writeFileSync(file, JSON.stringify(modes, null, 2));
    return true;
  } catch {
    return false;
  }
};

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

        // Carregar modos de arquivo
        const fileModes = readModes(companyId);

        // Mapear configuração única para modo padrão
        const defaultMode = {
          id: 'default',
          name: 'Padrão',
          is_active: settings.is_active,
          warning_time: settings.warning_time,
          reminder_minutes: settings.reminder_minutes,
          message_template_warning: settings.message_template_warning,
          message_template_reminder: settings.message_template_reminder,
          trigger_type: 'time_fixed',
          trigger_days: null
        };

        // Evitar duplicar 'default' se já existir em arquivo
        const hasDefault = fileModes.some((m: any) => m.id === 'default');
        const modes = hasDefault ? fileModes : [defaultMode, ...fileModes];

        res.json({ success: true, settings, modes });
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

// ================================
// Modos de Follow-up (multi-estratégia)
// ================================
router.get('/modes/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const modes = readModes(companyId);
    res.json({ success: true, modes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/modes/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const mode = req.body;
    if (!mode || !mode.name) {
      return res.status(400).json({ error: 'Nome do modo é obrigatório' });
    }
    let modes = readModes(companyId);
    const id = mode.id || String(Date.now());
    const triggerType = mode.trigger_type || (mode.trigger_days !== undefined && mode.trigger_days !== null ? 'dias_apos' : 'time_fixed');
    const triggerDays = triggerType === 'dias_apos' ? (mode.trigger_days ?? 10) : null;
    const novo = {
      id,
      name: mode.name,
      is_active: !!mode.is_active,
      warning_time: mode.warning_time || '08:00:00',
      reminder_minutes: mode.reminder_minutes ?? 60,
      message_template_warning: mode.message_template_warning || '',
      message_template_reminder: mode.message_template_reminder || '',
      trigger_type: triggerType,
      trigger_days: triggerDays
    };
    modes = [novo, ...modes.filter((m: any) => m.id !== id)];
    if (!writeModes(companyId, modes)) {
      return res.status(500).json({ error: 'Falha ao persistir modos' });
    }
    res.json({ success: true, mode: novo, modes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/modes/:companyId/:modeId', async (req, res) => {
  try {
    const { companyId, modeId } = req.params;
    const patch = req.body || {};
    let modes = readModes(companyId);
    const idx = modes.findIndex((m: any) => String(m.id) === String(modeId));
    if (idx < 0) {
      return res.status(404).json({ error: 'Modo não encontrado' });
    }
    const next = { ...modes[idx], ...patch };
    if (!next.trigger_type) {
      next.trigger_type = (next.trigger_days !== undefined && next.trigger_days !== null) ? 'dias_apos' : 'time_fixed';
    }
    if (next.trigger_type !== 'dias_apos') {
      next.trigger_days = null;
    }
    modes[idx] = next;
    if (!writeModes(companyId, modes)) {
      return res.status(500).json({ error: 'Falha ao persistir modos' });
    }
    res.json({ success: true, mode: modes[idx], modes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/modes/:companyId/:modeId', async (req, res) => {
  try {
    const { companyId, modeId } = req.params;
    let modes = readModes(companyId);
    const next = modes.filter((m: any) => String(m.id) !== String(modeId));
    if (!writeModes(companyId, next)) {
      return res.status(500).json({ error: 'Falha ao persistir modos' });
    }
    res.json({ success: true, modes: next });
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
