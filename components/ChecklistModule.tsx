import React, { useState } from 'react';
import { CheckCircle2, Circle, Trash2, Plus, Sparkles, Loader2 } from 'lucide-react';
import { ChecklistItem } from '../types';
import { generateSmartChecklist } from '../services/geminiService';

interface ChecklistModuleProps {
  items: ChecklistItem[];
  setItems: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  destination: string;
}

export const ChecklistModule: React.FC<ChecklistModuleProps> = ({ items, setItems, destination }) => {
  const [newItemText, setNewItemText] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  const completedCount = items.filter(i => i.isCompleted).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const handleAddItem = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newItemText.trim()) return;
    setItems(prev => [
      ...prev,
      { id: Date.now().toString(), text: newItemText, isCompleted: false, category: 'Geral' }
    ]);
    setNewItemText('');
  };

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, isCompleted: !item.isCompleted } : item
    ));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleGenerateAI = async () => {
    if (!destination) {
      alert("Por favor, defina um destino nas configurações primeiro.");
      return;
    }
    setLoadingAI(true);
    const suggestions = await generateSmartChecklist(destination, 5); // Default 5 days assumption
    if (suggestions.length > 0) {
      const newItems = suggestions.map((s, idx) => ({
        id: Date.now().toString() + idx,
        text: s.text,
        category: s.category,
        isCompleted: false
      }));
      setItems(prev => [...prev, ...newItems]);
    }
    setLoadingAI(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
          <CheckCircle2 className="text-brand-500" /> Checklist
        </h3>
        <button 
          onClick={handleGenerateAI}
          disabled={loadingAI}
          className="text-xs flex items-center gap-1 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          {loadingAI ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
          {loadingAI ? 'Gerando...' : 'Sugerir com IA'}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>Progresso</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-brand-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleAddItem} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Adicionar item..."
          className="flex-1 border border-gray-300 bg-white text-gray-900 rounded-lg px-4 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent shadow-sm"
        />
        <button 
          type="submit"
          className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
        </button>
      </form>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px]">
        {items.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-10">Sua lista está vazia. Adicione itens ou use a IA!</p>
        ) : (
          items.map(item => (
            <div 
              key={item.id} 
              className={`flex items-center justify-between p-3 rounded-lg border ${item.isCompleted ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 hover:border-brand-200'} transition-all`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <button 
                  onClick={() => toggleItem(item.id)}
                  className={`flex-shrink-0 ${item.isCompleted ? 'text-green-500' : 'text-gray-300 hover:text-brand-500'}`}
                >
                  {item.isCompleted ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm truncate ${item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {item.text}
                  </span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded w-fit">
                    {item.category}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => deleteItem(item.id)}
                className="text-gray-300 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};