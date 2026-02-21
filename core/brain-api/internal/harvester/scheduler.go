package harvester

import (
	"log"
	"time"

	"github.com/robfig/cron/v3"

	"github.com/sedgeblog/core/brain-api/internal/config"
)

type Scheduler struct {
	cron *cron.Cron
	cfg  config.Config
}

func NewScheduler(cfg config.Config) *Scheduler {
	c := cron.New(cron.WithLocation(time.UTC))
	s := &Scheduler{cron: c, cfg: cfg}

	_, err := c.AddFunc("@every 6h", func() {
		log.Println("[harvester] tick: placeholder run, waiting for edge adapters")
	})
	if err != nil {
		log.Printf("[harvester] register job failed: %v", err)
	}

	return s
}

func (s *Scheduler) Start() {
	s.cron.Start()
	log.Println("[harvester] scheduler started")
}

func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	log.Println("[harvester] scheduler stopped")
}
