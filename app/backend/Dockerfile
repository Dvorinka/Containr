# Build Go API binary
FROM golang:1.24-alpine AS go-builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/server/main.go

# Build embedded Better Auth runtime dependencies
FROM node:20-alpine AS auth-builder

WORKDIR /auth

COPY auth/package*.json ./
RUN npm ci --omit=dev

COPY auth/src ./src

# Final runtime image (Go API + Better Auth sidecar in one container)
FROM node:20-alpine

RUN apk --no-cache add ca-certificates tzdata wget

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

COPY --from=go-builder /app/main ./main
COPY --from=go-builder /app/migrations ./migrations
COPY --from=go-builder /app/migrations_goose ./migrations_goose
COPY --from=auth-builder /auth ./auth

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

CMD ["./main"]
