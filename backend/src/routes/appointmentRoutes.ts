import express from 'express';
import { NotificationService } from '../services/notificationService.js';

const router = express.Router();

/**
 * Rota para notificar o profissional manualmente
 * Útil quando o agendamento é criado diretamente pelo frontend via Supabase
 */
router.post('/notify-new', async (req, res) => {
    try {
        const { companyId, appointmentId } = req.body;

        if (!companyId || !appointmentId) {
            return res.status(400).json({ 
                success: false, 
                error: 'companyId e appointmentId são obrigatórios' 
            });
        }

        console.log(`📣 [API] Solicitando notificação para agendamento: ${appointmentId}`);
        
        // Dispara a notificação em background
        NotificationService.notifyProfessionalNewAppointment(companyId, appointmentId).catch(err => {
            console.error('❌ [API] Erro ao notificar profissional:', err);
        });

        res.json({ 
            success: true, 
            message: 'Notificação enfileirada com sucesso' 
        });

    } catch (error: any) {
        console.error('❌ [API] Erro na rota de notificação:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

export default router;
