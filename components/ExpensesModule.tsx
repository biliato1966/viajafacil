import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DollarSign, Plus, Trash2 } from 'lucide-react';
import { Expense, ExpenseCategory } from '../types';

interface ExpensesModuleProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
}

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export const ExpensesModule: React.FC<ExpensesModuleProps> = ({ expenses, setExpenses }) => {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.FUEL);

  const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || !amount) return;
    const newExpense: Expense = {
      id: Date.now().toString(),
      description: desc,
      amount: parseFloat(amount),
      category,
      date: new Date().toISOString()
    };
    setExpenses(prev => [...prev, newExpense]);
    setDesc('');
    setAmount('');
  };

  const handleDelete = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // Prepare data for chart
  const chartData = Object.values(ExpenseCategory).map(cat => ({
    name: cat,
    value: expenses.filter(e => e.category === cat).reduce((a, b) => a + b.amount, 0)
  })).filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
          <DollarSign className="text-brand-500" /> Controle Financeiro
        </h3>
        <div className="text-right">
          <p className="text-xs text-gray-500">Total Gasto</p>
          <p className="font-bold text-xl text-brand-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 h-full">
        <div className="flex flex-col gap-4">
          <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-200">
            <div>
              <label className="text-xs text-gray-700 font-bold uppercase tracking-wide">Descrição</label>
              <input 
                value={desc} 
                onChange={e => setDesc(e.target.value)}
                className="w-full text-sm p-2.5 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none placeholder-gray-500 shadow-sm mt-1" 
                placeholder="Ex: Abastecimento"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-700 font-bold uppercase tracking-wide">Valor</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  className="w-full text-sm p-2.5 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none placeholder-gray-500 shadow-sm mt-1" 
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-xs text-gray-700 font-bold uppercase tracking-wide">Categoria</label>
                <select 
                  value={category}
                  onChange={e => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full text-sm p-2.5 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none shadow-sm mt-1"
                >
                  {Object.values(ExpenseCategory).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="w-full bg-brand-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-700 flex justify-center items-center gap-2 shadow-sm transition-colors">
              <Plus size={16} /> Adicionar Gasto
            </button>
          </form>

          <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2">
            {expenses.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Nenhum gasto registrado.</p>}
            {expenses.map(expense => (
              <div key={expense.id} className="flex justify-between items-center p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors rounded">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-medium text-sm text-gray-800 truncate" title={expense.description}>{expense.description}</p>
                  <p className="text-xs text-gray-500">{expense.category}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-semibold text-sm text-gray-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expense.amount)}
                  </span>
                  <button onClick={() => handleDelete(expense.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-[250px] relative">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', color: '#111827' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#374151' }}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Adicione gastos para visualizar o gráfico
            </div>
          )}
        </div>
      </div>
    </div>
  );
};