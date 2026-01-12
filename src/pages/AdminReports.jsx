import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Star,
  Download,
  Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

export default function AdminReports() {
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [dateRange, setDateRange] = useState('week');
  const [selectedWaiter, setSelectedWaiter] = useState('all');

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

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', staff?.restaurant_id],
    queryFn: () => base44.entities.Order.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['ratings', staff?.restaurant_id],
    queryFn: () => base44.entities.Rating.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staffList', staff?.restaurant_id],
    queryFn: () => base44.entities.Staff.filter({ restaurant_id: staff?.restaurant_id, role: 'WAITER' }),
    enabled: !!staff,
  });

  const handleLogout = async () => {
    localStorage.removeItem('staff_session');
    await base44.auth.logout(createPageUrl('Home'));
  };

  if (!staff) return null;

  // Filter by date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last30':
        return { start: subDays(now, 30), end: now };
      default:
        return { start: subDays(now, 7), end: now };
    }
  };

  const { start, end } = getDateRange();

  const filteredOrders = orders.filter(o => {
    const orderDate = new Date(o.created_date);
    const inDateRange = orderDate >= start && orderDate <= end;
    const isPaid = o.status === 'PAGA';
    const waiterMatch = selectedWaiter === 'all' || o.waiter_id === selectedWaiter;
    return inDateRange && isPaid && waiterMatch;
  });

  const filteredRatings = ratings.filter(r => {
    const ratingDate = new Date(r.created_date);
    const inDateRange = ratingDate >= start && ratingDate <= end;
    const waiterMatch = selectedWaiter === 'all' || r.waiter_id === selectedWaiter;
    return inDateRange && waiterMatch;
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalSubtotal = filteredOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const totalServiceFee = filteredOrders.reduce((sum, o) => sum + (o.service_fee || 0), 0);
  const avgRating = filteredRatings.length > 0
    ? (filteredRatings.reduce((sum, r) => sum + r.stars, 0) / filteredRatings.length).toFixed(1)
    : '0.0';

  // Items ranking
  const itemsSold = {};
  filteredOrders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!itemsSold[item.name]) {
        itemsSold[item.name] = { name: item.name, quantity: 0, revenue: 0 };
      }
      itemsSold[item.name].quantity += item.quantity;
      itemsSold[item.name].revenue += item.price * item.quantity;
    });
  });
  const topItems = Object.values(itemsSold).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  // Daily revenue chart
  const dailyRevenue = {};
  filteredOrders.forEach(order => {
    const day = format(new Date(order.created_date), 'dd/MM');
    if (!dailyRevenue[day]) {
      dailyRevenue[day] = { day, revenue: 0, orders: 0 };
    }
    dailyRevenue[day].revenue += order.total || 0;
    dailyRevenue[day].orders += 1;
  });
  const revenueChartData = Object.values(dailyRevenue).sort((a, b) => {
    const [dayA, monthA] = a.day.split('/');
    const [dayB, monthB] = b.day.split('/');
    return new Date(2024, monthA - 1, dayA) - new Date(2024, monthB - 1, dayB);
  });

  // Waiter performance
  const waiterPerformance = staffList.map(waiter => {
    const waiterOrders = filteredOrders.filter(o => o.waiter_id === waiter.id);
    const waiterRatings = filteredRatings.filter(r => r.waiter_id === waiter.id);
    const avgWaiterRating = waiterRatings.length > 0
      ? (waiterRatings.reduce((sum, r) => sum + r.stars, 0) / waiterRatings.length).toFixed(1)
      : '0.0';
    const totalServiceFee = waiterOrders.reduce((sum, o) => sum + (o.service_fee || 0), 0);
    const totalRevenue = waiterOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    return {
      id: waiter.id,
      name: waiter.name,
      orders: waiterOrders.length,
      revenue: totalRevenue,
      serviceFee: totalServiceFee,
      rating: avgWaiterRating,
      ratingCount: waiterRatings.length,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar restaurant={restaurant} onLogout={handleLogout} />
      
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Relatórios</h1>
            <p className="text-gray-500 mt-1">Análise de desempenho</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-8 border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Filtros:</span>
              </div>
              <div>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mês</SelectItem>
                    <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={selectedWaiter} onValueChange={setSelectedWaiter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todos os garçons" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os garçons</SelectItem>
                    {staffList.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600">
            <CardContent className="p-6 text-white">
              <DollarSign className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-sm opacity-80">Faturamento Total</p>
              <p className="text-3xl font-bold">R$ {totalRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600">
            <CardContent className="p-6 text-white">
              <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-sm opacity-80">Subtotal (sem 10%)</p>
              <p className="text-3xl font-bold">R$ {totalSubtotal.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-amber-600">
            <CardContent className="p-6 text-white">
              <DollarSign className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-sm opacity-80">Total 10% (Serviço)</p>
              <p className="text-3xl font-bold">R$ {totalServiceFee.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-purple-500 to-purple-600">
            <CardContent className="p-6 text-white">
              <Star className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-sm opacity-80">Avaliação Média</p>
              <p className="text-3xl font-bold">{avgRating} ★</p>
              <p className="text-sm opacity-80">{filteredRatings.length} avaliações</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Faturamento por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [`R$ ${value.toFixed(2)}`, 'Faturamento']}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Items */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Itens Mais Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Quantidade" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Waiter Performance Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Desempenho por Garçom</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Garçom</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Comandas</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Faturamento</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">10% Gerado</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Avaliação</th>
                  </tr>
                </thead>
                <tbody>
                  {waiterPerformance.map((waiter, index) => (
                    <motion.tr
                      key={waiter.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-white font-semibold">
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
                      <td className="py-4 px-4 text-center font-semibold text-gray-700">
                        R$ {waiter.revenue.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-center font-semibold text-emerald-600">
                        R$ {waiter.serviceFee.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="font-medium">{waiter.rating}</span>
                          <span className="text-gray-400 text-sm">({waiter.ratingCount})</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}