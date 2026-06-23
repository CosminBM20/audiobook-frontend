'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Pencil, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/Toast';
import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { name: string };
}

interface ReviewsData {
  reviews: Review[];
  count: number;
  averageRating: number;
}

interface MyReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

function StarRating({
  rating,
  onRate,
  readonly = false,
  size = 'md',
}: {
  rating: number;
  onRate?: (r: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}) {
  const [hovered, setHovered] = useState(0);
  const iconClass = size === 'sm' ? 'size-4' : 'size-5';

  return (
    <div className="flex gap-0.5" role={readonly ? undefined : 'group'} aria-label="Star rating">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onRate?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          className={`transition-transform ${readonly ? 'cursor-default pointer-events-none' : 'cursor-pointer hover:scale-110 active:scale-95'}`}
        >
          <Star
            className={`${iconClass} transition-colors ${
              star <= (hovered || rating)
                ? 'fill-[var(--gold)] text-[var(--gold)]'
                : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ReviewSection({ audiobookId }: { audiobookId: string }) {
  const { t } = useLanguage();
  const [data,       setData]      = useState<ReviewsData | null>(null);
  const [myReview,   setMyReview]  = useState<MyReview | null>(null);
  const [isEditing,  setIsEditing] = useState(false);
  const [rating,     setRating]    = useState(0);
  const [comment,    setComment]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const [reviewsRes, myRes] = await Promise.all([
        fetch(`${API_URL}/api/reviews/${audiobookId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/reviews/${audiobookId}/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const [reviewsData, myData] = await Promise.all([reviewsRes.json(), myRes.json()]);
      if (reviewsData.success) setData(reviewsData.data);
      if (myData.success)      setMyReview(myData.data ?? null);
    } catch { /* silent — non-critical */ }
  }, [audiobookId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const openForm = () => {
    setRating(myReview?.rating ?? 0);
    setComment(myReview?.comment ?? '');
    setIsEditing(true);
  };

  const closeForm = () => setIsEditing(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    const token = localStorage.getItem('token');
    setSubmitting(true);
    try {
      const res  = await fetch(`${API_URL}/api/reviews/${audiobookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, comment }),
      });
      const json = await res.json();
      if (json.success) {
        setMyReview(json.data);
        setIsEditing(false);
        toast(myReview ? t('reviewUpdated') : t('reviewSubmitted'), 'success');
        fetchReviews();
      } else {
        toast(t('errReviewSubmit'), 'error');
      }
    } catch {
      toast(t('errReviewSubmit'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const token = localStorage.getItem('token');
    try {
      const res  = await fetch(`${API_URL}/api/reviews/${audiobookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setMyReview(null);
        setIsEditing(false);
        toast(t('reviewDeleted'), 'success');
        fetchReviews();
      }
    } catch {
      toast(t('errReviewSubmit'), 'error');
    }
  };

  // Reviews that belong to other users (own review is shown separately above the list)
  const othersReviews = data?.reviews.filter(r => r.id !== myReview?.id) ?? [];

  return (
    <div className="space-y-3">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="font-semibold text-foreground text-sm">{t('reviewsSection')}</h2>
          {data && data.count > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono">
              {data.count}
            </span>
          )}
        </div>

        {data && data.count > 0 && (
          <div className="flex items-center gap-1.5">
            <Star className="size-3.5 fill-[var(--gold)] text-[var(--gold)]" />
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {data.averageRating.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({data.count} {t('ratingsUnit')})
            </span>
          </div>
        )}
      </div>

      {/* ── User's existing review (read mode) ─────────────────────────── */}
      {myReview && !isEditing && (
        <div className="px-3 py-3 rounded-xl border border-primary/25 bg-primary/5 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">{t('yourReview')}</span>
              <StarRating rating={myReview.rating} readonly size="sm" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={openForm}
                aria-label={t('editReview')}
                className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={handleDelete}
                aria-label={t('reviewDelete')}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
          {myReview.comment && (
            <p className="text-sm text-foreground leading-relaxed">{myReview.comment}</p>
          )}
          <span className="text-xs text-muted-foreground/50">{formatDate(myReview.createdAt)}</span>
        </div>
      )}

      {/* ── Write-a-review button (no review yet, not editing) ─────────── */}
      {!myReview && !isEditing && (
        <button
          onClick={openForm}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-muted-foreground border-2 border-dashed border-border/40 rounded-2xl hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all duration-200"
        >
          <Star className="size-3.5" />
          {t('writeReview')}
        </button>
      )}

      {/* ── Review form (create / edit) ────────────────────────────────── */}
      {isEditing && (
        <div className="px-3 py-3 rounded-xl border border-border/60 bg-card space-y-3 animate-slide-in">
          <p className="text-xs font-semibold text-foreground">
            {myReview ? t('editReview') : t('writeReview')}
          </p>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t('ratingLabel')}</span>
            <StarRating rating={rating} onRate={setRating} />
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t('commentLabel')}</span>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('commentPlaceholder')}
              maxLength={2000}
              rows={3}
              className="w-full text-sm bg-background border border-input rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none transition-all"
            />
            <p className="text-right text-xs text-muted-foreground/50">{comment.length}/2000</p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              className="h-8 rounded-xl px-3 bg-primary text-primary-foreground hover:bg-primary/90 flex-1 sm:flex-none"
            >
              {myReview ? t('updateReview') : t('submitReview')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={closeForm}
              className="h-8 rounded-xl px-3"
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Other users' reviews list ───────────────────────────────────── */}
      {othersReviews.length > 0 && (
        <div className="space-y-2">
          {othersReviews.map(review => (
            <div
              key={review.id}
              className="px-3 py-3 rounded-xl border border-border/60 bg-card space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate max-w-[140px] sm:max-w-none">
                    {review.user.name}
                  </span>
                  <StarRating rating={review.rating} readonly size="sm" />
                </div>
                <span className="text-xs text-muted-foreground/50 shrink-0">
                  {formatDate(review.createdAt)}
                </span>
              </div>
              {review.comment && (
                <p className="text-sm text-muted-foreground leading-relaxed break-words">
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state (no reviews at all, not editing) ──────────────── */}
      {data && data.count === 0 && !isEditing && (
        <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-border/40 rounded-2xl">
          <MessageSquare className="size-8 text-muted-foreground/25 mb-2.5" strokeWidth={1.5} />
          <p className="text-sm font-medium text-muted-foreground">{t('noReviews')}</p>
          <p className="text-xs text-muted-foreground/50 mt-0.5">{t('noReviewsHint')}</p>
        </div>
      )}
    </div>
  );
}
