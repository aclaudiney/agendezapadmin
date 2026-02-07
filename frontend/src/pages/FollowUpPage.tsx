import React, { useState, useEffect } from 'react';
import {
    Save,
    Clock,
    MessageSquare,
    AlertCircle,
    ToggleLeft,
    ToggleRight,
    CheckCircle2,
    Bell,
    Send,
    Phone
} from 'lucide-react';

const FollowUpPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // States para teste
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('Olá! Este é um teste do AgendeZap.');

    const [settings, setSettings] = useState({
        is_active: false,
        warning_time: '08:00',
        reminder_minutes: 60,
        message_template_warning: '',
        message_template_reminder: ''
    });

    const companyId = localStorage.getItem('companyId');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            if (!companyId) return;
            const response = await fetch(`http://localhost:3001/api/follow-up/settings/${companyId}`);
            const data = await response.json();

            if (data.success && data.settings) {
                setSettings({
                    ...data.settings,
                    warning_time: data.settings.warning_time.slice(0, 5) // HH:mm:ss -> HH:mm
                });
            }
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            setMessage({ text: 'Erro Conecte o Whatsapp.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch(`http://localhost:3001/api/follow-up/settings/${companyId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ text: 'Configurações salvas com sucesso!', type: 'success' });
            } else {
                setMessage({ text: 'Erro ao salvar: ' + data.error, type: 'error' });
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            setMessage({ text: 'Erro ao salvar alterações.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleTestSend = async () => {
        if (!testPhone) {
            setMessage({ text: 'Digite um número de telefone para o teste.', type: 'error' });
            return;
        }

        setTesting(true);
        setMessage(null);

        try {
            const response = await fetch(`http://localhost:3001/api/crm/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    clientPhone: testPhone.replace(/\D/g, ''), // Remove não numéricos
                    message: testMessage
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ text: 'Mensagem de teste enviada com sucesso!', type: 'success' });
            } else {
                // Caso específico de erro de conexão
                if (data.error && data.error.includes('não está conectado')) {
                    setMessage({ text: 'WhatsApp desconectado. Conecte no menu "Conectar WhatsApp".', type: 'error' });
                } else {
                    setMessage({ text: 'Erro ao enviar teste: ' + (data.error || 'Erro desconhecido'), type: 'error' });
                }
            }

        } catch (error) {
            console.error('Erro no teste:', error);
            setMessage({ text: 'Erro ao conectar com servidor.', type: 'error' });
        } finally {
            setTesting(false);
        }
    };

    const insertVariable = (templateKey: 'message_template_warning' | 'message_template_reminder', variable: string) => {
        setSettings(prev => ({
            ...prev,
            [templateKey]: prev[templateKey] + ` {${variable}}`
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="relative w-16 h-16">
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-10 animate-in fade-in duration-700">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Follow-up Automático</h1>
                    <p className="text-slate-500 mt-1">Configure o envio automático de mensagens para seus clientes.</p>
                </div>

                <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <span className={`text-sm font-bold ${settings.is_active ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {settings.is_active ? 'SISTEMA ATIVO' : 'SISTEMA INATIVO'}
                    </span>
                    <button
                        onClick={() => setSettings(s => ({ ...s, is_active: !s.is_active }))}
                        className="focus:outline-none transition-transform active:scale-95"
                    >
                        {settings.is_active
                            ? <ToggleRight className="w-10 h-10 text-emerald-500" />
                            : <ToggleLeft className="w-10 h-10 text-slate-400" />
                        }
                    </button>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                    } animate-in slide-in-from-top-2 duration-300`}>
                    {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUNA ESQUERDA - CONFIGURAÇÕES PRINCIPAIS */}
                <div className="lg:col-span-2 space-y-6">

                    {/* CARD: AVISO DO DIA */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-6">
                            <div className="p-3 bg-indigo-50 rounded-2xl">
                                <Clock className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Aviso do Dia</h3>
                                <p className="text-sm text-slate-500">Mensagem de bom dia enviada no início do expediente</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Horário */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Horário de envio</label>
                                <input
                                    type="time"
                                    value={settings.warning_time}
                                    onChange={(e) => setSettings({ ...settings, warning_time: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                                />
                            </div>

                            {/* Mensagem */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Template da Mensagem</label>
                                <textarea
                                    value={settings.message_template_warning}
                                    onChange={(e) => setSettings({ ...settings, message_template_warning: e.target.value })}
                                    rows={3}
                                    className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none bg-slate-50 focus:bg-white"
                                    placeholder="Digite a mensagem..."
                                />
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {['cliente_nome', 'horario', 'profissional'].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => insertVariable('message_template_warning', v)}
                                            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                        >
                                            + {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CARD: LEMBRETE PRÓXIMO */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-6">
                            <div className="p-3 bg-amber-50 rounded-2xl">
                                <Bell className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Lembrete de Agendamento</h3>
                                <p className="text-sm text-slate-500">Mensagem enviada pouco antes do horário marcado</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Tempo Antes */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Enviar antecedência</label>
                                <select
                                    value={settings.reminder_minutes}
                                    onChange={(e) => setSettings({ ...settings, reminder_minutes: parseInt(e.target.value) })}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 bg-white"
                                >
                                    <option value={15}>15 minutos antes</option>
                                    <option value={30}>30 minutos antes</option>
                                    <option value={60}>1 hora antes</option>
                                    <option value={120}>2 horas antes</option>
                                </select>
                            </div>

                            {/* Mensagem */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Template da Mensagem</label>
                                <textarea
                                    value={settings.message_template_reminder}
                                    onChange={(e) => setSettings({ ...settings, message_template_reminder: e.target.value })}
                                    rows={3}
                                    className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none bg-slate-50 focus:bg-white"
                                    placeholder="Digite a mensagem..."
                                />
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {['cliente_nome', 'minutos', 'profissional'].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => insertVariable('message_template_reminder', v)}
                                            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                        >
                                            + {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BOTÃO SALVAR */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
                        >
                            <Save size={20} />
                            {saving ? 'Salvando...' : 'Salvar Configurações'}
                        </button>
                    </div>

                </div>

                {/* COLUNA DIREITA - TESTE E DICAS */}
                <div className="space-y-6">

                    {/* CARD DE TESTE */}
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl shadow-lg text-white">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-white/20 rounded-xl">
                                <MessageSquare size={20} className="text-white" />
                            </div>
                            <h3 className="text-lg font-bold">Testar Envio</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-1 block">Número (com DDD)</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3.5 text-indigo-300" size={16} />
                                    <input
                                        type="text"
                                        value={testPhone}
                                        onChange={(e) => setTestPhone(e.target.value)}
                                        placeholder="ex: 5511999999999"
                                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-indigo-300 focus:bg-white/20 focus:outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-1 block">Mensagem</label>
                                <textarea
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    rows={2}
                                    className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-indigo-300 focus:bg-white/20 focus:outline-none transition-all text-sm resize-none"
                                />
                            </div>

                            <button
                                onClick={handleTestSend}
                                disabled={testing}
                                className="w-full py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 mt-2"
                            >
                                {testing ? (
                                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Send size={18} /> Enviar Teste
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* DICAS */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <h4 className="font-bold text-slate-900 mb-3">Como funciona?</h4>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5"></div>
                                <span>O sistema verifica agendamentos automaticamente a cada minuto.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5"></div>
                                <span>Certifique-se que o WhatsApp está conectado para que as mensagens sejam enviadas.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5"></div>
                                <span>Use as variáveis <strong>{`{cliente_nome}`}</strong> para personalizar a mensagem.</span>
                            </li>
                        </ul>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default FollowUpPage;
