import type { Metadata } from 'next';
import GravityLab from '@/components/GravityLab';

export const metadata: Metadata = {
  title: '중력가속도 실험실 · 이삭 ISAAC',
  description: '자유낙하 데이터를 가중 최소제곱 피팅으로 분석해 중력가속도 g를 측정하는 가상 실험실',
};

export default function GravityLabPage() {
  return <GravityLab />;
}
