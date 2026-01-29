import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { API_URL } from '../config/api';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface LoginProps {
  onLoginSuccess: () => void;
}

interface Usuario {
  id: string;
  email: string;
  role: 'admin' | 'empresa';
  company_id?: string;
  nome?: string;
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
      // ✅ Buscar usuário com role
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, email, role, company_id, nome')
        .eq('email', email)
        .eq('senha', senha)
        .single();

      if (error || !data) {
        setErro('Email ou senha incorretos');
        return;
      }

      // ✅ Validar se role é válido
      if (!['admin', 'empresa'].includes(data.role)) {
        setErro('Erro: role inválido no banco de dados');
        return;
      }

      // ✅ SE FOR EMPRESA, VERIFICAR SE ESTÁ ATIVA
      if (data.role === 'empresa') {
        console.log('🔍 Verificando se empresa está ativa...');
        
        try {
          const resposta = await axios.get(
            `${API_URL}/verify-company/${data.company_id}`
          );

          if (!resposta.data.ativa) {
            console.error('❌ Empresa foi bloqueada');
            setErro('🚫 Sua empresa foi desativada pelo administrador');
            return;
          }

          console.log('✅ Empresa está ativa!');
        } catch (error: any) {
          if (error.response?.status === 403) {
            console.error('❌ Empresa bloqueada pelo Super Admin');
            setErro('🚫 Sua empresa foi desativada pelo administrador');
            return;
          } else {
            console.error('❌ Erro ao verificar empresa:', error);
            setErro('Erro ao verificar status da empresa. Tente novamente.');
            return;
          }
        }
      }

      // ✅ Salvar dados do usuário no localStorage
      const usuario: Usuario = {
        id: data.id,
        email: data.email,
        role: data.role,
        company_id: data.company_id,
        nome: data.nome
      };

      localStorage.setItem('usuario', JSON.stringify(usuario));
      localStorage.setItem('autenticado', 'true');
      localStorage.setItem('userRole', data.role);
      localStorage.setItem('companyId', data.company_id || '');

      console.log('✅ Login bem-sucedido:', usuario);

      // ✅ CALLBACK
      onLoginSuccess();

      // ✅ REDIRECIONAR BASEADO NO ROLE
      if (data.role === 'admin') {
        console.log('🔐 Redirecionando para painel ADMIN');
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 500);
      } else if (data.role === 'empresa') {
        console.log('🏢 Redirecionando para painel EMPRESA');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      }
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
          <p className="text-indigo-100">Sistema de Agendamento Multi-Empresa</p>
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
                  required
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
                  required
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

          {/* Credenciais de teste */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center mb-3"></p>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p><strong>👤 Admin:</strong></p>
                <p></p>
                <p></p>
              </div>
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <p><strong>🏢 Empresa:</strong></p>
                <p></p>
                <p></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;