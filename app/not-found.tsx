import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Library } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-4">
      <p className="text-8xl font-bold text-border select-none">404</p>
      <h2 className="text-xl font-semibold text-foreground">Page not found</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/">
          <Library className="size-4 mr-2" />
          Back to Library
        </Link>
      </Button>
    </div>
  );
}
