import { useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { APP_VERSION } from '../version';
import {
  type M2EvidenceBundle,
  type M2MemoryState,
  type M2ObservationOutcome,
  type M2PlaytestObservation,
  M2_EVIDENCE_SCHEMA_VERSION,
  evaluateM2EvidenceBundle,
  isM2EvidenceBundle,
} from './m2Evidence';

const OUTCOMES: ReadonlyArray<{ value: M2ObservationOutcome; label: string }> = [
  { value: 'completed', label: '完成世界复苏' },
  { value: 'time-limit', label: '达到 12 分钟' },
  { value: 'abandoned', label: '主动放弃' },
  { value: 'technical-stop', label: '技术故障中止' },
  { value: 'discomfort', label: '身体不适中止' },
];

const MEMORY_STATES: ReadonlyArray<{ value: M2MemoryState; label: string }> = [
  { value: 'not-found', label: '未发现' },
  { value: 'found', label: '发现但未读' },
  { value: 'read', label: '已阅读' },
];
const OBSERVATION_SLOT_KEYS = [
  'observation-slot-1',
  'observation-slot-2',
  'observation-slot-3',
  'observation-slot-4',
  'observation-slot-5',
] as const;

export function M2EvidenceWorkbench({
  initialBundle,
}: {
  initialBundle?: M2EvidenceBundle;
}) {
  const [bundle, setBundle] = useState<M2EvidenceBundle>(
    () => initialBundle ?? createEvidenceDraft(),
  );
  const [message, setMessage] = useState('先导入原生十分钟性能 JSON，再填写五次真实观察。');
  const evaluation = useMemo(() => evaluateM2EvidenceBundle(bundle), [bundle]);
  const schemaReady =
    evaluation.checks.find((check) => check.id === 'bundle-schema')?.passed === true;

  const updateObservation = (
    index: number,
    update: (observation: M2PlaytestObservation) => M2PlaytestObservation,
  ) => {
    setBundle((current) => ({
      ...current,
      observations: current.observations.map((observation, candidateIndex) =>
        candidateIndex === index ? update(observation) : observation,
      ),
    }));
  };

  const importPerformanceReport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      setBundle((current) => ({ ...current, performanceReport: parsed }));
      setMessage(`已读取性能报告：${file.name}。通过与否以下方门槛为准。`);
    } catch {
      setMessage(`无法读取 ${file.name}：文件不是有效 JSON。`);
    }
  };

  const importBundle = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isM2EvidenceBundle(parsed)) {
        setMessage(`无法导入 ${file.name}：证据包结构不完整。`);
        return;
      }
      setBundle(parsed);
      setMessage(`已导入证据包：${file.name}。原有失败门槛没有被隐藏。`);
    } catch {
      setMessage(`无法导入 ${file.name}：文件不是有效 JSON。`);
    }
  };

  const exportBundle = () => {
    const exportedBundle = { ...bundle, createdAt: new Date().toISOString() };
    setBundle(exportedBundle);
    downloadJson(
      exportedBundle,
      `dream-builder-m2-evidence-${exportedBundle.createdAt.slice(0, 10)}.json`,
    );
    setMessage('证据包已在本机导出；请连同对应安装包哈希一起归档。');
  };

  return (
    <main className="m2-workbench">
      <header className="m2-workbench__hero">
        <div>
          <p className="m2-workbench__eyebrow">Dream Builder · 本地验收工具</p>
          <h1>M2 验收证据工作台</h1>
          <p>把五次无提示观察与一份原生十分钟性能报告汇总成可复核证据；失败结果也会保留。</p>
        </div>
        <div
          className={
            evaluation.passed
              ? 'm2-workbench__status m2-workbench__status--pass'
              : 'm2-workbench__status'
          }
          role="status"
        >
          <span>{evaluation.passed ? '门禁通过' : '证据未齐'}</span>
          <strong>{evaluation.passed ? 'M2 门禁通过' : 'M2 仍在进行中'}</strong>
        </div>
      </header>

      <aside className="m2-workbench__privacy">
        <strong>隐私边界</strong>
        <p>
          本页不联网，也不会自动上传数据。不要记录姓名、账号、联系方式或玩家路径；只使用 P01–P05
          匿名编号、里程碑时间与必要的行为观察。
        </p>
      </aside>

      <section className="m2-workbench__section" aria-labelledby="build-heading">
        <div className="m2-workbench__section-heading">
          <div>
            <p className="m2-workbench__step">01</p>
            <h2 id="build-heading">绑定构建与目标设备</h2>
          </div>
          <p>构建哈希防止把旧报告误配到新版本。</p>
        </div>
        <div className="m2-workbench__grid">
          <TextField
            label="应用版本"
            value={bundle.build.appVersion}
            onChange={(appVersion) =>
              setBundle((current) => ({
                ...current,
                build: { ...current.build, appVersion },
              }))
            }
          />
          <TextField
            label="工作树标识"
            value={bundle.build.worktreeId}
            placeholder="例如 HEAD短哈希-dirty-日期"
            onChange={(worktreeId) =>
              setBundle((current) => ({
                ...current,
                build: { ...current.build, worktreeId },
              }))
            }
          />
          <TextField
            className="m2-workbench__span-2"
            label="dream-builder.exe SHA-256"
            value={bundle.build.artifactSha256}
            placeholder="64 位十六进制"
            onChange={(artifactSha256) =>
              setBundle((current) => ({
                ...current,
                build: { ...current.build, artifactSha256 },
              }))
            }
          />
          <TextField
            label="设备代号"
            value={bundle.targetDevice.id}
            onChange={(id) =>
              setBundle((current) => ({
                ...current,
                targetDevice: { ...current.targetDevice, id },
              }))
            }
          />
          <TextField
            label="CPU"
            value={bundle.targetDevice.cpu}
            onChange={(cpu) =>
              setBundle((current) => ({
                ...current,
                targetDevice: { ...current.targetDevice, cpu },
              }))
            }
          />
          <TextField
            label="GPU"
            value={bundle.targetDevice.gpu}
            onChange={(gpu) =>
              setBundle((current) => ({
                ...current,
                targetDevice: { ...current.targetDevice, gpu },
              }))
            }
          />
          <TextField
            label="GPU 驱动"
            value={bundle.targetDevice.gpuDriver}
            onChange={(gpuDriver) =>
              setBundle((current) => ({
                ...current,
                targetDevice: { ...current.targetDevice, gpuDriver },
              }))
            }
          />
          <NumberField
            label="内存（GB）"
            value={bundle.targetDevice.memoryGb}
            step={0.1}
            onChange={(memoryGb) => updateDevice(setBundle, 'memoryGb', memoryGb)}
          />
          <NumberField
            label="刷新率（Hz）"
            value={bundle.targetDevice.refreshRateHz}
            onChange={(refreshRateHz) => updateDevice(setBundle, 'refreshRateHz', refreshRateHz)}
          />
          <NumberField
            label="显示宽度（px）"
            value={bundle.targetDevice.displayWidth}
            onChange={(displayWidth) => updateDevice(setBundle, 'displayWidth', displayWidth)}
          />
          <NumberField
            label="显示高度（px）"
            value={bundle.targetDevice.displayHeight}
            onChange={(displayHeight) => updateDevice(setBundle, 'displayHeight', displayHeight)}
          />
          <NumberField
            label="系统缩放（%）"
            value={bundle.targetDevice.scalePercent}
            onChange={(scalePercent) => updateDevice(setBundle, 'scalePercent', scalePercent)}
          />
          <NumberField
            label="渲染设备像素比（DPR）"
            value={bundle.targetDevice.devicePixelRatio}
            step={0.001}
            onChange={(devicePixelRatio) =>
              updateDevice(setBundle, 'devicePixelRatio', devicePixelRatio)
            }
          />
          <NumberField
            label="渲染视口宽度（CSS px）"
            value={bundle.targetDevice.viewportWidth}
            onChange={(viewportWidth) => updateDevice(setBundle, 'viewportWidth', viewportWidth)}
          />
          <NumberField
            label="渲染视口高度（CSS px）"
            value={bundle.targetDevice.viewportHeight}
            onChange={(viewportHeight) => updateDevice(setBundle, 'viewportHeight', viewportHeight)}
          />
        </div>
      </section>

      <section className="m2-workbench__section" aria-labelledby="performance-heading">
        <div className="m2-workbench__section-heading">
          <div>
            <p className="m2-workbench__step">02</p>
            <h2 id="performance-heading">导入目标设备报告</h2>
          </div>
          <p>必须来自 Rust/Tauri、满十分钟，并同时经过加载与净化。</p>
        </div>
        <div className="m2-workbench__actions">
          <FileButton
            label="选择性能 JSON"
            accept=".json,application/json"
            onChange={importPerformanceReport}
          />
          <CheckboxField
            label="人工观察到持续卡顿"
            checked={bundle.targetDevice.sustainedStutterObserved}
            onChange={(sustainedStutterObserved) =>
              updateDevice(setBundle, 'sustainedStutterObserved', sustainedStutterObserved)
            }
          />
        </div>
      </section>

      <section className="m2-workbench__section" aria-labelledby="observations-heading">
        <div className="m2-workbench__section-heading">
          <div>
            <p className="m2-workbench__step">03</p>
            <h2 id="observations-heading">记录五次无提示观察</h2>
          </div>
          <p>时间均从交给玩家开始计算；空白里程碑导出为 null，不得猜填。</p>
        </div>
        <div className="m2-observations">
          {bundle.observations.map((observation, index) => {
            return (
              <ObservationForm
                key={observationSlotKey(index)}
                index={index}
                observation={observation}
                onChange={(next) => updateObservation(index, () => next)}
              />
            );
          })}
        </div>
      </section>

      <section className="m2-workbench__section" aria-labelledby="gates-heading">
        <div className="m2-workbench__section-heading">
          <div>
            <p className="m2-workbench__step">04</p>
            <h2 id="gates-heading">门槛判定与归档</h2>
          </div>
          <p>任何一项失败都保持 M2 进行中，并保留原始观察再修改游戏。</p>
        </div>
        <div className="m2-workbench__table-wrap">
          <table aria-label="M2 门槛判定">
            <thead>
              <tr>
                <th>门槛</th>
                <th>实测</th>
                <th>要求</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.checks.map((check) => (
                <tr key={check.id}>
                  <th scope="row">{check.label}</th>
                  <td>{check.actual}</td>
                  <td>{check.required}</td>
                  <td>
                    <span
                      className={check.passed ? 'm2-gate m2-gate--pass' : 'm2-gate m2-gate--fail'}
                    >
                      {check.passed ? '通过' : '未通过'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {evaluation.issues.length > 0 ? (
          <details className="m2-workbench__issues">
            <summary>查看 {evaluation.issues.length} 项结构或隐私问题</summary>
            <ul>
              {evaluation.issues.map((issue) => (
                <li key={`${issue.code}:${issue.path}`}>
                  <code>{issue.path}</code>：{issue.message}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="m2-workbench__archive">
          <p role="status">{message}</p>
          <div className="m2-workbench__actions">
            <FileButton
              label="导入已有证据包"
              accept=".json,application/json"
              onChange={importBundle}
            />
            <button type="button" disabled={!schemaReady} onClick={exportBundle}>
              导出证据包
            </button>
          </div>
          {!schemaReady ? <small>补齐构建信息并导入结构有效的性能报告后即可导出。</small> : null}
        </div>
      </section>
    </main>
  );
}

function ObservationForm({
  index,
  observation,
  onChange,
}: {
  index: number;
  observation: M2PlaytestObservation;
  onChange(observation: M2PlaytestObservation): void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const update = <Key extends keyof M2PlaytestObservation>(
    key: Key,
    value: M2PlaytestObservation[Key],
  ) => onChange({ ...observation, [key]: value });
  const updateMilestone = <Key extends keyof M2PlaytestObservation['milestones']>(
    key: Key,
    value: M2PlaytestObservation['milestones'][Key],
  ) => onChange({ ...observation, milestones: { ...observation.milestones, [key]: value } });
  const updateSeedTime = (seedIndex: number, value: number | null) => {
    const lightSeedSeconds = [...observation.milestones.lightSeedSeconds] as [
      number | null,
      number | null,
      number | null,
    ];
    lightSeedSeconds[seedIndex] = value;
    updateMilestone('lightSeedSeconds', lightSeedSeconds);
  };

  return (
    <details
      className="m2-observation"
      data-testid="m2-observation"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span>{observation.participantCode}</span>
        <strong>{outcomeLabel(observation.outcome)}</strong>
      </summary>
      <div className="m2-observation__body">
        <div className="m2-workbench__grid">
          <TextField
            label="匿名编号"
            value={observation.participantCode}
            placeholder="P01"
            onChange={(participantCode) => update('participantCode', participantCode.toUpperCase())}
          />
          <label className="m2-field">
            <span>观察日期</span>
            <input
              type="date"
              value={observation.sessionDate}
              onChange={(event) => update('sessionDate', event.currentTarget.value)}
            />
          </label>
          <CheckboxField
            label="确认此前未接触项目"
            checked={observation.firstExposureConfirmed}
            onChange={(value) => update('firstExposureConfirmed', value)}
          />
          <CheckboxField
            label="确认未阅读设计文档"
            checked={observation.designDocsUnreadConfirmed}
            onChange={(value) => update('designDocsUnreadConfirmed', value)}
          />
          <label className="m2-field">
            <span>结果</span>
            <select
              value={observation.outcome}
              onChange={(event) =>
                update('outcome', event.currentTarget.value as M2ObservationOutcome)
              }
            >
              {OUTCOMES.map((outcome) => (
                <option key={outcome.value} value={outcome.value}>
                  {outcome.label}
                </option>
              ))}
            </select>
          </label>
          <label className="m2-field">
            <span>记忆状态</span>
            <select
              value={observation.milestones.memoryState}
              onChange={(event) =>
                updateMilestone('memoryState', event.currentTarget.value as M2MemoryState)
              }
            >
              {MEMORY_STATES.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </label>
          <TimeField
            label="首次移动（秒）"
            value={observation.milestones.firstMovementSeconds}
            onChange={(value) => updateMilestone('firstMovementSeconds', value)}
          />
          <TimeField
            label="找到首条路线（秒）"
            value={observation.milestones.firstRouteSeconds}
            onChange={(value) => updateMilestone('firstRouteSeconds', value)}
          />
          {[0, 1, 2].map((seedIndex) => (
            <TimeField
              key={seedIndex}
              label={`第 ${seedIndex + 1} 枚光种（秒）`}
              value={observation.milestones.lightSeedSeconds[seedIndex] ?? null}
              onChange={(value) => updateSeedTime(seedIndex, value)}
            />
          ))}
          <TimeField
            label="首次到达净化节点（秒）"
            value={observation.milestones.nodeArrivalSeconds}
            onChange={(value) => updateMilestone('nodeArrivalSeconds', value)}
          />
          <TimeField
            label="完成世界复苏（秒）"
            value={observation.milestones.completionSeconds}
            onChange={(value) => updateMilestone('completionSeconds', value)}
          />
          <NumberField
            label="R 重置次数"
            value={observation.resetCount}
            min={0}
            onChange={(value) => update('resetCount', Math.max(0, Math.trunc(value)))}
          />
          <NumberField
            label="净化错误次数"
            value={observation.purificationErrors}
            min={0}
            onChange={(value) => update('purificationErrors', Math.max(0, Math.trunc(value)))}
          />
          <CheckboxField
            label="把 seed / 导出误认作主目标"
            checked={observation.misidentifiedToolAsGoal}
            onChange={(value) => update('misidentifiedToolAsGoal', value)}
          />
          <CheckboxField
            label="出现不可恢复卡死"
            checked={observation.unrecoverableStuck}
            onChange={(value) => update('unrecoverableStuck', value)}
          />
          <CheckboxField
            label="收到操作或路线提示"
            checked={observation.hintReceived}
            onChange={(value) => update('hintReceived', value)}
          />
        </div>
        <div className="m2-observation__notes">
          <TextAreaField
            label="停留超过 20 秒的位置"
            value={observation.longStallLocations}
            onChange={(value) => update('longStallLocations', value)}
          />
          <TextAreaField
            label="卡死 / 穿模 / 眩晕 / 可访问性问题"
            value={observation.technicalIssueNote}
            onChange={(value) => update('technicalIssueNote', value)}
          />
          <TextAreaField
            label="若收到提示，原样记录提示"
            value={observation.hintNote}
            onChange={(value) => update('hintNote', value)}
          />
          <TextAreaField
            label="玩家复述的目标"
            value={observation.restatedGoal}
            onChange={(value) => update('restatedGoal', value)}
          />
          <TextAreaField
            label="最困惑处"
            value={observation.confusionNote}
            onChange={(value) => update('confusionNote', value)}
          />
          <TextAreaField
            label="最喜欢 / 最想截图的时刻"
            value={observation.favoriteMomentNote}
            onChange={(value) => update('favoriteMomentNote', value)}
          />
        </div>
      </div>
    </details>
  );
}

function TextField({
  label,
  value,
  placeholder,
  className,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  className?: string;
  onChange(value: string): void;
}) {
  return (
    <label className={className ? `m2-field ${className}` : 'm2-field'}>
      <span>{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min = 0.1,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange(value: number): void;
}) {
  return (
    <label className="m2-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange(value: number | null): void;
}) {
  return (
    <label className="m2-field">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          onChange(raw === '' ? null : Number(raw));
        }}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="m2-field">
      <span>{label}</span>
      <textarea
        rows={3}
        maxLength={500}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <label className="m2-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function FileButton({
  label,
  accept,
  onChange,
}: {
  label: string;
  accept: string;
  onChange(event: ChangeEvent<HTMLInputElement>): void;
}) {
  return (
    <label className="m2-file-button">
      <span>{label}</span>
      <input type="file" accept={accept} onChange={onChange} />
    </label>
  );
}

function updateDevice<Key extends keyof M2EvidenceBundle['targetDevice']>(
  setBundle: (update: (bundle: M2EvidenceBundle) => M2EvidenceBundle) => void,
  key: Key,
  value: M2EvidenceBundle['targetDevice'][Key],
): void {
  setBundle((current) => ({
    ...current,
    targetDevice: { ...current.targetDevice, [key]: value },
  }));
}

function createEvidenceDraft(): M2EvidenceBundle {
  return {
    schemaVersion: M2_EVIDENCE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    build: {
      appVersion: APP_VERSION,
      worktreeId: '',
      artifactSha256: '',
    },
    targetDevice: {
      id: 'M2-WIN-I7-10850H-GTX1650TI',
      cpu: 'Intel Core i7-10850H',
      gpu: 'NVIDIA GeForce GTX 1650 Ti Max-Q',
      gpuDriver: '32.0.15.7357',
      memoryGb: 31.8,
      displayWidth: 3840,
      displayHeight: 2160,
      refreshRateHz: 59,
      scalePercent: 250,
      devicePixelRatio: 2.625,
      viewportWidth: 1220,
      viewportHeight: 744,
      sustainedStutterObserved: false,
    },
    performanceReport: null,
    observations: Array.from({ length: 5 }, (_, index) =>
      createObservation(index + 1, localDate()),
    ),
  };
}

function createObservation(index: number, sessionDate: string): M2PlaytestObservation {
  return {
    participantCode: `P${String(index).padStart(2, '0')}`,
    sessionDate,
    firstExposureConfirmed: false,
    designDocsUnreadConfirmed: false,
    outcome: 'time-limit',
    milestones: {
      firstMovementSeconds: null,
      firstRouteSeconds: null,
      lightSeedSeconds: [null, null, null],
      memoryState: 'not-found',
      nodeArrivalSeconds: null,
      completionSeconds: null,
    },
    misidentifiedToolAsGoal: false,
    unrecoverableStuck: false,
    hintReceived: false,
    resetCount: 0,
    purificationErrors: 0,
    longStallLocations: '',
    technicalIssueNote: '',
    hintNote: '',
    restatedGoal: '',
    confusionNote: '',
    favoriteMomentNote: '',
  };
}

function localDate(): string {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
}

function outcomeLabel(outcome: M2ObservationOutcome): ReactNode {
  return OUTCOMES.find((candidate) => candidate.value === outcome)?.label ?? outcome;
}

function observationSlotKey(index: number): string {
  return OBSERVATION_SLOT_KEYS[index] ?? `observation-slot-extra-${index + 1}`;
}

function downloadJson(value: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
