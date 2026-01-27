import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Mail, Lock, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      // Buscar usuário no banco
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('senha', senha)
        .single();

      if (error || !data) {
        setErro('Email ou senha incorretos');
        return;
      }

      // Salvar dados do usuário no localStorage
      localStorage.setItem('usuario', JSON.stringify(data));
      localStorage.setItem('autenticado', 'true');

      console.log('Login bem-sucedido:', data);
      onLoginSuccess();
    } catch (error) {
      setErro('Erro ao fazer login. Tente novamente.');
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">A</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">AgendeZap</h1>
          <p className="text-indigo-100">Sistema de Agendamento para Salões</p>
        </div>

        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Bem-vindo!</h2>

          {erro && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Botão Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Dados de teste */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center mb-3">Credenciais de teste:</p>
            <div className="bg-slate-50 p-3 rounded text-xs text-slate-600">
              <p><strong>Email:</strong> admin@agendezap.com</p>
              <p><strong>Senha:</strong> admin123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;