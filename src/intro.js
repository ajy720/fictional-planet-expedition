export const introSections = [
  {
    at: 0, title: '지구 궤도', subtitle: '지구를 떠나기 전, 거리의 기준을 맞춥니다.',
    label: '비교 축척', value: '지구–태양 = 1cm', note: '지구–태양 평균 거리 약 1억 4,960만 km'
  },
  {
    at: .23, title: '달 접근', subtitle: '창을 채웠던 지구가 달 옆의 작은 원반으로 보입니다.',
    label: '지구–달 평균 거리', value: '384,400 km', note: '빛으로 약 1.3초'
  },
  {
    at: .72, title: '태양계', subtitle: '지구가 작아지고 태양과 행성의 궤도가 시야에 들어옵니다.',
    label: '태양계 거리 단위', value: '1 AU', note: '약 1억 4,960만 km · 천체 크기와 일부 궤도 간격 강조'
  }
];

export const lastIntroSection = introSections.length - 1;

export function introSectionAt(progress) {
  return introSections.findLastIndex(section => progress >= section.at);
}
