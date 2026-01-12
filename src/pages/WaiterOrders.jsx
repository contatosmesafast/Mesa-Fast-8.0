import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  Clock,
  CheckCircle,
  History,
  Loader2,
  ChefHat,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function WaiterOrders() {
  const [staff, setStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = localStorage.getItem('staff_session');
    if (!session) {
      window.location.href = createPageUrl('Home');
      return;
    }
    const staffData = JSON.parse(session);
    if (staffData.role !== 'WAITER' && staffData.role !== 'ADMIN') {
      window.location.href = createPageUrl('Home');
      return;
    }
    setStaff(staffData);
  }, []);

  const { data: kitchenOrders = [] } = useQuery({
    queryKey: ['kitchenOrders', staff?.restaurant_id],
    queryFn: () => base44.entities.KitchenOrder.filter({ 
      restaurant_id: staff?.restaurant_id 
    }),
    enabled: !!staff,
    refetchInterval: 5000,
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.KitchenOrder.update(id, {
      status,
      ...(status === 'ENTREGUE' ? { delivered_at: new Date().toISOString() } : {})
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchenOrders'] });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id) => base44.entities.KitchenOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchenOrders'] });
    },
  });

  const handleStatusChange = (order, newStatus) => {
    updateOrderMutation.mutate({ id: order.id, status: newStatus });
  };

  const handleDeleteOrder = (orderId) => {
    if (confirm('Tem certeza que deseja excluir este pedido do histórico?')) {
      deleteOrderMutation.mutate(orderId);
    }
  };

  // Helper to convert UTC to local time
  const toLocalTime = (dateString) => {
    const date = new Date(dateString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  };

  if (!staff) return null;

  const pendingOrders = kitchenOrders.filter(o => o.status !== 'ENTREGUE' && o.status !== 'CANCELADO');
  const deliveredOrders = kitchenOrders.filter(o => {
    if (o.status === 'ENTREGUE') {
      const deliveredDate = format(toLocalTime(o.delivered_at || o.updated_date), 'yyyy-MM-dd');
      return deliveredDate === selectedDate;
    }
    if (o.status === 'CANCELADO') {
      const cancelledDate = format(toLocalTime(o.cancelled_at || o.updated_date), 'yyyy-MM-dd');
      return cancelledDate === selectedDate;
    }
    return false;
  });

  const statusColors = {
    NOVO: 'bg-blue-100 text-blue-700 border-blue-200',
    EM_PREPARO: 'bg-amber-100 text-amber-700 border-amber-200',
    PRONTO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    ENTREGUE: 'bg-gray-100 text-gray-700 border-gray-200',
    CANCELADO: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabels = {
    NOVO: 'Novo',
    EM_PREPARO: 'Preparando',
    PRONTO: 'Pronto',
    ENTREGUE: 'Entregue',
    CANCELADO: 'Cancelado',
  };

  const OrderCard = ({ order, showDeliverButton, showDeleteButton }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="border-2 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg text-gray-800">Mesa {order.table_number}</span>
                <Badge className={`${statusColors[order.status]} border`}>
                  {statusLabels[order.status]}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                {format(toLocalTime(order.created_date), 'HH:mm')} - {order.waiter_name}
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="font-semibold text-gray-700 min-w-[30px]">{item.quantity}x</span>
                <div className="flex-1">
                  <p className="text-gray-800 font-medium">{item.name}</p>
                  {item.notes && (
                    <p className="text-gray-500 text-xs mt-0.5">Obs: {item.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
              <p className="text-amber-800"><strong>Obs Geral:</strong> {order.notes}</p>
            </div>
          )}

          {showDeliverButton && (order.status === 'NOVO' || order.status === 'EM_PREPARO' || order.status === 'PRONTO') && (
            <Button
              onClick={() => handleStatusChange(order, 'ENTREGUE')}
              disabled={updateOrderMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {updateOrderMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marcar como Entregue
                </>
              )}
            </Button>
          )}

          {order.status === 'ENTREGUE' && order.delivered_at && (
            <div className="text-sm text-gray-500 text-center">
              Entregue às {format(toLocalTime(order.delivered_at), 'HH:mm')}
            </div>
          )}

          {order.status === 'CANCELADO' && order.cancelled_at && (
            <div className="text-sm text-red-600 text-center bg-red-50 p-2 rounded">
              Cancelado às {format(toLocalTime(order.cancelled_at), 'HH:mm')}
            </div>
          )}

          {showDeleteButton && (
            <Button
              onClick={() => handleDeleteOrder(order.id)}
              disabled={deleteOrderMutation.isPending}
              variant="outline"
              className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 mt-2"
            >
              {deleteOrderMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Pedido
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.href = createPageUrl(staff?.role === 'ADMIN' ? 'AdminTables' : 'WaiterDashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">Pedidos</h1>
              <p className="text-sm text-gray-500">Gerencie os pedidos</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4">
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pendentes ({pendingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingOrders.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="p-12 text-center">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-400">Nenhum pedido pendente</p>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence>
                {pendingOrders.map(order => (
                  <OrderCard key={order.id} order={order} showDeliverButton={true} showDeleteButton={false} />
                ))}
              </AnimatePresence>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por Data
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </CardContent>
            </Card>

            {deliveredOrders.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="p-12 text-center">
                  <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-400">Nenhum pedido entregue nesta data</p>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence>
                {deliveredOrders.map(order => (
                  <OrderCard key={order.id} order={order} showDeliverButton={false} showDeleteButton={true} />
                ))}
              </AnimatePresence>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}