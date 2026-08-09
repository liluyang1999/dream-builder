import type { GraphicsQuality, TextScale, Theme } from '@dream-builder/ipc-contracts';
import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useRef } from 'react';
import { useModalFocus } from '../interaction/useModalFocus';
import { useAppStore } from '../state/store';

export function SettingsOverlay() {
  const open = useAppStore((state) => state.settingsOpen);
  const close = useAppStore((state) => state.setSettingsOpen);
  const resetPreferences = useAppStore((state) => state.resetPreferences);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalFocus({
    open,
    dialogRef,
    initialFocusRef: closeButtonRef,
    onEscape: () => close(false),
  });

  if (!open) return null;

  return (
    <div className="settings-overlay">
      <GlassPanel
        ref={dialogRef}
        className="settings-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="settings-overlay__header">
          <div>
            <span>舒适地探索</span>
            <h2 id="settings-title">设置</h2>
          </div>
          <GlassButton ref={closeButtonRef} aria-label="关闭设置" onClick={() => close(false)}>
            完成
          </GlassButton>
        </header>

        <div className="settings-overlay__grid">
          <SettingsSelect<Theme>
            label="界面主题"
            valueSelector={(state) => state.theme}
            onChange={(value) => useAppStore.getState().setTheme(value)}
            options={[
              ['auto', '跟随系统'],
              ['dark', '深色'],
              ['light', '浅色'],
            ]}
          />
          <SettingsSelect<GraphicsQuality>
            label="画面质量"
            valueSelector={(state) => state.graphicsQuality}
            onChange={(value) => useAppStore.getState().setGraphicsQuality(value)}
            options={[
              ['low', '流畅'],
              ['balanced', '均衡'],
              ['high', '精致'],
            ]}
          />

          <RangeSetting
            label="总音量"
            valueSelector={(state) => state.masterVolume}
            onChange={(value) => useAppStore.getState().setMasterVolume(value)}
            minimum={0}
            maximum={100}
            suffix="%"
          />
          <RangeSetting
            label="音乐"
            valueSelector={(state) => state.musicVolume}
            onChange={(value) => useAppStore.getState().setMusicVolume(value)}
            minimum={0}
            maximum={100}
            suffix="%"
          />
          <RangeSetting
            label="环境与交互音效"
            valueSelector={(state) => state.effectsVolume}
            onChange={(value) => useAppStore.getState().setEffectsVolume(value)}
            minimum={0}
            maximum={100}
            suffix="%"
          />
          <RangeSetting
            label="镜头灵敏度"
            valueSelector={(state) => state.cameraSensitivity}
            onChange={(value) => useAppStore.getState().setCameraSensitivity(value)}
            minimum={50}
            maximum={150}
            suffix="%"
          />

          <ToggleSetting
            label="减少动态效果"
            description="减弱漂浮、摇摆和镜头缓动。"
            valueSelector={(state) => state.reducedMotion}
            onChange={(value) => useAppStore.getState().setReducedMotion(value)}
          />
          <ToggleSetting
            label="高对比度"
            description="加强文字、边框和交互提示的对比。"
            valueSelector={(state) => state.highContrast}
            onChange={(value) => useAppStore.getState().setHighContrast(value)}
          />
          <ToggleSetting
            label="大号文字"
            description="放大 HUD、菜单与叙事文字。"
            valueSelector={(state) => state.textScale === 'large'}
            onChange={(value) => useAppStore.getState().setTextScale(value ? 'large' : 'normal')}
          />
          <ToggleSetting
            label="探索提示"
            description="显示首次引导与主流程提示。"
            valueSelector={(state) => state.showHints}
            onChange={(value) => useAppStore.getState().setShowHints(value)}
          />
        </div>

        <footer className="settings-overlay__footer">
          <p>设置会自动保存，并在下次启动时恢复。</p>
          <GlassButton
            onClick={() => {
              resetPreferences();
            }}
          >
            恢复默认设置
          </GlassButton>
        </footer>
      </GlassPanel>
    </div>
  );
}

interface SettingsState {
  theme: Theme;
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  cameraSensitivity: number;
  reducedMotion: boolean;
  highContrast: boolean;
  textScale: TextScale;
  showHints: boolean;
}

function SettingsSelect<Value extends string>({
  label,
  valueSelector,
  onChange,
  options,
}: {
  label: string;
  valueSelector(state: SettingsState): Value;
  onChange(value: Value): void;
  options: readonly (readonly [Value, string])[];
}) {
  const value = useAppStore(valueSelector);
  return (
    <label className="settings-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeSetting({
  label,
  valueSelector,
  onChange,
  minimum,
  maximum,
  suffix,
}: {
  label: string;
  valueSelector(state: SettingsState): number;
  onChange(value: number): void;
  minimum: number;
  maximum: number;
  suffix: string;
}) {
  const value = useAppStore(valueSelector);
  return (
    <label className="settings-field settings-field--range">
      <span>
        {label}
        <output>{`${value}${suffix}`}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={minimum}
        max={maximum}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

function ToggleSetting({
  label,
  description,
  valueSelector,
  onChange,
}: {
  label: string;
  description: string;
  valueSelector(state: SettingsState): boolean;
  onChange(value: boolean): void;
}) {
  const value = useAppStore(valueSelector);
  return (
    <label className="settings-toggle">
      <input
        aria-label={label}
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}
