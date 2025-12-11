const API_URL = '/products';
let isEditing = false;
let currentData = [];

document.addEventListener('DOMContentLoaded', cargarProductos);

// --- LÓGICA PRINCIPAL ---

async function cargarProductos() {
    try {
        const res = await fetch(API_URL);
        const products = await res.json();
        currentData = products;
        
        actualizarDashboard(products); // Nuevas métricas
        renderTable(products);
        renderJSON();
    } catch (error) {
        mostrarToast('error', 'Error conectando con el servidor');
    }
}

function actualizarDashboard(products) {
    // 1. Total Productos
    document.getElementById('statTotalItems').innerText = products.length;

    // 2. Valor Total (Suma de Price * Stock)
    const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
    document.getElementById('statTotalValue').innerText = 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue);

    // 3. Bajo Stock (Menos de 5 unidades)
    const lowStockCount = products.filter(p => p.stock < 5).length;
    const statLowEl = document.getElementById('statLowStock');
    statLowEl.innerText = lowStockCount;
    statLowEl.style.color = lowStockCount > 0 ? '#f87171' : 'white';
}

function filtrarTabla() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const filtrados = currentData.filter(p => 
        p.name.toLowerCase().includes(term)
    );
    renderTable(filtrados);
}

// --- ACCIONES CRUD MEJORADAS ---

async function guardarProducto() {
    const idInput = document.getElementById('productId');
    const name = document.getElementById('name').value.trim();
    const price = parseFloat(document.getElementById('price').value);
    const stock = parseInt(document.getElementById('stock').value);

    if (!name || isNaN(price) || isNaN(stock)) {
        mostrarToast('warning', 'Por favor completa todos los campos');
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
            mostrarToast('success', isEditing ? 'Producto actualizado' : 'Producto agregado');
            limpiarFormulario();
            cargarProductos();
        } else {
            mostrarToast('error', 'Error al guardar');
        }
    } catch (error) { mostrarToast('error', 'Error de red'); }
}

async function borrarProducto(id) {
    // Usamos SweetAlert para confirmación bonita
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "No podrás revertir esto",
        icon: 'warning',
        background: '#1e293b',
        color: '#fff',
        showCancelButton: true,
        confirmButtonColor: '#f87171',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
            mostrarToast('success', 'Producto eliminado');
            cargarProductos();
        } catch (error) { mostrarToast('error', 'Error al borrar'); }
    }
}

// --- UTILS UI ---

function renderTable(products) {
    const tbody = document.getElementById('productTable');
    tbody.innerHTML = '';

    if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">No se encontraron resultados</td></tr>';
        return;
    }

    products.forEach(p => {
        // Lógica de Tags de Estado
        let statusTag = `<span class="tag tag-ok">En Stock</span>`;
        if (p.stock === 0) statusTag = `<span class="tag tag-out">Agotado</span>`;
        else if (p.stock < 5) statusTag = `<span class="tag tag-low">Bajo Stock</span>`;

        const row = document.createElement('tr');
        // Efecto de entrada escalonada
        row.className = 'fade-in'; 
        row.innerHTML = `
            <td style="font-weight:600; color:white;">${p.name}</td>
            <td>$${p.price.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td>${statusTag}</td>
            <td style="text-align:right;">
                <button class="icon-btn btn-edit" onclick="prepararEdicion('${p.id}', '${p.name}', ${p.price}, ${p.stock})">
                    <i class="ph ph-pencil-simple"></i>
                </button>
                <button class="icon-btn btn-delete" onclick="borrarProducto('${p.id}')">
                    <i class="ph ph-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function mostrarToast(icon, title) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        background: '#334155',
        color: '#fff',
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });
    Toast.fire({ icon: icon, title: title });
}

function cambiarVista(vista) {
    const tableDiv = document.getElementById('viewTable');
    const jsonDiv = document.getElementById('viewJson');
    const btns = document.querySelectorAll('.toggle-btn');
    
    if (vista === 'table') {
        tableDiv.style.display = 'block';
        jsonDiv.style.display = 'none';
        btns[0].classList.add('active');
        btns[1].classList.remove('active');
    } else {
        tableDiv.style.display = 'none';
        jsonDiv.style.display = 'block';
        btns[0].classList.remove('active');
        btns[1].classList.add('active');
        renderJSON();
    }
}

function renderJSON() {
    const code = document.getElementById('jsonCode');
    code.textContent = JSON.stringify(currentData, null, 2);
    if(window.Prism) Prism.highlightElement(code);
}

function prepararEdicion(id, name, price, stock) {
    isEditing = true;
    document.getElementById('productId').value = id;
    document.getElementById('name').value = name;
    document.getElementById('price').value = price;
    document.getElementById('stock').value = stock;

    const btn = document.getElementById('saveBtn');
    btn.innerHTML = `<i class="ph ph-check-circle"></i> <span>Actualizar</span>`;
    btn.style.background = 'var(--warning)';
    btn.style.color = '#1e293b';
    
    document.querySelector('.form-grid').scrollIntoView({behavior: 'smooth'});
}

function limpiarFormulario() {
    isEditing = false;
    document.getElementById('productId').value = '';
    document.getElementById('name').value = '';
    document.getElementById('price').value = '';
    document.getElementById('stock').value = '';

    const btn = document.getElementById('saveBtn');
    btn.innerHTML = `<i class="ph ph-plus-circle"></i> <span>Agregar</span>`;
    btn.style.background = 'var(--primary)';
    btn.style.color = 'white';
}

async function exportarDatos() {
    try {
        await fetch('/export', { method: 'POST' });
        mostrarToast('success', 'Backup JSON guardado en servidor');
    } catch (e) { mostrarToast('error', 'Error al exportar'); }
}