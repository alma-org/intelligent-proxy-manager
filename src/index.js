const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`IPM REST API listening on port ${PORT}`);
    });
}

module.exports = app;
