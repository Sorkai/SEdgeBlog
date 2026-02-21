package http

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/sedgeblog/core/brain-api/internal/config"
)

func NewRouter(cfg config.Config) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	r.GET("/api/v1/base-stats", requireAPIKey(cfg), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"generated_at": time.Now().UTC().Format(time.RFC3339),
			"source":       "brain-api",
			"items":        []any{},
		})
	})

	r.POST("/internal/harvest/manual", requireAPIKey(cfg), func(c *gin.Context) {
		c.JSON(http.StatusAccepted, gin.H{
			"ok":      true,
			"message": "manual harvest accepted (stub)",
		})
	})

	return r
}

func requireAPIKey(cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cfg.ServerAPIKey == "" {
			c.Next()
			return
		}

		if c.GetHeader("x-api-key") != cfg.ServerAPIKey {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		c.Next()
	}
}
