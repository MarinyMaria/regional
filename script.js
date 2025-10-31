/* script.js - frontend */
const API = "http://localhost:4000";

const secUsuarios = document.getElementById("secUsuarios");
const secReceitas = document.getElementById("secReceitas");
const btnUsuarios = document.getElementById("btnUsuarios");
const btnReceitas = document.getElementById("btnReceitas");
const btnSair = document.getElementById("btnSair");
const listaUsuarios = document.getElementById("listaUsuarios");

btnUsuarios.addEventListener("click", () => mostrarSecao("usuarios"));
btnReceitas.addEventListener("click", () => mostrarSecao("receitas"));

function mostrarSecao(sec) {
  secUsuarios.classList.toggle("hidden", sec !== "usuarios");
  secReceitas.classList.toggle("hidden", sec !== "receitas");
}

/* -------- Autenticação -------- */
const formRegister = document.getElementById("formRegister");
const formLogin = document.getElementById("formLogin");

let user = JSON.parse(localStorage.getItem("usuarioLogado")) || null;
if (user) onLogin(user);

// Registrar
formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nomeUsuario").value.trim();
  const email = document.getElementById("emailUsuario").value.trim();
  const senha = document.getElementById("senhaUsuario").value;

  try {
    const res = await fetch(API + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro");
    alert("Cadastrado com sucesso!");
    localStorage.setItem("usuarioLogado", JSON.stringify(data));
    onLogin(data);
    formRegister.reset();
  } catch (err) {
    alert("Erro: " + err.message);
  }
});

// Login
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const senha = document.getElementById("loginSenha").value;
  try {
    const res = await fetch(API + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro");
    localStorage.setItem("usuarioLogado", JSON.stringify(data));
    onLogin(data);
    formLogin.reset();
  } catch (err) {
    alert("Erro: " + err.message);
  }
});

function onLogin(payload) {
  user = payload;
  btnSair.classList.remove("hidden");
  btnUsuarios.textContent = `Olá, ${user.user.nome}`;
  mostrarSecao("receitas");
  carregarReceitas();
}

btnSair.addEventListener("click", () => {
  if (!confirm("Tem certeza que deseja sair da conta?")) return;
  localStorage.removeItem("usuarioLogado");
  user = null;
  btnSair.classList.add("hidden");
  btnUsuarios.textContent = "Área do Usuário";
  mostrarSecao("usuarios");
});

/* -------- Receitas -------- */
const formReceita = document.getElementById("formReceita");
const listaReceitas = document.getElementById("listaReceitas");
const imagemInput = document.getElementById("imagemReceita");
let editId = null;

formReceita.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!user) return alert("Faça login para criar ou editar receitas.");

  const titulo = document.getElementById("tituloReceita").value.trim();
  const ingredientes = document.getElementById("ingredientes").value.split("\n").map(i => i.trim()).filter(Boolean);
  const preparo = document.getElementById("preparo").value.split("\n").map(p => p.trim()).filter(Boolean);
  const tags = document.getElementById("tags").value.trim();

  let base64 = null;
  if (imagemInput.files[0]) base64 = await fileToBase64(imagemInput.files[0]);

  try {
    const token = user.token;
    const payload = { titulo, ingredientes, preparo, tags, imagem: base64 };
    const url = editId ? `${API}/api/receitas/${editId}` : `${API}/api/receitas`;
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao salvar receita");

    formReceita.reset();
    editId = null;
    document.getElementById("formTitle").textContent = "Cadastrar Receita";
    document.getElementById("btnCancelarEdit").classList.add("hidden");
    carregarReceitas();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("btnCancelarEdit").addEventListener("click", () => {
  editId = null;
  document.getElementById("formTitle").textContent = "Cadastrar Receita";
  document.getElementById("btnCancelarEdit").classList.add("hidden");
  formReceita.reset();
});

/* Helper: converter imagem para base64 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Carregar receitas */
async function carregarReceitas() {
  try {
    const res = await fetch(API + "/api/receitas");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Erro ao carregar receitas");
    renderReceitas(data);
  } catch (err) {
    console.error(err);
    listaReceitas.innerHTML = "<p>Erro ao carregar receitas.</p>";
  }
}

/* Renderizar cards */
function renderReceitas(items) {
  listaReceitas.innerHTML = "";
  items.forEach(it => {
    const card = document.createElement("div");
    card.className = "receita-card";

    const img = document.createElement("img");
    img.src = it.imagem || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='100%' height='100%' fill='%23ddd'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23777' font-size='20'>Sem imagem</text></svg>";

    const body = document.createElement("div");
    body.className = "body";

    const h4 = document.createElement("h4");
    h4.textContent = it.titulo;

    const btnInfo = document.createElement("button");
    btnInfo.textContent = "Mais informações";
    btnInfo.addEventListener("click", () => abrirDetalhe(it.id));

    body.appendChild(h4);
    card.appendChild(img);
    card.appendChild(body);
    card.appendChild(btnInfo);

    listaReceitas.appendChild(card);
  });
}

/* -------- Modal -------- */
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");

modalClose.addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });

function fecharModal() {
  modal.classList.add("hidden");
  modalBody.innerHTML = "";
}

async function abrirDetalhe(id) {
  try {
    const res = await fetch(API + "/api/receitas/" + id);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro");

    modalBody.innerHTML = "";

    const titulo = document.createElement("h2");
    titulo.textContent = data.titulo;

    const img = document.createElement("img");
    if (data.imagem) {
      img.src = data.imagem;
      img.style.maxWidth = "100%";
      img.style.marginBottom = "10px";
      modalBody.appendChild(img);
    }

    const tags = document.createElement("p");
    tags.innerHTML = `<strong>Tags:</strong> ${data.tags || ""}`;

    const ingr = document.createElement("div");
    ingr.innerHTML = "<strong>Ingredientes:</strong><ul>" + (data.ingredientes || []).map(i => `<li>${i}</li>`).join("") + "</ul>";

    const prep = document.createElement("div");
    prep.innerHTML = "<strong>Modo de preparo:</strong><ol>" + (data.preparo || []).map(p => `<li>${p}</li>`).join("") + "</ol>";

    modalBody.append(titulo, tags, ingr, prep);

    // Mostrar botões de edição/exclusão se for dono
    if (user && user.user && user.user.id === data.user_id) {
      const controls = document.createElement("div");
      controls.style.marginTop = "12px";

      const btnEditar = document.createElement("button");
      btnEditar.textContent = "Editar receita";
      btnEditar.addEventListener("click", () => preencherEdicao(data));

      const btnExcluir = document.createElement("button");
      btnExcluir.textContent = "Excluir receita";
      btnExcluir.style.marginLeft = "8px";
      btnExcluir.addEventListener("click", async () => {
        if (!confirm("Confirma exclusão?")) return;
        const resp = await fetch(API + "/api/receitas/" + id, {
          method: "DELETE",
          headers: { "Authorization": "Bearer " + user.token }
        });
        const r = await resp.json();
        if (!resp.ok) return alert(r.error || "Erro ao excluir");
        fecharModal();
        carregarReceitas();
      });

      controls.append(btnEditar, btnExcluir);
      modalBody.appendChild(controls);
    }

    // 👉 mostrar o modal (importante!)
    modal.classList.remove("hidden");
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

function preencherEdicao(data) {
  editId = data.id;
  document.getElementById("tituloReceita").value = data.titulo;
  document.getElementById("ingredientes").value = (data.ingredientes || []).join("\n");
  document.getElementById("preparo").value = (data.preparo || []).join("\n");
  document.getElementById("tags").value = data.tags || "";
  document.getElementById("formTitle").textContent = "Editando Receita";
  document.getElementById("btnCancelarEdit").classList.remove("hidden");
  fecharModal();
}

/* Inicializar */
carregarReceitas();
