import type { WebDavConfig } from '../../../types/domain';
import type { StoreImportMode, StoreImportSelection } from '../../../stores/storeImportSelection';
import { useI18n } from '../../../i18n';
import { HelpHint } from '../../HelpHint';
import { Icon } from '../../Icon';
import { MenuSheetItem } from './MenuSheetItem';

type MenuBackupPageProps = {
  webdav: WebDavConfig;
  readyForWebDav: boolean;
  busy: boolean;
  localBackupAvailable: boolean;
  exportingData: boolean;
  importingData: boolean;
  exportingWebDav: boolean;
  importingWebDav: boolean;
  localExportDetail: string;
  localImportDetail: string;
  localExportProgress: number | null;
  localImportProgress: number | null;
  importMode: StoreImportMode;
  importSelection: StoreImportSelection;
  onBack: () => void;
  onSetImportMode: (mode: StoreImportMode) => void;
  onToggleImportDomain: (domain: keyof StoreImportSelection) => void;
  onSelectAllImportDomains: () => void;
  onClearImportDomains: () => void;
  onSetWebDavEndpoint: (value: string) => void;
  onSetWebDavUsername: (value: string) => void;
  onSetWebDavPassword: (value: string) => void;
  onExportData: () => void;
  onImportData: () => void;
  onExportToWebDav: () => void;
  onImportFromWebDav: () => void;
};

export function MenuBackupPage({
  webdav,
  readyForWebDav,
  busy,
  localBackupAvailable,
  exportingData,
  importingData,
  exportingWebDav,
  importingWebDav,
  localExportDetail,
  localImportDetail,
  localExportProgress,
  localImportProgress,
  importMode,
  importSelection,
  onBack,
  onSetImportMode,
  onToggleImportDomain,
  onSelectAllImportDomains,
  onClearImportDomains,
  onSetWebDavEndpoint,
  onSetWebDavUsername,
  onSetWebDavPassword,
  onExportData,
  onImportData,
  onExportToWebDav,
  onImportFromWebDav
}: MenuBackupPageProps) {
  const { t } = useI18n();

  return (
    <div className="menu-sheet-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.dataSection')}</small>
          <h2>
            {t('settings.backup.title')}
            <HelpHint
              className="help-hint--inline-title"
              label={t('settings.backup.title')}
              text={t('settings.backup.pageHelp')}
            />
          </h2>
          <p>{t('settings.backup.pageDetail')}</p>
        </div>
      </div>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">恢复范围</span>
          <p className="menu-section-note">只处理勾选的数据，没选的内容不会动。</p>
        </div>
        <div className="settings-form">
          <label htmlFor="backup-import-mode">恢复方式</label>
          <select
            id="backup-import-mode"
            value={importMode}
            onChange={(event) => onSetImportMode(event.target.value as StoreImportMode)}
            disabled={busy}
          >
            <option value="merge">合并恢复（保留当前已有内容）</option>
            <option value="replace">替换所选部分（以备份为准）</option>
          </select>
        </div>
        <div className="provider-inline-actions menu-webdav-actions">
          <button type="button" className="btn-secondary compact" onClick={onSelectAllImportDomains} disabled={busy}>全选</button>
          <button type="button" className="btn-secondary compact" onClick={onClearImportDomains} disabled={busy}>清空</button>
        </div>
        <div className="memory-toggle-grid">
          {([
            ['chat', '对话记录', '已有对话按 ID 更新，新对话加入'],
            ['collection', '收藏与工作区', '卡片、项目、资料与图片卡'],
            ['persona', '角色与记忆', '协作者设定、核心记忆与角色参数'],
            ['document', '记忆文档正文', '长期资料和参考文档的完整正文'],
            ['runtime', 'API、模型与 MCP', '供应商、模型线路、工具与自动化配置'],
            ['space', '界面与空间设置', '主题、显示偏好和当前空间状态'],
            ['asset', '图片与附件', '聊天和资料引用的本地文件']
          ] as Array<[keyof StoreImportSelection, string, string]>).map(([domain, label, detail]) => (
            <div
              key={domain}
              className="memory-toggle memory-toggle--switch toolbox-toggle-row"
              data-checked={importSelection[domain] ? 'true' : 'false'}
            >
              <div className="toolbox-toggle-row-head">
                <div className="memory-toggle-copy toolbox-toggle-copy">
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </div>
                <button
                  type="button"
                  className={`ps-toggle-sw memory-toggle-switch ${importSelection[domain] ? 'ps-toggle-sw--on' : ''}`}
                  aria-label={`${label}${importSelection[domain] ? '已选择' : '未选择'}`}
                  aria-pressed={importSelection[domain]}
                  onClick={() => onToggleImportDomain(domain)}
                  disabled={busy}
                >
                  <span className="ps-toggle-knob" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="settings-note">
          合并恢复会保留当前独有内容；替换只清理勾选的数据域。角色与记忆若包含长文档，建议同时勾选“记忆文档正文”。
        </div>
      </section>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">{t('settings.backup.localSection')}</span>
          <p className="menu-section-note">
            {localBackupAvailable
              ? t('settings.backup.localAvailableNote')
              : t('settings.backup.localUnavailableNote')}
          </p>
        </div>
        <MenuSheetItem
          icon="copy"
          title={exportingData ? t('settings.backup.exporting') : t('settings.backup.exportCurrent')}
          detail={localExportDetail}
          progress={localExportProgress}
          onClick={onExportData}
          disabled={busy || !localBackupAvailable}
        />
        <MenuSheetItem
          icon="folder"
          title={importingData ? t('settings.backup.importing') : t('settings.backup.importFromPackage')}
          detail={localImportDetail || t('settings.backup.importDetailFallback')}
          progress={localImportProgress}
          onClick={onImportData}
          disabled={busy || !localBackupAvailable}
        />
      </section>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker menu-section-kicker-row">
            WebDAV
            <HelpHint
              label="WebDAV"
              text={t('settings.backup.webdavHelp')}
            />
          </span>
          <p className="menu-section-note">{t('settings.backup.webdavNote')}</p>
        </div>
        <div className="menu-webdav-section">
          <div className="settings-form">
            <label>{t('settings.backup.webdavUrl')}</label>
            <input
              value={webdav.endpoint}
              onChange={(event) => onSetWebDavEndpoint(event.target.value)}
              placeholder="https://dav.jianguoyun.com/dav/Polaris"
            />
            <label>{t('settings.backup.webdavUsername')}</label>
            <input
              value={webdav.username}
              onChange={(event) => onSetWebDavUsername(event.target.value)}
              placeholder={t('settings.backup.webdavUsernamePlaceholder')}
            />
            <label>{t('settings.backup.webdavPassword')}</label>
            <input
              type="password"
              value={webdav.password}
              onChange={(event) => onSetWebDavPassword(event.target.value)}
              placeholder={t('settings.backup.webdavPasswordPlaceholder')}
            />
          </div>
          <div className="provider-inline-actions menu-webdav-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onExportToWebDav}
              disabled={busy || !readyForWebDav}
            >
              {exportingWebDav ? t('settings.backup.webdavUploading') : t('settings.backup.webdavUpload')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onImportFromWebDav}
              disabled={busy || !readyForWebDav}
            >
              {importingWebDav ? t('settings.backup.webdavReading') : t('settings.backup.webdavRestore')}
            </button>
          </div>
          <div className="settings-note">
            {readyForWebDav
              ? t('settings.backup.webdavReadyNote')
              : t('settings.backup.webdavMissingNote')}
          </div>
        </div>
      </section>
    </div>
  );
}
