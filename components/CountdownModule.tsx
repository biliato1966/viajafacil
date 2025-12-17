import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownModuleProps {
  targetDate: string;
}

export const CountdownModule: React.FC<CountdownModuleProps> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;

    const calculateTimeLeft = () => {
      const difference = +new Date(targetDate) - +new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center p-2 bg-brand-50 rounded-lg min-w-[70px]">
      <span className="text-2xl font-bold text-brand-700">{value}</span>
      <span className="text-xs text-brand-900 uppercase tracking-wide">{label}</span>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center">
      <div className="flex items-center gap-2 mb-4 text-brand-600">
        <Clock size={20} />
        <h3 className="font-semibold text-lg">Contagem Regressiva</h3>
      </div>
      
      {targetDate ? (
        <div className="flex gap-2 sm:gap-4 flex-wrap justify-center">
          <TimeBlock value={timeLeft.days} label="Dias" />
          <TimeBlock value={timeLeft.hours} label="Horas" />
          <TimeBlock value={timeLeft.minutes} label="Min" />
          <TimeBlock value={timeLeft.seconds} label="Seg" />
        </div>
      ) : (
        <p className="text-gray-400 text-sm">Defina uma data para começar</p>
      )}
    </div>
  );
};
