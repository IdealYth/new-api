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

import React, { useEffect, useState, useRef } from 'react';
import {
  Button,
  Col,
  Form,
  Row,
  Spin,
  Typography,
  Table,
  InputNumber,
  Popconfirm,
  Card,
  Divider,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsCheckin(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'checkin_setting.enabled': false,
    'checkin_setting.min_quota': 1000,
    'checkin_setting.max_quota': 10000,
    'checkin_setting.dynamic_reward_enabled': false,
    'checkin_setting.crit_probability': 0.01,
    'checkin_setting.crit_multiplier': 5,
    'checkin_setting.crit_guarantee_days': 30,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  const [rewardTiers, setRewardTiers] = useState([
    { min_rmb: 0, max_rmb: 0.3, min_quota: 25000, max_quota: 50000 },
    { min_rmb: 0.3, max_rmb: 3, min_quota: 75000, max_quota: 150000 },
    { min_rmb: 3, max_rmb: 10, min_quota: 150000, max_quota: 250000 },
    { min_rmb: 10, max_rmb: -1, min_quota: 300000, max_quota: 500000 },
  ]);
  const [rewardTiersRow, setRewardTiersRow] = useState(rewardTiers);

  const [streakBonuses, setStreakBonuses] = useState([
    { min_days: 7, max_days: 14, bonus_rate: 0.1 },
    { min_days: 15, max_days: 23, bonus_rate: 0.2 },
    { min_days: 24, max_days: 29, bonus_rate: 0.3 },
  ]);
  const [streakBonusesRow, setStreakBonusesRow] = useState(streakBonuses);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function updateRewardTier(index, field, value) {
    setRewardTiers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addRewardTier() {
    setRewardTiers((prev) => [
      ...prev,
      { min_rmb: 0, max_rmb: 0, min_quota: 0, max_quota: 0 },
    ]);
  }

  function removeRewardTier(index) {
    setRewardTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStreakBonus(index, field, value) {
    setStreakBonuses((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addStreakBonus() {
    setStreakBonuses((prev) => [
      ...prev,
      { min_days: 1, max_days: 7, bonus_rate: 0 },
    ]);
  }

  function removeStreakBonus(index) {
    setStreakBonuses((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    const tiersChanged =
      JSON.stringify(rewardTiers) !== JSON.stringify(rewardTiersRow);
    const bonusesChanged =
      JSON.stringify(streakBonuses) !== JSON.stringify(streakBonusesRow);

    if (!updateArray.length && !tiersChanged && !bonusesChanged) {
      return showWarning(t('你似乎并没有修改什么'));
    }

    setLoading(true);
    try {
      const requests = [];

      for (const item of updateArray) {
        let value = '';
        if (typeof inputs[item.key] === 'boolean') {
          value = String(inputs[item.key]);
        } else {
          value = String(inputs[item.key]);
        }
        requests.push(
          API.put('/api/option/', {
            key: item.key,
            value,
          }),
        );
      }

      if (tiersChanged) {
        requests.push(
          API.put('/api/option/', {
            key: 'checkin_setting.reward_tiers',
            value: JSON.stringify(rewardTiers),
          }),
        );
      }

      if (bonusesChanged) {
        requests.push(
          API.put('/api/option/', {
            key: 'checkin_setting.streak_bonuses',
            value: JSON.stringify(streakBonuses),
          }),
        );
      }

      const results = await Promise.all(requests);
      const hasError = results.some((res) => !res?.data?.success);

      if (hasError) {
        showError(t('部分保存失败，请重试'));
      } else {
        showSuccess(t('保存成功'));
        setInputsRow(structuredClone(inputs));
        setRewardTiersRow(structuredClone(rewardTiers));
        setStreakBonusesRow(structuredClone(streakBonuses));
        props.refresh();
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current?.setValues(currentInputs);

    if (props.options['checkin_setting.reward_tiers']) {
      try {
        const tiers = JSON.parse(props.options['checkin_setting.reward_tiers']);
        if (Array.isArray(tiers)) {
          setRewardTiers(tiers);
          setRewardTiersRow(structuredClone(tiers));
        }
      } catch (e) {
        console.error('Failed to parse reward_tiers:', e);
      }
    }

    if (props.options['checkin_setting.streak_bonuses']) {
      try {
        const bonuses = JSON.parse(
          props.options['checkin_setting.streak_bonuses'],
        );
        if (Array.isArray(bonuses)) {
          setStreakBonuses(bonuses);
          setStreakBonusesRow(structuredClone(bonuses));
        }
      } catch (e) {
        console.error('Failed to parse streak_bonuses:', e);
      }
    }
  }, [props.options]);

  const isEnabled = inputs['checkin_setting.enabled'];
  const isDynamicEnabled = inputs['checkin_setting.dynamic_reward_enabled'];

  const rewardTierColumns = [
    {
      title: t('消费下限(元)'),
      dataIndex: 'min_rmb',
      render: (text, record, index) => (
        <InputNumber
          value={text}
          min={0}
          step={0.1}
          onChange={(v) => updateRewardTier(index, 'min_rmb', v)}
          disabled={!isEnabled || !isDynamicEnabled}
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: t('消费上限(元)'),
      dataIndex: 'max_rmb',
      render: (text, record, index) => (
        <InputNumber
          value={text}
          step={0.1}
          onChange={(v) => updateRewardTier(index, 'max_rmb', v)}
          disabled={!isEnabled || !isDynamicEnabled}
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: t('最小奖励'),
      dataIndex: 'min_quota',
      render: (text, record, index) => (
        <InputNumber
          value={text}
          min={0}
          step={1000}
          onChange={(v) => updateRewardTier(index, 'min_quota', v)}
          disabled={!isEnabled || !isDynamicEnabled}
          style={{ width: 120 }}
        />
      ),
    },
    {
      title: t('最大奖励'),
      dataIndex: 'max_quota',
      render: (text, record, index) => (
        <InputNumber
          value={text}
          min={0}
          step={1000}
          onChange={(v) => updateRewardTier(index, 'max_quota', v)}
          disabled={!isEnabled || !isDynamicEnabled}
          style={{ width: 120 }}
        />
      ),
    },
    {
      title: t('操作'),
      render: (_, record, index) => (
        <Popconfirm
          title={t('确定删除此层级？')}
          onConfirm={() => removeRewardTier(index)}
        >
          <Button
            icon={<IconDelete />}
            type='danger'
            theme='borderless'
            disabled={!isEnabled || !isDynamicEnabled}
          />
        </Popconfirm>
      ),
    },
  ];

  const streakBonusColumns = [
    {
      title: t('最小天数'),
      dataIndex: 'min_days',
      render: (text, record, index) => (
        <InputNumber
          value={text}
          min={1}
          onChange={(v) => updateStreakBonus(index, 'min_days', v)}
          disabled={!isEnabled || !isDynamicEnabled}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: t('最大天数'),
      dataIndex: 'max_days',
      render: (text, record, index) => (
        <InputNumber
          value={text}
          min={0}
          onChange={(v) => updateStreakBonus(index, 'max_days', v)}
          disabled={!isEnabled || !isDynamicEnabled}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: t('加成比例'),
      dataIndex: 'bonus_rate',
      render: (text, record, index) => (
        <InputNumber
          value={Number.isFinite(Number(text)) ? Number(text) * 100 : 0}
          min={0}
          max={100}
          step={1}
          precision={2}
          suffix={'%'}
          onChange={(v) => {
            const percent = typeof v === 'number' ? v : Number(v);
            updateStreakBonus(
              index,
              'bonus_rate',
              Number.isFinite(percent) ? percent / 100 : 0,
            );
          }}
          disabled={!isEnabled || !isDynamicEnabled}
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: t('操作'),
      render: (_, record, index) => (
        <Popconfirm
          title={t('确定删除此加成？')}
          onConfirm={() => removeStreakBonus(index)}
        >
          <Button
            icon={<IconDelete />}
            type='danger'
            theme='borderless'
            disabled={!isEnabled || !isDynamicEnabled}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('签到设置')}>
            <Typography.Text
              type='tertiary'
              style={{ marginBottom: 16, display: 'block' }}
            >
              {t('签到功能允许用户每日签到获取随机额度奖励')}
            </Typography.Text>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={6} xl={6}>
                <Form.Switch
                  field={'checkin_setting.enabled'}
                  label={t('启用签到功能')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange('checkin_setting.enabled')}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6} xl={6}>
                <Form.Switch
                  field={'checkin_setting.dynamic_reward_enabled'}
                  label={t('启用动态奖励')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange(
                    'checkin_setting.dynamic_reward_enabled',
                  )}
                  disabled={!isEnabled}
                  extraText={t('根据昨日消费动态调整奖励')}
                />
              </Col>
            </Row>

            <Divider margin='12px' />

            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={6} xl={6}>
                <Form.InputNumber
                  field={'checkin_setting.min_quota'}
                  label={t('基础最小额度')}
                  placeholder={t('签到奖励的最小额度')}
                  onChange={handleFieldChange('checkin_setting.min_quota')}
                  min={0}
                  disabled={!isEnabled}
                  extraText={t('动态模式关闭时使用')}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6} xl={6}>
                <Form.InputNumber
                  field={'checkin_setting.max_quota'}
                  label={t('基础最大额度')}
                  placeholder={t('签到奖励的最大额度')}
                  onChange={handleFieldChange('checkin_setting.max_quota')}
                  min={0}
                  disabled={!isEnabled}
                  extraText={t('动态模式关闭时使用')}
                />
              </Col>
            </Row>
          </Form.Section>

          <Form.Section text={t('暴击设置')}>
            <Typography.Text
              type='tertiary'
              style={{ marginBottom: 16, display: 'block' }}
            >
              {t('暴击可使签到奖励翻倍，增加用户签到的趣味性')}
            </Typography.Text>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={6} xl={6}>
                <Form.InputNumber
                  field={'checkin_setting.crit_probability'}
                  label={t('暴击概率')}
                  placeholder='0.01'
                  onChange={handleFieldChange('checkin_setting.crit_probability')}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={!isEnabled || !isDynamicEnabled}
                  extraText={t('0.01 = 1%')}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6} xl={6}>
                <Form.InputNumber
                  field={'checkin_setting.crit_multiplier'}
                  label={t('暴击倍数')}
                  placeholder='5'
                  onChange={handleFieldChange('checkin_setting.crit_multiplier')}
                  min={1}
                  max={100}
                  disabled={!isEnabled || !isDynamicEnabled}
                  extraText={t('暴击时奖励乘以此倍数')}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6} xl={6}>
                <Form.InputNumber
                  field={'checkin_setting.crit_guarantee_days'}
                  label={t('保底暴击天数')}
                  placeholder='30'
                  onChange={handleFieldChange(
                    'checkin_setting.crit_guarantee_days',
                  )}
                  min={0}
                  disabled={!isEnabled || !isDynamicEnabled}
                  extraText={t('连续签到达到此天数必定暴击')}
                />
              </Col>
            </Row>
          </Form.Section>
        </Form>

        {isEnabled && isDynamicEnabled && (
          <>
            <Card
              title={t('奖励层级配置')}
              style={{ marginBottom: 16 }}
              headerExtraContent={
                <Button
                  icon={<IconPlus />}
                  onClick={addRewardTier}
                  disabled={!isEnabled || !isDynamicEnabled}
                >
                  {t('添加层级')}
                </Button>
              }
            >
              <Typography.Text
                type='tertiary'
                style={{ marginBottom: 12, display: 'block' }}
              >
                {t('根据用户昨日消费金额确定签到奖励范围，消费上限为-1表示无上限')}
              </Typography.Text>
              <Table
                columns={rewardTierColumns}
                dataSource={rewardTiers.map((item, index) => ({
                  ...item,
                  key: index,
                }))}
                pagination={false}
                size='small'
              />
            </Card>

            <Card
              title={t('连签加成配置')}
              style={{ marginBottom: 16 }}
              headerExtraContent={
                <Button
                  icon={<IconPlus />}
                  onClick={addStreakBonus}
                  disabled={!isEnabled || !isDynamicEnabled}
                >
                  {t('添加加成')}
                </Button>
              }
            >
              <Typography.Text
                type='tertiary'
                style={{ marginBottom: 12, display: 'block' }}
              >
                {t('连续签到天数达到指定范围时，奖励额外加成。最大天数为0表示无上限')}
              </Typography.Text>
              <Table
                columns={streakBonusColumns}
                dataSource={streakBonuses.map((item, index) => ({
                  ...item,
                  key: index,
                }))}
                pagination={false}
                size='small'
              />
            </Card>
          </>
        )}

        <Row>
          <Button type='primary' size='default' onClick={onSubmit}>
            {t('保存签到设置')}
          </Button>
        </Row>
      </Spin>
    </>
  );
}
