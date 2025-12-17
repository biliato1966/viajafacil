import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { Map as MapIcon, Navigation, Loader2, AlertTriangle, ExternalLink, List, CornerUpRight, CornerUpLeft, ArrowUp, LocateFixed, StopCircle } from 'lucide-react';
import L from 'leaflet';
import { MapMarker } from '../types';

// Fix Leaflet default icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Ícone específico para a posição do GPS (Carro/Usuario)
const GpsIcon = L.divIcon({
  className: 'custom-gps-marker',
  html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapModuleProps {
  markers: MapMarker[];
  setMarkers: React.Dispatch<React.SetStateAction<MapMarker[]>>;
  destination?: string;
  origin?: string;
  onRouteCalculated?: (distance: string, duration: string, durationValue: number, distanceValue: number) => void;
}

interface RoutePoint {
  lat: number;
  lng: number;
  label: string;
}

interface RouteStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
  };
}

// Component to recenter map when markers or route changes
const RecenterMap = ({ markers, routePath, waypoints, gpsPosition }: { markers: MapMarker[], routePath: [number, number][], waypoints: RoutePoint[], gpsPosition: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    // Se tiver GPS ativo, foca nele e no destino
    if (gpsPosition && waypoints.length > 0) {
       // Encontrar o destino (último ponto)
       const dest = waypoints[waypoints.length -1];
       const bounds = L.latLngBounds([gpsPosition, [dest.lat, dest.lng]]);
       map.fitBounds(bounds.pad(0.2));
       return;
    }

    const allPoints = [
      ...markers.map(m => L.latLng(m.lat, m.lng)),
      ...waypoints.map(p => L.latLng(p.lat, p.lng)),
      ...routePath.map(p => L.latLng(p[0], p[1])) // Add route geometry to bounds
    ];

    if (allPoints.length > 0) {
      const group = L.featureGroup(allPoints.map(p => L.marker(p)));
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [markers, routePath, waypoints, map, gpsPosition]); // Added gpsPosition dependency
  return null;
};

// Helper function to fetch coordinates (Geocoding)
const getCoordinates = async (address: string): Promise<RoutePoint | null> => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: address
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching coordinates", error);
    return null;
  }
};

// Helper function to fetch driving route geometry and steps (OSRM)
const getDrivingRoute = async (start: RoutePoint | {lat: number, lng: number}, end: RoutePoint): Promise<{ geometry: [number, number][], distance: number, duration: number, steps: RouteStep[] } | null> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const geometry = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
      const steps = route.legs[0].steps || [];

      return {
        geometry,
        distance: route.distance, // meters
        duration: route.duration, // seconds
        steps
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching route", error);
    return null;
  }
};

export const MapModule: React.FC<MapModuleProps> = ({ markers, setMarkers, destination, origin, onRouteCalculated }) => {
  const [newLabel, setNewLabel] = useState('');
  const [waypoints, setWaypoints] = useState<RoutePoint[]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string, duration: string } | null>(null);
  const [loading, setLoading] = useState(false);
  
  // GPS States
  const [isTracking, setIsTracking] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastApiCallRef = useRef<number>(0);

  // Initial Route Calculation (Static)
  useEffect(() => {
    // Só calcula rota estática se NÃO estiver rastreando GPS
    if (isTracking) return;

    const fetchRoute = async () => {
      setLoading(true);
      setRouteInfo(null);
      setRoutePath([]);
      
      const points: RoutePoint[] = [];
      let startPoint: RoutePoint | null = null;
      let endPoint: RoutePoint | null = null;
      
      if (origin) {
        startPoint = await getCoordinates(origin);
        if (startPoint) points.push({ ...startPoint, label: `Partida: ${origin}` });
      }

      if (destination) {
        endPoint = await getCoordinates(destination);
        if (endPoint) points.push({ ...endPoint, label: `Destino: ${destination}` });
      }

      setWaypoints(points);

      if (startPoint && endPoint) {
        const routeData = await getDrivingRoute(startPoint, endPoint);
        if (routeData) {
          setRoutePath(routeData.geometry);
          
          const distKm = (routeData.distance / 1000).toFixed(1);
          const hours = Math.floor(routeData.duration / 3600);
          const minutes = Math.floor((routeData.duration % 3600) / 60);
          const distStr = `${distKm} km`;
          const durStr = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
          
          setRouteInfo({
            distance: distStr,
            duration: durStr
          });

          if (onRouteCalculated) {
             onRouteCalculated(distStr, durStr, routeData.duration, routeData.distance);
          }
        }
      }
      setLoading(false);
    };

    fetchRoute();
  }, [origin, destination, isTracking]);

  // GPS Tracking Logic
  const toggleGPS = () => {
    if (isTracking) {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      setUserLocation(null);
      // O useEffect acima irá rodar novamente para restaurar a rota original estática
    } else {
      // Start tracking
      if (!navigator.geolocation) {
        alert("Geolocalização não suportada pelo seu navegador.");
        return;
      }
      setIsTracking(true);
      
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation([lat, lng]);

          // Throttle API calls to OSRM (don't call more than once every 10 seconds)
          const now = Date.now();
          if (now - lastApiCallRef.current > 10000 && destination) {
             lastApiCallRef.current = now;
             
             // Encontrar coordenadas do destino se ainda não tivermos (reutiliza waypoints se possível)
             let endPoint = waypoints.find(p => p.label.includes(destination));
             if (!endPoint) {
                endPoint = await getCoordinates(destination);
             }

             if (endPoint) {
                // Calcular rota da POSIÇÃO ATUAL até o DESTINO
                const routeData = await getDrivingRoute({lat, lng}, endPoint);
                if (routeData) {
                  setRoutePath(routeData.geometry);
                  
                  const distKm = (routeData.distance / 1000).toFixed(1);
                  const hours = Math.floor(routeData.duration / 3600);
                  const minutes = Math.floor((routeData.duration % 3600) / 60);
                  const distStr = `${distKm} km`;
                  const durStr = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

                  setRouteInfo({
                    distance: distStr + ' (Restante)',
                    duration: durStr
                  });

                  // Update parent: Distance Value is REMAINING distance now
                  if (onRouteCalculated) {
                     onRouteCalculated(distStr, durStr, routeData.duration, routeData.distance);
                  }
                }
             }
          }
        },
        (error) => {
          console.error("GPS Error:", error);
          alert("Erro ao obter GPS: " + error.message);
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000
        }
      );
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const centerPosition: [number, number] = 
    userLocation ? userLocation :
    waypoints.length > 0 ? [waypoints[0].lat, waypoints[0].lng] :
    markers.length > 0 ? [markers[0].lat, markers[0].lng] : 
    [-15.793889, -47.882778]; 

  const addMarker = () => {
     if (!navigator.geolocation) {
       alert("Geolocalização não suportada");
       return;
     }
     navigator.geolocation.getCurrentPosition((pos) => {
       const newMarker: MapMarker = {
         id: Date.now().toString(),
         lat: pos.coords.latitude,
         lng: pos.coords.longitude,
         label: newLabel || 'Minha Localização'
       };
       setMarkers(prev => [...prev, newMarker]);
       setNewLabel('');
     }, (err) => {
       alert("Erro ao obter localização: " + err.message);
     });
  };

  const openExternalMap = () => {
    if (origin && destination) {
      // Se tiver local do usuário, usa ele como origem para o Google Maps
      const startParam = userLocation 
        ? `${userLocation[0]},${userLocation[1]}` 
        : encodeURIComponent(origin);
        
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${startParam}&destination=${encodeURIComponent(destination)}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Map Section */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full min-h-[500px]">
        {/* Header Responsivo */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
              <MapIcon className="text-brand-500" /> 
              {isTracking ? "Navegando" : "Rota"}
            </h3>
            
            {/* Mobile Route Info Badge (aparece ao lado do título em telas pequenas) */}
            {routeInfo && (
               <div className="flex md:hidden items-center gap-2">
                 <div className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs border ${isTracking ? 'bg-green-50 border-green-200' : 'bg-brand-50 border-brand-100'}`}>
                   <span className="font-bold">{routeInfo.distance}</span>
                 </div>
               </div>
            )}
          </div>
          
          {/* Desktop Route Info Badge */}
          {routeInfo && (
             <div className="hidden md:flex items-center gap-2">
               <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm border transition-colors ${isTracking ? 'bg-green-50 border-green-200 animate-pulse' : 'bg-brand-50 border-brand-100'}`}>
                 <span className={`font-bold ${isTracking ? 'text-green-700' : 'text-brand-700'}`}>{routeInfo.distance}</span>
                 <span className="w-px h-3 bg-gray-300"></span>
                 <span className={`${isTracking ? 'text-green-800' : 'text-brand-800'}`}>{routeInfo.duration}</span>
               </div>
               <button 
                onClick={openExternalMap}
                className="bg-white text-gray-600 border border-gray-300 p-1.5 rounded-lg hover:bg-gray-50 hover:text-brand-600 transition-colors"
                title="Abrir no Google Maps/Waze"
               >
                 <ExternalLink size={18} />
               </button>
             </div>
          )}

          {/* Controls - Flex Wrap para não estourar mobile */}
          <div className="flex flex-wrap gap-2">
             <button 
              onClick={toggleGPS}
              className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm transition-colors whitespace-nowrap font-semibold flex-1 md:flex-none justify-center
                ${isTracking 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-green-600 text-white hover:bg-green-700'
                }`}
            >
              {isTracking ? <StopCircle size={14} /> : <LocateFixed size={14} />}
              {isTracking ? 'Parar' : 'GPS'}
            </button>
          
            {/* Input e botão Add visíveis e responsivos */}
            <div className="flex gap-2 flex-1 md:flex-none min-w-[140px]">
              <input 
                type="text" 
                placeholder="Marcador..." 
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="border border-gray-300 bg-white text-gray-900 text-sm px-3 py-1.5 rounded-lg focus:ring-2 focus:ring-brand-600 outline-none w-full md:w-24"
              />
              <button 
                onClick={addMarker}
                className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 flex items-center gap-1 shrink-0"
              >
                <Navigation size={14} />
              </button>
            </div>
            
            {/* Botão externo para mobile */}
            {routeInfo && (
              <button 
                onClick={openExternalMap}
                className="md:hidden bg-white text-gray-600 border border-gray-300 p-2 rounded-lg hover:bg-gray-50"
              >
                 <ExternalLink size={16} />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 rounded-lg overflow-hidden border border-gray-200 z-0 relative shadow-inner">
          {loading && !isTracking && (
            <div className="absolute inset-0 z-[1000] bg-white/70 flex items-center justify-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-brand-600">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-sm font-semibold">Calculando...</span>
              </div>
            </div>
          )}

          <MapContainer 
            center={centerPosition} 
            zoom={12} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Live User Position */}
            {userLocation && (
              <Marker position={userLocation} icon={GpsIcon} zIndexOffset={1000}>
                <Popup>Você está aqui</Popup>
              </Marker>
            )}

            {/* Static Markers */}
            {markers.map(marker => (
              <Marker key={marker.id} position={[marker.lat, marker.lng]}>
                <Popup>{marker.label}</Popup>
              </Marker>
            ))}

            {/* Route Start/End Markers */}
            {waypoints.map((point, idx) => (
              <Marker key={`route-point-${idx}`} position={[point.lat, point.lng]} opacity={1}>
                 <Popup>{point.label}</Popup>
              </Marker>
            ))}

            <Polyline 
              positions={routePath} 
              color={isTracking ? "#22c55e" : "#0284c7"} // Green if tracking, Blue if static
              weight={5} 
              opacity={0.8}
            />

            <RecenterMap markers={markers} routePath={routePath} waypoints={waypoints} gpsPosition={userLocation} />
          </MapContainer>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center flex items-center justify-center gap-1">
          {isTracking 
            ? "Atualizando rota em tempo real baseado no GPS do celular..."
            : (origin && destination ? `Rota fixa: ${origin} ➔ ${destination}` : 'Defina a rota para iniciar.')
          }
        </p>
      </div>
    </div>
  );
};