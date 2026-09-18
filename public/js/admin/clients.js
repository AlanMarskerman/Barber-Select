// DASHBOARD/CLIENTES - Lógica da tela administrativa de clientes.
const adminSession = getSession();
if (requireAuth("admin")) {
  renderSidebar(adminSession.role, "clients.html");
  renderTopbar("Clientes", adminSession.role);
}

// Base de dados inicial de clientes (com corte, preço e barbeiro responsável)
var clientes = [
    { id: 1, nome: "Andre Nascimento Pinto", email: "andre.pinto@outlook.com.br", tel: "(13) 98122-3344", corte: "Degradê Navalhado", preco: 45.00, barbeiro: "Carlos Silva", data: "15/09/2026", status: "Ativo" },
    { id: 2, nome: "Cristina Gomes", email: "cristina.gomes@gmail.com", tel: "(14) 99155-8877", corte: "Social Moderno", preco: 35.00, barbeiro: "Diego Souza", data: "18/09/2026", status: "Ativo" },
    { id: 3, nome: "Gabriel De Cássio", email: "gabriel.cássio@gmail.com", tel: "(15) 98833-1122", corte: "Corte + Barba Completa", preco: 75.00, barbeiro: "Lucas Mendes", data: "20/09/2026", status: "Inativo" },
    { id: 4, nome: "Vinicius Lima", email: "vinicius.lima@gmail.com.com", tel: "(41) 97744-5566", corte: "Pompadour", preco: 50.00, barbeiro: "Rafael Costa", data: "22/09/2026", status: "Ativo" },
    { id: 5, nome: "João Pedro Qualhato", email: "joão.qualhato@gmail.com", tel: "(58) 99666-4433", corte: "Undercut", preco: 40.00, barbeiro: "Carlos Silva", data: "25/09/2026", status: "Ativo" },
    { id: 6, nome: "Thiago Alves Rocha", email: "thiago.rocha@yahoo.com.br", tel: "(62) 98211-9988", corte: "Corte Militar (Buzz Cut)", preco: 30.00, barbeiro: "Diego Souza", data: "28/09/2026", status: "Inativo" },
    { id: 7, nome: "Beatriz Martins Ferreira", email: "beatriz.ferreira@gmail.com", tel: "(11) 97333-2211", corte: "Social Moderno", preco: 35.00, barbeiro: "Lucas Mendes", data: "30/09/2026", status: "Ativo" },
    { id: 8, nome: "Lucas Rodrigues Gomes", email: "lucas.gomes@outlook.com", tel: "(31) 98999-7766", corte: "Degradê Navalhado", preco: 45.00, barbeiro: "Rafael Costa", data: "02/10/2026", status: "Ativo" }
];

var proxId = 9;             
var ordemNomeAsc = true;    
var ordemDataAsc = true;    
var ordemStatusAsc = true;  
var paginaAtual = 1;        
var itensPorPagina = 7;     // Limite de 7 clientes por página
var listaEmUso = clientes;  

// Função principal que desenha a tabela na tela
function desenharTabela(lista) {
    listaEmUso = lista;
    var tbody = document.getElementById("tabelaBody");
    tbody.innerHTML = ""; 

    document.getElementById("checkTodos").checked = false;
    atualizarBotaoExcluirSelecionados();

    if (lista.length === 0) {
        tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; padding: 25px;'>Nenhum cliente encontrado.</td></tr>";
        document.getElementById("qtdExibida").innerText = "0";
        document.getElementById("qtdTotal").innerText = clientes.length;
        document.getElementById("paginasContainer").innerHTML = "";
        return;
    }

    var totalPaginas = Math.ceil(lista.length / itensPorPagina);
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    
    var inicio = (paginaAtual - 1) * itensPorPagina;
    var fim = inicio + itensPorPagina;
    var clientesPagina = lista.slice(inicio, fim);

    for (var i = 0; i < clientesPagina.length; i++) {
        var c = clientesPagina[i];
        var statusClass = c.status === "Ativo" ? "ativo" : "inativo";
        var precoFormatado = Number(c.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        var tr = "<tr>" +
            "<td style='text-align:center;'><input type='checkbox' class='check-cliente' data-id='" + c.id + "' onchange='atualizarBotaoExcluirSelecionados()'></td>" +
            "<td class='td-bold'>" + c.nome + "</td>" +
            "<td>" + c.email + "<br><small style='color:#94a3b8;'>" + c.tel + "</small></td>" +
            "<td><strong>" + c.corte + "</strong><br><small style='color:#16a34a; font-weight:600;'>" + precoFormatado + "</small></td>" +
            "<td>" + c.barbeiro + "</td>" +
            "<td>" + c.data + "</td>" +
            "<td><span class='status " + statusClass + "'>" + c.status + "</span></td>" +
            "<td>" +
                "<div class='actions'>" +
                    "<button class='action-btn btn-view' title='Ficha do Cliente' onclick='ver(" + c.id + ")'><i class='fa-regular fa-eye'></i></button>" +
                    "<button class='action-btn btn-edit' title='Editar' onclick='editar(" + c.id + ")'><i class='fa-regular fa-pen-to-square'></i></button>" +
                    "<button class='action-btn btn-delete' title='Excluir' onclick='deletar(" + c.id + ")'><i class='fa-regular fa-trash-can'></i></button>" +
                "</div>" +
            "</td>" +
        "</tr>";

        tbody.innerHTML += tr;
    }

    document.getElementById("qtdExibida").innerText = clientesPagina.length;
    document.getElementById("qtdTotal").innerText = lista.length;
    renderizarBotoesPagina(totalPaginas);
}

// Caixa de seleção mestre ("Selecionar Todos")
function alternarSelecionarTodos(master) {
    var checkboxes = document.querySelectorAll(".check-cliente");
    for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = master.checked;
    }
    atualizarBotaoExcluirSelecionados();
}

function atualizarBotaoExcluirSelecionados() {
    var checkboxes = document.querySelectorAll(".check-cliente:checked");
    var btnExcluir = document.getElementById("btnExcluirSelecionados");
    var spanQtd = document.getElementById("qtdSelecionados");

    if (checkboxes.length > 0) {
        spanQtd.innerText = checkboxes.length;
        btnExcluir.style.display = "inline-flex";
    } else {
        btnExcluir.style.display = "none";
    }
}

function excluirSelecionados() {
    var checkboxes = document.querySelectorAll(".check-cliente:checked");
    if (checkboxes.length === 0) return;

    if (confirm("Deseja realmente excluir os " + checkboxes.length + " clientes selecionados?")) {
        var idsParaExcluir = [];
        for (var i = 0; i < checkboxes.length; i++) {
            idsParaExcluir.push(parseInt(checkboxes[i].getAttribute("data-id")));
        }

        clientes = clientes.filter(function(c) {
            return !idsParaExcluir.includes(c.id);
        });

        desenharTabela(clientes);
    }
}

function renderizarBotoesPagina(totalPaginas) {
    var container = document.getElementById("paginasContainer");
    container.innerHTML = "";

    if (totalPaginas <= 1) return; 

    for (var p = 1; p <= totalPaginas; p++) {
        var btn = document.createElement("button");
        btn.className = "page-btn " + (p === paginaAtual ? "active" : "");
        btn.innerText = p;
        
        (function(paginaSelecionada) {
            btn.onclick = function() {
                paginaAtual = paginaSelecionada;
                desenharTabela(listaEmUso);
            };
        })(p);

        container.appendChild(btn);
    }
}

// Máscara de telefone
function aplicarMascaraTelefone(input) {
    input.addEventListener("input", function(e) {
        var valor = e.target.value.replace(/\D/g, ""); 
        if (valor.length > 11) valor = valor.slice(0, 11); 

        if (valor.length > 10) {
            valor = valor.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
        } else if (valor.length > 6) {
            valor = valor.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
        } else if (valor.length > 2) {
            valor = valor.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
        } else if (valor.length > 0) {
            valor = valor.replace(/^(\d*)/, "($1");
        }
        e.target.value = valor;
    });
}

// Validação para aceitar apenas letras no nome
function aplicarValidacaoNome(input) {
    input.addEventListener("input", function(e) {
        e.target.value = e.target.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, "");
    });
}

document.addEventListener("DOMContentLoaded", function() {
    var telModal = document.getElementById("modalTel");
    var filtroTel = document.getElementById("filtroTel");
    var nomeModal = document.getElementById("modalNome");
    
    if (telModal) aplicarMascaraTelefone(telModal);
    if (filtroTel) aplicarMascaraTelefone(filtroTel);
    if (nomeModal) aplicarValidacaoNome(nomeModal);
});

// Ordenação da tabela
function ordenarPor(campo) {
    if (campo === 'nome') {
        clientes.sort(function(a, b) {
            return ordemNomeAsc ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
        });
        document.getElementById("icon-sort-nome").className = ordemNomeAsc ? "fa-solid fa-sort-up sort-icon" : "fa-solid fa-sort-down sort-icon";
        ordemNomeAsc = !ordemNomeAsc;
    } else if (campo === 'data') {
        clientes.sort(function(a, b) {
            var dA = a.data.split('/').reverse().join('');
            var dB = b.data.split('/').reverse().join('');
            return ordemDataAsc ? dA.localeCompare(dB) : dB.localeCompare(dA);
        });
        document.getElementById("icon-sort-data").className = ordemDataAsc ? "fa-solid fa-sort-up sort-icon" : "fa-solid fa-sort-down sort-icon";
        ordemDataAsc = !ordemDataAsc;
    } else if (campo === 'status') {
        clientes.sort(function(a, b) {
            return ordemStatusAsc ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status);
        });
        document.getElementById("icon-sort-status").className = ordemStatusAsc ? "fa-solid fa-sort-up sort-icon" : "fa-solid fa-sort-down sort-icon";
        ordemStatusAsc = !ordemStatusAsc;
    }
    desenharTabela(listaEmUso);
}

function deletar(id) {
    if (confirm("Deseja realmente excluir este cliente da base de dados?")) {
        for (var i = 0; i < clientes.length; i++) {
            if (clientes[i].id === id) {
                clientes.splice(i, 1);
                break;
            }
        }
        desenharTabela(clientes);
    }
}

function formatarDataParaBR(dataIso) {
    if (!dataIso) return "";
    var partes = dataIso.split("-");
    return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function formatarDataParaISO(dataBr) {
    if (!dataBr) return "";
    var partes = dataBr.split("/");
    return partes[2] + "-" + partes[1] + "-" + partes[0];
}

function prepararModalFormulario() {
    var container = document.getElementById("modalContainerBox");
    container.innerHTML = `
        <span class="close-btn" onclick="fecharModal()">&times;</span>
        <h2 id="modalTitulo">Editar Cliente</h2>
        <form onsubmit="salvarModal(event)">
            <input type="hidden" id="modalId">
            <div class="form-group">
                <label>Nome Completo (Apenas letras):</label>
                <input type="text" id="modalNome" required placeholder="Digite o nome completo">
            </div>
            <div class="form-group">
                <label>E-mail:</label>
                <input type="email" id="modalEmail" required placeholder="exemplo@email.com">
            </div>
            <div class="form-group">
                <label>Telefone:</label>
                <input type="text" id="modalTel" required placeholder="(11) 99999-9999" maxlength="15">
            </div>
            <div class="form-group">
                <label>Tipo de Corte e Preço:</label>
                <select id="modalCorte" required>
                    <option value="">Selecione o corte e valor...</option>
                    <option value="Degradê Navalhado" data-preco="45.00">Degradê Navalhado - R$ 45,00</option>
                    <option value="Social Moderno" data-preco="35.00">Social Moderno - R$ 35,00</option>
                    <option value="Corte Militar (Buzz Cut)" data-preco="30.00">Corte Militar (Buzz Cut) - R$ 30,00</option>
                    <option value="Pompadour" data-preco="50.00">Pompadour - R$ 50,00</option>
                    <option value="Undercut" data-preco="40.00">Undercut - R$ 40,00</option>
                    <option value="Corte + Barba Completa" data-preco="75.00">Corte + Barba Completa - R$ 75,00</option>
                </select>
            </div>
            <div class="form-group">
                <label>Barbeiro Responsável:</label>
                <select id="modalBarbeiro" required>
                    <option value="">Selecione o barbeiro...</option>
                    <option value="Carlos Silva">Carlos Silva</option>
                    <option value="Diego Souza">Diego Souza</option>
                    <option value="Lucas Mendes">Lucas Mendes</option>
                    <option value="Rafael Costa">Rafael Costa</option>
                </select>
            </div>
            <div class="form-group">
                <label>Data do Corte:</label>
                <input type="date" id="modalData" required>
            </div>
            <div class="form-group">
                <label>Status:</label>
                <select id="modalStatus">
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                </select>
            </div>
            <button type="submit" id="btnSalvarModal" class="btn btn-gold modal-btn">Salvar Alterações</button>
        </form>
    `;
    
    var telModal = document.getElementById("modalTel");
    var nomeModal = document.getElementById("modalNome");
    if (telModal) aplicarMascaraTelefone(telModal);
    if (nomeModal) aplicarValidacaoNome(nomeModal);
}

function editar(id) {
    prepararModalFormulario();
    var c = acharCliente(id);
    if (c) {
        document.getElementById("modalTitulo").innerText = "Editar Cliente";
        document.getElementById("modalId").value = c.id;
        document.getElementById("modalNome").value = c.nome;
        document.getElementById("modalEmail").value = c.email;
        document.getElementById("modalTel").value = c.tel;
        document.getElementById("modalCorte").value = c.corte;
        document.getElementById("modalBarbeiro").value = c.barbeiro;
        document.getElementById("modalData").value = formatarDataParaISO(c.data);
        document.getElementById("modalStatus").value = c.status;
        
        document.getElementById("modalData").min = new Date().toISOString().split("T")[0];
        document.getElementById("modalCliente").style.display = "flex";
    }
}

// Ficha Técnica do Cliente (Visualização limpa para o barbeiro)
function ver(id) {
    var c = acharCliente(id);
    if (c) {
        var container = document.getElementById("modalContainerBox");
        var precoFormatado = Number(c.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        container.innerHTML = `
            <span class="close-btn" onclick="fecharModal()">&times;</span>
            <h2>Ficha Técnica do Cliente</h2>
            <div class="ficha-tecnica">
                <div class="ficha-header">
                    <div class="ficha-avatar"><i class="fa-solid fa-user"></i></div>
                    <div class="ficha-info-principal">
                        <h3>${c.nome}</h3>
                        <span class="status ${c.status === 'Ativo' ? 'ativo' : 'inativo'}">${c.status}</span>
                    </div>
                </div>
                <div class="ficha-corpo">
                    <div class="ficha-item destaque-corte">
                        <label><i class="fa-solid fa-scissors"></i> Estilo / Serviço & Valor</label>
                        <span>${c.corte} — <strong style="color: #16a34a;">${precoFormatado}</strong></span>
                    </div>
                    <div class="ficha-item">
                        <label><i class="fa-solid fa-user-tie"></i> Barbeiro Responsável</label>
                        <span>${c.barbeiro}</span>
                    </div>
                    <div class="ficha-item">
                        <label><i class="fa-regular fa-calendar-days"></i> Data do Atendimento</label>
                        <span>${c.data}</span>
                    </div>
                    <div class="ficha-item">
                        <label><i class="fa-solid fa-phone"></i> Contato / Telefone</label>
                        <span>${c.tel}</span>
                    </div>
                    <div class="ficha-item">
                        <label><i class="fa-solid fa-envelope"></i> E-mail</label>
                        <span>${c.email}</span>
                    </div>
                </div>
                <button type="button" class="btn btn-gray modal-btn" onclick="fecharModal()">Fechar Ficha</button>
            </div>
        `;
        document.getElementById("modalCliente").style.display = "flex";
    }
}

function abrirNovo() {
    prepararModalFormulario();
    document.getElementById("modalTitulo").innerText = "Novo Cliente";
    document.getElementById("modalId").value = "";
    document.getElementById("modalNome").value = "";
    document.getElementById("modalEmail").value = "";
    document.getElementById("modalTel").value = "";
    document.getElementById("modalCorte").value = "";
    document.getElementById("modalBarbeiro").value = "";
    
    var hojeIso = new Date().toISOString().split("T")[0];
    var inputData = document.getElementById("modalData");
    inputData.min = hojeIso;
    inputData.value = hojeIso;

    document.getElementById("modalStatus").value = "Ativo";
    document.getElementById("modalCliente").style.display = "flex";
}

// Salva dados com extração do preço e verificação anti-duplicidade
function salvarModal(e) {
    e.preventDefault();
    var id = document.getElementById("modalId").value;
    var nomeDigitado = document.getElementById("modalNome").value.trim().toLowerCase();
    var emailDigitado = document.getElementById("modalEmail").value.trim().toLowerCase();
    var telDigitado = document.getElementById("modalTel").value.trim();
    
    var selectCorte = document.getElementById("modalCorte");
    var corteDigitado = selectCorte.value;
    var precoDigitado = selectCorte.options[selectCorte.selectedIndex].getAttribute("data-preco") || 0.00;
    
    var barbeiroDigitado = document.getElementById("modalBarbeiro").value;
    var dataDigitadaIso = document.getElementById("modalData").value;
    var statusDigitado = document.getElementById("modalStatus").value;

    for (var i = 0; i < clientes.length; i++) {
        var clienteExistente = clientes[i];
        if (id === "" || clienteExistente.id !== parseInt(id)) {
            if (
                clienteExistente.nome.trim().toLowerCase() === nomeDigitado ||
                clienteExistente.email.trim().toLowerCase() === emailDigitado ||
                clienteExistente.tel.trim() === telDigitado
            ) {
                alert("Atenção: Já existe um cliente cadastrado com esse mesmo Nome, E-mail ou Telefone!");
                return; 
            }
        }
    }

    var dataFormatadaBr = formatarDataParaBR(dataDigitadaIso);

    if (id === "") {
        clientes.push({
            id: proxId++,
            nome: document.getElementById("modalNome").value,
            email: document.getElementById("modalEmail").value,
            tel: telDigitado,
            corte: corteDigitado,
            preco: parseFloat(precoDigitado),
            barbeiro: barbeiroDigitado,
            data: dataFormatadaBr,
            status: statusDigitado
        });
    } else {
        id = parseInt(id);
        var c = acharCliente(id);
        if (c) {
            c.nome = document.getElementById("modalNome").value;
            c.email = document.getElementById("modalEmail").value;
            c.tel = telDigitado;
            c.corte = corteDigitado;
            c.preco = parseFloat(precoDigitado);
            c.barbeiro = barbeiroDigitado;
            c.data = dataFormatadaBr;
            c.status = statusDigitado;
        }
    }

    fecharModal();
    desenharTabela(clientes);
}

function fecharModal() {
    document.getElementById("modalCliente").style.display = "none";
}

// Filtro integrado (Nome, Telefone e Barbeiro)
function filtrar() {
    var buscaNome = document.getElementById("filtroNome").value.toLowerCase();
    var buscaTel = document.getElementById("filtroTel").value.toLowerCase();
    var buscaBarbeiro = document.getElementById("filtroBarbeiro").value;

    var filtrados = [];
    for (var i = 0; i < clientes.length; i++) {
        var c = clientes[i];
        var atendeBarbeiro = (buscaBarbeiro === "" || c.barbeiro === buscaBarbeiro);

        if (
            c.nome.toLowerCase().includes(buscaNome) &&
            c.tel.toLowerCase().includes(buscaTel) &&
            atendeBarbeiro
        ) {
            filtrados.push(c);
        }
    }
    paginaAtual = 1;
    desenharTabela(filtrados);
}

function limpar() {
    document.getElementById("filtroNome").value = "";
    document.getElementById("filtroTel").value = "";
    document.getElementById("filtroBarbeiro").value = "";
    paginaAtual = 1;
    desenharTabela(clientes);
}

function acharCliente(id) {
    for (var i = 0; i < clientes.length; i++) {
        if (clientes[i].id === id) return clientes[i];
    }
    return null;
}

// Inicializa ordenado por nome
ordenarPor('nome');