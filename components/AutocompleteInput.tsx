import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

interface Suggestion {
  place_id: number;
  display_name: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ value, onChange, placeholder, icon }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fecha as sugestões ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Busca sugestões com debounce (delay para não sobrecarregar a API)
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Só busca se estiver aberto (digitando) e tiver mais de 2 caracteres
      if (isOpen && value.length > 2) {
        try {
          // Busca no Nominatim (OpenStreetMap) limitado ao Brasil (opcional, removido viewbox para ser global) ou geral
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1`
          );
          if (response.ok) {
            const data = await response.json();
            setSuggestions(data);
          }
        } catch (error) {
          console.error("Erro ao buscar locais:", error);
        }
      }
    }, 500); // 500ms de delay

    return () => clearTimeout(timer);
  }, [value, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = (suggestion: Suggestion) => {
    // Pega apenas a parte relevante do nome (opcional: usar display_name completo)
    onChange(suggestion.display_name);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="relative mt-1" ref={wrapperRef}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        {icon || <MapPin size={16} className="text-gray-400" />}
      </div>
      <input 
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => value.length > 2 && setIsOpen(true)}
        className="w-full pl-10 p-2.5 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition-all placeholder-gray-500 shadow-sm"
        placeholder={placeholder}
      />
      
      {/* Lista de Sugestões */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <li 
              key={s.place_id} 
              onClick={() => handleSelect(s)}
              className="px-4 py-3 hover:bg-brand-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100 last:border-0 transition-colors flex items-center gap-2"
            >
              <MapPin size={14} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{s.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
