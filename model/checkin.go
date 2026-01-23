package model

import (
	"errors"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// Checkin 签到记录
type Checkin struct {
	Id                    int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId                int    `json:"user_id" gorm:"not null;uniqueIndex:idx_user_checkin_date"`
	CheckinDate           string `json:"checkin_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_user_checkin_date"`
	QuotaAwarded          int    `json:"quota_awarded" gorm:"not null"`
	StreakDays            int    `json:"streak_days" gorm:"not null;default:1"`
	BaseQuota             int    `json:"base_quota" gorm:"not null;default:0"`
	IsCrit                bool   `json:"is_crit" gorm:"not null;default:false"`
	CritSource            string `json:"crit_source" gorm:"type:varchar(16);not null;default:''"`
	YesterdayConsumeQuota int    `json:"yesterday_consume_quota" gorm:"not null;default:0"`
	CreatedAt             int64  `json:"created_at" gorm:"bigint"`
}

// CheckinRecord 用于API返回的签到记录
type CheckinRecord struct {
	CheckinDate           string `json:"checkin_date"`
	QuotaAwarded          int    `json:"quota_awarded"`
	StreakDays            int    `json:"streak_days"`
	BaseQuota             int    `json:"base_quota"`
	IsCrit                bool   `json:"is_crit"`
	CritSource            string `json:"crit_source"`
	YesterdayConsumeQuota int    `json:"yesterday_consume_quota"`
}

func (Checkin) TableName() string {
	return "checkins"
}

func getTodayDate() string {
	return time.Now().Format("2006-01-02")
}

func getYesterdayDate() string {
	return time.Now().AddDate(0, 0, -1).Format("2006-01-02")
}

// GetUserCheckinRecords 获取用户在指定日期范围内的签到记录
func GetUserCheckinRecords(userId int, startDate, endDate string) ([]Checkin, error) {
	var records []Checkin
	err := DB.Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
		userId, startDate, endDate).
		Order("checkin_date DESC").
		Find(&records).Error
	return records, err
}

// HasCheckedInToday 检查用户今天是否已签到
func HasCheckedInToday(userId int) (bool, error) {
	today := getTodayDate()
	var count int64
	err := DB.Model(&Checkin{}).
		Where("user_id = ? AND checkin_date = ?", userId, today).
		Count(&count).Error
	return count > 0, err
}

// GetUserYesterdayConsumption 获取用户昨日消费额度
func GetUserYesterdayConsumption(userId int) (int, error) {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	yesterdayStart := todayStart.AddDate(0, 0, -1)

	var total int64
	err := LOG_DB.Model(&Log{}).
		Select("COALESCE(SUM(quota), 0)").
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?",
			userId, LogTypeConsume, yesterdayStart.Unix(), todayStart.Unix()).
		Scan(&total).Error
	if err != nil {
		return 0, err
	}
	return int(total), nil
}

// GetUserCheckinStreak 获取用户本次签到的连签天数
func GetUserCheckinStreak(userId int) (int, error) {
	today := getTodayDate()
	yesterday := getYesterdayDate()

	var last Checkin
	err := DB.Where("user_id = ?", userId).Order("checkin_date desc").Limit(1).Take(&last).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 1, nil
	}
	if err != nil {
		return 0, err
	}
	if last.CheckinDate == today {
		return 0, errors.New("今日已签到")
	}
	if last.CheckinDate == yesterday {
		setting := operation_setting.GetCheckinSetting()
		if setting.DynamicRewardEnabled && setting.CritGuaranteeDays > 0 && last.StreakDays >= setting.CritGuaranteeDays {
			return 1, nil
		}
		if last.StreakDays > 0 {
			return last.StreakDays + 1, nil
		}
		return 1, nil
	}
	return 1, nil
}

// GetUserCurrentStreak 获取用户当前连续签到天数
func GetUserCurrentStreak(userId int) (int, error) {
	today := getTodayDate()
	yesterday := getYesterdayDate()

	var last Checkin
	err := DB.Where("user_id = ?", userId).Order("checkin_date desc").Limit(1).Take(&last).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	if last.CheckinDate == today || last.CheckinDate == yesterday {
		return last.StreakDays, nil
	}
	return 0, nil
}

func randomQuota(min, max int) int {
	if max <= min {
		return min
	}
	return min + rand.Intn(max-min+1)
}

func getRewardTierByConsumption(consumeRmb float64, tiers []operation_setting.CheckinRewardTier) (operation_setting.CheckinRewardTier, bool) {
	for _, tier := range tiers {
		if consumeRmb >= tier.MinRmb && (tier.MaxRmb < 0 || consumeRmb < tier.MaxRmb) {
			return tier, true
		}
	}
	return operation_setting.CheckinRewardTier{}, false
}

func getStreakBonusRate(streakDays int, bonuses []operation_setting.CheckinStreakBonus) float64 {
	var bonusRate float64
	for _, bonus := range bonuses {
		if streakDays >= bonus.MinDays && (bonus.MaxDays <= 0 || streakDays <= bonus.MaxDays) {
			if bonus.BonusRate > bonusRate {
				bonusRate = bonus.BonusRate
			}
		}
	}
	return bonusRate
}

// CalculateCheckinReward 计算签到奖励
func CalculateCheckinReward(yesterdayConsumeQuota int, streakDays int) (baseQuota int, isCrit bool, critSource string, finalQuota int) {
	setting := operation_setting.GetCheckinSetting()
	baseQuota = randomQuota(setting.MinQuota, setting.MaxQuota)

	if setting.DynamicRewardEnabled && len(setting.RewardTiers) > 0 {
		consumeRmb := float64(yesterdayConsumeQuota) / common.QuotaPerUnit
		if tier, ok := getRewardTierByConsumption(consumeRmb, setting.RewardTiers); ok {
			baseQuota = randomQuota(tier.MinQuota, tier.MaxQuota)
		}
	}

	critAppliedQuota := baseQuota
	if setting.CritGuaranteeDays > 0 && streakDays >= setting.CritGuaranteeDays {
		isCrit = true
		critSource = "guaranteed"
	} else if setting.CritProbability > 0 && rand.Float64() < setting.CritProbability {
		isCrit = true
		critSource = "random"
	}
	if isCrit {
		multiplier := setting.CritMultiplier
		if multiplier < 1 {
			multiplier = 1
		}
		critAppliedQuota = baseQuota * multiplier
	}

	bonusRate := getStreakBonusRate(streakDays, setting.StreakBonuses)
	finalQuota = critAppliedQuota
	if bonusRate > 0 {
		finalQuota = critAppliedQuota + int(float64(critAppliedQuota)*bonusRate)
	}

	return baseQuota, isCrit, critSource, finalQuota
}

// UserCheckin 执行用户签到
func UserCheckin(userId int) (*Checkin, error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return nil, errors.New("签到功能未启用")
	}

	hasChecked, err := HasCheckedInToday(userId)
	if err != nil {
		return nil, err
	}
	if hasChecked {
		return nil, errors.New("今日已签到")
	}

	today := getTodayDate()
	var (
		quotaAwarded          int
		baseQuota             int
		isCrit                bool
		critSource            string
		yesterdayConsumeQuota int
		streakDays            int
	)

	streakDays, err = GetUserCheckinStreak(userId)
	if err != nil {
		return nil, err
	}

	if setting.DynamicRewardEnabled {
		yesterdayConsumeQuota, err = GetUserYesterdayConsumption(userId)
		if err != nil {
			return nil, err
		}
		baseQuota, isCrit, critSource, quotaAwarded = CalculateCheckinReward(yesterdayConsumeQuota, streakDays)
	} else {
		quotaAwarded = randomQuota(setting.MinQuota, setting.MaxQuota)
		baseQuota = quotaAwarded
	}

	checkin := &Checkin{
		UserId:                userId,
		CheckinDate:           today,
		QuotaAwarded:          quotaAwarded,
		StreakDays:            streakDays,
		BaseQuota:             baseQuota,
		IsCrit:                isCrit,
		CritSource:            critSource,
		YesterdayConsumeQuota: yesterdayConsumeQuota,
		CreatedAt:             time.Now().Unix(),
	}

	if common.UsingSQLite {
		return userCheckinWithoutTransaction(checkin, userId, quotaAwarded)
	}

	return userCheckinWithTransaction(checkin, userId, quotaAwarded)
}

// userCheckinWithTransaction 使用事务执行签到（适用于 MySQL 和 PostgreSQL）
func userCheckinWithTransaction(checkin *Checkin, userId int, quotaAwarded int) (*Checkin, error) {
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(checkin).Error; err != nil {
			return errors.New("签到失败，请稍后重试")
		}

		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quotaAwarded)).Error; err != nil {
			return errors.New("签到失败：更新额度出错")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	go func() {
		_ = cacheIncrUserQuota(userId, int64(quotaAwarded))
	}()

	return checkin, nil
}

// userCheckinWithoutTransaction 不使用事务执行签到（适用于 SQLite）
func userCheckinWithoutTransaction(checkin *Checkin, userId int, quotaAwarded int) (*Checkin, error) {
	if err := DB.Create(checkin).Error; err != nil {
		return nil, errors.New("签到失败，请稍后重试")
	}

	if err := IncreaseUserQuota(userId, quotaAwarded, true); err != nil {
		DB.Delete(checkin)
		return nil, errors.New("签到失败：更新额度出错")
	}

	return checkin, nil
}

// GetUserCheckinStats 获取用户签到统计信息
func GetUserCheckinStats(userId int, month string) (map[string]interface{}, error) {
	startDate := month + "-01"
	endDate := month + "-31"

	records, err := GetUserCheckinRecords(userId, startDate, endDate)
	if err != nil {
		return nil, err
	}

	checkinRecords := make([]CheckinRecord, len(records))
	for i, r := range records {
		checkinRecords[i] = CheckinRecord{
			CheckinDate:           r.CheckinDate,
			QuotaAwarded:          r.QuotaAwarded,
			StreakDays:            r.StreakDays,
			BaseQuota:             r.BaseQuota,
			IsCrit:                r.IsCrit,
			CritSource:            r.CritSource,
			YesterdayConsumeQuota: r.YesterdayConsumeQuota,
		}
	}

	hasCheckedToday, _ := HasCheckedInToday(userId)

	var totalCheckins int64
	var totalQuota int64
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins)
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Select("COALESCE(SUM(quota_awarded), 0)").Scan(&totalQuota)

	return map[string]interface{}{
		"total_quota":      totalQuota,
		"total_checkins":   totalCheckins,
		"checkin_count":    len(records),
		"checked_in_today": hasCheckedToday,
		"records":          checkinRecords,
	}, nil
}
