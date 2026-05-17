'use client';

import React from 'react';

interface State { hasError: boolean }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // Reads localStorage directly — this component sits outside LanguageProvider
    // so it cannot use the useLanguage() hook.
    const lang = (() => {
      try { return localStorage.getItem('lang') ?? 'ro'; } catch { return 'ro'; }
    })();
    const en = lang === 'en';

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-background">
        <p className="text-5xl mb-6 select-none" aria-hidden="true">⚠️</p>
        <h1 className="text-xl font-bold text-foreground mb-2">
          {en ? 'Something went wrong' : 'A apărut o eroare'}
        </h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed">
          {en
            ? 'An unexpected error occurred. You can try reloading the page.'
            : 'A apărut o eroare neașteptată. Poți încerca să reîncarci pagina.'}
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            {en ? 'Reload page' : 'Reîncarcă pagina'}
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-xl border border-border/70 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {en ? 'Go to library' : 'Mergi la librărie'}
          </a>
        </div>
      </div>
    );
  }
}
