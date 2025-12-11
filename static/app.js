const API_URL = '/products';
let isEditing = false;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
});

// --- FUNCIONES API ---

async function cargarProductos() {
    try {
        const res = await fetch(API_URL);
        const products = await res.json();
        renderTable(products);
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
        alert("Por favor, completa todos los campos correctamente.");
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
            cargarProductos();
        } else {
            alert("Error al guardar en el servidor");
        }
    } catch (error) {
        console.error(error);
        alert("Error de conexión");
    }
}

async function borrarProducto(id) {
    if (!confirm("¿Seguro que quieres eliminar este producto?")) return;

    try {
        await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        cargarProductos();
    } catch (error) {
        console.error(error);
    }
}

async function exportarDatos() {
    const btn = document.getElementById('btnBackup');
    const originalText = btn.innerText;
    
    try {
        btn.innerText = "Guardando...";
        const res = await fetch('/export', { method: 'POST' });
        if (res.ok) {
            alert("✅ Backup guardado en 'seeds/productos.json'. Listo para Git Push.");
        } else {
            alert("❌ Error al guardar backup.");
        }
    } catch (e) {
        alert("Error de conexión");
    } finally {
        btn.innerText = originalText;
    }
}

// --- FUNCIONES UI ---

function renderTable(products) {
    const tbody = document.getElementById('productTable');
    tbody.innerHTML = '';

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #666;">No hay productos en inventario</td></tr>';
        return;
    }

    products.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 500; color: #fff;">${p.name}</td>
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
    
    // Scroll suave hacia el formulario
    document.querySelector('.form-grid').scrollIntoView({ behavior: 'smooth' });
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