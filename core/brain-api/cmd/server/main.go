package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"github.com/sedgeblog/core/brain-api/internal/config"
	"github.com/sedgeblog/core/brain-api/internal/harvester"
	"github.com/sedgeblog/core/brain-api/internal/http"
)

func main() {
	cfg := config.Load()
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := http.NewRouter(cfg)
	scheduler := harvester.NewScheduler(cfg)
	scheduler.Start()
	defer scheduler.Stop()

	log.Printf("brain-api listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server start failed: %v", err)
	}
}
