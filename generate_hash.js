const crypto = require('crypto');

// Hash password function from server.js
function hashPassword(password, salt) {
    if (!salt) salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

// Generate hash for "admin" / "admin"
const username = 'admin';
const password = 'admin';
const { salt, hash } = hashPassword(password);

const user = {
    username,
    salt,
    hash,
    created: Date.now()
};

console.log(JSON.stringify(user));
