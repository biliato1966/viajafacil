import React, { useState, useEffect } from 'react';
import { Car, LayoutDashboard, CheckSquare, Wallet, Map as MapIcon, Settings, Calendar, Plus, ArrowRight, FolderOpen, Trash2, Home, Save, Check, ListChecks, Timer, Route, Satellite, HardDrive, Loader2, AlertTriangle, Cloud, CloudOff, X } from 'lucide-react';
import { AppData, Trip } from './types';
import { ChecklistModule } from './components/ChecklistModule';
import { ExpensesModule } from './components/ExpensesModule';
import { MapModule } from './components/MapModule';
import { CountdownModule } from './components/CountdownModule';
import { generateTravelTips } from './services/geminiService';
import { AutocompleteInput } from './components/AutocompleteInput';
import { auth, loginAnonymously, saveUserData, loadUserData } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const TABS = {
  MY_TRIPS: 'my_trips',
  DASHBOARD: 'dashboard',
  CHECKLIST: 'checklist',
  EXPENSES: 'expenses',
  MAP: 'map',
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(TABS.MY_TRIPS);
  const [tips, setTips] = useState<string>('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [firebaseConfigError, setFirebaseConfigError] = useState<boolean>(false);
  
  // Estado inicial vazio
  const [appData, setAppData] = useState<AppData>({ trips: [], activeTripId: null });

  // 1. Inicialização: Login Anônimo e Carregamento de Dados
  useEffect(() => {
    // Tenta carregar do LocalStorage primeiro para exibição imediata
    try {
      const localData = localStorage.getItem('viajaFacilData');
      if (localData) {
        setAppData(JSON.parse(localData));
      }
    } catch (e) {
      console.error("Erro ao ler cache local", e);
    }

    // Configura ouvinte de autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Usuário já existe (sessão persistida)
        setUser(currentUser);
        setFirebaseConfigError(false);
        await handleCloudSync(currentUser.uid);
      } else {
        // Usuário não existe, tenta criar sessão anônima
        try {
          const result = await loginAnonymously();
          setUser(result);
          setFirebaseConfigError(false);
          await handleCloudSync(result.uid);
        } catch (error: any) {
          // Se falhar o login anônimo, verificamos se é porque não está ativado
          if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
            setFirebaseConfigError(true);
            // NÃO logamos console.error aqui para não poluir o console, pois já tratamos via UI
          } else {
            console.error("Falha no login anônimo", error);
          }
          
          // Permite que o app carregue em modo offline imediatamente
          setLoadingData(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCloudSync = async (uid: string) => {
    setLoadingData(true);
    try {
      const cloudData = await loadUserData(uid);
      if (cloudData) {
        // Se tem dados na nuvem, usa eles (são a fonte da verdade)
        setAppData(cloudData);
        // Atualiza cache local
        localStorage.setItem('viajaFacilData', JSON.stringify(cloudData));
      } else {
        // Se não tem na nuvem, mas tem local (criado offline ou antes do login), salva na nuvem
        const localData = localStorage.getItem('viajaFacilData');
        if (localData) {
          await saveUserData(uid, JSON.parse(localData));
        }
      }
    } catch (error) {
      console.warn("Erro na sincronização (pode ser offline):", error);
    } finally {
      setLoadingData(false);
    }
  };

  // 2. Salvamento Automático (Nuvem + Local)
  useEffect(() => {
    if (loadingData) return;

    const timeoutId = setTimeout(async () => {
      try {
        setIsSaving(true);
        
        // Salva na nuvem (Firestore) APENAS se houver usuário e não houver erro de config
        if (user && !firebaseConfigError) {
          await saveUserData(user.uid, appData);
        }
        
        // Salva localmente (Backup/Offline) SEMPRE
        localStorage.setItem('viajaFacilData', JSON.stringify(appData));
        
        const now = new Date();
        setLastSavedTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        setIsSaving(false);
      } catch (error) {
        console.error("Erro no auto-save:", error);
        setIsSaving(false);
      }
    }, 2000); // Debounce de 2 segundos

    return () => clearTimeout(timeoutId);
  }, [appData, loadingData, user, firebaseConfigError]);

  // Helper to get active trip
  const activeTrip = appData.trips.find(t => t.id === appData.activeTripId);

  // Load AI Tips
  useEffect(() => {
    if (activeTrip && activeTrip.details.destination) {
      // Logic to fetch tips if needed
    } else {
      setTips('');
    }
  }, [activeTrip?.details.destination, appData.activeTripId]);

  const createNewTrip = () => {
    const newTrip: Trip = {
      id: Date.now().toString(),
      createdAt: Date.now(),
      details: { origin: '', destination: '', startDate: '', notes: '' },
      checklist: [],
      expenses: [],
      markers: []
    };
    setAppData(prev => ({
      trips: [newTrip, ...prev.trips],
      activeTripId: newTrip.id
    }));
    setActiveTab(TABS.DASHBOARD);
  };

  const deleteTrip = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir esta viagem?')) {
      setAppData(prev => ({
        trips: prev.trips.filter(t => t.id !== id),
        activeTripId: prev.activeTripId === id ? null : prev.activeTripId
      }));
    }
  };

  const selectTrip = (id: string) => {
    setAppData(prev => ({ ...prev, activeTripId: id }));
    setActiveTab(TABS.DASHBOARD);
  };

  const updateActiveTrip = (updater: (trip: Trip) => Trip) => {
    setAppData(prev => {
      const current = prev.trips.find(t => t.id === prev.activeTripId);
      if (!current) return prev;
      return {
        ...prev,
        trips: prev.trips.map(t => t.id === prev.activeTripId ? updater(t) : t)
      };
    });
    if (isSaved) setIsSaved(false);
  };

  const handleUpdateDetail = (key: string, value: string | number) => {
    updateActiveTrip(trip => ({
      ...trip,
      details: { ...trip.details, [key]: value }
    }));
  };

  const handleRouteCalculated = (distance: string, duration: string, durationValue: number, distanceValue: number) => {
    updateActiveTrip(trip => {
      const isFirstCalculation = !trip.details.totalDistanceValue;
      return {
        ...trip,
        details: {
          ...trip.details,
          distance,
          duration,
          durationValue,
          totalDistanceValue: isFirstCalculation ? distanceValue : trip.details.totalDistanceValue,
          remainingDistanceValue: distanceValue,
          lastGpsUpdate: Date.now()
        }
      };
    });
  };

  const handleManualSave = async () => {
    try {
      setIsSaving(true);
      
      // Salva localmente
      localStorage.setItem('viajaFacilData', JSON.stringify(appData));

      // Tenta salvar na nuvem se tiver usuário
      if (user && !firebaseConfigError) {
        await saveUserData(user.uid, appData);
        setIsSaving(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } else {
        // Se não tiver usuário (erro config ou offline), finge que salvou (pois salvou local)
        setTimeout(() => {
          setIsSaving(false);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 2000);
        }, 500);
      }
    } catch (e) {
      alert("Erro ao salvar dados.");
      setIsSaving(false);
    }
  };

  const fetchTips = async () => {
    if (!activeTrip?.details.destination) return;
    const result = await generateTravelTips(activeTrip.details.destination);
    setTips(result);
  };

  const resetAllData = async () => {
    if (confirm("ATENÇÃO: Isso apagará todas as viagens salvas. Deseja continuar?")) {
      const emptyData = { trips: [], activeTripId: null };
      setAppData(emptyData);
      localStorage.setItem('viajaFacilData', JSON.stringify(emptyData));
      if (user && !firebaseConfigError) {
        await saveUserData(user.uid, emptyData);
      }
      setActiveTab(TABS.MY_TRIPS);
    }
  };

  // Se estiver carregando E não tiver dados locais, mostra loader
  if (loadingData && !appData.trips.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <Loader2 className="animate-spin text-brand-600" size={48} />
        <p className="text-gray-500 text-sm">Carregando dados...</p>
      </div>
    );
  }

  const renderMyTrips = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Minhas Viagens</h2>
        <button 
          onClick={createNewTrip}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 shadow-sm transition-all"
        >
          <Plus size={20} /> Nova Viagem
        </button>
      </div>

      {appData.trips.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <Car size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Nenhuma viagem encontrada.</p>
          <button onClick={createNewTrip} className="text-brand-600 font-semibold mt-2 hover:underline">
            Criar minha primeira viagem
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {appData.trips.map(trip => {
            const completedItems = trip.checklist.filter(i => i.isCompleted).length;
            const totalItems = trip.checklist.length;
            
            let tripProgress = 0;
            let tripStatusText = "Não iniciada";
            let usingGpsData = false;

            if (trip.details.totalDistanceValue && trip.details.remainingDistanceValue) {
               const total = trip.details.totalDistanceValue;
               const remaining = trip.details.remainingDistanceValue;
               const traveled = total - remaining;
               
               if (total > 0) {
                 tripProgress = Math.min(100, Math.max(0, (traveled / total) * 100));
                 if (remaining < 1000) { 
                   tripStatusText = "Chegando";
                   tripProgress = 100;
                 } else {
                   tripStatusText = "Em rota (GPS)";
                   usingGpsData = true;
                 }
               }
            } else if (trip.details.startDate && trip.details.durationValue) {
              const start = new Date(trip.details.startDate).getTime();
              const end = start + (trip.details.durationValue * 1000);
              const now = Date.now();
              if (now < start) { tripProgress = 0; tripStatusText = "Aguardando"; }
              else if (now > end) { tripProgress = 100; tripStatusText = "Concluída"; }
              else {
                tripProgress = ((now - start) / (end - start)) * 100;
                tripStatusText = "Em rota";
              }
            } else if (trip.details.distance) {
               tripStatusText = "Planejada";
            }

            return (
              <div 
                key={trip.id}
                onClick={() => selectTrip(trip.id)}
                className={`bg-white p-5 rounded-xl border cursor-pointer transition-all hover:shadow-md relative group flex flex-col justify-between
                  ${appData.activeTripId === trip.id ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200 hover:border-brand-300'}
                `}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="bg-brand-50 p-2 rounded-lg text-brand-600">
                      <Car size={20} />
                    </div>
                    <button 
                      onClick={(e) => deleteTrip(e, trip.id)}
                      className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Excluir viagem"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <h3 className="font-bold text-lg text-gray-800 truncate">
                    {trip.details.destination || 'Sem destino definido'}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1 mb-3 w-full">
                    <span className="flex-1 min-w-0 truncate text-right">{trip.details.origin || 'Partida'}</span>
                    <ArrowRight size={14} className="flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-left">{trip.details.destination || 'Destino'}</span>
                  </div>

                  {(trip.details.distance || trip.details.duration) && (
                    <div className="flex gap-3 mb-4 flex-wrap">
                      {trip.details.distance && (
                         <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded whitespace-nowrap">
                           <Route size={12} />
                           <span className="font-medium">{trip.details.distance}</span>
                         </div>
                      )}
                      {trip.details.duration && (
                         <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded whitespace-nowrap">
                           <Timer size={12} />
                           <span className="font-medium">{trip.details.duration}</span>
                         </div>
                      )}
                    </div>
                  )}

                  {(trip.details.durationValue || trip.details.totalDistanceValue) ? (
                    <div className="mb-4">
                       <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase tracking-wide items-center">
                         <span className="flex items-center gap-1">
                           {usingGpsData && <Satellite size={10} className="text-blue-500 animate-pulse"/>}
                           {tripStatusText}
                         </span>
                         <span>{Math.round(tripProgress)}%</span>
                       </div>
                       <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden flex">
                          <div 
                            className={`h-full transition-all duration-1000 ${usingGpsData ? 'bg-green-500' : 'bg-blue-500'}`} 
                            style={{ width: `${tripProgress}%` }}
                          />
                          <div className="bg-gray-200 h-full flex-1" />
                       </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between border-t pt-3 mt-auto">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar size={14} className="text-brand-500"/>
                    {trip.details.startDate 
                      ? new Date(trip.details.startDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit'}) 
                      : '--/--'}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${totalItems > 0 && completedItems === totalItems ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    <ListChecks size={14} />
                    <span>{completedItems}/{totalItems}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (activeTab === TABS.MY_TRIPS || !activeTrip) {
      return renderMyTrips();
    }

    switch (activeTab) {
      case TABS.CHECKLIST:
        return (
          <ChecklistModule 
            items={activeTrip.checklist} 
            setItems={(action) => updateActiveTrip(trip => ({
              ...trip, 
              checklist: typeof action === 'function' ? action(trip.checklist) : action
            }))}
            destination={activeTrip.details.destination}
          />
        );
      case TABS.EXPENSES:
        return (
          <ExpensesModule 
            expenses={activeTrip.expenses}
            setExpenses={(action) => updateActiveTrip(trip => ({
              ...trip,
              expenses: typeof action === 'function' ? action(trip.expenses) : action
            }))}
          />
        );
      case TABS.MAP:
        return (
          <MapModule 
            markers={activeTrip.markers}
            setMarkers={(action) => updateActiveTrip(trip => ({
              ...trip,
              markers: typeof action === 'function' ? action(trip.markers) : action
            }))}
            destination={activeTrip.details.destination}
            origin={activeTrip.details.origin}
            onRouteCalculated={handleRouteCalculated}
          />
        );
      case TABS.DASHBOARD:
      default:
        const completedTasks = activeTrip.checklist.filter(i => i.isCompleted).length;
        const totalTasks = activeTrip.checklist.length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const totalCost = activeTrip.expenses.reduce((acc, c) => acc + c.amount, 0);

        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <CountdownModule targetDate={activeTrip.details.startDate} />
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Resumo da Viagem</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span>Tarefas Concluídas</span>
                      <span>{completedTasks}/{totalTasks}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                    <span className="text-gray-500 text-sm">Gasto Total</span>
                    <span className="text-xl font-bold text-gray-800">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCost)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Settings size={18} className="text-gray-400"/> Detalhes da Viagem
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                 <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Local de Partida</label>
                  <AutocompleteInput 
                    value={activeTrip.details.origin}
                    onChange={val => handleUpdateDetail('origin', val)}
                    placeholder="De onde vamos sair?"
                    icon={<Home size={16} className="text-gray-400" />}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Destino</label>
                  <AutocompleteInput 
                    value={activeTrip.details.destination}
                    onChange={val => handleUpdateDetail('destination', val)}
                    placeholder="Para onde vamos?"
                    icon={<MapIcon size={16} className="text-gray-400" />}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Data e Hora de Partida</label>
                  <input 
                    type="datetime-local"
                    value={activeTrip.details.startDate.length === 10 ? `${activeTrip.details.startDate}T00:00` : activeTrip.details.startDate}
                    onChange={e => handleUpdateDetail('startDate', e.target.value)}
                    className="w-full mt-1 p-2.5 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition-all shadow-sm"
                  />
                </div>
                
                <div className="md:col-span-2 flex justify-end mt-2 pt-4 border-t border-gray-50 items-center gap-4">
                   <span className="text-xs text-gray-400 italic">
                     {isSaving ? 'Salvando...' : (lastSavedTime ? `Salvo às ${lastSavedTime}` : '')}
                   </span>
                   <button 
                     onClick={handleManualSave}
                     disabled={isSaving}
                     className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all shadow-sm ${
                       isSaved 
                       ? 'bg-green-500 text-white hover:bg-green-600' 
                       : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-70'
                     }`}
                   >
                     {isSaving ? <Loader2 className="animate-spin" size={18} /> : (isSaved ? <Check size={18} /> : <Save size={18} />)}
                     {isSaved ? 'Confirmado!' : 'Salvar'}
                   </button>
                </div>
              </div>
              
              {activeTrip.details.destination && (
                <div className="mt-6 bg-brand-50 p-4 rounded-lg border border-brand-100">
                   <div className="flex justify-between items-start mb-2">
                     <h4 className="font-semibold text-brand-800 text-sm">Dicas Inteligentes para {activeTrip.details.destination}</h4>
                     <button onClick={fetchTips} className="text-xs text-brand-600 underline hover:text-brand-800">
                       Atualizar Dicas
                     </button>
                   </div>
                   <p className="text-sm text-brand-900 whitespace-pre-line leading-relaxed">
                     {tips || "Clique em 'Atualizar Dicas' para receber sugestões da IA."}
                   </p>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 overflow-x-hidden">
      {/* Sidebar Navigation */}
      <nav className="bg-white border-r border-gray-200 w-full md:w-64 flex-shrink-0 flex md:flex-col justify-between sticky top-0 md:h-screen z-10">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => setActiveTab(TABS.MY_TRIPS)}>
            <div className="bg-brand-600 p-2 rounded-lg text-white shadow-lg shadow-brand-200">
              <Car size={24} />
            </div>
            <h1 className="font-bold text-xl text-gray-800 tracking-tight">ViajaFácil</h1>
          </div>
          
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible no-scrollbar mb-4">
             <NavButton 
              active={activeTab === TABS.MY_TRIPS} 
              onClick={() => setActiveTab(TABS.MY_TRIPS)} 
              icon={<FolderOpen size={20} />} 
              label="Minhas Viagens" 
            />
          </div>

          {activeTrip && (
            <>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 md:px-0">
                Viagem Atual
              </div>
              <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible no-scrollbar">
                <NavButton 
                  active={activeTab === TABS.DASHBOARD} 
                  onClick={() => setActiveTab(TABS.DASHBOARD)} 
                  icon={<LayoutDashboard size={20} />} 
                  label="Visão Geral" 
                />
                <NavButton 
                  active={activeTab === TABS.CHECKLIST} 
                  onClick={() => setActiveTab(TABS.CHECKLIST)} 
                  icon={<CheckSquare size={20} />} 
                  label="Checklist" 
                />
                <NavButton 
                  active={activeTab === TABS.EXPENSES} 
                  onClick={() => setActiveTab(TABS.EXPENSES)} 
                  icon={<Wallet size={20} />} 
                  label="Gastos" 
                />
                <NavButton 
                  active={activeTab === TABS.MAP} 
                  onClick={() => setActiveTab(TABS.MAP)} 
                  icon={<MapIcon size={20} />} 
                  label="Mapa & Rota" 
                />
              </div>
            </>
          )}
        </div>

        {/* Footer Area */}
        <div className="p-6 space-y-4">
           {activeTrip && (
            <div className="bg-gradient-to-br from-brand-500 to-indigo-600 rounded-xl p-4 text-white text-center shadow-md hidden md:block">
              <p className="text-sm font-medium opacity-90 mb-1 truncate">{activeTrip.details.destination || 'Sem Destino'}</p>
              <p className="font-bold text-lg">
                {activeTrip.checklist.filter(i => i.isCompleted).length} / {activeTrip.checklist.length}
              </p>
              <p className="text-xs opacity-75">itens prontos</p>
            </div>
           )}
           
           <div className={`flex items-center gap-2 text-xs justify-center md:justify-start ${firebaseConfigError ? 'text-amber-600' : 'text-green-600'}`}>
             {isSaving ? <Loader2 size={14} className="animate-spin" /> : (user && !firebaseConfigError ? <Cloud size={14} /> : <HardDrive size={14} />)}
             <span>
               {isSaving ? 'Salvando...' : 
                 (firebaseConfigError ? 'Modo Offline (Configuração Necessária)' : 
                   (user ? 'Nuvem Conectada' : 'Modo Offline'))}
             </span>
           </div>

           <button onClick={resetAllData} className="w-full flex items-center justify-center gap-2 text-xs text-red-400 hover:text-red-600 py-2 border border-transparent hover:bg-red-50 transition-colors rounded-lg">
              <Trash2 size={14} /> Resetar Dados
           </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-80px)] md:h-screen w-full">
        <div className="max-w-5xl mx-auto w-full">
          {/* Banner de Erro de Configuração */}
          {firebaseConfigError && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded shadow-sm relative animate-in fade-in slide-in-from-top-2">
              <button onClick={() => setFirebaseConfigError(false)} className="absolute top-2 right-2 text-amber-400 hover:text-amber-600">
                <X size={16} />
              </button>
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold text-amber-800 text-sm">Salvo Apenas no Dispositivo (Offline)</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Para que seus dados sejam salvos na nuvem (banco de dados), você precisa ativar o login anônimo:
                  </p>
                  <ol className="list-decimal pl-4 mt-2 text-xs text-amber-800 space-y-1">
                    <li>Acesse o <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">Console do Firebase</a></li>
                    <li>Vá em <strong>Authentication</strong> &gt; <strong>Sign-in method</strong></li>
                    <li>Ative o provedor <strong>Anônimo</strong> (Anonymous)</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {renderContent()}
        </div>
      </main>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm whitespace-nowrap
      ${active 
        ? 'bg-brand-50 text-brand-700 shadow-sm' 
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);