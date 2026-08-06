import { type PersonaTabProps } from '../personaUiShared';
import { useI18n } from '../../../../i18n/useI18n';
import { Icon } from '../../../Icon';
import { PersonaToggle } from '../PersonaToggle';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ParamSlider({ label, hint, value, onChange, min, max, step, unit = '', emptyLabel = '—' }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  min: number; max: number; step: number; unit?: string; emptyLabel?: string;
}) {
  const { t } = useI18n();
  const parsedValue = Number.parseFloat(value);
  const resolvedValue = Number.isFinite(parsedValue) ? clamp(parsedValue, min, max) : min;
  const pct = ((resolvedValue - min) / (max - min)) * 100;
  const hasValue = value.trim().length > 0;

  return (
    <div className="ps-slider">
      <div className="ps-slider-head">
        <div className="ps-slider-left">
          <span className="ps-slider-label">{label}</span>
          {hint && <span className="ps-slider-hint">{hint}</span>}
        </div>
        <div className="ps-slider-value-row">
          <span className="ps-slider-val">{hasValue ? `${value}${unit}` : emptyLabel}</span>
          {hasValue && (
            <button
              type="button"
              className="ps-slider-clear"
              aria-label={t('request.engine.clearAria', { label })}
              title={t('request.engine.clearAria', { label })}
              onClick={() => onChange('')}
            >
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="ps-slider-track">
        <div className="ps-slider-fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={resolvedValue}
          onChange={(e) => onChange(e.target.value)}
          className="ps-slider-input"
        />
      </div>
    </div>
  );
}

export function EngineSettingsTab({ activePersona, onUpdatePersona }: PersonaTabProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="ps-slider-stack">
        <ParamSlider
          label="Temperature"
          hint={t('request.engine.temperatureHint')}
          value={activePersona?.advanced.temperature || ''}
          onChange={(v) => onUpdatePersona({ advanced: { temperature: v } })}
          min={0} max={2} step={0.05}
        />
        <ParamSlider
          label="Top P"
          hint={t('request.engine.topPHint')}
          value={activePersona?.advanced.topP || ''}
          onChange={(v) => onUpdatePersona({ advanced: { topP: v } })}
          min={0} max={1} step={0.05}
        />
        <ParamSlider
          label={t('request.engine.contextLimitLabel')}
          hint={t('request.engine.contextLimitHint')}
          value={activePersona?.advanced.contextMessageLimit || ''}
          onChange={(v) => onUpdatePersona({ advanced: { contextMessageLimit: v } })}
          min={1} max={200} step={1}
          unit={t('request.engine.contextLimitUnit')}
          emptyLabel={t('request.engine.noLimit')}
        />
      </div>

      <div className="ps-field">
        <div className="ps-field-head">
          <span className="ps-field-label">{t('request.engine.maxTokensLabel')}</span>
        </div>
        <input
          className="ps-input ps-input--mono"
          value={activePersona?.advanced.maxTokens || ''}
          onChange={(e) => onUpdatePersona({ advanced: { maxTokens: e.target.value } })}
          placeholder={t('request.engine.maxTokensPlaceholder')}
        />
      </div>

      <div className="ps-field">
        <div className="ps-field-head">
          <span className="ps-field-label">{t('request.engine.thinkingBudgetLabel')}</span>
        </div>
        <input
          className="ps-input ps-input--mono"
          value={activePersona?.advanced.thinkingBudget || ''}
          onChange={(e) => onUpdatePersona({ advanced: { thinkingBudget: e.target.value } })}
          placeholder={t('request.engine.thinkingBudgetPlaceholder')}
        />
      </div>

      <div className="ps-toggle-stack">
        <PersonaToggle
          label={t('request.engine.showThinkingLabel')}
          description={t('request.engine.showThinkingDetail')}
          checked={activePersona?.advanced.showThinking ?? true}
          onToggle={() => onUpdatePersona({ advanced: { showThinking: !(activePersona?.advanced.showThinking ?? true) } })}
        />

        <PersonaToggle
          label={t('request.engine.streamingLabel')}
          description={t('request.engine.streamingDetail')}
          checked={activePersona?.advanced.streaming ?? true}
          onToggle={() => onUpdatePersona({ advanced: { streaming: !(activePersona?.advanced.streaming ?? true) } })}
        />


        <PersonaToggle
          label="连续多条消息"
          description="一次模型回复自然拆成 2–5 条短消息，代码、表格和工具调用不会拆分。"
          checked={activePersona?.advanced.multiMessageEnabled ?? false}
          onToggle={() => onUpdatePersona({
            advanced: { multiMessageEnabled: !(activePersona?.advanced.multiMessageEnabled ?? false) }
          })}
        />
      </div>
    </>
  );
}
