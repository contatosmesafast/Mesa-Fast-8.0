import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Calendar, ShoppingBag, TrendingUp, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';
import { format, startOfDay, endOfDay } from 'date-fns';

export default function AdminBilling() {
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCategory, setExpandedCategory] = useState(null);

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
    queryFn: () => base44.entities.Order.filter({ restaurant_id: staff?.restaurant_id, status: 'PAGA' }),
    enabled: !!staff,
    refetchInterval: 5000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', staff?.restaurant_id],
    queryFn: () => base44.entities.MenuCategory.filter({ restaurant_id: staff?.restaurant_id, is_active: true }),
    enabled: !!staff,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', staff?.restaurant_id],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
  });

  const handleLogout = async () => {
    localStorage.removeItem('staff_session');
    await base44.auth.logout(createPageUrl('Home'));
  };

  if (!staff) return null;

  // Helper to convert UTC to local time
  const toLocalTime = (dateString) => {
    const date = new Date(dateString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  };

  // Filter orders by selected date
  const dayOrders = orders.filter(o => {
    const orderDate = toLocalTime(o.created_date);
    // Parse selected date as local date (not UTC)
    const [year, month, day] = selectedDate.split('-').map(Number);
    const selectedDateObj = new Date(year, month - 1, day);
    const dayStart = startOfDay(selectedDateObj);
    const dayEnd = endOfDay(selectedDateObj);
    return orderDate >= dayStart && orderDate <= dayEnd;
  });

  // Create a map of item_id to category
  const itemCategoryMap = {};
  menuItems.forEach(item => {
    itemCategoryMap[item.id] = item.category_id;
  });

  // Filter by category if selected
  const filteredOrders = selectedCategory === 'all' 
    ? dayOrders 
    : dayOrders.filter(order => {
        // Check if order has items from selected category
        return order.items?.some(item => {
          const categoryId = itemCategoryMap[item.item_id];
          return categoryId === selectedCategory;
        });
      });

  // Calculate totals
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const totalSubtotal = filteredOrders.reduce((sum, order) => sum + (order.subtotal || 0), 0);
  const totalServiceFee = filteredOrders.reduce((sum, order) => sum + (order.service_fee || 0), 0);
  const totalOrders = filteredOrders.length;

  // Group items by category
  const itemsByCategory = {};
  filteredOrders.forEach(order => {
    order.items?.forEach(item => {
      const categoryId = itemCategoryMap[item.item_id] || 'sem_categoria';
      if (!itemsByCategory[categoryId]) {
        itemsByCategory[categoryId] = {
          items: [],
          itemDetails: {},
          total: 0,
          quantity: 0,
        };
      }
      itemsByCategory[categoryId].items.push(item);
      
      // Group by item name for detailed breakdown
      if (!itemsByCategory[categoryId].itemDetails[item.name]) {
        itemsByCategory[categoryId].itemDetails[item.name] = {
          name: item.name,
          quantity: 0,
          price: item.price,
          total: 0,
        };
      }
      itemsByCategory[categoryId].itemDetails[item.name].quantity += item.quantity;
      itemsByCategory[categoryId].itemDetails[item.name].total += item.price * item.quantity;
      
      itemsByCategory[categoryId].total += item.price * item.quantity;
      itemsByCategory[categoryId].quantity += item.quantity;
    });
  });

  // Sort categories by total
  const sortedCategories = Object.entries(itemsByCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([categoryId, data]) => {
      const category = categories.find(c => c.id === categoryId);
      return {
        categoryId,
        categoryName: category?.name || 'Sem Categoria',
        ...data,
      };
    });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar restaurant={restaurant} onLogout={handleLogout} />
      
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-600" />
            Faturamento
          </h1>
          <p className="text-gray-500 mt-1">Análise detalhada de vendas por categoria</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Filtrar por Data
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Filtrar por Categoria
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm mb-1">Faturamento Total</p>
                  <p className="text-3xl font-bold">R$ {totalRevenue.toFixed(2)}</p>
                </div>
                <DollarSign className="w-12 h-12 text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-1">Subtotal</p>
                  <p className="text-3xl font-bold">R$ {totalSubtotal.toFixed(2)}</p>
                </div>
                <ShoppingBag className="w-12 h-12 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm mb-1">Taxa de Serviço</p>
                  <p className="text-3xl font-bold">R$ {totalServiceFee.toFixed(2)}</p>
                </div>
                <TrendingUp className="w-12 h-12 text-amber-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm mb-1">Total de Pedidos</p>
                  <p className="text-3xl font-bold">{totalOrders}</p>
                </div>
                <ShoppingBag className="w-12 h-12 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown */}
        {sortedCategories.length > 0 && (
          <Card className="border-0 shadow-md mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Faturamento por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sortedCategories.map((cat, index) => {
                  const isExpanded = expandedCategory === cat.categoryId;
                  const itemDetailsList = Object.values(cat.itemDetails).sort((a, b) => b.total - a.total);
                  
                  return (
                    <motion.div
                      key={cat.categoryId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-gray-50 rounded-lg overflow-hidden"
                    >
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setExpandedCategory(isExpanded ? null : cat.categoryId)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{cat.categoryName}</p>
                              <p className="text-sm text-gray-500">{cat.quantity} itens vendidos</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-600">
                              R$ {cat.total.toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {((cat.total / totalSubtotal) * 100).toFixed(1)}% do total
                            </p>
                          </div>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                          <div 
                            className="bg-emerald-500 h-2 rounded-full transition-all"
                            style={{ width: `${(cat.total / totalSubtotal) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Expanded Item Details */}
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-4 pb-4"
                        >
                          <div className="bg-white rounded-lg p-4 space-y-2">
                            <p className="font-semibold text-gray-700 mb-3 text-sm">Detalhamento de Itens:</p>
                            {itemDetailsList.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-700">{item.quantity}x</span>
                                  <span className="text-gray-800">{item.name}</span>
                                  <span className="text-xs text-gray-500">
                                    (R$ {item.price.toFixed(2)} cada)
                                  </span>
                                </div>
                                <span className="font-semibold text-emerald-600">
                                  R$ {item.total.toFixed(2)}
                                </span>
                              </div>
                            ))}
                            <div className="pt-3 border-t-2 border-emerald-200 flex justify-between">
                              <span className="font-bold text-gray-800">Total da Categoria:</span>
                              <span className="font-bold text-emerald-600 text-lg">
                                R$ {cat.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders List */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              Pedidos do Dia ({filteredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum pedido encontrado para os filtros selecionados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg text-gray-800">Mesa {order.table_number}</span>
                          <Badge className="bg-emerald-100 text-emerald-700">Paga</Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          {toLocalTime(order.created_date).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })} - {order.waiter_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">
                          R$ {order.total.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">{order.payment_method}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {order.items?.map((item, idx) => {
                        const categoryId = itemCategoryMap[item.item_id];
                        const category = categories.find(c => c.id === categoryId);
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm py-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-700">{item.quantity}x</span>
                              <span className="text-gray-800">{item.name}</span>
                              {category && (
                                <Badge variant="outline" className="text-xs">
                                  {category.name}
                                </Badge>
                              )}
                            </div>
                            <span className="text-gray-600">
                              R$ {(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal: R$ {order.subtotal.toFixed(2)}</span>
                      <span className="text-gray-600">Taxa 10%: R$ {order.service_fee.toFixed(2)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}