import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, UtensilsCrossed, FolderOpen, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';

export default function AdminMenu() {
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [activeTab, setActiveTab] = useState('items');
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', category_id: '', is_active: true, addons: [], max_addons: '' });
  const [newAddon, setNewAddon] = useState({ name: '', price: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', order: 0 });
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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', staff?.restaurant_id],
    queryFn: async () => {
      const cats = await base44.entities.MenuCategory.filter({ restaurant_id: staff?.restaurant_id });
      // Ensure "Outros" category exists
      const outrosCategory = cats.find(c => c.name === 'Outros');
      if (!outrosCategory) {
        await base44.entities.MenuCategory.create({
          restaurant_id: staff.restaurant_id,
          name: 'Outros',
          order: 999,
          is_active: true,
        });
        return await base44.entities.MenuCategory.filter({ restaurant_id: staff?.restaurant_id });
      }
      return cats;
    },
    enabled: !!staff,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menuItems', staff?.restaurant_id],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
  });

  const createItemMutation = useMutation({
    mutationFn: (data) => base44.entities.MenuItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      closeItemDialog();
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MenuItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      closeItemDialog();
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => base44.entities.MenuItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menuItems'] }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data) => base44.entities.MenuCategory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeCategoryDialog();
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MenuCategory.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeCategoryDialog();
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => base44.entities.MenuCategory.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const closeItemDialog = () => {
    setIsItemDialogOpen(false);
    setEditingItem(null);
    setItemForm({ name: '', description: '', price: '', category_id: '', is_active: true, addons: [], max_addons: '' });
    setNewAddon({ name: '', price: '' });
  };

  const closeCategoryDialog = () => {
    setIsCategoryDialogOpen(false);
    setEditingCategory(null);
    setCategoryForm({ name: '', order: 0 });
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category_id: item.category_id || '',
      is_active: item.is_active !== false,
      addons: item.addons || [],
      max_addons: item.max_addons ? item.max_addons.toString() : '',
    });
    setIsItemDialogOpen(true);
  };

  const openEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      order: category.order || 0,
    });
    setIsCategoryDialogOpen(true);
  };

  const handleSaveItem = async () => {
    // If no category selected, use "Outros"
    let categoryId = itemForm.category_id;
    if (!categoryId) {
      const outrosCategory = categories.find(c => c.name === 'Outros');
      if (outrosCategory) {
        categoryId = outrosCategory.id;
      }
    }

    const data = {
      restaurant_id: staff.restaurant_id,
      name: itemForm.name,
      description: itemForm.description,
      price: parseFloat(itemForm.price),
      category_id: categoryId || null,
      is_active: itemForm.is_active,
      addons: itemForm.addons,
      max_addons: itemForm.max_addons ? parseInt(itemForm.max_addons) : null,
    };

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const handleSaveCategory = () => {
    const data = {
      restaurant_id: staff.restaurant_id,
      name: categoryForm.name,
      order: categoryForm.order,
      is_active: true,
    };

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const handleDuplicateItem = (item) => {
    const duplicateData = {
      restaurant_id: staff.restaurant_id,
      name: `${item.name} - Cópia`,
      description: item.description || '',
      price: item.price,
      category_id: item.category_id || null,
      is_active: item.is_active,
      addons: item.addons || [],
    };
    createItemMutation.mutate(duplicateData);
  };

  const handleLogout = async () => {
    localStorage.removeItem('staff_session');
    await base44.auth.logout(createPageUrl('Home'));
  };

  if (!staff) return null;

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Sem categoria';
  };

  const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar restaurant={restaurant} onLogout={handleLogout} />
      
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Cardápio</h1>
          <p className="text-gray-500 mt-1">Gerencie itens e categorias</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="items" className="gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              Itens
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Categorias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <div className="flex justify-end mb-6">
              <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input
                        value={itemForm.name}
                        onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                        placeholder="Ex: Picanha na Brasa"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={itemForm.description}
                        onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                        placeholder="Descrição do item..."
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Preço *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={itemForm.price}
                        onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                        placeholder="0.00"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select
                        value={itemForm.category_id}
                        onValueChange={(value) => setItemForm({ ...itemForm, category_id: value })}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Item Ativo</Label>
                      <Switch
                        checked={itemForm.is_active}
                        onCheckedChange={(checked) => setItemForm({ ...itemForm, is_active: checked })}
                      />
                    </div>

                    {/* Addons Section */}
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-base">Adicionais</Label>
                        {itemForm.addons.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Label className="text-sm text-gray-600">Máx. selecionáveis:</Label>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Ilimitado"
                              value={itemForm.max_addons}
                              onChange={(e) => setItemForm({ ...itemForm, max_addons: e.target.value })}
                              className="w-24 h-8 text-sm"
                            />
                          </div>
                        )}
                      </div>
                      
                      {itemForm.addons.length > 0 && (
                        <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
                          {itemForm.addons.map((addon, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div>
                                <span className="font-medium text-gray-800">{addon.name}</span>
                                <span className="text-emerald-600 ml-2">+ R$ {addon.price.toFixed(2)}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setItemForm({
                                  ...itemForm,
                                  addons: itemForm.addons.filter((_, i) => i !== index)
                                })}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Input
                          placeholder="Nome do adicional"
                          value={newAddon.name}
                          onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Preço"
                            value={newAddon.price}
                            onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (newAddon.name && newAddon.price) {
                                setItemForm({
                                  ...itemForm,
                                  addons: [...itemForm.addons, { name: newAddon.name, price: parseFloat(newAddon.price) }]
                                });
                                setNewAddon({ name: '', price: '' });
                              }
                            }}
                            disabled={!newAddon.name || !newAddon.price}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button variant="outline" onClick={closeItemDialog} className="flex-1">
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSaveItem}
                        disabled={createItemMutation.isPending || updateItemMutation.isPending}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        {(createItemMutation.isPending || updateItemMutation.isPending) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-800">{item.name}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {getCategoryName(item.category_id)}
                            </Badge>
                            {!item.is_active && (
                              <Badge variant="destructive" className="text-xs">Inativo</Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-gray-500 text-sm mt-1">{item.description}</p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.addons.map((addon, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs bg-emerald-50 text-emerald-700">
                                  {addon.name} +R${addon.price.toFixed(2)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xl font-bold text-emerald-600">
                            R$ {item.price.toFixed(2)}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditItem(item)}
                            >
                              <Pencil className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDuplicateItem(item)}
                              title="Duplicar item"
                            >
                              <Copy className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteItemMutation.mutate(item.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {items.length === 0 && !isLoading && (
                <div className="text-center py-20 text-gray-400">
                  <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum item cadastrado</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="categories">
            <div className="flex justify-end mb-6">
              <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        placeholder="Ex: Pratos Principais"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Ordem de Exibição</Label>
                      <Input
                        type="number"
                        value={categoryForm.order}
                        onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 0 })}
                        className="mt-2"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button variant="outline" onClick={closeCategoryDialog} className="flex-1">
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSaveCategory}
                        disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {sortedCategories.map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <FolderOpen className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-800">{category.name}</h3>
                            <p className="text-gray-400 text-sm">
                              {items.filter(i => i.category_id === category.id).length} itens
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditCategory(category)}
                          >
                            <Pencil className="w-4 h-4 text-gray-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (category.name === 'Outros') {
                                alert('A categoria "Outros" não pode ser excluída');
                                return;
                              }
                              deleteCategoryMutation.mutate(category.id);
                            }}
                            disabled={category.name === 'Outros'}
                          >
                            <Trash2 className={`w-4 h-4 ${category.name === 'Outros' ? 'text-gray-300' : 'text-red-500'}`} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {categories.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma categoria cadastrada</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}