import { supabase } from '../config/supabase.js';

export const processWhatsAppBatch = async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.body.tenant_id || "8f5e0cf9-1b94-449e-af85-65dcbe84b695";
    const text_batch = req.body.text_batch || req.body.text || Object.keys(req.body)[0];

    if (!text_batch || text_batch.trim() === "") {
        return res.status(400).json({ error: 'El lote de texto está vacío.' });
    }

    const lines = text_batch.split('\n');
    const processedOrders = [];
    const errors = [];

    try {
        for (let line of lines) {
            line = line.trim();

            // Omitir líneas vacías o de sistema de WhatsApp
            if (!line || line.includes('cifrados de extremo a extremo') || !line.includes('#')) {
                continue;
            }

            let customerName = "Cliente Desconocido";
            let messageText = line;

            // REPARACIÓN: Detectar si viene con formato de fecha con corchetes o plano sin corchetes
            if (line.includes(']') && line.includes(':')) {
                const messageRegex = /\]\s*([^:]+):\s*(.*)/;
                const matchMessage = line.match(messageRegex);
                if (matchMessage && matchMessage[1] && matchMessage[2]) {
                    customerName = matchMessage[1].trim();
                    messageText = matchMessage[2].trim();
                }
            } else if (line.includes(':')) {
                // Formato plano sin fecha: "Carlos Mendoza: - #PLAYERAANI*2"
                const parts = line.split(':');
                customerName = parts[0].trim();
                messageText = parts.slice(1).join(':').trim();
            }

            messageText = messageText.toUpperCase(); // Forzar mayúsculas

            // Capturar el Token/Hashtag (#PLAYERAANI) y la Cantidad (*2)
            const tokenRegex = /(#[A-Z0-9_-]+)(?:\*([0-9]+))?/;
            const matchToken = messageText.match(tokenRegex);

            if (!matchToken) continue;

            const baseKeyword = matchToken[1].trim();
            const quantity = matchToken[2] ? parseInt(matchToken[2], 10) : 1;

            // Consulta global a Supabase (omitiendo tenant_id temporalmente para descartar fallos)
            const { data: product, error: pError } = await supabase
                .from('products')
                .select('*')
                .eq('is_active', true)
                .eq('keyword', baseKeyword)
                .maybeSingle();

            if (pError) {
                errors.push(`Error BD para ${baseKeyword}: ${pError.message}`);
                continue;
            }

            if (!product) {
                errors.push(`El código "${baseKeyword}" enviado por ${customerName} no existe.`);
                continue;
            }

            const sinStock = product.stock_physical < quantity;
            const newStock = sinStock ? product.stock_physical : product.stock_physical - quantity;

            if (!sinStock) {
                await supabase
                    .from('products')
                    .update({ stock_physical: newStock })
                    .eq('id', product.id);
            }

            const totalRevenue = product.sale_price * quantity;
        
        // Inserción adaptada con las nuevas columnas de flujo logístico y revenue
        const { data: insertedOrder, error: insertError } = await supabase
            .from('orders')
            .insert({
                tenant_id: tenantId,
                product_id: product.id,
                customer_name: customerName,
                customer_phone: 'WhatsApp',
                source: 'whatsapp',
                status: 'confirmed',
                voted_at: new Date(),
                status_empaque: 'sin_empaquetar',
                status_pago: 'no_pagado',
                total_revenue: totalRevenue // <-- LÍNEA CRUCIAL PARA ARREGLAR EL REVENUE
            })
            .select();
        if (insertError) {
            console.error("❌ ERROR AL INSERTAR EN ORDERS:", insertError.message, insertError.details);
            errors.push(`Error en orden de ${customerName}: ${insertError.message}`);
            continue; 
        } else {
            console.log("✅ ORDEN GUARDADA CON ÉXITO:", insertedOrder);
        }

            processedOrders.push({
                customer_name: customerName,
                product_name: product.name,
                keyword: baseKeyword,
                quantity: quantity,
                total: totalRevenue,
                sin_stock: sinStock
            });
        }

        return res.json({
            status: 'success',
            processed_orders: processedOrders,
            errors: errors.length > 0 ? errors : null
        });

    } catch (error) {
        return res.status(500).json({ error: 'Error interno', details: error.message });
    }
};
export const getAllOrders = async (req, res) => {
    try {
        // PRUEBA GLOBAL: Traemos todas las órdenes de la tabla orders juntando el nombre del producto
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                products (
                    name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.json({ status: 'success', orders });
    } catch (error) {
        return res.status(500).json({ error: 'Error al obtener órdenes', details: error.message });
    }
};

export const actualizarEmpaqueCliente = async (req, res) => {
    const { customer_name, nuevo_status } = req.body;

    try {
        const { data, error } = await supabase
            .from('orders')
            .update({ status_empaque: nuevo_status })
            .ilike('customer_name', customer_name) // ilike ignora mayúsculas/minúsculas de manera segura
            .select();

        if (error) throw error;
        
        return res.json({ success: true, orders: data });
    } catch (err) {
        console.error("❌ Error al cambiar empaque:", err.message);
        return res.status(500).json({ error: err.message });
    }
};

export const actualizarPagoCliente = async (req, res) => {
    const { customer_name, nuevo_status } = req.body;

    try {
        const { data, error } = await supabase
            .from('orders')
            .update({ status_pago: nuevo_status })
            .ilike('customer_name', customer_name) // ilike ignora mayúsculas/minúsculas de manera segura
            .select();

        if (error) throw error;
        
        return res.json({ success: true, orders: data });
    } catch (err) {
        console.error("❌ Error al cambiar pago:", err.message);
        return res.status(500).json({ error: err.message });
    }
};