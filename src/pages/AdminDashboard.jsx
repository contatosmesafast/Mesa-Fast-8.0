import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminSidebar from '@/components/admin/AdminSidebar';
import StatsCard from '@/components/admin/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  LayoutDashboard, 
  DollarSign, 
  Users, 
  UtensilsCrossed,
  Star,
  TrendingUp,
  Clock,
  ChefHat,
  CalendarDays,
  Trash2,
  XCircle,
  Link as LinkIcon,
  Copy
} from 'lucide-react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createPageUrl } from '@/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function AdminDashboard() {
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
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

  const checkBlocked = async (restaurantId) => {
    const restaurants = await base44.entities.Restaurant.filter({ id: restaurantId });
    if (restaurants.length > 0 && restaurants[0].is_blocked) {
      return restaurants[0];
    }
    return null;
  };

  // Helper to convert UTC to local time
  const toLocalTime = (dateString) => {
    const date = new Date(dateString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  };

  const loadRestaurant = async (restaurantId) => {
    const restaurants = await base44.entities.Restaurant.filter({ id: restaurantId });
    if (restaurants.length > 0) {
      const rest = restaurants[0];
      if (rest.is_blocked) {
        // Redirect to blocked screen
        window.location.href = createPageUrl(`BlockedAccount?reason=${encodeURIComponent(rest.blocked_reason || '')}`);
        return;
      }
      setRestaurant(rest);
    }
  };

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', staff?.restaurant_id],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
    refetchInterval: 5000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', staff?.restaurant_id],
    queryFn: () => base44.entities.Order.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
    refetchInterval: 5000,
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['ratings', staff?.restaurant_id],
    queryFn: () => base44.entities.Rating.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff', staff?.restaurant_id],
    queryFn: async () => {
      const allStaff = await base44.entities.Staff.filter({ 
        restaurant_id: staff?.restaurant_id, 
        is_active: true 
      });
      // Filter to only WAITER and ADMIN roles
      return allStaff.filter(s => s.role === 'WAITER' || s.role === 'ADMIN');
    },
    enabled: !!staff,
  });

  const cancelOrderMutation = useMutation({
    mutationFn: ({ orderId, reason }) => 
      base44.entities.Order.update(orderId, {
        status: 'CANCELADA',
        cancelled_at: new Date().toISOString(),
        cancelled_by_staff_id: staff?.id,
        cancel_reason: reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setCancelDialogOpen(false);
      setCancelReason('');
      setSelectedOrder(null);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (orderId) => base44.entities.Order.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const handleLogout = async () => {
    localStorage.removeItem('staff_session');
    await base44.auth.logout(createPageUrl('Home'));
  };

  const handleCancelOrder = (order) => {
    setSelectedOrder(order);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    if (selectedOrder) {
      cancelOrderMutation.mutate({
        orderId: selectedOrder.id,
        reason: cancelReason.trim() || 'Cancelado pelo administrador',
      });
    }
  };

  const handleDeleteOrder = (order) => {
    if (window.confirm(`Excluir permanentemente o pedido da Mesa ${order.table_number}?\n\nEsta ação não pode ser desfeita.`)) {
      deleteOrderMutation.mutate(order.id);
    }
  };

  const handleCopyMenuLink = () => {
    const menuUrl = `${window.location.origin}${createPageUrl('CustomerMenu')}?r=${restaurant?.id}`;
    navigator.clipboard.writeText(menuUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (!staff) return null;

  const selectedDayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_date);
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    return orderDate >= dayStart && orderDate <= dayEnd;
  });

  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_date);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  const paidOrders = orders.filter(o => o.status === 'PAGA');
  const todayPaidOrders = todayOrders.filter(o => o.status === 'PAGA');
  
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const todayRevenue = todayPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalServiceFee = paidOrders.reduce((sum, o) => sum + (o.service_fee || 0), 0);

  const avgRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
    : '0.0';

  const freeTables = tables.filter(t => t.status === 'LIVRE').length;
  const inUseTables = tables.filter(t => t.status === 'EM_USO').length;
  const waitingPayment = tables.filter(t => t.status === 'AGUARDANDO_PAGAMENTO').length;

  const tableStatusData = [
    { name: 'Livres', value: freeTables, color: '#10b981' },
    { name: 'Em Uso', value: inUseTables, color: '#f59e0b' },
    { name: 'Aguardando', value: waitingPayment, color: '#ef4444' },
  ];

  // Top items sold
  const itemsSold = {};
  paidOrders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!itemsSold[item.name]) {
        itemsSold[item.name] = { name: item.name, quantity: 0, revenue: 0 };
      }
      itemsSold[item.name].quantity += item.quantity;
      itemsSold[item.name].revenue += item.price * item.quantity;
    });
  });
  const topItems = Object.values(itemsSold).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  // Waiter performance
  const waiterPerformance = staffList.map(waiter => {
    const waiterOrders = paidOrders.filter(o => o.waiter_id === waiter.id);
    const waiterRatings = ratings.filter(r => r.waiter_id === waiter.id);
    const avgWaiterRating = waiterRatings.length > 0
      ? (waiterRatings.reduce((sum, r) => sum + r.stars, 0) / waiterRatings.length).toFixed(1)
      : '0.0';
    const totalServiceFee = waiterOrders.reduce((sum, o) => sum + (o.service_fee || 0), 0);
    
    return {
      name: waiter.name,
      orders: waiterOrders.length,
      serviceFee: totalServiceFee,
      rating: avgWaiterRating,
    };
  }).sort((a, b) => b.orders - a.orders);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar restaurant={restaurant} onLogout={handleLogout} />
      
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        {/* Menu Link Card */}
        <Card className="mb-8 border-2 border-emerald-200 shadow-lg bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center">
                  <UtensilsCrossed className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Cardápio Digital</h3>
                  <p className="text-sm text-gray-500">Compartilhe com seus clientes</p>
                </div>
              </div>
              <Button
                onClick={handleCopyMenuLink}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {linkCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Link
                  </>
                )}
              </Button>
            </div>
            <div className="mt-4 p-3 bg-white rounded-lg border border-emerald-200">
              <p className="text-xs text-gray-600 break-all">
                {window.location.origin}{createPageUrl('CustomerMenu')}?r={restaurant?.id}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Faturamento Hoje"
            value={`R$ ${todayRevenue.toFixed(2)}`}
            subtitle={`${todayPaidOrders.length} pedidos`}
            icon={DollarSign}
            color="emerald"
          />
          <StatsCard
            title="Total 10% (Serviço)"
            value={`R$ ${totalServiceFee.toFixed(2)}`}
            subtitle="Taxa de serviço"
            icon={TrendingUp}
            color="amber"
          />
          <StatsCard
            title="Mesas em Uso"
            value={`${inUseTables}/${tables.length}`}
            subtitle={`${freeTables} livres`}
            icon={LayoutDashboard}
            color="blue"
          />
          <StatsCard
            title="Avaliação Média"
            value={avgRating}
            subtitle={`${ratings.length} avaliações`}
            icon={Star}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Table Status */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-800">Status das Mesas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tableStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {tableStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                {tableStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Items */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-800">Itens Mais Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders by Staff */}
        <Card className="shadow-lg border-0 mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Pedidos por Funcionário
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const yesterday = new Date(selectedDate);
                    yesterday.setDate(yesterday.getDate() - 1);
                    setSelectedDate(yesterday);
                  }}
                >
                  ← Anterior
                </Button>
                <span className="text-sm font-medium px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
                  {format(selectedDate, "dd/MM/yyyy")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tomorrow = new Date(selectedDate);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setSelectedDate(tomorrow);
                  }}
                  disabled={format(selectedDate, 'yyyy-MM-dd') >= format(new Date(), 'yyyy-MM-dd')}
                >
                  Próximo →
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Hoje
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total de pedidos no dia:</span>
                <span className="text-2xl font-bold text-blue-600">{selectedDayOrders.length}</span>
              </div>
            </div>
            
            {/* Customer Orders */}
            {(() => {
              const customerDayOrders = selectedDayOrders.filter(o => o.waiter_id === 'CLIENTE');
              if (customerDayOrders.length > 0) {
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 pb-6 border-b border-gray-100"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        C
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">Cliente</h4>
                        <p className="text-sm text-gray-500">{customerDayOrders.length} pedido(s)</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 text-base px-3 py-1">
                        {customerDayOrders.length} pedidos
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 ml-15">
                      {customerDayOrders.map((order) => (
                        <div key={order.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">Mesa {order.table_number}</span>
                              <Badge variant="outline" className={
                                order.status === 'PAGA' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                order.status === 'CANCELADA' ? 'border-red-200 bg-red-50 text-red-700' :
                                order.status === 'ABERTA' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                                'border-amber-200 bg-amber-50 text-amber-700'
                              }>
                                {order.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">
                              <span className="text-sm text-gray-500">
  {toLocalTime(order.created_date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}
</span>

                              </span>
                              {order.status !== 'PAGA' && order.status !== 'CANCELADA' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelOrder(order)}
                                  className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteOrder(order)}
                                className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mb-2 space-y-1">
                            {(order.items || []).map((item, idx) => (
                              <div key={idx} className="text-sm text-gray-600">
                                <span className="font-medium">{item.quantity}x</span> {item.name}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-2">
                            <span className="text-gray-500">Total</span>
                            <span className={`font-semibold ${order.status === 'CANCELADA' ? 'text-red-600 line-through' : 'text-emerald-600'}`}>
                              R$ {(order.total || 0).toFixed(2)}
                            </span>
                          </div>
                          {order.cancel_reason && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                              Motivo: {order.cancel_reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              }
              return null;
            })()}

            {/* Show all staff with orders */}
            {(() => {
              // Get unique waiter IDs from orders
              const waiterIds = [...new Set(selectedDayOrders.map(o => o.waiter_id).filter(id => id !== 'CLIENTE'))];
              // Map to staff data
              const staffWithOrders = waiterIds.map(waiterId => {
                const staffMember = staffList.find(s => s.id === waiterId);
                return staffMember || { id: waiterId, name: 'Funcionário (removido)', role: 'WAITER' };
              });

              return staffWithOrders.map((waiter, index) => {
                const waiterDayOrders = selectedDayOrders.filter(o => o.waiter_id === waiter.id);

                if (waiterDayOrders.length === 0) return null;

              const displayName = waiter.role === 'ADMIN' ? 'Adm' : waiter.name;
              const bgColor = waiter.role === 'ADMIN' ? 'from-emerald-500 to-emerald-600' : 'from-amber-500 to-amber-600';

              return (
                <motion.div
                  key={waiter.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="mb-6 pb-6 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${bgColor} rounded-full flex items-center justify-center text-white font-bold`}>
                      {displayName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{displayName}</h4>
                      <p className="text-sm text-gray-500">{waiterDayOrders.length} pedido(s)</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 text-base px-3 py-1">
                      {waiterDayOrders.length} pedidos
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 ml-15">
                    {waiterDayOrders.map((order) => (
                      <div key={order.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">Mesa {order.table_number}</span>
                            <Badge variant="outline" className={
                              order.status === 'PAGA' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                              order.status === 'CANCELADA' ? 'border-red-200 bg-red-50 text-red-700' :
                              order.status === 'ABERTA' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                              'border-amber-200 bg-amber-50 text-amber-700'
                            }>
                              {order.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                            {toLocalTime(order.created_date).toLocaleTimeString('pt-BR', {
  hour: '2-digit',
   minute: '2-digit',
 })}
                            </span>
                            {order.status !== 'PAGA' && order.status !== 'CANCELADA' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCancelOrder(order)}
                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteOrder(order)}
                              className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mb-2 space-y-1">
                          {(order.items || []).map((item, idx) => (
                            <div key={idx} className="text-sm text-gray-600">
                              <span className="font-medium">{item.quantity}x</span> {item.name}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-2">
                          <span className="text-gray-500">Total</span>
                          <span className={`font-semibold ${order.status === 'CANCELADA' ? 'text-red-600 line-through' : 'text-emerald-600'}`}>
                            R$ {(order.total || 0).toFixed(2)}
                          </span>
                        </div>
                        {order.cancel_reason && (
                          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                            Motivo: {order.cancel_reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
                );
                });
                })()}

                {selectedDayOrders.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum pedido nesta data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waiter Performance */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800">Desempenho dos Garçons (Geral)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Garçom</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Comandas</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">10% Gerado</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Avaliação</th>
                  </tr>
                </thead>
                <tbody>
                  {waiterPerformance.map((waiter, index) => (
                    <motion.tr
                      key={waiter.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {waiter.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-800">{waiter.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {waiter.orders}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-center font-semibold text-emerald-600">
                        R$ {waiter.serviceFee.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="font-medium">{waiter.rating}</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {waiterPerformance.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400">
                        Nenhum garçom cadastrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Cancelar Pedido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                Cancelar pedido da <strong>Mesa {selectedOrder?.table_number}</strong>
              </p>
              <p className="text-sm text-red-700 mt-1">
                Total: R$ {(selectedOrder?.total || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2">
                Motivo do Cancelamento (opcional)
              </Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Cliente desistiu, erro no pedido..."
                className="mt-2"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelDialogOpen(false);
                  setCancelReason('');
                  setSelectedOrder(null);
                }}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={handleConfirmCancel}
                disabled={cancelOrderMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Confirmar Cancelamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}