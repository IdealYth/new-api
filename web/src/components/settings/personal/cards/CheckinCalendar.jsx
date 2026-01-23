/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Calendar,
  Button,
  Typography,
  Avatar,
  Spin,
  Tooltip,
  Collapsible,
  Modal,
  Progress,
} from '@douyinfe/semi-ui';
import {
  CalendarCheck,
  Gift,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Flame,
} from 'lucide-react';
import Turnstile from 'react-turnstile';
import { API, showError, showSuccess, renderQuota } from '../../../../helpers';

const CheckinCalendar = ({ t, status, turnstileEnabled, turnstileSiteKey }) => {
  const [loading, setLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [turnstileModalVisible, setTurnstileModalVisible] = useState(false);
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0);
  const [checkinData, setCheckinData] = useState({
    enabled: false,
    dynamic_reward_enabled: false,
    current_streak: 0,
    crit_probability: 0.01,
    crit_multiplier: 5,
    crit_guarantee_days: 30,
    streak_bonuses: [],
    reward_tiers: [],
    stats: {
      checked_in_today: false,
      total_checkins: 0,
      total_quota: 0,
      checkin_count: 0,
      records: [],
    },
  });
  const [currentMonth, setCurrentMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(null);

  const checkinRecordsMap = useMemo(() => {
    const map = {};
    const records = checkinData.stats?.records || [];
    records.forEach((record) => {
      map[record.checkin_date] = record;
    });
    return map;
  }, [checkinData.stats?.records]);

  const monthlyQuota = useMemo(() => {
    const records = checkinData.stats?.records || [];
    return records.reduce(
      (sum, record) => sum + (record.quota_awarded || 0),
      0,
    );
  }, [checkinData.stats?.records]);

  const streakInfo = useMemo(() => {
    const streak = checkinData.current_streak || 0;
    const milestones = [7, 15, 24, 30];
    const bonuses = checkinData.streak_bonuses || [];

    let currentBonus = 0;
    let nextMilestone = milestones[0];
    let nextBonus = 0;

    for (const bonus of bonuses) {
      if (streak >= bonus.min_days && (bonus.max_days <= 0 || streak <= bonus.max_days)) {
        currentBonus = Math.max(currentBonus, bonus.bonus_rate * 100);
      }
    }

    for (const m of milestones) {
      if (streak < m) {
        nextMilestone = m;
        const nextBonusConfig = bonuses.find(b => m >= b.min_days && (b.max_days <= 0 || m <= b.max_days));
        nextBonus = nextBonusConfig ? nextBonusConfig.bonus_rate * 100 : 0;
        break;
      }
    }

    const guaranteeDays = checkinData.crit_guarantee_days || 30;
    const progress = Math.min((streak / guaranteeDays) * 100, 100);

    return { streak, currentBonus, nextMilestone, nextBonus, progress, guaranteeDays };
  }, [checkinData.current_streak, checkinData.streak_bonuses, checkinData.crit_guarantee_days]);

  const fetchCheckinStatus = async (month) => {
    const isFirstLoad = !initialLoaded;
    setLoading(true);
    try {
      const res = await API.get(`/api/user/checkin?month=${month}`);
      const { success, data, message } = res.data;
      if (success) {
        setCheckinData(data);
        if (isFirstLoad) {
          setIsCollapsed(data.stats?.checked_in_today ?? false);
          setInitialLoaded(true);
        }
      } else {
        showError(message || t('获取签到状态失败'));
        if (isFirstLoad) {
          setIsCollapsed(false);
          setInitialLoaded(true);
        }
      }
    } catch (error) {
      showError(t('获取签到状态失败'));
      if (isFirstLoad) {
        setIsCollapsed(false);
        setInitialLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const postCheckin = async (token) => {
    const url = token
      ? `/api/user/checkin?turnstile=${encodeURIComponent(token)}`
      : '/api/user/checkin';
    return API.post(url);
  };

  const shouldTriggerTurnstile = (message) => {
    if (!turnstileEnabled) return false;
    if (typeof message !== 'string') return true;
    return message.includes('Turnstile');
  };

  const doCheckin = async (token) => {
    setCheckinLoading(true);
    try {
      const res = await postCheckin(token);
      const { success, data, message } = res.data;
      if (success) {
        if (data.is_crit) {
          const critMsg = data.crit_source === 'guaranteed'
            ? t('连签30天必定暴击！')
            : t('暴击！');
          showSuccess(
            `${critMsg} ${t('获得')} ${renderQuota(data.quota_awarded)} (${checkinData.crit_multiplier || 5}${t('倍奖励')})`,
          );
        } else {
          showSuccess(
            t('签到成功！获得') + ' ' + renderQuota(data.quota_awarded),
          );
        }
        fetchCheckinStatus(currentMonth);
        setTurnstileModalVisible(false);
      } else {
        if (!token && shouldTriggerTurnstile(message)) {
          if (!turnstileSiteKey) {
            showError('Turnstile is enabled but site key is empty.');
            return;
          }
          setTurnstileModalVisible(true);
          return;
        }
        if (token && shouldTriggerTurnstile(message)) {
          setTurnstileWidgetKey((v) => v + 1);
        }
        showError(message || t('签到失败'));
      }
    } catch (error) {
      showError(t('签到失败'));
    } finally {
      setCheckinLoading(false);
    }
  };

  useEffect(() => {
    if (status?.checkin_enabled) {
      fetchCheckinStatus(currentMonth);
    }
  }, [status?.checkin_enabled, currentMonth]);

  if (!status?.checkin_enabled) {
    return null;
  }

  const dateRender = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    const record = checkinRecordsMap[formattedDate];
    const isCheckedIn = record !== undefined;

    if (isCheckedIn) {
      const isCrit = record.is_crit;
      return (
        <Tooltip
          content={
            <div>
              <div>{t('获得')} {renderQuota(record.quota_awarded)}</div>
              {isCrit && <div className='text-amber-400'>{t('暴击')}</div>}
              {record.streak_days > 1 && <div>{t('连签')} {record.streak_days} {t('天')}</div>}
            </div>
          }
          position='top'
        >
          <div className='absolute inset-0 flex flex-col items-center justify-center cursor-pointer'>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-0.5 shadow-sm ${isCrit ? 'bg-amber-500' : 'bg-green-500'}`}>
              {isCrit ? (
                <Zap size={14} className='text-white' strokeWidth={3} />
              ) : (
                <Check size={14} className='text-white' strokeWidth={3} />
              )}
            </div>
            <div className={`text-[10px] font-medium leading-none ${isCrit ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
              {renderQuota(record.quota_awarded)}
            </div>
          </div>
        </Tooltip>
      );
    }
    return null;
  };

  const handleMonthChange = (date) => {
    const month = date.toISOString().slice(0, 7);
    setCurrentMonth(month);
  };

  return (
    <Card className='!rounded-2xl'>
      <Modal
        title='Security Check'
        visible={turnstileModalVisible}
        footer={null}
        centered
        onCancel={() => {
          setTurnstileModalVisible(false);
          setTurnstileWidgetKey((v) => v + 1);
        }}
      >
        <div className='flex justify-center py-2'>
          <Turnstile
            key={turnstileWidgetKey}
            sitekey={turnstileSiteKey}
            onVerify={(token) => {
              doCheckin(token);
            }}
            onExpire={() => {
              setTurnstileWidgetKey((v) => v + 1);
            }}
          />
        </div>
      </Modal>

      <div className='flex items-center justify-between'>
        <div
          className='flex items-center flex-1 cursor-pointer'
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <Avatar size='small' color='green' className='mr-3 shadow-md'>
            <CalendarCheck size={16} />
          </Avatar>
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              <Typography.Text className='text-lg font-medium'>
                {t('每日签到')}
              </Typography.Text>
              {isCollapsed ? (
                <ChevronDown size={16} className='text-gray-400' />
              ) : (
                <ChevronUp size={16} className='text-gray-400' />
              )}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              {!initialLoaded
                ? t('正在加载签到状态...')
                : checkinData.stats?.checked_in_today
                  ? t('今日已签到，累计签到') +
                  ` ${checkinData.stats?.total_checkins || 0} ` +
                  t('天')
                  : checkinData.dynamic_reward_enabled
                    ? t('根据消费动态调整奖励')
                    : t('每日签到可获得随机额度奖励')}
            </div>
          </div>
        </div>
        <Button
          type='primary'
          theme='solid'
          icon={<Gift size={16} />}
          onClick={() => doCheckin()}
          loading={checkinLoading || !initialLoaded}
          disabled={!initialLoaded || checkinData.stats?.checked_in_today}
          className='!bg-green-600 hover:!bg-green-700'
        >
          {!initialLoaded
            ? t('加载中...')
            : checkinData.stats?.checked_in_today
              ? t('今日已签到')
              : t('立即签到')}
        </Button>
      </div>

      <Collapsible isOpen={isCollapsed === false} keepDOM>
        <div className='grid grid-cols-4 gap-3 mb-4 mt-4'>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='text-xl font-bold text-green-600'>
              {checkinData.stats?.total_checkins || 0}
            </div>
            <div className='text-xs text-gray-500'>{t('累计签到')}</div>
          </div>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='text-xl font-bold text-orange-600'>
              {renderQuota(monthlyQuota, 6)}
            </div>
            <div className='text-xs text-gray-500'>{t('本月获得')}</div>
          </div>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='text-xl font-bold text-blue-600'>
              {renderQuota(checkinData.stats?.total_quota || 0, 6)}
            </div>
            <div className='text-xs text-gray-500'>{t('累计获得')}</div>
          </div>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='flex items-center justify-center gap-1'>
              <Flame size={16} className='text-purple-600' />
              <span className='text-xl font-bold text-purple-600'>
                {streakInfo.streak}
              </span>
            </div>
            <div className='text-xs text-gray-500'>{t('连续签到')}</div>
          </div>
        </div>

        {checkinData.dynamic_reward_enabled && (
          <div className='mb-4 p-3 bg-gradient-to-r from-purple-50 to-amber-50 dark:from-purple-900/20 dark:to-amber-900/20 rounded-lg'>
            <div className='flex items-center justify-between mb-2'>
              <div className='flex items-center gap-2'>
                <Zap size={16} className='text-amber-500' />
                <span className='text-sm font-medium'>
                  {t('连签进度')} ({streakInfo.streak}/{streakInfo.guaranteeDays})
                </span>
              </div>
              {streakInfo.currentBonus > 0 && (
                <span className='text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full'>
                  +{streakInfo.currentBonus}% {t('加成')}
                </span>
              )}
            </div>
            <Progress
              percent={streakInfo.progress}
              showInfo={false}
              stroke='linear-gradient(to right, #8B5CF6, #F59E0B)'
              size='small'
            />
            <div className='flex justify-between mt-1 text-xs text-gray-500'>
              <span>{t('第')} {streakInfo.guaranteeDays} {t('天必定暴击')}</span>
              {streakInfo.streak < streakInfo.nextMilestone && (
                <span>
                  {t('还差')} {streakInfo.nextMilestone - streakInfo.streak} {t('天达到')} +{streakInfo.nextBonus}%
                </span>
              )}
            </div>
          </div>
        )}

        <Spin spinning={loading}>
          <div className='border rounded-lg overflow-hidden checkin-calendar'>
            <style>{`
            .checkin-calendar .semi-calendar {
              font-size: 13px;
            }
            .checkin-calendar .semi-calendar-month-header {
              padding: 8px 12px;
            }
            .checkin-calendar .semi-calendar-month-week-row {
              height: 28px;
            }
            .checkin-calendar .semi-calendar-month-week-row th {
              font-size: 12px;
              padding: 4px 0;
            }
            .checkin-calendar .semi-calendar-month-grid-row {
              height: auto;
            }
            .checkin-calendar .semi-calendar-month-grid-row td {
              height: 56px;
              padding: 2px;
            }
            .checkin-calendar .semi-calendar-month-grid-row-cell {
              position: relative;
              height: 100%;
            }
            .checkin-calendar .semi-calendar-month-grid-row-cell-day {
              position: absolute;
              top: 4px;
              left: 50%;
              transform: translateX(-50%);
              font-size: 12px;
              z-index: 1;
            }
            .checkin-calendar .semi-calendar-month-same {
              background: transparent;
            }
            .checkin-calendar .semi-calendar-month-today .semi-calendar-month-grid-row-cell-day {
              background: var(--semi-color-primary);
              color: white;border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;}
          `}</style>
            <Calendar
              mode='month'
              onChange={handleMonthChange}
              dateGridRender={(dateString, date) => dateRender(dateString)}
            />
          </div>
        </Spin>

        <div className='mt-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
          <Typography.Text type='tertiary' className='text-xs'>
            {checkinData.dynamic_reward_enabled ? (
              <ul className='list-disc list-inside space-y-0.5'>
                <li>{t('签到奖励根据昨日消费动态调整')}</li>
                <li>{t('连续签到可获得额外加成')}</li>
                <li>{t('每次签到都有一定概率触发暴击（5倍奖励）')}</li>
                <li>{t('连续签到30天必定触发暴击')}</li>
              </ul>
            ) : (
              <ul className='list-disc list-inside space-y-0.5'>
                <li>{t('每日签到可获得随机额度奖励')}</li>
                <li>{t('签到奖励将直接添加到您的账户余额')}</li>
                <li>{t('每日仅可签到一次，请勿重复签到')}</li>
              </ul>
            )}
          </Typography.Text>
        </div>
      </Collapsible>
    </Card>
  );
};

export default CheckinCalendar;
