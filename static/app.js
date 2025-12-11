const API_URL = '/products';
let isEditing = false;
let currentData = []; // Guardamos los datos aquí para usarlos en ambas vistas

document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
});

// --- LÓGICA DE VISTAS ---

function cambiarVista(vista) {
    const tableDiv = document.getElementById('viewTable');
    const jsonDiv = document.getElementById('viewJson');
    const btnTable = document.getElementById('btnViewTable');
    const btnJson = document.getElementById('btnViewJSON');

    if (vista === 'table') {
        tableDiv.style.display = 'block';
        jsonDiv.style.display = 'none';
        
        btnTable.classList.add('active');
        btnJson.classList.remove('active');
    } else {
        tableDiv.style.display = 'none';
        jsonDiv.style.display = 'block';
        
        btnTable.classList.remove('active');
        btnJson.classList.add('active');
        
        // Renderizamos el JSON al momento de cambiar
        renderJSON();
    }
}

function renderJSON() {
    const codeBlock = document.getElementById('jsonCode');
    // Convertimos el objeto a texto con identación de 2 espacios
    codeBlock.textContent = JSON.stringify(currentData, null, 2);
    
    // Le decimos a Prism que vuelva a colorear el código nuevo
    if (window.Prism) {
        Prism.highlightElement(codeBlock);
    }
}

// --- API ---

async function cargarProductos() {
    try {
        const res = await fetch(API_URL);
        const products = await res.json();
        
        currentData = products; // ACTUALIZAMOS LA VARIABLE GLOBAL
        renderTable(products);
        
        // Si estamos en la vista JSON, actualizamos también esa vista en vivo
        if (!document.getElementById('viewJson').style.display || document.getElementById('viewJson').style.display !== 'none') {
            renderJSON();
        }

    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

async function guardarProducto() {
    const idInput = document.getElementById('productId');
    const nameInput = document.getElementById('name');
    const priceInput = document.getElementById('price');
    const stockInput = document.getElementById('stock');

    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    const stock = parseInt(stockInput.value);

    if (!name || isNaN(price) || isNaN(stock)) {
        alert("Completa todos los campos");
        return;
    }

    const data = { name, price, stock };
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_URL}?id=${idInput.value}` : API_URL;

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            limpiarFormulario();
            cargarProductos(); // Esto recargará ambas vistas
        } else {
            alert("Error al guardar");
        }
    } catch (error) {
        console.error(error);
    }
}

async function borrarProducto(id) {
    if (!confirm("¿Eliminar producto?")) return;
    try {
        await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        cargarProductos();
    } catch (error) { console.error(error); }
}

async function exportarDatos() {
    const btn = document.getElementById('btnBackup');
    const originalText = btn.innerText;
    btn.innerText = "⏳";
    try {
        await fetch('/export', { method: 'POST' });
        alert("✅ Backup guardado en seeds/productos.json");
    } catch (e) { alert("Error"); } 
    finally { btn.innerText = originalText; }
}

// --- UI ---

function renderTable(products) {
    const tbody = document.getElementById('productTable');
    tbody.innerHTML = '';

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">Vacío</td></tr>';
        return;
    }

    products.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="color: #fff; font-weight:500;">${p.name}</td>
            <td>$${p.price.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td class="actions">
                <button class="icon-btn btn-edit" onclick="prepararEdicion('${p.id}', '${p.name}', ${p.price}, ${p.stock})">✏️</button>
                <button class="icon-btn btn-delete" onclick="borrarProducto('${p.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function prepararEdicion(id, name, price, stock) {
    isEditing = true;
    document.getElementById('productId').value = id;
    document.getElementById('name').value = name;
    document.getElementById('price').value = price;
    document.getElementById('stock').value = stock;

    const btn = document.getElementById('saveBtn');
    btn.innerText = "Actualizar";
    btn.classList.add('editing');
    
    // Si estamos en modo JSON, forzamos la vista de tabla para que vea lo que edita
    cambiarVista('table');
}

function limpiarFormulario() {
    isEditing = false;
    document.getElementById('productId').value = '';
    document.getElementById('name').value = '';
    document.getElementById('price').value = '';
    document.getElementById('stock').value = '';

    const btn = document.getElementById('saveBtn');
    btn.innerText = "＋ Agregar";
    btn.classList.remove('editing');
}