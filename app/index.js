const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/health', (req, res) => res.send('OK'));

app.listen(port, () => console.log(`Hello World app listening on port ${port}`));
