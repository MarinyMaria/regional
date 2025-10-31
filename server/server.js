const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const SECRET = "troque_essa_chave_para_uma_segura"; // em produção use env var
const DB_FILE = path.join(__dirname, "db.sqlite");

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" })); // para imagens base64
app.use(bodyParser.urlencoded({ extended: true }));

const dbExists = fs.existsSync(DB_FILE);
const db = new sqlite3.Database(DB_FILE);

if (!dbExists) {
  db.serialize(() => {
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        email TEXT UNIQUE,
        senha TEXT
      );
    `);
    db.run(`
      CREATE TABLE receitas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT,
        ingredientes TEXT,
        preparo TEXT,
        tags TEXT,
        imagem TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);
    console.log("Banco criado e tabelas inicializadas.");
  });
}

// helpers
function gerarToken(user) {
  return jwt.sign({ id: user.id, nome: user.nome, email: user.email }, SECRET, { expiresIn: "7d" });
}
function verificarTokenMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "Token ausente" });
  const parts = header.split(" ");
  if (parts.length !== 2) return res.status(401).json({ error: "Formato inválido" });
  const token = parts[1];
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Token inválido" });
    req.user = decoded;
    next();
  });
}

// rotas auth
app.post("/api/auth/register", async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ error: "Campos faltando" });
  const hash = await bcrypt.hash(senha, 10);
  db.run("INSERT INTO users (nome,email,senha) VALUES (?,?,?)", [nome, email, hash], function(err) {
    if (err) return res.status(400).json({ error: "Email já cadastrado" });
    const user = { id: this.lastID, nome, email };
    const token = gerarToken(user);
    res.json({ user, token });
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: "Campos faltando" });
  db.get("SELECT id,nome,email,senha FROM users WHERE email = ?", [email], async (err, row) => {
    if (err) return res.status(500).json({ error: "Erro no banco" });
    if (!row) return res.status(400).json({ error: "Usuário não encontrado" });
    const ok = await bcrypt.compare(senha, row.senha);
    if (!ok) return res.status(400).json({ error: "Senha incorreta" });
    const user = { id: row.id, nome: row.nome, email: row.email };
    const token = gerarToken(user);
    res.json({ user, token });
  });
});

// rotas receitas
app.post("/api/receitas", verificarTokenMiddleware, (req, res) => {
  const { titulo, ingredientes, preparo, tags, imagem } = req.body;
  const userId = req.user.id;
  db.run(
    "INSERT INTO receitas (titulo,ingredientes,preparo,tags,imagem,user_id) VALUES (?,?,?,?,?,?)",
    [titulo, JSON.stringify(ingredientes), JSON.stringify(preparo), tags || "", imagem || null, userId],
    function (err) {
      if (err) return res.status(500).json({ error: "Erro ao salvar" });
      db.get("SELECT * FROM receitas WHERE id = ?", [this.lastID], (err2, row) => {
        res.json(row);
      });
    }
  );
});

// listar todas (apenas dados públicos)
app.get("/api/receitas", (req, res) => {
  db.all("SELECT id,titulo,tags,imagem,user_id,created_at FROM receitas ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Erro no banco" });
    res.json(rows);
  });
});

// detalhes de uma receita
app.get("/api/receitas/:id", (req, res) => {
  db.get("SELECT * FROM receitas WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: "Erro no banco" });
    if (!row) return res.status(404).json({ error: "Receita não encontrada" });
    // parse itens antes de enviar
    try {
      row.ingredientes = JSON.parse(row.ingredientes || "[]");
      row.preparo = JSON.parse(row.preparo || "[]");
    } catch (e) {
      row.ingredientes = [];
      row.preparo = [];
    }
    res.json(row);
  });
});

// editar (apenas autor)
app.put("/api/receitas/:id", verificarTokenMiddleware, (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  db.get("SELECT user_id FROM receitas WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: "Erro no banco" });
    if (!row) return res.status(404).json({ error: "Receita não encontrada" });
    if (row.user_id !== userId) return res.status(403).json({ error: "Não autorizado" });

    const { titulo, ingredientes, preparo, tags, imagem } = req.body;
    db.run(
      "UPDATE receitas SET titulo=?, ingredientes=?, preparo=?, tags=?, imagem=? WHERE id=?",
      [titulo, JSON.stringify(ingredientes), JSON.stringify(preparo), tags || "", imagem || null, id],
      function (err2) {
        if (err2) return res.status(500).json({ error: "Erro ao atualizar" });
        res.json({ success: true });
      }
    );
  });
});

// excluir (apenas autor)
app.delete("/api/receitas/:id", verificarTokenMiddleware, (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  db.get("SELECT user_id FROM receitas WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: "Erro no banco" });
    if (!row) return res.status(404).json({ error: "Receita não encontrada" });
    if (row.user_id !== userId) return res.status(403).json({ error: "Não autorizado" });
    db.run("DELETE FROM receitas WHERE id = ?", [id], function(err2) {
      if (err2) return res.status(500).json({ error: "Erro ao excluir" });
      res.json({ success: true });
    });
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
