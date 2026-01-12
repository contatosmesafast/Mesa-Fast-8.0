import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  UtensilsCrossed, 
  Plus, 
  Minus, 
  ShoppingCart,
  Loader2,
  CheckCircle,
  Trash2,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomerMenu() {
  const [restaurantId, setRestaurantId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [tableConfirmed, setTableConfirmed] = useState(false);
  const [cart, setCart] = useState([]);
  const [orderSent, setOrderSent] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [isChangeTableDialogOpen, setIsChangeTableDialogOpen] = useState(false);
  const [changeTableCode, setChangeTableCode] = useState('');
  const [changeTableError, setChangeTableError] = useState('');
  const [selectedItemForAddons, setSelectedItemForAddons] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const restId = urlParams.get('r');
    if (restId) {
      setRestaurantId(restId);
      loadRestaurant(restId);
      
      // Load saved table number and customer name
      const savedTableNumber = localStorage.getItem(`customer_table_${restId}`);
      const savedCustomerName = localStorage.getItem(`customer_name_${restId}`);
      if (savedTableNumber && savedCustomerName) {
        setTableNumber(savedTableNumber);
        setCustomerName(savedCustomerName);
        setTableConfirmed(true);
      }
    }
  }, []);

  const loadRestaurant = async (restId) => {
    const restaurants = await base44.entities.Restaurant.filter({ id: restId });
    if (restaurants.length > 0) {
      setRestaurant(restaurants[0]);
    }
  };

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', restaurantId],
    queryFn: () => base44.entities.MenuCategory.filter({ restaurant_id: restaurantId, is_active: true }),
    enabled: !!restaurantId,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId, is_active: true }),
    enabled: !!restaurantId,
  });

  const { data: currentTableOrder = null } = useQuery({
    queryKey: ['currentTableOrder', restaurantId, tableNumber],
    queryFn: async () => {
      if (!tableNumber || !restaurantId) return null;
      const tables = await base44.entities.Table.filter({ 
        restaurant_id: restaurantId, 
        number: parseInt(tableNumber) 
      });
      if (tables.length === 0) return null;
      const table = tables[0];
      if (!table.current_order_id) return null;
      const orders = await base44.entities.Order.filter({ id: table.current_order_id });
      return orders.length > 0 ? orders[0] : null;
    },
    enabled: !!restaurantId && !!tableNumber && tableConfirmed,
    refetchInterval: 5000,
  });

  const handleChangeTable = () => {
    if (changeTableCode === '1978') {
      localStorage.removeItem(`customer_table_${restaurantId}`);
      localStorage.removeItem(`customer_name_${restaurantId}`);
      setTableConfirmed(false);
      setTableNumber('');
      setCustomerName('');
      setIsChangeTableDialogOpen(false);
      setChangeTableCode('');
      setChangeTableError('');
    } else {
      setChangeTableError('Código incorreto');
    }
  };

  const callWaiterMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.WaiterCall.create({
        restaurant_id: restaurantId,
        table_number: parseInt(tableNumber),
        status: 'PENDENTE',
      });
    },
    onSuccess: () => {
      setWaiterCalled(true);
      setTimeout(() => setWaiterCalled(false), 3000);
    },
  });

  const sendOrderMutation = useMutation({
    mutationFn: async () => {
      // Get table
      const tables = await base44.entities.Table.filter({ 
        restaurant_id: restaurantId, 
        number: parseInt(tableNumber) 
      });
      
      if (tables.length === 0) {
        throw new Error('Mesa não encontrada');
      }

      const table = tables[0];

      // Check if table has active order
      let order;
      if (table.current_order_id) {
        const orders = await base44.entities.Order.filter({ id: table.current_order_id });
        if (orders.length > 0) {
          order = orders[0];
        }
      }

      // Create order if doesn't exist
      if (!order) {
        const savedCustomerName = localStorage.getItem(`customer_name_${restaurantId}`);
        order = await base44.entities.Order.create({
          restaurant_id: restaurantId,
          table_id: table.id,
          table_number: table.number,
          waiter_id: 'CLIENTE',
          waiter_name: savedCustomerName || 'Cliente',
          items: [],
          subtotal: 0,
          service_fee: 0,
          total: 0,
        });

        await base44.entities.Table.update(table.id, {
          status: 'EM_USO',
          current_order_id: order.id,
        });
      }

      // Add items to order
      const cartItems = cart.map(item => ({
        item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes || '',
        addons: item.addons || [],
        added_at: new Date().toISOString(),
      }));

      const allItems = [...(order.items || []), ...cartItems];
      const subtotal = allItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const serviceFee = subtotal * 0.1;
      const total = subtotal + serviceFee;

      await base44.entities.Order.update(order.id, {
        items: allItems,
        subtotal,
        service_fee: serviceFee,
        total,
      });

      // Send to kitchen
      const savedCustomerName = localStorage.getItem(`customer_name_${restaurantId}`);
      await base44.entities.KitchenOrder.create({
        restaurant_id: restaurantId,
        order_id: order.id,
        table_number: table.number,
        waiter_name: savedCustomerName || 'Cliente',
        items: cartItems.map(item => {
          let itemName = item.name;
          if (item.addons && item.addons.length > 0) {
            const addonNames = item.addons.map(a => a.name).join(', ');
            itemName = `${item.name} (+ ${addonNames})`;
          }
          return {
            name: itemName,
            quantity: item.quantity,
            notes: item.notes || '',
          };
        }),
        status: 'NOVO',
      });
    },
    onSuccess: () => {
      setCart([]);
      setOrderSent(true);
      setTimeout(() => setOrderSent(false), 3000);
    },
  });

  const addToCart = (item, addons = []) => {
    const addonsTotal = addons.reduce((sum, addon) => sum + addon.price, 0);
    const finalPrice = item.price + addonsTotal;
    setCart([...cart, { ...item, price: finalPrice, originalPrice: item.price, quantity: 1, notes: '', addons }]);
  };

  const handleItemClick = (item) => {
    if (item.addons && item.addons.length > 0) {
      setSelectedItemForAddons(item);
      setSelectedAddons([]);
    } else {
      addToCart(item);
    }
  };

  const handleAddWithAddons = () => {
    addToCart(selectedItemForAddons, selectedAddons);
    setSelectedItemForAddons(null);
    setSelectedAddons([]);
  };

  const toggleAddon = (addon) => {
    if (selectedAddons.find(a => a.name === addon.name)) {
      setSelectedAddons(selectedAddons.filter(a => a.name !== addon.name));
    } else {
      const maxAddons = selectedItemForAddons?.max_addons;
      if (maxAddons && selectedAddons.length >= maxAddons) {
        return; // Não permite adicionar mais que o máximo
      }
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const updateQuantity = (itemId, delta) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateNotes = (itemId, notes) => {
    setCart(cart.map(item => 
      item.id === itemId ? { ...item, notes } : item
    ));
  };

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-emerald-800 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const getItemDisplayPrice = (item) => {
    if (item.addons && item.addons.length > 0) {
      const addonsTotal = item.addons.reduce((sum, addon) => sum + addon.price, 0);
      return item.price + addonsTotal;
    }
    return item.price;
  };

  if (!tableConfirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-emerald-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl flex items-center justify-center mb-4">
              <UtensilsCrossed className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">{restaurant.name}</CardTitle>
            <p className="text-gray-500 text-sm mt-2">Bem-vindo! Informe seus dados para começar</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seu Nome *
              </label>
              <Input
                type="text"
                placeholder="Digite seu nome"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-12 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número da Mesa *
              </label>
              <Input
                type="number"
                placeholder="Ex: 15"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="h-14 text-center text-2xl"
              />
            </div>
            <Button
              onClick={() => {
                if (tableNumber && customerName.trim()) {
                  localStorage.setItem(`customer_table_${restaurantId}`, tableNumber);
                  localStorage.setItem(`customer_name_${restaurantId}`, customerName.trim());
                  setTableConfirmed(true);
                }
              }}
              disabled={!tableNumber || !customerName.trim()}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if table has active orders (prevent changing table)
  const hasActiveOrders = currentTableOrder && currentTableOrder.items && currentTableOrder.items.length > 0 && currentTableOrder.status !== 'PAGA' && currentTableOrder.status !== 'CANCELADA';

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white shadow-lg sticky top-0 z-20">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="font-bold text-xl">{restaurant.name}</h1>
              <div className="flex items-center gap-2">
                <p className="text-emerald-200 text-sm">{customerName} - Mesa {tableNumber}</p>
                {!hasActiveOrders && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem(`customer_table_${restaurantId}`);
                      localStorage.removeItem(`customer_name_${restaurantId}`);
                      setTableConfirmed(false);
                      setTableNumber('');
                      setCustomerName('');
                    }}
                    className="text-emerald-200 hover:text-white hover:bg-emerald-600 h-6 text-xs"
                  >
                    Trocar
                  </Button>
                )}
                {hasActiveOrders && (
                  <>
                    <Badge className="bg-amber-500 text-white text-xs">
                      Pedido ativo
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsChangeTableDialogOpen(true)}
                      className="h-6 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      Trocar de mesa
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white text-emerald-700 text-sm px-3 py-1">
                {cart.length} {cart.length === 1 ? 'item' : 'itens'}
              </Badge>
              <Button
                onClick={() => callWaiterMutation.mutate()}
                disabled={callWaiterMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white h-10 px-4"
              >
                {callWaiterMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Bell className="w-5 h-5 mr-2" />
                    Chamar Garçom
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Success Messages */}
      <AnimatePresence>
        {orderSent && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-30"
          >
            <Card className="border-2 border-emerald-500 bg-emerald-50 shadow-xl">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <p className="font-semibold text-emerald-800">Pedido enviado com sucesso!</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {waiterCalled && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-30"
          >
            <Card className="border-2 border-amber-500 bg-amber-50 shadow-xl">
              <CardContent className="p-4 flex items-center gap-3">
                <Bell className="w-6 h-6 text-amber-600" />
                <p className="font-semibold text-amber-800">Garçom chamado com sucesso!</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Order */}
      {currentTableOrder && currentTableOrder.items && currentTableOrder.items.length > 0 && (
        <div className="p-4">
          <Card className="border-2 border-blue-200 shadow-lg bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-700 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Seus Pedidos na Mesa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-3">
                {currentTableOrder.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-blue-100 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.quantity}x {item.name}</p>
                      {item.addons && item.addons.length > 0 && (
                        <p className="text-xs text-emerald-600 mt-0.5">
                          + {item.addons.map(a => a.name).join(', ')}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-0.5">Obs: {item.notes}</p>
                      )}
                    </div>
                    <span className="font-semibold text-gray-700">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-blue-200 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>R$ {(currentTableOrder.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-blue-600">
                  <span>10% Serviço</span>
                  <span>R$ {(currentTableOrder.service_fee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-800 pt-1">
                  <span>Total</span>
                  <span>R$ {(currentTableOrder.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Menu */}
      <main className="p-4" style={{ paddingBottom: cart.length > 0 ? '50vh' : '1rem' }}>
        {sortedCategories.map(category => {
          const categoryItems = menuItems.filter(item => item.category_id === category.id);
          if (categoryItems.length === 0) return null;

          return (
            <Card key={category.id} className="mb-6 border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-emerald-700">{category.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryItems.map(item => (
                  <div key={item.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      )}
                      <p className="text-emerald-600 font-bold mt-2">R$ {item.price.toFixed(2)}</p>
                    </div>
                    <Button
                      onClick={() => handleItemClick(item)}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 ml-3"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </main>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-2xl border-t max-h-[50vh] flex flex-col">
          <div className="p-4 overflow-y-auto flex-1">
            <h3 className="font-bold text-lg mb-3">Seu Pedido</h3>
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <Card key={item.id} className="border-2 border-gray-200">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{item.name}</p>
                        <p className="text-sm text-emerald-600">R$ {item.price.toFixed(2)}</p>
                        {item.addons && item.addons.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            + {item.addons.map(a => `${a.name} (R$${a.price.toFixed(2)})`).join(', ')}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="h-8 w-8"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-bold w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="h-8 w-8"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <span className="ml-auto font-semibold">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                    <Textarea
                      placeholder="Observações (opcional)..."
                      value={item.notes}
                      onChange={(e) => updateNotes(item.id, e.target.value)}
                      className="text-sm"
                      rows={2}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <div className="p-4 border-t bg-white">
            <div className="flex items-center justify-between text-xl font-bold mb-4">
              <span>Total</span>
              <span className="text-emerald-600">R$ {cartTotal.toFixed(2)}</span>
            </div>
            <Button
              onClick={() => sendOrderMutation.mutate()}
              disabled={sendOrderMutation.isPending}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-lg"
            >
              {sendOrderMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Enviar Pedido
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Addons Dialog */}
      <Dialog open={!!selectedItemForAddons} onOpenChange={(open) => {
        if (!open) {
          setSelectedItemForAddons(null);
          setSelectedAddons([]);
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escolha os Adicionais</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedItemForAddons && (
              <>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-800">{selectedItemForAddons.name}</p>
                  <p className="text-emerald-600 font-bold">R$ {selectedItemForAddons.price.toFixed(2)}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Adicionais disponíveis:</Label>
                    {selectedItemForAddons.max_addons && (
                      <span className="text-xs text-gray-500">
                        Máx: {selectedItemForAddons.max_addons} ({selectedAddons.length}/{selectedItemForAddons.max_addons})
                      </span>
                    )}
                  </div>
                  {selectedItemForAddons.addons.map((addon, idx) => {
                    const isSelected = selectedAddons.find(a => a.name === addon.name);
                    const isDisabled = selectedItemForAddons.max_addons && selectedAddons.length >= selectedItemForAddons.max_addons && !isSelected;
                    return (
                      <div
                        key={idx}
                        onClick={() => !isDisabled && toggleAddon(addon)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 cursor-pointer'
                            : isDisabled
                            ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                            : 'border-gray-200 bg-white hover:border-emerald-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-800'}`}>
                            {addon.name}
                          </span>
                          <span className={`font-semibold ${isDisabled ? 'text-gray-400' : 'text-emerald-600'}`}>
                            + R$ {addon.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedAddons.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-gray-600 mb-1">Total com adicionais:</p>
                    <p className="text-xl font-bold text-emerald-600">
                      R$ {(selectedItemForAddons.price + selectedAddons.reduce((sum, a) => sum + a.price, 0)).toFixed(2)}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedItemForAddons(null);
                      setSelectedAddons([]);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAddWithAddons}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Table Dialog */}
      <Dialog open={isChangeTableDialogOpen} onOpenChange={(open) => {
        setIsChangeTableDialogOpen(open);
        if (!open) {
          setChangeTableCode('');
          setChangeTableError('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar de Mesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-gray-600">
              Digite o código fornecido pelo administrador para trocar de mesa.
            </p>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2">
                Código de Autorização
              </Label>
              <Input
                type="password"
                placeholder="Digite o código"
                value={changeTableCode}
                onChange={(e) => {
                  setChangeTableCode(e.target.value);
                  setChangeTableError('');
                }}
                className="mt-2 h-12 text-center text-lg tracking-widest"
                maxLength={4}
              />
              {changeTableError && (
                <p className="text-red-500 text-sm mt-2">{changeTableError}</p>
              )}
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsChangeTableDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleChangeTable}
                disabled={!changeTableCode}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}