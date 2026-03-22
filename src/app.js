const express = require('express');
const slasRouter = require('./routes/slas');
const nginxRouter = require('./routes/nginx');

function createApp({ slasService, nginxService } = {}) {
    const app = express();
    app.use(express.json());

    app.set('slasService', slasService || require('./services/slasService'));
    app.set('nginxService', nginxService || require('./services/nginxService'));

    app.use('/slas', slasRouter);
    app.use('/nginx', nginxRouter);

    return app;
}

module.exports = { createApp };
