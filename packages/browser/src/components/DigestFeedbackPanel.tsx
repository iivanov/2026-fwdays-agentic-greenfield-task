import { useCallback, useEffect, useState } from 'react';
import { type Session } from '@supabase/supabase-js';
import {
  applyDigestFeedback,
  fetchDigestFeedbackReport,
  toggledFeedback,
  updateDigestFeedback,
  type DigestFeedbackReport,
  type DigestFeedbackValue,
  type DigestSummary,
} from '../lib/digest-feedback.js';

type DigestFeedbackPanelProps = {
  session: Session;
  fixtureReport?: DigestFeedbackReport;
};

const emptyReport: DigestFeedbackReport = {
  digests: [],
  feedback_counts: { thumbs_up: 0, thumbs_down: 0, none: 0 },
};

function digestTitle(content: unknown): string {
  if (content && typeof content === 'object' && 'title' in content) {
    const title = (content as { title?: unknown }).title;
    if (typeof title === 'string' && title.trim()) {
      return title;
    }
  }
  return 'Untitled digest';
}

function digestItemCount(content: unknown): number {
  if (!content || typeof content !== 'object' || !('sections' in content)) {
    return 0;
  }
  const sections = (content as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) {
    return 0;
  }
  return sections.reduce((count, section) => {
    if (section && typeof section === 'object' && 'items' in section) {
      const items = (section as { items?: unknown }).items;
      return count + (Array.isArray(items) ? items.length : 0);
    }
    return count;
  }, 0);
}

function formatFeedback(value: DigestFeedbackValue): string {
  if (value === 'thumbs_up') return 'Thumbs up';
  if (value === 'thumbs_down') return 'Thumbs down';
  return 'No rating';
}

type DigestContentItem = {
  title: string;
  summary: string;
  sourceUrls: string[];
};

type DigestContentSection = {
  heading: string;
  items: DigestContentItem[];
};

function digestSections(content: unknown): DigestContentSection[] {
  if (!content || typeof content !== 'object' || !('sections' in content)) {
    return [];
  }
  const sections = (content as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections
    .map((section): DigestContentSection | null => {
      if (!section || typeof section !== 'object') {
        return null;
      }
      const heading = (section as { heading?: unknown }).heading;
      const items = (section as { items?: unknown }).items;
      if (typeof heading !== 'string' || !Array.isArray(items)) {
        return null;
      }

      const parsedItems = items
        .map((item): DigestContentItem | null => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const title = (item as { title?: unknown }).title;
          const summary = (item as { summary?: unknown }).summary;
          const sourceUrls = (item as { source_urls?: unknown }).source_urls;
          if (typeof title !== 'string' || typeof summary !== 'string') {
            return null;
          }
          return {
            title,
            summary,
            sourceUrls: Array.isArray(sourceUrls)
              ? sourceUrls.filter(
                  (url): url is string => typeof url === 'string' && Boolean(url.trim()),
                )
              : [],
          };
        })
        .filter((item): item is DigestContentItem => item !== null);

      return {
        heading,
        items: parsedItems,
      };
    })
    .filter((section): section is DigestContentSection => section !== null);
}

function sourceLabel(url: string, index: number): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') || `Source ${index + 1}`;
  } catch {
    return `Source ${index + 1}`;
  }
}

function DigestRow({
  digest,
  pending,
  onRate,
}: {
  digest: DigestSummary;
  pending: boolean;
  onRate: (digestId: string, feedback: DigestFeedbackValue) => void;
}) {
  const createdAt = new Date(digest.created_at);
  const itemCount = digestItemCount(digest.content);
  const sections = digestSections(digest.content);
  const [expanded, setExpanded] = useState(false);
  const contentId = `digest-content-${digest.id}`;

  return (
    <article
      className="glass-panel"
      style={{
        padding: '18px',
        borderRadius: '8px',
        display: 'grid',
        gap: '14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>{digestTitle(digest.content)}</h3>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.82rem' }}>
            {digest.flow_name} -{' '}
            {Number.isNaN(createdAt.getTime()) ? digest.created_at : createdAt.toLocaleString()}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'hsl(var(--text-secondary))',
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{itemCount} items</span>
          {sections.length > 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={contentId}
              onClick={() => setExpanded((current) => !current)}
              style={{
                minHeight: '32px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid hsl(var(--border-color))',
                background: '#ffffff',
                color: 'hsl(var(--accent-primary))',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          ) : null}
        </div>
      </div>

      {sections.length > 0 ? (
        <div
          id={contentId}
          hidden={!expanded}
          style={{
            display: expanded ? 'grid' : 'none',
            gap: '18px',
            borderTop: '1px solid hsl(var(--border-color))',
            paddingTop: '16px',
          }}
        >
          {sections.map((section, sectionIndex) => (
            <section key={`${digest.id}-${section.heading}-${sectionIndex}`}>
              <h4
                style={{
                  margin: '0 0 10px',
                  fontSize: '0.82rem',
                  textTransform: 'uppercase',
                  letterSpacing: 0,
                  color: 'hsl(var(--text-secondary))',
                }}
              >
                {section.heading}
              </h4>
              <ul
                style={{ display: 'grid', gap: '14px', listStyle: 'none', padding: 0, margin: 0 }}
              >
                {section.items.map((item, itemIndex) => (
                  <li
                    key={`${digest.id}-${sectionIndex}-${item.title}-${itemIndex}`}
                    style={{
                      display: 'grid',
                      gap: '8px',
                      paddingTop: itemIndex === 0 ? 0 : '14px',
                      borderTop: itemIndex === 0 ? '0' : '1px solid hsl(var(--border-color))',
                    }}
                  >
                    <strong style={{ color: 'hsl(var(--text-primary))' }}>{item.title}</strong>
                    <p
                      style={{
                        margin: 0,
                        color: 'hsl(var(--text-secondary))',
                        lineHeight: 1.55,
                      }}
                    >
                      {item.summary}
                    </p>
                    {item.sourceUrls.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {item.sourceUrls.map((url, index) => (
                          <a
                            key={`${url}-${index}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: 'hsl(var(--accent-primary))',
                              fontSize: '0.82rem',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {sourceLabel(url, index)}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.84rem' }}>
          {formatFeedback(digest.user_feedback)}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            aria-label="Rate digest thumbs up"
            title="Thumbs up"
            disabled={pending}
            onClick={() => onRate(digest.id, toggledFeedback(digest.user_feedback, 'thumbs_up'))}
            style={{
              width: '40px',
              height: '36px',
              borderRadius: '6px',
              border: '1px solid hsl(var(--border-color))',
              background:
                digest.user_feedback === 'thumbs_up'
                  ? 'rgba(34, 197, 94, 0.18)'
                  : 'rgba(255,255,255,0.03)',
              cursor: pending ? 'wait' : 'pointer',
              fontWeight: 700,
            }}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Rate digest thumbs down"
            title="Thumbs down"
            disabled={pending}
            onClick={() => onRate(digest.id, toggledFeedback(digest.user_feedback, 'thumbs_down'))}
            style={{
              width: '40px',
              height: '36px',
              borderRadius: '6px',
              border: '1px solid hsl(var(--border-color))',
              background:
                digest.user_feedback === 'thumbs_down'
                  ? 'rgba(239, 68, 68, 0.18)'
                  : 'rgba(255,255,255,0.03)',
              cursor: pending ? 'wait' : 'pointer',
              fontWeight: 700,
            }}
          >
            -
          </button>
          <button
            type="button"
            disabled={pending || digest.user_feedback === 'none'}
            onClick={() => onRate(digest.id, 'none')}
            style={{
              minWidth: '68px',
              height: '36px',
              borderRadius: '6px',
              border: '1px solid hsl(var(--border-color))',
              background: 'rgba(255,255,255,0.03)',
              cursor: pending
                ? 'wait'
                : digest.user_feedback === 'none'
                  ? 'not-allowed'
                  : 'pointer',
              fontSize: '0.82rem',
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </article>
  );
}

export default function DigestFeedbackPanel({ session, fixtureReport }: DigestFeedbackPanelProps) {
  const [report, setReport] = useState<DigestFeedbackReport>(fixtureReport ?? emptyReport);
  const [loading, setLoading] = useState(!fixtureReport);
  const [pendingDigestId, setPendingDigestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const loadDigests = useCallback(async () => {
    if (fixtureReport) {
      setReport(fixtureReport);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const nextReport = await fetchDigestFeedbackReport({
        supabaseUrl,
        anonKey,
        accessToken: session.access_token,
      });
      setReport(nextReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load digests.');
    } finally {
      setLoading(false);
    }
  }, [anonKey, fixtureReport, session.access_token, supabaseUrl]);

  useEffect(() => {
    void loadDigests();
  }, [loadDigests]);

  const handleRate = async (digestId: string, userFeedback: DigestFeedbackValue) => {
    try {
      setPendingDigestId(digestId);
      setError(null);
      if (!fixtureReport) {
        await updateDigestFeedback({
          supabaseUrl,
          anonKey,
          accessToken: session.access_token,
          digestId,
          userFeedback,
        });
      }
      setReport((current) => applyDigestFeedback(current, digestId, userFeedback));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save feedback.');
    } finally {
      setPendingDigestId(null);
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '6px' }}>Digest feedback</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: '680px' }}>
            Review retained digests and capture thumbs feedback for reporting.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDigests()}
          disabled={loading}
          style={{
            height: '38px',
            padding: '0 14px',
            borderRadius: '6px',
            border: '1px solid hsl(var(--border-color))',
            background: 'rgba(255,255,255,0.03)',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        {[
          ['Thumbs up', report.feedback_counts.thumbs_up],
          ['Thumbs down', report.feedback_counts.thumbs_down],
          ['No rating', report.feedback_counts.none],
        ].map(([label, value]) => (
          <div
            key={label}
            className="glass-panel"
            style={{ borderRadius: '8px', padding: '16px', minHeight: '86px' }}
          >
            <div style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>{label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: 'rgba(220, 38, 38, 0.15)',
            border: '1px dashed hsl(var(--danger))',
            padding: '12px',
            borderRadius: '8px',
            color: 'hsl(var(--danger))',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-panel" style={{ borderRadius: '8px', padding: '20px' }}>
          Loading digests...
        </div>
      ) : report.digests.length === 0 ? (
        <div className="glass-panel" style={{ borderRadius: '8px', padding: '20px' }}>
          No retained digests yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {report.digests.map((digest) => (
            <DigestRow
              key={digest.id}
              digest={digest}
              pending={pendingDigestId === digest.id}
              onRate={handleRate}
            />
          ))}
        </div>
      )}
    </section>
  );
}
