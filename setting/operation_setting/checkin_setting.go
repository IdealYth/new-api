package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// CheckinRewardTier 签到奖励层级
type CheckinRewardTier struct {
	MinRmb   float64 `json:"min_rmb"`
	MaxRmb   float64 `json:"max_rmb"`
	MinQuota int     `json:"min_quota"`
	MaxQuota int     `json:"max_quota"`
}

// CheckinStreakBonus 连签加成配置
type CheckinStreakBonus struct {
	MinDays   int     `json:"min_days"`
	MaxDays   int     `json:"max_days"`
	BonusRate float64 `json:"bonus_rate"`
}

// CheckinSetting 签到功能配置
type CheckinSetting struct {
	Enabled              bool                 `json:"enabled"`
	MinQuota             int                  `json:"min_quota"`
	MaxQuota             int                  `json:"max_quota"`
	DynamicRewardEnabled bool                 `json:"dynamic_reward_enabled"`
	RewardTiers          []CheckinRewardTier  `json:"reward_tiers"`
	CritProbability      float64              `json:"crit_probability"`
	CritMultiplier       int                  `json:"crit_multiplier"`
	CritGuaranteeDays    int                  `json:"crit_guarantee_days"`
	StreakBonuses        []CheckinStreakBonus `json:"streak_bonuses"`
}

// 默认配置
var checkinSetting = CheckinSetting{
	Enabled:              false,
	MinQuota:             1000,
	MaxQuota:             10000,
	DynamicRewardEnabled: false,
	RewardTiers: []CheckinRewardTier{
		{MinRmb: 0, MaxRmb: 0.3, MinQuota: 25000, MaxQuota: 50000},
		{MinRmb: 0.3, MaxRmb: 3, MinQuota: 75000, MaxQuota: 150000},
		{MinRmb: 3, MaxRmb: 10, MinQuota: 150000, MaxQuota: 250000},
		{MinRmb: 10, MaxRmb: -1, MinQuota: 300000, MaxQuota: 500000},
	},
	CritProbability:   0.01,
	CritMultiplier:    5,
	CritGuaranteeDays: 30,
	StreakBonuses: []CheckinStreakBonus{
		{MinDays: 7, MaxDays: 14, BonusRate: 0.10},
		{MinDays: 15, MaxDays: 23, BonusRate: 0.20},
		{MinDays: 24, MaxDays: 29, BonusRate: 0.30},
	},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("checkin_setting", &checkinSetting)
}

// GetCheckinSetting 获取签到配置
func GetCheckinSetting() *CheckinSetting {
	return &checkinSetting
}

// IsCheckinEnabled 是否启用签到功能
func IsCheckinEnabled() bool {
	return checkinSetting.Enabled
}

// GetCheckinQuotaRange 获取签到额度范围
func GetCheckinQuotaRange() (min, max int) {
	return checkinSetting.MinQuota, checkinSetting.MaxQuota
}
