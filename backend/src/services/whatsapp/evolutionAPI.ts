import axios from 'axios';
import 'dotenv/config';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://agendezapadmin-evolution-api.q1ohgv.easypanel.host';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';
const WEBHOOK_GLOBAL_URL = process.env.WEBHOOK_GLOBAL_URL || 'https://agendezapadmin-agendezapadmin.q1ohgv.easypanel.host/webhooks/evolution';

export class EvolutionAPI {
    private apiKey: string;
    private baseURL: string;

    constructor() {
        this.apiKey = EVOLUTION_API_KEY;
        this.baseURL = EVOLUTION_API_URL;
    }

    // Headers padrão
    private getHeaders() {
        return {
            'Content-Type': 'application/json',
            'apikey': this.apiKey
        };
    }

    // ==================== INSTÂNCIAS ====================

    /**
     * Criar instância para uma empresa
     */
    async createInstance(companyId: string, companyName: string) {
        try {
            const response = await axios.post(
                `${this.baseURL}/instance/create`,
                {
                    instanceName: companyId,
                    token: this.apiKey,
                    qrcode: true,
                    integration: 'WHATSAPP-BAILEYS',
                    webhook: {
                        url: `${WEBHOOK_GLOBAL_URL}/${companyId}`,
                        webhook_by_events: true,
                        events: [
                            'MESSAGES_UPSERT',
                            'MESSAGES_UPDATE',
                            'CONNECTION_UPDATE',
                            'QRCODE_UPDATED'
                        ]
                    },
                    settings: {
                        reject_call: false,
                        msg_call: '',
                        groups_ignore: true,
                        always_online: false,
                        read_messages: false,
                        read_status: false,
                        sync_full_history: true
                    }
                },
                { headers: this.getHeaders() }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error: any) {
            const errorData = error.response?.data;

            // Tenta extrair a mensagem de erro de vários formatos possíveis da Evolution API
            const message = errorData?.response?.message?.[0] ||
                errorData?.message?.[0] ||
                errorData?.message ||
                error.message;

            // Silenciar erro de "já existe"
            if (message?.includes('already in use')) {
                return {
                    success: true,
                    alreadyExists: true,
                    data: errorData
                };
            }

            console.error(`❌ Erro ao criar instância ${companyId}:`, JSON.stringify(errorData || error.message, null, 2));
            return {
                success: false,
                error: message
            };
        }
    }

    /**
     * Conectar instância (gera QR Code)
     */
    async connectInstance(companyId: string) {
        try {
            console.log(`🔌 [Evolution] Chamando /instance/connect/${companyId}`);
            const response = await axios.get(
                `${this.baseURL}/instance/connect/${companyId}`,
                { headers: this.getHeaders() }
            );

            console.log(`✅ [Evolution] Resposta connect:`, response.status, JSON.stringify(response.data).substring(0, 200));
            return {
                success: true,
                data: response.data
            };
        } catch (error: any) {
            console.error(`❌ [Evolution] Erro ao conectar ${companyId}:`, error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    async getQRCode(companyId: string) {
        try {
            const response = await axios.get(
                `${this.baseURL}/instance/qrcode/${companyId}`,
                { headers: this.getHeaders() }
            );

            const data = response.data as any;

            // Evolution API v2 pode retornar em diferentes formatos:
            // 1. qrcode.base64 (formato antigo)
            // 2. base64 (direto)
            // 3. code (código de pareamento que precisa ser convertido em QR)
            const qrcodeBase64 = data.qrcode?.base64 || data.base64 || data.qrcode;
            const pairingCode = data.pairingCode || data.code;

            console.log(`📱 [Evolution] QR Code recebido:`, {
                hasBase64: !!qrcodeBase64,
                hasPairingCode: !!pairingCode,
                codePreview: pairingCode ? pairingCode.substring(0, 50) + '...' : null
            });

            return {
                success: true,
                qrcode: qrcodeBase64,
                pairingCode: pairingCode
            };
        } catch (error: any) {
            console.error(`❌ [Evolution] Erro ao buscar QR Code:`, error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Status da conexão
     */
    async getConnectionStatus(companyId: string) {
        try {
            const response = await axios.get(
                `${this.baseURL}/instance/connectionState/${companyId}`,
                { headers: this.getHeaders() }
            );

            const data = response.data as any;
            const state = data.instance?.state || data.state;

            return {
                success: true,
                state: state, // 'open', 'close', 'connecting', 'disconnected'
                instance: data.instance
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Logout da instância
     */
    async logoutInstance(companyId: string) {
        try {
            await axios.delete(
                `${this.baseURL}/instance/logout/${companyId}`,
                { headers: this.getHeaders() }
            );

            return { success: true };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Deletar instância
     */
    async deleteInstance(companyId: string) {
        try {
            await axios.delete(
                `${this.baseURL}/instance/delete/${companyId}`,
                { headers: this.getHeaders() }
            );

            return { success: true };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Configurar/Atualizar Webhook da instância
     */
    async setWebhook(companyId: string) {
        try {
            console.log(`🔗 [Evolution] Sincronizando webhook v2 para ${companyId}...`);
            const webhookUrl = `${WEBHOOK_GLOBAL_URL}/${companyId}`;

            // Tentativa 1: Endpoint v2 padrão
            const response = await axios.post(
                `${this.baseURL}/webhook/instance/set/${companyId}`,
                {
                    url: webhookUrl,
                    enabled: true,
                    webhook_by_events: true,
                    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                },
                { headers: this.getHeaders() }
            );

            console.log(`✅ [Evolution] Webhook v2 sincronizado com sucesso para ${companyId}`);
            return { success: true, data: response.data };
        } catch (error: any) {
            console.log(`⚠️ [Evolution] Falha no v2 para ${companyId}, tentando modo compatibilidade...`);
            return this.setWebhookLegacy(companyId);
        }
    }

    private async setWebhookLegacy(companyId: string) {
        try {
            console.log(`🔗 [Evolution] Sincronizando webhook (modo compatibilidade) para ${companyId}...`);
            const response = await axios.post(
                `${this.baseURL}/webhook/set/${companyId}`,
                {
                    // A Evolution API às vezes exige o objeto 'webhook' aninhado
                    webhook: {
                        enabled: true,
                        url: `${WEBHOOK_GLOBAL_URL}/${companyId}`,
                        webhook_by_events: true,
                        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                    }
                },
                { headers: this.getHeaders() }
            );
            console.log(`✅ [Evolution] Webhook (modo compatibilidade) sincronizado com sucesso para ${companyId}`);
            return { success: true, data: response.data };
        } catch (e: any) {
            const errorData = e.response?.data;
            console.log(`⚠️ [Evolution] Falha no modo compatibilidade para ${companyId}: ${JSON.stringify(errorData || e.message)}, tentando modo settings...`);
            return this.setWebhookUltraLegacy(companyId);
        }
    }

    private async setWebhookUltraLegacy(companyId: string) {
        try {
            console.log(`🔗 [Evolution] Sincronizando webhook (modo settings) para ${companyId}...`);
            // Em algumas versões v2, o webhook é configurado via instance/settings
            const response = await axios.post(
                `${this.baseURL}/instance/instanceSettings/${companyId}`,
                {
                    webhook_url: `${WEBHOOK_GLOBAL_URL}/${companyId}`,
                    webhook_enabled: true,
                    webhook_by_events: true,
                    webhook_events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                },
                { headers: this.getHeaders() }
            );
            console.log(`✅ [Evolution] Webhook (modo settings) sincronizado com sucesso para ${companyId}`);
            return { success: true, data: response.data };
        } catch (e: any) {
            // Último recurso: Tenta o endpoint global da instância se tudo falhar
            try {
                console.log(`🔗 [Evolution] Tentando recurso final para ${companyId}...`);
                await axios.post(
                    `${this.baseURL}/instance/webhook/set/${companyId}`,
                    {
                        url: `${WEBHOOK_GLOBAL_URL}/${companyId}`,
                        enabled: true
                    },
                    { headers: this.getHeaders() }
                );
                console.log(`✅ [Evolution] Webhook (recurso final) sincronizado para ${companyId}`);
                return { success: true };
            } catch (finalErr: any) {
                console.error(`❌ [Evolution] Falha total ao configurar webhook para ${companyId}`);
                return { success: false, error: finalErr.message };
            }
        }
    }

    // ==================== MENSAGENS ====================

    /**
     * Enviar mensagem de texto
     */
    async sendTextMessage(companyId: string, number: string, text: string) {
        try {
            // Normalizar número: Evolution API geralmente prefere apenas os dígitos
            const cleanNumber = number.replace(/\D/g, '');

            console.log(`🚀 [Evolution] Enviando texto para ${cleanNumber} (empresa: ${companyId})`);

            const response = await axios.post(
                `${this.baseURL}/message/sendText/${companyId}`,
                {
                    number: cleanNumber,
                    text: text,
                    delay: 1200
                },
                { headers: this.getHeaders() }
            );

            console.log(`✅ [Evolution] Mensagem enviada com sucesso! ID: ${(response.data as any).key?.id}`);
            return {
                success: true,
                messageId: (response.data as any).key?.id,
                data: response.data
            };
        } catch (error: any) {
            const errorData = error.response?.data;
            console.error(`❌ [Evolution] Erro ao enviar mensagem para ${number}:`, JSON.stringify(errorData || error.message, null, 2));
            return {
                success: false,
                error: errorData?.message || error.message
            };
        }
    }

    /**
     * Enviar mídia (imagem, áudio, etc)
     */
    async sendMediaMessage(
        companyId: string,
        number: string,
        mediaUrl: string,
        mediaType: 'image' | 'audio' | 'video' | 'document',
        caption?: string
    ) {
        try {
            const cleanNumber = number.replace(/\D/g, '');
            console.log(`🚀 [Evolution] Enviando mídia (${mediaType}) para ${cleanNumber}`);

            const response = await axios.post(
                `${this.baseURL}/message/sendMedia/${companyId}`,
                {
                    number: cleanNumber,
                    mediatype: mediaType,
                    media: mediaUrl,
                    caption: caption || '',
                    delay: 1200
                },
                { headers: this.getHeaders() }
            );

            console.log(`✅ [Evolution] Mídia enviada com sucesso! ID: ${(response.data as any).key?.id}`);
            return {
                success: true,
                messageId: (response.data as any).key?.id,
                data: response.data
            };
        } catch (error: any) {
            const errorData = error.response?.data;
            console.error(`❌ [Evolution] Erro ao enviar mídia para ${number}:`, JSON.stringify(errorData || error.message, null, 2));
            return {
                success: false,
                error: errorData?.message || error.message
            };
        }
    }

    /**
     * Marcar como lido
     */
    async markAsRead(companyId: string, messageId: string, remoteJid: string) {
        try {
            await axios.post(
                `${this.baseURL}/chat/markMessageAsRead/${companyId}`,
                {
                    readMessages: [
                        {
                            id: messageId,
                            fromMe: false,
                            remoteJid: remoteJid
                        }
                    ]
                },
                { headers: this.getHeaders() }
            );

            return { success: true };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Download de mídia (áudio, imagem, etc)
     */
    async downloadMedia(messageId: string, companyId: string) {
        try {
            console.log(`📥 [Evolution] Baixando mídia da mensagem ${messageId}...`);
            const response = await axios.get(
                `${this.baseURL}/message/downloadMedia/${companyId}/${messageId}`,
                { 
                    headers: this.getHeaders(),
                    responseType: 'arraybuffer' 
                }
            );
            return Buffer.from(response.data);
        } catch (error: any) {
            console.error(`❌ [Evolution] Erro no downloadMedia:`, error.response?.data || error.message);
            return null;
        }
    }

    // ==================== PERFIL ====================

    /**
     * Pegar informações do perfil
     */
    async getProfileInfo(companyId: string) {
        try {
            const response = await axios.get(
                `${this.baseURL}/instance/fetchInstances/${companyId}`,
                { headers: this.getHeaders() }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

// Export singleton
export const evolutionAPI = new EvolutionAPI();
