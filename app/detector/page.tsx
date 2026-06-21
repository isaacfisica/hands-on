import type { Metadata } from 'next';
import DetectorPage from '@/components/DetectorPage';

export const metadata: Metadata = {
  title: '검출기의 원리 — 이삭 ISAAC',
  description: '한 장의 그림으로 따라가는 입자물리 실험의 기초. 검출기는 입자를 어떻게 보는가.',
};

export default function Page() {
  return <DetectorPage />;
}
