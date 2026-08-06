import express from 'express';
import { processWhatsAppBatch, getAllOrders, actualizarEmpaqueCliente, actualizarPagoCliente } from '../controllers/parser.js';
import { checkSubscription } from '../middlewares/subscription.js';
// AQUÍ: Asegúrate de tener las 5 funciones importadas en esta línea
import { setupTestEnvironment, createProduct, getProducts, updateProduct, deleteProduct } from '../controllers/inventory.js';

const router = express.Router();

router.post('/setup-dev', setupTestEnvironment);

// Rutas de Catálogo
router.post('/inventory', checkSubscription, createProduct);
router.get('/inventory', checkSubscription, getProducts);
router.put('/inventory', checkSubscription, updateProduct);     
router.delete('/inventory', checkSubscription, deleteProduct);  

router.post('/whatsapp/upload', processWhatsAppBatch);
router.get('/whatsapp/orders', getAllOrders);

router.patch('/whatsapp/orders/empaque', actualizarEmpaqueCliente);
router.patch('/whatsapp/orders/pago', actualizarPagoCliente);

export default router;