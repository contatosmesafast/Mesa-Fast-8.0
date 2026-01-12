import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Shield, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  Building2,
  User,
  Calendar,
  LogOut
} from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SuperAdmin() {
  const [user, setUser] = useState(null);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      // Verificar se é super admin (você pode definir seu email aqui)
      const SUPER_ADMIN_EMAIL = 'matheussouza49009@gmail.com'; // ALTERE PARA SEU EMAIL
      
      if (currentUser.email !== SUPER_ADMIN_EMAIL) {
        window.location.href = createPageUrl('Home');
        return;
      }
      
      setUser(currentUser);
    } catch (error) {
      window.location.href = createPageUrl('Home');
    }
  };

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['all-restaurants'],
    queryFn: () => base44.entities.Restaurant.list(),
    enabled: !!user,
  });

  const blockMutation = useMutation({
    mutationFn: ({ id, reason }) => 
      base44.entities.Restaurant.update(id, {
        is_blocked: true,
        blocked_reason: reason,
        blocked_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-restaurants'] });
      setIsBlockDialogOpen(false);
      setBlockReason('');
      setSelectedRestaurant(null);
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (id) => 
      base44.entities.Restaurant.update(id, {
        is_blocked: false,
        blocked_reason: null,
        blocked_at: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-restaurants'] });
    },
  });

  const handleBlock = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setIsBlockDialogOpen(true);
  };

  const handleConfirmBlock = () => {
    if (selectedRestaurant && blockReason.trim()) {
      blockMutation.mutate({ 
        id: selectedRestaurant.id, 
        reason: blockReason.trim() 
      });
    }
  };

  const handleUnblock = (restaurant) => {
    if (window.confirm(`Desbloquear restaurante "${restaurant.name}"?`)) {
      unblockMutation.mutate(restaurant.id);
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout(createPageUrl('Home'));
  };

  if (!user) return null;

  const blockedCount = restaurants.filter(r => r.is_blocked).length;
  const activeCount = restaurants.filter(r => !r.is_blocked).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md shadow-lg sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-xl">Super Admin</h1>
              <p className="text-purple-200 text-sm">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-purple-200 hover:text-white"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total de Contas</p>
                  <p className="text-3xl font-bold text-gray-800">{restaurants.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Contas Ativas</p>
                  <p className="text-3xl font-bold text-emerald-600">{activeCount}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Unlock className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Contas Bloqueadas</p>
                  <p className="text-3xl font-bold text-red-600">{blockedCount}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Lock className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Restaurants List */}
        <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800">
              Gerenciar Restaurantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {restaurants.map((restaurant, index) => (
                <motion.div
                  key={restaurant.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`border-2 ${
                    restaurant.is_blocked 
                      ? 'border-red-200 bg-red-50' 
                      : 'border-gray-100 bg-white'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                              {restaurant.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-800">{restaurant.name}</h3>
                              <p className="text-sm text-gray-500 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {restaurant.owner_email}
                              </p>
                            </div>
                          </div>

                          {restaurant.is_blocked && (
                            <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-red-800">
                                    Bloqueado em {format(new Date(restaurant.blocked_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                  {restaurant.blocked_reason && (
                                    <p className="text-sm text-red-700 mt-1">
                                      Motivo: {restaurant.blocked_reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 ml-4">
                          <Badge className={
                            restaurant.is_blocked
                              ? 'bg-red-100 text-red-700 border-red-300'
                              : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          }>
                            {restaurant.is_blocked ? 'BLOQUEADO' : 'ATIVO'}
                          </Badge>

                          {restaurant.is_blocked ? (
                            <Button
                              onClick={() => handleUnblock(restaurant)}
                              disabled={unblockMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Unlock className="w-4 h-4 mr-2" />
                              Desbloquear
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleBlock(restaurant)}
                              variant="destructive"
                            >
                              <Lock className="w-4 h-4 mr-2" />
                              Bloquear
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {restaurants.length === 0 && !isLoading && (
                <div className="text-center py-12 text-gray-400">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum restaurante cadastrado</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Block Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Lock className="w-5 h-5" />
              Bloquear Conta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                Você está prestes a bloquear: <strong>{selectedRestaurant?.name}</strong>
              </p>
              <p className="text-sm text-red-700 mt-1">
                Todas as funcionalidades serão desabilitadas imediatamente.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo do Bloqueio *
              </label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex: Mensalidade em atraso"
                className="min-h-24"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBlockDialogOpen(false);
                  setBlockReason('');
                  setSelectedRestaurant(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmBlock}
                disabled={!blockReason.trim() || blockMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Confirmar Bloqueio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}