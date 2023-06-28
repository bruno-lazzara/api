const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');
const config = require('./config');
const app = express();

const salt = bcrypt.genSaltSync(10);
const secret = 'c8ton4thuyqogv3yun548tortc6uat4y8eioalbv5yt';

app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000'
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect(config.connectionString);

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await User.create({
            username,
            password: bcrypt.hashSync(password, salt)
        });

        res.json(userDoc);
    } catch (error) {
        res.status(400).json(error);
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const userDoc = await User.findOne({ username });
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
        // logged in
        jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
            if (err) {
                throw err;
            }

            res.cookie('mernBlogToken', token).json({
                id: userDoc._id,
                username
            });
        });
    } else {
        res.status(400).json('wrong credentials');
    }
});

app.get('/profile', async (req, res) => {
    const { mernBlogToken } = req.cookies;
    jwt.verify(mernBlogToken, secret, {}, (err, info) => {
        if (err) {
            res.status(401).json('authentication error');
        }

        res.json(info);
    });
});

app.post('/logout', (req, res) => {
    res.cookie('mernBlogToken', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
    try {
        const { mernBlogToken } = req.cookies;
        const { originalname, path } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext;
        fs.renameSync(path, newPath);

        jwt.verify(mernBlogToken, secret, {}, async (err, info) => {
            if (err) {
                res.status(401).json('authentication error');
            }

            const { title, summary, content } = req.body;
            const postDoc = await Post.create({
                title,
                summary,
                content,
                cover: newPath,
                author: info.id
            });

            res.json(postDoc);
        });


    } catch (error) {
        res.status(400).json('wrong credentials');
    }
});

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
    try {
        let newPath = null;
        if (req.file) {
            const { originalname, path } = req.file;
            const parts = originalname.split('.');
            const ext = parts[parts.length - 1];
            newPath = path + '.' + ext;
            fs.renameSync(path, newPath);
        }

        const { mernBlogToken } = req.cookies;

        jwt.verify(mernBlogToken, secret, {}, async (err, info) => {
            if (err) {
                res.status(401).json('authentication error');
            }

            const { id, title, summary, content } = req.body;
            const postDoc = await Post.findById(id);
            const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
            if (!isAuthor) {
                return res.status(400).json('you do not have permission to edit this post');
            }

            await postDoc.updateOne({
                title,
                summary,
                content,
                cover: newPath ? newPath : postDoc.cover
            });

            res.json(postDoc);
        });


    } catch (error) {
        res.status(400).json('wrong credentials');
    }
});

app.get('/posts', async (req, res) => {
    const posts = await Post.find()
        .populate('author', ['username'])
        .sort({ createdAt: -1 })
        .limit(20);

    res.json(posts);
});

app.get('/post/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.findById(id)
            .populate('author', ['username']);

        res.json(post);
    } catch (error) {

    }
});

app.listen(4000);
