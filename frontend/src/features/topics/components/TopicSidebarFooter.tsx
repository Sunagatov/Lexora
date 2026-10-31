import type {Topic} from '@/features/topics/types/topicTypes'

const SelectChevron = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4.5 6 7.5l3-3"/>
  </svg>
)

type Props = {
  addingTopic: boolean
  topicError: string | null
  newTopicName: string
  newTopicParentId: number | ''
  topicOptions: Topic[]
  createPending: boolean
  onNewTopicNameChange: (value: string) => void
  onNewTopicParentIdChange: (value: number | '') => void
  onCreate: () => void
  onCancel: () => void
  onStartAdd: () => void
}

export function TopicSidebarFooter({
  addingTopic, topicError, newTopicName, newTopicParentId, topicOptions, createPending,
  onNewTopicNameChange, onNewTopicParentIdChange, onCreate,
  onCancel, onStartAdd,
}: Props) {
  return (
    <div className="sidebar-footer">
      {addingTopic ? (
        <div className="sidebar-new-topic-wrap">
          <div className="sidebar-new-topic-form">
            <div className="sidebar-new-topic-parent-wrap">
              <select
                className="sidebar-new-topic-parent"
                value={newTopicParentId === '' ? '' : String(newTopicParentId)}
                onChange={(e) => {
                  const value = e.target.value
                  onNewTopicParentIdChange(value === '' ? '' : Number(value))
                }}
              >
                <option value="">Top-level topic</option>
                {topicOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="sidebar-new-topic-parent-chevron"><SelectChevron /></span>
            </div>
            <div className="sidebar-new-topic-row">
              <input
                className="sidebar-new-topic-input"
                placeholder="Topic name…"
                value={newTopicName}
                autoFocus
                maxLength={200}
                onChange={(e) => onNewTopicNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTopicName.trim() && !createPending) onCreate()
                  if (e.key === 'Escape') onCancel()
                }}
              />
              <button type="button" className="sidebar-new-topic-save" disabled={!newTopicName.trim() || createPending} onClick={onCreate}>
                {createPending ? '…' : 'Add'}
              </button>
              <button type="button" className="sidebar-new-topic-cancel" onClick={onCancel}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                </svg>
              </button>
            </div>
          </div>
          {topicError && <div className="sidebar-new-topic-error">{topicError}</div>}
        </div>
      ) : (
        <button type="button" className="sidebar-add-topic-btn" onClick={onStartAdd} aria-label="Create topic">
          <span className="sidebar-add-topic-plus">+</span>
          <span className="sidebar-add-topic-text"> New topic</span>
        </button>
      )}
    </div>
  )
}
