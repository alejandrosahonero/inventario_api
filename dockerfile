FROM golang:1.23-alpine

WORKDIR /app

# 1. Copiamos todo el codigo al contenedor
COPY . .

# 2. Inicializamos el modulo
RUN go mod init github.com/alejandrosahonero/inventario-api

# 3. Buscamos dependencias usadas en el codigo automaticamente
RUN go mod tidy

# 4. Compilamos
RUN go build -o main ./cmd/api

EXPOSE 8080

CMD ["./main"]