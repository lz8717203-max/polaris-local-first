import { useState } from 'react';
import { useI18n } from '../../../../i18n';

type InnerVoiceComposerSheetProps = {
  initialSpoken: string;
  disabled: boolean;
  onCancel: () => void;
  onSend: (innerVoice: string, spoken: string) => Promise<void>;
};

export function InnerVoiceComposerSheet({
  initialSpoken,
  disabled,
  onCancel,
  onSend
}: InnerVoiceComposerSheetProps) {
  const { t } = useI18n();
  const [innerVoice, setInnerVoice] = useState('');
  const [spoken, setSpoken] = useState(initialSpoken);
  const [submitting, setSubmitting] = useState(false);
  const canSend = Boolean(innerVoice.trim()) && !disabled && !submitting;

  const submit = async () => {
    if (!canSend) return;
    setSubmitting(true);
    try {
      await onSend(innerVoice.trim(), spoken.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="inner-voice-composer-sheet" role="dialog" aria-label={t('chat.innerVoice.sheetAria')}>
      <div className="inner-voice-composer-head">
        <div>
          <span>{t('chat.innerVoice.kicker')}</span>
          <strong>{t('chat.innerVoice.title')}</strong>
        </div>
        <button type="button" onClick={onCancel} disabled={submitting}>
          {t('chat.innerVoice.cancel')}
        </button>
      </div>
      <label className="inner-voice-field">
        <span>{t('chat.innerVoice.thoughtLabel')}</span>
        <textarea
          rows={3}
          value={innerVoice}
          onChange={(event) => setInnerVoice(event.target.value)}
          placeholder={t('chat.innerVoice.thoughtPlaceholder')}
          autoFocus
          disabled={disabled || submitting}
        />
      </label>
      <label className="inner-voice-field">
        <span>{t('chat.innerVoice.spokenLabel')}</span>
        <textarea
          rows={2}
          value={spoken}
          onChange={(event) => setSpoken(event.target.value)}
          placeholder={t('chat.innerVoice.spokenPlaceholder')}
          disabled={disabled || submitting}
        />
      </label>
      <div className="inner-voice-composer-footer">
        <span>{t('chat.innerVoice.hint')}</span>
        <button type="button" className="inner-voice-send" disabled={!canSend} onClick={() => { void submit(); }}>
          {submitting ? t('chat.innerVoice.sending') : t('chat.innerVoice.send')}
        </button>
      </div>
    </section>
  );
}
