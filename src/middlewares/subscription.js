import { supabase } from '../config/supabase.js';

export const checkSubscription = async (req, res, next) => {
  // Extraemos el tenant_id desde el header (en producción vendrá del JWT decodificado en auth.js)
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({ error: 'Falta el header x-tenant-id para identificar al negocio.' });
  }

  try {
    // Consultar directamente la tabla que acabamos de crear
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status, expires_at')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !subscription) {
      return res.status(403).json({ error: 'No se encontró una suscripción activa para este comercio.' });
    }

    const now = new Date();
    const expirationDate = new Date(subscription.expires_at);

    // CONTROL DE BLOQUEO FULMINANTE
    if (subscription.status === 'expired' || now > expirationDate) {
      return res.status(403).json({
        error: 'Licencia Expirada / Realizar Pago',
        code: 'SUBSCRIPTION_EXPIRED',
        expires_at: subscription.expires_at
      });
    }

    if (subscription.status === 'suspended') {
      return res.status(403).json({ error: 'Cuenta suspendida por administración.' });
    }

    // Si todo está en orden, guardamos los datos en el objeto request y avanzamos
    req.tenant = { id: tenantId, subscription };
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Error interno al validar la licencia.', details: err.message });
  }
};