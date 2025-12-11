package models

// Importamos primitive para poder usar el tipo de ID especial de MongoDB
import "go.mongodb.org/mongo-driver/bson/primitive"

// Product define cómo se ve un producto en nuestra app
type Product struct {
	// ID: En Mongo es _id. En JSON (API) será "id". Omitir si está vacío al crear.
	ID    primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	
	Name  string             `bson:"name" json:"name"`
	Price float64            `bson:"price" json:"price"`
	Stock int                `bson:"stock" json:"stock"`
}