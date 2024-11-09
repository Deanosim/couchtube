package config

import (
	"log"
	"os"
	"strconv"
	"sync"

	"github.com/joho/godotenv"
)

var (
	port       string
	dbFilePath string
	readonly   bool
	once       sync.Once
)

func init() {
	once.Do(func() {
		if err := godotenv.Load(); err != nil {
			log.Println("No .env file found, relying on system environment variables")
		}

		port = getEnv("PORT", "8081")
		dbFilePath = getEnv("DATABASE_FILE", "couchtube.db")
		readonly = getEnvAsBool("READONLY_MODE", false)
	})
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func getEnvAsBool(key string, fallback bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		boolValue, err := strconv.ParseBool(value)
		if err != nil {
			log.Printf("Warning: unable to parse boolean from %s; using default: %v", key, fallback)
			return fallback
		}
		return boolValue
	}
	return fallback
}

func GetPort() string {
	return port
}

func GetDBFilePath() string {
	return dbFilePath
}

func GetReadonlyMode() bool {
	return readonly
}
