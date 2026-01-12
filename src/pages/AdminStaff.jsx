import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Key, UserX, Users, ChefHat, Loader2, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';

export default function AdminStaff() {
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [showCredentials, setShowCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [form, setForm] = useState({
    name: '',
    role: 'WAITER',
    phone: '',
    is_active: true,
  });
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

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staffList', staff?.restaurant_id],
    queryFn: () => base44.entities.Staff.filter({ restaurant_id: staff?.restaurant_id }),
    enabled: !!staff,
  });

  const generateLoginId = () => {
    const prefix = form.role === 'WAITER' ? 'G' : 'C';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${randomNum}`;
  };

  const generatePin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const createStaffMutation = useMutation({
    mutationFn: (data) => base44.entities.Staff.create(data),
    onSuccess: (newStaff) => {
      queryClient.invalidateQueries({ queryKey: ['staffList'] });
      setShowCredentials({
        name: newStaff.name,
        login_id: newStaff.login_id,
        pin: newStaff.pin,
      });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Staff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffList'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const resetPinMutation = useMutation({
    mutationFn: async ({ id }) => {
      const newPin = generatePin();
      await base44.entities.Staff.update(id, { pin: newPin });
      return newPin;
    },
    onSuccess: (newPin, { name, login_id }) => {
      queryClient.invalidateQueries({ queryKey: ['staffList'] });
      setShowCredentials({ name, login_id, pin: newPin, isReset: true });
    },
  });

  const resetForm = () => {
    setForm({ name: '', role: 'WAITER', phone: '', is_active: true });
    setEditingStaff(null);
  };

  const openEditDialog = (staffMember) => {
    setEditingStaff(staffMember);
    setForm({
      name: staffMember.name,
      role: staffMember.role,
      phone: staffMember.phone || '',
      is_active: staffMember.is_active !== false,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (editingStaff) {
      updateStaffMutation.mutate({
        id: editingStaff.id,
        data: {
          name: form.name,
          phone: form.phone,
          is_active: form.is_active,
        },
      });
    } else {
      const loginId = generateLoginId();
      const pin = generatePin();
      createStaffMutation.mutate({
        restaurant_id: staff.restaurant_id,
        name: form.name,
        role: form.role,
        login_id: loginId,
        pin: pin,
        phone: form.phone,
        is_active: true,
      });
    }
  };

  const handleCopy = async (text, field) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleLogout = async () => {
    localStorage.removeItem('staff_session');
    await base44.auth.logout(createPageUrl('Home'));
  };

  if (!staff) return null;

  const waiters = staffList.filter(s => s.role === 'WAITER');
  const kitchenStaff = staffList.filter(s => s.role === 'KITCHEN');

  const roleLabels = {
    ADMIN: 'Administrador',
    WAITER: 'Garçom',
    KITCHEN: 'Cozinha',
  };

  const roleColors = {
    ADMIN: 'bg-purple-100 text-purple-700',
    WAITER: 'bg-amber-100 text-amber-700',
    KITCHEN: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar restaurant={restaurant} onLogout={handleLogout} />
      
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Funcionários</h1>
            <p className="text-gray-500 mt-1">Gerencie a equipe do restaurante</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Criar Acesso
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingStaff ? 'Editar Funcionário' : 'Criar Novo Acesso'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nome completo"
                    className="mt-2"
                  />
                </div>
                {!editingStaff && (
                  <div>
                    <Label>Função *</Label>
                    <Select
                      value={form.role}
                      onValueChange={(value) => setForm({ ...form, role: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WAITER">Garçom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Telefone (opcional)</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="mt-2"
                  />
                </div>
                {editingStaff && (
                  <div className="flex items-center justify-between">
                    <Label>Acesso Ativo</Label>
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                    />
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={createStaffMutation.isPending || updateStaffMutation.isPending || !form.name}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {(createStaffMutation.isPending || updateStaffMutation.isPending) ? (
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

        {/* Credentials Modal */}
        <Dialog open={!!showCredentials} onOpenChange={() => setShowCredentials(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {showCredentials?.isReset ? 'Nova Senha Gerada' : 'Credenciais de Acesso'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Funcionário</p>
                  <p className="font-semibold text-gray-800">{showCredentials?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Login ID</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xl font-bold text-emerald-700">{showCredentials?.login_id}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(showCredentials?.login_id, 'login')}
                    >
                      {copiedField === 'login' ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">PIN</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xl font-bold text-emerald-700">{showCredentials?.pin}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(showCredentials?.pin, 'pin')}
                    >
                      {copiedField === 'pin' ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 text-center">
                Guarde essas informações com segurança!
              </p>
              <Button
                onClick={() => setShowCredentials(null)}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                Entendi
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="border-0 shadow-md bg-amber-50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-700">{waiters.length}</p>
                <p className="text-amber-600 text-sm">Garçons</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-blue-50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-700">{kitchenStaff.length}</p>
                <p className="text-blue-600 text-sm">Cozinha</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Staff List */}
        <div className="grid gap-4">
          {staffList.filter(s => s.role !== 'ADMIN').map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`border-0 shadow-md ${!member.is_active ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                        member.role === 'WAITER' ? 'bg-amber-500' : 'bg-blue-500'
                      }`}>
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-800">{member.name}</h3>
                          {!member.is_active && (
                            <Badge variant="destructive" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge className={roleColors[member.role]}>
                            {roleLabels[member.role]}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 text-sm font-medium">ID: {member.login_id}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopy(member.login_id, `login-${member.id}`)}
                            >
                              {copiedField === `login-${member.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400" />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 text-sm font-medium">PIN: {member.pin}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopy(member.pin, `pin-${member.id}`)}
                            >
                              {copiedField === `pin-${member.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(member)}
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {staffList.filter(s => s.role !== 'ADMIN').length === 0 && !isLoading && (
            <div className="text-center py-20 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum funcionário cadastrado</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}