import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';

export default function CustomerRating() {
  const [order, setOrder] = useState(null);
  const [staff, setStaff] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [form, setForm] = useState({
    customer_name: '',
    customer_birthday: '',
    customer_phone: '',
    comments: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const session = localStorage.getItem('staff_session');
    if (session) {
      setStaff(JSON.parse(session));
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    if (orderId) {
      loadOrder(orderId);
    }
  }, []);

  const loadOrder = async (orderId) => {
    const orders = await base44.entities.Order.filter({ id: orderId });
    if (orders.length > 0) {
      setOrder(orders[0]);
    }
  };

  const submitRatingMutation = useMutation({
    mutationFn: (data) => base44.entities.Rating.create(data),
    onSuccess: () => {
      setIsSubmitted(true);
      setTimeout(() => {
        if (staff?.role === 'WAITER') {
          window.location.href = createPageUrl('WaiterDashboard');
        } else {
          window.location.href = createPageUrl('Home');
        }
      }, 3000);
    },
  });

  const validateForm = () => {
    const newErrors = {};
    if (rating === 0) newErrors.rating = 'Por favor, selecione uma avaliação';
    if (!form.customer_name.trim()) newErrors.customer_name = 'Nome é obrigatório';
    if (!form.customer_birthday) newErrors.customer_birthday = 'Data de aniversário é obrigatória';
    if (!form.customer_phone.trim()) newErrors.customer_phone = 'Telefone é obrigatório';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    submitRatingMutation.mutate({
      restaurant_id: order.restaurant_id,
      order_id: order.id,
      table_number: order.table_number,
      waiter_id: order.waiter_id,
      waiter_name: order.waiter_name,
      stars: rating,
      customer_name: form.customer_name,
      customer_birthday: form.customer_birthday,
      customer_phone: form.customer_phone,
      comments: form.comments,
    });
  };

  const handleSkip = () => {
    if (staff?.role === 'WAITER') {
      window.location.href = createPageUrl('WaiterDashboard');
    } else {
      window.location.href = createPageUrl('Home');
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Obrigado!</h1>
          <p className="text-emerald-200">Sua avaliação foi enviada com sucesso.</p>
          <p className="text-emerald-300 text-sm mt-4">Redirecionando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">
              Como foi sua experiência?
            </CardTitle>
            <p className="text-gray-500 mt-2">
              Sua opinião é muito importante para nós!
            </p>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {/* Star Rating */}
            <div className="text-center">
              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-12 h-12 transition-colors ${
                        star <= (hoverRating || rating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </motion.button>
                ))}
              </div>
              {errors.rating && (
                <p className="text-red-500 text-sm">{errors.rating}</p>
              )}
              <p className="text-gray-500 text-sm">
                {rating === 1 && 'Ruim'}
                {rating === 2 && 'Regular'}
                {rating === 3 && 'Bom'}
                {rating === 4 && 'Muito Bom'}
                {rating === 5 && 'Excelente!'}
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Seu Nome *</Label>
                <Input
                  id="name"
                  placeholder="Digite seu nome"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className={`mt-1 ${errors.customer_name ? 'border-red-500' : ''}`}
                />
                {errors.customer_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.customer_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="birthday">Data de Aniversário *</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={form.customer_birthday}
                  onChange={(e) => setForm({ ...form, customer_birthday: e.target.value })}
                  className={`mt-1 ${errors.customer_birthday ? 'border-red-500' : ''}`}
                />
                {errors.customer_birthday && (
                  <p className="text-red-500 text-sm mt-1">{errors.customer_birthday}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className={`mt-1 ${errors.customer_phone ? 'border-red-500' : ''}`}
                />
                {errors.customer_phone && (
                  <p className="text-red-500 text-sm mt-1">{errors.customer_phone}</p>
                )}
              </div>

              <div>
                <Label htmlFor="comments">Comentários (opcional)</Label>
                <Textarea
                  id="comments"
                  placeholder="Conte-nos mais sobre sua experiência..."
                  value={form.comments}
                  onChange={(e) => setForm({ ...form, comments: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={submitRatingMutation.isPending}
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
              >
                {submitRatingMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Enviar Avaliação'
                )}
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="w-full text-gray-500"
              >
                Pular
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}