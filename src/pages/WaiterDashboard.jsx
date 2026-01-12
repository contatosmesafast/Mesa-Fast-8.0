import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Grid3X3, 
  LogOut, 
  Plus,
  UtensilsCrossed,
  ChefHat,
  RefreshCw,
  ClipboardList,
  Bell
} from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';

export default function WaiterDashboard() {
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = localStorage.getItem('staff_session');
    if (!session) {
      window.location.href = createPageUrl('Home');
      return;
    }
    const staffData = JSON.parse(session);
    if (staffData.role !== 'WAITER') {
      window.location.href = createPageUrl('Home');
      return;
    }
    setStaff(staffData);
    loadRestaurant(staffData.restaurant_id);
  }, []);

  const loadRestaurant = async (restaurantId) => {
    const restaurants = await base44.entities.Restaurant.filter({ id: restaurantId });
    if (restaurants.length > 0) {
      const rest = restaurants[0];
      if (rest.is_blocked) {
        window.location.href = createPageUrl(`BlockedAccount?reason=${encodeURIComponent(rest.blocked_reason || '')}`);
        return;
      }
      setRestaurant(rest);
    }
  };

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables', staff?.restaurant_id],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
    refetchInterval: 3000,
  });

  const { data: myOrders = [] } = useQuery({
    queryKey: ['myOrders', staff?.id],
    queryFn: () => base44.entities.Order.filter({ waiter_id: staff?.id, status: 'ABERTA' }),
    enabled: !!staff,
    refetchInterval: 5000,
  });

  const { data: newKitchenOrders = [] } = useQuery({
    queryKey: ['newKitchenOrders', staff?.restaurant_id],
    queryFn: () => base44.entities.KitchenOrder.filter({ restaurant_id: staff?.restaurant_id, status: 'NOVO' }),
    enabled: !!staff,
    refetchInterval: 3000,
  });

  const handleLogout = () => {
    localStorage.removeItem('staff_session');
    window.location.href = createPageUrl('Home');
  };

  const handleTableClick = (table) => {
    window.location.href = createPageUrl(`TableOrder?tableId=${table.id}`);
  };

  const handleOrdersClick = () => {
    window.location.href = createPageUrl('WaiterOrders');
  };

  if (!staff) return null;

  const sortedTables = [...tables].sort((a, b) => a.number - b.number);
  const freeTables = tables.filter(t => t.status === 'LIVRE').length;
  const inUseTables = tables.filter(t => t.status === 'EM_USO').length;
  const waitingPayment = tables.filter(t => t.status === 'AGUARDANDO_PAGAMENTO').length;

  const getTableColor = (status, isMyTable) => {
    if (status === 'LIVRE') return 'border-emerald-200 bg-emerald-50 hover:border-emerald-400';
    if (status === 'EM_USO') {
      return isMyTable 
        ? 'border-amber-400 bg-amber-100 hover:border-amber-500 ring-2 ring-amber-300' 
        : 'border-amber-200 bg-amber-50 hover:border-amber-400';
    }
    return 'border-red-200 bg-red-50 hover:border-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">{restaurant?.name || 'Restaurante'}</h1>
              <p className="text-sm text-gray-500">Olá, {staff.name}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-gray-500">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 pb-24">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{freeTables}</p>
              <p className="text-xs text-emerald-600">Livres</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{inUseTables}</p>
              <p className="text-xs text-amber-600">Em Uso</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{waitingPayment}</p>
              <p className="text-xs text-red-600">Pagamento</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={handleOrdersClick}
          className="mb-6 cursor-pointer"
        >
          <Card className={`border-2 shadow-lg transition-all ${
            newKitchenOrders.length > 0 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 bg-white hover:border-blue-300'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center relative ${
                    newKitchenOrders.length > 0 ? 'bg-blue-500' : 'bg-gray-500'
                  }`}>
                    <ClipboardList className="w-7 h-7 text-white" />
                    {newKitchenOrders.length > 0 && (
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
                        <Bell className="w-6 h-6 text-amber-500 fill-amber-500" />
                      </motion.div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">Pedidos</h3>
                    {newKitchenOrders.length > 0 ? (
                      <p className="text-blue-600 font-semibold">
                        {newKitchenOrders.length} novo(s) pedido(s)!
                      </p>
                    ) : (
                      <p className="text-gray-500">Ver todos os pedidos</p>
                    )}
                  </div>
                </div>
                {newKitchenOrders.length > 0 && (
                  <Badge className="bg-blue-500 text-white text-lg px-4 py-2 animate-pulse">
                    {newKitchenOrders.length}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* My active orders indicator */}
        {myOrders.length > 0 && (
          <Card className="mb-6 border-2 border-amber-400 bg-amber-50 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                    <ChefHat className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-800">Suas Mesas Ativas</p>
                    <p className="text-sm text-amber-600">{myOrders.length} comanda(s) aberta(s)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tables Grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Mesas</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['tables'] })}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {sortedTables.map((table, index) => {
            const isMyTable = myOrders.some(o => o.table_id === table.id);
            
            return (
              <motion.div
                key={table.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.01 }}
                onClick={() => handleTableClick(table)}
                className={`cursor-pointer relative`}
              >
                <Card className={`border-2 transition-all ${getTableColor(table.status, isMyTable)}`}>
                  <CardContent className="p-3 text-center">
                    <div className="w-8 h-8 mx-auto mb-1 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <Grid3X3 className={`w-4 h-4 ${
                        table.status === 'LIVRE' 
                          ? 'text-emerald-600' 
                          : table.status === 'EM_USO'
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`} />
                    </div>
                    <p className="font-bold text-gray-800 text-sm">{table.number}</p>
                    {isMyTable && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-200 border-2 border-emerald-400" />
            <span className="text-gray-600">Livre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-200 border-2 border-amber-400" />
            <span className="text-gray-600">Em Uso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-200 border-2 border-red-400" />
            <span className="text-gray-600">Aguardando Pagto</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-300 border-2 border-amber-500 ring-2 ring-amber-300" />
            <span className="text-gray-600">Sua Mesa</span>
          </div>
        </div>
      </main>
    </div>
  );
}