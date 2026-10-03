const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token requerido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario_id = decoded.usuario_id;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido' });
    }
}

module.exports = { 
    verificarToken
};