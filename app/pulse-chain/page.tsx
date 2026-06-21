import type { Metadata } from 'next';
import PulseChain from '@/components/PulseChain';

export const metadata: Metadata = {
  title: 'Pulse Chain · 이삭 ISAAC',
  description: '핵 검출기 신호 처리 체인 시뮬레이터 — CR-RC 펄스 성형, 판별기, 파일업 보호, 다채널 스펙트럼',
};

export default function PulseChainPage() {
  return <PulseChain />;
}
