import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Send,
  CreditCard,
  Loader2,
  ChefHat,
  Clock,
  XCircle,
  Users,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function TableOrder() {
  const [staff, setStaff] = useState(null);
  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [includeServiceFee, setIncludeServiceFee] = useState(true);
  const [splitMode, setSplitMode] = useState('full'); // 'full', 'equal', 'manual'
  const [splitCount, setSplitCount] = useState(2);
  const [manualSplits, setManualSplits] = useState([]);

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelItemDialogOpen, setIsCancelItemDialogOpen] = useState(false);
  const [itemToCancel, setItemToCancel] = useState(null);
  const [itemCancelReason, setItemCancelReason] = useState('');
  const [isEditingCustomerName, setIsEditingCustomerName] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const searchInputRef = useRef(null);
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

    const urlParams = new URLSearchParams(window.location.search);
    const tableId = urlParams.get('tableId');
    if (tableId) {
      loadTable(tableId);
    }
  }, []);

  const loadTable = async (tableId) => {
    const tables = await base44.entities.Table.filter({ id: tableId });
    if (tables.length > 0) {
      setTable(tables[0]);
      if (tables[0].current_order_id) {
        const orders = await base44.entities.Order.filter({ id: tables[0].current_order_id });
        if (orders.length > 0) {
          setOrder(orders[0]);
        }
      }
    }
  };

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', staff?.restaurant_id],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: staff?.restaurant_id, is_active: true }),
    enabled: !!staff,
  });

  const { data: kitchenOrders = [] } = useQuery({
    queryKey: ['kitchenOrders', order?.id],
    queryFn: () => base44.entities.KitchenOrder.filter({ order_id: order?.id }),
    enabled: !!order,
    refetchInterval: 5000,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData) => {
      const newOrder = await base44.entities.Order.create(orderData);
      await base44.entities.Table.update(table.id, {
        status: 'EM_USO',
        current_order_id: newOrder.id,
        current_waiter_id: staff.id,
      });
      return newOrder;
    },
    onSuccess: (newOrder) => {
      setOrder(newOrder);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: (updatedOrder) => {
      setOrder(updatedOrder);
    },
  });

  const updateCustomerNameMutation = useMutation({
    mutationFn: async (customerName) => {
      await base44.entities.Order.update(order.id, {
        waiter_name: customerName,
      });
    },
    onSuccess: (_, customerName) => {
      setOrder({ ...order, waiter_name: customerName });
      setIsEditingCustomerName(false);
      setCustomerNameInput('');
    },
  });

  const createKitchenOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.KitchenOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchenOrders'] });
    },
  });

  const closeOrderMutation = useMutation({
    mutationFn: async () => {
      const finalServiceFee = includeServiceFee ? subtotal * 0.1 : 0;
      const finalTotal = subtotal + finalServiceFee;
      
      await base44.entities.Order.update(order.id, {
        status: 'PAGA',
        service_fee: finalServiceFee,
        total: finalTotal,
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
        paid_by_staff_id: staff.id,
      });
      await base44.entities.Table.update(table.id, {
        status: 'LIVRE',
        current_order_id: null,
        current_waiter_id: null,
      });
      
      // Clear customer name from localStorage if it was a customer order
      if (order.waiter_name && order.waiter_name !== staff.name) {
        localStorage.removeItem(`customer_name_${staff.restaurant_id}`);
        localStorage.removeItem(`customer_table_${staff.restaurant_id}`);
      }
    },
    onSuccess: () => {
      window.location.href = createPageUrl(`CustomerRating?orderId=${order.id}`);
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      // Cancel the order
      await base44.entities.Order.update(order.id, {
        status: 'CANCELADA',
        cancelled_at: new Date().toISOString(),
        cancelled_by_staff_id: staff.id,
        cancel_reason: cancelReason,
      });
      
      // Cancel all related kitchen orders
      const relatedKitchenOrders = await base44.entities.KitchenOrder.filter({ order_id: order.id });
      await Promise.all(
        relatedKitchenOrders.map(ko => 
          base44.entities.KitchenOrder.update(ko.id, {
            status: 'CANCELADO',
            cancelled_at: new Date().toISOString(),
          })
        )
      );
      
      // Free the table
      await base44.entities.Table.update(table.id, {
        status: 'LIVRE',
        current_order_id: null,
        current_waiter_id: null,
      });
    },
    onSuccess: () => {
      window.location.href = createPageUrl(staff?.role === 'ADMIN' ? 'AdminTables' : 'WaiterDashboard');
    },
  });

  const toggleAddon = (addon) => {
    if (selectedAddons.find(a => a.name === addon.name)) {
      setSelectedAddons(selectedAddons.filter(a => a.name !== addon.name));
    } else {
      const maxAddons = selectedItem?.max_addons;
      if (maxAddons && selectedAddons.length >= maxAddons) {
        return;
      }
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const handleAddItem = async () => {
    if (!selectedItem) return;

    const addonsTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
    const finalPrice = selectedItem.price + addonsTotal;

    const newItem = {
      item_id: selectedItem.id,
      name: selectedItem.name,
      price: finalPrice,
      originalPrice: selectedItem.price,
      quantity: itemQuantity,
      notes: itemNotes,
      addons: selectedAddons,
      added_at: new Date().toISOString(),
    };

    let currentOrder = order;

    if (!currentOrder) {
      currentOrder = await createOrderMutation.mutateAsync({
        restaurant_id: staff.restaurant_id,
        table_id: table.id,
        table_number: table.number,
        waiter_id: staff.id,
        waiter_name: staff.name,
        items: [],
        subtotal: 0,
        service_fee: 0,
        total: 0,
      });
    }

    const allItems = [...(currentOrder.items || []), newItem];
    const subtotal = allItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const serviceFee = subtotal * 0.1;
    const total = subtotal + serviceFee;

    const updatedOrder = await updateOrderMutation.mutateAsync({
      id: currentOrder.id,
      data: {
        items: allItems,
        subtotal,
        service_fee: serviceFee,
        total,
      },
    });

    let kitchenItemName = newItem.name;
    if (newItem.addons && newItem.addons.length > 0) {
      const addonNames = newItem.addons.map(a => a.name).join(', ');
      kitchenItemName = `${newItem.name} (+ ${addonNames})`;
    }

    await createKitchenOrderMutation.mutateAsync({
      restaurant_id: staff.restaurant_id,
      order_id: currentOrder.id,
      table_number: table.number,
      waiter_name: staff.name,
      items: [{
        name: kitchenItemName,
        quantity: newItem.quantity,
        notes: newItem.notes,
      }],
      status: 'NOVO',
    });

    setOrder(updatedOrder);
    setSelectedItem(null);
    setItemQuantity(1);
    setItemNotes('');
    setSelectedAddons([]);
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const handleRequestPayment = () => {
    if (!order || order.items?.length === 0) return;
    setSplitMode('full');
    setSplitCount(2);
    setManualSplits([]);
    setIsPaymentDialogOpen(true);
  };

  const handleConfirmPayment = () => {
    closeOrderMutation.mutate();
  };

  const handleCancelOrder = () => {
    cancelOrderMutation.mutate();
  };

  const cancelItemMutation = useMutation({
    mutationFn: async ({ itemIndex, reason }) => {
      const canceledItem = order.items[itemIndex];
      const updatedItems = order.items.filter((_, idx) => idx !== itemIndex);
      const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const newServiceFee = newSubtotal * 0.1;
      const newTotal = newSubtotal + newServiceFee;

      await base44.entities.Order.update(order.id, {
        items: updatedItems,
        subtotal: newSubtotal,
        service_fee: newServiceFee,
        total: newTotal,
      });

      // Find and delete matching kitchen orders
      const relatedKitchenOrders = await base44.entities.KitchenOrder.filter({ 
        order_id: order.id,
        status: { $in: ['NOVO', 'EM_PREPARO', 'PRONTO'] }
      });
      
      // Sort kitchen orders by created_date to match oldest first
      const sortedKOs = [...relatedKitchenOrders].sort((a, b) => 
        new Date(a.created_date) - new Date(b.created_date)
      );
      
      for (const ko of sortedKOs) {
        // Check if this kitchen order contains the canceled item
        const koItemIndex = ko.items.findIndex(item => 
          item.name === canceledItem.name && 
          item.quantity === canceledItem.quantity &&
          item.notes === (canceledItem.notes || '')
        );
        
        if (koItemIndex !== -1) {
          // If kitchen order has only this item, delete it
          if (ko.items.length === 1) {
            await base44.entities.KitchenOrder.delete(ko.id);
          } else {
            // If kitchen order has multiple items, remove only this specific item
            const updatedKOItems = [...ko.items];
            updatedKOItems.splice(koItemIndex, 1);
            await base44.entities.KitchenOrder.update(ko.id, {
              items: updatedKOItems
            });
          }
          break; // Stop after removing the first matching occurrence
        }
      }

      // Log the cancellation
      await base44.entities.ActivityLog.create({
        restaurant_id: staff.restaurant_id,
        staff_id: staff.id,
        staff_name: staff.name,
        action: 'CANCELAR_ITEM',
        entity_type: 'Order',
        entity_id: order.id,
        details: `Item cancelado: ${canceledItem.name} (${canceledItem.quantity}x)${reason ? ` - Motivo: ${reason}` : ''}`,
      });

      return { ...order, items: updatedItems, subtotal: newSubtotal, service_fee: newServiceFee, total: newTotal };
    },
    onSuccess: (updatedOrder) => {
      setOrder(updatedOrder);
      queryClient.invalidateQueries({ queryKey: ['kitchenOrders'] });
      setIsCancelItemDialogOpen(false);
      setItemToCancel(null);
      setItemCancelReason('');
    },
  });

  const handleCancelItem = (itemIndex) => {
    setItemToCancel(itemIndex);
    setIsCancelItemDialogOpen(true);
  };

  const handleConfirmCancelItem = () => {
    if (itemToCancel !== null) {
      cancelItemMutation.mutate({ itemIndex: itemToCancel, reason: itemCancelReason });
    }
  };

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 8);

  const statusColors = {
    NOVO: 'bg-blue-100 text-blue-700',
    EM_PREPARO: 'bg-amber-100 text-amber-700',
    PRONTO: 'bg-emerald-100 text-emerald-700',
    ENTREGUE: 'bg-gray-100 text-gray-700',
  };

  const statusLabels = {
    NOVO: 'Novo',
    EM_PREPARO: 'Preparando',
    PRONTO: 'Pronto',
    ENTREGUE: 'Entregue',
  };

  if (!staff || !table) return null;

  const orderItems = order?.items || [];
  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const serviceFee = subtotal * 0.1;
  const total = subtotal + serviceFee;

  const finalServiceFee = includeServiceFee ? subtotal * 0.1 : 0;
  const finalTotal = subtotal + finalServiceFee;

  // Calculate split values
  const getSplitValues = () => {
    if (splitMode === 'full') {
      return [{ amount: finalTotal, label: 'Total' }];
    } else if (splitMode === 'equal') {
      const perPerson = finalTotal / splitCount;
      return Array.from({ length: splitCount }, (_, i) => ({
        amount: perPerson,
        label: `Pessoa ${i + 1}`
      }));
    } else {
      return manualSplits.map((split, i) => ({
        amount: split,
        label: `Pessoa ${i + 1}`
      }));
    }
  };

  const addManualSplit = () => {
    if (manualSplits.length < 10) {
      setManualSplits([...manualSplits, 0]);
    }
  };

  const updateManualSplit = (index, value) => {
    const newSplits = [...manualSplits];
    newSplits[index] = parseFloat(value) || 0;
    setManualSplits(newSplits);
  };

  const removeManualSplit = (index) => {
    setManualSplits(manualSplits.filter((_, i) => i !== index));
  };

  const manualSplitTotal = manualSplits.reduce((sum, val) => sum + val, 0);
  const manualSplitRemaining = finalTotal - manualSplitTotal;

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
          <div className="flex-1">
            <h1 className="font-bold text-gray-800">Mesa {table.number}</h1>
            {order?.waiter_name && order.waiter_name !== staff.name ? (
              <p className="text-sm text-gray-600">Cliente: {order.waiter_name}</p>
            ) : order && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditingCustomerName(true);
                  setCustomerNameInput(order.waiter_name === staff.name ? '' : order.waiter_name || '');
                }}
                className="text-xs text-blue-600 hover:text-blue-700 h-6 px-2 -ml-2"
              >
                {order.waiter_name === staff.name ? '+ Adicionar Nome do Cliente' : 'Editar Cliente'}
              </Button>
            )}
            <Badge className={`text-xs ${
              table.status === 'LIVRE' ? 'bg-emerald-100 text-emerald-700' :
              table.status === 'EM_USO' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {table.status === 'LIVRE' ? 'Livre' : 
               table.status === 'EM_USO' ? 'Em Uso' : 'Aguardando Pagamento'}
            </Badge>
          </div>
        </div>
      </header>

      <main className="p-4 pb-32">
        {/* Search */}
        <Card className="mb-4 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar item do cardápio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg border-2 focus:border-amber-500"
              />
            </div>

            {/* Search Results */}
            <AnimatePresence>
              {searchQuery && filteredItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-3 space-y-2"
                >
                  {filteredItems.map((item) => (
                    <motion.div
                      key={item.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedItem(item);
                        setSearchQuery('');
                      }}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedItem?.id === item.id
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-100 bg-white hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">{item.description}</p>
                          )}
                        </div>
                        <p className="font-bold text-emerald-600">R$ {item.price.toFixed(2)}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {searchQuery && filteredItems.length === 0 && (
              <p className="mt-3 text-center text-gray-400">Nenhum item encontrado</p>
            )}
          </CardContent>
        </Card>

        {/* Selected Item */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <Card className="mb-4 border-2 border-amber-400 shadow-lg bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-bold text-gray-800">{selectedItem.name}</p>
                      <p className="text-emerald-600 font-semibold">R$ {selectedItem.price.toFixed(2)}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedItem(null)}>
                      <Trash2 className="w-5 h-5 text-gray-400" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-gray-600">Quantidade:</span>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="text-xl font-bold w-8 text-center">{itemQuantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setItemQuantity(itemQuantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    placeholder="Observações (opcional)..."
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    className="mb-4"
                  />

                  {/* Addons Section */}
                  {selectedItem.addons && selectedItem.addons.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Adicionais:</span>
                        {selectedItem.max_addons && (
                          <span className="text-xs text-gray-500">
                            Máx: {selectedItem.max_addons} ({selectedAddons.length}/{selectedItem.max_addons})
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {selectedItem.addons.map((addon, idx) => {
                          const isSelected = selectedAddons.find(a => a.name === addon.name);
                          const isDisabled = selectedItem.max_addons && selectedAddons.length >= selectedItem.max_addons && !isSelected;
                          return (
                            <div
                              key={idx}
                              onClick={() => !isDisabled && toggleAddon(addon)}
                              className={`p-2 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? 'border-amber-500 bg-amber-50 cursor-pointer'
                                  : isDisabled
                                  ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                                  : 'border-gray-200 bg-white hover:border-amber-300 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-sm font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-800'}`}>
                                  {addon.name}
                                </span>
                                <span className={`text-sm font-semibold ${isDisabled ? 'text-gray-400' : 'text-amber-600'}`}>
                                  + R$ {addon.price.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {selectedAddons.length > 0 && (
                        <div className="bg-blue-50 rounded-lg p-2 border border-blue-200 mt-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Preço com adicionais:</span>
                            <span className="font-bold text-amber-600">
                              R$ {(selectedItem.price + selectedAddons.reduce((sum, a) => sum + a.price, 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleAddItem}
                    disabled={createOrderMutation.isPending || updateOrderMutation.isPending || createKitchenOrderMutation.isPending}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white h-12"
                  >
                    {(createOrderMutation.isPending || updateOrderMutation.isPending || createKitchenOrderMutation.isPending) ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mr-2" />
                        Adicionar à Comanda
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>





        {/* Current Order */}
        {orderItems.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comanda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.quantity}x {item.name}</p>
                      {item.addons && item.addons.length > 0 && (
                        <p className="text-xs text-emerald-600">
                          + {item.addons.map(a => a.name).join(', ')}
                        </p>
                      )}
                      {item.notes && <p className="text-sm text-gray-400">{item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelItem(index)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-600 font-medium">
                  <span>10% Serviço</span>
                  <span>R$ {serviceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-gray-800 pt-2">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Bottom Action Bar */}
      {order && orderItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-2xl border-t p-4">
          <Button
            onClick={handleRequestPayment}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-lg"
          >
            <CreditCard className="w-6 h-6 mr-2" />
            Fechar Conta - R$ {total.toFixed(2)}
          </Button>
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fechar Conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className={includeServiceFee ? 'text-amber-600' : 'text-gray-400'}>10% Serviço</span>
                  <Switch
                    checked={includeServiceFee}
                    onCheckedChange={setIncludeServiceFee}
                  />
                </div>
                <span className={includeServiceFee ? 'text-amber-600' : 'text-gray-400'}>
                  R$ {finalServiceFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total</span>
                <span>R$ {finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Split Mode Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Divisão da Conta
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={splitMode === 'full' ? 'default' : 'outline'}
                  onClick={() => setSplitMode('full')}
                  className="h-auto py-3 flex flex-col items-center gap-1"
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs">Integral</span>
                </Button>
                <Button
                  variant={splitMode === 'equal' ? 'default' : 'outline'}
                  onClick={() => setSplitMode('equal')}
                  className="h-auto py-3 flex flex-col items-center gap-1"
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs">Dividir Igual</span>
                </Button>
                <Button
                  variant={splitMode === 'manual' ? 'default' : 'outline'}
                  onClick={() => {
                    setSplitMode('manual');
                    if (manualSplits.length === 0) {
                      setManualSplits([0, 0]);
                    }
                  }}
                  className="h-auto py-3 flex flex-col items-center gap-1"
                >
                  <UserPlus className="w-5 h-5" />
                  <span className="text-xs">Manual</span>
                </Button>
              </div>
            </div>

            {/* Equal Split Options */}
            {splitMode === 'equal' && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Número de Pessoas (2-10)
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSplitCount(Math.max(2, splitCount - 1))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-2xl font-bold w-12 text-center">{splitCount}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSplitCount(Math.min(10, splitCount + 1))}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="pt-2 border-t border-blue-200">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Por pessoa:</span>
                    <span className="text-emerald-600">R$ {(finalTotal / splitCount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Split Options */}
            {splitMode === 'manual' && (
              <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Valores por Pessoa
                  </label>
                  {manualSplits.length < 10 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addManualSplit}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  )}
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {manualSplits.map((split, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-20">Pessoa {index + 1}:</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={split || ''}
                        onChange={(e) => updateManualSplit(index, e.target.value)}
                        className="flex-1"
                      />
                      {manualSplits.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeManualSplit(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-purple-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total parcial:</span>
                    <span className="font-semibold">R$ {manualSplitTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span className={manualSplitRemaining === 0 ? 'text-emerald-600' : manualSplitRemaining < 0 ? 'text-red-600' : 'text-amber-600'}>
                      {manualSplitRemaining === 0 ? 'Completo ✓' : manualSplitRemaining < 0 ? 'Excesso:' : 'Faltando:'}
                    </span>
                    <span className={manualSplitRemaining === 0 ? 'text-emerald-600' : manualSplitRemaining < 0 ? 'text-red-600' : 'text-amber-600'}>
                      R$ {Math.abs(manualSplitRemaining).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Split Summary */}
            {(splitMode === 'equal' || (splitMode === 'manual' && manualSplitTotal > 0)) && (
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                <p className="text-sm font-medium text-emerald-800 mb-2">Resumo da Divisão:</p>
                <div className="space-y-1">
                  {getSplitValues().map((split, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-700">{split.label}:</span>
                      <span className="font-semibold text-emerald-700">R$ {split.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forma de Pagamento
              </label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                  <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} className="flex-1">
                  Voltar
                </Button>
                <Button
                  onClick={handleConfirmPayment}
                  disabled={
                    !paymentMethod || 
                    closeOrderMutation.isPending ||
                    (splitMode === 'manual' && manualSplitRemaining !== 0)
                  }
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {closeOrderMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Confirmar Pagamento'
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setIsPaymentDialogOpen(false);
                  setIsCancelDialogOpen(true);
                }}
                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar Pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancelar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-gray-600">
              Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
            </p>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo do Cancelamento
              </label>
              <Textarea
                placeholder="Descreva o motivo do cancelamento..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">
                ⚠️ O pedido será marcado como cancelado e a mesa será liberada.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)} className="flex-1">
                Voltar
              </Button>
              <Button
                onClick={handleCancelOrder}
                disabled={!cancelReason.trim() || cancelOrderMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {cancelOrderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Confirmar Cancelamento
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Name Dialog */}
      <Dialog open={isEditingCustomerName} onOpenChange={setIsEditingCustomerName}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nome do Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome
              </label>
              <Input
                placeholder="Digite o nome do cliente"
                value={customerNameInput}
                onChange={(e) => setCustomerNameInput(e.target.value)}
                className="h-12"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditingCustomerName(false);
                  setCustomerNameInput('');
                }} 
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (customerNameInput.trim()) {
                    updateCustomerNameMutation.mutate(customerNameInput.trim());
                  }
                }}
                disabled={!customerNameInput.trim() || updateCustomerNameMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {updateCustomerNameMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Item Dialog */}
      <Dialog open={isCancelItemDialogOpen} onOpenChange={setIsCancelItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancelar Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-gray-600">
              Tem certeza que deseja cancelar este item da comanda?
            </p>
            
            {itemToCancel !== null && order?.items?.[itemToCancel] && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="font-semibold text-gray-800">
                  {order.items[itemToCancel].quantity}x {order.items[itemToCancel].name}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  R$ {(order.items[itemToCancel].price * order.items[itemToCancel].quantity).toFixed(2)}
                </p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo do Cancelamento (opcional)
              </label>
              <Textarea
                placeholder="Descreva o motivo do cancelamento..."
                value={itemCancelReason}
                onChange={(e) => setItemCancelReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCancelItemDialogOpen(false);
                  setItemToCancel(null);
                  setItemCancelReason('');
                }} 
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={handleConfirmCancelItem}
                disabled={cancelItemMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {cancelItemMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Confirmar Cancelamento'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}