package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}
	userId := c.GetInt("id")
	month := c.DefaultQuery("month", time.Now().Format("2006-01"))

	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	currentStreak, _ := model.GetUserCurrentStreak(userId)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":                setting.Enabled,
			"min_quota":              setting.MinQuota,
			"max_quota":              setting.MaxQuota,
			"dynamic_reward_enabled": setting.DynamicRewardEnabled,
			"reward_tiers":           setting.RewardTiers,
			"streak_bonuses":         setting.StreakBonuses,
			"crit_probability":       setting.CritProbability,
			"crit_multiplier":        setting.CritMultiplier,
			"crit_guarantee_days":    setting.CritGuaranteeDays,
			"current_streak":         currentStreak,
			"stats":                  stats,
		},
	})
}

// DoCheckin 执行用户签到
func DoCheckin(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}

	userId := c.GetInt("id")

	checkin, err := model.UserCheckin(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("用户签到，获得额度 %s", logger.LogQuota(checkin.QuotaAwarded)))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "签到成功",
		"data": gin.H{
			"quota_awarded":           checkin.QuotaAwarded,
			"checkin_date":            checkin.CheckinDate,
			"streak_days":             checkin.StreakDays,
			"base_quota":              checkin.BaseQuota,
			"is_crit":                 checkin.IsCrit,
			"crit_source":             checkin.CritSource,
			"yesterday_consume_quota": checkin.YesterdayConsumeQuota,
		},
	})
}
