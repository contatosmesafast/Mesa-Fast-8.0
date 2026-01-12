import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Grid3X3, Loader2, ClipboardList, Bell, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function AdminTables() {
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [backgroundMonitoring, setBackgroundMonitoring] = useState(false);
  const prevOrdersCountRef = React.useRef(null);
  const prevCallsCountRef = React.useRef(null);
  const audioContextRef = React.useRef(null);
  const backgroundIntervalRef = React.useRef(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const session = localStorage.getItem('staff_session');
    if (!session) {
      window.location.href = createPageUrl('Home');
      return;
    }
    const staffData = JSON.parse(session);
    if (staffData.role !== 'ADMIN') {
      window.location.href = createPageUrl('Home');
      return;
    }
    setStaff(staffData);
    loadRestaurant(staffData.restaurant_id);
  }, []);

  const loadRestaurant = async (restaurantId) => {
    const restaurants = await base44.entities.Restaurant.filter({ id: restaurantId });
    if (restaurants.length > 0) {
      setRestaurant(restaurants[0]);
    }
  };

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables', staff?.restaurant_id],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
  });

  const { data: kitchenOrders = [] } = useQuery({
    queryKey: ['kitchenOrders', staff?.restaurant_id],
    queryFn: () => base44.entities.KitchenOrder.filter({ restaurant_id: staff?.restaurant_id, status: 'NOVO' }),
    enabled: !!staff,
    refetchInterval: 3000,
  });

  const { data: waiterCalls = [] } = useQuery({
    queryKey: ['waiterCalls', staff?.restaurant_id],
    queryFn: () => base44.entities.WaiterCall.filter({ restaurant_id: staff?.restaurant_id, status: 'PENDENTE' }),
    enabled: !!staff,
    refetchInterval: 3000,
  });



  const markCallAttendedMutation = useMutation({
    mutationFn: (callId) => base44.entities.WaiterCall.update(callId, {
      status: 'ATENDIDO',
      attended_at: new Date().toISOString(),
      attended_by_staff_id: staff?.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiterCalls'] });
    },
  });

  const createTableMutation = useMutation({
    mutationFn: (tableData) => base44.entities.Table.create(tableData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setIsDialogOpen(false);
      setNewTableNumber('');
    },
  });

  const handleCreateTable = () => {
    if (!newTableNumber) return;
    
    const existingTable = tables.find(t => t.number === parseInt(newTableNumber));
    if (existingTable) {
      alert('Já existe uma mesa com esse número');
      return;
    }

    createTableMutation.mutate({
      restaurant_id: staff.restaurant_id,
      number: parseInt(newTableNumber),
      status: 'LIVRE',
    });
  };

  const handleLogout = async () => {
    localStorage.removeItem('staff_session');
    await base44.auth.logout(createPageUrl('Home'));
  };

  const handleTableClick = (table) => {
    // Redirect to TableOrder page
    window.location.href = createPageUrl(`TableOrder?tableId=${table.id}`);
  };

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const playNotificationSound = async () => {
    try {
      const audioContext = initAudioContext();
      
      // CRÍTICO: Retomar AudioContext se estiver suspenso (Chrome)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Primeiro bip
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = 880;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.5, audioContext.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.3);
      
      // Segundo bip
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1046;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.5, audioContext.currentTime + 0.35);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.75);
      osc2.start(audioContext.currentTime + 0.35);
      osc2.stop(audioContext.currentTime + 0.75);
      
      // Terceiro bip
      const osc3 = audioContext.createOscillator();
      const gain3 = audioContext.createGain();
      osc3.connect(gain3);
      gain3.connect(audioContext.destination);
      osc3.frequency.value = 880;
      osc3.type = 'sine';
      gain3.gain.setValueAtTime(0.5, audioContext.currentTime + 0.8);
      gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.2);
      osc3.start(audioContext.currentTime + 0.8);
      osc3.stop(audioContext.currentTime + 1.2);
    } catch (error) {
      console.error('Erro ao reproduzir som:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  };

  const showNotification = async (title, body) => {
    // Sempre toca o som quando notificações estão ativadas
    if (soundEnabled) {
      await playNotificationSound();
      
      // Vibração mais intensa (se suportado)
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }
    }
    
    // Mostra notificação visual se tiver permissão
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/icon.png',
        badge: '/icon.png',
        tag: `notification-${Date.now()}`, // Tag única para não sobrescrever
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        silent: false, // Garante que não seja silencioso
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      // Fechar automaticamente após 30 segundos
      setTimeout(() => {
        notification.close();
      }, 30000);
    }
  };

  const startBackgroundMonitoring = async () => {
    if (backgroundIntervalRef.current) return;
    
    // Verifica novos pedidos/chamados a cada 30 segundos via backend
    backgroundIntervalRef.current = setInterval(async () => {
      try {
        const response = await base44.functions.invoke('checkNewOrders', {});
        
        if (response.data?.newOrders?.length > 0) {
          const count = response.data.newOrders.length;
          showNotification(
            '🍽️ Novo Pedido na Cozinha!',
            `${count} novo(s) pedido(s) aguardando preparo`
          );
          // Força atualização da query
          queryClient.invalidateQueries({ queryKey: ['kitchenOrders'] });
        }
        
        if (response.data?.newCalls?.length > 0) {
          const count = response.data.newCalls.length;
          showNotification(
            '🔔 Cliente Chamando!',
            `Mesa ${response.data.newCalls.map(c => c.table).join(', ')} precisando de atendimento`
          );
          // Força atualização da query
          queryClient.invalidateQueries({ queryKey: ['waiterCalls'] });
        }
      } catch (error) {
        console.error('Erro ao verificar novos pedidos:', error);
      }
    }, 10000); // 10 segundos
    
    setBackgroundMonitoring(true);
  };

  const stopBackgroundMonitoring = () => {
    if (backgroundIntervalRef.current) {
      clearInterval(backgroundIntervalRef.current);
      backgroundIntervalRef.current = null;
    }
    setBackgroundMonitoring(false);
  };

  const handleToggleSound = async () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    
    if (newState) {
      // Inicializa AudioContext com interação do usuário
      const audioContext = initAudioContext();
      
      // CRÍTICO: Retomar AudioContext imediatamente (Chrome)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Solicita permissão para notificações
      const granted = await requestNotificationPermission();
      
      // Testa o som imediatamente ao ativar
      await playNotificationSound();
      
      // Mostra notificação de teste
      if (granted) {
        showNotification('Notificações Ativadas', 'Sistema de monitoramento ativo - som testado com sucesso!');
      }
      
      // Inicializa os contadores com os valores atuais
      prevOrdersCountRef.current = kitchenOrders.length;
      prevCallsCountRef.current = waiterCalls.length;
      
      // Inicia monitoramento em background
      startBackgroundMonitoring();
    } else {
      // Para monitoramento em background
      stopBackgroundMonitoring();
    }
  };

  // Limpar interval ao desmontar
  useEffect(() => {
    return () => {
      if (backgroundIntervalRef.current) {
        clearInterval(backgroundIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!soundEnabled || prevOrdersCountRef.current === null) return;
    
    if (kitchenOrders.length > prevOrdersCountRef.current) {
      const newOrdersCount = kitchenOrders.length - prevOrdersCountRef.current;
      console.log('🔔 Novo pedido! Notificando...', { 
        atual: kitchenOrders.length, 
        anterior: prevOrdersCountRef.current
      });
      
      // Mostra notificação do sistema
      showNotification(
        '🍽️ Novo Pedido na Cozinha!',
        `${newOrdersCount} novo(s) pedido(s) aguardando preparo`
      );
    }
    prevOrdersCountRef.current = kitchenOrders.length;
  }, [kitchenOrders, soundEnabled]);

  useEffect(() => {
    if (!soundEnabled || prevCallsCountRef.current === null) return;
    
    if (waiterCalls.length > prevCallsCountRef.current) {
      const newCallsCount = waiterCalls.length - prevCallsCountRef.current;
      console.log('🔔 Novo chamado! Notificando...', { 
        atual: waiterCalls.length, 
        anterior: prevCallsCountRef.current
      });
      
      // Mostra notificação do sistema
      showNotification(
        '🔔 Cliente Chamando!',
        `${newCallsCount} mesa(s) precisando de atendimento`
      );
    }
    prevCallsCountRef.current = waiterCalls.length;
  }, [waiterCalls, soundEnabled]);

  if (!staff) return null;

  const sortedTables = [...tables].sort((a, b) => a.number - b.number);

  const statusColors = {
    'LIVRE': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'EM_USO': 'bg-amber-100 text-amber-700 border-amber-200',
    'AGUARDANDO_PAGAMENTO': 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabels = {
    'LIVRE': 'Livre',
    'EM_USO': 'Em Uso',
    'AGUARDANDO_PAGAMENTO': 'Aguardando',
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar restaurant={restaurant} onLogout={handleLogout} />
      
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Mesas</h1>
            <p className="text-gray-500 mt-1">{tables.length} mesas cadastradas</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant={soundEnabled ? "default" : "outline"}
              onClick={handleToggleSound}
              className={soundEnabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 mr-2" />
                  Som Ativado
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 mr-2" />
                  Som Desativado
                </>
              )}
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Nova Mesa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Nova Mesa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="tableNumber">Número da Mesa</Label>
                  <Input
                    id="tableNumber"
                    type="number"
                    placeholder="Ex: 51"
                    value={newTableNumber}
                    onChange={(e) => setNewTableNumber(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <Button
                  onClick={handleCreateTable}
                  disabled={createTableMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {createTableMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Criar Mesa'
                  )}
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {!soundEnabled && (
          <Card className="mb-4 border-2 border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <VolumeX className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-sm text-amber-800">
                    <strong>Notificações desativadas.</strong> Clique no botão "Som Desativado" para ativar e receber alertas de novos pedidos e chamados.
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    💡 Verificação automática a cada 10 segundos + som triplo + vibração intensa
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}



        {/* Orders Card */}
        <Card 
          onClick={() => window.location.href = createPageUrl('WaiterOrders')}
          className={`mb-4 border-2 shadow-lg cursor-pointer transition-all hover:shadow-xl ${
            kitchenOrders.length > 0 
              ? 'border-blue-500 bg-blue-50 hover:border-blue-600' 
              : 'border-gray-200 bg-white hover:border-blue-300'
          }`}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  kitchenOrders.length > 0 ? 'bg-blue-500' : 'bg-gray-500'
                }`}>
                  <ClipboardList className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Pedidos</h3>
                  {kitchenOrders.length > 0 ? (
                    <p className="text-blue-600 font-semibold">
                      {kitchenOrders.length} novo(s) pedido(s)!
                    </p>
                  ) : (
                    <p className="text-gray-500">Ver todos os pedidos</p>
                  )}
                </div>
              </div>
              {kitchenOrders.length > 0 && (
                <Badge className="bg-blue-500 text-white text-lg px-4 py-2">
                  {kitchenOrders.length}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Waiter Calls Card */}
        <Card className={`mb-8 border-2 shadow-lg ${
          waiterCalls.length > 0 
            ? 'border-amber-500 bg-amber-50' 
            : 'border-gray-200 bg-white'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center relative ${
                  waiterCalls.length > 0 ? 'bg-amber-500' : 'bg-gray-500'
                }`}>
                  <Bell className="w-7 h-7 text-white" />
                  {waiterCalls.length > 0 && (
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 15, -15, 0]
                      }}
                      transition={{ 
                        duration: 0.5,
                        repeat: Infinity,
                        repeatDelay: 1
                      }}
                      className="absolute -top-1 -right-1"
                    >
                      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {waiterCalls.length}
                      </div>
                    </motion.div>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Chamados</h3>
                  {waiterCalls.length > 0 ? (
                    <p className="text-amber-600 font-semibold">
                      {waiterCalls.length} mesa(s) aguardando!
                    </p>
                  ) : (
                    <p className="text-gray-500">Nenhum chamado pendente</p>
                  )}
                </div>
              </div>
            </div>

            {waiterCalls.length > 0 && (
              <div className="space-y-2 mt-4">
                {waiterCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold">
                        {call.table_number}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Mesa {call.table_number}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(call.created_date), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => markCallAttendedMutation.mutate(call.id)}
                      disabled={markCallAttendedMutation.isPending}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {markCallAttendedMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Atendido'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="border-0 shadow-md bg-emerald-50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-emerald-700">
                {tables.filter(t => t.status === 'LIVRE').length}
              </p>
              <p className="text-emerald-600 text-sm">Livres</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-amber-50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-amber-700">
                {tables.filter(t => t.status === 'EM_USO').length}
              </p>
              <p className="text-amber-600 text-sm">Em Uso</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-red-50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-700">
                {tables.filter(t => t.status === 'AGUARDANDO_PAGAMENTO').length}
              </p>
              <p className="text-red-600 text-sm">Aguardando</p>
            </CardContent>
          </Card>
        </div>

        {/* Tables Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {sortedTables.map((table, index) => (
              <motion.div
                key={table.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
              >
                <Card 
                  className={`border-2 cursor-pointer hover:shadow-lg transition-all ${
                    table.status === 'LIVRE' 
                      ? 'border-emerald-200 bg-emerald-50' 
                      : table.status === 'EM_USO'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                  onClick={() => handleTableClick(table)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="w-10 h-10 mx-auto mb-2 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <Grid3X3 className={`w-5 h-5 ${
                        table.status === 'LIVRE' 
                          ? 'text-emerald-600' 
                          : table.status === 'EM_USO'
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`} />
                    </div>
                    <p className="font-bold text-gray-800">Mesa {table.number}</p>
                    <Badge className={`mt-2 text-xs ${statusColors[table.status]}`}>
                      {statusLabels[table.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}