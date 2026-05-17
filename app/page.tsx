import { API_URL } from '@/lib/api';
import HomeClient from './HomeClient';

export interface Audiobook {
  id: string;
  title: string;
  description?: string;
  createdAt?: string;
  language?: string;
  coverImageUrl: string;
  durationSeconds: number;
  author: { name: string };
  category: { name: string };
}

async function getBooks(): Promise<Audiobook[]> {
  try {
    const res = await fetch(`${API_URL}/api/audiobooks`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return data.success ? data.data : [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const books = await getBooks();
  return <HomeClient initialBooks={books} />;
}
