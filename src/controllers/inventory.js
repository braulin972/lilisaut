import { supabase } from '../config/supabase.js';

export const setupTestEnvironment = async (req, res) => {
  try {
    const { data: tenant, error: tError } = await supabase
      .from('tenants')
      .insert({
        name: 'Mi Tienda Stream',
        slug: 'mi-tienda-' + Math.floor(Math.random() * 10000)
      })
      .select().single();

    if (tError) return res.status(500).json({ error: tError.message });

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await supabase.from('subscriptions').insert({
      tenant_id: tenant.id,
      status: 'active',
      expires_at: expiresAt.toISOString(),
      base_price: 0.00,
      price_per_order: 0.05,
      orders_processed_this_cycle: 0
    });

    return res.json({ status: 'success', tenant_id: tenant.id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const createProduct = async (req, res) => {
  const tenantId = req.tenant.id;
  const { name, stock_physical, purchase_price, sale_price, keyword, sku } = req.body;

  try {
    // 1. Verificar si ya existe un producto con esa misma palabra clave para este tenant (activo o inactivo)
    const { data: existingProduct, error: checkError } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('keyword', keyword.toUpperCase())
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingProduct) {
      // SI YA EXISTE Y ESTÁ ACTIVO: Mandamos el error clásico de duplicado de forma amigable
      if (existingProduct.is_active) {
        return res.status(400).json({ error: `La palabra clave "${keyword}" ya está asignada al producto activo: "${existingProduct.name}".` });
      }

      // SI EXISTE PERO ESTABA ELIMINADO (is_active = false): ¡Lo reactivamos con los nuevos datos!
      const { data: reactivatedProduct, error: reactivateError } = await supabase
        .from('products')
        .update({
          name,
          stock_physical: parseInt(stock_physical, 10),
          purchase_price: parseFloat(purchase_price),
          sale_price: parseFloat(sale_price),
          sku: sku || existingProduct.sku,
          is_active: true // Volver a mostrarlo en el catálogo
        })
        .eq('id', existingProduct.id)
        .select().single();

      if (reactivateError) throw reactivateError;

      return res.status(200).json({ 
        status: 'reactivated', 
        message: 'Producto existente reactivado correctamente.', 
        product: reactivatedProduct 
      });
    }

    // 2. SI NO EXISTE EN ABSOLUTO: Lo creamos desde cero como siempre
    const { data: newProduct, error: insertError } = await supabase
      .from('products')
      .insert({
        tenant_id: tenantId,
        name,
        stock_physical: parseInt(stock_physical, 10),
        purchase_price: parseFloat(purchase_price),
        sale_price: parseFloat(sale_price),
        keyword: keyword.toUpperCase(),
        sku: sku || `PROD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        is_active: true
      })
      .select().single();

    if (insertError) throw insertError;

    return res.status(201).json({ 
      status: 'created', 
      product: newProduct 
    });

  } catch (error) {
    return res.status(500).json({ error: 'Fallo al procesar el alta de producto', details: error.message });
  }
};

// MODIFICADO: Solo trae productos donde is_active sea TRUE
export const getProducts = async (req, res) => {
  const tenantId = req.tenant.id;
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true) 
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ status: 'success', products });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// NUEVO: Modificar el producto sin alterar los IDs vinculados a las ventas
export const updateProduct = async (req, res) => {
  const tenantId = req.tenant.id;
  const { id, name, stock_physical, purchase_price, sale_price } = req.body;

  try {
    const cleanName = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const keyword = `#${cleanName.substring(0, 10)}`; 

    const { data: product, error } = await supabase
      .from('products')
      .update({
        name,
        keyword,
        stock_physical: parseInt(stock_physical, 10),
        purchase_price: parseFloat(purchase_price || 0),
        sale_price: parseFloat(sale_price)
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select().single();

    if (error) throw error;
    return res.json({ status: 'success', product });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// NUEVO: Borrado Lógico (Soft Delete) para proteger el historial financiero de las gráficas
export const deleteProduct = async (req, res) => {
  const tenantId = req.tenant.id;
  const { id } = req.body;

  try {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return res.json({ status: 'success', message: 'Producto removido del catálogo.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};