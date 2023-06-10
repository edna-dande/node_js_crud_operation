
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const flash = require('express-flash');
const session = require('express-session');
const path = require('path');
const { Client } = require('ssh2');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({ 
  cookie: { maxAge: 60000 },
  store: new session.MemoryStore,
  saveUninitialized: true,
  resave: 'true',
  secret: 'secret'
}));
app.use(flash());

const ssh = new Client();
const dbServer = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '2023Really!',
    database: 'blogs'
};
const tunnelConfig = {
    host: '127.0.0.1',
    port: 2222,
    username: 'vagrant',
    privateKey:  require('fs').readFileSync('/Users/eamondi/first-vagrant/.vagrant/machines/default/virtualbox/private_key'),
    password: '2023Really!'
};
const forwardConfig = {
    srcHost: '127.0.0.1',
    srcPort: 3306,
    dstHost: dbServer.host,
    dstPort: dbServer.port
};
const SSHconnection = new Promise((resolve, reject) => {
    ssh.on('ready', () => {
        ssh.forwardOut(
        forwardConfig.srcHost,
        forwardConfig.srcPort,
        forwardConfig.dstHost,
        forwardConfig.dstPort,
        (err, stream) => {
             if (err) reject(err);
             const updatedDbServer = {
                 ...dbServer,
                 stream
            };
            const connection =  mysql.createConnection(updatedDbServer);
           connection.connect((error) => {
            if (error) {
                reject(error);
            }
            resolve(connection);
            });
        });
    }).connect(tunnelConfig);
});

//Display add blog page
app.get('/blogs/add', function(req, res, next){
  res.render('blogs/add', {
    title: '',
    content: ''
  })
})

// Create a blog
app.post('/blogs', (req, res) => {
  const { title, content } = req.body;
  const query = 'INSERT INTO blogs (title, content) VALUES (?, ?)';
  SSHconnection.then((connection) => {
    connection.query(query, [title, content], (err, result) => {
      if (!err) {
        req.flash('Blog created successfully.');
        res.redirect('/blogs');
      } else {
        console.log(err);
      }
    })
  })
});

// Create a comment
app.post('/blogs/comment/:id', (req, res) => {
  const { comment } = req.body;
  const { id } = req.params;
  const query = 'INSERT INTO comments (blog_id, comment) VALUES (?, ?)';
  SSHconnection.then((connection) => {
    connection.query(query, [id, comment], (err, result) => {
      if (!err) {
        req.flash('Commented successfully.');
        res.redirect('/blogs/blog/'+id);
      } else {
        console.log(err);
      }
    })
  })
});

//Creating GET Router to fetch all the blogs details from the MySQL Database
app.get('/blogs' , (req, res) => {
  const query = 'SELECT * FROM blogs';
  SSHconnection.then((connection) => { 
    connection.query(query, [], (err, rows, fields) => {
      if (!err) {
        res.render('blogs', {data:rows});
      } else {
        console.log(err);
        res.render('blogs',{data:''});
      }
    })
  })
});

// Read a blog
app.get('/blogs/blog/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM blogs WHERE id = ?';
  const query1 = 'SELECT * FROM comments WHERE blog_id = ?';
  SSHconnection.then((connection) => {
    connection.query(query, [id], (err, rows, fields) => {
      if(err) throw err
      if (rows.length <= 0){
        req.flash('error', 'Blog not found with id = ' + id)
        res.redirect('/blogs')
      }
      else {
        connection.query(query1, [id], (err1, comments, fields) => {
          if(err1) throw err1
          if (rows.length <= 0){
            res.render('blogs/view', {
              id: rows[0].id,
              title: rows[0].title,
              content: rows[0].content,
              data: ''
            })
          } else {
            res.render('blogs/view', {
              id: rows[0].id,
              title: rows[0].title,
              content: rows[0].content,
              data: comments
            })
          }
        })
      }
    })
  })
});

// Display edit blog page
app.get('/blogs/edit/:id', (req, res, next) => {
  const { id } = req.params;
  const query = 'SELECT * FROM blogs WHERE id = ?';
  SSHconnection.then((connection) => {
    connection.query(query, [id], (err, rows, fields) => {
      if(err) throw err
      if (rows.length <= 0){
        req.flash('error', 'blog not found with id = ' + id)
        res.redirect('/blogs')
      }
      else {
        res.render('blogs/edit', {
          id: rows[0].id,
          title: rows[0].title,
          content: rows[0].content
        })
      }
    })
  })
});

// Update a blog
app.post('/blogs/update/:id', (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const query = 'UPDATE blogs SET title = ?, content = ? WHERE id = ?';
  SSHconnection.then((connection) => {
    connection.query(query, [title, content, id], (err, result) => {
      if (!err) {
        req.flash('Blog updated successfully.');
        res.redirect('/blogs')
      } else {
        console.log(err);
      }
    })
  })
});

// Delete a blog
app.get('/blogs/delete/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM blogs WHERE id = ?';
  SSHconnection.then((connection) => {
    connection.query(query, [id], (err, result) => {
      if (!err) {
        req.flash('Blog deleted successfully.');
        res.redirect('/blogs')
      } else {
        console.log(err);
      }
    })
  })
});

const port = 3000; 

app.listen(port, () => {
  console.log(`Server started on port ${port}.`);
});
