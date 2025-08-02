const express = require('express');
const app = express();
const path = require('path');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const User = require('./model/User');

const chess = new Chess();
let players = {};
let currentPlayer = 'w';

const server = http.createServer(app);
const io = socket(server);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/',/*isLoggedIn,*/ (req, res) => {
    res.render('index',{ name : /*req.user.name*/ "Ojaswi" || 'Guest' });
});
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

io.on('connection', (uniqueSocket) => {
    console.log('connected');

    if (!players.white) {
        players.white = uniqueSocket.id;
        uniqueSocket.emit('playerRole', 'w');
    } else if (!players.black) {
        players.black = uniqueSocket.id;
        uniqueSocket.emit('playerRole', 'b');
    } else {
        uniqueSocket.emit('spectator');
    }

    uniqueSocket.on('disconnect', () => {
        if (uniqueSocket.id === players.white) {
            players.white = null;
        } else if (uniqueSocket.id === players.black) {
            players.black = null;
        } else {
            console.log('Spectator disconnected');
        }
    });

    uniqueSocket.on('move', (move) => {
        try {
            if (chess.turn() === 'w' && uniqueSocket.id !== players.white) return;
            if (chess.turn() === 'b' && uniqueSocket.id !== players.black) return;

            const result = chess.move(move);
            if (result) {
                currentPlayer = chess.turn();
                io.emit('move', move);
                io.emit('boardState', chess.fen());
            } else {
                console.log('Invalid move:', move);
                uniqueSocket.emit('invalidMove', move);
            }
        } catch (e) {
            console.log('Error processing move:', e.message);
            uniqueSocket.emit('invalidMove', move);
        }
    });
});


app.get('/login', (req, res) => {
    res.render('login');
});
app.post('/login', async (req, res) => {
    let { email, password } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
        return res.status(400).send('Invalid credentials');
    }
    bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
            let token = jwt.sign({ email: user.email, name: user.name }, 'secret');
            res.cookie('token', token);
            res.cookie('name', user.name);
            res.redirect('/');
        } else {
            res.status(400).send('Invalid credentials');
        }
    });
});


app.post('/register',async  (req, res) => {
    let { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) {
        return res.status(400).send('User already exists');
    }
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            user = await User.create({
                name,
                email,
                password: hash
            });
            let token = jwt.sign({ email, name }, 'secret');
            res.cookie('token', token);
            res.redirect('/');
        });
    });
});
app.get('/register', (req, res) => {
    res.render('register');
})

function isLoggedIn(req, res, next) {
    if (req.cookies.token) {
        try {
            let data = jwt.verify(req.cookies.token, 'secret');
            req.user = data;
            next();
        } catch (error) {
            res.redirect('/login');
        }
    } else {
        res.redirect('/login');
    }
}


app.use('/chat',/*isLoggedIn, */(req, res) => {
    res.render('chat', { name: req.user ? req.user.name : 'Guest' });
})

server.listen(3000, () => {
    console.log('Server is running on port 3000 \n http://localhost:3000');
});