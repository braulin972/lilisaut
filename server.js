import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './src/routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express(); // <-- DEJAR SOLO UNA DECLARACIÓN AQUÍ

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.redirect('/pages/inventario.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});