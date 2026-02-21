package config

import "os"

type Config struct {
	Env          string
	Port         string
	ServerAPIKey string
}

func Load() Config {
	return Config{
		Env:          getOrDefault("APP_ENV", "development"),
		Port:         getOrDefault("PORT", "8080"),
		ServerAPIKey: os.Getenv("SERVER_API_KEY"),
	}
}

func getOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
