package main

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template" // <--- IMPORTANTE: Para renderizar HTML
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"sort" // <--- IMPORTANTE: Para ordenar datos en el backend
	"time"

	"github.com/alejandrosahonero/inventario-api/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var client *mongo.Client
var productCollection *mongo.Collection
const SeedFile = "./seeds/productos.json" // Ubicación del archivo

// Estructura de datos para enviar al Dashboard
type DashboardData struct {
	TotalValue   string
	TopProducts  []models.Product
	ChartLabels  []string
	ChartValues  []int
}

func main() {
	// --- CONEXIÓN ---
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		log.Fatal("MONGO_URI no definida")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var err error
	client, err = mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatal(err)
	}

	productCollection = client.Database("inventario").Collection("productos")
	fmt.Println("🔥 Conectado a MongoDB")

	// --- AUTO-IMPORTAR (SEEDING) ---
	// Antes de arrancar el servidor, verificamos si hay que cargar datos
	seedDatabase()

	// --- RUTAS ---
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))
	
	http.HandleFunc("/", homeHandler)           // Página principal (ahora explícita)
	http.HandleFunc("/dashboard", dashboardHandler) // <--- NUEVA RUTA
	
	http.HandleFunc("/products", productsHandler)
	http.HandleFunc("/export", exportHandler)

	fmt.Println("Servidor escuchando en puerto 8080...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		panic(err)
	}
}

// Handler para la Home (simplemente sirve el index.html estático)
func homeHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, "./static/index.html")
}

// --- AQUÍ ESTÁ LA MAGIA DE GO ---
func dashboardHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Traemos TODOS los datos de Mongo (Go procesará los datos, no la DB)
	cursor, err := productCollection.Find(ctx, bson.M{})
	if err != nil {
		http.Error(w, "Error DB", 500)
		return
	}
	var products []models.Product
	if err = cursor.All(ctx, &products); err != nil {
		http.Error(w, "Error Decode", 500)
		return
	}

	// 2. Lógica de Negocio en Go (Cálculos)
	var totalVal float64
	var labels []string
	var values []int

	for _, p := range products {
		totalVal += p.Price * float64(p.Stock)
		labels = append(labels, p.Name)
		values = append(values, p.Stock)
	}

	// 3. Algoritmo de Ordenamiento en Go (Sort)
	// Ordenamos los productos por precio descendente para sacar el TOP 5
	sort.Slice(products, func(i, j int) bool {
		return products[i].Price > products[j].Price
	})

	top5 := products
	if len(products) > 5 {
		top5 = products[:5]
	}

	// 4. Preparamos los datos
	data := DashboardData{
		TotalValue:  fmt.Sprintf("$%.2f", totalVal),
		TopProducts: top5,
		ChartLabels: labels, // Go pasará esto como array al JS
		ChartValues: values,
	}

	// 5. Renderizamos el Template
	tmpl, err := template.ParseFiles("templates/dashboard.html")
	if err != nil {
		http.Error(w, "Error cargando template: "+err.Error(), 500)
		return
	}

	// Ejecutamos el template enviándole los datos
	tmpl.Execute(w, data)
}

// --- LÓGICA DE IMPORTACIÓN (AL INICIO) ---
func seedDatabase() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Contamos cuántos productos hay
	count, err := productCollection.CountDocuments(ctx, bson.M{})
	if err != nil {
		log.Println("Error contando documentos:", err)
		return
	}

	// 2. Si la base de datos NO está vacía, no hacemos nada (para no duplicar)
	if count > 0 {
		fmt.Println("✅ La base de datos ya tiene datos. Omitiendo carga.")
		return
	}

	// 3. Si está vacía, buscamos el archivo JSON
	fmt.Println("📂 Base de datos vacía. Buscando archivo semilla...")
	
	fileData, err := ioutil.ReadFile(SeedFile)
	if err != nil {
		fmt.Println("⚠️ No se encontró archivo seed (productos.json). Empezando desde cero.")
		return
	}

	// 4. Leemos el JSON
	var products []models.Product
	if err := json.Unmarshal(fileData, &products); err != nil {
		log.Println("Error leyendo JSON semilla:", err)
		return
	}

	// 5. Insertamos los datos
	// Convertimos []Product a []interface{} porque InsertMany lo requiere así
	var ui []interface{}
	for _, p := range products {
		ui = append(ui, p)
	}

	if len(ui) > 0 {
		_, err = productCollection.InsertMany(ctx, ui)
		if err != nil {
			log.Println("Error insertando datos semilla:", err)
			return
		}
		fmt.Printf("🌱 ¡ÉXITO! Se han cargado %d productos desde el archivo JSON.\n", len(ui))
	}
}

// --- LÓGICA DE EXPORTACIÓN (BOTÓN) ---
func exportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Traemos TODOS los productos
	cursor, err := productCollection.Find(ctx, bson.M{})
	if err != nil {
		http.Error(w, "Error leyendo BD", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var products []models.Product
	if err = cursor.All(ctx, &products); err != nil {
		http.Error(w, "Error decodificando", http.StatusInternalServerError)
		return
	}

	// 2. Convertimos a JSON con sangría bonita (Indent)
	fileData, err := json.MarshalIndent(products, "", "  ")
	if err != nil {
		http.Error(w, "Error creando JSON", http.StatusInternalServerError)
		return
	}

	// 3. Escribimos el archivo en el volumen compartido
	if err := ioutil.WriteFile(SeedFile, fileData, 0644); err != nil {
		http.Error(w, "Error escribiendo archivo en disco", http.StatusInternalServerError)
		return
	}

	fmt.Println("💾 Copia de seguridad guardada en:", SeedFile)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Backup guardado correctamente"))
}

// productsHandler: El semáforo que dirige el tráfico según el método HTTP
func productsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		getProducts(w, r)
	case "POST":
		createProduct(w, r)
	case "PUT":
		updateProduct(w, r) // Nuevo: Actualizar
	case "DELETE":
		deleteProduct(w, r) // Nuevo: Eliminar
	default:
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
	}
}

// --- LÓGICA CRUD ---

func getProducts(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := productCollection.Find(ctx, bson.M{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var products []models.Product = []models.Product{}
	for cursor.Next(ctx) {
		var p models.Product
		if err := cursor.Decode(&p); err != nil {
			continue
		}
		products = append(products, p)
	}
	json.NewEncoder(w).Encode(products)
}

func createProduct(w http.ResponseWriter, r *http.Request) {
	var prod models.Product
	if err := json.NewDecoder(r.Body).Decode(&prod); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}
	// Nos aseguramos de que el ID sea nuevo
	prod.ID = primitive.NewObjectID()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := productCollection.InsertOne(ctx, prod)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(result)
}

func updateProduct(w http.ResponseWriter, r *http.Request) {
	// 1. Obtener el ID de la URL: /products?id=xxxxx
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "Falta el parámetro ID", http.StatusBadRequest)
		return
	}

	// 2. Convertir string a ObjectID de Mongo
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	// 3. Leer los nuevos datos del cuerpo
	var prod models.Product
	if err := json.NewDecoder(r.Body).Decode(&prod); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	// 4. Actualizar en Mongo
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Usamos $set para actualizar solo los campos enviados
	update := bson.M{
		"$set": bson.M{
			"name":  prod.Name,
			"price": prod.Price,
			"stock": prod.Stock,
		},
	}

	_, err = productCollection.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		http.Error(w, "Error al actualizar", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Producto actualizado"})
}

func deleteProduct(w http.ResponseWriter, r *http.Request) {
	// 1. Obtener ID
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "Falta el parámetro ID", http.StatusBadRequest)
		return
	}

	// 2. Convertir a ObjectID
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	// 3. Borrar de Mongo
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = productCollection.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		http.Error(w, "Error al eliminar", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Producto eliminado"})
}