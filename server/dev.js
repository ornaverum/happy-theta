'use strict';
/* Local testing: serves ../phys and the API together at http://localhost:3000/phys/
   with a separate dev database and non-Secure cookies (plain http). */
const path = require('path');
process.env.STATIC_DIR ||= path.join(__dirname, '..', 'phys');
process.env.COOKIE_SECURE ||= '0';
process.env.DB_PATH ||= path.join(__dirname, 'data', 'dev.db');
const app = require('./server.js');
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '127.0.0.1', () => console.log(`Dev site: http://localhost:${PORT}/phys/`));
