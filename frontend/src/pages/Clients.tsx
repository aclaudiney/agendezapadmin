import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, Edit2, X, AlertCircle, Cake } from 'lucide-react';

const Clients: React.FC = () => {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [erro, setErro] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    data_nascimento: '',
  });

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('clientes').select('*').order('nome', { ascending: true });
      if (!error) setClientes(data || []);
    } catch (error) {
      setErro('Erro ao carregar clientes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Função para calcular idade
  const calcularIdade = (dataNascimento: string | null) => {
    if (!dataNascimento) return null;
    
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mesAtual = hoje.getMonth();
    const mesNascimento = nascimento.getMonth();
    
    if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    
    return idade;
  };

  // Função para verificar se é aniversário hoje
  const ehAniversarioHoje = (dataNascimento: string | null) => {
    if (!dataNascimento) return false;
    
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    
    return (
      hoje.getDate() === nascimento.getDate() &&
      hoje.getMonth() === nascimento.getMonth()
    );
  };

  // Função para formatar data para o padrão brasileiro
  const formatarDataBR = (data: string | null) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formData.nome) {
      setErro('Preencha o nome');
      return;
    }

    try {
      const dataToSave = {
        nome: formData.nome,
        telefone: formData.telefone || null,
        email: formData.email || null,
        data_nascimento: formData.data_nascimento || null,
      };

      if (editingId) {
        // Atualizar
        const { error } = await supabase
          .from('clientes')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) {
          setErro('Erro ao atualizar cliente');
          console.error(error);
          return;
        }
      } else {
        // Criar novo
        const { error } = await supabase.from('clientes').insert([dataToSave]);

        if (error) {
          setErro('Erro ao criar cliente');
          console.error(error);
          return;
        }
      }

      setFormData({ nome: '', telefone: '', email: '', data_nascimento: '' });
      setEditingId(null);
      setShowModal(false);
      fetchClientes();
    } catch (error) {
      setErro('Erro ao salvar cliente');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este cliente?')) return;

    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id);

      if (error) {
        setErro('Erro ao deletar cliente');
        return;
      }

      fetchClientes();
    } catch (error) {
      setErro('Erro ao deletar');
      console.error(error);
    }
  };

  const handleEdit = (cliente: any) => {
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone || '',
      email: cliente.email || '',
      data_nascimento: cliente.data_nascimento || '',
    });
    setEditingId(cliente.id);
    setShowModal(true);
  };

  const openNewModal = () => {
    setFormData({ nome: '', telefone: '', email: '', data_nascimento: '' });
    setEditingId(null);
    setShowModal(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-slate-500">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Base de Clientes</h2>
          <p className="text-slate-500">Gerencie todos os clientes do seu salão.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Novo Cliente
        </button>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Telefone</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Aniversário</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Idade</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientes.map(cliente => {
                const isAniversario = ehAniversarioHoje(cliente.data_nascimento);
                const idade = calcularIdade(cliente.data_nascimento);
                
                return (
                  <tr 
                    key={cliente.id} 
                    className={`hover:bg-slate-50/50 transition-colors ${isAniversario ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800">{cliente.nome}</p>
                        {isAniversario && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
                            <Cake size={12} />
                            Parabéns!
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">{cliente.telefone || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">{cliente.email || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 font-medium">
                        {formatarDataBR(cliente.data_nascimento)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">
                        {idade !== null ? `${idade} anos` : '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(cliente)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(cliente.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deletar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {clientes.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-400 mb-4">Nenhum cliente cadastrado</p>
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg mx-auto"
          >
            <Plus size={18} />
            Adicionar Primeiro Cliente
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800">
                {editingId ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            {erro && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{erro}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome Completo *</label>
                <input 
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Telefone</label>
                <input 
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="joao@email.com"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Data de Nascimento</label>
                <input 
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {formData.data_nascimento && (
                  <p className="text-xs text-slate-500 mt-1">
                    Idade: {calcularIdade(formData.data_nascimento)} anos
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;